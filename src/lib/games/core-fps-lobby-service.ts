import { Prisma } from "@prisma/client";
import { getPublicChatPresence } from "@/lib/chat/chat-service";
import { prisma } from "@/lib/db/prisma";
import {
  coreFpsLobbyIsReusable,
  coreFpsLobbyPresenceWindowMs,
  coreFpsLobbyShouldStart,
  pickRandomCoreFpsMap,
  shortenedCoreFpsLobbyDeadline
} from "@/lib/games/core-fps-lobby-core";
import { getPublicCoreFpsSettings } from "@/lib/games/core-fps-settings-service";

const reusableStatuses = ["active", "waiting"];

type CoreFpsLobbyUser = {
  displayName: string;
  id: string;
};

type JoinCoreFpsLobbyInput = {
  requestedLobbyId?: string | null;
  roomId?: string | null;
  user: CoreFpsLobbyUser;
};

function participantCutoff(now: Date) {
  return new Date(now.getTime() - coreFpsLobbyPresenceWindowMs);
}

async function findRoomId(transaction: Prisma.TransactionClient, roomId?: string | null) {
  if (roomId) {
    const requested = await transaction.chatRoom.findUnique({
      select: {
        id: true
      },
      where: {
        id: roomId
      }
    });

    if (requested) {
      return requested.id;
    }
  }

  const room = await transaction.chatRoom.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true
    },
    where: {
      OR: [
        {
          slug: "live"
        },
        {
          type: "live"
        }
      ]
    }
  });

  if (!room) {
    throw new Error("Create the live chat room before starting Core FPS.");
  }

  return room.id;
}

async function reusableLobby(
  transaction: Prisma.TransactionClient,
  now: Date,
  requestedLobbyId?: string | null
) {
  const where: Prisma.CoreFpsLobbyWhereInput = {
    status: {
      in: reusableStatuses
    }
  };

  if (requestedLobbyId) {
    where.id = requestedLobbyId;
  }

  const candidates = await transaction.coreFpsLobby.findMany({
    include: {
      participants: {
        select: {
          lastSeenAt: true
        },
        where: {
          lastSeenAt: {
            gte: participantCutoff(now)
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: requestedLobbyId ? 1 : 5,
    where
  });

  for (const candidate of candidates) {
    if (
      coreFpsLobbyIsReusable(
        {
          activeParticipantCount: candidate.participants.length,
          createdAt: candidate.createdAt,
          status: candidate.status
        },
        now
      )
    ) {
      return {
        createdAt: candidate.createdAt,
        createdById: candidate.createdById,
        endedAt: candidate.endedAt,
        id: candidate.id,
        joinDeadline: candidate.joinDeadline,
        mapName: candidate.mapName,
        roomId: candidate.roomId,
        startedAt: candidate.startedAt,
        status: candidate.status,
        updatedAt: candidate.updatedAt
      };
    }

    await transaction.coreFpsLobby.update({
      data: {
        endedAt: now,
        status: "completed"
      },
      where: {
        id: candidate.id
      }
    });
  }

  return null;
}

async function reconcileLobby(
  transaction: Prisma.TransactionClient,
  lobbyId: string,
  now: Date
) {
  const participantCount = await transaction.coreFpsLobbyParticipant.count({
    where: {
      lastSeenAt: {
        gte: participantCutoff(now)
      },
      lobbyId
    }
  });
  let lobby = await transaction.coreFpsLobby.findUniqueOrThrow({
    where: {
      id: lobbyId
    }
  });

  if (lobby.status === "waiting" && participantCount >= 2) {
    const shortenedDeadline = shortenedCoreFpsLobbyDeadline(lobby.joinDeadline, now);

    if (shortenedDeadline.getTime() !== lobby.joinDeadline.getTime()) {
      lobby = await transaction.coreFpsLobby.update({
        data: {
          joinDeadline: shortenedDeadline
        },
        where: {
          id: lobby.id
        }
      });
    }
  }

  if (participantCount > 0 && coreFpsLobbyShouldStart(lobby.status, lobby.joinDeadline, now)) {
    lobby = await transaction.coreFpsLobby.update({
      data: {
        startedAt: now,
        status: "active"
      },
      where: {
        id: lobby.id
      }
    });
  }

  return {
    lobby,
    participantCount
  };
}

export async function joinCoreFpsLobby(input: JoinCoreFpsLobbyInput) {
  const settings = await getPublicCoreFpsSettings();

  if (!settings.enabled || !settings.publicUrl) {
    throw new Error("Core FPS is currently unavailable.");
  }

  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bouncecore-core-fps-lobby'))`;

    let lobby = await reusableLobby(transaction, now, input.requestedLobbyId);

    if (!lobby && input.requestedLobbyId) {
      lobby = await reusableLobby(transaction, now);
    }

    if (!lobby) {
      const roomId = await findRoomId(transaction, input.roomId);
      lobby = await transaction.coreFpsLobby.create({
        data: {
          createdById: input.user.id,
          joinDeadline: new Date(now.getTime() + settings.lobbyWaitSeconds * 1000),
          mapName: pickRandomCoreFpsMap(settings.mapPool),
          roomId
        }
      });
    }

    const wasActive = lobby.status === "active";
    const participant = await transaction.coreFpsLobbyParticipant.upsert({
      create: {
        lastSeenAt: now,
        lobbyId: lobby.id,
        userId: input.user.id
      },
      update: {
        lastSeenAt: now,
        leftAt: null
      },
      where: {
        lobbyId_userId: {
          lobbyId: lobby.id,
          userId: input.user.id
        }
      }
    });
    const reconciled = await reconcileLobby(transaction, lobby.id, now);

    return {
      bootstrapMap: !wasActive,
      id: reconciled.lobby.id,
      joinDeadline: reconciled.lobby.joinDeadline,
      mapName: reconciled.lobby.mapName,
      participantCount: reconciled.participantCount,
      participantJoinedAt: participant.joinedAt,
      roomId: reconciled.lobby.roomId,
      startedAt: reconciled.lobby.startedAt,
      status: reconciled.lobby.status
    };
  });
}

export async function getCoreFpsLobbyState(lobbyId: string, userId: string) {
  const now = new Date();
  const reconciled = await prisma.$transaction(async (transaction) => {
    const participant = await transaction.coreFpsLobbyParticipant.updateMany({
      data: {
        lastSeenAt: now,
        leftAt: null
      },
      where: {
        lobbyId,
        userId
      }
    });

    if (!participant.count) {
      throw new Error("Join this Core FPS lobby before viewing its status.");
    }

    const result = await reconcileLobby(transaction, lobbyId, now);
    const participants = await transaction.coreFpsLobbyParticipant.findMany({
      orderBy: {
        joinedAt: "asc"
      },
      select: {
        joinedAt: true,
        lastSeenAt: true,
        user: {
          select: {
            displayName: true,
            id: true,
            profile: {
              select: {
                avatarUrl: true
              }
            }
          }
        }
      },
      where: {
        lastSeenAt: {
          gte: participantCutoff(now)
        },
        lobbyId
      }
    });

    return {
      lobby: result.lobby,
      participants
    };
  });
  const presenceUsers = await getPublicChatPresence(reconciled.lobby.roomId, userId);
  const participantIds = new Set(reconciled.participants.map((participant) => participant.user.id));

  return {
    availableInvitees: presenceUsers
      .filter((user) => user.status === "online" && !participantIds.has(user.id))
      .map((user) => ({
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        id: user.id
      })),
    id: reconciled.lobby.id,
    joinDeadline: reconciled.lobby.joinDeadline.toISOString(),
    mapName: reconciled.lobby.mapName,
    participants: reconciled.participants.map((participant) => ({
      avatarUrl: participant.user.profile?.avatarUrl ?? null,
      displayName: participant.user.displayName,
      id: participant.user.id,
      joinedAt: participant.joinedAt.toISOString(),
      lastSeenAt: participant.lastSeenAt.toISOString()
    })),
    roomId: reconciled.lobby.roomId,
    startedAt: reconciled.lobby.startedAt?.toISOString() ?? null,
    status: reconciled.lobby.status as "active" | "completed" | "waiting"
  };
}

export async function authorizeCoreFpsLobbySession(input: {
  lobbyId: string;
  sessionId: string;
  userId: string;
}) {
  const session = await prisma.coreFpsSession.findFirst({
    select: {
      lobby: {
        select: {
          id: true,
          mapName: true,
          status: true
        }
      }
    },
    where: {
      id: input.sessionId,
      lobbyId: input.lobbyId,
      userId: input.userId
    }
  });

  if (!session?.lobby || session.lobby.status !== "active") {
    throw new Error("That Core FPS lobby has not started.");
  }

  return session.lobby;
}
