export const retryablePayPalWebhookStatuses = ["failed", "received"] as const;

export function canRetryPayPalWebhookStatus(status: string) {
  return retryablePayPalWebhookStatuses.includes(status as (typeof retryablePayPalWebhookStatuses)[number]);
}
