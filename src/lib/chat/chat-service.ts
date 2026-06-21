import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import { hasPermission, type Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { chatRoomTypeOptions, type ChatRoomType } from "@/lib/chat/chat-types";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { assertUserCanPostInChat, getActiveChatBan } from "@/lib/chat/moderation-service";
import { getPublicChatAssets, type ChatStickerAssetSummary } from "@/lib/chat/chat-asset-service";
import { getChatEffectById, validateChatEffectSelection } from "@/lib/chat/chat-effects";
import { queueChatMentionNotifications } from "@/lib/chat/mention-notification-service";
import { chatReactionOptions, isChatReactionKey, type ChatReactionKey } from "@/lib/chat/reactions";
import { registerTenorShare } from "@/lib/chat/tenor-service";

const chatHistoryRetentionMs = 24 * 60 * 60 * 1000;
const chatPresenceOnlineMs = 5 * 60 * 1000;
const chatPresenceAwayMs = 30 * 60 * 1000;

export type ChatRoomInput = {
  locked?: boolean;
  roomId?: string;
  name: string;
  slowModeSeconds?: number;
  slug: string;
  type: ChatRoomType;
};

export type ChatRoomSummary = {
  id: string;
  lockedAt: string | null;
  slug: string;
  name: string;
  slowModeSeconds: number;
  type: string;
  createdAt: string;
  messages: number;
};

export type ChatMessageSummary = {
  id: string;
  roomId: string;
  replyTo: ChatMessageReplySummary | null;
  body: string;
  kind: string;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  mediaAlt: string | null;
  mediaSource: string | null;
  mediaSourceId: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  effectId: string | null;
  starAmount: number | null;
  starNote: string | null;
  createdAt: string;
  deletedAt: string | null;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorUserId: string | null;
  authorRoles: Role[];
  reactions: ChatReactionSummary[];
};

export type ChatMessageReplySummary = {
  id: string;
  body: string;
  kind: string;
  mediaAlt: string | null;
  deletedAt: string | null;
  authorDisplayName: string;
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

export type ChatReactionSummary = {
  key: ChatReactionKey;
  count: number;
  reacted: boolean;
};

export type ChatPresenceUserSummary = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  roles: Role[];
  status: "online" | "away";
  lastActiveAt: string;
};

export type PublicChatData = {
  rooms: ChatRoomSummary[];
  selectedRoom: ChatRoomSummary | null;
  messages: ChatMessageSummary[];
  presenceUsers: ChatPresenceUserSummary[];
  assets: ChatStickerAssetSummary[];
};

type AuthorSummary = {
  avatarUrl: string | null;
  displayName: string;
  roles: Role[];
};

type ReactionSource = {
  reactionKey: string;
  userId: string;
};

type ReplySource = {
  id: string;
  userId: string | null;
  body: string;
  kind: string;
  mediaAlt: string | null;
  deletedAt: Date | null;
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
  const slowModeSeconds = Math.max(0, Math.min(3600, Math.floor(input.slowModeSeconds ?? 0)));

  if (name.length < 2) {
    throw new Error("Chat room name is too short.");
  }

  return {
    locked: Boolean(input.locked),
    roomId: input.roomId,
    name,
    slowModeSeconds,
    slug: normalizeSlug(input.slug),
    type: input.type
  };
}

function toRoomSummary(room: {
  id: string;
  slug: string;
  name: string;
  type: string;
  lockedAt: Date | null;
  slowModeSeconds: number;
  createdAt: Date;
  _count: {
    messages: number;
  };
}): ChatRoomSummary {
  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    lockedAt: room.lockedAt?.toISOString() ?? null,
    slowModeSeconds: room.slowModeSeconds,
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
      profile: {
        select: {
          avatarUrl: true
        }
      },
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
        avatarUrl: user.profile?.avatarUrl ?? null,
        displayName: user.displayName,
        roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name))
      }
    ])
  );
}

function summarizeReactions(reactions: ReactionSource[] | undefined, currentUserId?: string | null): ChatReactionSummary[] {
  if (!reactions?.length) {
    return [];
  }

  const counts = new Map<ChatReactionKey, number>();
  const reacted = new Set<ChatReactionKey>();

  for (const reaction of reactions) {
    if (!isChatReactionKey(reaction.reactionKey)) {
      continue;
    }

    counts.set(reaction.reactionKey, (counts.get(reaction.reactionKey) ?? 0) + 1);

    if (currentUserId && reaction.userId === currentUserId) {
      reacted.add(reaction.reactionKey);
    }
  }

  return chatReactionOptions
    .map((option) => ({
      key: option.key,
      count: counts.get(option.key) ?? 0,
      reacted: reacted.has(option.key)
    }))
    .filter((reaction) => reaction.count > 0 || reaction.reacted);
}

function toMessageSummary(
  message: {
    id: string;
    roomId: string;
    userId: string | null;
    replyToMessage?: ReplySource | null;
    body: string;
    kind: string;
    mediaUrl: string | null;
    mediaPreviewUrl: string | null;
    mediaAlt: string | null;
    mediaSource: string | null;
    mediaSourceId: string | null;
    mediaWidth: number | null;
    mediaHeight: number | null;
    effectId: string | null;
    starSend?: {
      amount: number;
      note: string | null;
    } | null;
    deletedAt: Date | null;
    createdAt: Date;
    reactions?: ReactionSource[];
  },
  authors: Map<string, AuthorSummary>,
  currentUserId?: string | null
): ChatMessageSummary {
  const author = message.userId ? authors.get(message.userId) : null;
  const replyAuthor = message.replyToMessage?.userId ? authors.get(message.replyToMessage.userId) : null;
  const replyTo = message.replyToMessage
    ? {
        id: message.replyToMessage.id,
        body: message.replyToMessage.deletedAt ? "Message removed by moderation." : message.replyToMessage.body,
        kind: message.replyToMessage.kind,
        mediaAlt: message.replyToMessage.deletedAt ? null : message.replyToMessage.mediaAlt,
        deletedAt: message.replyToMessage.deletedAt?.toISOString() ?? null,
        authorDisplayName: replyAuthor?.displayName ?? "Guest"
      }
    : null;

  return {
    id: message.id,
    roomId: message.roomId,
    replyTo,
    body: message.deletedAt ? "Message removed by moderation." : message.body,
    kind: message.kind,
    mediaUrl: message.deletedAt ? null : message.mediaUrl,
    mediaPreviewUrl: message.deletedAt ? null : message.mediaPreviewUrl,
    mediaAlt: message.deletedAt ? null : message.mediaAlt,
    mediaSource: message.deletedAt ? null : message.mediaSource,
    mediaSourceId: message.deletedAt ? null : message.mediaSourceId,
    mediaWidth: message.deletedAt ? null : message.mediaWidth,
    mediaHeight: message.deletedAt ? null : message.mediaHeight,
    effectId: !message.deletedAt && getChatEffectById(message.effectId) ? message.effectId : null,
    starAmount: message.deletedAt ? null : message.starSend?.amount ?? null,
    starNote: message.deletedAt ? null : message.starSend?.note ?? null,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt?.toISOString() ?? null,
    authorDisplayName: author?.displayName ?? "Guest",
    authorAvatarUrl: author?.avatarUrl ?? null,
    authorUserId: message.userId,
    authorRoles: author?.roles ?? [],
    reactions: message.deletedAt ? [] : summarizeReactions(message.reactions, currentUserId)
  };
}

function getMessageAuthorIds(messages: { userId: string | null; replyToMessage?: { userId: string | null } | null }[]) {
  return messages.flatMap((message) => [message.userId, message.replyToMessage?.userId]).filter(Boolean) as string[];
}

async function validateReplyToMessage(roomId: string, replyToMessageId?: string | null) {
  const normalizedReplyToMessageId = replyToMessageId?.trim();

  if (!normalizedReplyToMessageId) {
    return null;
  }

  const replyToMessage = await prisma.chatMessage.findFirst({
    where: {
      id: normalizedReplyToMessageId,
      roomId,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!replyToMessage) {
    throw new Error("The message you are replying to is no longer available.");
  }

  return replyToMessage.id;
}

async function getChatEffectUserRoles(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  return normalizeRoles(user.roles.map((userRole) => userRole.role.name));
}

export async function getPublicChatPresence(roomId: string, currentUserId?: string | null): Promise<ChatPresenceUserSummary[]> {
  if (!roomId) {
    return [];
  }

  const now = new Date();
  const awayCutoff = new Date(now.getTime() - chatPresenceAwayMs);
  const onlineCutoff = new Date(now.getTime() - chatPresenceOnlineMs);
  const recentMessages = await prisma.chatMessage.findMany({
    where: {
      roomId,
      deletedAt: null,
      userId: {
        not: null
      },
      createdAt: {
        gte: awayCutoff
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true,
      userId: true
    },
    take: 200
  });
  const latestActivityByUser = new Map<string, Date>();

  for (const message of recentMessages) {
    if (message.userId && !latestActivityByUser.has(message.userId)) {
      latestActivityByUser.set(message.userId, message.createdAt);
    }
  }

  if (currentUserId) {
    latestActivityByUser.set(currentUserId, now);
  }

  const authors = await getAuthorSummaries([...latestActivityByUser.keys()]);

  return [...latestActivityByUser.entries()]
    .map(([userId, lastActiveAt]) => {
      const author = authors.get(userId);

      if (!author) {
        return null;
      }

      return {
        id: userId,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        roles: author.roles,
        status: lastActiveAt >= onlineCutoff ? ("online" as const) : ("away" as const),
        lastActiveAt: lastActiveAt.toISOString()
      };
    })
    .filter((user): user is ChatPresenceUserSummary => Boolean(user))
    .sort((first, second) => {
      if (first.status !== second.status) {
        return first.status === "online" ? -1 : 1;
      }

      return new Date(second.lastActiveAt).getTime() - new Date(first.lastActiveAt).getTime();
    })
    .slice(0, 50);
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

export async function getPublicChatData(roomSlug?: string, currentUserId?: string | null): Promise<PublicChatData> {
  await pruneExpiredChatHistory();

  const [rooms, assets] = await Promise.all([getRooms(), getPublicChatAssets()]);
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
      messages: [],
      presenceUsers: [],
      assets
    };
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: selectedRoom.id,
      deletedAt: null
    },
    include: {
      starSend: {
        select: {
          amount: true,
          note: true
        }
      },
      reactions: {
        select: {
          reactionKey: true,
          userId: true
        }
      },
      replyToMessage: {
        select: {
          id: true,
          userId: true,
          body: true,
          kind: true,
          mediaAlt: true,
          deletedAt: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 40
  });
  const authors = await getAuthorSummaries(getMessageAuthorIds(messages));
  const presenceUsers = await getPublicChatPresence(selectedRoom.id, currentUserId);

  return {
    rooms: roomSummaries,
    selectedRoom: toRoomSummary(selectedRoom),
    messages: messages.reverse().map((message) => toMessageSummary(message, authors, currentUserId)),
    presenceUsers,
    assets
  };
}

export async function getPublicChatMessages(roomId: string, currentUserId?: string | null) {
  await pruneExpiredChatHistory();

  if (!roomId) {
    return [];
  }

  await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true
    }
  });

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId,
      deletedAt: null
    },
    include: {
      starSend: {
        select: {
          amount: true,
          note: true
        }
      },
      reactions: {
        select: {
          reactionKey: true,
          userId: true
        }
      },
      replyToMessage: {
        select: {
          id: true,
          userId: true,
          body: true,
          kind: true,
          mediaAlt: true,
          deletedAt: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 40
  });
  const authors = await getAuthorSummaries(getMessageAuthorIds(messages));

  return messages.reverse().map((message) => toMessageSummary(message, authors, currentUserId));
}

export async function getPublicChatRoom(roomId: string) {
  const room = await prisma.chatRoom.findUnique({
    where: {
      id: roomId
    },
    include: {
      _count: {
        select: {
          messages: true
        }
      }
    }
  });

  return room ? toRoomSummary(room) : null;
}

export async function getAdminChatroomsData() {
  await pruneExpiredChatHistory();

  const [rooms, messages, sheepThrows] = await Promise.all([
    getRooms(),
    prisma.chatMessage.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        starSend: {
          select: {
            amount: true,
            note: true
          }
        },
        room: true
      },
      take: 75
    }),
    prisma.chatSheepThrow.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    })
  ]);
  const authors = await getAuthorSummaries(messages.map((message) => message.userId).filter(Boolean) as string[]);
  const sheepUserIds = [
    ...new Set(sheepThrows.flatMap((sheepThrow) => [sheepThrow.throwerId, sheepThrow.targetUserId]).filter(Boolean) as string[])
  ];
  const sheepUsers = sheepUserIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: sheepUserIds
          }
        },
        select: {
          displayName: true,
          id: true
        }
      })
    : [];
  const sheepUserById = new Map(sheepUsers.map((user) => [user.id, user.displayName]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return {
    rooms: rooms.map(toRoomSummary),
    messages: messages.map((message) => ({
      ...toMessageSummary(message, authors),
      roomName: message.room.name,
      roomSlug: message.room.slug
    })),
    sheepThrows: sheepThrows.map((sheepThrow) => {
      const room = roomById.get(sheepThrow.roomId);

      return {
        id: sheepThrow.id,
        roomName: room?.name ?? "Unknown room",
        roomSlug: room?.slug ?? "unknown",
        throwerDisplayName: sheepUserById.get(sheepThrow.throwerId) ?? "Unknown user",
        targetDisplayName: sheepThrow.targetDisplayName ?? (sheepThrow.targetUserId ? sheepUserById.get(sheepThrow.targetUserId) : null) ?? "Unknown user",
        targetMessageId: sheepThrow.targetMessageId,
        createdAt: sheepThrow.createdAt.toISOString()
      };
    })
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
      lockedAt: roomInput.locked ? new Date() : null,
      name: roomInput.name,
      slowModeSeconds: roomInput.slowModeSeconds,
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
      locked: roomInput.locked,
      slowModeSeconds: roomInput.slowModeSeconds,
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
  const existingRoom = await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: input.roomId
    },
    select: {
      lockedAt: true
    }
  });
  const room = await prisma.chatRoom.update({
    where: {
      id: input.roomId
    },
    data: {
      lockedAt: roomInput.locked ? existingRoom.lockedAt ?? new Date() : null,
      name: roomInput.name,
      slowModeSeconds: roomInput.slowModeSeconds,
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
      locked: roomInput.locked,
      slowModeSeconds: roomInput.slowModeSeconds,
      slug: room.slug,
      type: room.type
    }
  });
  await publishChatRoomChanged(room.id);

  return room;
}

export async function createChatMessage(
  roomId: string,
  body: string,
  userId: string,
  effectId?: string | null,
  replyToMessageId?: string | null
) {
  await pruneExpiredChatHistory();

  const normalizedBody = body.replace(/\r\n?/g, "\n").trim();

  if (normalizedBody.length < 1 || normalizedBody.length > 500) {
    throw new Error("Chat messages must be between 1 and 500 characters.");
  }

  const room = await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true,
      slug: true
    }
  });
  await assertUserCanPostInChat(userId, roomId);
  const userRoles = await getChatEffectUserRoles(userId);
  const validatedEffectId = validateChatEffectSelection(userRoles, effectId);
  const validatedReplyToMessageId = await validateReplyToMessage(roomId, replyToMessageId);

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      userId,
      replyToMessageId: validatedReplyToMessageId,
      body: normalizedBody,
      kind: "text",
      effectId: validatedEffectId
    }
  });

  await queueChatMentionNotifications({
    body: normalizedBody,
    messageId: message.id,
    roomSlug: room.slug,
    senderUserId: userId
  }).catch((error) =>
    writeAuditLog({
      action: "chat.mention_notifications.queue_failed",
      actorId: userId,
      metadata: {
        error: error instanceof Error ? error.message : "Mention notification queue failed.",
        roomId
      },
      severity: "warning",
      target: `chat-message:${message.id}`
    })
  );
  await publishChatRoomChanged(roomId, message.id);

  return message;
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
  await assertUserCanPostInChat(userId, roomId);

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
  await publishChatRoomChanged(roomId, message.id);

  return message;
}

export async function createChatStickerMessage(roomId: string, userId: string, assetId: string) {
  await pruneExpiredChatHistory();

  const asset = await prisma.chatSticker.findFirst({
    where: {
      id: assetId,
      pack: {
        status: "active"
      }
    },
    include: {
      pack: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!asset) {
    throw new Error("That sticker or emoji is not available.");
  }

  await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true
    }
  });
  await assertUserCanPostInChat(userId, roomId);

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      userId,
      body: asset.shortcode,
      kind: asset.kind === "emoji" ? "emoji" : "sticker",
      mediaUrl: asset.imageUrl,
      mediaPreviewUrl: asset.imageUrl,
      mediaAlt: asset.name,
      mediaSource: "custom_chat_asset",
      mediaSourceId: asset.id
    }
  });

  await publishChatRoomChanged(roomId, message.id);

  return message;
}

async function assertUserCanReactInChat(userId: string, roomId: string) {
  const [ban, room] = await Promise.all([
    getActiveChatBan(userId, roomId),
    prisma.chatRoom.findUniqueOrThrow({
      where: {
        id: roomId
      },
      select: {
        lockedAt: true,
        name: true
      }
    })
  ]);

  if (ban) {
    throw new Error(
      ban.expiresAt
        ? `You are banned from chat until ${new Date(ban.expiresAt).toLocaleString("en-GB")}.`
        : "You are permanently banned from chat."
    );
  }

  if (!room.lockedAt) {
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });
  const roles = normalizeRoles(user.roles.map((userRole) => userRole.role.name));

  if (!hasPermission({ roles }, "moderation.use")) {
    throw new Error(`${room.name} is locked by moderation.`);
  }
}

export async function toggleChatMessageReaction(messageId: string, userId: string, reactionKey: string) {
  if (!isChatReactionKey(reactionKey)) {
    throw new Error("Choose a valid chat reaction.");
  }

  const message = await prisma.chatMessage.findUniqueOrThrow({
    where: {
      id: messageId
    },
    select: {
      deletedAt: true,
      id: true,
      roomId: true
    }
  });

  if (message.deletedAt) {
    throw new Error("You cannot react to a removed message.");
  }

  await assertUserCanReactInChat(userId, message.roomId);

  const existing = await prisma.chatReaction.findUnique({
    where: {
      messageId_userId: {
        messageId,
        userId
      }
    }
  });

  if (existing?.reactionKey === reactionKey) {
    await prisma.chatReaction.delete({
      where: {
        id: existing.id
      }
    });
  } else if (existing) {
    await prisma.chatReaction.update({
      where: {
        id: existing.id
      },
      data: {
        reactionKey
      }
    });
  } else {
    await prisma.chatReaction.create({
      data: {
        messageId,
        reactionKey,
        userId
      }
    });
  }

  await publishChatRoomChanged(message.roomId, message.id);
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
  await publishChatRoomChanged(message.roomId, message.id);

  return updated;
}

export async function clearChatRoomMessages(roomId: string, actorId: string) {
  const room = await prisma.chatRoom.findUniqueOrThrow({
    where: {
      id: roomId
    },
    select: {
      id: true,
      slug: true
    }
  });
  const clearedAt = new Date();
  const result = await prisma.chatMessage.updateMany({
    where: {
      deletedAt: null,
      roomId: room.id
    },
    data: {
      deletedAt: clearedAt
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.room.clear_messages",
    target: `chat-room:${room.id}`,
    severity: "warning",
    metadata: {
      clearedMessages: result.count,
      roomSlug: room.slug
    }
  });
  await publishChatRoomChanged(room.id);

  return result.count;
}
