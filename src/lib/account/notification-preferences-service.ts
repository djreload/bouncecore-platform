import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  mergeNotificationPreferences,
  notificationDeliveryPreferences,
  type NotificationPreferences
} from "@/lib/account/notification-preferences-core";

function toInputJson(preferences: NotificationPreferences): Prisma.InputJsonValue {
  return preferences as unknown as Prisma.InputJsonValue;
}

export async function getUserNotificationPreferences(userId: string) {
  const row = await prisma.userNotificationPreference.findUnique({
    select: {
      value: true
    },
    where: {
      userId
    }
  });

  return mergeNotificationPreferences(row?.value);
}

export async function updateUserNotificationPreferences(userId: string, value: unknown) {
  const preferences = mergeNotificationPreferences(value);

  await prisma.userNotificationPreference.upsert({
    create: {
      userId,
      value: toInputJson(preferences)
    },
    update: {
      value: toInputJson(preferences)
    },
    where: {
      userId
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "account.notification_preferences.update",
    severity: "info",
    target: `user:${userId}`,
    metadata: {
      preferences: toInputJson(preferences)
    }
  });

  return preferences;
}

export async function getNotificationDeliveryPreferencesForUser(userId: string, type: string) {
  return notificationDeliveryPreferences(await getUserNotificationPreferences(userId), type);
}
