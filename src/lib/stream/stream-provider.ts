import { createHash, randomBytes, randomUUID } from "node:crypto";

export type StreamStatus = "offline" | "starting" | "live" | "degraded";

export type StreamHealth = {
  status: "healthy" | "warning" | "critical" | "unknown";
  bitrateKbps?: number;
  droppedFrames?: number;
  ingestConnected: boolean;
  checkedAt: string;
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

export class MockStreamProvider implements StreamProvider {
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
    return;
  }

  async updateStreamSettings(): Promise<void> {
    return;
  }

  async startRecording(): Promise<{ recordingId: string }> {
    return { recordingId: `rec_${randomUUID()}` };
  }

  async stopRecording(): Promise<void> {
    return;
  }

  async handleWebhook(): Promise<void> {
    return;
  }

  private async createKey(keyId: string): Promise<StreamKeyResult> {
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

export function getStreamProvider(): StreamProvider {
  return new MockStreamProvider();
}
