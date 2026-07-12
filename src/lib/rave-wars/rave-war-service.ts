import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { chatPresenceOnlineMs } from "@/lib/chat/chat-presence-core";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { assertUserCanPostInChat } from "@/lib/chat/moderation-service";
import { prisma } from "@/lib/db/prisma";
import {
  appendTerrainCrater,
  raveWarMaxTerrainCraters,
  settlePlayerOnTerrain,
  settlePlayersOnTerrain,
  simulateRaveWarShot
} from "@/lib/rave-wars/rave-war-engine";
import { getRaveWarLevel, type RaveWarLevel } from "@/lib/rave-wars/levels/bazooka-battlefield";
import { publishRaveWarChanged } from "@/lib/rave-wars/rave-war-realtime";
import {
  defaultRaveWarSettings,
  normalizeRaveWarSettings,
  normalizeRaveWarSettingsInput,
  remainingRaveWarCooldownSeconds,
  type RaveWarSettings,
  type RaveWarSettingsInput
} from "@/lib/rave-wars/rave-war-settings";
import {
  raveWarWeaponIds,
  raveWarStatuses,
  type RaveWarChallengeSummary,
  type RaveWarLastShot,
  type RaveWarParticipantSummary,
  type RaveWarPlayerState,
  type RaveWarState,
  type RaveWarStatus,
  type RaveWarSummary,
  type RaveWarTerrainCrater,
  type RaveWarWeaponId
} from "@/lib/rave-wars/rave-war-types";

const raveWarSettingsKey = "chat.rave_wars";
const raveWarHealth = 100;
const raveWarMaxLogEntries = 8;
const explosionRadius = 150;
const raveWarTurnSeconds = 45;
const raveWarTurnMovement = 220;
const raveWarMoveStep = 34;

type RaveWarParticipantSource = {
  acceptedAt: Date | null;
  displayNameSnapshot: string;
  playerIndex: number;
  userId: string;
};

type RaveWarSummarySource = {
  acceptedAt: Date | null;
  challengerId: string;
  createdAt: Date;
  endedAt: Date | null;
  expiresAt: Date;
  id: string;
  levelKey: string;
  participants: RaveWarParticipantSource[];
  room: {
    id: string;
    name: string;
    slug: string;
  };
  roomId: string;
  startedAt: Date | null;
  state: Prisma.JsonValue;
  status: string;
  targetId: string;
  turnUserId: string | null;
  winnerUserId: string | null;
};

export type RaveWarReadiness = {
  effectiveCostStars: number;
  enabled: boolean;
  latestChallengeAt: string | null;
  remainingCooldownSeconds: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compactLog(entries: string[]) {
  return entries.slice(-raveWarMaxLogEntries);
}

function normalizeRaveWarStatus(value: string): RaveWarStatus {
  return raveWarStatuses.includes(value as RaveWarStatus) ? (value as RaveWarStatus) : "pending";
}

function normalizeShotNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function normalizeWeaponId(value: unknown): RaveWarWeaponId {
  return raveWarWeaponIds.includes(value as RaveWarWeaponId) ? (value as RaveWarWeaponId) : "bazooka";
}

function turnWindow(now = new Date()) {
  return {
    turnEndsAt: new Date(now.getTime() + raveWarTurnSeconds * 1000).toISOString(),
    turnStartedAt: now.toISOString()
  };
}

function isTurnExpired(state: Pick<RaveWarState, "turnEndsAt">, now = new Date()) {
  return Boolean(state.turnEndsAt && new Date(state.turnEndsAt).getTime() <= now.getTime());
}

function participantDisplayName(participant: RaveWarParticipantSource | null | undefined) {
  return participant?.displayNameSnapshot.trim() || "Raver";
}

function createInitialState(input: {
  activeUserId: string | null;
  level: RaveWarLevel;
  players: Array<{
    displayName: string;
    playerIndex: number;
    userId: string;
  }>;
}): RaveWarState {
  const colors = ["#00d5ff", "#ff3fa4"] as const;

  return {
    activeUserId: input.activeUserId,
    craters: [],
    lastShot: null,
    levelKey: input.level.key,
    log: ["Challenge created."],
    players: input.players.map((player) => {
      const spawn = input.level.spawns[player.playerIndex] ?? input.level.spawns[0];

      return {
        angle: 80,
        color: colors[player.playerIndex] ?? "#a3ff12",
        displayName: player.displayName,
        facing: spawn.facing,
        health: raveWarHealth,
        movementLeft: raveWarTurnMovement,
        playerIndex: player.playerIndex,
        power: 65,
        selectedWeapon: "bazooka",
        userId: player.userId,
        x: spawn.x,
        y: spawn.y
      };
    }),
    turnEndsAt: null,
    turnNumber: 1,
    turnStartedAt: null,
    version: 1,
    winnerUserId: null
  };
}

function normalizeTerrainCrater(value: unknown): RaveWarTerrainCrater | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    radius: normalizeShotNumber(value.radius, explosionRadius, 24, 240),
    x: normalizeShotNumber(value.x, 0, -4096, 8192),
    y: normalizeShotNumber(value.y, 0, -4096, 8192)
  };
}

function normalizePlayerState(value: unknown): RaveWarPlayerState | null {
  if (!isObject(value)) {
    return null;
  }

  const userId = typeof value.userId === "string" ? value.userId : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "Raver";

  if (!userId) {
    return null;
  }

  return {
    angle: normalizeShotNumber(value.angle, 80, 0, 90),
    color: typeof value.color === "string" ? value.color : "#00d5ff",
    displayName,
    facing: value.facing === "left" ? "left" : "right",
    health: normalizeShotNumber(value.health, raveWarHealth, 0, raveWarHealth),
    movementLeft: normalizeShotNumber(value.movementLeft, raveWarTurnMovement, 0, raveWarTurnMovement),
    playerIndex: normalizeShotNumber(value.playerIndex, 0, 0, 7),
    power: normalizeShotNumber(value.power, 65, 10, 100),
    selectedWeapon: normalizeWeaponId(value.selectedWeapon),
    userId,
    x: normalizeShotNumber(value.x, 0, 0, 4096),
    y: normalizeShotNumber(value.y, 0, 0, 4096)
  };
}

function normalizeShotPath(value: unknown): RaveWarLastShot | null {
  if (!isObject(value) || !Array.isArray(value.path)) {
    return null;
  }

  const shooterUserId = typeof value.shooterUserId === "string" ? value.shooterUserId : "";
  const targetUserId = typeof value.targetUserId === "string" ? value.targetUserId : "";

  if (!shooterUserId || !targetUserId) {
    return null;
  }

  return {
    angle: normalizeShotNumber(value.angle, 80, 0, 90),
    blastRadius: normalizeShotNumber(value.blastRadius, explosionRadius, 24, 240),
    crater: normalizeTerrainCrater(value.crater),
    damage: normalizeShotNumber(value.damage, 0, 0, raveWarHealth),
    distance: normalizeShotNumber(value.distance, explosionRadius, 0, 5000),
    firedAt: typeof value.firedAt === "string" ? value.firedAt : new Date().toISOString(),
    impactKind:
      value.impactKind === "terrain" || value.impactKind === "hog" || value.impactKind === "out-of-bounds"
        ? value.impactKind
        : "out-of-bounds",
    impactPoint: isObject(value.impactPoint)
      ? {
          x: normalizeShotNumber(value.impactPoint.x, 0, -4096, 8192),
          y: normalizeShotNumber(value.impactPoint.y, 0, -4096, 8192)
        }
      : {
          x: 0,
          y: 0
        },
    path: value.path
      .filter(isObject)
      .map((point) => ({
        x: normalizeShotNumber(point.x, 0, -4096, 8192),
        y: normalizeShotNumber(point.y, 0, -4096, 8192)
      }))
      .slice(0, 140),
    power: normalizeShotNumber(value.power, 65, 10, 100),
    shooterUserId,
    targetUserId,
    weaponId: normalizeWeaponId(value.weaponId)
  };
}

function normalizeRaveWarState(value: Prisma.JsonValue, participants: RaveWarParticipantSource[], level: RaveWarLevel): RaveWarState {
  if (!isObject(value) || !Array.isArray(value.players)) {
    return createInitialState({
      activeUserId: participants[0]?.userId ?? null,
      level,
      players: participants
        .sort((first, second) => first.playerIndex - second.playerIndex)
        .map((participant) => ({
          displayName: participantDisplayName(participant),
          playerIndex: participant.playerIndex,
          userId: participant.userId
        }))
    });
  }

  const players = value.players.map(normalizePlayerState).filter((player): player is RaveWarPlayerState => Boolean(player));

  return {
    activeUserId: typeof value.activeUserId === "string" ? value.activeUserId : null,
    craters: Array.isArray(value.craters)
      ? value.craters.map(normalizeTerrainCrater).filter((crater): crater is RaveWarTerrainCrater => Boolean(crater)).slice(-raveWarMaxTerrainCraters)
      : [],
    lastShot: normalizeShotPath(value.lastShot),
    levelKey: typeof value.levelKey === "string" ? value.levelKey : level.key,
    log: Array.isArray(value.log) ? value.log.filter((entry): entry is string => typeof entry === "string").slice(-raveWarMaxLogEntries) : [],
    players,
    turnEndsAt: typeof value.turnEndsAt === "string" ? value.turnEndsAt : null,
    turnNumber: normalizeShotNumber(value.turnNumber, 1, 1, 999),
    turnStartedAt: typeof value.turnStartedAt === "string" ? value.turnStartedAt : null,
    version: 1,
    winnerUserId: typeof value.winnerUserId === "string" ? value.winnerUserId : null
  };
}

function toParticipantSummary(participant: RaveWarParticipantSource): RaveWarParticipantSummary {
  return {
    acceptedAt: participant.acceptedAt?.toISOString() ?? null,
    displayName: participantDisplayName(participant),
    playerIndex: participant.playerIndex,
    userId: participant.userId
  };
}

function currentUserRole(war: Pick<RaveWarSummarySource, "challengerId" | "targetId">, currentUserId: string) {
  if (war.challengerId === currentUserId) {
    return "challenger";
  }

  if (war.targetId === currentUserId) {
    return "target";
  }

  return "spectator";
}

function toWarSummary(war: RaveWarSummarySource, currentUserId: string): RaveWarSummary {
  const level = getRaveWarLevel(war.levelKey);

  return {
    acceptedAt: war.acceptedAt?.toISOString() ?? null,
    challengerId: war.challengerId,
    createdAt: war.createdAt.toISOString(),
    currentUserRole: currentUserRole(war, currentUserId),
    endedAt: war.endedAt?.toISOString() ?? null,
    expiresAt: war.expiresAt.toISOString(),
    id: war.id,
    level,
    participants: war.participants
      .slice()
      .sort((first, second) => first.playerIndex - second.playerIndex)
      .map(toParticipantSummary),
    roomId: war.roomId,
    roomName: war.room.name,
    roomSlug: war.room.slug,
    startedAt: war.startedAt?.toISOString() ?? null,
    state: normalizeRaveWarState(war.state, war.participants, level),
    status: normalizeRaveWarStatus(war.status),
    targetId: war.targetId,
    turnUserId: war.turnUserId,
    winnerUserId: war.winnerUserId
  };
}

function toChallengeSummary(war: RaveWarSummarySource, currentUserId: string): RaveWarChallengeSummary {
  const participantsById = new Map(war.participants.map((participant) => [participant.userId, participantDisplayName(participant)]));

  return {
    challengerDisplayName: participantsById.get(war.challengerId) ?? "Someone",
    createdAt: war.createdAt.toISOString(),
    currentUserRole: war.challengerId === currentUserId ? "challenger" : "target",
    expiresAt: war.expiresAt.toISOString(),
    id: war.id,
    levelName: getRaveWarLevel(war.levelKey).name,
    roomSlug: war.room.slug,
    status: normalizeRaveWarStatus(war.status),
    targetDisplayName: participantsById.get(war.targetId) ?? "Someone"
  };
}

async function nextEventSequence(tx: Prisma.TransactionClient, warId: string) {
  const latest = await tx.raveWarEvent.findFirst({
    where: {
      warId
    },
    orderBy: {
      sequence: "desc"
    },
    select: {
      sequence: true
    }
  });

  return (latest?.sequence ?? 0) + 1;
}

async function expireStaleRaveWarChallenges() {
  await prisma.raveWar.updateMany({
    where: {
      expiresAt: {
        lt: new Date()
      },
      status: "pending"
    },
    data: {
      endedAt: new Date(),
      status: "expired"
    }
  });
}

export async function getRaveWarSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: raveWarSettingsKey
    }
  });

  return normalizeRaveWarSettings(setting?.value);
}

export async function updateRaveWarSettings(input: RaveWarSettingsInput, actorId: string) {
  const settings = normalizeRaveWarSettingsInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: raveWarSettingsKey
    },
    update: {
      description: "Private livestream chat Rave War mini-game settings.",
      isSecret: false,
      value: settings
    },
    create: {
      key: raveWarSettingsKey,
      description: "Private livestream chat Rave War mini-game settings.",
      isSecret: false,
      value: settings
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.rave_war.settings.update",
    target: `app-setting:${raveWarSettingsKey}`,
    severity: "info",
    metadata: settings
  });

  return settings;
}

export async function getRaveWarReadiness(userId?: string | null, providedSettings?: RaveWarSettings): Promise<RaveWarReadiness> {
  const settings = providedSettings ?? (await getRaveWarSettings());

  if (!userId) {
    return {
      effectiveCostStars: settings.costStars,
      enabled: settings.enabled,
      latestChallengeAt: null,
      remainingCooldownSeconds: 0
    };
  }

  const latestChallenge = await prisma.raveWar.findFirst({
    where: {
      challengerId: userId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true
    }
  });

  return {
    effectiveCostStars: settings.costStars,
    enabled: settings.enabled,
    latestChallengeAt: latestChallenge?.createdAt.toISOString() ?? null,
    remainingCooldownSeconds: remainingRaveWarCooldownSeconds(latestChallenge?.createdAt, settings.cooldownSeconds)
  };
}

async function resolveActiveChallengeTarget(challengerId: string, targetUserId: string) {
  if (challengerId === targetUserId) {
    throw new Error("Choose someone else for a Rave War.");
  }

  const target = await prisma.user.findUnique({
    where: {
      id: targetUserId
    },
    select: {
      displayName: true,
      emailVerifiedAt: true,
      id: true,
      status: true
    }
  });

  if (!target?.emailVerifiedAt || target.status !== "active") {
    throw new Error("That chatter is not available for Rave Wars.");
  }

  const activeTargetSession = await prisma.authSession.findFirst({
    where: {
      expiresAt: {
        gt: new Date()
      },
      revokedAt: null,
      updatedAt: {
        gte: new Date(Date.now() - chatPresenceOnlineMs)
      },
      userId: target.id
    },
    select: {
      id: true
    }
  });

  if (!activeTargetSession) {
    throw new Error("Rave Wars can only target users who are online and active right now.");
  }

  return target;
}

async function getWarForUserRecord(warId: string, userId: string) {
  return prisma.raveWar.findFirst({
    where: {
      id: warId,
      participants: {
        some: {
          userId
        }
      }
    },
    include: {
      participants: {
        orderBy: {
          playerIndex: "asc"
        }
      },
      room: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });
}

async function writeWarEvent(
  tx: Prisma.TransactionClient,
  input: {
    payload?: Prisma.InputJsonValue;
    type: string;
    userId?: string | null;
    warId: string;
  }
) {
  const sequence = await nextEventSequence(tx, input.warId);

  return tx.raveWarEvent.create({
    data: {
      payload: input.payload ?? Prisma.JsonNull,
      sequence,
      type: input.type,
      userId: input.userId ?? null,
      warId: input.warId
    }
  });
}

export async function createRaveWarChallenge(roomId: string, challengerId: string, targetUserId: string) {
  await expireStaleRaveWarChallenges();
  const settings = await getRaveWarSettings();

  if (!settings.enabled) {
    throw new Error("Rave Wars are currently disabled.");
  }

  await assertUserCanPostInChat(challengerId, roomId);

  const [room, challenger, target, latestChallenge] = await Promise.all([
    prisma.chatRoom.findUniqueOrThrow({
      where: {
        id: roomId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),
    prisma.user.findUniqueOrThrow({
      where: {
        id: challengerId
      },
      select: {
        displayName: true,
        id: true
      }
    }),
    resolveActiveChallengeTarget(challengerId, targetUserId),
    prisma.raveWar.findFirst({
      where: {
        challengerId
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true
      }
    })
  ]);
  const remainingCooldown = remainingRaveWarCooldownSeconds(latestChallenge?.createdAt, settings.cooldownSeconds);

  if (remainingCooldown > 0) {
    throw new Error(`Rave War cooldown is active. Wait ${remainingCooldown} more second${remainingCooldown === 1 ? "" : "s"}.`);
  }

  const existing = await prisma.raveWar.findFirst({
    where: {
      expiresAt: {
        gt: new Date()
      },
      roomId,
      status: {
        in: ["pending", "active"]
      },
      OR: [
        {
          challengerId,
          targetId: target.id
        },
        {
          challengerId: target.id,
          targetId: challengerId
        }
      ]
    },
    select: {
      id: true,
      status: true
    }
  });

  if (existing) {
    throw new Error(existing.status === "active" ? "You already have an active Rave War with that chatter." : "A Rave War challenge is already pending.");
  }

  const level = getRaveWarLevel("bazooka-battlefield");
  const state = createInitialState({
    activeUserId: null,
    level,
    players: [
      {
        displayName: challenger.displayName,
        playerIndex: 0,
        userId: challenger.id
      },
      {
        displayName: target.displayName,
        playerIndex: 1,
        userId: target.id
      }
    ]
  });
  const expiresAt = new Date(Date.now() + settings.challengeTtlSeconds * 1000);
  const seed = randomUUID();
  const result = await prisma.$transaction(async (tx) => {
    if (settings.costStars > 0) {
      const wallet = await tx.starWallet.upsert({
        where: {
          userId: challenger.id
        },
        update: {},
        create: {
          balance: 0,
          userId: challenger.id
        }
      });

      if (wallet.balance < settings.costStars) {
        throw new Error(`You need ${settings.costStars.toLocaleString("en-GB")} stars to start a Rave War.`);
      }

      const updatedWallet = await tx.starWallet.updateMany({
        where: {
          id: wallet.id,
          balance: {
            gte: settings.costStars
          }
        },
        data: {
          balance: {
            decrement: settings.costStars
          }
        }
      });

      if (updatedWallet.count !== 1) {
        throw new Error(`You need ${settings.costStars.toLocaleString("en-GB")} stars to start a Rave War.`);
      }
    }

    const war = await tx.raveWar.create({
      data: {
        challengerId: challenger.id,
        expiresAt,
        levelKey: level.key,
        roomId: room.id,
        seed,
        state: state as Prisma.InputJsonValue,
        targetId: target.id,
        participants: {
          create: [
            {
              displayNameSnapshot: challenger.displayName,
              playerIndex: 0,
              userId: challenger.id
            },
            {
              displayNameSnapshot: target.displayName,
              playerIndex: 1,
              userId: target.id
            }
          ]
        }
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      payload: {
        challengerDisplayName: challenger.displayName,
        targetDisplayName: target.displayName
      },
      type: "challenge.created",
      userId: challenger.id,
      warId: war.id
    });
    const toastMessage = await tx.chatMessage.create({
      data: {
        body: `${challenger.displayName} challenged ${target.displayName} to a Rave War.`,
        kind: "rave-war",
        mediaSource: "rave-war",
        mediaSourceId: war.id,
        roomId: room.id,
        userId: challenger.id
      }
    });

    await tx.notification.create({
      data: {
        actionUrl: `/rave-wars/${war.id}`,
        body: `Open the private arena from #${room.slug}.`,
        dedupeKey: `chat.rave_war.challenge:${war.id}:user:${target.id}`,
        title: `${challenger.displayName} challenged you to a Rave War`,
        type: "chat.rave_war.challenge",
        userId: target.id
      }
    });

    return {
      event,
      toastMessage,
      war
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.challenge.create",
    actorId: challenger.id,
    metadata: {
      costStars: settings.costStars,
      roomSlug: room.slug,
      targetUserId: target.id,
      toastMessageId: result.toastMessage.id
    },
    severity: "info",
    target: `rave-war:${result.war.id}`
  });
  await publishChatRoomChanged(room.id, result.toastMessage.id);
  await publishRaveWarChanged(result.war.id, result.event.id);

  return toWarSummary(result.war, challenger.id);
}

export { defaultRaveWarSettings };

export async function getRaveWarForUser(warId: string, userId: string) {
  await expireStaleRaveWarChallenges();

  const war = await getWarForUserRecord(warId, userId);

  if (!war) {
    throw new Error("Rave War not found.");
  }

  await prisma.raveWarParticipant.updateMany({
    where: {
      userId,
      warId: war.id
    },
    data: {
      lastSeenAt: new Date()
    }
  });

  return toWarSummary(war, userId);
}

export async function getPendingRaveWarChallenges(userId: string) {
  await expireStaleRaveWarChallenges();

  const wars = await prisma.raveWar.findMany({
    where: {
      OR: [
        {
          challengerId: userId
        },
        {
          targetId: userId
        }
      ],
      status: {
        in: ["pending", "active"]
      }
    },
    include: {
      participants: {
        orderBy: {
          playerIndex: "asc"
        }
      },
      room: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  return wars.map((war) => toChallengeSummary(war, userId));
}

export async function acceptRaveWarChallenge(warId: string, userId: string) {
  await expireStaleRaveWarChallenges();

  const war = await getWarForUserRecord(warId, userId);

  if (!war || war.targetId !== userId) {
    throw new Error("That Rave War challenge is not available.");
  }

  if (war.status !== "pending" || war.expiresAt <= new Date()) {
    throw new Error("That Rave War challenge has expired.");
  }

  const level = getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);
  const now = new Date();
  const nextTurnWindow = turnWindow(now);
  const activeState = {
    ...state,
    activeUserId: war.challengerId,
    log: compactLog([...state.log, "Challenge accepted. Rave War started."]),
    players: state.players.map((player) =>
      player.userId === war.challengerId
        ? {
            ...player,
            movementLeft: raveWarTurnMovement
          }
        : player
    ),
    ...nextTurnWindow
  } satisfies RaveWarState;
  const result = await prisma.$transaction(async (tx) => {
    await tx.raveWarParticipant.update({
      where: {
        warId_userId: {
          userId,
          warId
        }
      },
      data: {
        acceptedAt: now,
        lastSeenAt: now
      }
    });
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        acceptedAt: now,
        startedAt: now,
        state: activeState as Prisma.InputJsonValue,
        status: "active",
        turnUserId: war.challengerId
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      type: "challenge.accepted",
      userId,
      warId
    });
    const challenger = updatedWar.participants.find((participant) => participant.userId === updatedWar.challengerId);
    const target = updatedWar.participants.find((participant) => participant.userId === updatedWar.targetId);
    const message = await tx.chatMessage.create({
      data: {
        body: `${participantDisplayName(target ?? updatedWar.participants[1])} accepted ${participantDisplayName(challenger ?? updatedWar.participants[0])}'s Rave War.`,
        kind: "rave-war",
        mediaSource: "rave-war",
        mediaSourceId: updatedWar.id,
        roomId: updatedWar.roomId,
        userId
      }
    });

    return {
      event,
      message,
      war: updatedWar
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.challenge.accept",
    actorId: userId,
    severity: "info",
    target: `rave-war:${warId}`
  });
  await publishChatRoomChanged(result.war.roomId, result.message.id);
  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}

export async function declineRaveWarChallenge(warId: string, userId: string) {
  const war = await getWarForUserRecord(warId, userId);

  if (!war || war.targetId !== userId) {
    throw new Error("That Rave War challenge is not available.");
  }

  if (war.status !== "pending") {
    throw new Error("That Rave War challenge can no longer be declined.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        endedAt: new Date(),
        status: "declined"
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      type: "challenge.declined",
      userId,
      warId
    });

    return {
      event,
      war: updatedWar
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.challenge.decline",
    actorId: userId,
    severity: "info",
    target: `rave-war:${warId}`
  });
  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}

export async function cancelRaveWarChallenge(warId: string, userId: string) {
  const war = await getWarForUserRecord(warId, userId);

  if (!war || war.challengerId !== userId) {
    throw new Error("That Rave War challenge is not available.");
  }

  if (war.status !== "pending") {
    throw new Error("That Rave War challenge can no longer be cancelled.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        endedAt: new Date(),
        status: "cancelled"
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      type: "challenge.cancelled",
      userId,
      warId
    });

    return {
      event,
      war: updatedWar
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.challenge.cancel",
    actorId: userId,
    severity: "info",
    target: `rave-war:${warId}`
  });
  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}

export async function moveRaveWarPlayer(warId: string, userId: string, input: { direction: unknown }) {
  const war = await getWarForUserRecord(warId, userId);

  if (!war) {
    throw new Error("Rave War not found.");
  }

  if (war.status !== "active") {
    throw new Error("That Rave War is not active.");
  }

  if (war.turnUserId !== userId) {
    throw new Error("Wait for your Rave War turn.");
  }

  const direction = input.direction === "left" ? "left" : input.direction === "right" ? "right" : null;

  if (!direction) {
    throw new Error("Choose a valid movement direction.");
  }

  const level = getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);

  if (isTurnExpired(state)) {
    throw new Error("Your Rave War turn timer expired.");
  }

  const mover = state.players.find((player) => player.userId === userId);

  if (!mover || mover.health <= 0) {
    throw new Error("Rave War player is not ready.");
  }

  if (mover.movementLeft <= 0) {
    throw new Error("No movement left this turn.");
  }

  const directionAmount = direction === "left" ? -1 : 1;
  const step = Math.min(raveWarMoveStep, mover.movementLeft);
  const nextX = Math.round(clamp(mover.x + directionAmount * step, 42, level.width - 42));
  const distanceMoved = Math.abs(nextX - mover.x);
  const nextPlayers = state.players.map((player) => {
    if (player.userId !== userId) {
      return player;
    }

    return settlePlayerOnTerrain(level, state.craters, {
      ...player,
      facing: direction,
      movementLeft: Math.max(0, player.movementLeft - distanceMoved),
      x: nextX
    });
  });
  const nextState: RaveWarState = {
    ...state,
    log: compactLog([...state.log, `${mover.displayName} moved ${direction}.`]),
    players: nextPlayers
  };
  const result = await prisma.$transaction(async (tx) => {
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        state: nextState as Prisma.InputJsonValue
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      payload: {
        direction,
        x: nextX
      },
      type: "player.moved",
      userId,
      warId
    });

    return {
      event,
      war: updatedWar
    };
  });

  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}

export async function fireRaveWarShot(warId: string, userId: string, input: { angle: unknown; facing?: unknown; power: unknown; weaponId?: unknown }) {
  const war = await getWarForUserRecord(warId, userId);

  if (!war) {
    throw new Error("Rave War not found.");
  }

  if (war.status !== "active") {
    throw new Error("That Rave War is not active.");
  }

  if (war.turnUserId !== userId) {
    throw new Error("Wait for your Rave War turn.");
  }

  const level = getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);

  if (isTurnExpired(state)) {
    throw new Error("Your Rave War turn timer expired.");
  }

  const shooter = state.players.find((player) => player.userId === userId);
  const target = state.players.find((player) => player.userId !== userId && player.health > 0);

  if (!shooter || !target) {
    throw new Error("Rave War players are not ready.");
  }

  const angle = normalizeShotNumber(input.angle, shooter.angle, 0, 90);
  const power = normalizeShotNumber(input.power, shooter.power, 10, 100);
  const weaponId = normalizeWeaponId(input.weaponId ?? shooter.selectedWeapon);
  const facing = input.facing === "left" || input.facing === "right" ? input.facing : shooter.facing;
  const shooterForShot: RaveWarPlayerState = {
    ...shooter,
    angle,
    facing,
    power,
    selectedWeapon: weaponId
  };
  const shot = simulateRaveWarShot({
    angle,
    craters: state.craters,
    level,
    power,
    shooter: shooterForShot,
    target,
    weaponId
  });
  const nextCraters = appendTerrainCrater(state.craters, shot.crater);
  const damagedPlayers = state.players.map((player) => {
    if (player.userId === shooter.userId) {
      return {
        ...player,
        angle,
        facing,
        power,
        selectedWeapon: weaponId
      };
    }

    if (player.userId === target.userId) {
      return {
        ...player,
        health: Math.max(0, player.health - shot.damage)
      };
    }

    return player;
  });
  const settledPlayers = settlePlayersOnTerrain(level, nextCraters, damagedPlayers);
  const updatedTarget = settledPlayers.find((player) => player.userId === target.userId);
  const winnerUserId = updatedTarget && updatedTarget.health <= 0 ? shooter.userId : null;
  const nextPlayers = settledPlayers.map((player) =>
    !winnerUserId && player.userId === target.userId
      ? {
          ...player,
          movementLeft: raveWarTurnMovement
        }
      : player
  );
  const activeUserId = winnerUserId ? null : target.userId;
  const firedAt = new Date().toISOString();
  const nextTurnWindow = winnerUserId ? { turnEndsAt: null, turnStartedAt: null } : turnWindow(new Date(firedAt));
  const lastShot: RaveWarLastShot = {
    angle,
    blastRadius: shot.blastRadius,
    crater: shot.crater,
    damage: shot.damage,
    distance: shot.distance,
    firedAt,
    impactKind: shot.impactKind,
    impactPoint: shot.impactPoint,
    path: shot.path,
    power,
    shooterUserId: shooter.userId,
    targetUserId: target.userId,
    weaponId
  };
  const nextState: RaveWarState = {
    ...state,
    activeUserId,
    craters: nextCraters,
    lastShot,
    log: compactLog([
      ...state.log,
      shot.damage > 0
        ? `${shooter.displayName} hit ${target.displayName} for ${shot.damage} damage.`
        : shot.impactKind === "terrain"
          ? `${shooter.displayName}'s bazooka hit the terrain.`
          : `${shooter.displayName} fired and missed.`
    ]),
    players: nextPlayers,
    ...nextTurnWindow,
    turnNumber: state.turnNumber + 1,
    winnerUserId
  };
  const result = await prisma.$transaction(async (tx) => {
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        endedAt: winnerUserId ? new Date() : null,
        state: nextState as Prisma.InputJsonValue,
        status: winnerUserId ? "finished" : "active",
        turnUserId: activeUserId,
        winnerUserId
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      payload: lastShot as unknown as Prisma.InputJsonValue,
      type: "shot.fired",
      userId,
      warId
    });

    return {
      event,
      war: updatedWar
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.shot.fire",
    actorId: userId,
    metadata: {
      damage: shot.damage,
      distance: shot.distance,
      winnerUserId
    },
    severity: "info",
    target: `rave-war:${warId}`
  });
  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}

export async function surrenderRaveWar(warId: string, userId: string) {
  const war = await getWarForUserRecord(warId, userId);

  if (!war) {
    throw new Error("Rave War not found.");
  }

  if (war.status !== "active") {
    throw new Error("That Rave War is not active.");
  }

  const level = getRaveWarLevel(war.levelKey);
  const state = normalizeRaveWarState(war.state, war.participants, level);
  const winner = state.players.find((player) => player.userId !== userId);

  if (!winner) {
    throw new Error("Rave War winner could not be determined.");
  }

  const nextState: RaveWarState = {
    ...state,
    activeUserId: null,
    log: compactLog([...state.log, `${state.players.find((player) => player.userId === userId)?.displayName ?? "A raver"} surrendered.`]),
    turnEndsAt: null,
    turnStartedAt: null,
    winnerUserId: winner.userId
  };
  const result = await prisma.$transaction(async (tx) => {
    const updatedWar = await tx.raveWar.update({
      where: {
        id: warId
      },
      data: {
        endedAt: new Date(),
        state: nextState as Prisma.InputJsonValue,
        status: "finished",
        turnUserId: null,
        winnerUserId: winner.userId
      },
      include: {
        participants: {
          orderBy: {
            playerIndex: "asc"
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });
    const event = await writeWarEvent(tx, {
      type: "player.surrendered",
      userId,
      warId
    });

    return {
      event,
      war: updatedWar
    };
  });

  await writeAuditLog({
    action: "chat.rave_war.surrender",
    actorId: userId,
    metadata: {
      winnerUserId: winner.userId
    },
    severity: "info",
    target: `rave-war:${warId}`
  });
  await publishRaveWarChanged(warId, result.event.id);

  return toWarSummary(result.war, userId);
}
