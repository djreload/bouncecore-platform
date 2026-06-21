import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  mergeNotificationPreferences,
  notificationDeliveryPreferences
} from "@/lib/account/notification-preferences-core";
import {
  chatSheepThrowActionUrl,
  chatSheepThrowDedupeKey,
  chatSheepThrowNotificationContent
} from "@/lib/chat/sheep-throw-notifications-core";
import { prisma } from "@/lib/db/prisma";
import { mobileEventDeliveryStatus } from "@/lib/mobile/event-notification-core";
import { secretEncryptionConfigured } from "@/lib/security/secret-crypto";

export type ChatSheepThrowNotificationResult = {
  blockedPushDeliveryCount: number;
  duplicateNotificationCount: number;
  notificationCount: number;
  preferenceSkippedPushDeliveryCount: number;
  pushDeliveryCount: number;
  queuedPushDeliveryCount: number;
  recipientCount: number;
};

export async function queueChatSheepThrowNotification(input: {
  messageId: string;
  roomSlug: string;
  sheepThrowId: string;
  targetUserId: string;
  throwerDisplayName: string;
  throwerUserId: string;
}) {
  if (input.targetUserId === input.throwerUserId) {
    return {
      blockedPushDeliveryCount: 0,
      duplicateNotificationCount: 0,
      notificationCount: 0,
      preferenceSkippedPushDeliveryCount: 0,
      pushDeliveryCount: 0,
      queuedPushDeliveryCount: 0,
      recipientCount: 0
    } satisfies ChatSheepThrowNotificationResult;
  }

  const recipient = await prisma.user.findFirst({
    select: {
      id: true,
      mobileDevices: {
        select: {
          id: true,
          platform: true,
          provider: true,
          tokenCiphertext: true
        },
        where: {
          revokedAt: null
        }
      },
      notificationPreference: {
        select: {
          value: true
        }
      }
    },
    where: {
      id: input.targetUserId,
      status: "active"
    }
  });

  if (!recipient) {
    return {
      blockedPushDeliveryCount: 0,
      duplicateNotificationCount: 0,
      notificationCount: 0,
      preferenceSkippedPushDeliveryCount: 0,
      pushDeliveryCount: 0,
      queuedPushDeliveryCount: 0,
      recipientCount: 0
    } satisfies ChatSheepThrowNotificationResult;
  }

  const dedupeKey = chatSheepThrowDedupeKey({
    sheepThrowId: input.sheepThrowId,
    userId: recipient.id
  });
  const existing = await prisma.notification.findUnique({
    select: {
      id: true
    },
    where: {
      dedupeKey
    }
  });

  if (existing) {
    return {
      blockedPushDeliveryCount: 0,
      duplicateNotificationCount: 1,
      notificationCount: 0,
      preferenceSkippedPushDeliveryCount: 0,
      pushDeliveryCount: 0,
      queuedPushDeliveryCount: 0,
      recipientCount: 1
    } satisfies ChatSheepThrowNotificationResult;
  }

  const actionUrl = chatSheepThrowActionUrl({
    messageId: input.messageId,
    roomSlug: input.roomSlug
  });
  const notification = chatSheepThrowNotificationContent({
    roomSlug: input.roomSlug,
    throwerDisplayName: input.throwerDisplayName
  });
  const encryptionReady = secretEncryptionConfigured();
  const deliveryPreferences = notificationDeliveryPreferences(
    mergeNotificationPreferences(recipient.notificationPreference?.value),
    notification.type
  );
  let queuedPushDeliveryCount = 0;
  let blockedPushDeliveryCount = 0;
  let pushDeliveryCount = 0;
  const preferenceSkippedPushDeliveryCount = deliveryPreferences.push ? 0 : recipient.mobileDevices.length;

  await prisma.$transaction(async (tx) => {
    const createdNotification = await tx.notification.create({
      data: {
        actionUrl,
        body: notification.body,
        dedupeKey,
        title: notification.title,
        type: notification.type,
        userId: recipient.id
      }
    });
    const pushDeliveries = deliveryPreferences.push
      ? recipient.mobileDevices.map((device) => {
          const delivery = mobileEventDeliveryStatus({
            encryptionReady,
            tokenCiphertext: device.tokenCiphertext
          });

          return {
            errorCode: delivery.errorCode,
            errorMessage: delivery.errorMessage,
            mobileDeviceId: device.id,
            notificationId: createdNotification.id,
            platform: device.platform,
            provider: device.provider,
            status: delivery.status
          };
        })
      : [];

    pushDeliveryCount = pushDeliveries.length;
    queuedPushDeliveryCount = pushDeliveries.filter((delivery) => delivery.status === "queued").length;
    blockedPushDeliveryCount = pushDeliveries.filter((delivery) => delivery.status === "blocked").length;

    if (pushDeliveries.length) {
      await tx.mobilePushDelivery.createMany({
        data: pushDeliveries
      });
    }
  });

  const result = {
    blockedPushDeliveryCount,
    duplicateNotificationCount: 0,
    notificationCount: 1,
    preferenceSkippedPushDeliveryCount,
    pushDeliveryCount,
    queuedPushDeliveryCount,
    recipientCount: 1
  } satisfies ChatSheepThrowNotificationResult;

  await writeAuditLog({
    action: "chat.sheep_throw.notification.queue",
    actorId: input.throwerUserId,
    metadata: {
      ...result,
      actionUrl,
      roomSlug: input.roomSlug,
      targetUserId: input.targetUserId
    } satisfies Prisma.InputJsonObject,
    severity: blockedPushDeliveryCount ? "warning" : "info",
    target: `chat-sheep-throw:${input.sheepThrowId}`
  });

  return result;
}
