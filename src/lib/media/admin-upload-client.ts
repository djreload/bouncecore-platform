export type AdminUploadKind =
  | "branding-favicon"
  | "branding-logo"
  | "branding-og-image"
  | "chat-emoji"
  | "chat-sticker"
  | "mobile-apk"
  | "product-image"
  | "stream-offline-image"
  | "track-artwork"
  | "track-download"
  | "track-preview"
  | "throw-sound";

export async function uploadAdminMedia(kind: AdminUploadKind, file: File) {
  const uploadData = new FormData();
  uploadData.set("kind", kind);
  uploadData.set("file", file);

  const response = await fetch("/api/admin/uploads", {
    body: uploadData,
    method: "POST"
  });
  const result = (await response.json().catch(() => ({}))) as { error?: unknown; url?: unknown };

  if (!response.ok || typeof result.url !== "string") {
    throw new Error(typeof result.error === "string" ? result.error : "Upload failed.");
  }

  return result.url;
}
