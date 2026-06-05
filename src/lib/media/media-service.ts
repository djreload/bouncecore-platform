import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const publicUploadsRoot = path.join(process.cwd(), "public", "uploads");
const maxPreviewMp3Bytes = 20 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;
const maxDownloadBytes = 50 * 1024 * 1024;

type UploadKind = "product-images" | "track-artwork" | "music-previews";

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

export function normalizeOptionalImageUrl(value: string | undefined, label = "Image URL") {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > 500) {
    throw new Error(`${label} must be 500 characters or fewer.`);
  }

  if (text.startsWith("/uploads/")) {
    return text;
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
  } catch (error) {
    if (error instanceof Error && (error.message.includes("50MB") || error.message.includes("MP3 audio"))) {
      throw error;
    }
  }

  return normalized;
}

async function savePublicUpload(kind: UploadKind, file: File, allowedTypes: string[], maxBytes: number, label: string) {
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

  await mkdir(uploadDir, {
    recursive: true
  });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  return publicUploadPath(kind, filename);
}

export async function saveOptionalImageUpload(file: File | null | undefined, kind: "product-images" | "track-artwork") {
  if (!file || !file.size) {
    return null;
  }

  return savePublicUpload(kind, file, ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"], maxImageBytes, "Image upload");
}

export async function saveOptionalPreviewMp3(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith(".mp3")) {
    throw new Error("Sample audio upload must be an MP3 file.");
  }

  return savePublicUpload("music-previews", file, ["audio/mpeg", "audio/mp3"], maxPreviewMp3Bytes, "Sample MP3 upload");
}
