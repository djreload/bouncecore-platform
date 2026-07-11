import assert from "node:assert/strict";
import test from "node:test";
import {
  isLiveViewerPresencePath,
  normalizeLiveViewerId,
  normalizeLiveViewerPath
} from "../src/lib/presence/live-viewer-presence.ts";

test("live viewer presence accepts stable anonymous visitor ids", () => {
  assert.equal(normalizeLiveViewerId("8ddbb1d2-bde5-44d8-9970-1cc3f6e9f8e7"), "8ddbb1d2-bde5-44d8-9970-1cc3f6e9f8e7");
  assert.equal(normalizeLiveViewerId("short"), null);
  assert.equal(normalizeLiveViewerId("../bad"), null);
});

test("live viewer presence normalizes paths safely", () => {
  assert.equal(normalizeLiveViewerPath("https://example.test/live?x=1"), "/live");
  assert.equal(normalizeLiveViewerPath("/live/mobile"), "/live/mobile");
  assert.equal(normalizeLiveViewerPath("music"), "/music");
});

test("live viewer presence only counts live playback paths", () => {
  assert.equal(isLiveViewerPresencePath("/live"), true);
  assert.equal(isLiveViewerPresencePath("/live/mobile"), true);
  assert.equal(isLiveViewerPresencePath("/chat"), false);
});
