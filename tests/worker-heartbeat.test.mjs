import assert from "node:assert/strict";
import test from "node:test";
import { getWorkerHeartbeatStatus, parseWorkerHeartbeat } from "../src/lib/workers/worker-heartbeat-core.ts";

test("parseWorkerHeartbeat accepts valid worker heartbeat payloads", () => {
  const heartbeat = parseWorkerHeartbeat({
    checkedAt: "2026-06-15T12:00:00.000Z",
    service: "bouncecore-worker",
    tasks: [
      {
        enabled: true,
        intervalMs: 15000,
        name: "stream-provider-sync"
      },
      {
        enabled: false,
        intervalMs: 60000,
        name: "mobile-push-dispatch"
      }
    ]
  });

  assert.deepEqual(heartbeat, {
    checkedAt: "2026-06-15T12:00:00.000Z",
    service: "bouncecore-worker",
    tasks: [
      {
        enabled: true,
        intervalMs: 15000,
        name: "stream-provider-sync"
      },
      {
        enabled: false,
        intervalMs: 60000,
        name: "mobile-push-dispatch"
      }
    ]
  });
});

test("worker heartbeat status is healthy while fresh", () => {
  const status = getWorkerHeartbeatStatus(
    {
      checkedAt: "2026-06-15T12:00:00.000Z",
      service: "bouncecore-worker",
      tasks: [{ enabled: true, intervalMs: 15000, name: "stream-provider-sync" }]
    },
    {
      now: new Date("2026-06-15T12:00:30.000Z"),
      staleAfterSeconds: 120
    }
  );

  assert.equal(status.status, "healthy");
  assert.equal(status.value, "30s ago");
  assert.match(status.detail, /1\/1 worker tasks enabled/);
});

test("worker heartbeat status warns when no heartbeat exists", () => {
  const status = getWorkerHeartbeatStatus(null);

  assert.equal(status.status, "warning");
  assert.equal(status.value, "Not recorded");
});

test("worker heartbeat status becomes critical when stale", () => {
  const status = getWorkerHeartbeatStatus(
    {
      checkedAt: "2026-06-15T12:00:00.000Z",
      service: "bouncecore-worker",
      tasks: [{ enabled: true, intervalMs: 15000, name: "stream-provider-sync" }]
    },
    {
      now: new Date("2026-06-15T12:03:00.000Z"),
      staleAfterSeconds: 120
    }
  );

  assert.equal(status.status, "critical");
  assert.equal(status.value, "180s stale");
});

test("worker heartbeat status warns on malformed timestamps", () => {
  const heartbeat = parseWorkerHeartbeat({
    checkedAt: "not-a-date",
    service: "bouncecore-worker",
    tasks: []
  });
  const status = getWorkerHeartbeatStatus(heartbeat);

  assert.equal(status.status, "warning");
  assert.equal(status.value, "Invalid");
});
