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
export const coreFpsDefaultLobbyWaitSeconds = 30;
export const coreFpsMinimumLobbyWaitSeconds = 10;
export const coreFpsMaximumLobbyWaitSeconds = 180;
export const coreFpsReadyCountdownSeconds = 8;
export const coreFpsLobbyPresenceWindowMs = 90_000;
export const coreFpsLobbyMaximumAgeMs = 2 * 60 * 60 * 1000;

export type CoreFpsLobbyStatus = "active" | "completed" | "waiting";
export type CoreFpsGameMode = (typeof coreFpsGameModes)[number]["id"];

export type CoreFpsVoteOption = {
  description?: string;
  displayName: string;
  id: string;
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
  mapVotes: CoreFpsVoteOption[];
  modeName: CoreFpsGameMode;
  modeVotes: CoreFpsVoteOption[];
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

export function resolveCoreFpsVote(
  votes: Array<string | null | undefined>,
  options: readonly string[],
  fallback: string
) {
  const allowed = new Set(options);
  const counts = new Map<string, number>();

  for (const vote of votes) {
    if (vote && allowed.has(vote)) {
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    }
  }

  const highest = Math.max(0, ...counts.values());

  if (highest === 0) {
    return allowed.has(fallback) ? fallback : options[0];
  }

  const tied = options.filter((option) => counts.get(option) === highest);
  return tied.includes(fallback) ? fallback : tied[0];
}

export function buildCoreFpsVoteOptions(
  options: readonly string[],
  votes: Array<string | null | undefined>,
  selectedVote: string | null | undefined,
  kind: "map" | "mode"
): CoreFpsVoteOption[] {
  const counts = new Map<string, number>();

  for (const vote of votes) {
    if (vote && options.includes(vote)) {
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    }
  }

  return options.map((id) => {
    const mode = kind === "mode" ? coreFpsModeDefinition(id) : null;
    const map = kind === "map" ? coreFpsMapDefinition(id) : null;
    const supportsCtf = map?.supportedModes.some((supportedMode) => supportedMode === "ctf");

    return {
      ...(mode
        ? { description: mode.description }
        : map
          ? {
              description: supportsCtf
                ? "Supports all three game modes."
                : "Supports Free For All and Team Deathmatch."
            }
          : {}),
      displayName: mode?.displayName ?? map?.displayName ?? id.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      id,
      selected: id === selectedVote,
      votes: counts.get(id) ?? 0
    };
  });
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
