import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createCoreFpsRuntimePlayerName } from "@/lib/games/core-fps-core";

const activePresenceWindowMs = 90_000;
const maxCounterValue = 2_000_000_000;
const terminalStatuses = new Set(["completed", "disconnected"]);

export type CoreFpsTelemetryInput = {
  damage: number;
  deaths: number;
  flags: number;
  frags: number;
  mapName?: string | null;
  modeName?: string | null;
  observedAt?: string | null;
  sessionId: string;
  status: "active" | "completed" | "connected" | "disconnected";
  teamKills: number;
  userId: string;
};

type CoreFpsSessionUser = {
  displayName: string;
  id: string;
};

function cleanCounter(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maxCounterValue) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return value;
}

function cleanOptionalLabel(value: string | null | undefined, maxLength: number) {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function counterDelta(current: number, previous: number) {
  return current >= previous ? current - previous : current;
}

export function calculateCoreFpsScore(stats: {
  deaths: number;
  flags: number;
  frags: number;
  teamKills: number;
}) {
  return Math.max(0, stats.frags * 100 + stats.flags * 300 - stats.deaths * 25 - stats.teamKills * 100);
}

export async function createCoreFpsSession(user: CoreFpsSessionUser, lobbyId?: string | null) {
  const sessionId = randomUUID();
  const runtimePlayerName = createCoreFpsRuntimePlayerName(user.displayName, sessionId);

  return prisma.coreFpsSession.create({
    data: {
      displayNameSnapshot: user.displayName,
      id: sessionId,
      lobbyId: lobbyId ?? null,
      runtimePlayerName,
      userId: user.id
    }
  });
}

export async function getOrCreateCoreFpsSession(user: CoreFpsSessionUser, lobbyId: string) {
  const existing = await prisma.coreFpsSession.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    where: {
      endedAt: null,
      lobbyId,
      status: {
        in: ["active", "launched"]
      },
      userId: user.id
    }
  });

  return existing ?? createCoreFpsSession(user, lobbyId);
}

export async function recordCoreFpsPresence(sessionId: string, userId: string, active: boolean) {
  const now = new Date();
  const result = await prisma.coreFpsSession.updateMany({
    data: active
      ? {
          lastSeenAt: now,
          status: "active"
        }
      : {
          endedAt: now,
          lastSeenAt: now,
          status: "disconnected"
        },
    where: {
      id: sessionId,
      status: {
        not: "completed"
      },
      userId
    }
  });

  if (!result.count) {
    throw new Error("That Core FPS session is unavailable.");
  }
}

export async function recordCoreFpsTelemetry(input: CoreFpsTelemetryInput) {
  const snapshot = {
    damage: cleanCounter(input.damage, "Damage"),
    deaths: cleanCounter(input.deaths, "Deaths"),
    flags: cleanCounter(input.flags, "Flags"),
    frags: cleanCounter(input.frags, "Frags"),
    teamKills: cleanCounter(input.teamKills, "Team kills")
  };
  const observedAt = input.observedAt ? new Date(input.observedAt) : new Date();

  if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > Date.now() + 5 * 60_000) {
    throw new Error("Telemetry timestamp is invalid.");
  }

  return prisma.$transaction(async (transaction) => {
    const session = await transaction.coreFpsSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId
      }
    });

    if (!session) {
      throw new Error("Core FPS session was not found.");
    }

    const totals = {
      damage: session.damage + counterDelta(snapshot.damage, session.lastDamage),
      deaths: session.deaths + counterDelta(snapshot.deaths, session.lastDeaths),
      flags: session.flags + counterDelta(snapshot.flags, session.lastFlags),
      frags: session.frags + counterDelta(snapshot.frags, session.lastFrags),
      teamKills: session.teamKills + counterDelta(snapshot.teamKills, session.lastTeamKills)
    };
    const status = input.status === "connected" ? "active" : input.status;
    const isTerminal = terminalStatuses.has(status);

    return transaction.coreFpsSession.update({
      data: {
        ...totals,
        connectedAt: session.connectedAt ?? observedAt,
        endedAt: isTerminal ? observedAt : null,
        lastDamage: snapshot.damage,
        lastDeaths: snapshot.deaths,
        lastFlags: snapshot.flags,
        lastFrags: snapshot.frags,
        lastSeenAt: observedAt,
        lastTeamKills: snapshot.teamKills,
        mapName: cleanOptionalLabel(input.mapName, 80) ?? session.mapName,
        modeName: cleanOptionalLabel(input.modeName, 80) ?? session.modeName,
        score: calculateCoreFpsScore(totals),
        status
      },
      where: {
        id: session.id
      }
    });
  });
}

export async function getCoreFpsHubData(userId: string) {
  const activeSince = new Date(Date.now() - activePresenceWindowMs);
  const [leaderboardRows, currentPlayers, personal, recentSessions] = await Promise.all([
    prisma.coreFpsSession.groupBy({
      _count: {
        _all: true
      },
      _sum: {
        damage: true,
        deaths: true,
        flags: true,
        frags: true,
        score: true
      },
      by: ["userId"],
      orderBy: {
        _sum: {
          score: "desc"
        }
      },
      take: 20,
      where: {
        OR: [
          {
            frags: {
              gt: 0
            }
          },
          {
            flags: {
              gt: 0
            }
          },
          {
            damage: {
              gt: 0
            }
          }
        ]
      }
    }),
    prisma.coreFpsSession.findMany({
      distinct: ["userId"],
      select: {
        userId: true
      },
      where: {
        lastSeenAt: {
          gte: activeSince
        },
        status: "active"
      }
    }),
    prisma.coreFpsSession.aggregate({
      _count: {
        _all: true
      },
      _sum: {
        damage: true,
        deaths: true,
        flags: true,
        frags: true,
        score: true
      },
      where: {
        userId
      }
    }),
    prisma.coreFpsSession.findMany({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true,
        damage: true,
        deaths: true,
        endedAt: true,
        flags: true,
        frags: true,
        id: true,
        mapName: true,
        modeName: true,
        score: true,
        status: true
      },
      take: 6,
      where: {
        userId
      }
    })
  ]);
  const leaderboardUsers = await prisma.user.findMany({
    select: {
      displayName: true,
      id: true,
      profile: {
        select: {
          avatarUrl: true
        }
      }
    },
    where: {
      id: {
        in: leaderboardRows.map((row) => row.userId)
      }
    }
  });
  const usersById = new Map(leaderboardUsers.map((user) => [user.id, user]));

  return {
    leaderboard: leaderboardRows.map((row, index) => {
      const account = usersById.get(row.userId);

      return {
        avatarUrl: account?.profile?.avatarUrl ?? null,
        damage: row._sum.damage ?? 0,
        deaths: row._sum.deaths ?? 0,
        displayName: account?.displayName ?? "Deleted player",
        flags: row._sum.flags ?? 0,
        frags: row._sum.frags ?? 0,
        rank: index + 1,
        score: row._sum.score ?? 0,
        sessions: row._count._all,
        userId: row.userId
      };
    }),
    onlinePlayers: currentPlayers.length,
    personal: {
      damage: personal._sum.damage ?? 0,
      deaths: personal._sum.deaths ?? 0,
      flags: personal._sum.flags ?? 0,
      frags: personal._sum.frags ?? 0,
      score: personal._sum.score ?? 0,
      sessions: personal._count._all
    },
    recentSessions
  };
}
