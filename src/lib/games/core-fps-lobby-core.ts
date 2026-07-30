export const coreFpsGameModes = [
  {
    description: "Every player for themselves. Highest frag count wins.",
    displayName: "Free For All",
    id: "ffa",
    runtimeAlias: "lobby"
  },
  {
    description: "Red and blue teams compete for the highest combined frag count.",
    displayName: "Team Deathmatch",
    id: "teamplay",
    runtimeAlias: "lobby-tdm"
  },
  {
    description: "Steal the opposing Bouncecore flag and return it to your base.",
    displayName: "Capture the Flag",
    id: "ctf",
    runtimeAlias: "lobby-ctf"
  }
] as const;
export const coreFpsMapDefinitions = [
  {
    displayName: "Neon Vault",
    id: "neonvault",
    supportedModes: ["ffa", "teamplay", "ctf"]
  },
  {
    displayName: "Complex",
    id: "complex",
    supportedModes: ["ffa", "teamplay"]
  },
  {
    displayName: "Dust 2",
    id: "dust2",
    supportedModes: ["ffa", "teamplay", "ctf"]
  },
  {
    displayName: "Turbine",
    id: "turbine",
    supportedModes: ["ffa", "teamplay"]
  },
  {
    displayName: "XMW Hub",
    id: "xmwhub",
    supportedModes: ["ffa", "teamplay", "ctf"]
  }
] as const;
export const coreFpsAvailableMaps = coreFpsMapDefinitions.map((map) => map.id);
export const coreFpsMapCatalogVersion = 2;
export const coreFpsDefaultLobbyWaitSeconds = 30;
export const coreFpsMinimumLobbyWaitSeconds = 10;
export const coreFpsMaximumLobbyWaitSeconds = 180;
export const coreFpsReadyCountdownSeconds = 8;
export const coreFpsLobbyPresenceWindowMs = 90_000;
export const coreFpsLobbyMaximumAgeMs = 2 * 60 * 60 * 1000;

export type CoreFpsLobbyStatus = "active" | "completed" | "waiting";
export type CoreFpsGameMode = (typeof coreFpsGameModes)[number]["id"];

export type CoreFpsMatchVoteOption = {
  description: string;
  id: string;
  mapDisplayName: string;
  mapName: string;
  modeDisplayName: string;
  modeName: CoreFpsGameMode;
  previewImageUrl: string;
  selected: boolean;
  votes: number;
};

export type CoreFpsLobbyPerson = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
};

export type CoreFpsLobbyPublicState = {
  availableInvitees: CoreFpsLobbyPerson[];
  id: string;
  joinDeadline: string;
  mapName: string;
  matchVotes: CoreFpsMatchVoteOption[];
  modeName: CoreFpsGameMode;
  participants: Array<
    CoreFpsLobbyPerson & {
      joinedAt: string;
      lastSeenAt: string;
    }
  >;
  roomId: string;
  startedAt: string | null;
  status: CoreFpsLobbyStatus;
  votingOpen: boolean;
};

export function normalizeCoreFpsLobbyWaitSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return coreFpsDefaultLobbyWaitSeconds;
  }

  return Math.min(
    coreFpsMaximumLobbyWaitSeconds,
    Math.max(coreFpsMinimumLobbyWaitSeconds, Math.round(parsed))
  );
}

export function normalizeCoreFpsMapPool(value: unknown) {
  const candidates = Array.isArray(value) ? value : [];
  const allowed = new Set<string>(coreFpsAvailableMaps);
  const maps = [
    ...new Set(
      candidates
        .filter((map): map is string => typeof map === "string")
        .map((map) => map.trim().toLowerCase())
        .filter((map) => allowed.has(map))
    )
  ];

  return maps.length ? maps : [...coreFpsAvailableMaps];
}

export function migrateCoreFpsMapPool(value: unknown, storedCatalogVersion: unknown) {
  const mapPool = normalizeCoreFpsMapPool(value);
  const parsedVersion = Number(storedCatalogVersion);
  const catalogVersion = Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1;

  if (catalogVersion >= coreFpsMapCatalogVersion || mapPool.includes("neonvault")) {
    return mapPool;
  }

  const enabledMaps = new Set([...mapPool, "neonvault"]);
  return coreFpsAvailableMaps.filter((mapName) => enabledMaps.has(mapName));
}

export function normalizeCoreFpsMode(value: unknown): CoreFpsGameMode | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  const mode = coreFpsGameModes.find((candidate) => candidate.id === normalized);

  return mode?.id ?? null;
}

export function normalizeCoreFpsModePool(value: unknown) {
  const candidates = Array.isArray(value) ? value : [];
  const requested = new Set(
    candidates
      .map((candidate) => normalizeCoreFpsMode(candidate))
      .filter((candidate): candidate is CoreFpsGameMode => Boolean(candidate))
  );
  const modes = coreFpsGameModes
    .map((mode) => mode.id)
    .filter((mode) => requested.has(mode));

  return modes.length ? modes : coreFpsGameModes.map((mode) => mode.id);
}

export function coreFpsModeDefinition(modeName: unknown) {
  const normalized = normalizeCoreFpsMode(modeName) ?? "ffa";
  return coreFpsGameModes.find((mode) => mode.id === normalized) ?? coreFpsGameModes[0];
}

export function coreFpsMapDefinition(mapName: unknown) {
  const normalized = typeof mapName === "string" ? mapName.trim().toLowerCase() : "";
  return coreFpsMapDefinitions.find((map) => map.id === normalized) ?? null;
}

export function coreFpsMapSupportsMode(mapName: unknown, modeName: unknown) {
  const map = coreFpsMapDefinition(mapName);
  const mode = normalizeCoreFpsMode(modeName);

  return Boolean(map && mode && map.supportedModes.some((supportedMode) => supportedMode === mode));
}

export function coreFpsMapsForMode(mapPool: readonly string[], modeName: unknown) {
  const maps = normalizeCoreFpsMapPool(mapPool);
  const supported = maps.filter((mapName) => coreFpsMapSupportsMode(mapName, modeName));

  return supported.length ? supported : maps;
}

function stableCoreFpsChoiceScore(seed: string, value: string) {
  let hash = 2166136261;

  for (const character of `${seed}:${value}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function coreFpsMatchChoiceId(mapName: string, modeName: CoreFpsGameMode) {
  return `${mapName}:${modeName}`;
}

export function buildCoreFpsMatchChoices(
  seed: string,
  mapPool: readonly string[],
  modePool: readonly string[]
) {
  const maps = normalizeCoreFpsMapPool(mapPool);
  const modes = normalizeCoreFpsModePool(modePool);
  const candidates = maps
    .flatMap((mapName) =>
      modes
        .filter((modeName) => coreFpsMapSupportsMode(mapName, modeName))
        .map((modeName) => ({
          id: coreFpsMatchChoiceId(mapName, modeName),
          mapName,
          modeName
        }))
    )
    .sort((left, right) => {
      const scoreDifference =
        stableCoreFpsChoiceScore(seed, left.id) - stableCoreFpsChoiceScore(seed, right.id);
      return scoreDifference || left.id.localeCompare(right.id);
    });
  const first = candidates[0];

  if (!first) {
    return [];
  }

  const second =
    candidates.find(
      (candidate) =>
        candidate.mapName !== first.mapName && candidate.modeName !== first.modeName
    ) ?? candidates.find((candidate) => candidate.id !== first.id);

  return second ? [first, second] : [first];
}

export function buildCoreFpsMatchVoteOptions(
  choices: ReturnType<typeof buildCoreFpsMatchChoices>,
  votes: Array<{
    mapVote: string | null | undefined;
    modeVote: string | null | undefined;
  }>,
  selectedVote: {
    mapVote: string | null | undefined;
    modeVote: string | null | undefined;
  } | null
): CoreFpsMatchVoteOption[] {
  const allowed = new Set(choices.map((choice) => choice.id));
  const counts = new Map<string, number>();

  for (const vote of votes) {
    const modeName = normalizeCoreFpsMode(vote.modeVote);
    const choiceId =
      vote.mapVote && modeName ? coreFpsMatchChoiceId(vote.mapVote, modeName) : null;

    if (choiceId && allowed.has(choiceId)) {
      counts.set(choiceId, (counts.get(choiceId) ?? 0) + 1);
    }
  }

  const selectedMode = normalizeCoreFpsMode(selectedVote?.modeVote);
  const selectedId =
    selectedVote?.mapVote && selectedMode
      ? coreFpsMatchChoiceId(selectedVote.mapVote, selectedMode)
      : null;

  return choices.map((choice) => {
    const mode = coreFpsModeDefinition(choice.modeName);
    const map = coreFpsMapDefinition(choice.mapName);

    return {
      description: mode.description,
      id: choice.id,
      mapDisplayName: map?.displayName ?? choice.mapName,
      mapName: choice.mapName,
      modeDisplayName: mode.displayName,
      modeName: mode.id,
      previewImageUrl: `/games/core/maps/${choice.mapName}.webp`,
      selected: choice.id === selectedId,
      votes: counts.get(choice.id) ?? 0
    };
  });
}

export function resolveCoreFpsMatchVote(
  choices: ReturnType<typeof buildCoreFpsMatchChoices>,
  votes: Array<{
    mapVote: string | null | undefined;
    modeVote: string | null | undefined;
  }>,
  fallback: {
    mapName: string;
    modeName: unknown;
  }
) {
  if (!choices.length) {
    throw new Error("No compatible Core FPS match choices are available.");
  }

  const counts = new Map<string, number>();
  const allowed = new Set(choices.map((choice) => choice.id));

  for (const vote of votes) {
    const modeName = normalizeCoreFpsMode(vote.modeVote);
    const choiceId =
      vote.mapVote && modeName ? coreFpsMatchChoiceId(vote.mapVote, modeName) : null;

    if (choiceId && allowed.has(choiceId)) {
      counts.set(choiceId, (counts.get(choiceId) ?? 0) + 1);
    }
  }

  const highest = Math.max(0, ...counts.values());
  const fallbackMode = normalizeCoreFpsMode(fallback.modeName);
  const fallbackId =
    fallbackMode && coreFpsMatchChoiceId(fallback.mapName, fallbackMode);
  const tied =
    highest > 0
      ? choices.filter((choice) => counts.get(choice.id) === highest)
      : choices;

  return tied.find((choice) => choice.id === fallbackId) ?? tied[0];
}

export function pickRandomCoreFpsMap(mapPool: readonly string[], randomValue = Math.random()) {
  const maps = normalizeCoreFpsMapPool(mapPool);
  const safeRandom = Number.isFinite(randomValue) ? Math.min(0.999999999, Math.max(0, randomValue)) : 0;

  return maps[Math.floor(safeRandom * maps.length)];
}

export function shortenedCoreFpsLobbyDeadline(currentDeadline: Date, now = new Date()) {
  const readyDeadline = new Date(now.getTime() + coreFpsReadyCountdownSeconds * 1000);

  return readyDeadline < currentDeadline ? readyDeadline : currentDeadline;
}

export function coreFpsLobbyShouldStart(status: string, joinDeadline: Date, now = new Date()) {
  return status === "waiting" && joinDeadline.getTime() <= now.getTime();
}

export function coreFpsLobbyIsReusable(
  lobby: {
    activeParticipantCount: number;
    createdAt: Date;
    status: string;
  },
  now = new Date()
) {
  if (lobby.status === "active") {
    return lobby.activeParticipantCount > 0;
  }

  return (
    lobby.status === "waiting" &&
    lobby.activeParticipantCount > 0 &&
    lobby.createdAt.getTime() >= now.getTime() - coreFpsLobbyMaximumAgeMs
  );
}
