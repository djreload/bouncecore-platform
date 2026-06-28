import assert from "node:assert/strict";
import test from "node:test";
import { buildMobilePayPalCheckoutStatus } from "../src/lib/mobile/paypal-checkout-status.ts";

test("mobile PayPal checkout status exposes only safe readiness fields", () => {
  assert.deepEqual(
    buildMobilePayPalCheckoutStatus({
      mode: "sandbox",
      ready: false,
      reason: "PayPal client secret is missing."
    }),
    {
      mode: "sandbox",
      provider: "paypal",
      ready: false,
      reason: "PayPal client secret is missing."
    }
  );
});
