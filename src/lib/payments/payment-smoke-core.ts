import type { PayPalMode } from "@/lib/payments/paypal-service";

export type PaymentSmokeScenarioId = "stars" | "music" | "shop";

export type PaymentSmokeField = {
  name: string;
  value: string;
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
