import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { shouldMuteLiveAudio } from "../src/components/live/live-audio-focus.ts";

test("music preview audio focus temporarily mutes live audio without changing its preference", () => {
  assert.equal(shouldMuteLiveAudio(true, false), false);
  assert.equal(shouldMuteLiveAudio(true, true), true);
  assert.equal(shouldMuteLiveAudio(false, false), true);
  assert.equal(shouldMuteLiveAudio(false, true), true);
});

test("music sample players claim and release shared live audio focus", () => {
  const player = readFileSync(join(process.cwd(), "src/app/music/track-preview-player.tsx"), "utf8");
  const liveAudio = readFileSync(join(process.cwd(), "src/components/live/persistent-live-audio.tsx"), "utf8");
  const musicPage = readFileSync(join(process.cwd(), "src/app/music/page.tsx"), "utf8");

  assert.match(player, /onPlay=\{claimAudioFocus\}/);
  assert.match(player, /onPause=\{releaseAudioFocus\}/);
  assert.match(player, /onEnded=\{releaseAudioFocus\}/);
  assert.match(player, /musicPreviewStartedEvent/);
  assert.match(liveAudio, /audioFocusHoldersRef/);
  assert.match(liveAudio, /shouldMuteLiveAudio\(userEnabledRef\.current, audioFocusSuppressedRef\.current\)/);
  assert.match(musicPage, /<TrackPreviewPlayer/);
  assert.doesNotMatch(musicPage, /target="_blank"/);
});
