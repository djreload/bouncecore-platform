import assert from "node:assert/strict";
import test from "node:test";

import {
  liveStarSendAmounts,
  liveStarSendMaximum,
  normalizeLiveStarSendAmount
} from "../src/lib/stars/star-send-service.ts";

test("live chat star sends include amounts through 2,000", () => {
  assert.equal(liveStarSendMaximum, 2000);
  assert.deepEqual(liveStarSendAmounts, [10, 25, 50, 100, 250, 500, 1000, 2000]);
  assert.equal(normalizeLiveStarSendAmount("2000"), 2000);
});

test("live chat star sends reject unsupported and over-limit amounts", () => {
  assert.throws(() => normalizeLiveStarSendAmount("2001"), /up to 2,000/);
  assert.throws(() => normalizeLiveStarSendAmount("12.5"), /up to 2,000/);
  assert.throws(() => normalizeLiveStarSendAmount("not-a-number"), /up to 2,000/);
});
