import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getNotificationDeliveryPreferencesForUser } from "@/lib/account/notification-preferences-service";
import { writeAuditLog } from "@/lib/auth/audit";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { getPublicChatPresence } from "@/lib/chat/chat-service";
import { assertUserCanPostInChat } from "@/lib/chat/moderation-service";
import { prisma } from "@/lib/db/prisma";
import {
  coreFpsInviteActionUrl,
  getCoreFpsInviteRecipientIds
} from "@/lib/games/core-fps-invite-core";
import { coreFpsLobbyPresenceWindowMs } from "@/lib/games/core-fps-lobby-core";
import { joinCoreFpsLobby } from "@/lib/games/core-fps-lobby-service";
import { queueMobilePushForNotification } from "@/lib/mobile/account-notification-push-service";

const repeatInviteWindowMs = 20_000;

type NotificationDelivery = {
  id: string;
  userId: string;
};

type SendCoreFpsLobbyInvitesInput = {
  actorId: string;
  lobbyId: string;
  postChatMessage?: boolean;
  targetUserId?: string | null;
};

async function queueInvitePushes(notifications: NotificationDelivery[]) {
  const results = await Promise.allSettled(
    notifications.map(async (notification) => {
      const preferences = await getNotificationDeliveryPreferencesForUser(
        notification.userId,
        "chat.core_fps.invite"
      );

      if (!preferences.push) {
        return {
          notificationId: notification.id,
          queued: false,
          userId: notification.userId
        };
      }

      const push = await queueMobilePushForNotification({
        notificationId: notification.id,
        userId: notification.userId
      });

      return {
        notificationId: notification.id,
        push,
        queued: true,
        userId: notification.userId
      };
    })
  );

  return {
    failed: results.filter((result) => result.status === "rejected").length,
    queued: results.filter(
      (result) => result.status === "fulfilled" && result.value.queued
    ).length
  };
}

export async function sendCoreFpsLobbyInvites(input: SendCoreFpsLobbyInvitesInput) {
  const participantCutoff = new Date(Date.now() - coreFpsLobbyPresenceWindowMs);
  const lobby = await prisma.coreFpsLobby.findFirst({
    include: {
      participants: {
        select: {
          userId: true
        },
        where: {
          lastSeenAt: {
            gte: participantCutoff
          },
          leftAt: null
        }
      },
      room: {
        select: {
          id: true,
          slug: true
        }
      }
    },
    where: {
      id: input.lobbyId,
      status: {
        in: ["active", "waiting"]
      }
    }
  });

  if (!lobby) {
    throw new Error("That Core FPS lobby is no longer available.");
  }

  if (!lobby.participants.some((participant) => participant.userId === input.actorId)) {
    throw new Error("Join the Core FPS lobby before inviting players.");
  }

  await assertUserCanPostInChat(input.actorId, lobby.room.id);

  const actor = await prisma.user.findFirst({
    select: {
      displayName: true,
      id: true
    },
    where: {
      id: input.actorId,
      status: "active"
    }
  });

  if (!actor) {
    throw new Error("Your account cannot invite players.");
  }

  const presenceUsers = await getPublicChatPresence(lobby.room.id, actor.id);
  const participantIds = new Set(lobby.participants.map((participant) => participant.userId));
  const eligiblePresence = presenceUsers.filter((user) => !participantIds.has(user.id));
  let recipientIds = getCoreFpsInviteRecipientIds(eligiblePresence, actor.id);

  if (input.targetUserId) {
    recipientIds = recipientIds.filter((userId) => userId === input.targetUserId);

    if (!recipientIds.length) {
      throw new Error("That user must be online and outside the lobby before they can be invited.");
    }
  }

  const actionUrl = coreFpsInviteActionUrl(lobby.id);
  const recentInviteCutoff = new Date(Date.now() - repeatInviteWindowMs);
  const recentlyInvited = recipientIds.length
    ? await prisma.notification.findMany({
        select: {
          userId: true
        },
        where: {
          actionUrl,
          createdAt: {
            gte: recentInviteCutoff
          },
          type: "chat.core_fps.invite",
          userId: {
            in: recipientIds
          }
        }
      })
    : [];
  const recentIds = new Set(recentlyInvited.map((notification) => notification.userId));
  const freshRecipientIds = recipientIds.filter((userId) => !recentIds.has(userId));
  const invitationBatchId = randomUUID();
  const result = await prisma.$transaction(async (transaction) => {
    const notifications = await Promise.all(
      freshRecipientIds.map((userId) =>
        transaction.notification.create({
          data: {
            actionUrl,
            body: `Join ${actor.displayName} and the other players on ${lobby.mapName}.`,
            dedupeKey: `chat.core_fps.invite:${invitationBatchId}:user:${userId}`,
            title: `${actor.displayName} invited you to Core FPS`,
            type: "chat.core_fps.invite",
            userId
          },
          select: {
            id: true,
            userId: true
          }
        })
      )
    );
    const message =
      input.postChatMessage && (freshRecipientIds.length > 0 || lobby.status === "waiting")
        ? await transaction.chatMessage.create({
            data: {
              body:
                lobby.status === "waiting"
                  ? `${actor.displayName} opened a Core FPS lobby on ${lobby.mapName}. Join before the countdown ends.`
                  : `${actor.displayName} invited online chatters to the active Core FPS game on ${lobby.mapName}.`,
              kind: "core-fps",
              mediaSource: "core-fps-invite",
              mediaSourceId: lobby.id,
              roomId: lobby.room.id,
              userId: actor.id
            },
            select: {
              id: true
            }
          })
        : null;

    return {
      message,
      notifications
    };
  });
  const pushSummary = await queueInvitePushes(result.notifications);

  await writeAuditLog({
    action: input.targetUserId ? "chat.core_fps.invite_user" : "chat.core_fps.invite_all",
    actorId: actor.id,
    metadata: {
      freshInviteCount: freshRecipientIds.length,
      lobbyId: lobby.id,
      mapName: lobby.mapName,
      pushSummary,
      repeatInviteCount: recipientIds.length - freshRecipientIds.length,
      roomSlug: lobby.room.slug,
      targetUserId: input.targetUserId ?? null
    } as Prisma.InputJsonValue,
    severity: pushSummary.failed ? "warning" : "info",
    target: `core-fps-lobby:${lobby.id}`
  });

  if (result.message) {
    await publishChatRoomChanged(lobby.room.id, result.message.id);
  }

  return {
    actionUrl,
    invitedUserCount: freshRecipientIds.length,
    repeatedUserCount: recipientIds.length - freshRecipientIds.length
  };
}

export async function activateCoreFpsFromChat(roomId: string, actorId: string) {
  const actor = await prisma.user.findFirst({
    select: {
      displayName: true,
      id: true
    },
    where: {
      id: actorId,
      status: "active"
    }
  });

  if (!actor) {
    throw new Error("Your account cannot start a game.");
  }

  await assertUserCanPostInChat(actor.id, roomId);
  const lobby = await joinCoreFpsLobby({
    roomId,
    user: actor
  });
  const invitations = await sendCoreFpsLobbyInvites({
    actorId: actor.id,
    lobbyId: lobby.id,
    postChatMessage: true
  });

  return {
    actionUrl: invitations.actionUrl,
    invitedUserCount: invitations.invitedUserCount,
    lobbyId: lobby.id,
    reused: lobby.status === "active"
  };
}
