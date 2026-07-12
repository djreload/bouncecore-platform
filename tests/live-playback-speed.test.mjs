import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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
  assert.match(content, /video\.currentTime\s*=\s*Math\.max\(start, end - bufferSeconds\)/, "player should start behind live edge");
  assert.match(content, /video\.addEventListener\("stalled", recoverIfNeeded\)/, "helper must recover stalled media events");
  assert.match(content, /video\.addEventListener\("waiting", recoverIfNeeded\)/, "helper must recover waiting media events");
  assert.match(content, /Date\.now\(\) - lastProgressAt >= liveStallRecoveryMs/, "helper must detect frozen mobile playback");
});
