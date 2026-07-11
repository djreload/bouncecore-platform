import assert from "node:assert/strict";
import test from "node:test";
import { weeklyStarLeaderboardWindow } from "../src/lib/stars/star-send-service.ts";

test("star leaderboard window is the current UTC week", () => {
  const window = weeklyStarLeaderboardWindow(new Date("2026-07-03T12:34:56.000Z"));

  assert.equal(window.label, "This week");
  assert.equal(window.startsAt.toISOString(), "2026-06-29T00:00:00.000Z");
  assert.equal(window.endsAt.toISOString(), "2026-07-06T00:00:00.000Z");
});
