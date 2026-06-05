import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";

type StreamStatus = "offline" | "starting" | "live" | "degraded";
type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

type StreamCoreState = {
  bitrateKbps: number | null;
  checkedAt: string;
  droppedFrames: number | null;
  ingestConnected: boolean;
  lastIngestAt: string | null;
  playbackUrl: string | null;
  status: StreamStatus;
  streamKeyFingerprint: string | null;
  viewerCount: number;
};

const defaultPort = 8088;
const defaultOfflineAfterSeconds = 30;

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function configuredNumber(key: string, fallback: number) {
  const value = Number(envValue(key));

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const host = envValue("STREAM_CORE_HTTP_HOST") || "127.0.0.1";
const port = configuredNumber("STREAM_CORE_HTTP_PORT", defaultPort);
const internalToken = envValue("STREAM_CORE_INTERNAL_TOKEN");
const stateFile = envValue("STREAM_CORE_STATE_FILE");
const publicPlaybackUrl = envValue("STREAM_CORE_PUBLIC_PLAYBACK_URL") || envValue("PUBLIC_PLAYBACK_URL") || null;
const offlineAfterSeconds = configuredNumber("STREAM_CORE_OFFLINE_AFTER_SECONDS", defaultOfflineAfterSeconds);

let state: StreamCoreState = {
  bitrateKbps: null,
  checkedAt: new Date().toISOString(),
  droppedFrames: null,
  ingestConnected: false,
  lastIngestAt: null,
  playbackUrl: publicPlaybackUrl,
  status: "offline",
  streamKeyFingerprint: null,
  viewerCount: 0
};

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);

  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json"
  });
  response.end(payload);
}

function text(response: ServerResponse, status: number, body: string) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(body);
}

function methodNotAllowed(response: ServerResponse) {
  json(response, 405, {
    error: "method_not_allowed"
  });
}

function notFound(response: ServerResponse) {
  json(response, 404, {
    error: "not_found"
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(a: string, b: string) {
  const left = sha256(a);
  const right = sha256(b);

  return timingSafeEqual(left, right);
}

function bearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization ?? "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const header = request.headers["x-internal-stream-token"];

  return typeof header === "string" ? header.trim() : "";
}

function isAuthorized(request: IncomingMessage) {
  if (!internalToken) {
    return true;
  }

  const provided = bearerToken(request);

  return Boolean(provided) && safeEqual(provided, internalToken);
}

function requireAuth(request: IncomingMessage, response: ServerResponse) {
  if (isAuthorized(request)) {
    return true;
  }

  json(response, 401, {
    error: "unauthorized"
  });
  return false;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

    if (Buffer.concat(chunks).byteLength > 128_000) {
      throw new Error("Request body is too large.");
    }
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  return raw ? JSON.parse(raw) : {};
}

function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}

function toStatus(value: unknown): StreamStatus | null {
  if (value === "offline" || value === "starting" || value === "live" || value === "degraded") {
    return value;
  }

  return null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toEvent(value: unknown) {
  const event = toStringValue(value)?.toLowerCase();

  if (event === "connected" || event === "start" || event === "started") {
    return "connected";
  }

  if (event === "heartbeat" || event === "update") {
    return "heartbeat";
  }

  if (event === "disconnected" || event === "stop" || event === "stopped") {
    return "disconnected";
  }

  return null;
}

function derivedState() {
  const now = new Date();
  const lastIngestAt = state.lastIngestAt ? new Date(state.lastIngestAt) : null;
  const stale =
    state.ingestConnected &&
    lastIngestAt &&
    Number.isFinite(lastIngestAt.getTime()) &&
    now.getTime() - lastIngestAt.getTime() > offlineAfterSeconds * 1000;
  const ingestConnected = state.ingestConnected && !stale;
  const status: StreamStatus = ingestConnected ? state.status === "offline" ? "live" : state.status : "offline";
  const healthStatus: HealthStatus = ingestConnected
    ? state.status === "degraded"
      ? "warning"
      : "healthy"
    : stale
      ? "warning"
      : "unknown";

  return {
    status,
    stream: {
      status,
      streamKeyFingerprint: state.streamKeyFingerprint
    },
    playback: {
      url: state.playbackUrl
    },
    playbackUrl: state.playbackUrl,
    viewerCount: state.viewerCount,
    health: {
      bitrateKbps: state.bitrateKbps ?? undefined,
      checkedAt: now.toISOString(),
      droppedFrames: state.droppedFrames ?? undefined,
      ingestConnected,
      status: healthStatus
    }
  };
}

async function loadState() {
  if (!stateFile) {
    return;
  }

  try {
    const raw = await readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw);

    if (isObject(parsed)) {
      state = {
        ...state,
        bitrateKbps: toNumber(parsed.bitrateKbps),
        checkedAt: toStringValue(parsed.checkedAt) ?? state.checkedAt,
        droppedFrames: toNumber(parsed.droppedFrames),
        ingestConnected: Boolean(parsed.ingestConnected),
        lastIngestAt: toStringValue(parsed.lastIngestAt),
        playbackUrl: toStringValue(parsed.playbackUrl) ?? state.playbackUrl,
        status: toStatus(parsed.status) ?? state.status,
        streamKeyFingerprint: toStringValue(parsed.streamKeyFingerprint),
        viewerCount: toNumber(parsed.viewerCount) ?? 0
      };
    }
  } catch {
    return;
  }
}

async function persistState() {
  if (!stateFile) {
    return;
  }

  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(`${stateFile}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${stateFile}.tmp`, stateFile);
}

function updateTelemetry(payload: Record<string, unknown>) {
  const bitrateKbps = toNumber(payload.bitrateKbps ?? payload.bitrate_kbps);
  const droppedFrames = toNumber(payload.droppedFrames ?? payload.dropped_frames);
  const viewerCount = toNumber(payload.viewerCount ?? payload.viewer_count ?? payload.viewers);
  const playbackUrl = toStringValue(payload.playbackUrl ?? payload.playback_url);
  const streamKeyFingerprint = toStringValue(payload.streamKeyFingerprint ?? payload.stream_key_fingerprint);

  if (bitrateKbps !== null) {
    state.bitrateKbps = bitrateKbps;
  }

  if (droppedFrames !== null) {
    state.droppedFrames = droppedFrames;
  }

  if (viewerCount !== null) {
    state.viewerCount = viewerCount;
  }

  if (playbackUrl) {
    state.playbackUrl = playbackUrl;
  }

  if (streamKeyFingerprint) {
    state.streamKeyFingerprint = streamKeyFingerprint;
  }
}

async function handleIngest(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    methodNotAllowed(response);
    return;
  }

  if (!requireAuth(request, response)) {
    return;
  }

  const body = await readBody(request);

  if (!isObject(body)) {
    json(response, 400, {
      error: "invalid_body"
    });
    return;
  }

  const event = toEvent(body.event ?? body.type);
  const now = new Date().toISOString();

  updateTelemetry(body);
  state.checkedAt = now;

  if (event === "connected" || event === "heartbeat") {
    state.ingestConnected = true;
    state.lastIngestAt = now;
    state.status = toStatus(body.status) ?? "live";
  } else if (event === "disconnected") {
    state.ingestConnected = false;
    state.lastIngestAt = now;
    state.status = "offline";
    state.bitrateKbps = null;
  } else {
    json(response, 400, {
      error: "invalid_event"
    });
    return;
  }

  await persistState();
  json(response, 200, derivedState());
}

async function handleStatusMutation(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    methodNotAllowed(response);
    return;
  }

  if (!requireAuth(request, response)) {
    return;
  }

  const body = await readBody(request);

  if (!isObject(body)) {
    json(response, 400, {
      error: "invalid_body"
    });
    return;
  }

  updateTelemetry(body);
  state.status = toStatus(body.status) ?? state.status;
  state.ingestConnected = typeof body.ingestConnected === "boolean" ? body.ingestConnected : state.ingestConnected;
  state.checkedAt = new Date().toISOString();
  state.lastIngestAt = state.ingestConnected ? state.checkedAt : state.lastIngestAt;

  await persistState();
  json(response, 200, derivedState());
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  try {
    if (url.pathname === "/health") {
      json(response, 200, {
        ok: true,
        service: "bouncecore-stream-core"
      });
      return;
    }

    if (url.pathname === "/status") {
      if (request.method === "GET") {
        if (!requireAuth(request, response)) {
          return;
        }

        json(response, 200, derivedState());
        return;
      }

      await handleStatusMutation(request, response);
      return;
    }

    if (url.pathname === "/playback-url") {
      if (request.method !== "GET") {
        methodNotAllowed(response);
        return;
      }

      if (!requireAuth(request, response)) {
        return;
      }

      json(response, 200, {
        playbackUrl: derivedState().playbackUrl
      });
      return;
    }

    if (url.pathname === "/events/ingest" || url.pathname === "/ingest") {
      await handleIngest(request, response);
      return;
    }

    if (url.pathname === "/") {
      text(response, 200, "bouncecore-stream-core\n");
      return;
    }

    notFound(response);
  } catch (error) {
    json(response, 500, {
      error: "stream_core_error",
      message: error instanceof Error ? error.message : "Unknown stream-core error."
    });
  }
}

await loadState();

const server = createServer((request, response) => {
  void route(request, response);
});

server.listen(port, host, () => {
  console.log(`Bouncecore stream core listening on ${host}:${port}`);
});
