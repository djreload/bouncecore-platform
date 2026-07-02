import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  squareCheckoutErrorParam
} from "../src/lib/payments/square-checkout-errors.ts";
import {
  squareApiBaseUrl,
  squareWebhookPaymentFromPayload,
  verifySquareWebhookSignature
} from "../src/lib/payments/square-service.ts";

test("Square checkout error mapping distinguishes API and setup failures", () => {
  const apiError = new Error("Square failed");
  apiError.name = "SquareApiError";

  assert.equal(squareCheckoutErrorParam(apiError), "square-api-error");
  assert.equal(squareCheckoutErrorParam(new Error("Square access token is missing.")), "square-not-ready");
  assert.equal(squareCheckoutErrorParam(new Error("Unknown")), "error");
});

test("Square service uses the correct API base URLs", () => {
  assert.equal(squareApiBaseUrl("sandbox"), "https://connect.squareupsandbox.com");
  assert.equal(squareApiBaseUrl("live"), "https://connect.squareup.com");
});

test("Square webhook signature and payment payload parsing are stable", () => {
  const rawBody = JSON.stringify({
    data: {
      object: {
        payment: {
          amount_money: {
            amount: 1200,
            currency: "GBP"
          },
          buyer_email_address: "buyer@example.com",
          id: "PAYMENT_ID",
          order_id: "SQUARE_ORDER_ID",
          receipt_url: "https://squareup.com/receipt",
          status: "COMPLETED",
          total_money: {
            amount: 1200,
            currency: "GBP"
          }
        }
      }
    }
  });
  const settings = {
    applicationId: "app",
    locationId: "loc",
    mode: "sandbox",
    shopEnabled: true,
    starsEnabled: true,
    webhookNotificationUrl: "https://example.com/api/payments/square/webhook",
    webhookSignatureKey: "secret"
  };
  const signature = createHmac("sha256", settings.webhookSignatureKey)
    .update(`${settings.webhookNotificationUrl}${rawBody}`)
    .digest("base64");

  assert.equal(verifySquareWebhookSignature(rawBody, signature, settings), true);
  assert.deepEqual(squareWebhookPaymentFromPayload(JSON.parse(rawBody)), {
    amountPence: 1200,
    buyerEmail: "buyer@example.com",
    paymentId: "PAYMENT_ID",
    receiptUrl: "https://squareup.com/receipt",
    squareOrderId: "SQUARE_ORDER_ID",
    status: "COMPLETED"
  });
});

test("Square is wired only into stars and merch checkout, not producer music checkout", () => {
  const stars = readFileSync(join(process.cwd(), "src/lib/rewards/stars-checkout-service.ts"), "utf8");
  const shop = readFileSync(join(process.cwd(), "src/lib/shop/checkout-service.ts"), "utf8");
  const music = readFileSync(join(process.cwd(), "src/lib/music/track-checkout-service.ts"), "utf8");
  const payments = readFileSync(join(process.cwd(), "src/app/admin/payments/payments-panel.tsx"), "utf8");

  assert.match(stars, /createSquarePaymentLink/);
  assert.match(shop, /createSquarePaymentLink/);
  assert.doesNotMatch(music, /Square|square/);
  assert.match(payments, /Producer music purchases and producer payouts remain on PayPal/);
});
