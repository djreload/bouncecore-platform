import assert from "node:assert/strict";
import test from "node:test";
import { getTopDownloadedMusicTracks, orderMusicTracksOldestFirst } from "../src/lib/music/music-ranking.ts";

const tracks = [
  { createdAt: "2026-06-03T00:00:00.000Z", id: "third", successfulDownloads: 3, title: "Third" },
  { createdAt: "2026-06-01T00:00:00.000Z", id: "first", successfulDownloads: 8, title: "First" },
  { createdAt: "2026-06-02T00:00:00.000Z", id: "second", successfulDownloads: 12, title: "Second" }
];

test("music catalogue ordering is oldest to newest", () => {
  assert.deepEqual(
    orderMusicTracksOldestFirst(tracks).map((track) => track.id),
    ["first", "second", "third"]
  );
});

test("top downloaded tracks rank by successful downloads", () => {
  assert.deepEqual(
    getTopDownloadedMusicTracks(tracks, 2).map((track) => track.id),
    ["second", "first"]
  );
});

test("top downloaded tracks exclude tracks with zero downloads", () => {
  const ranked = getTopDownloadedMusicTracks(
    [
      ...tracks,
      { createdAt: "2026-06-04T00:00:00.000Z", id: "zero", successfulDownloads: 0, title: "Zero" }
    ],
    20
  );

  assert.equal(ranked.some((track) => track.id === "zero"), false);
});

test("top downloaded tracks are empty when no downloads are registered", () => {
  assert.deepEqual(
    getTopDownloadedMusicTracks([{ createdAt: "2026-06-04T00:00:00.000Z", id: "zero", successfulDownloads: 0, title: "Zero" }]),
    []
  );
});
