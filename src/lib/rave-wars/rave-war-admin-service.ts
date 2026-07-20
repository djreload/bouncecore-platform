import { prisma } from "@/lib/db/prisma";
import {
  analyzeRaveWarEventWindow,
  raveWarClientActionIdFromPayload,
  raveWarMatchNeedsAttention
} from "@/lib/rave-wars/rave-war-diagnostics-core";

const recentRaveWarLimit = 30;
const raveWarEventInspectionLimit = 250;
const raveWarEventDetailLimit = 1000;

function stateNumber(state: unknown, key: string) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return 0;
  }

  const value = (state as Record<string, unknown>)[key];

  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function eventPayloadPreview(payload: unknown) {
  const serialized = JSON.stringify(payload ?? null, null, 2);

  return serialized.length > 5000 ? `${serialized.slice(0, 5000)}\n... payload truncated` : serialized;
}

export async function getAdminRaveWarDiagnosticsData() {
  const wars = await prisma.raveWar.findMany({
    include: {
      _count: {
        select: {
          events: true
        }
      },
      events: {
        orderBy: {
          sequence: "desc"
        },
        select: {
          createdAt: true,
          payload: true,
          sequence: true,
          type: true
        },
        take: raveWarEventInspectionLimit
      },
      participants: {
        orderBy: {
          playerIndex: "asc"
        },
        select: {
          displayNameSnapshot: true,
          playerIndex: true,
          userId: true
        }
      },
      room: {
        select: {
          name: true,
          slug: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: recentRaveWarLimit
  });

  const matches = wars.map((war) => {
    const diagnostics = analyzeRaveWarEventWindow(war.events, war._count.events);

    return {
      createdAt: war.createdAt,
      diagnostics,
      endedAt: war.endedAt,
      id: war.id,
      levelKey: war.levelKey,
      needsAttention: raveWarMatchNeedsAttention({ diagnostics, status: war.status, updatedAt: war.updatedAt }),
      participants: war.participants,
      revision: stateNumber(war.state, "revision"),
      room: war.room,
      startedAt: war.startedAt,
      status: war.status,
      turnNumber: stateNumber(war.state, "turnNumber"),
      updatedAt: war.updatedAt,
      winnerUserId: war.winnerUserId
    };
  });

  return {
    matches,
    summary: {
      active: matches.filter((match) => match.status === "active").length,
      attention: matches.filter((match) => match.needsAttention).length,
      finished: matches.filter((match) => match.status === "finished").length,
      total: matches.length
    }
  };
}

export async function getAdminRaveWarMatchDiagnostics(warId: string) {
  if (!warId.trim()) {
    return null;
  }

  const war = await prisma.raveWar.findUnique({
    include: {
      _count: {
        select: {
          events: true
        }
      },
      events: {
        orderBy: {
          sequence: "desc"
        },
        select: {
          createdAt: true,
          id: true,
          payload: true,
          sequence: true,
          type: true,
          user: {
            select: {
              displayName: true
            }
          },
          userId: true
        },
        take: raveWarEventDetailLimit
      },
      participants: {
        orderBy: {
          playerIndex: "asc"
        },
        select: {
          displayNameSnapshot: true,
          playerIndex: true,
          userId: true
        }
      },
      room: {
        select: {
          name: true,
          slug: true
        }
      }
    },
    where: {
      id: warId
    }
  });

  if (!war) {
    return null;
  }

  const diagnostics = analyzeRaveWarEventWindow(war.events, war._count.events);
  const orderedEvents = war.events.slice().sort((first, second) => first.sequence - second.sequence);

  return {
    createdAt: war.createdAt,
    diagnostics,
    endedAt: war.endedAt,
    events: orderedEvents.map((event, index) => ({
      actionId: raveWarClientActionIdFromPayload(event.payload),
      actorDisplayName: event.user?.displayName ?? null,
      actorUserId: event.userId,
      createdAt: event.createdAt,
      gapMs: index > 0 ? Math.max(0, event.createdAt.getTime() - orderedEvents[index - 1].createdAt.getTime()) : null,
      id: event.id,
      payloadPreview: eventPayloadPreview(event.payload),
      sequence: event.sequence,
      type: event.type
    })),
    id: war.id,
    levelKey: war.levelKey,
    needsAttention: raveWarMatchNeedsAttention({ diagnostics, status: war.status, updatedAt: war.updatedAt }),
    participants: war.participants,
    revision: stateNumber(war.state, "revision"),
    room: war.room,
    startedAt: war.startedAt,
    status: war.status,
    turnNumber: stateNumber(war.state, "turnNumber"),
    winnerUserId: war.winnerUserId
  };
}
