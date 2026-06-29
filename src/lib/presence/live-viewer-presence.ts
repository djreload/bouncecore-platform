import { createClient } from "redis";

type LiveViewerRedisClient = {
  readonly isReady: boolean;
  connect(): Promise<LiveViewerRedisClient>;
  destroy(): void;
  on(event: "error", listener: (error: Error) => void): LiveViewerRedisClient;
  sendCommand(args: string[]): Promise<unknown>;
};

export const liveViewerFreshnessMs = 45_000;

const redisConnectTimeoutMs = 750;
const liveViewerKey = "bouncecore:presence:live-viewers";
const liveViewerKeyTtlSeconds = Math.ceil((liveViewerFreshnessMs * 3) / 1000);
const visitorIdPattern = /^[a-zA-Z0-9_-]{12,96}$/;

let presenceClient: LiveViewerRedisClient | null = null;
let presenceConnection: Promise<LiveViewerRedisClient | null> | null = null;

function redisUrl() {
  return process.env.REDIS_URL?.trim() ?? "";
}

function destroyClient(client: LiveViewerRedisClient | null) {
  try {
    client?.destroy();
  } catch {
    // Redis presence is best-effort and should never break public pages.
  }
}

function createPresenceClient() {
  const url = redisUrl();

  if (!url) {
    return null;
  }

  const client = createClient({
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: false
    },
    url
  });

  client.on("error", () => {
    // Presence falls back to zero if Redis is unavailable.
  });

  return client as LiveViewerRedisClient;
}

async function getPresenceClient() {
  if (presenceClient?.isReady) {
    return presenceClient;
  }

  if (presenceConnection) {
    return presenceConnection;
  }

  destroyClient(presenceClient);
  presenceClient = null;

  presenceConnection = (async () => {
    const client = createPresenceClient();

    if (!client) {
      return null;
    }

    try {
      await client.connect();
      presenceClient = client;
      return client;
    } catch {
      destroyClient(client);
      return null;
    } finally {
      presenceConnection = null;
    }
  })();

  return presenceConnection;
}

export function normalizeLiveViewerId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return visitorIdPattern.test(normalized) ? normalized : null;
}

export function normalizeLiveViewerPath(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  try {
    return new URL(value, "https://bouncecore.local").pathname || "/";
  } catch {
    return value.startsWith("/") ? value.slice(0, 128) : "/";
  }
}

export function isLiveViewerPresencePath(path: string) {
  return path === "/live" || path.startsWith("/live/");
}

async function trimStaleLiveViewers(client: LiveViewerRedisClient, nowMs: number) {
  await client.sendCommand(["ZREMRANGEBYSCORE", liveViewerKey, "0", String(nowMs - liveViewerFreshnessMs)]);
}

export async function recordLiveViewerHeartbeat(input: {
  liveViewer: boolean;
  path: unknown;
  visitorId: unknown;
  now?: Date;
}) {
  const path = normalizeLiveViewerPath(input.path);
  const visitorId = normalizeLiveViewerId(input.visitorId);

  if (!input.liveViewer || !visitorId || !isLiveViewerPresencePath(path)) {
    return false;
  }

  const client = await getPresenceClient();

  if (!client) {
    return false;
  }

  const nowMs = input.now?.getTime() ?? Date.now();

  try {
    await trimStaleLiveViewers(client, nowMs);
    await client.sendCommand(["ZADD", liveViewerKey, String(nowMs), visitorId]);
    await client.sendCommand(["EXPIRE", liveViewerKey, String(liveViewerKeyTtlSeconds)]);
    return true;
  } catch {
    destroyClient(client);

    if (presenceClient === client) {
      presenceClient = null;
    }

    return false;
  }
}

export async function getLiveViewerPresenceCount(now = new Date()) {
  const client = await getPresenceClient();

  if (!client) {
    return 0;
  }

  try {
    const nowMs = now.getTime();

    await trimStaleLiveViewers(client, nowMs);

    const count = await client.sendCommand(["ZCARD", liveViewerKey]);
    const number = typeof count === "number" ? count : typeof count === "string" ? Number(count) : 0;

    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  } catch {
    destroyClient(client);

    if (presenceClient === client) {
      presenceClient = null;
    }

    return 0;
  }
}
