import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  eventNotificationDedupeKey,
  mobileEventDeliveryStatus,
  streamLiveNotificationContent,
  streamLiveNotificationDedupePrefix
} from "@/lib/mobile/event-notification-core";
import { secretEncryptionConfigured } from "@/lib/security/secret-crypto";

export type MobileEventNotificationQueueResult = {
  blockedPushDeliveryCount: number;
  duplicateNotificationCount: number;
  notificationCount: number;
  pushDeliveryCount: number;
  queuedPushDeliveryCount: number;
  recipientCount: number;
};

type QueueEventNotificationInput = {
  auditAction: string;
  auditMetadata?: Prisma.InputJsonValue;
  auditTarget?: string;
  body: string | null;
  dedupeKeyPrefix: string;
  title: string;
  type: string;
};

async function queueEventNotificationForActiveMobileDevices({
  auditAction,
  auditMetadata,
  auditTarget,
  body,
  dedupeKeyPrefix,
  title,
  type
}: QueueEventNotificationInput): Promise<MobileEventNotificationQueueResult> {
  const recipients = await prisma.user.findMany({
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
      }
    },
    where: {
      mobileDevices: {
        some: {
          revokedAt: null
        }
      },
      status: "active"
    }
  });
  const encryptionReady = secretEncryptionConfigured();
  let notificationCount = 0;
  let duplicateNotificationCount = 0;
  let pushDeliveryCount = 0;
  let queuedPushDeliveryCount = 0;
  let blockedPushDeliveryCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const recipient of recipients) {
      const dedupeKey = eventNotificationDedupeKey(dedupeKeyPrefix, recipient.id);
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

      const notification = await tx.notification.create({
        data: {
          body,
          dedupeKey,
          title,
          type,
          userId: recipient.id
        }
      });
      const pushDeliveries = recipient.mobileDevices.map((device) => {
        const delivery = mobileEventDeliveryStatus({
          encryptionReady,
          tokenCiphertext: device.tokenCiphertext
        });

        return {
          errorCode: delivery.errorCode,
          errorMessage: delivery.errorMessage,
          mobileDeviceId: device.id,
          notificationId: notification.id,
          platform: device.platform,
          provider: device.provider,
          status: delivery.status
        };
      });

      notificationCount += 1;
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

  const metadata: Prisma.InputJsonObject =
    auditMetadata === undefined
      ? {
          blockedPushDeliveryCount,
          duplicateNotificationCount,
          notificationCount,
          pushDeliveryCount,
          queuedPushDeliveryCount,
          recipientCount: recipients.length
        }
      : {
          blockedPushDeliveryCount,
          duplicateNotificationCount,
          event: auditMetadata,
          notificationCount,
          pushDeliveryCount,
          queuedPushDeliveryCount,
          recipientCount: recipients.length
        };

  await writeAuditLog({
    action: auditAction,
    actorId: null,
    metadata,
    severity: blockedPushDeliveryCount ? "warning" : "info",
    target: auditTarget
  });

  return {
    blockedPushDeliveryCount,
    duplicateNotificationCount,
    notificationCount,
    pushDeliveryCount,
    queuedPushDeliveryCount,
    recipientCount: recipients.length
  };
}

export async function queueStreamLiveNotifications(input: {
  channelId: string;
  channelTitle: string;
  sessionId: string;
}) {
  const notification = streamLiveNotificationContent(input.channelTitle);

  return queueEventNotificationForActiveMobileDevices({
    auditAction: "mobile.push.stream_live.queue",
    auditMetadata: {
      channelId: input.channelId,
      sessionId: input.sessionId
    },
    auditTarget: `stream-session:${input.sessionId}`,
    body: notification.body,
    dedupeKeyPrefix: streamLiveNotificationDedupePrefix({
      channelId: input.channelId,
      sessionId: input.sessionId
    }),
    title: notification.title,
    type: notification.type
  });
}
