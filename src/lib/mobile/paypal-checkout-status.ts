import type { PayPalMode } from "../payments/paypal-service";

export type MobilePayPalCheckoutStatusInput = {
  mode: PayPalMode;
  ready: boolean;
  reason: string | null;
};

export function buildMobilePayPalCheckoutStatus(input: MobilePayPalCheckoutStatusInput) {
  return {
    mode: input.mode,
    provider: "paypal" as const,
    ready: input.ready,
    reason: input.reason
  };
}
