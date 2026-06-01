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
  const secretConfigured = Boolean(envValue("PAYPAL_CLIENT_SECRET"));
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
