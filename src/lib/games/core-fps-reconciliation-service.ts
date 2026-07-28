import { Prisma } from "@prisma/client";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { prisma } from "@/lib/db/prisma";
import { coreFpsLobbyPresenceWindowMs } from "@/lib/games/core-fps-lobby-core";
import {
  buildCoreFpsResultBody,
  coreFpsLifecycleCutoffs,
  type CoreFpsResultLeader
} from "@/lib/games/core-fps-reconciliation-core";

type ResultSession = {
  connectedAt: Date | null;
  damage: number;
  deaths: number;
  displayNameSnapshot: string;
  flags: number;
  frags: number;
  score: number;
  userId: string;
};

function sessionWasPlayed(session: ResultSession) {
  return Boolean(
    session.connectedAt ||
      session.damage ||
      session.deaths ||
      session.flags ||
      session.frags ||
      session.score
  );
}

function aggregateLeaders(sessions: ResultSession[]) {
  const leaders = new Map<string, CoreFpsResultLeader>();

  for (const session of sessions.filter(sessionWasPlayed)) {
    const current = leaders.get(session.userId) ?? {
      damage: 0,
      deaths: 0,
      displayName: session.displayNameSnapshot,
      flags: 0,
      frags: 0,
      score: 0,
      userId: session.userId
    };

    current.damage += session.damage;
    current.deaths += session.deaths;
    current.flags += session.flags;
    current.frags += session.frags;
    current.score += session.score;
    leaders.set(session.userId, current);
  }

  return [...leaders.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.frags - left.frags ||
      right.flags - left.flags ||
      right.damage - left.damage ||
      left.deaths - right.deaths ||
      left.userId.localeCompare(right.userId)
  );
}

export async function reconcileCoreFpsLifecycle(now = new Date()) {
  const participantCutoff = new Date(now.getTime() - coreFpsLobbyPresenceWindowMs);
  const cutoffs = coreFpsLifecycleCutoffs(now);
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bouncecore-core-fps-reconcile'))`;

    const staleParticipants = await transaction.coreFpsLobbyParticipant.updateMany({
      data: {
        leftAt: now
      },
      where: {
        lastSeenAt: {
          lt: participantCutoff
        },
        leftAt: null,
        lobby: {
          status: {
            in: ["active", "waiting"]
          }
        }
      }
    });
    const staleSessions = await transaction.coreFpsSession.updateMany({
      data: {
        endedAt: now,
        status: "disconnected"
      },
      where: {
        OR: [
          {
            createdAt: {
              lt: cutoffs.launchedSession
            },
            status: "launched"
          },
          {
            lastSeenAt: {
              lt: cutoffs.activeSession
            },
            status: "active"
          },
          {
            lastSeenAt: null,
            status: "active",
            updatedAt: {
              lt: cutoffs.activeSession
            }
          }
        ]
      }
    });
    const abandonedLobbies = await transaction.coreFpsLobby.findMany({
      select: {
        id: true
      },
      where: {
        participants: {
          none: {
            lastSeenAt: {
              gte: participantCutoff
            },
            leftAt: null
          }
        },
        status: {
          in: ["active", "waiting"]
        }
      }
    });
    const abandonedLobbyIds = abandonedLobbies.map((lobby) => lobby.id);
    const completedLobbies = abandonedLobbyIds.length
      ? await transaction.coreFpsLobby.updateMany({
          data: {
            endedAt: now,
            status: "completed"
          },
          where: {
            id: {
              in: abandonedLobbyIds
            },
            status: {
              in: ["active", "waiting"]
            }
          }
        })
      : { count: 0 };
    const finalizableLobbies = await transaction.coreFpsLobby.findMany({
      include: {
        sessions: {
          select: {
            connectedAt: true,
            damage: true,
            deaths: true,
            displayNameSnapshot: true,
            flags: true,
            frags: true,
            score: true,
            userId: true
          }
        }
      },
      where: {
        endedAt: {
          gte: cutoffs.resultBackfill
        },
        startedAt: {
          not: null
        },
        status: "completed"
      }
    });
    const existingResults = finalizableLobbies.length
      ? await transaction.chatMessage.findMany({
          select: {
            mediaSourceId: true
          },
          where: {
            mediaSource: "core-fps-result",
            mediaSourceId: {
              in: finalizableLobbies.map((lobby) => lobby.id)
            }
          }
        })
      : [];
    const announcedLobbyIds = new Set(existingResults.map((message) => message.mediaSourceId).filter(Boolean));
    const messages: Array<{ id: string; roomId: string }> = [];
    let completedSessions = 0;

    for (const lobby of finalizableLobbies) {
      const closedSessions = await transaction.coreFpsSession.updateMany({
        data: {
          endedAt: lobby.endedAt ?? now,
          status: "completed"
        },
        where: {
          lobbyId: lobby.id,
          status: {
            in: ["active", "launched"]
          }
        }
      });
      completedSessions += closedSessions.count;

      if (announcedLobbyIds.has(lobby.id)) {
        continue;
      }

      const leaders = aggregateLeaders(lobby.sessions);
      const leader = leaders[0];

      if (!leader) {
        continue;
      }

      const message = await transaction.chatMessage.create({
        data: {
          body: buildCoreFpsResultBody({
            leader,
            mapName: lobby.mapName,
            modeName: lobby.modeName,
            playerCount: leaders.length
          }),
          kind: "core-fps",
          mediaSource: "core-fps-result",
          mediaSourceId: lobby.id,
          roomId: lobby.roomId,
          userId: leader.userId
        },
        select: {
          id: true,
          roomId: true
        }
      });
      messages.push(message);
      announcedLobbyIds.add(lobby.id);
    }

    return {
      completedLobbies: completedLobbies.count,
      completedSessions,
      resultMessages: messages,
      staleParticipants: staleParticipants.count,
      staleSessions: staleSessions.count
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
  });

  await Promise.allSettled(
    result.resultMessages.map((message) => publishChatRoomChanged(message.roomId, message.id))
  );

  return {
    completedLobbies: result.completedLobbies,
    completedSessions: result.completedSessions,
    resultMessages: result.resultMessages.length,
    staleParticipants: result.staleParticipants,
    staleSessions: result.staleSessions
  };
}
