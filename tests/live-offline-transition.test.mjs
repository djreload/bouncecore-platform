import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("offline artwork cannot be covered by the persistent live video", () => {
  const persistentPlayer = readFileSync(
    join(process.cwd(), "src/components/live/persistent-live-audio.tsx"),
    "utf8"
  );
  const livePlayer = readFileSync(join(process.cwd(), "src/app/live/live-playback-player.tsx"), "utf8");

  assert.match(persistentPlayer, /liveVideoSlotSelector = '\[data-live-primary-video-slot="true"\]'/);
  assert.match(persistentPlayer, /if \(!canPlay \|\| !isLivePath\(pathname\)\) \{\s*parkVideo\(\)/);
  assert.match(persistentPlayer, /\[canPlay, parkVideo, pathname, updateVideoPlacement\]/);
  assert.match(livePlayer, /data-live-primary-video-slot="true"/);
  assert.match(livePlayer, /data-live-offline-image-slot="true"/);
  assert.doesNotMatch(livePlayer, /data-live-primary-video-slot="offline"/);
});
