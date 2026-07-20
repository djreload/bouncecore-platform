import { Prisma } from "@prisma/client";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { prisma } from "@/lib/db/prisma";
import {
  analyzeRaveWarEventWindow,
  raveWarClientActionIdFromPayload,
  raveWarMatchIsStalled,
  raveWarMatchNeedsAttention
} from "@/lib/rave-wars/rave-war-diagnostics-core";
import { getRaveWarLevel } from "@/lib/rave-wars/rave-war-level-service";
import { publishRaveWarChanged } from "@/lib/rave-wars/rave-war-realtime";
import { normalizeRaveWarAdminRepairReason } from "@/lib/rave-wars/rave-war-admin-repair-core";
import {
  normalizeRaveWarState,
  raveWarMatchSeconds,
  raveWarTurnMovement,
  raveWarTurnSeconds
} from "@/lib/rave-wars/rave-war-service";
import type { RaveWarState } from "@/lib/rave-wars/rave-war-types";

const recentRaveWarLimit = 30;
const raveWarEventInspectionLimit = 250;
const raveWarEventDetailLimit = 1000;
const raveWarAdminLogLimit = 8;

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

function compactAdminRepairLog(entries: string[]) {
  return entries.slice(-raveWarAdminLogLimit);
}

function repairMatchDeadline(state: RaveWarState, startedAt: Date | null) {
  const storedDeadlineMs = state.warEndsAt ? new Date(state.warEndsAt).getTime() : Number.NaN;

  if (Number.isFinite(storedDeadlineMs)) {
    return storedDeadlineMs;
  }

  return startedAt ? startedAt.getTime() + raveWarMatchSeconds * 1000 : Number.NaN;
}

async function nextAdminRepairEventSequence(tx: Prisma.TransactionClient, warId: string) {
  const latest = await tx.raveWarEvent.findFirst({
    orderBy: {
      sequence: "desc"
    },
    select: {
      sequence: true
    },
    where: {
      warId
    }
  });

  return (latest?.sequence ?? 0) + 1;
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
  const stalled = raveWarMatchIsStalled({
    latestEventAt: diagnostics.latestEventAt,
    status: war.status,
    updatedAt: war.updatedAt
  });

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
    stalled,
    turnNumber: stateNumber(war.state, "turnNumber"),
    updatedAt: war.updatedAt,
    winnerUserId: war.winnerUserId
  };
}

export async function resyncAdminRaveWar(warId: string, actorId: string, rawReason: unknown) {
  const reason = normalizeRaveWarAdminRepairReason(rawReason);
  const war = await prisma.raveWar.findUnique({
    include: {
      events: {
        orderBy: {
          sequence: "desc"
        },
        select: {
          createdAt: true
        },
        take: 1
      },
      participants: {
        orderBy: {
          playerIndex: "asc"
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
      id: warId
    }
  });

  if (!war) {
    throw new Error("Rave War match was not found.");
  }

  if (war.status !== "active") {
    throw new Error("Only an active Rave War can be resynced.");
  }

  const latestEventAt = war.events[0]?.createdAt ?? null;

  if (!raveWarMatchIsStalled({ latestEventAt, status: war.status, updatedAt: war.updatedAt })) {
    throw new Error("This match still has recent server activity and cannot be resynced yet.");
  }

  const level = await getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);
  const activePlayer =
    state.players.find((player) => player.userId === war.turnUserId && player.health > 0) ??
    state.players.find((player) => player.userId === state.activeUserId && player.health > 0) ??
    state.players.find((player) => player.health > 0);

  if (!activePlayer) {
    throw new Error("No active player can be restored. Force end this match instead.");
  }

  const now = new Date();
  const matchDeadlineMs = repairMatchDeadline(state, war.startedAt);

  if (!Number.isFinite(matchDeadlineMs) || matchDeadlineMs <= now.getTime()) {
    throw new Error("The match deadline has passed. Force end this match instead of extending it.");
  }

  const nextRevision = state.revision + 1;
  const nextState: RaveWarState = {
    ...state,
    activeUserId: activePlayer.userId,
    lastShot: null,
    log: compactAdminRepairLog([...state.log, "Match state resynced by an administrator."]),
    players: state.players.map((player) =>
      player.userId === activePlayer.userId
        ? {
            ...player,
            movementLeft: raveWarTurnMovement
          }
        : player
    ),
    revision: nextRevision,
    turnEndsAt: new Date(now.getTime() + raveWarTurnSeconds * 1000).toISOString(),
    turnStartedAt: now.toISOString(),
    warEndsAt: new Date(matchDeadlineMs).toISOString()
  };
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.raveWar.updateMany({
      data: {
        state: nextState as Prisma.InputJsonValue,
        turnUserId: activePlayer.userId
      },
      where: {
        id: war.id,
        status: "active",
        updatedAt: war.updatedAt
      }
    });

    if (updated.count !== 1) {
      throw new Error("The match changed while the repair was running. Reload diagnostics before trying again.");
    }

    const event = await tx.raveWarEvent.create({
      data: {
        payload: {
          nextRevision,
          previousLatestEventAt: latestEventAt?.toISOString() ?? null,
          previousRevision: state.revision,
          reason
        },
        sequence: await nextAdminRepairEventSequence(tx, war.id),
        type: "admin.resynced",
        userId: actorId,
        warId: war.id
      }
    });
    const message = await tx.chatMessage.create({
      data: {
        body: "The Rave War was resynced by an administrator and is ready to continue.",
        kind: "rave-war",
        mediaSource: "rave-war",
        mediaSourceId: war.id,
        roomId: war.roomId
      }
    });

    await tx.auditLog.create({
      data: {
        action: "chat.rave_war.admin.resync",
        actorId,
        metadata: {
          eventId: event.id,
          nextRevision,
          previousLatestEventAt: latestEventAt?.toISOString() ?? null,
          previousRevision: state.revision,
          reason,
          restoredTurnUserId: activePlayer.userId,
          roomSlug: war.room.slug
        },
        severity: "warning",
        target: `rave-war:${war.id}`
      }
    });

    return {
      eventId: event.id,
      messageId: message.id,
      revision: nextRevision
    };
  });

  await publishChatRoomChanged(war.roomId, result.messageId);
  await publishRaveWarChanged(war.id, result.eventId);

  return result;
}

export async function forceEndAdminRaveWar(warId: string, actorId: string, rawReason: unknown) {
  const reason = normalizeRaveWarAdminRepairReason(rawReason);
  const war = await prisma.raveWar.findUnique({
    include: {
      participants: {
        orderBy: {
          playerIndex: "asc"
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
      id: warId
    }
  });

  if (!war) {
    throw new Error("Rave War match was not found.");
  }

  if (war.status !== "pending" && war.status !== "active") {
    throw new Error("Only a pending or active Rave War can be force-ended.");
  }

  const level = await getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);
  const nextRevision = state.revision + 1;
  const nextStatus = war.status === "pending" ? "cancelled" : "finished";
  const now = new Date();
  const nextState: RaveWarState = {
    ...state,
    activeUserId: null,
    lastShot: null,
    log: compactAdminRepairLog([...state.log, "Match force-ended by an administrator."]),
    revision: nextRevision,
    turnEndsAt: null,
    turnStartedAt: null,
    winnerUserId: null
  };
  const playerNames = war.participants.map((participant) => participant.displayNameSnapshot).join(" and ");
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.raveWar.updateMany({
      data: {
        endedAt: now,
        state: nextState as Prisma.InputJsonValue,
        status: nextStatus,
        turnUserId: null,
        winnerUserId: null
      },
      where: {
        id: war.id,
        status: war.status,
        updatedAt: war.updatedAt
      }
    });

    if (updated.count !== 1) {
      throw new Error("The match changed while the repair was running. Reload diagnostics before trying again.");
    }

    const event = await tx.raveWarEvent.create({
      data: {
        payload: {
          nextRevision,
          previousStatus: war.status,
          reason,
          resultingStatus: nextStatus
        },
        sequence: await nextAdminRepairEventSequence(tx, war.id),
        type: "admin.force-ended",
        userId: actorId,
        warId: war.id
      }
    });
    const message = await tx.chatMessage.create({
      data: {
        body: `${playerNames || "The Rave War players"}'s match was ended by an administrator.`,
        kind: "rave-war",
        mediaSource: "rave-war",
        mediaSourceId: war.id,
        roomId: war.roomId
      }
    });

    await tx.auditLog.create({
      data: {
        action: "chat.rave_war.admin.force_end",
        actorId,
        metadata: {
          eventId: event.id,
          nextRevision,
          previousStatus: war.status,
          reason,
          resultingStatus: nextStatus,
          roomSlug: war.room.slug
        },
        severity: "warning",
        target: `rave-war:${war.id}`
      }
    });

    return {
      eventId: event.id,
      messageId: message.id,
      status: nextStatus
    };
  });

  await publishChatRoomChanged(war.roomId, result.messageId);
  await publishRaveWarChanged(war.id, result.eventId);

  return result;
}
