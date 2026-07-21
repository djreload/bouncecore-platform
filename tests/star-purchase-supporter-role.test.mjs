import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("paid star purchases grant the Supporter/VIP role across checkout providers", () => {
  const helper = readFileSync(join(process.cwd(), "src/lib/rewards/supporter-role-service.ts"), "utf8");
  const checkout = readFileSync(join(process.cwd(), "src/lib/rewards/stars-checkout-service.ts"), "utf8");
  const paypalWebhook = readFileSync(join(process.cwd(), "src/lib/payments/paypal-webhook-service.ts"), "utf8");
  const squareWebhook = readFileSync(join(process.cwd(), "src/lib/payments/square-webhook-service.ts"), "utf8");

  assert.match(helper, /automaticSupporterRoleName = "supporter"/);
  assert.match(helper, /client\.role\.upsert/);
  assert.match(helper, /client\.userRole\.upsert/);
  assert.match(helper, /assignedById: null/);

  assert.equal((checkout.match(/grantAutomaticSupporterRole\(userId, tx\)/g) ?? []).length, 2);
  assert.equal((checkout.match(/grantAutomaticSupporterRole\(purchase\.userId\)/g) ?? []).length, 2);

  assert.match(paypalWebhook, /grantAutomaticSupporterRole\(purchase\.userId, tx\)/);
  assert.match(paypalWebhook, /grantAutomaticSupporterRole\(purchase\.userId\)/);

  assert.match(squareWebhook, /completeSquareStarsCheckout\(starPurchase\.userId, starPurchase\.id\)/);
  assert.match(squareWebhook, /processingStatus: \{ in: \["received", "failed"\] \}/);
});
