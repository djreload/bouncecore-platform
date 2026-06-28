import assert from "node:assert/strict";
import test from "node:test";
import {
  createActiveIngestId,
  removeActiveIngestState,
  sortActiveIngests,
  toPublicActiveIngests,
  upsertActiveIngestState
} from "../src/lib/stream/active-ingest-state.ts";

function ingest(overrides) {
  const ingestPath = overrides.ingestPath ?? `live/${overrides.id}`;
  const streamKeyFingerprint = overrides.streamKeyFingerprint ?? overrides.id;

  return {
    bitrateKbps: null,
    channelId: null,
    channelSlug: null,
    channelTitle: overrides.channelTitle ?? overrides.id,
    directPlaybackUrl: null,
    droppedFrames: null,
    id: overrides.id ?? createActiveIngestId(ingestPath, streamKeyFingerprint),
    ingestPath,
    lastIngestAt: overrides.lastIngestAt ?? "2026-06-28T12:00:20.000Z",
    playbackUrl: overrides.playbackUrl ?? `/hls/${overrides.id}.m3u8`,
    presenterName: overrides.presenterName ?? overrides.id,
    startedAt: overrides.startedAt ?? "2026-06-28T12:00:00.000Z",
    status: overrides.status ?? "live",
    streamKeyFingerprint,
    streamProfile: null,
    viewerCount: 0
  };
}

const freshOptions = {
  maxActiveIngests: 2,
  now: new Date("2026-06-28T12:00:25.000Z"),
  offlineAfterSeconds: 60
};

test("oldest active DJ is primary and second active DJ is secondary", () => {
  const newest = ingest({
    id: "dj-two",
    startedAt: "2026-06-28T12:00:10.000Z"
  });
  const oldest = ingest({
    id: "dj-one",
    startedAt: "2026-06-28T12:00:00.000Z"
  });

  const publicIngests = toPublicActiveIngests(sortActiveIngests([newest, oldest], freshOptions), (activeIngest, index) =>
    index === 0 ? "/primary.m3u8" : activeIngest.playbackUrl
  );

  assert.equal(publicIngests[0]?.id, "dj-one");
  assert.equal(publicIngests[0]?.role, "primary");
  assert.equal(publicIngests[0]?.playbackUrl, "/primary.m3u8");
  assert.equal(publicIngests[1]?.id, "dj-two");
  assert.equal(publicIngests[1]?.role, "secondary");
});

test("secondary DJ is promoted when the primary disconnects", () => {
  const primary = ingest({
    id: "dj-one",
    ingestPath: "live/dj-one",
    startedAt: "2026-06-28T12:00:00.000Z"
  });
  const secondary = ingest({
    id: "dj-two",
    ingestPath: "live/dj-two",
    startedAt: "2026-06-28T12:00:10.000Z"
  });

  const result = removeActiveIngestState([primary, secondary], { path: "live/dj-one" }, freshOptions);
  const publicIngests = toPublicActiveIngests(result.activeIngests, (activeIngest) => activeIngest.playbackUrl);

  assert.equal(result.removed, true);
  assert.equal(publicIngests.length, 1);
  assert.equal(publicIngests[0]?.id, "dj-two");
  assert.equal(publicIngests[0]?.role, "primary");
});

test("active ingest state rejects a third new DJ but accepts existing heartbeats", () => {
  const first = ingest({
    id: "dj-one",
    startedAt: "2026-06-28T12:00:00.000Z"
  });
  const second = ingest({
    id: "dj-two",
    startedAt: "2026-06-28T12:00:10.000Z"
  });
  const third = ingest({
    id: "dj-three",
    startedAt: "2026-06-28T12:00:20.000Z"
  });

  const rejected = upsertActiveIngestState([first, second], third, freshOptions);

  assert.equal(rejected.accepted, false);
  assert.deepEqual(
    rejected.activeIngests.map((activeIngest) => activeIngest.id),
    ["dj-one", "dj-two"]
  );

  const heartbeat = {
    ...second,
    bitrateKbps: 4200,
    lastIngestAt: "2026-06-28T12:00:25.000Z"
  };
  const accepted = upsertActiveIngestState([first, second], heartbeat, freshOptions);

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.activeIngests.length, 2);
  assert.equal(accepted.activeIngests[1]?.bitrateKbps, 4200);
});

test("inactive and offline ingests are filtered out before playback mapping", () => {
  const live = ingest({
    id: "dj-live",
    lastIngestAt: "2026-06-28T12:00:20.000Z"
  });
  const stale = ingest({
    id: "dj-stale",
    lastIngestAt: "2026-06-28T11:58:00.000Z"
  });
  const offline = ingest({
    id: "dj-offline",
    status: "offline"
  });

  assert.deepEqual(
    sortActiveIngests([stale, offline, live], freshOptions).map((activeIngest) => activeIngest.id),
    ["dj-live"]
  );
});
