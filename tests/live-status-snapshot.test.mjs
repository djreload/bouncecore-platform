import assert from "node:assert/strict";
import test from "node:test";
import { liveStatusSignature } from "../src/lib/stream/live-status-snapshot.ts";

function livePayload(overrides = {}) {
  return {
    activeIngests: [],
    channel: {
      offlineImageUrl: null,
      playbackUrl: "https://example.test/live/master.m3u8",
      slug: "main",
      status: "offline",
      streamProfile: null,
      title: "Bouncecore Live"
    },
    health: {
      checkedAt: "2026-06-28T20:00:00.000Z",
      ingestConnected: false,
      status: "unknown"
    },
    offlineImageUrl: null,
    playbackUrl: "https://example.test/live/master.m3u8",
    provider: {
      activeIngests: [],
      health: {
        checkedAt: "2026-06-28T20:00:00.000Z",
        ingestConnected: false,
        status: "unknown"
      },
      playbackUrl: "https://example.test/live/master.m3u8",
      status: "offline",
      viewerCount: 0
    },
    status: "offline",
    viewerCount: 0,
    ...overrides
  };
}

test("live status signature changes when a stream becomes available", () => {
  const offline = livePayload();
  const live = livePayload({
    activeIngests: [
      {
        id: "primary",
        lastIngestAt: "2026-06-28T20:00:01.000Z",
        playbackUrl: "https://example.test/live/master.m3u8",
        presenterName: "Reload",
        role: "primary",
        startedAt: "2026-06-28T20:00:01.000Z",
        status: "live",
        streamKeyFingerprint: "abc123",
        title: "Reload"
      }
    ],
    health: {
      checkedAt: "2026-06-28T20:00:01.000Z",
      ingestConnected: true,
      status: "healthy"
    },
    status: "live"
  });

  assert.notEqual(liveStatusSignature(offline), liveStatusSignature(live));
});

test("live status signature ignores checkedAt-only heartbeat noise", () => {
  const first = livePayload({
    health: {
      checkedAt: "2026-06-28T20:00:00.000Z",
      ingestConnected: true,
      status: "healthy"
    },
    status: "live"
  });
  const second = livePayload({
    health: {
      checkedAt: "2026-06-28T20:00:01.000Z",
      ingestConnected: true,
      status: "healthy"
    },
    status: "live"
  });

  assert.equal(liveStatusSignature(first), liveStatusSignature(second));
});
