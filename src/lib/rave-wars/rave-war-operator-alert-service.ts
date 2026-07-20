import { notifyAccountUserOnce } from "@/lib/account/notification-email-service";
import { hasPermission, roleDefinitions } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { raveWarMatchIsStalled } from "@/lib/rave-wars/rave-war-diagnostics-core";
import {
  raveWarStalledOperatorAlertContent,
  raveWarStalledOperatorAlertDedupeKey
} from "@/lib/rave-wars/rave-war-operator-alert-core";
import { raveWarMatchSeconds } from "@/lib/rave-wars/rave-war-service";

function stateRevision(state: unknown) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return 0;
  }

  const revision = (state as Record<string, unknown>).revision;

  return typeof revision === "number" && Number.isFinite(revision) ? Math.max(0, Math.trunc(revision)) : 0;
}

function stateTimestamp(state: unknown, key: string) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }

  const value = (state as Record<string, unknown>)[key];
  const timestamp = typeof value === "string" ? new Date(value).getTime() : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : null;
}

function matchDeadlineHasPassed(state: unknown, startedAt: Date | null, nowMs: number) {
  const deadlineMs = stateTimestamp(state, "warEndsAt") ?? (startedAt ? startedAt.getTime() + raveWarMatchSeconds * 1000 : null);

  return deadlineMs !== null && deadlineMs <= nowMs;
}

const operatorRoleNames = roleDefinitions
  .filter((role) => hasPermission({ roles: [role.key] }, "settings.manage"))
  .map((role) => role.key);

export async function monitorStalledRaveWars() {
  const activeWars = await prisma.raveWar.findMany({
    orderBy: {
      updatedAt: "asc"
    },
    select: {
      events: {
        orderBy: {
          sequence: "desc"
        },
        select: {
          createdAt: true
        },
        take: 1
      },
      id: true,
      participants: {
        orderBy: {
          playerIndex: "asc"
        },
        select: {
          displayNameSnapshot: true
        }
      },
      room: {
        select: {
          name: true
        }
      },
      state: true,
      startedAt: true,
      status: true,
      updatedAt: true
    },
    where: {
      status: "active"
    }
  });
  const now = new Date();
  const stalledWars = activeWars.filter((war) =>
    !matchDeadlineHasPassed(war.state, war.startedAt, now.getTime()) &&
    raveWarMatchIsStalled({
      latestEventAt: war.events[0]?.createdAt ?? null,
      now,
      status: war.status,
      updatedAt: war.updatedAt
    })
  );

  if (!stalledWars.length) {
    return {
      activeMatchCount: activeWars.length,
      createdNotificationCount: 0,
      duplicateNotificationCount: 0,
      failedNotificationCount: 0,
      operatorCount: 0,
      stalledMatchCount: 0
    };
  }

  const operators = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      displayName: true,
      email: true,
      id: true
    },
    where: {
      roles: {
        some: {
          role: {
            name: {
              in: operatorRoleNames
            }
          }
        }
      },
      status: "active"
    }
  });
  const candidates = stalledWars.flatMap((war) => {
    const revision = stateRevision(war.state);
    const content = raveWarStalledOperatorAlertContent({
      participantNames: war.participants.map((participant) => participant.displayNameSnapshot),
      roomName: war.room.name,
      warId: war.id
    });

    return operators.map((operator) => ({
      content,
      dedupeKey: raveWarStalledOperatorAlertDedupeKey({
        revision,
        userId: operator.id,
        warId: war.id
      }),
      operator
    }));
  });
  const existingNotifications = candidates.length
    ? await prisma.notification.findMany({
        select: {
          dedupeKey: true
        },
        where: {
          dedupeKey: {
            in: candidates.map((candidate) => candidate.dedupeKey)
          }
        }
      })
    : [];
  const existingDedupeKeys = new Set(existingNotifications.flatMap((notification) => (notification.dedupeKey ? [notification.dedupeKey] : [])));
  let createdNotificationCount = 0;
  let failedNotificationCount = 0;

  for (const candidate of candidates) {
    if (existingDedupeKeys.has(candidate.dedupeKey)) {
      continue;
    }

    try {
      const created = await notifyAccountUserOnce({
        actionUrl: candidate.content.actionUrl,
        auditActionPrefix: "admin.rave-war.stalled_alert",
        body: candidate.content.body,
        dedupeKey: candidate.dedupeKey,
        htmlLines: [candidate.content.body, "Open the match diagnostics before taking a repair action."],
        subject: candidate.content.title,
        textLines: [candidate.content.body, `Diagnostics: ${candidate.content.actionUrl}`],
        title: candidate.content.title,
        type: candidate.content.type,
        user: candidate.operator
      });

      createdNotificationCount += created ? 1 : 0;
    } catch {
      failedNotificationCount += 1;
    }
  }

  return {
    activeMatchCount: activeWars.length,
    createdNotificationCount,
    duplicateNotificationCount: Math.max(0, candidates.length - createdNotificationCount - failedNotificationCount),
    failedNotificationCount,
    operatorCount: operators.length,
    stalledMatchCount: stalledWars.length
  };
}
