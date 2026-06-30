import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const publicUploadsRoot = path.join(process.cwd(), "public", "uploads");
const maxPreviewMp3Bytes = 100 * 1024 * 1024;
const maxImageBytes = 100 * 1024 * 1024;
const maxChatImageBytes = 150 * 1024 * 1024;
const maxProfileAvatarBytes = 25 * 1024 * 1024;
const maxDownloadBytes = 200 * 1024 * 1024;
const genericUploadTypes = ["", "application/octet-stream", "binary/octet-stream"];
const imageUploadExtensions = [".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".avif"];
const imageUploadTypes = ["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/x-png", "image/webp", "image/gif", "image/avif"];
const faviconUploadTypes = ["image/x-icon", "image/vnd.microsoft.icon", "image/ico", "image/icon"];
const profileAvatarExtensions = [".jpg", ".jpeg", ".png"];
const mp3UploadTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mpeg3",
  "audio/mpga",
  "audio/x-mpeg",
  "audio/x-mpeg-3",
  "audio/x-mp3",
  "application/octet-stream",
  "binary/octet-stream",
  ""
];

type UploadKind =
  | "branding-images"
  | "product-images"
  | "track-artwork"
  | "profile-avatars"
  | "stream-offline-images"
  | "chat-stickers"
  | "chat-emojis"
  | "music-previews"
  | "music-downloads";

function fileExtension(name: string) {
  return path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

function formatBytes(value: number) {
  return `${Math.round(value / (1024 * 1024))}MB`;
}

function normalizedContentType(value: string) {
  return value.trim().toLowerCase();
}

function isGenericUploadType(value: string) {
  return genericUploadTypes.includes(normalizedContentType(value));
}

function canonicalImageContentType(value: string) {
  const contentType = normalizedContentType(value);

  if (contentType === "image/jpg" || contentType === "image/pjpeg") {
    return "image/jpeg";
  }

  if (contentType === "image/x-png") {
    return "image/png";
  }

  return contentType;
}

function imageContentTypeFromExtension(extension: string) {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
    case ".jfif":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      return null;
  }
}

function canonicalImageExtension(extension: string, contentType: string) {
  if (extension === ".jpg" || extension === ".jpeg" || extension === ".jfif") {
    return ".jpg";
  }

  if (imageUploadExtensions.includes(extension)) {
    return extension;
  }

  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/avif":
      return ".avif";
    default:
      return ".jpg";
  }
}

function sniffImageContentType(buffer: Buffer) {
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return "image/png";
  }

  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return "image/gif";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" && buffer.toString("ascii", 8, 16).includes("avif")) {
    return "image/avif";
  }

  return null;
}

function sniffFaviconContentType(buffer: Buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return "image/x-icon";
  }

  return sniffImageContentType(buffer);
}

function validateImageUpload(file: File, buffer: Buffer, label: string) {
  const extension = fileExtension(file.name);
  const contentType = canonicalImageContentType(file.type);
  const sniffedContentType = sniffImageContentType(buffer);
  const extensionContentType = imageContentTypeFromExtension(extension);
  const extensionAllowed = imageUploadExtensions.includes(extension);
  const contentTypeAllowed = imageUploadTypes.includes(normalizedContentType(file.type)) || imageUploadTypes.includes(contentType);

  if (!extensionAllowed && !contentTypeAllowed && !sniffedContentType) {
    throw new Error(`${label} must be a JPG, PNG, WebP, GIF, or AVIF image.`);
  }

  if (!contentTypeAllowed && !isGenericUploadType(file.type) && !sniffedContentType) {
    throw new Error(`${label} has an unsupported MIME type: ${file.type}.`);
  }

  const resolvedContentType = sniffedContentType ?? extensionContentType ?? contentType;

  return {
    contentType: resolvedContentType,
    extension: canonicalImageExtension(extension, resolvedContentType)
  };
}

function validateFaviconUpload(file: File, buffer: Buffer) {
  const extension = fileExtension(file.name);
  const contentType = normalizedContentType(file.type);
  const sniffedContentType = sniffFaviconContentType(buffer);

  if (extension === ".ico" || faviconUploadTypes.includes(contentType) || sniffedContentType === "image/x-icon") {
    return {
      contentType: "image/x-icon",
      extension: ".ico"
    };
  }

  return validateImageUpload(file, buffer, "Favicon upload");
}

function validateProfileAvatarUpload(file: File, buffer: Buffer) {
  const extension = fileExtension(file.name);
  const image = validateImageUpload(file, buffer, "Profile avatar upload");

  if (!profileAvatarExtensions.includes(extension)) {
    throw new Error("Profile avatar upload must be a PNG, JPG, or JPEG image.");
  }

  if (image.contentType !== "image/jpeg" && image.contentType !== "image/png") {
    throw new Error("Profile avatar upload must be a PNG, JPG, or JPEG image.");
  }

  return image;
}

function validateMp3Upload(file: File, label: string) {
  const extension = fileExtension(file.name);
  const contentType = normalizedContentType(file.type);

  if (extension !== ".mp3") {
    throw new Error(`${label} must use a .mp3 file extension.`);
  }

  if (!mp3UploadTypes.includes(contentType)) {
    throw new Error(`${label} has an unsupported MIME type: ${file.type}.`);
  }
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

export function normalizeOptionalBrandingImageUrl(value: string | undefined, label = "Branding image URL") {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error(`${label} must be 500 characters or fewer.`);
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/branding-images\/[^/]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(text)) {
      return text;
    }

    throw new Error(`${label} upload path must point to an uploaded branding image file.`);
  }

  const url = assertHttpUrl(text, label);
  const pathname = url.pathname.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)) {
    throw new Error(`${label} must point to a JPG, PNG, WebP, GIF, or AVIF image file.`);
  }

  return text;
}

export function normalizeOptionalFaviconUrl(value: string | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error("Favicon URL must be 500 characters or fewer.");
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/branding-images\/[^/]+\.(jpg|jpeg|png|webp|gif|avif|ico)$/i.test(text)) {
      return text;
    }

    throw new Error("Favicon upload path must point to an uploaded branding image or .ico file.");
  }

  const url = assertHttpUrl(text, "Favicon URL");
  const pathname = url.pathname.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp|gif|avif|ico)$/.test(pathname)) {
    throw new Error("Favicon URL must point to a JPG, PNG, WebP, GIF, AVIF, or ICO image file.");
  }

  return text;
}

export function normalizeOptionalStreamOfflineImageUrl(value: string | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error("Offline image URL must be 500 characters or fewer.");
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/stream-offline-images\/[^/]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(text)) {
      return text;
    }

    throw new Error("Offline image upload path must point to an uploaded stream offline image file.");
  }

  const url = assertHttpUrl(text, "Offline image URL");
  const pathname = url.pathname.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)) {
    throw new Error("Offline image URL must point to an image file.");
  }

  return text;
}

export function normalizeOptionalChatAssetUrl(value: string | undefined, kind: "chat-stickers" | "chat-emojis") {
  const text = value?.trim() ?? "";
  const label = kind === "chat-emojis" ? "Animated emoji URL" : "Sticker URL";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error(`${label} must be 500 characters or fewer.`);
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/(chat-stickers|chat-emojis)\/[^/]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(text)) {
      return text;
    }

    throw new Error(`${label} upload path must point to an uploaded chat image file.`);
  }

  const url = assertHttpUrl(text, label);
  const pathname = url.pathname.toLowerCase();

  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathname)) {
    throw new Error(`${label} must point to an image file.`);
  }

  return text;
}

export function normalizeOptionalProfileAvatarUrl(value: string | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error("Avatar URL must be 500 characters or fewer.");
  }

  if (text.startsWith("/uploads/")) {
    if (/^\/uploads\/profile-avatars\/[^/]+\.(jpg|jpeg|png)$/i.test(text)) {
      return text;
    }

    throw new Error("Avatar upload path must point to an uploaded PNG, JPG, or JPEG profile image.");
  }

  return assertHttpUrl(text, "Avatar URL").toString();
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
      throw new Error(`Download MP3 must be no larger than ${formatBytes(maxDownloadBytes)}.`);
    }

    if (contentType && !contentType.includes("audio") && !contentType.includes("mpeg") && !contentType.includes("octet-stream")) {
      throw new Error("Download URL must point to an MP3 audio file.");
    }

    const bitrate = await remoteMp3BitrateKbps(url).catch(() => null);

    if (bitrate && bitrate !== 320) {
      throw new Error("Download MP3 must be encoded at 320kbps.");
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Download MP3 must") || error.message.includes("MP3 audio") || error.message.includes("320kbps"))) {
      throw error;
    }
  }

  return normalized;
}

async function savePublicUpload(kind: UploadKind, file: File, maxBytes: number, label: string, extension: string, buffer?: Buffer) {
  if (!file.size) {
    return null;
  }

  if (file.size > maxBytes) {
    throw new Error(`${label} is too large. Maximum ${formatBytes(maxBytes)}.`);
  }

  const uploadDir = path.join(publicUploadsRoot, kind);
  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;
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
    throw new Error(`Image upload is too large. Maximum ${formatBytes(maxImageBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateImageUpload(file, buffer, "Image upload");

  return savePublicUpload(kind, file, maxImageBytes, "Image upload", image.extension, buffer);
}

export async function saveOptionalBrandingImageUpload(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxImageBytes) {
    throw new Error(`Branding image upload is too large. Maximum ${formatBytes(maxImageBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateImageUpload(file, buffer, "Branding image upload");

  return savePublicUpload("branding-images", file, maxImageBytes, "Branding image upload", image.extension, buffer);
}

export async function saveOptionalFaviconUpload(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxImageBytes) {
    throw new Error(`Favicon upload is too large. Maximum ${formatBytes(maxImageBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateFaviconUpload(file, buffer);

  return savePublicUpload("branding-images", file, maxImageBytes, "Favicon upload", image.extension, buffer);
}

export async function saveOptionalStreamOfflineImageUpload(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxImageBytes) {
    throw new Error(`Offline image upload is too large. Maximum ${formatBytes(maxImageBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateImageUpload(file, buffer, "Offline image upload");

  return savePublicUpload("stream-offline-images", file, maxImageBytes, "Offline image upload", image.extension, buffer);
}

export async function saveOptionalChatAssetUpload(file: File | null | undefined, kind: "chat-stickers" | "chat-emojis") {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxChatImageBytes) {
    throw new Error(`Chat image upload is too large. Maximum ${formatBytes(maxChatImageBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateImageUpload(file, buffer, "Chat image upload");

  return savePublicUpload(kind, file, maxChatImageBytes, "Chat image upload", image.extension, buffer);
}

export async function saveOptionalProfileAvatarUpload(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxProfileAvatarBytes) {
    throw new Error(`Profile avatar upload is too large. Maximum ${formatBytes(maxProfileAvatarBytes)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = validateProfileAvatarUpload(file, buffer);

  return savePublicUpload("profile-avatars", file, maxProfileAvatarBytes, "Profile avatar upload", image.extension, buffer);
}

export async function saveOptionalPreviewMp3(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxPreviewMp3Bytes) {
    throw new Error(`Sample MP3 upload is too large. Maximum ${formatBytes(maxPreviewMp3Bytes)}.`);
  }

  validateMp3Upload(file, "Sample MP3 upload");
  const buffer = Buffer.from(await file.arrayBuffer());

  assertMp3Upload(buffer, false, "Sample MP3 upload");

  return savePublicUpload("music-previews", file, maxPreviewMp3Bytes, "Sample MP3 upload", ".mp3", buffer);
}

export async function saveOptionalDownloadMp3(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (file.size > maxDownloadBytes) {
    throw new Error(`Download MP3 upload is too large. Maximum ${formatBytes(maxDownloadBytes)}.`);
  }

  validateMp3Upload(file, "Download MP3 upload");
  const buffer = Buffer.from(await file.arrayBuffer());

  assertMp3Upload(buffer, true, "Download MP3 upload");

  return savePublicUpload("music-downloads", file, maxDownloadBytes, "Download MP3 upload", ".mp3", buffer);
}
