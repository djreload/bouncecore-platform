import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";

type StreamStatus = "offline" | "starting" | "live" | "degraded";
type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

type StreamProfileConfig = {
  audioBitrateKbps: number;
  fps: number;
  key: string;
  keyframeSeconds: number;
  label: string;
  videoBitrateKbps: number;
  videoHeight: number;
  videoWidth: number;
};

type StreamCoreState = {
  bitrateKbps: number | null;
  channelId: string | null;
  channelSlug: string | null;
  channelTitle: string | null;
  checkedAt: string;
  droppedFrames: number | null;
  ingestConnected: boolean;
  lastIngestAt: string | null;
  playbackUrl: string | null;
  status: StreamStatus;
  streamKeyFingerprint: string | null;
  streamProfile: StreamProfileConfig | null;
  viewerCount: number;
};

type StreamKeyValidationResponse =
  | {
      channel?: {
        id: string;
        playbackUrl: string | null;
        slug: string;
        streamProfile?: StreamProfileConfig | null;
        title: string;
      } | null;
      key: {
        fingerprint: string;
        id: string;
        lastUsedAt: string | null;
      };
      profile?: StreamProfileConfig | null;
      user?: {
        displayName: string;
        email: string;
        id: string;
      };
      valid: true;
    }
  | {
      reason?: string;
      valid: false;
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
const keyValidationUrl = envValue("STREAM_CORE_KEY_VALIDATION_URL");
const keyValidationToken = envValue("STREAM_CORE_KEY_VALIDATION_TOKEN") || envValue("INTERNAL_TASK_TOKEN");
const stateFile = envValue("STREAM_CORE_STATE_FILE");
const publicPlaybackUrl = envValue("STREAM_CORE_PUBLIC_PLAYBACK_URL") || envValue("PUBLIC_PLAYBACK_URL") || null;
const offlineAfterSeconds = configuredNumber("STREAM_CORE_OFFLINE_AFTER_SECONDS", defaultOfflineAfterSeconds);

let state: StreamCoreState = {
  bitrateKbps: null,
  channelId: null,
  channelSlug: null,
  channelTitle: null,
  checkedAt: new Date().toISOString(),
  droppedFrames: null,
  ingestConnected: false,
  lastIngestAt: null,
  playbackUrl: publicPlaybackUrl,
  status: "offline",
  streamKeyFingerprint: null,
  streamProfile: null,
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
  const contentType = Array.isArray(request.headers["content-type"])
    ? request.headers["content-type"][0]
    : request.headers["content-type"] ?? "";

  if (!raw) {
    return {};
  }

  if (contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  if (contentType.toLowerCase().includes("application/json") || raw.trim().startsWith("{")) {
    return JSON.parse(raw);
  }

  return {
    raw
  };
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

function toStreamProfile(value: unknown): StreamProfileConfig | null {
  if (!isObject(value)) {
    return null;
  }

  const key = toStringValue(value.key);
  const label = toStringValue(value.label);
  const videoWidth = toNumber(value.videoWidth ?? value.video_width);
  const videoHeight = toNumber(value.videoHeight ?? value.video_height);
  const videoBitrateKbps = toNumber(value.videoBitrateKbps ?? value.video_bitrate_kbps);
  const audioBitrateKbps = toNumber(value.audioBitrateKbps ?? value.audio_bitrate_kbps);
  const fps = toNumber(value.fps);
  const keyframeSeconds = toNumber(value.keyframeSeconds ?? value.keyframe_seconds);

  if (!key || !label || videoWidth === null || videoHeight === null || videoBitrateKbps === null || audioBitrateKbps === null || fps === null) {
    return null;
  }

  return {
    audioBitrateKbps,
    fps,
    key,
    keyframeSeconds: keyframeSeconds ?? 2,
    label,
    videoBitrateKbps,
    videoHeight,
    videoWidth
  };
}

function requestHeader(request: IncomingMessage, key: string) {
  const value = request.headers[key.toLowerCase()];

  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
}

function extractStreamKey(payload: Record<string, unknown>, url: URL, request: IncomingMessage) {
  return (
    toStringValue(payload.streamKey) ??
    toStringValue(payload.stream_key) ??
    toStringValue(payload.key) ??
    toStringValue(payload.password) ??
    toStringValue(payload.name) ??
    toStringValue(url.searchParams.get("streamKey")) ??
    toStringValue(url.searchParams.get("stream_key")) ??
    toStringValue(url.searchParams.get("key")) ??
    toStringValue(url.searchParams.get("password")) ??
    toStringValue(url.searchParams.get("name")) ??
    toStringValue(requestHeader(request, "x-stream-key")) ??
    toStringValue(requestHeader(request, "x-owncast-stream-key"))
  );
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
    channel: state.channelId
      ? {
          id: state.channelId,
          slug: state.channelSlug,
          title: state.channelTitle
        }
      : null,
    stream: {
      status,
      streamKeyFingerprint: state.streamKeyFingerprint
    },
    playback: {
      url: state.playbackUrl
    },
    playbackUrl: state.playbackUrl,
    profile: state.streamProfile,
    streamProfile: state.streamProfile,
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
        channelId: toStringValue(parsed.channelId),
        channelSlug: toStringValue(parsed.channelSlug),
        channelTitle: toStringValue(parsed.channelTitle),
        checkedAt: toStringValue(parsed.checkedAt) ?? state.checkedAt,
        droppedFrames: toNumber(parsed.droppedFrames),
        ingestConnected: Boolean(parsed.ingestConnected),
        lastIngestAt: toStringValue(parsed.lastIngestAt),
        playbackUrl: toStringValue(parsed.playbackUrl) ?? state.playbackUrl,
        status: toStatus(parsed.status) ?? state.status,
        streamKeyFingerprint: toStringValue(parsed.streamKeyFingerprint),
        streamProfile: toStreamProfile(parsed.streamProfile),
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

function applyValidatedStreamKey(result: Extract<StreamKeyValidationResponse, { valid: true }>) {
  const streamProfile = toStreamProfile(result.profile) ?? toStreamProfile(result.channel?.streamProfile);

  state.streamKeyFingerprint = result.key.fingerprint;
  state.channelId = result.channel?.id ?? state.channelId;
  state.channelSlug = result.channel?.slug ?? state.channelSlug;
  state.channelTitle = result.channel?.title ?? state.channelTitle;
  state.playbackUrl = result.channel?.playbackUrl ?? state.playbackUrl;
  state.streamProfile = streamProfile ?? state.streamProfile;
  state.checkedAt = new Date().toISOString();
  state.status = state.status === "offline" ? "starting" : state.status;
}

async function validateStreamKey(rawKey: string): Promise<StreamKeyValidationResponse> {
  if (!keyValidationUrl) {
    return {
      reason: "validation_not_configured",
      valid: false
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (keyValidationToken) {
    headers.Authorization = `Bearer ${keyValidationToken}`;
    headers["x-internal-task-token"] = keyValidationToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  let response: Response;
  let payload: StreamKeyValidationResponse;

  try {
    response = await fetch(keyValidationUrl, {
      body: JSON.stringify({
        streamKey: rawKey
      }),
      headers,
      method: "POST",
      signal: controller.signal
    });
    payload = (await response.json().catch(() => ({}))) as StreamKeyValidationResponse;
  } catch {
    return {
      reason: "validation_unreachable",
      valid: false
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || !payload.valid) {
    return {
      reason: "reason" in payload ? payload.reason : "invalid_key",
      valid: false
    };
  }

  return payload;
}

async function handleStreamKeyValidation(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method !== "POST" && request.method !== "GET") {
    methodNotAllowed(response);
    return;
  }

  const body = request.method === "POST" ? await readBody(request) : {};

  if (!isObject(body)) {
    json(response, 400, {
      error: "invalid_body"
    });
    return;
  }

  const rawKey = extractStreamKey(body, url, request);

  if (!rawKey) {
    json(response, 400, {
      reason: "missing_key",
      valid: false
    });
    return;
  }

  const result = await validateStreamKey(rawKey);

  if (!result.valid) {
    json(response, 403, {
      reason: result.reason ?? "invalid_key",
      valid: false
    });
    return;
  }

  applyValidatedStreamKey(result);
  await persistState();

  json(response, 200, {
    channel: result.channel ?? null,
    profile: result.profile ?? result.channel?.streamProfile ?? null,
    streamKeyFingerprint: result.key.fingerprint,
    valid: true
  });
}

async function handleIngest(request: IncomingMessage, response: ServerResponse, url: URL) {
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
  const rawKey = extractStreamKey(body, url, request);
  const now = new Date().toISOString();

  if (rawKey) {
    const result = await validateStreamKey(rawKey);

    if (!result.valid) {
      json(response, 403, {
        reason: result.reason ?? "invalid_key",
        valid: false
      });
      return;
    }

    applyValidatedStreamKey(result);
  }

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

    if (url.pathname === "/status" || url.pathname === "/api/status") {
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

    if (url.pathname === "/playback-url" || url.pathname === "/api/playback-url") {
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

    if (
      url.pathname === "/ingest/auth" ||
      url.pathname === "/api/ingest/auth" ||
      url.pathname === "/auth/stream-key" ||
      url.pathname === "/validate-stream-key"
    ) {
      await handleStreamKeyValidation(request, response, url);
      return;
    }

    if (url.pathname === "/events/ingest" || url.pathname === "/ingest") {
      await handleIngest(request, response, url);
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
