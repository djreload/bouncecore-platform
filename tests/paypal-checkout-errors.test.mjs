import assert from "node:assert/strict";
import test from "node:test";
import { paypalCheckoutErrorParam } from "../src/lib/payments/paypal-checkout-errors.ts";

test("paypalCheckoutErrorParam distinguishes API failures from missing setup", () => {
  const apiError = new Error("PayPal request failed.");
  apiError.name = "PayPalApiError";

  assert.equal(paypalCheckoutErrorParam(apiError), "paypal-api-error");
  assert.equal(paypalCheckoutErrorParam(new Error("PayPal client secret is missing.")), "paypal-not-ready");
  assert.equal(paypalCheckoutErrorParam(new Error("Choose a product first.")), "error");
});
