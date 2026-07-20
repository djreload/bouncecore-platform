import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("the worker authoritatively reconciles Rave War deadlines", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const worker = readFileSync(join(process.cwd(), "src/workers/main.ts"), "utf8");

  assert.match(service, /export async function reconcileRaveWarDeadlines/);
  assert.match(service, /const expiredChallengeCount = await expireStaleRaveWarChallenges\(\)/);
  assert.match(service, /finishExpiredActiveRaveWarIfNeeded\(war, war\.challengerId\)/);
  assert.match(service, /advanceExpiredTurnIfNeeded\(reconciledWar, war\.challengerId\)/);
  assert.match(service, /action: "chat\.rave_war\.deadlines\.reconcile"/);
  assert.match(worker, /name: "rave-war-deadline-reconcile"/);
  assert.match(worker, /WORKER_RAVE_WAR_RECONCILE_INTERVAL_SECONDS/);
  assert.match(worker, /run: reconcileRaveWarDeadlines/);
});

test("deadline reconciliation reuses normal result, event, chat, and realtime paths", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(service, /type: "war\.finished"/);
  assert.match(service, /reason: "timeout"/);
  assert.match(service, /kind: "rave-war"/);
  assert.match(service, /publishChatRoomChanged\(war\.roomId, result\.message\.id\)/);
  assert.match(service, /publishRaveWarChanged\(war\.id, result\.event\.id\)/);
});

test("expired matches are settled instead of reported as stalled incidents", () => {
  const alerts = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-operator-alert-service.ts"), "utf8");

  assert.match(alerts, /matchDeadlineHasPassed/);
  assert.match(alerts, /startedAt\.getTime\(\) \+ raveWarMatchSeconds \* 1000/);
  assert.match(alerts, /!matchDeadlineHasPassed\(war\.state, war\.startedAt, now\.getTime\(\)\)/);
});
