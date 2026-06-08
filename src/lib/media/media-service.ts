import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const publicUploadsRoot = path.join(process.cwd(), "public", "uploads");
const maxPreviewMp3Bytes = 20 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;
const maxDownloadBytes = 50 * 1024 * 1024;

type UploadKind = "product-images" | "track-artwork" | "music-previews" | "music-downloads";

function fileExtension(name: string) {
  return path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

function publicUploadPath(kind: UploadKind, filename: string) {
  return `/uploads/${kind}/${filename}`;
}

function assertHttpUrl(value: string, label: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must be a valid http or https URL.`);
  }

  return url;
}

function googleDriveFileId(url: URL) {
  if (!["drive.google.com", "www.drive.google.com"].includes(url.hostname)) {
    return null;
  }

  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);

  if (fileMatch?.[1]) {
    return fileMatch[1];
  }

  return url.searchParams.get("id");
}

function normalizeGoogleDriveUrl(value: string) {
  const url = assertHttpUrl(value, "Download URL");
  const id = googleDriveFileId(url);

  if (!id) {
    return value;
  }

  const direct = new URL("https://drive.google.com/uc");
  direct.searchParams.set("export", "download");
  direct.searchParams.set("id", id);

  return direct.toString();
}

function imageDimensions(buffer: Buffer, contentType: string) {
  if (contentType === "image/png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16)
    };
  }

  if (contentType === "image/gif" && buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return {
      height: buffer.readUInt16LE(8),
      width: buffer.readUInt16LE(6)
    };
  }

  if (contentType === "image/jpeg" && buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;

    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);

      if (length < 2) {
        return null;
      }

      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }

      offset += 2 + length;
    }
  }

  return null;
}

function id3Offset(buffer: Buffer) {
  if (buffer.length < 10 || buffer.toString("ascii", 0, 3) !== "ID3") {
    return 0;
  }

  const size =
    ((buffer[6] & 0x7f) << 21) |
    ((buffer[7] & 0x7f) << 14) |
    ((buffer[8] & 0x7f) << 7) |
    (buffer[9] & 0x7f);
  const footerBytes = buffer[5] & 0x10 ? 10 : 0;

  return 10 + size + footerBytes;
}

function mp3BitrateKbps(buffer: Buffer) {
  const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const start = Math.min(id3Offset(buffer), buffer.length);
  const end = Math.min(buffer.length - 4, start + 64 * 1024);

  for (let offset = start; offset < end; offset += 1) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      continue;
    }

    const versionId = (buffer[offset + 1] >> 3) & 0x03;
    const layer = (buffer[offset + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;

    if (versionId === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15) {
      continue;
    }

    return versionId === 3 ? mpeg1Layer3Bitrates[bitrateIndex] : mpeg2Layer3Bitrates[bitrateIndex];
  }

  return null;
}

function assertSquareImageUpload(buffer: Buffer, contentType: string) {
  const dimensions = imageDimensions(buffer, contentType);

  if (!dimensions) {
    return;
  }

  if (dimensions.width !== dimensions.height) {
    throw new Error("Image upload must be square. Use artwork around 500 x 500.");
  }
}

function assertMp3Upload(buffer: Buffer, require320Kbps: boolean, label: string) {
  const bitrate = mp3BitrateKbps(buffer);

  if (!bitrate) {
    throw new Error(`${label} must contain a valid MP3 audio frame.`);
  }

  if (require320Kbps && bitrate !== 320) {
    throw new Error(`${label} must be encoded at 320kbps.`);
  }
}

async function remoteMp3BitrateKbps(url: URL) {
  const response = await fetch(url, {
    headers: {
      Range: "bytes=0-65535"
    },
    signal: AbortSignal.timeout(3500)
  });

  if (!response.ok && response.status !== 206) {
    return null;
  }

  return mp3BitrateKbps(Buffer.from(await response.arrayBuffer()));
}

export function normalizeOptionalImageUrl(value: string | undefined, label = "Image URL") {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error(`${label} must be 500 characters or fewer.`);
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/(product-images|track-artwork)\/[^/]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(text)) {
      return text;
    }

    throw new Error(`${label} upload path must point to an uploaded image file.`);
  }

  const url = assertHttpUrl(text, label);
  const pathname = url.pathname.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)) {
    throw new Error(`${label} must point to an image file. Use a square image, ideally 500 x 500.`);
  }

  return text;
}

export function normalizeOptionalPreviewUrl(value: string | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error("Preview URL must be 500 characters or fewer.");
  }

  if (text.startsWith("/uploads/music-previews/") && text.toLowerCase().endsWith(".mp3")) {
    return text;
  }

  const url = assertHttpUrl(text, "Preview URL");

  if (!url.pathname.toLowerCase().endsWith(".mp3")) {
    throw new Error("Preview URL must point to an MP3 file.");
  }

  return text;
}

export async function normalizeDownloadUrl(value: string | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error("Download URL must be 500 characters or fewer.");
  }

  if (text.startsWith("/uploads/")) {
    if (text.startsWith("/uploads/music-downloads/") && text.toLowerCase().endsWith(".mp3")) {
      return text;
    }

    throw new Error("Download upload path must point to an uploaded MP3 download file.");
  }

  const normalized = normalizeGoogleDriveUrl(text);
  const url = assertHttpUrl(normalized, "Download URL");
  const isGoogleDriveDirect = url.hostname === "drive.google.com" && url.pathname === "/uc" && Boolean(url.searchParams.get("id"));

  if (isGoogleDriveDirect) {
    return normalized;
  }

  if (!url.pathname.toLowerCase().endsWith(".mp3")) {
    throw new Error("Download URL must be an MP3 file URL or a Google Drive file share link.");
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3500)
    });
    const length = Number(response.headers.get("content-length") ?? "0");
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (length > maxDownloadBytes) {
      throw new Error("Download MP3 must be no larger than 50MB.");
    }

    if (contentType && !contentType.includes("audio") && !contentType.includes("mpeg") && !contentType.includes("octet-stream")) {
      throw new Error("Download URL must point to an MP3 audio file.");
    }

    const bitrate = await remoteMp3BitrateKbps(url).catch(() => null);

    if (bitrate && bitrate !== 320) {
      throw new Error("Download MP3 must be encoded at 320kbps.");
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("50MB") || error.message.includes("MP3 audio") || error.message.includes("320kbps"))) {
      throw error;
    }
  }

  return normalized;
}

async function savePublicUpload(kind: UploadKind, file: File, allowedTypes: string[], maxBytes: number, label: string, buffer?: Buffer) {
  if (!file.size) {
    return null;
  }

  if (file.size > maxBytes) {
    throw new Error(`${label} is too large.`);
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`${label} must use one of: ${allowedTypes.join(", ")}.`);
  }

  const ext = fileExtension(file.name) || (file.type === "audio/mpeg" ? ".mp3" : ".jpg");
  const uploadDir = path.join(publicUploadsRoot, kind);
  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${ext}`;
  const uploadBuffer = buffer ?? Buffer.from(await file.arrayBuffer());

  await mkdir(uploadDir, {
    recursive: true
  });
  await writeFile(path.join(uploadDir, filename), uploadBuffer);

  return publicUploadPath(kind, filename);
}

export async function saveOptionalImageUpload(file: File | null | undefined, kind: "product-images" | "track-artwork") {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxImageBytes) {
    throw new Error("Image upload is too large.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  assertSquareImageUpload(buffer, file.type);

  return savePublicUpload(kind, file, ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"], maxImageBytes, "Image upload", buffer);
}

export async function saveOptionalPreviewMp3(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxPreviewMp3Bytes) {
    throw new Error("Sample MP3 upload is too large.");
  }

  if (!file.name.toLowerCase().endsWith(".mp3")) {
    throw new Error("Sample audio upload must be an MP3 file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  assertMp3Upload(buffer, false, "Sample MP3 upload");

  return savePublicUpload("music-previews", file, ["audio/mpeg", "audio/mp3"], maxPreviewMp3Bytes, "Sample MP3 upload", buffer);
}

export async function saveOptionalDownloadMp3(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxDownloadBytes) {
    throw new Error("Download MP3 upload is too large.");
  }

  if (!file.name.toLowerCase().endsWith(".mp3")) {
    throw new Error("Download upload must be an MP3 file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  assertMp3Upload(buffer, true, "Download MP3 upload");

  return savePublicUpload("music-downloads", file, ["audio/mpeg", "audio/mp3"], maxDownloadBytes, "Download MP3 upload", buffer);
}
