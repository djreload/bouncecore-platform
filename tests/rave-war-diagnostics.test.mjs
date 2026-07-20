import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  analyzeRaveWarEventWindow,
  raveWarDiagnosticStaleMs,
  raveWarMatchNeedsAttention
} from "../src/lib/rave-wars/rave-war-diagnostics-core.ts";

test("Rave War diagnostics detect event gaps and duplicate accepted action IDs", () => {
  const diagnostics = analyzeRaveWarEventWindow(
    [
      { createdAt: new Date(100), payload: { clientActionId: "move:action-001" }, sequence: 2, type: "player.moved" },
      { createdAt: new Date(0), payload: { clientActionId: "move:action-001" }, sequence: 1, type: "player.moved" },
      { createdAt: new Date(700), payload: { clientActionId: "fire:action-002" }, sequence: 4, type: "shot.fired" }
    ],
    6
  );

  assert.equal(diagnostics.totalEventCount, 6);
  assert.equal(diagnostics.inspectedEventCount, 3);
  assert.equal(diagnostics.sequenceGapCount, 1);
  assert.equal(diagnostics.duplicateActionIdCount, 1);
  assert.equal(diagnostics.actionIdCount, 3);
  assert.equal(diagnostics.moveCount, 2);
  assert.equal(diagnostics.shotCount, 1);
  assert.equal(diagnostics.averageEventGapMs, 350);
  assert.equal(diagnostics.maxEventGapMs, 600);
  assert.equal(diagnostics.latestEventAt?.getTime(), 700);
});

test("Rave War diagnostics flag stalled active matches but not completed quiet matches", () => {
  const diagnostics = analyzeRaveWarEventWindow([], 0);
  const now = new Date(1_000_000);
  const staleUpdatedAt = new Date(now.getTime() - raveWarDiagnosticStaleMs - 1);

  assert.equal(raveWarMatchNeedsAttention({ diagnostics, now, status: "active", updatedAt: staleUpdatedAt }), true);
  assert.equal(raveWarMatchNeedsAttention({ diagnostics, now, status: "finished", updatedAt: staleUpdatedAt }), false);
});

test("Rave War diagnostics admin page is permission protected and linked in navigation", () => {
  const page = readFileSync(join(process.cwd(), "src/app/admin/rave-wars/page.tsx"), "utf8");
  const navigation = readFileSync(join(process.cwd(), "src/config/navigation.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-admin-service.ts"), "utf8");

  assert.match(page, /requireUserPermission\("settings\.manage"\)/);
  assert.match(page, /Rave War diagnostics/);
  assert.match(page, /Duplicate actions/);
  assert.match(navigation, /href: "\/admin\/rave-wars"/);
  assert.match(service, /take: raveWarEventInspectionLimit/);
  assert.match(service, /raveWarMatchNeedsAttention/);
});
