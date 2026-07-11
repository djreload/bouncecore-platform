export const paypalWebhookDefaultLimit = 24;
export const paypalWebhookMaxLimit = 100;
export const paypalWebhookLimitOptions = [8, 24, 50, 100] as const;
export const paypalWebhookStatusFilterOptions = [
  "failed",
  "received",
  "retrying",
  "recorded",
  "duplicate",
  "capture-completed-unmatched",
  "shop-order-paid",
  "music-checkout-paid",
  "track-purchase-paid",
  "stars-purchase-paid",
  "payout-batch-updated",
  "payout-item-updated"
] as const;

export type PayPalWebhookFilterInput = {
  eventType?: string | null;
  limit?: string | number | null;
  query?: string | null;
  status?: string | null;
};

export type PayPalWebhookFilters = {
  eventType: string;
  hasFilters: boolean;
  limit: number;
  query: string;
  status: string;
};

function normalizedText(value: string | null | undefined, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizedLimit(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number((value ?? "").toString().trim() || paypalWebhookDefaultLimit);

  if (!Number.isInteger(numeric)) {
    return paypalWebhookDefaultLimit;
  }

  return Math.min(Math.max(numeric, 1), paypalWebhookMaxLimit);
}

export function normalizePayPalWebhookFilters(input: PayPalWebhookFilterInput = {}): PayPalWebhookFilters {
  const eventType = normalizedText(input.eventType, 120);
  const query = normalizedText(input.query, 160);
  const status = normalizedText(input.status, 80);

  return {
    eventType,
    hasFilters: Boolean(eventType || query || status),
    limit: normalizedLimit(input.limit),
    query,
    status
  };
}
