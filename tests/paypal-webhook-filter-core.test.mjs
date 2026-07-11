import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePayPalWebhookFilters,
  paypalWebhookDefaultLimit,
  paypalWebhookMaxLimit,
  paypalWebhookStatusFilterOptions
} from "../src/lib/payments/paypal-webhook-filter-core.ts";

test("paypal webhook filters normalize text and detect active filters", () => {
  assert.deepEqual(normalizePayPalWebhookFilters(), {
    eventType: "",
    hasFilters: false,
    limit: paypalWebhookDefaultLimit,
    query: "",
    status: ""
  });

  assert.deepEqual(
    normalizePayPalWebhookFilters({
      eventType: " PAYMENT.CAPTURE ",
      query: " WH-123 ",
      status: " failed "
    }),
    {
      eventType: "PAYMENT.CAPTURE",
      hasFilters: true,
      limit: paypalWebhookDefaultLimit,
      query: "WH-123",
      status: "failed"
    }
  );
});

test("paypal webhook filters clamp limits and expose common statuses", () => {
  assert.equal(normalizePayPalWebhookFilters({ limit: "not-a-number" }).limit, paypalWebhookDefaultLimit);
  assert.equal(normalizePayPalWebhookFilters({ limit: "0" }).limit, 1);
  assert.equal(normalizePayPalWebhookFilters({ limit: "999" }).limit, paypalWebhookMaxLimit);
  assert.ok(paypalWebhookStatusFilterOptions.includes("failed"));
  assert.ok(paypalWebhookStatusFilterOptions.includes("received"));
});
