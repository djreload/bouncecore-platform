import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paypalWebhookDetailHref,
  paypalWebhookPayloadPreview,
  paypalWebhookPayloadPreviewMaxChars
} from "../src/lib/payments/paypal-webhook-detail-core.ts";

test("paypal webhook payload preview formats and truncates safely", () => {
  const preview = paypalWebhookPayloadPreview({ event_type: "PAYMENT.CAPTURE.COMPLETED", id: "WH-123" });

  assert.match(preview, /PAYMENT\.CAPTURE\.COMPLETED/);
  assert.match(preview, /WH-123/);

  const truncated = paypalWebhookPayloadPreview({ value: "x".repeat(paypalWebhookPayloadPreviewMaxChars + 200) }, 80);

  assert.ok(truncated.length < 120);
  assert.match(truncated, /\.\.\. truncated$/);
});

test("paypal webhook detail links encode event ids", () => {
  assert.equal(paypalWebhookDetailHref("event/one two"), "/admin/payments/webhooks/event%2Fone%20two");
});
