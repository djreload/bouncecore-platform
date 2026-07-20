import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProcessedRaveWarActionId,
  parseRaveWarClientActionId,
  raveWarProcessedActionLimit,
  shouldApplyRaveWarSnapshot
} from "../src/lib/rave-wars/rave-war-network-core.ts";

test("delayed Rave War snapshots cannot rewind newer game state", () => {
  assert.equal(shouldApplyRaveWarSnapshot(12, 11), false);
  assert.equal(shouldApplyRaveWarSnapshot(12, 12), true);
  assert.equal(shouldApplyRaveWarSnapshot(12, 13), true);
});

test("Rave War client action IDs are bounded and validated", () => {
  assert.equal(parseRaveWarClientActionId("move:12345678"), "move:12345678");
  assert.equal(parseRaveWarClientActionId(undefined), null);
  assert.throws(() => parseRaveWarClientActionId("bad id"), /action ID is invalid/);
});

test("processed Rave War actions are deduplicated and retain only the recent window", () => {
  let actionIds = [];

  for (let index = 0; index < raveWarProcessedActionLimit + 5; index += 1) {
    actionIds = appendProcessedRaveWarActionId(actionIds, `move:action-${String(index).padStart(3, "0")}`);
  }

  actionIds = appendProcessedRaveWarActionId(actionIds, actionIds[10]);

  assert.equal(actionIds.length, raveWarProcessedActionLimit);
  assert.equal(new Set(actionIds).size, actionIds.length);
  assert.equal(actionIds.at(-1), "move:action-015");
  assert.equal(actionIds.includes("move:action-000"), false);
});
