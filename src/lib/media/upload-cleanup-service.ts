import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db/prisma";
import {
  jsonValueReferencesUpload,
  managedUploadDiskPath,
  normalizeManagedUploadPath,
  uniqueManagedUploadPaths
} from "@/lib/media/upload-cleanup-core";

export type UploadCleanupResult = {
  deleted: boolean;
  error?: string;
  path: string | null;
  reason?: "external" | "missing" | "referenced" | "unsafe";
  references?: number;
};

async function appSettingsReferenceCount(uploadPath: string) {
  const settings = await prisma.appSetting.findMany({
    select: {
      value: true
    }
  });

  return settings.filter((setting) => jsonValueReferencesUpload(setting.value, uploadPath)).length;
}

async function uploadReferenceCount(uploadPath: string) {
  const [
    profiles,
    streamChannels,
    chatMessageMediaUrls,
    chatMessagePreviewUrls,
    chatReports,
    chatStickers,
    products,
    trackArtwork,
    trackPreviews,
    trackDownloads,
    purchaseDownloads,
    appSettings
  ] = await Promise.all([
    prisma.profile.count({ where: { avatarUrl: uploadPath } }),
    prisma.streamChannel.count({ where: { offlineImageUrl: uploadPath } }),
    prisma.chatMessage.count({ where: { mediaUrl: uploadPath } }),
    prisma.chatMessage.count({ where: { mediaPreviewUrl: uploadPath } }),
    prisma.chatReport.count({ where: { mediaPreviewUrl: uploadPath } }),
    prisma.chatSticker.count({ where: { imageUrl: uploadPath } }),
    prisma.product.count({ where: { imageUrl: uploadPath } }),
    prisma.digitalTrack.count({ where: { artworkUrl: uploadPath } }),
    prisma.digitalTrack.count({ where: { previewUrl: uploadPath } }),
    prisma.digitalTrack.count({ where: { downloadUrl: uploadPath } }),
    prisma.digitalTrackPurchase.count({ where: { downloadUrl: uploadPath } }),
    appSettingsReferenceCount(uploadPath)
  ]);

  return (
    profiles +
    streamChannels +
    chatMessageMediaUrls +
    chatMessagePreviewUrls +
    chatReports +
    chatStickers +
    products +
    trackArtwork +
    trackPreviews +
    trackDownloads +
    purchaseDownloads +
    appSettings
  );
}

export async function deleteManagedUploadIfUnreferenced(value: string | null | undefined): Promise<UploadCleanupResult> {
  const uploadPath = normalizeManagedUploadPath(value);

  if (!value?.trim()) {
    return {
      deleted: false,
      path: null,
      reason: "missing"
    };
  }

  if (!uploadPath) {
    return {
      deleted: false,
      path: null,
      reason: value.trim().startsWith("/uploads/") ? "unsafe" : "external"
    };
  }

  const references = await uploadReferenceCount(uploadPath);

  if (references > 0) {
    return {
      deleted: false,
      path: uploadPath,
      reason: "referenced",
      references
    };
  }

  const diskPath = managedUploadDiskPath(uploadPath);

  if (!diskPath) {
    return {
      deleted: false,
      path: uploadPath,
      reason: "unsafe",
      references
    };
  }

  try {
    await unlink(diskPath);

    return {
      deleted: true,
      path: uploadPath,
      references
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
      return {
        deleted: false,
        path: uploadPath,
        reason: "missing",
        references
      };
    }

    return {
      deleted: false,
      error: error instanceof Error ? error.message : "Upload cleanup failed.",
      path: uploadPath,
      references
    };
  }
}

export async function cleanupReplacedManagedUpload(previous: string | null | undefined, next: string | null | undefined) {
  if (previous?.trim() === next?.trim()) {
    return {
      deleted: false,
      path: normalizeManagedUploadPath(previous),
      reason: "referenced" as const
    };
  }

  return deleteManagedUploadIfUnreferenced(previous);
}

export async function cleanupReplacedManagedUploads(
  replacements: Array<{
    next: string | null | undefined;
    previous: string | null | undefined;
  }>
) {
  return Promise.all(replacements.map((replacement) => cleanupReplacedManagedUpload(replacement.previous, replacement.next)));
}

export async function cleanupDeletedManagedUploads(values: Array<string | null | undefined>) {
  return Promise.all(uniqueManagedUploadPaths(values).map((value) => deleteManagedUploadIfUnreferenced(value)));
}
