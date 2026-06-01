import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const paypalSettingsKey = "payments.paypal";

export const paypalModeOptions = ["sandbox", "live"] as const;

export type PayPalMode = (typeof paypalModeOptions)[number];

export type PayPalSettingsInput = {
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
  merchantEmail: string;
  merchantId: string;
  webhookId: string;
};

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
  settings: PayPalSettings;
  secretConfigured: boolean;
  apiBaseUrl: string;
  checks: PayPalReadinessCheck[];
  useCases: PayPalUseCase[];
};

export type PayPalCheckoutItem = {
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
    merchantEmail: (typeof stored.merchantEmail === "string" && stored.merchantEmail.trim()) || envValue("PAYPAL_MERCHANT_EMAIL"),
    merchantId: (typeof stored.merchantId === "string" && stored.merchantId.trim()) || envValue("PAYPAL_MERCHANT_ID"),
    mode,
    producerPayoutsEnabled: typeof stored.producerPayoutsEnabled === "boolean" ? stored.producerPayoutsEnabled : true,
    shopEnabled: typeof stored.shopEnabled === "boolean" ? stored.shopEnabled : true,
    starsEnabled: typeof stored.starsEnabled === "boolean" ? stored.starsEnabled : true,
    webhookId: (typeof stored.webhookId === "string" && stored.webhookId.trim()) || envValue("PAYPAL_WEBHOOK_ID")
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

function paypalClientSecret() {
  return envValue("PAYPAL_CLIENT_SECRET");
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
  const secretConfigured = Boolean(paypalClientSecret());
  const checks: PayPalReadinessCheck[] = [
    check("Payment rail", true, "PayPal is the required provider for stars, shop checkout, and producer payouts."),
    check("PayPal client ID", Boolean(settings.clientId), "PAYPAL_CLIENT_ID or admin PayPal client ID."),
    check("PayPal client secret", secretConfigured, "PAYPAL_CLIENT_SECRET must stay in the server environment."),
    check("PayPal webhook ID", Boolean(settings.webhookId), "PAYPAL_WEBHOOK_ID or admin PayPal webhook ID for event verification."),
    check("PayPal merchant", Boolean(settings.merchantEmail || settings.merchantId), "Merchant email or merchant ID for admin reference."),
    check("Producer payouts", settings.producerPayoutsEnabled, "Producer payouts are routed through PayPal Payouts.")
  ];

  return {
    apiBaseUrl: paypalApiBaseUrl(settings.mode),
    checks,
    secretConfigured,
    settings,
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
        enabled: settings.producerPayoutsEnabled,
        label: "Producer payouts",
        rail: "PayPal Payouts API",
        surface: "/producer/sales"
      }
    ]
  };
}

export function getPayPalCheckoutReadiness(settings: PayPalSettings, secretConfigured = Boolean(paypalClientSecret())) {
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
  const secret = paypalClientSecret();
  const readiness = getPayPalCheckoutReadiness(settings, Boolean(secret));

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal checkout is not ready.");
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
              category: "PHYSICAL_GOODS",
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

export async function updatePayPalSettings(input: PayPalSettingsInput, actorId: string) {
  if (!isPayPalMode(input.mode)) {
    throw new Error("Invalid PayPal mode.");
  }

  const settings: PayPalSettingsInput = {
    clientId: normalizeString(input.clientId, 220),
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
      description: "Non-secret PayPal integration settings. Client secret remains in server environment.",
      isSecret: false,
      value: settings
    },
    create: {
      description: "Non-secret PayPal integration settings. Client secret remains in server environment.",
      isSecret: false,
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
      shopEnabled: settings.shopEnabled,
      starsEnabled: settings.starsEnabled
    }
  });

  return settings;
}
