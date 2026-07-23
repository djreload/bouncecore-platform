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
  coreFpsInviteCooldownMs,
  getCoreFpsInviteRecipientIds
} from "@/lib/games/core-fps-invite-core";
import { getPublicCoreFpsSettings } from "@/lib/games/core-fps-settings-service";
import { queueMobilePushForNotification } from "@/lib/mobile/account-notification-push-service";

type NotificationDelivery = {
  id: string;
  userId: string;
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

export async function activateCoreFpsFromChat(roomId: string, actorId: string) {
  const settings = await getPublicCoreFpsSettings();

  if (!settings.enabled || !settings.publicUrl) {
    throw new Error("Core FPS is currently unavailable.");
  }

  const room = await prisma.chatRoom.findUnique({
    select: {
      id: true,
      name: true,
      slug: true
    },
    where: {
      id: roomId
    }
  });

  if (!room) {
    throw new Error("That chat room is unavailable.");
  }

  await assertUserCanPostInChat(actorId, room.id);

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

  const cooldownStartedAt = new Date(Date.now() - coreFpsInviteCooldownMs);
  const recentActivation = await prisma.chatMessage.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      mediaSourceId: true
    },
    where: {
      createdAt: {
        gte: cooldownStartedAt
      },
      kind: "core-fps",
      mediaSource: "core-fps-invite",
      roomId: room.id
    }
  });

  if (recentActivation?.mediaSourceId) {
    return {
      actionUrl: coreFpsInviteActionUrl(recentActivation.mediaSourceId),
      invitedUserCount: 0,
      reused: true
    };
  }

  const presenceUsers = await getPublicChatPresence(room.id, actor.id);
  const recipientIds = getCoreFpsInviteRecipientIds(presenceUsers, actor.id);
  const activationId = randomUUID();
  const actionUrl = coreFpsInviteActionUrl(activationId);
  const result = await prisma.$transaction(async (transaction) => {
    const message = await transaction.chatMessage.create({
      data: {
        body: `${actor.displayName} started a Core FPS game. Join the shared arena now.`,
        kind: "core-fps",
        mediaSource: "core-fps-invite",
        mediaSourceId: activationId,
        roomId: room.id,
        userId: actor.id
      },
      select: {
        id: true
      }
    });
    const notifications = await Promise.all(
      recipientIds.map((userId) =>
        transaction.notification.create({
          data: {
            actionUrl,
            body: `Join ${actor.displayName} and the other online chatters in the shared arena.`,
            dedupeKey: `chat.core_fps.invite:${activationId}:user:${userId}`,
            title: `${actor.displayName} started a Core FPS game`,
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

    return {
      message,
      notifications
    };
  });

  const pushSummary = await queueInvitePushes(result.notifications);

  await writeAuditLog({
    action: "chat.core_fps.activate",
    actorId,
    metadata: {
      activationId,
      invitedUserCount: recipientIds.length,
      pushSummary,
      roomSlug: room.slug
    } as Prisma.InputJsonValue,
    severity: pushSummary.failed ? "warning" : "info",
    target: `core-fps-activation:${activationId}`
  });
  await publishChatRoomChanged(room.id, result.message.id);

  return {
    actionUrl,
    invitedUserCount: recipientIds.length,
    reused: false
  };
}
