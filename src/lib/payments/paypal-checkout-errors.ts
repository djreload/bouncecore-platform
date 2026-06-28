export type CheckoutErrorParam = "error" | "paypal-api-error" | "paypal-not-ready";

function isPayPalApiError(error: unknown) {
  return error instanceof Error && error.name === "PayPalApiError";
}

export function paypalCheckoutErrorParam(error: unknown): CheckoutErrorParam {
  if (isPayPalApiError(error)) {
    return "paypal-api-error";
  }

  const message = error instanceof Error ? error.message : "";

  return message.includes("PayPal") ? "paypal-not-ready" : "error";
}
