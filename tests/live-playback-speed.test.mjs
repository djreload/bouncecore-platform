import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  connectionAdjustedPlaybackBufferSeconds,
  resolveLiveConnectionProfile,
  seekToBufferedLivePosition,
  startBufferedLivePlayback
} from "../src/components/live/live-playback-buffer.ts";

const livePlayerFiles = ["src/app/live/live-playback-player.tsx", "src/components/live/persistent-live-audio.tsx"];

for (const playerFile of livePlayerFiles) {
  test(`${playerFile} keeps live playback at normal speed`, () => {
    const content = readFileSync(join(process.cwd(), playerFile), "utf8");

    assert.match(content, /keepNormalPlaybackSpeed/, "player must reset browser playback rate to 1x");
    assert.match(content, /startBufferedLivePlayback/, "player must use the shared buffered live start helper");
    assert.match(content, /installLiveStallWatchdog/, "player must recover stale mobile live playback");
    assert.doesNotMatch(content, /maxLiveSyncPlaybackRate:\s*1\.[1-9]/, "accelerated live catch-up is not allowed");
  });
}

test("shared live playback helper uses admin buffer without catch-up acceleration", () => {
  const content = readFileSync(join(process.cwd(), "src/components/live/live-playback-buffer.ts"), "utf8");

  assert.match(content, /connectionAdjustedPlaybackBufferSeconds/, "HLS live sync must adapt the admin buffer to connection quality");
  assert.match(content, /liveSyncDuration:\s*bufferSeconds/, "HLS live sync must use the connection-adjusted buffer seconds");
  assert.match(content, /liveMaxLatencyDuration:\s*Math\.max\(bufferSeconds \+ 8, bufferSeconds \* 2\)/, "HLS max latency must scale with the configured buffer");
  assert.match(content, /maxLiveSyncPlaybackRate:\s*1[\s,]/, "HLS must never speed up live audio to catch up");
  assert.match(content, /playbackRate\s*=\s*1/, "shared helper must reset browser playback rate to 1x");
  assert.match(content, /const pendingPlaybackStarts = new WeakMap/, "concurrent play requests must be deduplicated");
  assert.match(content, /target > currentTime \+ minimumForwardSeekSeconds/, "buffer alignment must never seek healthy playback backwards");
  assert.match(content, /video\.addEventListener\("stalled", checkForStall\)/, "stalled events must wait for watchdog confirmation");
  assert.match(content, /video\.addEventListener\("waiting", checkForStall\)/, "normal buffer waits must not restart playback immediately");
  assert.match(content, /Date\.now\(\) - lastProgressAt >= liveStallRecoveryMs/, "helper must detect frozen mobile playback");
});

test("live connection profiles tune automatic quality and safety buffer", () => {
  const low = resolveLiveConnectionProfile({ downlink: 0.8, effectiveType: "4g" });
  const medium = resolveLiveConnectionProfile({ downlink: 3, effectiveType: "4g" });
  const high = resolveLiveConnectionProfile({ downlink: 20, effectiveType: "4g" });

  assert.deepEqual(
    { buffer: connectionAdjustedPlaybackBufferSeconds(4, low), height: low.maxAutoHeight, tier: low.tier },
    { buffer: 12, height: 240, tier: "low" }
  );
  assert.deepEqual(
    { buffer: connectionAdjustedPlaybackBufferSeconds(4, medium), height: medium.maxAutoHeight, tier: medium.tier },
    { buffer: 8, height: 480, tier: "medium" }
  );
  assert.deepEqual(
    { buffer: connectionAdjustedPlaybackBufferSeconds(6, high), height: high.maxAutoHeight, tier: high.tier },
    { buffer: 6, height: null, tier: "high" }
  );
  assert.equal(resolveLiveConnectionProfile({ saveData: true }).tier, "low");
});

test("buffer alignment only moves playback forward", () => {
  const video = {
    currentTime: 95,
    seekable: {
      end: () => 100,
      length: 1,
      start: () => 0
    }
  };

  seekToBufferedLivePosition(video, 10);
  assert.equal(video.currentTime, 95, "a healthy buffered position must not jump backwards");

  video.currentTime = 70;
  seekToBufferedLivePosition(video, 10);
  assert.equal(video.currentTime, 90, "a lagging position should advance to the configured buffer target");
});

test("starting an already-playing live video does not call play or seek again", async () => {
  let playCalls = 0;
  const video = {
    currentTime: 95,
    defaultPlaybackRate: 0,
    ended: false,
    paused: false,
    playbackRate: 1.2,
    play: async () => {
      playCalls += 1;
    },
    seekable: {
      end: () => 100,
      length: 1,
      start: () => 0
    }
  };

  await startBufferedLivePlayback(video, 10);

  assert.equal(playCalls, 0);
  assert.equal(video.currentTime, 95);
  assert.equal(video.playbackRate, 1);
});
