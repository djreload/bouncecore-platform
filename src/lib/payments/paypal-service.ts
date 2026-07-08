import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const paypalSettingsKey = "payments.paypal";

export const paypalModeOptions = ["sandbox", "live"] as const;

export type PayPalMode = (typeof paypalModeOptions)[number];

export type PayPalSettingsInput = {
  clientSecret?: string;
  mode: PayPalMode;
  clientId?: string;
  merchantEmail?: string;
  merchantId?: string;
  webhookId?: string;
  starsEnabled: boolean;
  shopEnabled: boolean;
  producerPayoutsEnabled: boolean;
};

export type PayPalSettings = PayPalSettingsInput & {
  clientId: string;
  clientSecret: string;
  merchantEmail: string;
  merchantId: string;
  webhookId: string;
};

export type PayPalPublicSettings = Omit<PayPalSettings, "clientSecret">;

export type PayPalReadinessCheck = {
  label: string;
  status: "ready" | "missing";
  value: string;
  detail: string;
};

export type PayPalUseCase = {
  label: string;
  surface: string;
  rail: string;
  enabled: boolean;
};

export type PayPalIntegrationData = {
  settings: PayPalPublicSettings;
  secretConfigured: boolean;
  apiBaseUrl: string;
  checks: PayPalReadinessCheck[];
  useCases: PayPalUseCase[];
};

export type PayPalCheckoutItem = {
  category?: "DIGITAL_GOODS" | "PHYSICAL_GOODS";
  name: string;
  quantity: number;
  sku: string;
  unitAmountPence: number;
};

export type CreatePayPalCheckoutOrderInput = {
  cancelUrl: string;
  currencyCode: string;
  description: string;
  items: PayPalCheckoutItem[];
  localOrderId: string;
  returnUrl: string;
  totalPence: number;
};

export type CreatedPayPalCheckoutOrder = {
  approvalUrl: string;
  paypalOrderId: string;
};

export type CapturedPayPalCheckoutOrder = {
  amountPence: number | null;
  captureId: string | null;
  payerEmail: string | null;
  status: string;
};

export type PayPalPayoutRecipientType = "EMAIL" | "PAYPAL_ID";

export type PayPalPayoutItemInput = {
  amountPence: number;
  currencyCode: string;
  note: string;
  receiver: string;
  recipientType: PayPalPayoutRecipientType;
  senderItemId: string;
};

export type CreatePayPalPayoutBatchInput = {
  emailMessage?: string;
  emailSubject: string;
  items: PayPalPayoutItemInput[];
  senderBatchId: string;
};

export type CreatedPayPalPayoutBatch = {
  batchStatus: string;
  paypalPayoutBatchId: string;
  raw: unknown;
};

export type PayPalPayoutBatchItemDetails = {
  errorMessage: string | null;
  paypalFeePence: number | null;
  paypalPayoutItemId: string | null;
  paypalTransactionId: string | null;
  senderItemId: string;
  transactionStatus: string;
};

export type PayPalPayoutBatchDetails = {
  batchStatus: string;
  items: PayPalPayoutBatchItemDetails[];
  paypalPayoutBatchId: string;
  raw: unknown;
};

export class PayPalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function isPayPalMode(value: string): value is PayPalMode {
  return paypalModeOptions.includes(value as PayPalMode);
}

function normalizeString(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return "";
  }

  if (text.length > maxLength) {
    throw new Error(`PayPal value must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function toSettings(value: unknown): PayPalSettings {
  const stored = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const modeValue = typeof stored.mode === "string" ? stored.mode : envValue("PAYPAL_MODE");
  const mode = isPayPalMode(modeValue) ? modeValue : "sandbox";

  return {
    clientId:
      (typeof stored.clientId === "string" && stored.clientId.trim()) ||
      envValue("PAYPAL_CLIENT_ID") ||
      envValue("NEXT_PUBLIC_PAYPAL_CLIENT_ID"),
    clientSecret: (typeof stored.clientSecret === "string" && stored.clientSecret.trim()) || envValue("PAYPAL_CLIENT_SECRET"),
    merchantEmail: (typeof stored.merchantEmail === "string" && stored.merchantEmail.trim()) || envValue("PAYPAL_MERCHANT_EMAIL"),
    merchantId: (typeof stored.merchantId === "string" && stored.merchantId.trim()) || envValue("PAYPAL_MERCHANT_ID"),
    mode,
    producerPayoutsEnabled: typeof stored.producerPayoutsEnabled === "boolean" ? stored.producerPayoutsEnabled : true,
    shopEnabled: typeof stored.shopEnabled === "boolean" ? stored.shopEnabled : true,
    starsEnabled: typeof stored.starsEnabled === "boolean" ? stored.starsEnabled : true,
    webhookId: (typeof stored.webhookId === "string" && stored.webhookId.trim()) || envValue("PAYPAL_WEBHOOK_ID")
  };
}

function publicSettings(settings: PayPalSettings): PayPalPublicSettings {
  return {
    clientId: settings.clientId,
    merchantEmail: settings.merchantEmail,
    merchantId: settings.merchantId,
    mode: settings.mode,
    producerPayoutsEnabled: settings.producerPayoutsEnabled,
    shopEnabled: settings.shopEnabled,
    starsEnabled: settings.starsEnabled,
    webhookId: settings.webhookId
  };
}

function check(label: string, configured: boolean, detail: string): PayPalReadinessCheck {
  return {
    detail,
    label,
    status: configured ? "ready" : "missing",
    value: configured ? "Configured" : "Missing"
  };
}

export function paypalApiBaseUrl(mode: PayPalMode) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: paypalSettingsKey
    }
  });

  return toSettings(setting?.value);
}

export async function getPayPalIntegrationData(): Promise<PayPalIntegrationData> {
  const settings = await getPayPalSettings();
  const secretConfigured = Boolean(settings.clientSecret);
  const checks: PayPalReadinessCheck[] = [
    check("Payment rail", true, "PayPal is the required provider for stars, shop checkout, and producer payouts."),
    check("PayPal client ID", Boolean(settings.clientId), "PAYPAL_CLIENT_ID or admin PayPal client ID."),
    check("PayPal client secret", secretConfigured, "PAYPAL_CLIENT_SECRET or admin PayPal client secret stored server-side only."),
    check("PayPal webhook ID", Boolean(settings.webhookId), "PAYPAL_WEBHOOK_ID or admin PayPal webhook ID for event verification."),
    check("PayPal merchant", Boolean(settings.merchantEmail || settings.merchantId), "Merchant email or merchant ID for admin reference."),
    check("Producer payouts", settings.producerPayoutsEnabled, "Producer payouts are routed through PayPal Payouts.")
  ];

  return {
    apiBaseUrl: paypalApiBaseUrl(settings.mode),
    checks,
    secretConfigured,
    settings: publicSettings(settings),
    useCases: [
      {
        enabled: settings.starsEnabled,
        label: "Stars purchases",
        rail: "PayPal Checkout / Orders API",
        surface: "/rewards and /account/rewards"
      },
      {
        enabled: settings.shopEnabled,
        label: "Shop checkout",
        rail: "PayPal Checkout / Orders API",
        surface: "/shop"
      },
      {
        enabled: Boolean(settings.clientId),
        label: "Music purchases",
        rail: "PayPal Checkout / Orders API",
        surface: "/music and /producer/sales"
      },
      {
        enabled: settings.producerPayoutsEnabled,
        label: "Producer payouts",
        rail: "PayPal Payouts API",
        surface: "/admin/payments and /producer/sales"
      }
    ]
  };
}

type PayPalReadinessSettings = PayPalSettings | PayPalPublicSettings;

function defaultSecretConfigured(settings: PayPalReadinessSettings) {
  return "clientSecret" in settings ? Boolean(settings.clientSecret) : Boolean(envValue("PAYPAL_CLIENT_SECRET"));
}

export function getPayPalCheckoutReadiness(settings: PayPalReadinessSettings, secretConfigured = defaultSecretConfigured(settings)) {
  return {
    ready: settings.shopEnabled && Boolean(settings.clientId) && secretConfigured,
    reason: !settings.shopEnabled
      ? "PayPal shop checkout is disabled."
      : !settings.clientId
        ? "PayPal client ID is missing."
        : !secretConfigured
          ? "PayPal client secret is missing."
          : null
  };
}

export function getPayPalStarsReadiness(settings: PayPalReadinessSettings, secretConfigured = defaultSecretConfigured(settings)) {
  return {
    ready: settings.starsEnabled && Boolean(settings.clientId) && secretConfigured,
    reason: !settings.starsEnabled
      ? "PayPal stars purchases are disabled."
      : !settings.clientId
        ? "PayPal client ID is missing."
        : !secretConfigured
          ? "PayPal client secret is missing."
          : null
  };
}

export function getPayPalMusicReadiness(settings: PayPalReadinessSettings, secretConfigured = defaultSecretConfigured(settings)) {
  return {
    ready: Boolean(settings.clientId) && secretConfigured,
    reason: !settings.clientId
      ? "PayPal client ID is missing."
      : !secretConfigured
        ? "PayPal client secret is missing."
        : null
  };
}

export function getPayPalPayoutReadiness(settings: PayPalReadinessSettings, secretConfigured = defaultSecretConfigured(settings)) {
  return {
    ready: settings.producerPayoutsEnabled && Boolean(settings.clientId) && secretConfigured,
    reason: !settings.producerPayoutsEnabled
      ? "PayPal producer payouts are disabled."
      : !settings.clientId
        ? "PayPal client ID is missing."
        : !secretConfigured
          ? "PayPal client secret is missing."
          : null
  };
}

function getPayPalCredentialReadiness(settings: PayPalReadinessSettings, secretConfigured = defaultSecretConfigured(settings)) {
  return {
    ready: Boolean(settings.clientId) && secretConfigured,
    reason: !settings.clientId
      ? "PayPal client ID is missing."
      : !secretConfigured
        ? "PayPal client secret is missing."
        : null
  };
}

function moneyValue(pence: number) {
  return (pence / 100).toFixed(2);
}

function penceValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function payPalJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text
    };
  }
}

function payPalDetail(value: unknown) {
  const body = asRecord(value);
  const message = typeof body.message === "string" ? body.message : "";
  const details = asArray(body.details)
    .map((detail) => asRecord(detail))
    .map((detail) => [detail.issue, detail.description].filter((part): part is string => typeof part === "string").join(": "))
    .filter(Boolean)
    .join("; ");

  return [message, details].filter(Boolean).join(" ");
}

async function paypalFetch(path: string, init: RequestInit, settings: PayPalSettings) {
  const url = `${paypalApiBaseUrl(settings.mode)}${path}`;
  const response = await fetch(url, init);
  const body = await payPalJson(response);

  if (!response.ok) {
    throw new PayPalApiError("PayPal request failed.", response.status, payPalDetail(body));
  }

  return body;
}

async function getPayPalAccessToken(settings: PayPalSettings) {
  const secret = settings.clientSecret;
  const readiness = getPayPalCredentialReadiness(settings, Boolean(secret));

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal API credentials are not ready.");
  }

  const credentials = Buffer.from(`${settings.clientId}:${secret}`).toString("base64");
  const body = await paypalFetch(
    "/v1/oauth2/token",
    {
      body: "grant_type=client_credentials",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_GB",
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    },
    settings
  );
  const token = asRecord(body).access_token;

  if (typeof token !== "string" || !token) {
    throw new PayPalApiError("PayPal access token response was invalid.", 502);
  }

  return token;
}

export async function createPayPalCheckoutOrder(
  input: CreatePayPalCheckoutOrderInput,
  settings: PayPalSettings
): Promise<CreatedPayPalCheckoutOrder> {
  const accessToken = await getPayPalAccessToken(settings);
  const body = await paypalFetch(
    "/v2/checkout/orders",
    {
      body: JSON.stringify({
        intent: "CAPTURE",
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Bouncecore",
              cancel_url: input.cancelUrl,
              landing_page: "LOGIN",
              locale: "en-GB",
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              return_url: input.returnUrl,
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW"
            }
          }
        },
        purchase_units: [
          {
            amount: {
              breakdown: {
                item_total: {
                  currency_code: input.currencyCode,
                  value: moneyValue(input.totalPence)
                }
              },
              currency_code: input.currencyCode,
              value: moneyValue(input.totalPence)
            },
            custom_id: input.localOrderId,
            description: input.description,
            items: input.items.map((item) => ({
              category: item.category ?? "DIGITAL_GOODS",
              name: item.name,
              quantity: String(item.quantity),
              sku: item.sku,
              unit_amount: {
                currency_code: input.currencyCode,
                value: moneyValue(item.unitAmountPence)
              }
            })),
            reference_id: input.localOrderId
          }
        ]
      }),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": input.localOrderId
      },
      method: "POST"
    },
    settings
  );
  const response = asRecord(body);
  const paypalOrderId = response.id;
  const approvalLink = asArray(response.links)
    .map((link) => asRecord(link))
    .find((link) => link.rel === "approve" || link.rel === "payer-action");
  const approvalUrl = approvalLink?.href;

  if (typeof paypalOrderId !== "string" || typeof approvalUrl !== "string") {
    throw new PayPalApiError("PayPal did not return an approval link.", 502);
  }

  return {
    approvalUrl,
    paypalOrderId
  };
}

export async function capturePayPalCheckoutOrder(
  paypalOrderId: string,
  settings: PayPalSettings
): Promise<CapturedPayPalCheckoutOrder> {
  const accessToken = await getPayPalAccessToken(settings);
  const body = await paypalFetch(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture-${paypalOrderId}`
      },
      method: "POST"
    },
    settings
  );
  const response = asRecord(body);
  const purchaseUnit = asRecord(asArray(response.purchase_units)[0]);
  const captures = asArray(asRecord(purchaseUnit.payments).captures).map((capture) => asRecord(capture));
  const capture = captures[0] ?? {};
  const amount = asRecord(capture.amount);
  const payer = asRecord(response.payer);

  return {
    amountPence: penceValue(amount.value),
    captureId: typeof capture.id === "string" ? capture.id : null,
    payerEmail: typeof payer.email_address === "string" ? payer.email_address : null,
    status: typeof response.status === "string" ? response.status : "UNKNOWN"
  };
}

function normalizePayPalStatus(value: unknown) {
  return typeof value === "string" && value ? value.toLowerCase() : "unknown";
}

export async function createPayPalPayoutBatch(
  input: CreatePayPalPayoutBatchInput,
  settings: PayPalSettings
): Promise<CreatedPayPalPayoutBatch> {
  const readiness = getPayPalPayoutReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal producer payouts are not ready.");
  }

  const accessToken = await getPayPalAccessToken(settings);
  const body = await paypalFetch(
    "/v1/payments/payouts",
    {
      body: JSON.stringify({
        sender_batch_header: {
          email_message: input.emailMessage,
          email_subject: input.emailSubject,
          recipient_type: "EMAIL",
          sender_batch_id: input.senderBatchId
        },
        items: input.items.map((item) => ({
          amount: {
            currency: item.currencyCode,
            value: moneyValue(item.amountPence)
          },
          note: item.note,
          receiver: item.receiver,
          recipient_type: item.recipientType,
          recipient_wallet: "PAYPAL",
          sender_item_id: item.senderItemId
        }))
      }),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": input.senderBatchId
      },
      method: "POST"
    },
    settings
  );
  const response = asRecord(body);
  const batchHeader = asRecord(response.batch_header);
  const paypalPayoutBatchId = batchHeader.payout_batch_id;

  if (typeof paypalPayoutBatchId !== "string" || !paypalPayoutBatchId) {
    throw new PayPalApiError("PayPal did not return a payout batch ID.", 502);
  }

  return {
    batchStatus: normalizePayPalStatus(batchHeader.batch_status),
    paypalPayoutBatchId,
    raw: body
  };
}

function payoutItemErrorMessage(item: Record<string, unknown>) {
  const errors = item.errors;

  if (!errors) {
    return null;
  }

  return payPalDetail(errors) || null;
}

export async function getPayPalPayoutBatchDetails(
  paypalPayoutBatchId: string,
  settings: PayPalSettings
): Promise<PayPalPayoutBatchDetails> {
  const readiness = getPayPalPayoutReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal producer payouts are not ready.");
  }

  const accessToken = await getPayPalAccessToken(settings);
  const body = await paypalFetch(
    `/v1/payments/payouts/${encodeURIComponent(paypalPayoutBatchId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      method: "GET"
    },
    settings
  );
  const response = asRecord(body);
  const batchHeader = asRecord(response.batch_header);
  const batchId = batchHeader.payout_batch_id;
  const items = asArray(response.items)
    .map((item) => asRecord(item))
    .map((item): PayPalPayoutBatchItemDetails => {
      const payoutItem = asRecord(item.payout_item);
      const fee = asRecord(item.payout_item_fee);
      const amount = asRecord(fee.amount);
      const feeValue = amount.value ?? fee.value;

      return {
        errorMessage: payoutItemErrorMessage(item),
        paypalFeePence: penceValue(feeValue),
        paypalPayoutItemId: typeof item.payout_item_id === "string" ? item.payout_item_id : null,
        paypalTransactionId: typeof item.transaction_id === "string" ? item.transaction_id : null,
        senderItemId: typeof payoutItem.sender_item_id === "string" ? payoutItem.sender_item_id : "",
        transactionStatus: normalizePayPalStatus(item.transaction_status)
      };
    })
    .filter((item) => item.senderItemId);

  if (typeof batchId !== "string" || !batchId) {
    throw new PayPalApiError("PayPal payout batch details response was invalid.", 502);
  }

  return {
    batchStatus: normalizePayPalStatus(batchHeader.batch_status),
    items,
    paypalPayoutBatchId: batchId,
    raw: body
  };
}

export async function updatePayPalSettings(input: PayPalSettingsInput, actorId: string) {
  if (!isPayPalMode(input.mode)) {
    throw new Error("Invalid PayPal mode.");
  }

  const existing = await getPayPalSettings();
  const settings: PayPalSettings = {
    clientId: normalizeString(input.clientId, 220),
    clientSecret: normalizeString(input.clientSecret, 2048) || existing.clientSecret,
    merchantEmail: normalizeString(input.merchantEmail, 180),
    merchantId: normalizeString(input.merchantId, 120),
    mode: input.mode,
    producerPayoutsEnabled: input.producerPayoutsEnabled,
    shopEnabled: input.shopEnabled,
    starsEnabled: input.starsEnabled,
    webhookId: normalizeString(input.webhookId, 180)
  };

  await prisma.appSetting.upsert({
    where: {
      key: paypalSettingsKey
    },
    update: {
      description: "PayPal integration settings. Client secret is stored server-side and never exposed to clients.",
      isSecret: true,
      value: settings
    },
    create: {
      description: "PayPal integration settings. Client secret is stored server-side and never exposed to clients.",
      isSecret: true,
      key: paypalSettingsKey,
      value: settings
    }
  });

  await writeAuditLog({
    actorId,
    action: "payments.paypal.update",
    target: "payments:paypal",
    severity: "warning",
    metadata: {
      mode: settings.mode,
      producerPayoutsEnabled: settings.producerPayoutsEnabled,
      secretConfigured: Boolean(settings.clientSecret),
      shopEnabled: settings.shopEnabled,
      starsEnabled: settings.starsEnabled
    }
  });

  return publicSettings(settings);
}
