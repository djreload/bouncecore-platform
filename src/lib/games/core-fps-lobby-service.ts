import { Prisma } from "@prisma/client";
import { getPublicChatPresence } from "@/lib/chat/chat-service";
import { prisma } from "@/lib/db/prisma";
import {
  buildCoreFpsMatchChoices,
  buildCoreFpsMatchVoteOptions,
  coreFpsModeDefinition,
  coreFpsLobbyIsReusable,
  coreFpsLobbyPresenceWindowMs,
  coreFpsLobbyShouldStart,
  coreFpsMatchChoiceId,
  normalizeCoreFpsMode,
  pickRandomCoreFpsMap,
  resolveCoreFpsMatchVote,
  shortenedCoreFpsLobbyDeadline
} from "@/lib/games/core-fps-lobby-core";
import {
  getPublicCoreFpsSettings,
  type CoreFpsSettings
} from "@/lib/games/core-fps-settings-service";

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

type CoreFpsLobbyVoteInput = {
  choiceId?: unknown;
  mapName?: unknown;
  modeName?: unknown;
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
          leftAt: null,
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
        modeName: candidate.modeName,
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
  settings: Pick<CoreFpsSettings, "mapPool" | "modePool">,
  now: Date
) {
  const participantCount = await transaction.coreFpsLobbyParticipant.count({
    where: {
      leftAt: null,
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

  if (participantCount === 0 && lobby.status !== "completed") {
    lobby = await transaction.coreFpsLobby.update({
      data: {
        endedAt: now,
        status: "completed"
      },
      where: {
        id: lobby.id
      }
    });
  }

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
    const votes = await transaction.coreFpsLobbyParticipant.findMany({
      select: {
        mapVote: true,
        modeVote: true
      },
      where: {
        leftAt: null,
        lastSeenAt: {
          gte: participantCutoff(now)
        },
        lobbyId
      }
    });
    const winningChoice = resolveCoreFpsMatchVote(
      buildCoreFpsMatchChoices(lobby.id, settings.mapPool, settings.modePool),
      votes,
      {
        mapName: lobby.mapName,
        modeName: lobby.modeName
      }
    );

    lobby = await transaction.coreFpsLobby.update({
      data: {
        mapName: winningChoice.mapName,
        modeName: winningChoice.modeName,
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
          modeName: coreFpsModeDefinition(settings.modePool[0]).id,
          roomId
        }
      });
    }

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
    const reconciled = await reconcileLobby(transaction, lobby.id, settings, now);

    return {
      id: reconciled.lobby.id,
      joinDeadline: reconciled.lobby.joinDeadline,
      mapName: reconciled.lobby.mapName,
      modeName: coreFpsModeDefinition(reconciled.lobby.modeName).id,
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
  const settings = await getPublicCoreFpsSettings();
  const reconciled = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bouncecore-core-fps-lobby:${lobbyId}`}))`;

    const participant = await transaction.coreFpsLobbyParticipant.updateMany({
      data: {
        lastSeenAt: now,
        leftAt: null
      },
      where: {
        lobbyId,
        leftAt: null,
        userId
      }
    });

    if (!participant.count) {
      throw new Error("Join this Core FPS lobby before viewing its status.");
    }

    const result = await reconcileLobby(transaction, lobbyId, settings, now);
    const participants = await transaction.coreFpsLobbyParticipant.findMany({
      orderBy: {
        joinedAt: "asc"
      },
      select: {
        joinedAt: true,
        lastSeenAt: true,
        mapVote: true,
        modeVote: true,
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
        leftAt: null,
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
  const currentParticipant = reconciled.participants.find((participant) => participant.user.id === userId);
  const matchChoices = buildCoreFpsMatchChoices(
    reconciled.lobby.id,
    settings.mapPool,
    settings.modePool
  );

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
    matchVotes: buildCoreFpsMatchVoteOptions(
      matchChoices,
      reconciled.participants,
      currentParticipant ?? null
    ),
    modeName: coreFpsModeDefinition(reconciled.lobby.modeName).id,
    participants: reconciled.participants.map((participant) => ({
      avatarUrl: participant.user.profile?.avatarUrl ?? null,
      displayName: participant.user.displayName,
      id: participant.user.id,
      joinedAt: participant.joinedAt.toISOString(),
      lastSeenAt: participant.lastSeenAt.toISOString()
    })),
    roomId: reconciled.lobby.roomId,
    startedAt: reconciled.lobby.startedAt?.toISOString() ?? null,
    status: reconciled.lobby.status as "active" | "completed" | "waiting",
    votingOpen: reconciled.lobby.status === "waiting"
  };
}

export async function castCoreFpsLobbyVote(
  lobbyId: string,
  userId: string,
  input: CoreFpsLobbyVoteInput
) {
  const settings = await getPublicCoreFpsSettings();
  const requestedChoiceId =
    typeof input.choiceId === "string" ? input.choiceId.trim().toLowerCase() : "";
  const legacyMapName =
    typeof input.mapName === "string" ? input.mapName.trim().toLowerCase() : "";
  const legacyModeName = normalizeCoreFpsMode(input.modeName);

  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bouncecore-core-fps-lobby:${lobbyId}`}))`;

    const lobby = await transaction.coreFpsLobby.findUnique({
      select: {
        id: true,
        status: true
      },
      where: {
        id: lobbyId
      }
    });

    if (!lobby || lobby.status !== "waiting") {
      throw new Error("Voting has closed for this match.");
    }
    const choices = buildCoreFpsMatchChoices(
      lobby.id,
      settings.mapPool,
      settings.modePool
    );
    const choiceId =
      requestedChoiceId ||
      (legacyMapName && legacyModeName
        ? coreFpsMatchChoiceId(legacyMapName, legacyModeName)
        : "");
    const choice = choices.find((candidate) => candidate.id === choiceId);

    if (!choice) {
      throw new Error("Choose one of the two match options shown in this lobby.");
    }

    const updated = await transaction.coreFpsLobbyParticipant.updateMany({
      data: {
        mapVote: choice.mapName,
        modeVote: choice.modeName,
        lastSeenAt: now
      },
      where: {
        leftAt: null,
        lobbyId,
        userId
      }
    });

    if (!updated.count) {
      throw new Error("Join this lobby before voting.");
    }
  });

  return getCoreFpsLobbyState(lobbyId, userId);
}

export async function leaveCoreFpsLobby(lobbyId: string, userId: string) {
  const now = new Date();
  const settings = await getPublicCoreFpsSettings();

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bouncecore-core-fps-lobby:${lobbyId}`}))`;
    const participant = await transaction.coreFpsLobbyParticipant.updateMany({
      data: {
        lastSeenAt: now,
        leftAt: now
      },
      where: {
        leftAt: null,
        lobbyId,
        userId
      }
    });

    if (!participant.count) {
      return {
        left: false,
        status: null
      };
    }

    const reconciled = await reconcileLobby(transaction, lobbyId, settings, now);

    return {
      left: true,
      status: reconciled.lobby.status as "active" | "completed" | "waiting"
    };
  });
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
          modeName: true,
          status: true
        }
      }
    },
    where: {
      id: input.sessionId,
      lobbyId: input.lobbyId,
      lobby: {
        participants: {
          some: {
            lastSeenAt: {
              gte: participantCutoff(new Date())
            },
            leftAt: null,
            userId: input.userId
          }
        },
        status: "active"
      },
      userId: input.userId
    }
  });

  if (!session?.lobby) {
    throw new Error("That Core FPS lobby has not started.");
  }

  return session.lobby;
}

export async function getCoreFpsLobbyForLaunch(lobbyId: string, userId: string) {
  const lobby = await prisma.coreFpsLobby.findFirst({
    select: {
      id: true,
      mapName: true,
      modeName: true
    },
    where: {
      id: lobbyId,
      participants: {
        some: {
          lastSeenAt: {
            gte: participantCutoff(new Date())
          },
          leftAt: null,
          userId
        }
      },
      status: "active"
    }
  });

  if (!lobby) {
    throw new Error("This Core FPS match has not started or your lobby presence expired.");
  }

  return lobby;
}
