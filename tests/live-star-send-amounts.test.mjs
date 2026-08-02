import assert from "node:assert/strict";
import test from "node:test";

import {
  liveStarSendAmounts,
  liveStarSendMaximum,
  normalizeLiveStarSendAmount
} from "../src/lib/stars/star-send-core.ts";

test("live chat star sends include amounts through 2,500", () => {
  assert.equal(liveStarSendMaximum, 2500);
  assert.deepEqual(liveStarSendAmounts, [10, 25, 50, 100, 250, 500, 1000, 2000, 2500]);
  assert.equal(normalizeLiveStarSendAmount("2500"), 2500);
});

test("live chat star sends reject unsupported and over-limit amounts", () => {
  assert.throws(() => normalizeLiveStarSendAmount("2501"), /up to 2,500/);
  assert.throws(() => normalizeLiveStarSendAmount("12.5"), /up to 2,500/);
  assert.throws(() => normalizeLiveStarSendAmount("not-a-number"), /up to 2,500/);
});
