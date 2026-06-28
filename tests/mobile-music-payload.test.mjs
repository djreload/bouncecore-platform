import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileMusicPayload } from "../src/lib/mobile/music-payload-core.ts";

function track(overrides) {
  return {
    artworkUrl: null,
    bpm: null,
    createdAt: overrides.createdAt,
    genre: overrides.genre ?? "bounce",
    id: overrides.id,
    licenseSummary: null,
    licenseType: "personal",
    musicalKey: null,
    previewUrl: null,
    pricePence: overrides.pricePence ?? 100,
    producerBio: null,
    producerName: "Reload",
    producerSlug: "reload",
    slug: overrides.id,
    successfulDownloads: overrides.successfulDownloads,
    title: overrides.title ?? overrides.id
  };
}

test("mobile music payload exposes top tracks with registered downloads only", () => {
  const payload = buildMobileMusicPayload([
    track({ createdAt: "2026-06-01T00:00:00.000Z", id: "zero", successfulDownloads: 0 }),
    track({ createdAt: "2026-06-02T00:00:00.000Z", id: "one", successfulDownloads: 1 }),
    track({ createdAt: "2026-06-03T00:00:00.000Z", id: "five", successfulDownloads: 5 })
  ]);

  assert.deepEqual(
    payload.topTracks.map((topTrack) => topTrack.id),
    ["five", "one"]
  );
  assert.equal(payload.topTracks.some((topTrack) => topTrack.id === "zero"), false);
  assert.equal(payload.stats.totalDownloads, 6);
  assert.equal(payload.tracks.find((publicTrack) => publicTrack.id === "zero")?.successfulDownloads, 0);
});
