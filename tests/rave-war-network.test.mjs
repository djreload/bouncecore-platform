import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProcessedRaveWarActionId,
  getRaveWarNetworkQuality,
  incrementRaveWarNetworkCounter,
  initialRaveWarNetworkDiagnostics,
  parseRaveWarClientActionId,
  recordRaveWarLatency,
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

test("a long delayed and duplicated snapshot sequence never rewinds the battlefield", () => {
  const deliveries = [];

  for (let revision = 1; revision <= 500; revision += 1) {
    deliveries.push(revision, Math.max(0, revision - 3), revision);
  }

  deliveries.sort((first, second) => ((first * 97) % 509) - ((second * 97) % 509));
  deliveries.push(500);

  let currentRevision = 0;

  for (const incomingRevision of deliveries) {
    const previousRevision = currentRevision;

    if (shouldApplyRaveWarSnapshot(currentRevision, incomingRevision)) {
      currentRevision = incomingRevision;
    }

    assert.ok(currentRevision >= previousRevision);
  }

  assert.equal(currentRevision, 500);
});

test("network diagnostics smooth latency spikes and count recovery events", () => {
  let diagnostics = initialRaveWarNetworkDiagnostics;

  for (const latencyMs of [40, 80, 1200, 60]) {
    diagnostics = recordRaveWarLatency(diagnostics, latencyMs);
  }

  diagnostics = incrementRaveWarNetworkCounter(diagnostics, "reconnectCount");
  diagnostics = incrementRaveWarNetworkCounter(diagnostics, "fallbackCount");
  diagnostics = incrementRaveWarNetworkCounter(diagnostics, "actionRetryCount");
  diagnostics = incrementRaveWarNetworkCounter(diagnostics, "staleSnapshotCount");

  assert.equal(diagnostics.latencySampleCount, 4);
  assert.equal(diagnostics.averageLatencyMs, 269);
  assert.equal(diagnostics.peakLatencyMs, 1200);
  assert.equal(diagnostics.reconnectCount, 1);
  assert.equal(diagnostics.fallbackCount, 1);
  assert.equal(diagnostics.actionRetryCount, 1);
  assert.equal(diagnostics.staleSnapshotCount, 1);
  assert.equal(getRaveWarNetworkQuality("live", diagnostics.averageLatencyMs), "fair");
  assert.equal(getRaveWarNetworkQuality("polling", diagnostics.averageLatencyMs), "backup");
  assert.equal(getRaveWarNetworkQuality("reconnecting", diagnostics.averageLatencyMs), "recovering");
});
