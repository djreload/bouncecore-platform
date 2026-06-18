export type MusicCheckoutErrorParam =
  | "error"
  | "already-owned"
  | "empty-cart"
  | "free-track"
  | "own-track"
  | "paypal-api-error"
  | "paypal-not-ready"
  | "track-unavailable";

function isPayPalApiError(error: unknown) {
  return error instanceof Error && error.name === "PayPalApiError";
}

export function musicCheckoutErrorParam(error: unknown): MusicCheckoutErrorParam {
  const message = error instanceof Error ? error.message : "";

  if (message === "You cannot buy your own track.") {
    return "own-track";
  }

  if (message.startsWith("You already own ")) {
    return "already-owned";
  }

  if (message.includes("not available for checkout")) {
    return "track-unavailable";
  }

  if (message.includes("Free tracks cannot use PayPal checkout")) {
    return "free-track";
  }

  if (message.includes("Choose at least one music track") || message.includes("Choose a music track")) {
    return "empty-cart";
  }

  if (isPayPalApiError(error)) {
    return "paypal-api-error";
  }

  return message.includes("PayPal") ? "paypal-not-ready" : "error";
}
