import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultStreamPlaybackSettings,
  normalizePlaybackBufferSeconds,
  normalizeStreamPlaybackSettings,
  streamPlaybackBufferLimits
} from "../src/lib/stream/stream-playback-settings.ts";

test("stream playback settings default to a small live buffer", () => {
  assert.equal(defaultStreamPlaybackSettings.playbackBufferSeconds, 4);
  assert.deepEqual(normalizeStreamPlaybackSettings(null), defaultStreamPlaybackSettings);
});

test("stream playback settings clamp unsafe admin values", () => {
  assert.equal(normalizePlaybackBufferSeconds(-30), streamPlaybackBufferLimits.min);
  assert.equal(normalizePlaybackBufferSeconds(999), streamPlaybackBufferLimits.max);
  assert.equal(normalizePlaybackBufferSeconds("7"), 7);
});
