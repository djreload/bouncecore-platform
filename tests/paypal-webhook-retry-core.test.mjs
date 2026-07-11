import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRetryPayPalWebhookStatus,
  retryablePayPalWebhookStatuses
} from "../src/lib/payments/paypal-webhook-retry-core.ts";

test("paypal webhook retry allows only failed or stuck received events", () => {
  assert.deepEqual(retryablePayPalWebhookStatuses, ["failed", "received"]);
  assert.equal(canRetryPayPalWebhookStatus("failed"), true);
  assert.equal(canRetryPayPalWebhookStatus("received"), true);
  assert.equal(canRetryPayPalWebhookStatus("retrying"), false);
  assert.equal(canRetryPayPalWebhookStatus("recorded"), false);
  assert.equal(canRetryPayPalWebhookStatus("duplicate"), false);
  assert.equal(canRetryPayPalWebhookStatus("shop-order-paid"), false);
});
