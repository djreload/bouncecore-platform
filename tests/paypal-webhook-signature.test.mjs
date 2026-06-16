import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  certUrlIsAllowedPayPalUrl,
  crc32Decimal,
  extractPayPalWebhookHeaders,
  payPalWebhookSignedMessage,
  verifyPayPalWebhookSignature
} from "../src/lib/payments/paypal-webhook-signature.ts";

test("crc32Decimal matches the PayPal signed-message checksum format", () => {
  assert.equal(crc32Decimal("123456789"), 3421780262);
});

test("extractPayPalWebhookHeaders reads required PayPal headers", () => {
  const headers = new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "abc-123",
    "paypal-transmission-sig": "signature",
    "paypal-transmission-time": "2026-06-15T12:00:00Z"
  });

  assert.deepEqual(extractPayPalWebhookHeaders(headers), {
    authAlgo: "SHA256withRSA",
    certUrl: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    transmissionId: "abc-123",
    transmissionSig: "signature",
    transmissionTime: "2026-06-15T12:00:00Z"
  });
});

test("certUrlIsAllowedPayPalUrl only allows PayPal notification certificate URLs", () => {
  assert.equal(certUrlIsAllowedPayPalUrl("https://api-m.paypal.com/v1/notifications/certs/CERT-1"), true);
  assert.equal(certUrlIsAllowedPayPalUrl("https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1"), true);
  assert.equal(certUrlIsAllowedPayPalUrl("https://example.com/v1/notifications/certs/CERT-1"), false);
  assert.equal(certUrlIsAllowedPayPalUrl("http://api-m.paypal.com/v1/notifications/certs/CERT-1"), false);
  assert.equal(certUrlIsAllowedPayPalUrl("https://api-m.paypal.com/other/CERT-1"), false);
});

test("verifyPayPalWebhookSignature accepts valid PayPal-style RSA signatures", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const webhookId = "WH-123456";
  const rawBody = JSON.stringify({
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    id: "WH-1",
    resource: {
      id: "CAPTURE-1"
    },
    resource_type: "capture"
  });
  const unsignedHeaders = {
    authAlgo: "SHA256withRSA",
    certUrl: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    transmissionId: "abc-123",
    transmissionSig: "",
    transmissionTime: "2026-06-15T12:00:00Z"
  };
  const signer = createSign("SHA256");

  signer.update(payPalWebhookSignedMessage(unsignedHeaders, webhookId, rawBody));
  signer.end();

  const headers = {
    ...unsignedHeaders,
    transmissionSig: signer.sign(privateKey).toString("base64")
  };
  const publicKeyPem = publicKey.export({
    format: "pem",
    type: "spki"
  }).toString();

  assert.equal(verifyPayPalWebhookSignature(headers, webhookId, rawBody, publicKeyPem), true);
  assert.equal(verifyPayPalWebhookSignature(headers, webhookId, `${rawBody}\n`, publicKeyPem), false);
});
