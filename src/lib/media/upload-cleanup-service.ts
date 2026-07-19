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

export type ManagedUploadReference = {
  field: string;
  href?: string;
  label: string;
  path: string;
  recordId: string;
  source: string;
};

async function appSettingsReferenceCount(uploadPath: string) {
  const settings = await prisma.appSetting.findMany({
    select: {
      value: true
    }
  });

  return settings.filter((setting) => jsonValueReferencesUpload(setting.value, uploadPath)).length;
}

function addUploadReference(
  references: ManagedUploadReference[],
  value: string | null | undefined,
  input: Omit<ManagedUploadReference, "path">,
  targets?: Set<string>
) {
  const uploadPath = normalizeManagedUploadPath(value);

  if (!uploadPath || (targets && !targets.has(uploadPath))) {
    return;
  }

  references.push({
    ...input,
    path: uploadPath
  });
}

function addAppSettingReferences(
  references: ManagedUploadReference[],
  value: unknown,
  input: Omit<ManagedUploadReference, "path">,
  targets?: Set<string>
) {
  for (const uploadPath of collectManagedUploadPathsFromJson(value)) {
    if (targets && !targets.has(uploadPath)) {
      continue;
    }

    references.push({
      ...input,
      path: uploadPath
    });
  }
}

export async function getManagedUploadReferences(values?: Array<string | null | undefined>) {
  const targets = values ? new Set(uniqueManagedUploadPaths(values)) : undefined;
  const references: ManagedUploadReference[] = [];

  const [
    profiles,
    streamChannels,
    chatMessages,
    directMessages,
    chatReports,
    chatStickers,
    products,
    tracks,
    purchaseDownloads,
    appSettings
  ] = await Promise.all([
    prisma.profile.findMany({
      select: {
        avatarUrl: true,
        id: true,
        slug: true
      },
      where: {
        avatarUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.streamChannel.findMany({
      select: {
        id: true,
        offlineImageUrl: true,
        slug: true,
        title: true
      },
      where: {
        offlineImageUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.chatMessage.findMany({
      select: {
        id: true,
        mediaPreviewUrl: true,
        mediaUrl: true,
        roomId: true
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
    prisma.directMessage.findMany({
      select: {
        conversationId: true,
        id: true,
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
        id: true,
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
        id: true,
        imageUrl: true,
        name: true,
        packId: true
      },
      where: {
        imageUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.product.findMany({
      select: {
        id: true,
        imageUrl: true,
        name: true
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
        id: true,
        previewUrl: true,
        title: true
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
        downloadUrl: true,
        id: true,
        trackTitle: true
      },
      where: {
        downloadUrl: {
          startsWith: "/uploads/"
        }
      }
    }),
    prisma.appSetting.findMany({
      select: {
        key: true,
        value: true
      }
    })
  ]);

  profiles.forEach((profile) =>
    addUploadReference(
      references,
      profile.avatarUrl,
      {
        field: "avatarUrl",
        href: "/admin/users",
        label: profile.slug,
        recordId: profile.id,
        source: "Profile avatar"
      },
      targets
    )
  );
  streamChannels.forEach((channel) =>
    addUploadReference(
      references,
      channel.offlineImageUrl,
      {
        field: "offlineImageUrl",
        href: "/admin/stream",
        label: channel.title || channel.slug,
        recordId: channel.id,
        source: "Stream offline image"
      },
      targets
    )
  );
  chatMessages.forEach((message) => {
    addUploadReference(
      references,
      message.mediaUrl,
      {
        field: "mediaUrl",
        href: "/admin/chatrooms",
        label: `Chat message ${message.id}`,
        recordId: message.id,
        source: "Chat message media"
      },
      targets
    );
    addUploadReference(
      references,
      message.mediaPreviewUrl,
      {
        field: "mediaPreviewUrl",
        href: "/admin/chatrooms",
        label: `Chat message ${message.id}`,
        recordId: message.id,
        source: "Chat message preview"
      },
      targets
    );
  });
  directMessages.forEach((message) => {
    addUploadReference(
      references,
      message.mediaUrl,
      {
        field: "mediaUrl",
        href: "/account/messages",
        label: `Private message ${message.id}`,
        recordId: message.id,
        source: "Private message media"
      },
      targets
    );
    addUploadReference(
      references,
      message.mediaPreviewUrl,
      {
        field: "mediaPreviewUrl",
        href: "/account/messages",
        label: `Private message ${message.id}`,
        recordId: message.id,
        source: "Private message preview"
      },
      targets
    );
  });
  chatReports.forEach((report) =>
    addUploadReference(
      references,
      report.mediaPreviewUrl,
      {
        field: "mediaPreviewUrl",
        href: "/admin/reports",
        label: `Chat report ${report.id}`,
        recordId: report.id,
        source: "Chat report media"
      },
      targets
    )
  );
  chatStickers.forEach((sticker) =>
    addUploadReference(
      references,
      sticker.imageUrl,
      {
        field: "imageUrl",
        href: "/admin/chat-assets",
        label: sticker.name,
        recordId: sticker.id,
        source: "Chat sticker"
      },
      targets
    )
  );
  products.forEach((product) =>
    addUploadReference(
      references,
      product.imageUrl,
      {
        field: "imageUrl",
        href: "/admin/products",
        label: product.name,
        recordId: product.id,
        source: "Product image"
      },
      targets
    )
  );
  tracks.forEach((track) => {
    addUploadReference(
      references,
      track.artworkUrl,
      {
        field: "artworkUrl",
        href: "/admin/tracks",
        label: track.title,
        recordId: track.id,
        source: "Track artwork"
      },
      targets
    );
    addUploadReference(
      references,
      track.previewUrl,
      {
        field: "previewUrl",
        href: "/admin/tracks",
        label: track.title,
        recordId: track.id,
        source: "Track preview"
      },
      targets
    );
    addUploadReference(
      references,
      track.downloadUrl,
      {
        field: "downloadUrl",
        href: "/admin/tracks",
        label: track.title,
        recordId: track.id,
        source: "Track download"
      },
      targets
    );
  });
  purchaseDownloads.forEach((purchase) =>
    addUploadReference(
      references,
      purchase.downloadUrl,
      {
        field: "downloadUrl",
        href: "/admin/tracks",
        label: purchase.trackTitle,
        recordId: purchase.id,
        source: "Purchase download snapshot"
      },
      targets
    )
  );
  appSettings.forEach((setting) =>
    addAppSettingReferences(
      references,
      setting.value,
      {
        field: "value",
        href: "/admin/settings",
        label: setting.key,
        recordId: setting.key,
        source: "App setting"
      },
      targets
    )
  );

  return references;
}

export async function getManagedUploadReferenceMap(values?: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  const references = await getManagedUploadReferences(values);

  references.forEach((reference) => {
    counts.set(reference.path, (counts.get(reference.path) ?? 0) + 1);
  });

  return counts;
}

export async function getManagedUploadReferenceCount(uploadPath: string) {
  const [
    profiles,
    streamChannels,
    chatMessageMediaUrls,
    chatMessagePreviewUrls,
    directMessageMediaUrls,
    directMessagePreviewUrls,
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
    prisma.directMessage.count({ where: { mediaUrl: uploadPath } }),
    prisma.directMessage.count({ where: { mediaPreviewUrl: uploadPath } }),
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
    directMessageMediaUrls +
    directMessagePreviewUrls +
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
