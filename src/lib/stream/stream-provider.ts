import { createHash, randomBytes, randomUUID } from "node:crypto";

export type StreamStatus = "offline" | "starting" | "live" | "degraded";

export type StreamHealth = {
  status: "healthy" | "warning" | "critical" | "unknown";
  bitrateKbps?: number;
  droppedFrames?: number;
  ingestConnected: boolean;
  checkedAt: string;
};

export type StreamPlaybackSource = {
  id: string;
  lastIngestAt: string;
  playbackUrl: string | null;
  presenterName: string | null;
  role: "primary" | "secondary";
  startedAt: string;
  status: StreamStatus;
  streamKeyFingerprint: string | null;
  title: string | null;
};

export type StreamKeyResult = {
  keyId: string;
  rawKey?: string;
  fingerprint: string;
  createdAt: string;
};

export type StreamProviderSettings = {
  ingestUrl?: string;
  playbackUrl?: string;
  recordingEnabled?: boolean;
};

export type StreamProvider = {
  getActiveIngests(): Promise<StreamPlaybackSource[]>;
  getStreamStatus(): Promise<StreamStatus>;
  getPlaybackUrl(): Promise<string | null>;
  getViewerCount(): Promise<number>;
  getStreamHealth(): Promise<StreamHealth>;
  rotateStreamKey(keyId: string): Promise<StreamKeyResult>;
  createStreamKeyForUser(userId: string): Promise<StreamKeyResult>;
  revokeStreamKey(keyId: string): Promise<void>;
  updateStreamSettings(settings: StreamProviderSettings): Promise<void>;
  startRecording(): Promise<{ recordingId: string }>;
  stopRecording(recordingId: string): Promise<void>;
  handleWebhook(payload: unknown): Promise<void>;
};

const streamStatuses: readonly StreamStatus[] = ["offline", "starting", "live", "degraded"];
const healthStatuses: readonly StreamHealth["status"][] = ["healthy", "warning", "critical", "unknown"];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function toStatus(value: unknown): StreamStatus {
  return typeof value === "string" && streamStatuses.includes(value as StreamStatus) ? (value as StreamStatus) : "offline";
}

function toHealthStatus(value: unknown): StreamHealth["status"] {
  return typeof value === "string" && healthStatuses.includes(value as StreamHealth["status"])
    ? (value as StreamHealth["status"])
    : "unknown";
}

function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(number) ? number : undefined;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "connected", "live"].includes(value.trim().toLowerCase());
  }

  return false;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toCheckedAt(value: unknown) {
  if (typeof value === "string" && Number.isFinite(new Date(value).getTime())) {
    return value;
  }

  return new Date().toISOString();
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

type StreamCoreSnapshot = {
  activeIngests: StreamPlaybackSource[];
  error?: string;
  health: StreamHealth;
  playbackUrl: string | null;
  provider: "mock" | "stream-core" | "unconfigured";
  reachable: boolean;
  status: StreamStatus;
  viewerCount: number;
};

function defaultSnapshot(provider: StreamCoreSnapshot["provider"], error?: string): StreamCoreSnapshot {
  return {
    activeIngests: [],
    error,
    health: {
      checkedAt: new Date().toISOString(),
      ingestConnected: false,
      status: error ? "critical" : "unknown"
    },
    playbackUrl: envValue("PUBLIC_PLAYBACK_URL") || null,
    provider,
    reachable: !error,
    status: "offline",
    viewerCount: 0
  };
}

function toPlaybackRole(value: unknown): StreamPlaybackSource["role"] {
  return value === "secondary" ? "secondary" : "primary";
}

function toPlaybackSource(value: unknown, index: number): StreamPlaybackSource | null {
  if (!isObject(value)) {
    return null;
  }

  const id = toOptionalString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    lastIngestAt: toCheckedAt(firstValue(value.lastIngestAt, value.last_ingest_at)),
    playbackUrl: toOptionalString(firstValue(value.playbackUrl, value.playback_url)),
    presenterName: toOptionalString(firstValue(value.presenterName, value.presenter_name)),
    role: toPlaybackRole(firstValue(value.role, index === 0 ? "primary" : "secondary")),
    startedAt: toCheckedAt(firstValue(value.startedAt, value.started_at)),
    status: toStatus(value.status),
    streamKeyFingerprint: toOptionalString(firstValue(value.streamKeyFingerprint, value.stream_key_fingerprint)),
    title: toOptionalString(value.title)
  };
}

function parseSnapshot(value: unknown): StreamCoreSnapshot {
  if (!isObject(value)) {
    return defaultSnapshot("stream-core", "Stream core returned an invalid response.");
  }

  const stream = isObject(value.stream) ? value.stream : {};
  const playback = isObject(value.playback) ? value.playback : {};
  const healthValue = isObject(value.health) ? value.health : {};
  const rawActiveIngests = Array.isArray(value.activeIngests)
    ? value.activeIngests
    : Array.isArray(playback.activeIngests)
      ? playback.activeIngests
      : [];
  const activeIngests = rawActiveIngests
    .map((ingest, index) => toPlaybackSource(ingest, index))
    .filter((ingest): ingest is StreamPlaybackSource => Boolean(ingest))
    .slice(0, 2);
  const status = toStatus(firstValue(value.status, stream.status));
  const playbackUrl =
    toOptionalString(firstValue(value.playbackUrl, value.playback_url, playback.url, stream.playbackUrl)) ||
    envValue("PUBLIC_PLAYBACK_URL") ||
    null;
  const viewerCount = toNumber(firstValue(value.viewerCount, value.viewer_count, value.viewers, stream.viewerCount)) ?? 0;
  const healthStatus = toHealthStatus(firstValue(healthValue.status, value.healthStatus, value.health_status));

  return {
    activeIngests,
    health: {
      bitrateKbps: toNumber(firstValue(healthValue.bitrateKbps, healthValue.bitrate_kbps, value.bitrateKbps)),
      checkedAt: toCheckedAt(firstValue(healthValue.checkedAt, healthValue.checked_at, value.checkedAt)),
      droppedFrames: toNumber(firstValue(healthValue.droppedFrames, healthValue.dropped_frames, value.droppedFrames)),
      ingestConnected: toBoolean(firstValue(healthValue.ingestConnected, healthValue.ingest_connected, value.ingestConnected)),
      status: healthStatus
    },
    playbackUrl,
    provider: "stream-core",
    reachable: true,
    status,
    viewerCount
  };
}

function isMockProviderAllowed() {
  return process.env.NODE_ENV !== "production" || envValue("ALLOW_MOCK_STREAM_PROVIDER").toLowerCase() === "true";
}

function unsupportedProviderOperation(operation: string): never {
  throw new Error(`${operation} is not supported by the configured stream provider.`);
}

class LocalStreamKeyFactory {
  protected async createKey(keyId: string): Promise<StreamKeyResult> {
    const rawKey = `bc_live_${randomBytes(32).toString("base64url")}`;
    const fingerprint = createHash("sha256").update(rawKey).digest("hex").slice(0, 16);

    return {
      keyId,
      rawKey,
      fingerprint,
      createdAt: new Date().toISOString()
    };
  }
}

class MisconfiguredStreamProvider implements StreamProvider {
  constructor(
    private readonly mode: string,
    private readonly reason: string
  ) {}

  async getActiveIngests(): Promise<StreamPlaybackSource[]> {
    return [];
  }

  async getStreamStatus(): Promise<StreamStatus> {
    return "degraded";
  }

  async getPlaybackUrl(): Promise<string | null> {
    return envValue("PUBLIC_PLAYBACK_URL") || null;
  }

  async getViewerCount(): Promise<number> {
    return 0;
  }

  async getStreamHealth(): Promise<StreamHealth> {
    return {
      checkedAt: new Date().toISOString(),
      ingestConnected: false,
      status: "critical"
    };
  }

  async rotateStreamKey(): Promise<StreamKeyResult> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async createStreamKeyForUser(): Promise<StreamKeyResult> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async revokeStreamKey(): Promise<void> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async updateStreamSettings(): Promise<void> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async startRecording(): Promise<{ recordingId: string }> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async stopRecording(): Promise<void> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }

  async handleWebhook(): Promise<void> {
    throw new Error(`Stream provider ${this.mode} is not ready: ${this.reason}`);
  }
}

export class MockStreamProvider extends LocalStreamKeyFactory implements StreamProvider {
  async getActiveIngests(): Promise<StreamPlaybackSource[]> {
    return [];
  }

  async getStreamStatus(): Promise<StreamStatus> {
    return "offline";
  }

  async getPlaybackUrl(): Promise<string | null> {
    return process.env.PUBLIC_PLAYBACK_URL ?? null;
  }

  async getViewerCount(): Promise<number> {
    return 0;
  }

  async getStreamHealth(): Promise<StreamHealth> {
    return {
      status: "unknown",
      ingestConnected: false,
      checkedAt: new Date().toISOString()
    };
  }

  async rotateStreamKey(keyId: string): Promise<StreamKeyResult> {
    return this.createKey(keyId);
  }

  async createStreamKeyForUser(userId: string): Promise<StreamKeyResult> {
    return this.createKey(`mock_${userId}_${randomUUID()}`);
  }

  async revokeStreamKey(): Promise<void> {
    unsupportedProviderOperation("Stream key revocation");
  }

  async updateStreamSettings(): Promise<void> {
    unsupportedProviderOperation("Stream settings update");
  }

  async startRecording(): Promise<{ recordingId: string }> {
    unsupportedProviderOperation("Recording start");
  }

  async stopRecording(): Promise<void> {
    unsupportedProviderOperation("Recording stop");
  }

  async handleWebhook(): Promise<void> {
    unsupportedProviderOperation("Provider webhook handling");
  }
}

export class StreamCoreHttpProvider extends LocalStreamKeyFactory implements StreamProvider {
  private snapshotPromise: Promise<StreamCoreSnapshot> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null
  ) {
    super();
  }

  async getActiveIngests(): Promise<StreamPlaybackSource[]> {
    const snapshot = await this.readSnapshot();

    return snapshot.activeIngests;
  }

  async getStreamStatus(): Promise<StreamStatus> {
    const snapshot = await this.readSnapshot();

    return snapshot.status;
  }

  async getPlaybackUrl(): Promise<string | null> {
    const snapshot = await this.readSnapshot();

    return snapshot.playbackUrl;
  }

  async getViewerCount(): Promise<number> {
    const snapshot = await this.readSnapshot();

    return snapshot.viewerCount;
  }

  async getStreamHealth(): Promise<StreamHealth> {
    const snapshot = await this.readSnapshot();

    return snapshot.health;
  }

  async rotateStreamKey(keyId: string): Promise<StreamKeyResult> {
    return this.createKey(keyId);
  }

  async createStreamKeyForUser(userId: string): Promise<StreamKeyResult> {
    return this.createKey(`stream_core_${userId}_${randomUUID()}`);
  }

  async revokeStreamKey(): Promise<void> {
    unsupportedProviderOperation("Stream key revocation");
  }

  async updateStreamSettings(): Promise<void> {
    unsupportedProviderOperation("Stream settings update");
  }

  async startRecording(): Promise<{ recordingId: string }> {
    unsupportedProviderOperation("Recording start");
  }

  async stopRecording(): Promise<void> {
    unsupportedProviderOperation("Recording stop");
  }

  async handleWebhook(): Promise<void> {
    unsupportedProviderOperation("Provider webhook handling");
  }

  private async readSnapshot() {
    this.snapshotPromise ??= this.fetchSnapshot();

    return this.snapshotPromise;
  }

  private async fetchSnapshot(): Promise<StreamCoreSnapshot> {
    try {
      const response = await this.fetchJson(envValue("STREAM_CORE_STATUS_PATH") || "/status");

      return parseSnapshot(response);
    } catch (error) {
      return defaultSnapshot("stream-core", error instanceof Error ? error.message : "Stream core request failed.");
    }
  }

  private async fetchJson(path: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers["x-internal-stream-token"] = this.token;
    }

    try {
      const response = await fetch(`${normalizeUrl(this.baseUrl)}${normalizePath(path)}`, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Stream core returned HTTP ${response.status}.`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getStreamProviderMode() {
  const configuredMode = envValue("STREAM_PROVIDER");

  if (configuredMode) {
    return configuredMode;
  }

  return isMockProviderAllowed() ? "mock" : "unconfigured";
}

export function getStreamProvider(): StreamProvider {
  const mode = getStreamProviderMode().toLowerCase();
  const baseUrl = envValue("STREAM_CORE_INTERNAL_URL");

  if ((mode === "stream-core" || mode === "http") && baseUrl) {
    return new StreamCoreHttpProvider(baseUrl, envValue("STREAM_CORE_INTERNAL_TOKEN") || null);
  }

  if (mode === "mock" && isMockProviderAllowed()) {
    return new MockStreamProvider();
  }

  const reason =
    mode === "stream-core" || mode === "http"
      ? "STREAM_CORE_INTERNAL_URL is missing."
      : "Set STREAM_PROVIDER=stream-core with STREAM_CORE_INTERNAL_URL, or explicitly allow mock mode only for local development.";

  return new MisconfiguredStreamProvider(mode, reason);
}
