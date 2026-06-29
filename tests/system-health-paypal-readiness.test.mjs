import assert from "node:assert/strict";
import { test } from "node:test";
import { paypalIntegrationHealthChecks, productionReadinessStatus } from "../src/lib/admin/system-health.ts";

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
