import { createHmac, timingSafeEqual } from "node:crypto";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const squareSettingsKey = "payments.square";
const squareApiVersion = "2026-05-20";

export const squareModeOptions = ["sandbox", "live"] as const;

export type SquareMode = (typeof squareModeOptions)[number];

export type SquareSettingsInput = {
  accessToken?: string;
  applicationId?: string;
  locationId?: string;
  mode: SquareMode;
  shopEnabled: boolean;
  starsEnabled: boolean;
  webhookNotificationUrl?: string;
  webhookSignatureKey?: string;
};

export type SquareSettings = Omit<SquareSettingsInput, "accessToken"> & {
  applicationId: string;
  locationId: string;
  webhookNotificationUrl: string;
  webhookSignatureKey: string;
};

type SquareStoredSettings = SquareSettings & {
  accessToken: string;
};

export type SquareReadinessCheck = {
  detail: string;
  label: string;
  status: "ready" | "missing";
  value: string;
};

export type SquareUseCase = {
  enabled: boolean;
  label: string;
  rail: string;
  surface: string;
};

export type SquareIntegrationData = {
  accessTokenConfigured: boolean;
  apiBaseUrl: string;
  checks: SquareReadinessCheck[];
  settings: SquareSettings;
  useCases: SquareUseCase[];
  webhookSignatureKeyConfigured: boolean;
};

export type SquareCheckoutItem = {
  name: string;
  quantity: number;
  sku: string;
  unitAmountPence: number;
};

export type CreateSquarePaymentLinkInput = {
  currencyCode: string;
  description: string;
  items: SquareCheckoutItem[];
  localOrderId: string;
  returnUrl: string;
};

export type CreatedSquarePaymentLink = {
  approvalUrl: string;
  squareOrderId: string;
  squarePaymentLinkId: string;
};

export type CompletedSquarePayment = {
  amountPence: number | null;
  buyerEmail: string | null;
  paymentId: string;
  receiptUrl: string | null;
  status: string;
};

export class SquareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string
  ) {
    super(message);
    this.name = "SquareApiError";
  }
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function isSquareMode(value: string): value is SquareMode {
  return squareModeOptions.includes(value as SquareMode);
}

function normalizeString(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return "";
  }

  if (text.length > maxLength) {
    throw new Error(`Square value must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function toStoredSettings(value: unknown): SquareStoredSettings {
  const stored = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const modeValue = typeof stored.mode === "string" ? stored.mode : envValue("SQUARE_MODE");
  const mode = isSquareMode(modeValue) ? modeValue : "sandbox";

  return {
    accessToken: (typeof stored.accessToken === "string" && stored.accessToken.trim()) || envValue("SQUARE_ACCESS_TOKEN"),
    applicationId:
      (typeof stored.applicationId === "string" && stored.applicationId.trim()) ||
      envValue("SQUARE_APPLICATION_ID") ||
      envValue("NEXT_PUBLIC_SQUARE_APPLICATION_ID"),
    locationId: (typeof stored.locationId === "string" && stored.locationId.trim()) || envValue("SQUARE_LOCATION_ID"),
    mode,
    shopEnabled: typeof stored.shopEnabled === "boolean" ? stored.shopEnabled : false,
    starsEnabled: typeof stored.starsEnabled === "boolean" ? stored.starsEnabled : false,
    webhookNotificationUrl:
      (typeof stored.webhookNotificationUrl === "string" && stored.webhookNotificationUrl.trim()) ||
      envValue("SQUARE_WEBHOOK_NOTIFICATION_URL"),
    webhookSignatureKey:
      (typeof stored.webhookSignatureKey === "string" && stored.webhookSignatureKey.trim()) ||
      envValue("SQUARE_WEBHOOK_SIGNATURE_KEY")
  };
}

function publicSettings(settings: SquareStoredSettings): SquareSettings {
  return {
    applicationId: settings.applicationId,
    locationId: settings.locationId,
    mode: settings.mode,
    shopEnabled: settings.shopEnabled,
    starsEnabled: settings.starsEnabled,
    webhookNotificationUrl: settings.webhookNotificationUrl,
    webhookSignatureKey: ""
  };
}

function check(label: string, configured: boolean, detail: string): SquareReadinessCheck {
  return {
    detail,
    label,
    status: configured ? "ready" : "missing",
    value: configured ? "Configured" : "Missing"
  };
}

export function squareApiBaseUrl(mode: SquareMode) {
  return mode === "live" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

export async function getSquareSettings(): Promise<SquareStoredSettings> {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: squareSettingsKey
    }
  });

  return toStoredSettings(setting?.value);
}

export async function getSquareIntegrationData(): Promise<SquareIntegrationData> {
  const stored = await getSquareSettings();
  const settings = publicSettings(stored);
  const accessTokenConfigured = Boolean(stored.accessToken);
  const webhookSignatureKeyConfigured = Boolean(stored.webhookSignatureKey);
  const checks: SquareReadinessCheck[] = [
    check("Square payment rail", true, "Square hosted checkout can be used for stars and merch only."),
    check("Square application ID", Boolean(settings.applicationId), "SQUARE_APPLICATION_ID or admin Square application ID."),
    check("Square access token", accessTokenConfigured, "Square access token is stored server-side only."),
    check("Square location ID", Boolean(settings.locationId), "Square location ID for hosted checkout orders."),
    check("Square webhook signature key", webhookSignatureKeyConfigured, "Required for trusted Square webhook processing."),
    check("Square webhook URL", Boolean(settings.webhookNotificationUrl), "Must match the notification URL configured in Square.")
  ];

  return {
    accessTokenConfigured,
    apiBaseUrl: squareApiBaseUrl(settings.mode),
    checks,
    settings,
    useCases: [
      {
        enabled: settings.starsEnabled,
        label: "Stars purchases",
        rail: "Square Checkout API hosted payment links",
        surface: "/account/rewards"
      },
      {
        enabled: settings.shopEnabled,
        label: "Shop checkout",
        rail: "Square Checkout API hosted payment links",
        surface: "/shop"
      }
    ],
    webhookSignatureKeyConfigured
  };
}

export async function updateSquareSettings(input: SquareSettingsInput, actorId: string) {
  const existing = await getSquareSettings();
  const next: SquareStoredSettings = {
    accessToken: normalizeString(input.accessToken, 2048) || existing.accessToken,
    applicationId: normalizeString(input.applicationId, 180),
    locationId: normalizeString(input.locationId, 180),
    mode: input.mode,
    shopEnabled: input.shopEnabled,
    starsEnabled: input.starsEnabled,
    webhookNotificationUrl: normalizeString(input.webhookNotificationUrl, 500),
    webhookSignatureKey: normalizeString(input.webhookSignatureKey, 500) || existing.webhookSignatureKey
  };

  await prisma.appSetting.upsert({
    where: {
      key: squareSettingsKey
    },
    create: {
      description: "Square hosted checkout configuration for stars and merch purchases.",
      isSecret: true,
      key: squareSettingsKey,
      value: next
    },
    update: {
      description: "Square hosted checkout configuration for stars and merch purchases.",
      isSecret: true,
      value: next
    }
  });

  await writeAuditLog({
    actorId,
    action: "payments.square.update",
    target: "payments:square",
    severity: "warning",
    metadata: {
      accessTokenConfigured: Boolean(next.accessToken),
      locationId: next.locationId ? "configured" : "missing",
      mode: next.mode,
      shopEnabled: next.shopEnabled,
      starsEnabled: next.starsEnabled
    }
  });

  return publicSettings(next);
}

export function getSquareShopReadiness(settings: SquareSettings, accessTokenConfigured = false) {
  return {
    ready: settings.shopEnabled && Boolean(settings.applicationId) && Boolean(settings.locationId) && accessTokenConfigured,
    reason: !settings.shopEnabled
      ? "Square shop checkout is disabled."
      : !settings.applicationId
        ? "Square application ID is missing."
        : !settings.locationId
          ? "Square location ID is missing."
          : !accessTokenConfigured
            ? "Square access token is missing."
            : null
  };
}

export function getSquareStarsReadiness(settings: SquareSettings, accessTokenConfigured = false) {
  return {
    ready: settings.starsEnabled && Boolean(settings.applicationId) && Boolean(settings.locationId) && accessTokenConfigured,
    reason: !settings.starsEnabled
      ? "Square stars purchases are disabled."
      : !settings.applicationId
        ? "Square application ID is missing."
        : !settings.locationId
          ? "Square location ID is missing."
          : !accessTokenConfigured
            ? "Square access token is missing."
            : null
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function moneyValue(pence: number, currencyCode: string) {
  return {
    amount: pence,
    currency: currencyCode
  };
}

function penceValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

async function squareJson(response: Response) {
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

function squareDetail(value: unknown) {
  const body = asRecord(value);
  const errors = asArray(body.errors)
    .map((error) => asRecord(error))
    .map((error) => [error.code, error.detail].filter((part): part is string => typeof part === "string").join(": "))
    .filter(Boolean)
    .join("; ");
  const message = typeof body.message === "string" ? body.message : "";

  return [message, errors].filter(Boolean).join(" ");
}

async function squareFetch(path: string, init: RequestInit, settings: SquareStoredSettings) {
  if (!settings.accessToken) {
    throw new Error("Square access token is missing.");
  }

  const response = await fetch(`${squareApiBaseUrl(settings.mode)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": squareApiVersion,
      ...(init.headers ?? {})
    }
  });
  const body = await squareJson(response);

  if (!response.ok) {
    throw new SquareApiError("Square request failed.", response.status, squareDetail(body));
  }

  return body;
}

export async function createSquarePaymentLink(input: CreateSquarePaymentLinkInput): Promise<CreatedSquarePaymentLink> {
  const settings = await getSquareSettings();
  const readiness =
    input.items.some((item) => item.sku.startsWith("STARS-"))
      ? getSquareStarsReadiness(publicSettings(settings), Boolean(settings.accessToken))
      : getSquareShopReadiness(publicSettings(settings), Boolean(settings.accessToken));

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "Square checkout is not ready.");
  }

  const body = await squareFetch(
    "/v2/online-checkout/payment-links",
    {
      body: JSON.stringify({
        checkout_options: {
          redirect_url: input.returnUrl
        },
        idempotency_key: input.localOrderId,
        order: {
          line_items: input.items.map((item) => ({
            base_price_money: moneyValue(item.unitAmountPence, input.currencyCode),
            item_type: "ITEM",
            name: item.name,
            quantity: String(item.quantity),
            variation_name: item.sku
          })),
          location_id: settings.locationId,
          reference_id: input.localOrderId,
          source: {
            name: "Bouncecore"
          }
        },
        payment_note: `${input.description} (${input.localOrderId})`.slice(0, 500)
      }),
      method: "POST"
    },
    settings
  );
  const paymentLink = asRecord(asRecord(body).payment_link);
  const approvalUrl = paymentLink.url;
  const squareOrderId = paymentLink.order_id;
  const squarePaymentLinkId = paymentLink.id;

  if (typeof approvalUrl !== "string" || typeof squareOrderId !== "string" || typeof squarePaymentLinkId !== "string") {
    throw new SquareApiError("Square did not return a usable payment link.", 502);
  }

  return {
    approvalUrl,
    squareOrderId,
    squarePaymentLinkId
  };
}

function completedPaymentFromRecord(payment: Record<string, unknown>): CompletedSquarePayment | null {
  const paymentId = payment.id;
  const status = payment.status;
  const totalMoney = asRecord(payment.total_money);
  const amountMoney = asRecord(payment.amount_money);

  if (typeof paymentId !== "string" || typeof status !== "string") {
    return null;
  }

  return {
    amountPence: penceValue(totalMoney.amount) ?? penceValue(amountMoney.amount),
    buyerEmail: typeof payment.buyer_email_address === "string" ? payment.buyer_email_address : null,
    paymentId,
    receiptUrl: typeof payment.receipt_url === "string" ? payment.receipt_url : null,
    status
  };
}

export async function findCompletedSquarePaymentForOrder(squareOrderId: string, expectedTotalPence: number) {
  const settings = await getSquareSettings();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const params = new URLSearchParams({
      limit: "100",
      location_id: settings.locationId,
      sort_order: "DESC",
      total: String(expectedTotalPence)
    });
    const body = await squareFetch(`/v2/payments?${params.toString()}`, { method: "GET" }, settings);
    const payment = asArray(asRecord(body).payments)
      .map((item) => asRecord(item))
      .find((item) => item.order_id === squareOrderId && item.status === "COMPLETED");

    if (payment) {
      return completedPaymentFromRecord(payment);
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return null;
}

export function verifySquareWebhookSignature(rawBody: string, signatureHeader: string | null, settings: SquareSettings) {
  if (!signatureHeader || !settings.webhookSignatureKey || !settings.webhookNotificationUrl) {
    return false;
  }

  const expected = createHmac("sha256", settings.webhookSignatureKey)
    .update(`${settings.webhookNotificationUrl}${rawBody}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signatureHeader);

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function squareWebhookPaymentFromPayload(payload: unknown) {
  const data = asRecord(asRecord(payload).data);
  const object = asRecord(data.object);
  const payment = asRecord(object.payment);
  const orderId = payment.order_id;
  const completed = completedPaymentFromRecord(payment);

  if (typeof orderId !== "string" || !completed) {
    return null;
  }

  return {
    ...completed,
    squareOrderId: orderId
  };
}
