import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paymentReconciliationRisk,
  paymentReconciliationStaleCutoff,
  stalePendingPaymentMinutes
} from "../src/lib/payments/payment-reconciliation-service.ts";

test("payment reconciliation stale cutoff uses the production pending threshold", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");

  assert.equal(stalePendingPaymentMinutes, 30);
  assert.equal(paymentReconciliationStaleCutoff(now).toISOString(), "2026-06-29T11:30:00.000Z");
});

test("payment reconciliation risks distinguish clean warning and critical states", () => {
  assert.deepEqual(
    paymentReconciliationRisk({
      count: 0,
      detail: "Needs repair.",
      healthyDetail: "No repair needed.",
      href: "/admin/payments",
      label: "Webhook failures",
      plural: "events",
      singular: "event"
    }),
    {
      detail: "No repair needed.",
      href: "/admin/payments",
      label: "Webhook failures",
      level: "healthy",
      value: "Clean"
    }
  );

  assert.deepEqual(
    paymentReconciliationRisk({
      count: 1,
      critical: true,
      detail: "Needs repair.",
      healthyDetail: "No repair needed.",
      href: "/admin/payments",
      label: "Webhook failures",
      plural: "events",
      singular: "event"
    }),
    {
      detail: "Needs repair.",
      href: "/admin/payments",
      label: "Webhook failures",
      level: "critical",
      value: "1 event"
    }
  );
});
