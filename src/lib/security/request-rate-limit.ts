import { createHash } from "node:crypto";
import { createClient } from "redis";

type RateLimitRedisClient = {
  readonly isReady: boolean;
  connect(): Promise<RateLimitRedisClient>;
  destroy(): void;
  on(event: "error", listener: (error: Error) => void): RateLimitRedisClient;
  sendCommand(args: string[]): Promise<unknown>;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitInput = {
  identifier: string;
  limit: number;
  scope: string;
  windowSeconds: number;
};

const redisConnectTimeoutMs = 750;
const memoryLimit = 5_000;
const scopePattern = /^[a-z0-9:_-]{1,64}$/;
const memoryWindows = new Map<string, { count: number; resetAt: number }>();
let rateLimitClient: RateLimitRedisClient | null = null;
let rateLimitConnection: Promise<RateLimitRedisClient | null> | null = null;

function redisUrl() {
  return process.env.REDIS_URL?.trim() ?? "";
}

function destroyClient(client: RateLimitRedisClient | null) {
  try {
    client?.destroy();
  } catch {
    // A failed limiter connection falls back to the bounded process-local window.
  }
}

function createRateLimitClient() {
  const url = redisUrl();

  if (!url) return null;

  const client = createClient({
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: false
    },
    url
  });

  client.on("error", () => {
    // The caller uses the in-memory limiter when Redis is unavailable.
  });

  return client as RateLimitRedisClient;
}

async function getRateLimitClient() {
  if (rateLimitClient?.isReady) return rateLimitClient;
  if (rateLimitConnection) return rateLimitConnection;

  destroyClient(rateLimitClient);
  rateLimitClient = null;
  rateLimitConnection = (async () => {
    const client = createRateLimitClient();

    if (!client) return null;

    try {
      await client.connect();
      rateLimitClient = client;
      return client;
    } catch {
      destroyClient(client);
      return null;
    } finally {
      rateLimitConnection = null;
    }
  })();

  return rateLimitConnection;
}

function hashedIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function requestRateLimitIdentifier(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0];
  return hashedIdentifier(forwarded?.trim() || "unknown-client");
}

function normalizedInput(input: RateLimitInput) {
  if (!scopePattern.test(input.scope)) throw new Error("Invalid rate-limit scope.");
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10_000) throw new Error("Invalid rate-limit maximum.");
  if (!Number.isInteger(input.windowSeconds) || input.windowSeconds < 1 || input.windowSeconds > 86_400) throw new Error("Invalid rate-limit window.");

  return {
    ...input,
    identifier: hashedIdentifier(input.identifier),
    key: `bouncecore:rate-limit:${input.scope}:${hashedIdentifier(input.identifier)}`
  };
}

function memoryRateLimit(input: ReturnType<typeof normalizedInput>, now = Date.now()): RateLimitResult {
  if (memoryWindows.size >= memoryLimit) {
    for (const [key, value] of memoryWindows) {
      if (value.resetAt <= now) memoryWindows.delete(key);
    }
  }

  if (memoryWindows.size >= memoryLimit && !memoryWindows.has(input.key)) {
    memoryWindows.delete(memoryWindows.keys().next().value as string);
  }

  const existing = memoryWindows.get(input.key);
  const window = !existing || existing.resetAt <= now ? { count: 1, resetAt: now + input.windowSeconds * 1000 } : { ...existing, count: existing.count + 1 };
  memoryWindows.set(input.key, window);
  const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

  return {
    allowed: window.count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - window.count),
    retryAfterSeconds
  };
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const normalized = normalizedInput(input);
  const client = await getRateLimitClient();

  if (!client) return memoryRateLimit(normalized);

  try {
    const result = (await client.sendCommand([
      "EVAL",
      "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; local ttl=redis.call('TTL',KEYS[1]); return {count,ttl};",
      "1",
      normalized.key,
      String(normalized.windowSeconds)
    ])) as [number, number];
    const count = Number(result[0]);
    const retryAfterSeconds = Math.max(1, Number(result[1]) || normalized.windowSeconds);

    return {
      allowed: count <= normalized.limit,
      limit: normalized.limit,
      remaining: Math.max(0, normalized.limit - count),
      retryAfterSeconds
    };
  } catch {
    destroyClient(client);
    if (rateLimitClient === client) rateLimitClient = null;
    return memoryRateLimit(normalized);
  }
}

export async function consumeRequestRateLimit(request: Request, options: Omit<RateLimitInput, "identifier">) {
  return consumeRateLimit({ ...options, identifier: requestRateLimitIdentifier(request) });
}

export function applyRateLimitHeaders(response: Response, result: RateLimitResult) {
  response.headers.set("RateLimit-Limit", String(result.limit));
  response.headers.set("RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}
