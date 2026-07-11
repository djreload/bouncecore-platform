import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paymentSmokeModeBlockReason,
  paymentSmokeSandboxRequiredMessage,
  paymentSmokeScenarioLabels,
  paymentSmokeShippingFields,
  paymentSmokeVerification
} from "../src/lib/payments/payment-smoke-core.ts";

test("payment smoke tests are limited to sandbox mode", () => {
  assert.equal(paymentSmokeModeBlockReason("sandbox"), null);
  assert.equal(paymentSmokeModeBlockReason("live"), paymentSmokeSandboxRequiredMessage);
});

test("payment smoke test labels cover all checkout scenarios", () => {
  assert.deepEqual(paymentSmokeScenarioLabels, {
    music: "Music checkout",
    shop: "Shop checkout",
    stars: "Stars wallet checkout"
  });
});

test("payment smoke shipping fields provide a complete sandbox address", () => {
  const fields = paymentSmokeShippingFields({
    displayName: "Reload",
    email: "reload@example.com"
  });
  const values = Object.fromEntries(fields.map((field) => [field.name, field.value]));

  assert.equal(values.shippingName, "Reload Smoke Test");
  assert.equal(values.shippingEmail, "reload@example.com");
  assert.equal(values.shippingLine1, "1 Sandbox Street");
  assert.equal(values.shippingPostcode, "TE1 1ST");
  assert.equal(values.shippingCountry, "United Kingdom");
});

test("payment smoke verification marks captured results as verified", () => {
  assert.deepEqual(
    paymentSmokeVerification({
      paypalCaptureId: "CAPTURE-1",
      scenarioId: "stars",
      status: "paid"
    }),
    {
      detail: "Stars purchase has a PayPal capture reference. Wallet credit is applied in the capture transaction.",
      label: "Verified",
      state: "verified"
    }
  );
  assert.deepEqual(
    paymentSmokeVerification({
      deliveryAvailable: true,
      paypalCaptureId: "CAPTURE-2",
      scenarioId: "music",
      status: "paid"
    }),
    {
      detail: "Music purchase has a PayPal capture reference and resolves to a download URL.",
      label: "Verified",
      state: "verified"
    }
  );
  assert.deepEqual(
    paymentSmokeVerification({
      paypalCaptureId: "CAPTURE-3",
      scenarioId: "shop",
      status: "paid"
    }),
    {
      detail: "Order has a PayPal capture reference. Stock decrement is applied in the capture transaction.",
      label: "Verified",
      state: "verified"
    }
  );
});

test("payment smoke verification highlights pending and broken captured states", () => {
  assert.equal(
    paymentSmokeVerification({
      paypalCaptureId: null,
      scenarioId: "stars",
      status: "pending"
    }).state,
    "pending"
  );
  assert.equal(
    paymentSmokeVerification({
      deliveryAvailable: false,
      paypalCaptureId: "CAPTURE-4",
      scenarioId: "music",
      status: "paid"
    }).label,
    "Needs delivery"
  );
  assert.equal(
    paymentSmokeVerification({
      paypalCaptureId: null,
      scenarioId: "shop",
      status: "paid"
    }).label,
    "Needs check"
  );
});
