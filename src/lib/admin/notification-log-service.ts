import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const directEmailSentActions = ["auth.email_verification.send", "auth.password_reset.send"];
const directEmailSkippedActions = ["auth.email_verification.skip", "auth.password_reset.skip"];

const emailEventWhere: Prisma.AuditLogWhereInput = {
  OR: [
    { action: { endsWith: ".email_sent" } },
    { action: { endsWith: ".email_not_sent" } },
    { action: { in: [...directEmailSentActions, ...directEmailSkippedActions] } }
  ]
};

const emailSentWhere: Prisma.AuditLogWhereInput = {
  OR: [{ action: { endsWith: ".email_sent" } }, { action: { in: directEmailSentActions } }]
};

const emailSkippedWhere: Prisma.AuditLogWhereInput = {
  OR: [{ action: { endsWith: ".email_not_sent" } }, { action: { in: directEmailSkippedActions } }]
};

export type AdminNotificationLogData = {
  emailEvents: Array<{
    action: string;
    actorDisplayName: string | null;
    actorEmail: string | null;
    configured: boolean | null;
    createdAt: string;
    id: string;
    reason: string | null;
    status: string;
    target: string | null;
    type: string | null;
  }>;
  pushDeliveries: Array<{
    attemptedAt: string | null;
    createdAt: string;
    deviceName: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    id: string;
    notificationTitle: string;
    notificationType: string;
    platform: string;
    provider: string;
    providerMessageId: string | null;
    receiptCheckedAt: string | null;
    receiptStatus: string | null;
    sentAt: string | null;
    status: string;
    tokenPreview: string;
    userDisplayName: string;
    userEmail: string;
  }>;
  recentNotifications: Array<{
    body: string | null;
    createdAt: string;
    id: string;
    pushDeliveryCount: number;
    readAt: string | null;
    title: string;
    type: string;
    userDisplayName: string;
    userEmail: string;
  }>;
  stats: {
    blockedPushDeliveries: number;
    deliveredPushDeliveries: number;
    emailEvents: number;
    emailsSent: number;
    emailsSkipped: number;
    failedPushDeliveries: number;
    notificationsToday: number;
    queuedPushDeliveries: number;
    sentPushDeliveries: number;
    totalNotifications: number;
  };
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function metadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function booleanMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "boolean" ? value : null;
}

function emailStatus(action: string) {
  if (action.endsWith(".email_sent") || directEmailSentActions.includes(action)) {
    return "sent";
  }

  if (action.endsWith(".email_not_sent") || directEmailSkippedActions.includes(action)) {
    return "not sent";
  }

  return "recorded";
}

export async function getAdminNotificationLogData(): Promise<AdminNotificationLogData> {
  const [
    emailEvents,
    pushDeliveries,
    recentNotifications,
    totalNotifications,
    notificationsToday,
    emailEventCount,
    emailsSent,
    emailsSkipped,
    queuedPushDeliveries,
    sentPushDeliveries,
    deliveredPushDeliveries,
    failedPushDeliveries,
    blockedPushDeliveries
  ] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 60,
      where: emailEventWhere
    }),
    prisma.mobilePushDelivery.findMany({
      include: {
        mobileDevice: {
          select: {
            deviceName: true,
            tokenPreview: true
          }
        },
        notification: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 60
    }),
    prisma.notification.findMany({
      include: {
        pushDeliveries: {
          select: {
            id: true
          }
        },
        user: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 30
    }),
    prisma.notification.count(),
    prisma.notification.count({
      where: {
        createdAt: {
          gte: startOfToday()
        }
      }
    }),
    prisma.auditLog.count({
      where: emailEventWhere
    }),
    prisma.auditLog.count({
      where: emailSentWhere
    }),
    prisma.auditLog.count({
      where: emailSkippedWhere
    }),
    prisma.mobilePushDelivery.count({
      where: {
        status: "queued"
      }
    }),
    prisma.mobilePushDelivery.count({
      where: {
        status: "sent"
      }
    }),
    prisma.mobilePushDelivery.count({
      where: {
        status: "delivered"
      }
    }),
    prisma.mobilePushDelivery.count({
      where: {
        status: "failed"
      }
    }),
    prisma.mobilePushDelivery.count({
      where: {
        status: "blocked"
      }
    })
  ]);

  return {
    emailEvents: emailEvents.map((event) => {
      const metadata = metadataRecord(event.metadata);

      return {
        action: event.action,
        actorDisplayName: event.actor?.displayName ?? null,
        actorEmail: event.actor?.email ?? null,
        configured: booleanMetadata(metadata, "configured"),
        createdAt: event.createdAt.toISOString(),
        id: event.id,
        reason: stringMetadata(metadata, "reason"),
        status: emailStatus(event.action),
        target: event.target,
        type: stringMetadata(metadata, "type")
      };
    }),
    pushDeliveries: pushDeliveries.map((delivery) => ({
      attemptedAt: delivery.attemptedAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      deviceName: delivery.mobileDevice.deviceName,
      errorCode: delivery.errorCode,
      errorMessage: delivery.errorMessage,
      id: delivery.id,
      notificationTitle: delivery.notification.title,
      notificationType: delivery.notification.type,
      platform: delivery.platform,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      receiptCheckedAt: delivery.receiptCheckedAt?.toISOString() ?? null,
      receiptStatus: delivery.receiptStatus,
      sentAt: delivery.sentAt?.toISOString() ?? null,
      status: delivery.status,
      tokenPreview: delivery.mobileDevice.tokenPreview,
      userDisplayName: delivery.notification.user.displayName,
      userEmail: delivery.notification.user.email
    })),
    recentNotifications: recentNotifications.map((notification) => ({
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
      id: notification.id,
      pushDeliveryCount: notification.pushDeliveries.length,
      readAt: notification.readAt?.toISOString() ?? null,
      title: notification.title,
      type: notification.type,
      userDisplayName: notification.user.displayName,
      userEmail: notification.user.email
    })),
    stats: {
      blockedPushDeliveries,
      deliveredPushDeliveries,
      emailEvents: emailEventCount,
      emailsSent,
      emailsSkipped,
      failedPushDeliveries,
      notificationsToday,
      queuedPushDeliveries,
      sentPushDeliveries,
      totalNotifications
    }
  };
}
