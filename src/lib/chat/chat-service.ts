import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { chatRoomTypeOptions, type ChatRoomType } from "@/lib/chat/chat-types";
import { registerTenorShare } from "@/lib/chat/tenor-service";

const chatHistoryRetentionMs = 24 * 60 * 60 * 1000;

export type ChatRoomInput = {
  roomId?: string;
  name: string;
  slug: string;
  type: ChatRoomType;
};

export type ChatRoomSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
  createdAt: string;
  messages: number;
};

export type ChatMessageSummary = {
  id: string;
  roomId: string;
  body: string;
  kind: string;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  mediaAlt: string | null;
  mediaSource: string | null;
  mediaSourceId: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  createdAt: string;
  deletedAt: string | null;
  authorDisplayName: string;
  authorRoles: Role[];
};

export type ChatGifMessageInput = {
  id: string;
  url: string;
  previewUrl: string;
  alt: string;
  searchTerm?: string;
  width?: number | null;
  height?: number | null;
};

type AuthorSummary = {
  displayName: string;
  roles: Role[];
};

function chatHistoryCutoff() {
  return new Date(Date.now() - chatHistoryRetentionMs);
}

export async function pruneExpiredChatHistory() {
  const result = await prisma.chatMessage.deleteMany({
    where: {
      createdAt: {
        lt: chatHistoryCutoff()
      }
    }
  });

  if (result.count > 0) {
    await writeAuditLog({
      action: "chat.history.prune",
      target: "chat-message:expired",
      severity: "info",
      metadata: {
        retentionHours: 24,
        deletedMessages: result.count
      }
    }).catch(() => {
      // Automatic retention should never block chat reads or writes.
    });
  }

  return result.count;
}

function normalizeSlug(slug: string) {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "lobby";
}

function assertRoomType(type: string): asserts type is ChatRoomType {
  if (!chatRoomTypeOptions.includes(type as ChatRoomType)) {
    throw new Error("Invalid chat room type.");
  }
}

function normalizeRoomInput(input: ChatRoomInput) {
  assertRoomType(input.type);

  const name = input.name.trim();

  if (name.length < 2) {
    throw new Error("Chat room name is too short.");
  }

  return {
    roomId: input.roomId,
    name,
    slug: normalizeSlug(input.slug),
    type: input.type
  };
}

function toRoomSummary(room: {
  id: string;
  slug: string;
  name: string;
  type: string;
  createdAt: Date;
  _count: {
    messages: number;
  };
}): ChatRoomSummary {
  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    type: room.type,
    createdAt: room.createdAt.toISOString(),
    messages: room._count.messages
  };
}

async function getAuthorSummaries(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, AuthorSummary>();
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [...new Set(userIds)]
      }
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        displayName: user.displayName,
        roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name))
      }
    ])
  );
}

function toMessageSummary(
  message: {
    id: string;
    roomId: string;
    userId: string | null;
    body: string;
    kind: string;
    mediaUrl: string | null;
    mediaPreviewUrl: string | null;
    mediaAlt: string | null;
    mediaSource: string | null;
    mediaSourceId: string | null;
    mediaWidth: number | null;
    mediaHeight: number | null;
    deletedAt: Date | null;
    createdAt: Date;
  },
  authors: Map<string, AuthorSummary>
): ChatMessageSummary {
  const author = message.userId ? authors.get(message.userId) : null;

  return {
    id: message.id,
    roomId: message.roomId,
    body: message.deletedAt ? "Message removed by moderation." : message.body,
    kind: message.kind,
    mediaUrl: message.deletedAt ? null : message.mediaUrl,
    mediaPreviewUrl: message.deletedAt ? null : message.mediaPreviewUrl,
    mediaAlt: message.deletedAt ? null : message.mediaAlt,
    mediaSource: message.deletedAt ? null : message.mediaSource,
    mediaSourceId: message.deletedAt ? null : message.mediaSourceId,
    mediaWidth: message.deletedAt ? null : message.mediaWidth,
    mediaHeight: message.deletedAt ? null : message.mediaHeight,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt?.toISOString() ?? null,
    authorDisplayName: author?.displayName ?? "Guest",
    authorRoles: author?.roles ?? []
  };
}

async function getRooms() {
  return prisma.chatRoom.findMany({
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        slug: "asc"
      }
    ],
    include: {
      _count: {
        select: {
          messages: true
        }
      }
    }
  });
}

export async function getPublicChatData(roomSlug?: string) {
  await pruneExpiredChatHistory();

  const rooms = await getRooms();
  const roomSummaries = rooms.map(toRoomSummary);
  const preferredSlug = roomSlug ? normalizeSlug(roomSlug) : "live";
  const selectedRoom =
    rooms.find((room) => room.slug === preferredSlug) ??
    rooms.find((room) => room.type === "live") ??
    rooms[0] ??
    null;

  if (!selectedRoom) {
    return {
      rooms: roomSummaries,
      selectedRoom: null,
      messages: []
    };
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: selectedRoom.id,
      deletedAt: null
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 40
  });
  const authors = await getAuthorSummaries(messages.map((message) => message.userId).filter(Boolean) as string[]);

  return {
    rooms: roomSummaries,
    selectedRoom: toRoomSummary(selectedRoom),
    messages: messages.reverse().map((message) => toMessageSummary(message, authors))
  };
}

export async function getAdminChatroomsData() {
  await pruneExpiredChatHistory();

  const [rooms, messages] = await Promise.all([
    getRooms(),
    prisma.chatMessage.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        room: true
      },
      take: 75
    })
  ]);
  const authors = await getAuthorSummaries(messages.map((message) => message.userId).filter(Boolean) as string[]);

  return {
    rooms: rooms.map(toRoomSummary),
    messages: messages.map((message) => ({
      ...toMessageSummary(message, authors),
      roomName: message.room.name,
      roomSlug: message.room.slug
    }))
  };
}

export async function ensureDefaultChatRooms(actorId: string) {
  const defaults = [
    { slug: "live", name: "Live Chat", type: "live" },
    { slug: "lobby", name: "Lobby", type: "public" },
    { slug: "supporters", name: "Supporters", type: "vip" }
  ] satisfies Array<{ slug: string; name: string; type: ChatRoomType }>;

  const rooms = await prisma.$transaction((tx) =>
    Promise.all(
      defaults.map((room) =>
        tx.chatRoom.upsert({
          where: {
            slug: room.slug
          },
          update: {
            name: room.name,
            type: room.type
          },
          create: room
        })
      )
    )
  );

  await writeAuditLog({
    actorId,
    action: "chat.rooms.ensure_default",
    target: "chat-room:defaults",
    severity: "info",
    metadata: {
      slugs: rooms.map((room) => room.slug)
    }
  });

  return rooms;
}

export async function createChatRoom(input: ChatRoomInput, actorId: string) {
  const roomInput = normalizeRoomInput(input);
  const room = await prisma.chatRoom.create({
    data: {
      name: roomInput.name,
      slug: roomInput.slug,
      type: roomInput.type
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.room.create",
    target: `chat-room:${room.id}`,
    severity: "info",
    metadata: {
      slug: room.slug,
      type: room.type
    }
  });

  return room;
}

export async function updateChatRoom(input: ChatRoomInput, actorId: string) {
  if (!input.roomId) {
    throw new Error("Missing chat room.");
  }

  const roomInput = normalizeRoomInput(input);
  const room = await prisma.chatRoom.update({
    where: {
      id: input.roomId
    },
    data: {
      name: roomInput.name,
      slug: roomInput.slug,
      type: roomInput.type
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.room.update",
    target: `chat-room:${room.id}`,
    severity: "info",
    metadata: {
      slug: room.slug,
      type: room.type
    }
  });

  return room;
}

export async function createChatMessage(roomId: string, body: string, userId: string) {
  await pruneExpiredChatHistory();

  const normalizedBody = body.replace(/\r\n?/g, "\n").trim();

  if (normalizedBody.length < 1 || normalizedBody.length > 500) {
    throw new Error("Chat messages must be between 1 and 500 characters.");
  }

  await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true
    }
  });

  return prisma.chatMessage.create({
    data: {
      roomId,
      userId,
      body: normalizedBody,
      kind: "text"
    }
  });
}

function assertTenorMediaUrl(value: string) {
  const url = new URL(value);
  const allowedHosts = new Set(["media.tenor.com", "c.tenor.com"]);

  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error("GIF URL is not from Tenor.");
  }
}

function normalizeGifDimension(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value < 1 || value > 2000) {
    return null;
  }

  return Math.round(value);
}

export async function createChatGifMessage(roomId: string, userId: string, gif: ChatGifMessageInput) {
  await pruneExpiredChatHistory();

  const gifId = gif.id.trim().slice(0, 120);
  const mediaUrl = gif.url.trim();
  const previewUrl = (gif.previewUrl || gif.url).trim();
  const mediaAlt = gif.alt.trim().slice(0, 180) || "Tenor GIF";

  if (!gifId || !mediaUrl || !previewUrl) {
    throw new Error("Missing GIF data.");
  }

  assertTenorMediaUrl(mediaUrl);
  assertTenorMediaUrl(previewUrl);

  await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true
    }
  });

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      userId,
      body: mediaAlt,
      kind: "gif",
      mediaUrl,
      mediaPreviewUrl: previewUrl,
      mediaAlt,
      mediaSource: "tenor",
      mediaSourceId: gifId,
      mediaWidth: normalizeGifDimension(gif.width),
      mediaHeight: normalizeGifDimension(gif.height)
    }
  });

  await registerTenorShare(gifId, gif.searchTerm ?? "");

  return message;
}

export async function moderateChatMessage(messageId: string, actorId: string) {
  const message = await prisma.chatMessage.findUniqueOrThrow({
    where: {
      id: messageId
    },
    include: {
      room: true
    }
  });

  if (message.deletedAt) {
    return message;
  }

  const updated = await prisma.chatMessage.update({
    where: {
      id: message.id
    },
    data: {
      deletedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.message.moderate_delete",
    target: `chat-message:${message.id}`,
    severity: "warning",
    metadata: {
      roomSlug: message.room.slug,
      ...(message.userId ? { userId: message.userId } : {})
    }
  });

  return updated;
}
