import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("live page replaces provider diagnostics with both star leaderboards", () => {
  const livePage = readFileSync(join(process.cwd(), "src/app/live/page.tsx"), "utf8");
  const leaderboard = readFileSync(join(process.cwd(), "src/app/live/star-support-panel.tsx"), "utf8");

  assert.doesNotMatch(livePage, />Stream status</);
  assert.doesNotMatch(livePage, />Stream health</);
  assert.match(livePage, /<LiveStarLeaderboards initialData=\{starSupport\}/);
  assert.match(leaderboard, /Weekly stars leaderboard/);
  assert.match(leaderboard, /All Time stars leaderboard/);
});

test("upcoming sets card is controlled by the disabled-by-default player setting", () => {
  const livePage = readFileSync(join(process.cwd(), "src/app/live/page.tsx"), "utf8");
  const settings = readFileSync(join(process.cwd(), "src/lib/stream/stream-playback-settings.ts"), "utf8");
  const admin = readFileSync(join(process.cwd(), "src/app/admin/stream/stream-control-panel.tsx"), "utf8");

  assert.match(settings, /showUpcomingSets:\s*false/);
  assert.match(livePage, /playbackSettings\.showUpcomingSets\s*\?/);
  assert.match(admin, /name="showUpcomingSets"/);
});

test("live player auto-hides custom hover and touch controls while preserving HLS quality selection", () => {
  const player = readFileSync(join(process.cwd(), "src/app/live/live-playback-player.tsx"), "utf8");
  const persistentPlayer = readFileSync(join(process.cwd(), "src/components/live/persistent-live-audio.tsx"), "utf8");

  assert.match(player, /data-live-player-controls/);
  assert.match(player, /data-controls-visible/);
  assert.match(player, /handlePlayerPress/);
  assert.match(player, /3_200/);
  assert.match(player, /group-hover:opacity-100/);
  assert.match(player, /viewerCount\.toLocaleString/);
  assert.match(player, /selectLivePlayerQuality/);
  assert.match(player, /requestFullscreen/);
  assert.match(player, /requestPictureInPicture/);
  assert.match(persistentPlayer, /Hls\.Events\.LEVEL_SWITCHED/);
  assert.match(persistentPlayer, /livePlayerQualityRequestEvent/);
  assert.match(persistentPlayer, /video\.controls = false/);
});
