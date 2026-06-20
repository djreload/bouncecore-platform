import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { extractMentionTokens } from "@/lib/chat/mentions";
import {
  chatMentionActionUrl,
  chatMentionDedupeKey,
  chatMentionNotificationContent,
  userMatchesChatMention
} from "@/lib/chat/mention-notifications-core";
import {
  mergeNotificationPreferences,
  notificationDeliveryPreferences
} from "@/lib/account/notification-preferences-core";
import { mobileEventDeliveryStatus } from "@/lib/mobile/event-notification-core";
import { secretEncryptionConfigured } from "@/lib/security/secret-crypto";

export type ChatMentionNotificationResult = {
  blockedPushDeliveryCount: number;
  duplicateNotificationCount: number;
  mentionedTokenCount: number;
  notificationCount: number;
  preferenceSkippedPushDeliveryCount: number;
  pushDeliveryCount: number;
  queuedPushDeliveryCount: number;
  recipientCount: number;
};

export async function queueChatMentionNotifications(input: {
  body: string;
  messageId: string;
  roomSlug: string;
  senderUserId: string;
}) {
  const mentionTokens = extractMentionTokens(input.body);

  if (!mentionTokens.length) {
    return {
      blockedPushDeliveryCount: 0,
      duplicateNotificationCount: 0,
      mentionedTokenCount: 0,
      notificationCount: 0,
      preferenceSkippedPushDeliveryCount: 0,
      pushDeliveryCount: 0,
      queuedPushDeliveryCount: 0,
      recipientCount: 0
    } satisfies ChatMentionNotificationResult;
  }

  const [sender, candidates] = await Promise.all([
    prisma.user.findUnique({
      select: {
        displayName: true
      },
      where: {
        id: input.senderUserId
      }
    }),
    prisma.user.findMany({
      select: {
        displayName: true,
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
        },
        profile: {
          select: {
            slug: true
          }
        }
      },
      where: {
        status: "active"
      }
    })
  ]);
  const recipients = candidates.filter((user) =>
    userMatchesChatMention(mentionTokens, {
      displayName: user.displayName,
      profileSlug: user.profile?.slug
    })
  );
  const notification = chatMentionNotificationContent({
    authorDisplayName: sender?.displayName ?? "Someone",
    body: input.body,
    roomSlug: input.roomSlug
  });
  const actionUrl = chatMentionActionUrl({
    messageId: input.messageId,
    roomSlug: input.roomSlug
  });
  const encryptionReady = secretEncryptionConfigured();
  let notificationCount = 0;
  let duplicateNotificationCount = 0;
  let pushDeliveryCount = 0;
  let queuedPushDeliveryCount = 0;
  let blockedPushDeliveryCount = 0;
  let preferenceSkippedPushDeliveryCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const recipient of recipients) {
      const dedupeKey = chatMentionDedupeKey({
        messageId: input.messageId,
        userId: recipient.id
      });
      const existing = await tx.notification.findUnique({
        select: {
          id: true
        },
        where: {
          dedupeKey
        }
      });

      if (existing) {
        duplicateNotificationCount += 1;
        continue;
      }

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
      const deliveryPreferences = notificationDeliveryPreferences(
        mergeNotificationPreferences(recipient.notificationPreference?.value),
        notification.type
      );
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

      notificationCount += 1;
      preferenceSkippedPushDeliveryCount += deliveryPreferences.push ? 0 : recipient.mobileDevices.length;
      pushDeliveryCount += pushDeliveries.length;
      queuedPushDeliveryCount += pushDeliveries.filter((delivery) => delivery.status === "queued").length;
      blockedPushDeliveryCount += pushDeliveries.filter((delivery) => delivery.status === "blocked").length;

      if (pushDeliveries.length) {
        await tx.mobilePushDelivery.createMany({
          data: pushDeliveries
        });
      }
    }
  });

  await writeAuditLog({
    action: "chat.mention_notifications.queue",
    actorId: input.senderUserId,
    metadata: {
      actionUrl,
      blockedPushDeliveryCount,
      duplicateNotificationCount,
      mentionedTokenCount: mentionTokens.length,
      notificationCount,
      preferenceSkippedPushDeliveryCount,
      pushDeliveryCount,
      queuedPushDeliveryCount,
      recipientCount: recipients.length,
      roomSlug: input.roomSlug
    } satisfies Prisma.InputJsonObject,
    severity: blockedPushDeliveryCount ? "warning" : "info",
    target: `chat-message:${input.messageId}`
  });

  return {
    blockedPushDeliveryCount,
    duplicateNotificationCount,
    mentionedTokenCount: mentionTokens.length,
    notificationCount,
    preferenceSkippedPushDeliveryCount,
    pushDeliveryCount,
    queuedPushDeliveryCount,
    recipientCount: recipients.length
  } satisfies ChatMentionNotificationResult;
}
