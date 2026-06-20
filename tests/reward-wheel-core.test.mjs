import assert from "node:assert/strict";
import test from "node:test";
import {
  getRewardWheelCooldownState,
  getRewardWheelTotalWeight,
  pickWeightedRewardSegment,
  rewardWheelResultStatus
} from "../src/lib/rewards/reward-wheel-core.ts";

const segments = [
  { id: "try-again", status: "active", weight: 50 },
  { id: "sticker-pack", status: "active", weight: 30 },
  { id: "vip-shoutout", status: "active", weight: 20 },
  { id: "disabled", status: "disabled", weight: 999 }
];

test("reward wheel total weight only includes active weighted segments", () => {
  assert.equal(getRewardWheelTotalWeight(segments), 100);
});

test("reward wheel weighted picking returns deterministic segments by random value", () => {
  assert.equal(pickWeightedRewardSegment(segments, 0).id, "try-again");
  assert.equal(pickWeightedRewardSegment(segments, 0.5).id, "sticker-pack");
  assert.equal(pickWeightedRewardSegment(segments, 0.81).id, "vip-shoutout");
  assert.equal(pickWeightedRewardSegment(segments, 1).id, "vip-shoutout");
});

test("reward wheel rejects spins when no active weighted segment exists", () => {
  assert.throws(
    () => pickWeightedRewardSegment([{ id: "empty", status: "disabled", weight: 10 }], 0.5),
    /at least one active weighted segment/
  );
});

test("reward wheel cooldown reports availability and retry time", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");
  const coolingDown = getRewardWheelCooldownState({
    cooldownMinutes: 30,
    lastSpinAt: "2026-06-20T11:45:00.000Z",
    now
  });

  assert.equal(coolingDown.available, false);
  assert.equal(coolingDown.remainingSeconds, 900);
  assert.equal(coolingDown.retryAt?.toISOString(), "2026-06-20T12:15:00.000Z");

  assert.equal(
    getRewardWheelCooldownState({
      cooldownMinutes: 30,
      lastSpinAt: "2026-06-20T11:00:00.000Z",
      now
    }).available,
    true
  );
});

test("reward wheel none result is fulfilled while real prizes stay pending", () => {
  assert.equal(rewardWheelResultStatus("none"), "fulfilled");
  assert.equal(rewardWheelResultStatus("merch"), "pending");
});
