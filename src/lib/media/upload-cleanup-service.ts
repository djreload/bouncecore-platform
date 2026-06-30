import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db/prisma";
import {
  collectManagedUploadPathsFromJson,
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

function incrementUploadReference(counts: Map<string, number>, value: string | null | undefined, targets?: Set<string>) {
  const uploadPath = normalizeManagedUploadPath(value);

  if (!uploadPath || (targets && !targets.has(uploadPath))) {
    return;
  }

  counts.set(uploadPath, (counts.get(uploadPath) ?? 0) + 1);
}

function incrementAppSettingReferences(counts: Map<string, number>, value: unknown, targets?: Set<string>) {
  for (const uploadPath of collectManagedUploadPathsFromJson(value)) {
    if (targets && !targets.has(uploadPath)) {
      continue;
    }

    counts.set(uploadPath, (counts.get(uploadPath) ?? 0) + 1);
  }
}

export async function getManagedUploadReferenceMap(values?: Array<string | null | undefined>) {
  const targets = values ? new Set(uniqueManagedUploadPaths(values)) : undefined;
  const counts = new Map<string, number>();

  const [
    profiles,
    streamChannels,
    chatMessages,
    chatReports,
    chatStickers,
    products,
    tracks,
    purchaseDownloads,
    appSettings
  ] = await Promise.all([
    prisma.profile.findMany({
      select: {
        avatarUrl: true
      },
      where: {
        avatarUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.streamChannel.findMany({
      select: {
        offlineImageUrl: true
      },
      where: {
        offlineImageUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.chatMessage.findMany({
      select: {
        mediaPreviewUrl: true,
        mediaUrl: true
      },
      where: {
        OR: [
          {
            mediaUrl: {
              startsWith: "/uploads/"
            }
          },
          {
            mediaPreviewUrl: {
              startsWith: "/uploads/"
            }
          }
        ]
      }
    }),
    prisma.chatReport.findMany({
      select: {
        mediaPreviewUrl: true
      },
      where: {
        mediaPreviewUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.chatSticker.findMany({
      select: {
        imageUrl: true
      },
      where: {
        imageUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.product.findMany({
      select: {
        imageUrl: true
      },
      where: {
        imageUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.digitalTrack.findMany({
      select: {
        artworkUrl: true,
        downloadUrl: true,
        previewUrl: true
      },
      where: {
        OR: [
          {
            artworkUrl: {
              startsWith: "/uploads/"
            }
          },
          {
            downloadUrl: {
              startsWith: "/uploads/"
            }
          },
          {
            previewUrl: {
              startsWith: "/uploads/"
            }
          }
        ]
      }
    }),
    prisma.digitalTrackPurchase.findMany({
      select: {
        downloadUrl: true
      },
      where: {
        downloadUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.appSetting.findMany({
      select: {
        value: true
      }
    })
  ]);

  profiles.forEach((profile) => incrementUploadReference(counts, profile.avatarUrl, targets));
  streamChannels.forEach((channel) => incrementUploadReference(counts, channel.offlineImageUrl, targets));
  chatMessages.forEach((message) => {
    incrementUploadReference(counts, message.mediaUrl, targets);
    incrementUploadReference(counts, message.mediaPreviewUrl, targets);
  });
  chatReports.forEach((report) => incrementUploadReference(counts, report.mediaPreviewUrl, targets));
  chatStickers.forEach((sticker) => incrementUploadReference(counts, sticker.imageUrl, targets));
  products.forEach((product) => incrementUploadReference(counts, product.imageUrl, targets));
  tracks.forEach((track) => {
    incrementUploadReference(counts, track.artworkUrl, targets);
    incrementUploadReference(counts, track.previewUrl, targets);
    incrementUploadReference(counts, track.downloadUrl, targets);
  });
  purchaseDownloads.forEach((purchase) => incrementUploadReference(counts, purchase.downloadUrl, targets));
  appSettings.forEach((setting) => incrementAppSettingReferences(counts, setting.value, targets));

  return counts;
}

export async function getManagedUploadReferenceCount(uploadPath: string) {
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

  const references = await getManagedUploadReferenceCount(uploadPath);

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
