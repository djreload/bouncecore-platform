import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backupStatusHealthCheckFromValues,
  offsiteBackupStatusHealthCheckFromValues,
  paypalIntegrationHealthChecks,
  productionReadinessIssues,
  productionReadinessRepairHref,
  productionReadinessStatus
} from "../src/lib/admin/system-health.ts";

test("system health uses PayPal integration readiness instead of raw env-only checks", () => {
  const checks = paypalIntegrationHealthChecks({
    apiBaseUrl: "https://api-m.sandbox.paypal.com",
    secretConfigured: true,
    settings: {
      clientId: "stored-client-id",
      merchantEmail: "",
      merchantId: "",
      mode: "sandbox",
      producerPayoutsEnabled: true,
      shopEnabled: true,
      starsEnabled: true,
      webhookId: "stored-webhook-id"
    },
    checks: [
      {
        detail: "PAYPAL_CLIENT_ID or admin PayPal client ID.",
        label: "PayPal client ID",
        status: "ready",
        value: "Configured"
      },
      {
        detail: "PAYPAL_CLIENT_SECRET must stay in the server environment.",
        label: "PayPal client secret",
        status: "missing",
        value: "Missing"
      }
    ],
    useCases: []
  });

  assert.deepEqual(checks, [
    {
      detail: "PAYPAL_CLIENT_ID or admin PayPal client ID.",
      label: "PayPal client ID",
      status: "healthy",
      value: "Configured"
    },
    {
      detail: "PAYPAL_CLIENT_SECRET must stay in the server environment.",
      label: "PayPal client secret",
      status: "warning",
      value: "Missing"
    }
  ]);
});

test("production readiness status rolls up the highest severity item", () => {
  assert.equal(productionReadinessStatus([{ status: "healthy" }, { status: "healthy" }]), "healthy");
  assert.equal(productionReadinessStatus([{ status: "healthy" }, { status: "warning" }]), "warning");
  assert.equal(productionReadinessStatus([{ status: "warning" }, { status: "critical" }]), "critical");
});

test("production readiness repair links route common blockers to their admin surfaces", () => {
  assert.equal(productionReadinessRepairHref("PayPal client ID"), "/admin/payments");
  assert.equal(productionReadinessRepairHref("RTMPS ingest"), "/admin/stream");
  assert.equal(productionReadinessRepairHref("Mobile android push"), "/admin/mobile");
  assert.equal(productionReadinessRepairHref("Verified backups"), "/admin/storage");
  assert.equal(productionReadinessRepairHref("Off-server backups"), "/admin/storage");
  assert.equal(productionReadinessRepairHref("Stream provider"), undefined);
  assert.equal(productionReadinessRepairHref("Unknown check"), undefined);
});

test("backup status health check accepts fresh verified backups", () => {
  const check = backupStatusHealthCheckFromValues(
    new Map([
      ["status", "healthy"],
      ["verified_at", "2026-07-01T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260701T060000Z"],
      ["failures", "0"],
      ["warnings", "0"]
    ]),
    {
      maxAgeHours: 30,
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.label, "Verified backups");
  assert.equal(check.status, "healthy");
  assert.equal(check.value, "Fresh");
});

test("backup status health check warns on stale backups", () => {
  const check = backupStatusHealthCheckFromValues(
    new Map([
      ["status", "healthy"],
      ["verified_at", "2026-06-29T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260629T060000Z"]
    ]),
    {
      maxAgeHours: 30,
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.status, "warning");
  assert.equal(check.value, "Stale");
});

test("backup status health check marks failed verification critical", () => {
  const check = backupStatusHealthCheckFromValues(
    new Map([
      ["status", "failed"],
      ["verified_at", "2026-07-01T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260701T060000Z"],
      ["failures", "2"]
    ]),
    {
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.status, "critical");
  assert.equal(check.value, "Failed");
});

test("offsite backup status health check accepts fresh uploaded exports", () => {
  const check = offsiteBackupStatusHealthCheckFromValues(
    new Map([
      ["status", "healthy"],
      ["exported_at", "2026-07-01T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260701T060000Z"],
      ["uploaded", "true"],
      ["rclone_remote", "r2:bouncecore-backups/prod"]
    ]),
    {
      maxAgeHours: 30,
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.label, "Off-server backups");
  assert.equal(check.status, "healthy");
  assert.equal(check.value, "Fresh");
});

test("offsite backup status warns when export is local only", () => {
  const check = offsiteBackupStatusHealthCheckFromValues(
    new Map([
      ["status", "healthy"],
      ["exported_at", "2026-07-01T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260701T060000Z"],
      ["uploaded", "false"],
      ["rclone_remote", ""]
    ]),
    {
      maxAgeHours: 30,
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.status, "warning");
  assert.equal(check.value, "Local only");
});

test("offsite backup status warns on stale exports", () => {
  const check = offsiteBackupStatusHealthCheckFromValues(
    new Map([
      ["status", "healthy"],
      ["exported_at", "2026-06-29T06:00:00Z"],
      ["backup_dir", "/srv/bouncecore-backups/20260629T060000Z"],
      ["uploaded", "true"],
      ["rclone_remote", "r2:bouncecore-backups/prod"]
    ]),
    {
      maxAgeHours: 30,
      now: new Date("2026-07-01T08:00:00Z")
    }
  );

  assert.equal(check.status, "warning");
  assert.equal(check.value, "Stale");
});

test("production readiness issues flatten and prioritize critical launch blockers", () => {
  const issues = productionReadinessIssues([
    {
      description: "Streaming",
      id: "streaming",
      status: "warning",
      title: "Streaming",
      items: [
        {
          detail: "Missing playback URL",
          label: "Playback URL",
          status: "warning",
          value: "Missing"
        }
      ]
    },
    {
      description: "Payments",
      id: "payments",
      status: "critical",
      title: "Payments",
      items: [
        {
          detail: "Paid delivery missing",
          label: "Paid track delivery",
          status: "critical",
          value: "1 track"
        },
        {
          detail: "Configured",
          label: "PayPal client ID",
          status: "healthy",
          value: "Configured"
        }
      ]
    }
  ]);

  assert.deepEqual(
    issues.map((issue) => [issue.groupTitle, issue.label, issue.status]),
    [
      ["Payments", "Paid track delivery", "critical"],
      ["Streaming", "Playback URL", "warning"]
    ]
  );
});

test("production readiness issues de-duplicate repeated labels across groups", () => {
  const issues = productionReadinessIssues([
    {
      description: "Email",
      id: "email",
      status: "warning",
      title: "Email",
      items: [
        {
          detail: "Missing support email",
          label: "Site support email",
          status: "warning",
          value: "missing"
        }
      ]
    },
    {
      description: "Legal",
      id: "legal",
      status: "warning",
      title: "Legal",
      items: [
        {
          detail: "Missing support email",
          label: "Site support email",
          status: "warning",
          value: "missing"
        }
      ]
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].groupTitle, "Email");
});
