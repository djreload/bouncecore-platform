import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import { hasPermission, hasRole } from "@/lib/auth/rbac";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { getActiveChatBan } from "@/lib/chat/moderation-service";
import { queueChatSheepThrowNotification } from "@/lib/chat/sheep-throw-notification-service";
import {
  defaultSheepThrowSettings,
  formatSheepThrowToast,
  normalizeSheepThrowSettings,
  normalizeSheepThrowSettingsInput,
  remainingSheepThrowCooldownSeconds,
  type SheepThrowSettings,
  type SheepThrowSettingsInput
} from "@/lib/chat/sheep-throw-settings";
import { prisma } from "@/lib/db/prisma";

const sheepThrowSettingsKey = "chat.sheep_throw";
const sheepThrowRetentionMs = 24 * 60 * 60 * 1000;

export type ChatSheepThrowSummary = {
  id: string;
  createdAt: string;
  throwerDisplayName: string;
  targetDisplayName: string | null;
};

export type ChatSheepThrowOverlayData = {
  settings: SheepThrowSettings;
  recentThrows: ChatSheepThrowSummary[];
};

export type ChatSheepThrowReadiness = {
  latestThrowAt: string | null;
  remainingCooldownSeconds: number;
};

async function assertUserCanThrowSheep(userId: string, roomId: string) {
  const [ban, room, user] = await Promise.all([
    getActiveChatBan(userId, roomId),
    prisma.chatRoom.findUniqueOrThrow({
      where: {
        id: roomId
      },
      select: {
        id: true,
        lockedAt: true,
        name: true,
        slug: true
      }
    }),
    prisma.user.findUniqueOrThrow({
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
    })
  ]);
  const roles = normalizeRoles(user.roles.map((userRole) => userRole.role.name));

  if (!hasRole({ roles }, "supporter")) {
    throw new Error("Only supporters can throw sheep.");
  }

  if (ban) {
    throw new Error(
      ban.expiresAt
        ? `You are banned from chat until ${new Date(ban.expiresAt).toLocaleString("en-GB")}.`
        : "You are permanently banned from chat."
    );
  }

  const result = {
    room,
    throwerDisplayName: user.displayName
  };

  if (!room.lockedAt) {
    return result;
  }

  if (!hasPermission({ roles }, "moderation.use")) {
    throw new Error(`${room.name} is locked by moderation.`);
  }

  return result;
}

async function pruneExpiredSheepThrows() {
  await prisma.chatSheepThrow.deleteMany({
    where: {
      createdAt: {
        lt: new Date(Date.now() - sheepThrowRetentionMs)
      }
    }
  });
}

async function resolveTarget(roomId: string, throwerId: string, messageId?: string | null) {
  const normalizedMessageId = messageId?.trim();

  if (!normalizedMessageId) {
    throw new Error("Choose a chat user to throw at.");
  }

  const message = await prisma.chatMessage.findFirst({
    where: {
      deletedAt: null,
      id: normalizedMessageId,
      roomId
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (!message) {
    throw new Error("That chat message is no longer available.");
  }

  if (!message.userId) {
    throw new Error("Choose a signed-in chat user to throw at.");
  }

  if (message.userId === throwerId) {
    throw new Error("Choose someone else to throw at.");
  }

  const target = await prisma.user.findUnique({
    where: {
      id: message.userId
    },
    select: {
      displayName: true,
      id: true
    }
  });

  return {
    targetDisplayName: target?.displayName ?? "Guest",
    targetMessageId: message.id,
    targetUserId: target?.id ?? message.userId
  };
}

export async function getSheepThrowSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: sheepThrowSettingsKey
    }
  });

  return normalizeSheepThrowSettings(setting?.value);
}

export async function updateSheepThrowSettings(input: SheepThrowSettingsInput, actorId: string) {
  const settings = normalizeSheepThrowSettingsInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: sheepThrowSettingsKey
    },
    update: {
      description: "Chat sheep throw overlay and cooldown settings.",
      isSecret: false,
      value: settings
    },
    create: {
      key: sheepThrowSettingsKey,
      description: "Chat sheep throw overlay and cooldown settings.",
      isSecret: false,
      value: settings
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.sheep_throw.settings.update",
    target: `app-setting:${sheepThrowSettingsKey}`,
    severity: "info",
    metadata: settings
  });

  return settings;
}

export async function getChatSheepThrowReadiness(
  userId?: string | null,
  providedSettings?: SheepThrowSettings
): Promise<ChatSheepThrowReadiness> {
  if (!userId) {
    return {
      latestThrowAt: null,
      remainingCooldownSeconds: 0
    };
  }

  await pruneExpiredSheepThrows();

  const [settings, latestThrow] = await Promise.all([
    providedSettings ? Promise.resolve(providedSettings) : getSheepThrowSettings(),
    prisma.chatSheepThrow.findFirst({
      where: {
        throwerId: userId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true
      }
    })
  ]);

  return {
    latestThrowAt: latestThrow?.createdAt.toISOString() ?? null,
    remainingCooldownSeconds: remainingSheepThrowCooldownSeconds(latestThrow?.createdAt, settings.cooldownSeconds)
  };
}

export async function createChatSheepThrow(roomId: string, throwerId: string, targetMessageId?: string | null) {
  await pruneExpiredSheepThrows();

  const settings = await getSheepThrowSettings();

  if (!settings.enabled) {
    throw new Error("Sheep throws are currently disabled.");
  }

  const [throwContext, latestThrow] = await Promise.all([
    assertUserCanThrowSheep(throwerId, roomId),
    prisma.chatSheepThrow.findFirst({
      where: {
        throwerId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true
      }
    })
  ]);
  const remainingSeconds = remainingSheepThrowCooldownSeconds(latestThrow?.createdAt, settings.cooldownSeconds);

  if (remainingSeconds > 0) {
    throw new Error(`Sheep throw cooldown is active. Wait ${remainingSeconds} more second${remainingSeconds === 1 ? "" : "s"}.`);
  }

  const target = await resolveTarget(roomId, throwerId, targetMessageId);
  const result = await prisma.$transaction(async (tx) => {
    if (settings.costStars > 0) {
      const wallet = await tx.starWallet.upsert({
        where: {
          userId: throwerId
        },
        update: {},
        create: {
          balance: 0,
          userId: throwerId
        }
      });

      if (wallet.balance < settings.costStars) {
        throw new Error(`You need ${settings.costStars.toLocaleString("en-GB")} stars to throw sheep.`);
      }

      const updatedWallet = await tx.starWallet.updateMany({
        where: {
          id: wallet.id,
          balance: {
            gte: settings.costStars
          }
        },
        data: {
          balance: {
            decrement: settings.costStars
          }
        }
      });

      if (updatedWallet.count !== 1) {
        throw new Error(`You need ${settings.costStars.toLocaleString("en-GB")} stars to throw sheep.`);
      }
    }

    const toastMessage = await tx.chatMessage.create({
      data: {
        body: formatSheepThrowToast(throwContext.throwerDisplayName, target.targetDisplayName),
        kind: "sheep",
        roomId,
        userId: throwerId
      }
    });
    const sheepThrow = await tx.chatSheepThrow.create({
      data: {
        roomId,
        throwerId,
        targetDisplayName: target.targetDisplayName,
        targetMessageId: target.targetMessageId,
        targetUserId: target.targetUserId
      }
    });

    return {
      sheepThrow,
      toastMessage
    };
  });

  await writeAuditLog({
    actorId: throwerId,
    action: "chat.sheep_throw.create",
    target: `chat-sheep-throw:${result.sheepThrow.id}`,
    severity: "info",
    metadata: {
      roomSlug: throwContext.room.slug,
      costStars: settings.costStars,
      toastMessageId: result.toastMessage.id,
      targetDisplayName: target.targetDisplayName,
      targetMessageId: target.targetMessageId,
      targetUserId: target.targetUserId
    }
  });
  await queueChatSheepThrowNotification({
    messageId: result.toastMessage.id,
    roomSlug: throwContext.room.slug,
    sheepThrowId: result.sheepThrow.id,
    targetUserId: target.targetUserId,
    throwerDisplayName: throwContext.throwerDisplayName,
    throwerUserId: throwerId
  }).catch((error) =>
    writeAuditLog({
      action: "chat.sheep_throw.notification.queue_failed",
      actorId: throwerId,
      metadata: {
        error: error instanceof Error ? error.message : "Sheep throw notification queue failed.",
        roomSlug: throwContext.room.slug,
        targetUserId: target.targetUserId
      },
      severity: "warning",
      target: `chat-sheep-throw:${result.sheepThrow.id}`
    })
  );
  await publishChatRoomChanged(roomId, result.toastMessage.id);

  return result.sheepThrow;
}

export async function getChatSheepThrowOverlayData(targetUserId?: string | null): Promise<ChatSheepThrowOverlayData> {
  await pruneExpiredSheepThrows();

  const settings = await getSheepThrowSettings();

  if (!settings.enabled || !targetUserId) {
    return {
      settings,
      recentThrows: []
    };
  }

  const recentWindowMs = Math.max(60_000, settings.overlayDurationMs * settings.maxRecentEvents);
  const throws = await prisma.chatSheepThrow.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - recentWindowMs)
      },
      targetUserId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: settings.maxRecentEvents
  });
  const userIds = [...new Set(throws.flatMap((sheepThrow) => [sheepThrow.throwerId, sheepThrow.targetUserId]).filter(Boolean) as string[])];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: userIds
          }
        },
        select: {
          displayName: true,
          id: true
        }
      })
    : [];
  const displayNameByUserId = new Map(users.map((user) => [user.id, user.displayName]));

  return {
    settings,
    recentThrows: throws
      .reverse()
      .map((sheepThrow) => ({
        id: sheepThrow.id,
        createdAt: sheepThrow.createdAt.toISOString(),
        throwerDisplayName: displayNameByUserId.get(sheepThrow.throwerId) ?? "Someone",
        targetDisplayName:
          sheepThrow.targetDisplayName ?? (sheepThrow.targetUserId ? displayNameByUserId.get(sheepThrow.targetUserId) ?? "Someone" : null)
      }))
  };
}

export { defaultSheepThrowSettings };
