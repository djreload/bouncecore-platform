import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const livePlayerFiles = ["src/app/live/live-playback-player.tsx", "src/components/live/persistent-live-audio.tsx"];

for (const playerFile of livePlayerFiles) {
  test(`${playerFile} keeps live playback at normal speed`, () => {
    const content = readFileSync(join(process.cwd(), playerFile), "utf8");

    assert.match(content, /maxLiveSyncPlaybackRate:\s*1[\s,]/, "HLS live sync must not speed up audio");
    assert.match(content, /playbackRate\s*=\s*1/, "player must reset browser playback rate to 1x");
    assert.doesNotMatch(content, /maxLiveSyncPlaybackRate:\s*1\.[1-9]/, "accelerated live catch-up is not allowed");
  });
}
