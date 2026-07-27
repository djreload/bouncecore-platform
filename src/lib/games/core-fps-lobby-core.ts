export const coreFpsAvailableMaps = ["complex", "dust2", "turbine"] as const;
export const coreFpsDefaultLobbyWaitSeconds = 30;
export const coreFpsMinimumLobbyWaitSeconds = 10;
export const coreFpsMaximumLobbyWaitSeconds = 180;
export const coreFpsReadyCountdownSeconds = 8;
export const coreFpsLobbyPresenceWindowMs = 90_000;
export const coreFpsLobbyMaximumAgeMs = 2 * 60 * 60 * 1000;

export type CoreFpsLobbyStatus = "active" | "completed" | "waiting";

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
  participants: Array<
    CoreFpsLobbyPerson & {
      joinedAt: string;
      lastSeenAt: string;
    }
  >;
  roomId: string;
  startedAt: string | null;
  status: CoreFpsLobbyStatus;
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
