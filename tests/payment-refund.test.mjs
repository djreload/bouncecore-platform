import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { nextRefundTotal, paymentRefundStatus, proportionalStarRefund } from "../src/lib/payments/payment-refund-core.ts";

test("payment refund totals clamp and distinguish partial from full refunds", () => {
  assert.equal(nextRefundTotal(0, 400, 1000), 400);
  assert.equal(nextRefundTotal(400, 700, 1000), 1000);
  assert.equal(paymentRefundStatus(999, 1000), "partially-refunded");
  assert.equal(paymentRefundStatus(1000, 1000), "refunded");
});

test("star refund allocation is cumulative and cannot exceed purchased stars", () => {
  assert.equal(proportionalStarRefund({ alreadyRefundedStars: 0, incomingRefundPence: 500, purchasePence: 1000, purchasedStars: 100 }), 50);
  assert.equal(proportionalStarRefund({ alreadyRefundedStars: 50, incomingRefundPence: 1000, purchasePence: 1000, purchasedStars: 100 }), 50);
  assert.equal(proportionalStarRefund({ alreadyRefundedStars: 100, incomingRefundPence: 2000, purchasePence: 1000, purchasedStars: 100 }), 0);
});

test("PayPal and Square completed refunds share durable local reconciliation", () => {
  const paypal = readFileSync(join(process.cwd(), "src/lib/payments/paypal-webhook-service.ts"), "utf8");
  const square = readFileSync(join(process.cwd(), "src/lib/payments/square-webhook-service.ts"), "utf8");
  const refund = readFileSync(join(process.cwd(), "src/lib/payments/payment-refund-service.ts"), "utf8");

  assert.match(paypal, /PAYMENT\.CAPTURE\.REFUNDED/);
  assert.match(paypal, /PAYMENT\.CAPTURE\.REVERSED/);
  assert.match(square, /refund\?\.status === "COMPLETED"/);
  assert.match(refund, /starsRemoved = Math\.min/);
  assert.ok((refund.match(/updateMany\(\{/g) ?? []).length >= 4);
  assert.match(refund, /refund state changed; retry reconciliation/);
  assert.match(refund, /restockedAt/);
  assert.match(refund, /downloadUrl: null/);
  assert.match(refund, /Purchase was refunded before payout/);
});
