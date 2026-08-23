import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
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

  assert.match(content, /liveSyncDuration:\s*bufferSeconds/, "HLS live sync must use the configured buffer seconds");
  assert.match(content, /liveMaxLatencyDuration:\s*Math\.max\(bufferSeconds \+ 8, bufferSeconds \* 2\)/, "HLS max latency must scale with the configured buffer");
  assert.match(content, /maxLiveSyncPlaybackRate:\s*1[\s,]/, "HLS must never speed up live audio to catch up");
  assert.match(content, /playbackRate\s*=\s*1/, "shared helper must reset browser playback rate to 1x");
  assert.match(content, /const pendingPlaybackStarts = new WeakMap/, "concurrent play requests must be deduplicated");
  assert.match(content, /target > currentTime \+ minimumForwardSeekSeconds/, "buffer alignment must never seek healthy playback backwards");
  assert.match(content, /video\.addEventListener\("stalled", checkForStall\)/, "stalled events must wait for watchdog confirmation");
  assert.match(content, /video\.addEventListener\("waiting", checkForStall\)/, "normal buffer waits must not restart playback immediately");
  assert.match(content, /Date\.now\(\) - lastProgressAt >= liveStallRecoveryMs/, "helper must detect frozen mobile playback");
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
