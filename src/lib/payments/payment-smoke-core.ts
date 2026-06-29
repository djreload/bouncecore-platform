import type { PayPalMode } from "@/lib/payments/paypal-service";

export type PaymentSmokeScenarioId = "stars" | "music" | "shop";

export type PaymentSmokeField = {
  name: string;
  value: string;
};

export type PaymentSmokeVerificationInput = {
  deliveryAvailable?: boolean;
  paypalCaptureId: string | null;
  scenarioId: PaymentSmokeScenarioId;
  status: string;
};

export type PaymentSmokeVerification = {
  detail: string;
  label: string;
  state: "attention" | "pending" | "verified";
};

export const paymentSmokeSandboxRequiredMessage = "Switch PayPal mode to sandbox before running admin smoke tests.";

export const paymentSmokeScenarioLabels: Record<PaymentSmokeScenarioId, string> = {
  music: "Music checkout",
  shop: "Shop checkout",
  stars: "Stars wallet checkout"
};

export function paymentSmokeModeBlockReason(mode: PayPalMode) {
  return mode === "sandbox" ? null : paymentSmokeSandboxRequiredMessage;
}

export function paymentSmokeVerification(input: PaymentSmokeVerificationInput): PaymentSmokeVerification {
  const status = input.status.toLowerCase();
  const captured = Boolean(input.paypalCaptureId);

  if (status === "pending") {
    return {
      detail: "Checkout started locally and is waiting for PayPal approval/return capture.",
      label: "Pending",
      state: "pending"
    };
  }

  if (["cancelled", "canceled"].includes(status)) {
    return {
      detail: "Checkout was cancelled before capture completed.",
      label: "Cancelled",
      state: "attention"
    };
  }

  if (input.scenarioId === "shop" && ["paid", "processing", "fulfilled"].includes(status) && captured) {
    return {
      detail: "Order has a PayPal capture reference. Stock decrement is applied in the capture transaction.",
      label: "Verified",
      state: "verified"
    };
  }

  if (input.scenarioId === "music" && status === "paid" && captured && input.deliveryAvailable) {
    return {
      detail: "Music purchase has a PayPal capture reference and resolves to a download URL.",
      label: "Verified",
      state: "verified"
    };
  }

  if (input.scenarioId === "stars" && status === "paid" && captured) {
    return {
      detail: "Stars purchase has a PayPal capture reference. Wallet credit is applied in the capture transaction.",
      label: "Verified",
      state: "verified"
    };
  }

  if (status === "paid" && !captured) {
    return {
      detail: "Record is paid but no PayPal capture reference is stored.",
      label: "Needs check",
      state: "attention"
    };
  }

  if (input.scenarioId === "music" && status === "paid" && !input.deliveryAvailable) {
    return {
      detail: "Music purchase is paid but no download URL resolves.",
      label: "Needs delivery",
      state: "attention"
    };
  }

  return {
    detail: "Checkout is not in the expected captured state yet.",
    label: "Needs check",
    state: "attention"
  };
}

export function paymentSmokeShippingFields(user: { displayName: string; email: string }): PaymentSmokeField[] {
  return [
    {
      name: "shippingName",
      value: `${user.displayName} Smoke Test`.slice(0, 120)
    },
    {
      name: "shippingEmail",
      value: user.email
    },
    {
      name: "shippingLine1",
      value: "1 Sandbox Street"
    },
    {
      name: "shippingLine2",
      value: "Bouncecore QA"
    },
    {
      name: "shippingCity",
      value: "Testington"
    },
    {
      name: "shippingCounty",
      value: "Testshire"
    },
    {
      name: "shippingPostcode",
      value: "TE1 1ST"
    },
    {
      name: "shippingCountry",
      value: "United Kingdom"
    },
    {
      name: "shippingPhone",
      value: "07000000000"
    }
  ];
}
