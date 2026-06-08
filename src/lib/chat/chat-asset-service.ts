import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export const chatAssetKindOptions = ["sticker", "emoji"] as const;
export const chatStickerPackStatusOptions = ["active", "draft", "archived"] as const;

export type ChatAssetKind = (typeof chatAssetKindOptions)[number];
export type ChatStickerPackStatus = (typeof chatStickerPackStatusOptions)[number];

export type ChatStickerPackInput = {
  description?: string;
  name: string;
  packId?: string;
  slug: string;
  sortOrder?: number;
  status: string;
};

export type ChatStickerAssetInput = {
  assetId?: string;
  imageUrl?: string | null;
  isAnimated?: boolean;
  kind: string;
  name: string;
  packId: string;
  shortcode: string;
  sortOrder?: number;
};

export type ChatStickerAssetSummary = {
  id: string;
  packId: string;
  packName: string;
  name: string;
  shortcode: string;
  imageUrl: string;
  kind: ChatAssetKind;
  isAnimated: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatStickerPackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ChatStickerPackStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  stickers: ChatStickerAssetSummary[];
};

function normalizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Sticker pack slug is required.");
  }

  return slug.slice(0, 80);
}

function normalizeName(value: string, label: string) {
  const name = value.trim();

  if (name.length < 2 || name.length > 80) {
    throw new Error(`${label} must be between 2 and 80 characters.`);
  }

  return name;
}

function normalizeDescription(value: string | undefined) {
  const description = value?.trim() ?? "";

  return description ? description.slice(0, 240) : null;
}

function normalizeSortOrder(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-1000, Math.min(1000, Math.floor(value)));
}

function normalizeStatus(value: string): ChatStickerPackStatus {
  if (chatStickerPackStatusOptions.includes(value as ChatStickerPackStatus)) {
    return value as ChatStickerPackStatus;
  }

  throw new Error("Invalid sticker pack status.");
}

function normalizeKind(value: string): ChatAssetKind {
  if (chatAssetKindOptions.includes(value as ChatAssetKind)) {
    return value as ChatAssetKind;
  }

  throw new Error("Invalid chat asset type.");
}

export function normalizeChatAssetShortcode(value: string) {
  const text = value.trim().toLowerCase();
  const inner = text.replace(/^:+|:+$/g, "").replace(/[^a-z0-9_+-]+/g, "-").replace(/^-+|-+$/g, "");

  if (inner.length < 2 || inner.length > 40) {
    throw new Error("Shortcode must be between 2 and 40 characters.");
  }

  return `:${inner}:`;
}

function toPackSummary(pack: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  stickers: Array<{
    id: string;
    packId: string;
    name: string;
    shortcode: string;
    imageUrl: string;
    kind: string;
    isAnimated: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): ChatStickerPackSummary {
  return {
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    description: pack.description,
    status: normalizeStatus(pack.status),
    sortOrder: pack.sortOrder,
    createdAt: pack.createdAt.toISOString(),
    updatedAt: pack.updatedAt.toISOString(),
    stickers: pack.stickers.map((sticker) => toAssetSummary(sticker, pack.name))
  };
}

function toAssetSummary(
  sticker: {
    id: string;
    packId: string;
    name: string;
    shortcode: string;
    imageUrl: string;
    kind: string;
    isAnimated: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  },
  packName: string
): ChatStickerAssetSummary {
  return {
    id: sticker.id,
    packId: sticker.packId,
    packName,
    name: sticker.name,
    shortcode: sticker.shortcode,
    imageUrl: sticker.imageUrl,
    kind: normalizeKind(sticker.kind),
    isAnimated: sticker.isAnimated,
    sortOrder: sticker.sortOrder,
    createdAt: sticker.createdAt.toISOString(),
    updatedAt: sticker.updatedAt.toISOString()
  };
}

export async function getAdminChatAssetData() {
  const packs = await prisma.chatStickerPack.findMany({
    include: {
      stickers: {
        orderBy: [
          {
            sortOrder: "asc"
          },
          {
            name: "asc"
          }
        ]
      }
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        name: "asc"
      }
    ]
  });
  const packSummaries = packs.map(toPackSummary);
  const allAssets = packSummaries.flatMap((pack) => pack.stickers);

  return {
    packs: packSummaries,
    stats: {
      packs: packSummaries.length,
      activePacks: packSummaries.filter((pack) => pack.status === "active").length,
      assets: allAssets.length,
      animated: allAssets.filter((asset) => asset.isAnimated).length
    }
  };
}

export async function getPublicChatAssets() {
  const packs = await prisma.chatStickerPack.findMany({
    where: {
      status: "active"
    },
    include: {
      stickers: {
        orderBy: [
          {
            sortOrder: "asc"
          },
          {
            name: "asc"
          }
        ]
      }
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        name: "asc"
      }
    ]
  });

  return packs.flatMap((pack) => pack.stickers.map((sticker) => toAssetSummary(sticker, pack.name)));
}

export async function createChatStickerPack(input: ChatStickerPackInput, actorId: string) {
  const pack = await prisma.chatStickerPack.create({
    data: {
      description: normalizeDescription(input.description),
      name: normalizeName(input.name, "Sticker pack name"),
      slug: normalizeSlug(input.slug),
      sortOrder: normalizeSortOrder(input.sortOrder),
      status: normalizeStatus(input.status)
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.assets.pack.create",
    target: `chat-sticker-pack:${pack.id}`,
    severity: "info",
    metadata: {
      slug: pack.slug,
      status: pack.status
    }
  });

  return pack;
}

export async function updateChatStickerPack(input: ChatStickerPackInput, actorId: string) {
  if (!input.packId) {
    throw new Error("Missing sticker pack.");
  }

  const pack = await prisma.chatStickerPack.update({
    where: {
      id: input.packId
    },
    data: {
      description: normalizeDescription(input.description),
      name: normalizeName(input.name, "Sticker pack name"),
      slug: normalizeSlug(input.slug),
      sortOrder: normalizeSortOrder(input.sortOrder),
      status: normalizeStatus(input.status)
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.assets.pack.update",
    target: `chat-sticker-pack:${pack.id}`,
    severity: "info",
    metadata: {
      slug: pack.slug,
      status: pack.status
    }
  });

  return pack;
}

export async function createChatStickerAsset(input: ChatStickerAssetInput, actorId: string) {
  const kind = normalizeKind(input.kind);
  const imageUrl = input.imageUrl?.trim();

  if (!imageUrl) {
    throw new Error("Upload an image or provide an image URL.");
  }

  const asset = await prisma.chatSticker.create({
    data: {
      imageUrl,
      isAnimated: Boolean(input.isAnimated),
      kind,
      name: normalizeName(input.name, kind === "emoji" ? "Emoji name" : "Sticker name"),
      packId: input.packId,
      shortcode: normalizeChatAssetShortcode(input.shortcode),
      sortOrder: normalizeSortOrder(input.sortOrder)
    },
    include: {
      pack: true
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.assets.item.create",
    target: `chat-sticker:${asset.id}`,
    severity: "info",
    metadata: {
      kind: asset.kind,
      packSlug: asset.pack.slug,
      shortcode: asset.shortcode
    }
  });

  return asset;
}

export async function updateChatStickerAsset(input: ChatStickerAssetInput, actorId: string) {
  if (!input.assetId) {
    throw new Error("Missing sticker or emoji.");
  }

  const kind = normalizeKind(input.kind);
  const imageUrl = input.imageUrl?.trim();
  const asset = await prisma.chatSticker.update({
    where: {
      id: input.assetId
    },
    data: {
      ...(imageUrl ? { imageUrl } : {}),
      isAnimated: Boolean(input.isAnimated),
      kind,
      name: normalizeName(input.name, kind === "emoji" ? "Emoji name" : "Sticker name"),
      packId: input.packId,
      shortcode: normalizeChatAssetShortcode(input.shortcode),
      sortOrder: normalizeSortOrder(input.sortOrder)
    },
    include: {
      pack: true
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.assets.item.update",
    target: `chat-sticker:${asset.id}`,
    severity: "info",
    metadata: {
      kind: asset.kind,
      packSlug: asset.pack.slug,
      shortcode: asset.shortcode
    }
  });

  return asset;
}
