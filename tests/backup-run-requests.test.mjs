import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backupRunRequestFromValues,
  backupRunStatusFromValues,
  manualBackupRunHealthCheckFromData,
  parseBackupEnvFile
} from "../src/lib/admin/backup-run-requests.ts";

test("manual backup request parser accepts valid request files", () => {
  const request = backupRunRequestFromValues(
    parseBackupEnvFile(
      [
        "request_id=123e4567-e89b-12d3-a456-426614174000",
        "requested_at=2026-07-01T20:00:00.000Z",
        "requested_by=user_123"
      ].join("\n")
    )
  );

  assert.deepEqual(request, {
    requestId: "123e4567-e89b-12d3-a456-426614174000",
    requestedAt: "2026-07-01T20:00:00.000Z",
    requestedBy: "user_123"
  });
});

test("manual backup request parser rejects invalid request files", () => {
  assert.equal(
    backupRunRequestFromValues(
      parseBackupEnvFile(
        [
          "request_id=bad value with spaces",
          "requested_at=2026-07-01T20:00:00.000Z",
          "requested_by=user_123"
        ].join("\n")
      )
    ),
    null
  );
});

test("manual backup status parser normalizes known states", () => {
  const status = backupRunStatusFromValues(
    parseBackupEnvFile(
      [
        "status=completed",
        "request_id=123e4567-e89b-12d3-a456-426614174000",
        "requested_at=2026-07-01T20:00:00.000Z",
        "requested_by=user_123",
        "started_at=2026-07-01T20:01:00Z",
        "completed_at=2026-07-01T20:05:00Z",
        "exit_code=0",
        "backup_dir=/srv/bouncecore-backups/20260701T200100Z",
        "log_file=/srv/bouncecore-backups/admin-backup-request.log",
        "message=Manual verified backup completed successfully."
      ].join("\n")
    )
  );

  assert.equal(status.status, "completed");
  assert.equal(status.exitCode, 0);
  assert.equal(status.backupDir, "/srv/bouncecore-backups/20260701T200100Z");
  assert.equal(status.message, "Manual verified backup completed successfully.");
});

test("manual backup status parser handles unknown status safely", () => {
  const status = backupRunStatusFromValues(parseBackupEnvFile("status=surprise\nexit_code=nope\n"));

  assert.equal(status.status, "unknown");
  assert.equal(status.exitCode, null);
  assert.equal(status.message, "No manual backup request has been processed yet.");
});

const emptyStatus = {
  backupDir: null,
  completedAt: null,
  exitCode: null,
  logFile: null,
  message: "No manual backup request has been processed yet.",
  requestId: null,
  requestedAt: null,
  requestedBy: null,
  startedAt: null,
  status: "none"
};

test("manual backup health is healthy while idle", () => {
  const check = manualBackupRunHealthCheckFromData({
    request: null,
    status: emptyStatus
  });

  assert.equal(check.label, "Manual backup requests");
  assert.equal(check.status, "healthy");
  assert.equal(check.value, "Idle");
});

test("manual backup health warns when queued requests are stale", () => {
  const check = manualBackupRunHealthCheckFromData(
    {
      request: {
        requestId: "request-1",
        requestedAt: "2026-07-01T20:00:00Z",
        requestedBy: "user_123"
      },
      status: {
        ...emptyStatus,
        requestId: "request-1",
        requestedAt: "2026-07-01T20:00:00Z",
        requestedBy: "user_123",
        status: "queued"
      }
    },
    {
      now: new Date("2026-07-01T20:07:00Z"),
      queuedWarningMinutes: 5
    }
  );

  assert.equal(check.status, "warning");
  assert.equal(check.value, "Queued too long");
  assert.match(check.detail, /host request timer/);
});

test("manual backup health allows fresh queued requests", () => {
  const check = manualBackupRunHealthCheckFromData(
    {
      request: {
        requestId: "request-1",
        requestedAt: "2026-07-01T20:00:00Z",
        requestedBy: "user_123"
      },
      status: {
        ...emptyStatus,
        requestId: "request-1",
        requestedAt: "2026-07-01T20:00:00Z",
        requestedBy: "user_123",
        status: "queued"
      }
    },
    {
      now: new Date("2026-07-01T20:02:00Z"),
      queuedWarningMinutes: 5
    }
  );

  assert.equal(check.status, "healthy");
  assert.equal(check.value, "Queued");
});

test("manual backup health warns when running too long", () => {
  const check = manualBackupRunHealthCheckFromData(
    {
      request: null,
      status: {
        ...emptyStatus,
        requestId: "request-2",
        startedAt: "2026-07-01T16:00:00Z",
        status: "running"
      }
    },
    {
      now: new Date("2026-07-01T20:00:00Z"),
      runningWarningMinutes: 180
    }
  );

  assert.equal(check.status, "warning");
  assert.equal(check.value, "Long running");
});

test("manual backup health reports failed and completed requests", () => {
  const failed = manualBackupRunHealthCheckFromData({
    request: null,
    status: {
      ...emptyStatus,
      message: "Manual backup failed. Inspect the host log file.",
      status: "failed"
    }
  });
  const completed = manualBackupRunHealthCheckFromData({
    request: null,
    status: {
      ...emptyStatus,
      backupDir: "/srv/bouncecore-backups/20260701T200000Z",
      completedAt: "2026-07-01T20:05:00Z",
      status: "completed"
    }
  });

  assert.equal(failed.status, "warning");
  assert.equal(failed.value, "Last failed");
  assert.equal(completed.status, "healthy");
  assert.equal(completed.value, "Last completed");
});
