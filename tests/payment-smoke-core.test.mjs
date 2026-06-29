import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paymentSmokeModeBlockReason,
  paymentSmokeSandboxRequiredMessage,
  paymentSmokeScenarioLabels,
  paymentSmokeShippingFields
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
