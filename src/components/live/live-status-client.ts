"use client";

import type { StreamHealth, StreamPlaybackSource } from "@/lib/stream/stream-provider";
import type { StreamProfileSummary } from "@/lib/stream/stream-profile-service";

export type LiveStatusChannelPayload = {
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  streamProfile: StreamProfileSummary | null;
};

export type LiveStatusPayload = {
  activeIngests: StreamPlaybackSource[];
  channel: LiveStatusChannelPayload | null;
  health: StreamHealth;
  offlineImageUrl: string | null;
  playbackUrl: string | null;
  provider?: unknown;
  status: string;
  viewerCount: number;
};

type LiveStatusListener = (payload: LiveStatusPayload) => void;

const statusFetchUrl = "/internal/stream/status";
const statusStreamUrl = "/internal/stream/status/stream";
const fallbackPollMs = 1000;

const listeners = new Set<LiveStatusListener>();
let eventSource: EventSource | null = null;
let fallbackPollTimer: number | null = null;
let started = false;
let lastPayload: LiveStatusPayload | null = null;

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeHealth(value: unknown): StreamHealth {
  const health = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const status = health.status;

  return {
    bitrateKbps: typeof health.bitrateKbps === "number" && Number.isFinite(health.bitrateKbps) ? health.bitrateKbps : undefined,
    checkedAt: stringOrNull(health.checkedAt) ?? new Date().toISOString(),
    droppedFrames: typeof health.droppedFrames === "number" && Number.isFinite(health.droppedFrames) ? health.droppedFrames : undefined,
    ingestConnected: health.ingestConnected === true,
    status: status === "healthy" || status === "warning" || status === "critical" || status === "unknown" ? status : "unknown"
  };
}

function normalizeActiveIngests(value: unknown): StreamPlaybackSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): StreamPlaybackSource | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const id = stringOrNull(source.id);

      if (!id) {
        return null;
      }

      const status = source.status;

      return {
        id,
        lastIngestAt: stringOrNull(source.lastIngestAt) ?? new Date().toISOString(),
        playbackUrl: stringOrNull(source.playbackUrl),
        presenterName: stringOrNull(source.presenterName),
        role: source.role === "secondary" ? "secondary" : "primary",
        startedAt: stringOrNull(source.startedAt) ?? new Date().toISOString(),
        status: status === "starting" || status === "degraded" || status === "offline" ? status : "live",
        streamKeyFingerprint: stringOrNull(source.streamKeyFingerprint),
        title: stringOrNull(source.title) ?? (index === 0 ? "Primary DJ" : "Connecting DJ")
      };
    })
    .filter((source): source is StreamPlaybackSource => Boolean(source))
    .slice(0, 2);
}

function normalizeChannel(value: unknown): LiveStatusChannelPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const channel = value as Record<string, unknown>;
  const slug = stringOrNull(channel.slug);
  const title = stringOrNull(channel.title);

  if (!slug || !title) {
    return null;
  }

  return {
    slug,
    title,
    status: stringOrNull(channel.status) ?? "offline",
    playbackUrl: stringOrNull(channel.playbackUrl),
    offlineImageUrl: stringOrNull(channel.offlineImageUrl),
    streamProfile: channel.streamProfile && typeof channel.streamProfile === "object" ? (channel.streamProfile as StreamProfileSummary) : null
  };
}

export function normalizeLiveStatusPayload(value: unknown, current?: LiveStatusPayload | null): LiveStatusPayload | null {
  if (!value || typeof value !== "object") {
    return current ?? null;
  }

  const payload = value as Record<string, unknown>;

  return {
    activeIngests: normalizeActiveIngests(payload.activeIngests),
    channel: normalizeChannel(payload.channel),
    health: normalizeHealth(payload.health),
    offlineImageUrl: stringOrNull(payload.offlineImageUrl),
    playbackUrl: stringOrNull(payload.playbackUrl),
    provider: payload.provider,
    status: stringOrNull(payload.status) ?? current?.status ?? "offline",
    viewerCount: numberOrZero(payload.viewerCount)
  };
}

function publish(payload: LiveStatusPayload) {
  lastPayload = payload;

  for (const listener of listeners) {
    listener(payload);
  }
}

async function fetchAndPublishStatus() {
  try {
    const response = await fetch(statusFetchUrl, {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = normalizeLiveStatusPayload(await response.json(), lastPayload);

    if (payload) {
      publish(payload);
    }
  } catch {
    // The EventSource path can recover independently; keep the last known live state.
  }
}

function stopFallbackPolling() {
  if (fallbackPollTimer === null) {
    return;
  }

  window.clearInterval(fallbackPollTimer);
  fallbackPollTimer = null;
}

function startFallbackPolling() {
  if (fallbackPollTimer !== null) {
    return;
  }

  void fetchAndPublishStatus();
  fallbackPollTimer = window.setInterval(fetchAndPublishStatus, fallbackPollMs);
}

function startStatusStream() {
  if (!("EventSource" in window)) {
    startFallbackPolling();
    return;
  }

  eventSource = new EventSource(statusStreamUrl);
  eventSource.addEventListener("status", (event) => {
    try {
      const payload = normalizeLiveStatusPayload(JSON.parse(event.data), lastPayload);

      if (payload) {
        stopFallbackPolling();
        publish(payload);
      }
    } catch {
      startFallbackPolling();
    }
  });
  eventSource.onerror = () => {
    startFallbackPolling();
  };
}

function startLiveStatusFeed() {
  if (started || typeof window === "undefined") {
    return;
  }

  started = true;
  startStatusStream();
  void fetchAndPublishStatus();
}

function stopLiveStatusFeed() {
  eventSource?.close();
  eventSource = null;
  stopFallbackPolling();
  started = false;
}

export function subscribeToLiveStatus(listener: LiveStatusListener) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  listeners.add(listener);

  if (lastPayload) {
    window.queueMicrotask(() => {
      if (listeners.has(listener) && lastPayload) {
        listener(lastPayload);
      }
    });
  }

  startLiveStatusFeed();

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      stopLiveStatusFeed();
    }
  };
}
