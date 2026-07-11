export const paypalWebhookPayloadPreviewMaxChars = 20_000;

export function paypalWebhookPayloadPreview(payload: unknown, maxChars = paypalWebhookPayloadPreviewMaxChars) {
  let formatted: string;

  try {
    formatted = JSON.stringify(payload ?? null, null, 2);
  } catch {
    formatted = JSON.stringify({ error: "PayPal webhook payload could not be serialized for display." }, null, 2);
  }

  if (formatted.length <= maxChars) {
    return formatted;
  }

  return `${formatted.slice(0, maxChars)}\n... truncated`;
}

export function paypalWebhookDetailHref(eventId: string) {
  return `/admin/payments/webhooks/${encodeURIComponent(eventId)}`;
}
