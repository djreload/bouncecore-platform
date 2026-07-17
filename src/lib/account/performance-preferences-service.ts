import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  mergePerformancePreferences,
  type PerformancePreferences
} from "@/lib/account/performance-preferences-core";

function toInputJson(preferences: PerformancePreferences): Prisma.InputJsonValue {
  return preferences as unknown as Prisma.InputJsonValue;
}

export async function getUserPerformancePreferences(userId: string) {
  const row = await prisma.userPerformancePreference.findUnique({
    select: {
      value: true
    },
    where: {
      userId
    }
  });

  return {
    preferences: mergePerformancePreferences(row?.value),
    source: row ? ("database" as const) : ("default" as const)
  };
}

export async function updateUserPerformancePreferences(userId: string, value: unknown) {
  const preferences = mergePerformancePreferences(value);

  await prisma.userPerformancePreference.upsert({
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
    action: "account.performance_preferences.update",
    severity: "info",
    target: `user:${userId}`,
    metadata: {
      preferences: toInputJson(preferences)
    }
  });

  return preferences;
}
