import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { weeklyStarLeaderboardWindow } from "../src/lib/stars/star-send-service.ts";

const starServiceSource = readFileSync(new URL("../src/lib/stars/star-send-service.ts", import.meta.url), "utf8");
const rewardsPageSource = readFileSync(new URL("../src/app/rewards/page.tsx", import.meta.url), "utf8");

test("star leaderboard window is the current UTC week", () => {
  const window = weeklyStarLeaderboardWindow(new Date("2026-07-03T12:34:56.000Z"));

  assert.equal(window.label, "This week");
  assert.equal(window.startsAt.toISOString(), "2026-06-29T00:00:00.000Z");
  assert.equal(window.endsAt.toISOString(), "2026-07-06T00:00:00.000Z");
});

test("rewards expose weekly and all-time live chat star leaderboards", () => {
  assert.match(starServiceSource, /allTimeLeaderboard/);
  assert.match(starServiceSource, /where: liveRoomWhere/);
  assert.match(rewardsPageSource, /lg:grid-cols-2/);
  assert.match(rewardsPageSource, /Weekly stars leaderboard/);
  assert.match(rewardsPageSource, /All Time stars leaderboard/);
  assert.match(rewardsPageSource, /rows=\{data\.allTimeLeaderboard\}/);
});
