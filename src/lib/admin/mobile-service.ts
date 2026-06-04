import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const mobileConfigSettingKey = "mobile.config";

export const mobileFeatureKeys = ["live", "chat", "shop", "music", "rewards", "ads"] as const;
export const mobileThemeModes = ["dark", "light"] as const;

export type MobileFeatureKey = (typeof mobileFeatureKeys)[number];
export type MobileThemeMode = (typeof mobileThemeModes)[number];

export type MobileConfigInput = {
  accent: string;
  announcementBody?: string;
  announcementTitle?: string;
  appName: string;
  environmentLabel?: string;
  features: Record<MobileFeatureKey, boolean>;
  maintenanceEnabled: boolean;
  maintenanceMessage?: string;
  supportEmail?: string;
  themeMode: string;
};

export type MobileConfig = {
  announcement: {
    body: string | null;
    title: string;
  } | null;
  apiVersion: "mobile-v1";
  appName: string;
  environment: string;
  features: Record<MobileFeatureKey, boolean>;
  maintenance: {
    enabled: boolean;
    message: string | null;
  };
  supportEmail: string | null;
  theme: {
    accent: string;
    mode: MobileThemeMode;
  };
};

export type AdminMobileConfigData = {
  checks: Array<{
    detail: string;
    label: string;
    status: "ready" | "warning";
    value: string;
  }>;
  config: MobileConfig;
  source: "default" | "database";
  stats: {
    enabledFeatures: number;
    publicEndpoint: string;
    updatedAt: string | null;
  };
};

const defaultFeatures: Record<MobileFeatureKey, boolean> = {
  ads: false,
  chat: true,
  live: true,
  music: true,
  rewards: true,
  shop: true
};

function defaultMobileConfig(): MobileConfig {
  return {
    announcement: null,
    apiVersion: "mobile-v1",
    appName: "Bouncecore",
    environment: process.env.NODE_ENV ?? "development",
    features: defaultFeatures,
    maintenance: {
      enabled: false,
      message: null
    },
    supportEmail: null,
    theme: {
      accent: "electric-cyan",
      mode: "dark"
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isThemeMode(value: string): value is MobileThemeMode {
  return mobileThemeModes.includes(value as MobileThemeMode);
}

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = normalizedText(value, maxLength);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizedEmail(value: string | undefined) {
  const email = normalizedText(value, 160);

  if (!email) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Support email must be a valid email address.");
  }

  return email.toLowerCase();
}

function normalizedAccent(value: string | undefined) {
  const accent = normalizedRequiredText(value, 40, "Accent");

  if (!/^[#a-zA-Z0-9_-]+$/.test(accent)) {
    throw new Error("Accent can only contain letters, numbers, #, _, or -.");
  }

  return accent;
}

function mergeMobileConfig(value: unknown): MobileConfig {
  const config = defaultMobileConfig();

  if (!isObject(value)) {
    return config;
  }

  if (typeof value.appName === "string" && value.appName.trim()) {
    config.appName = value.appName.trim().slice(0, 80);
  }

  if (typeof value.environment === "string" && value.environment.trim()) {
    config.environment = value.environment.trim().slice(0, 40);
  }

  if (typeof value.supportEmail === "string" && value.supportEmail.trim()) {
    config.supportEmail = value.supportEmail.trim().slice(0, 160);
  }

  if (isObject(value.features)) {
    for (const key of mobileFeatureKeys) {
      if (typeof value.features[key] === "boolean") {
        config.features[key] = value.features[key];
      }
    }
  }

  if (isObject(value.theme)) {
    if (typeof value.theme.mode === "string" && isThemeMode(value.theme.mode)) {
      config.theme.mode = value.theme.mode;
    }

    if (typeof value.theme.accent === "string" && value.theme.accent.trim()) {
      config.theme.accent = value.theme.accent.trim().slice(0, 40);
    }
  }

  if (isObject(value.maintenance)) {
    if (typeof value.maintenance.enabled === "boolean") {
      config.maintenance.enabled = value.maintenance.enabled;
    }

    if (typeof value.maintenance.message === "string" && value.maintenance.message.trim()) {
      config.maintenance.message = value.maintenance.message.trim().slice(0, 200);
    }
  }

  if (isObject(value.announcement) && typeof value.announcement.title === "string" && value.announcement.title.trim()) {
    config.announcement = {
      body:
        typeof value.announcement.body === "string" && value.announcement.body.trim()
          ? value.announcement.body.trim().slice(0, 300)
          : null,
      title: value.announcement.title.trim().slice(0, 120)
    };
  }

  return config;
}

function normalizeMobileConfigInput(input: MobileConfigInput): MobileConfig {
  const mode = input.themeMode.trim();

  if (!isThemeMode(mode)) {
    throw new Error("Theme mode must be dark or light.");
  }

  const maintenanceMessage = normalizedText(input.maintenanceMessage, 200);
  const announcementTitle = normalizedText(input.announcementTitle, 120);
  const announcementBody = normalizedText(input.announcementBody, 300);

  if (announcementBody && !announcementTitle) {
    throw new Error("Announcement title is required when announcement body is set.");
  }

  return {
    announcement: announcementTitle
      ? {
          body: announcementBody,
          title: announcementTitle
        }
      : null,
    apiVersion: "mobile-v1",
    appName: normalizedRequiredText(input.appName, 80, "App name"),
    environment: normalizedText(input.environmentLabel, 40) ?? process.env.NODE_ENV ?? "development",
    features: mobileFeatureKeys.reduce<Record<MobileFeatureKey, boolean>>(
      (features, key) => ({
        ...features,
        [key]: Boolean(input.features[key])
      }),
      { ...defaultFeatures }
    ),
    maintenance: {
      enabled: input.maintenanceEnabled,
      message:
        maintenanceMessage ??
        (input.maintenanceEnabled ? "The mobile app is temporarily under maintenance." : null)
    },
    supportEmail: normalizedEmail(input.supportEmail),
    theme: {
      accent: normalizedAccent(input.accent),
      mode
    }
  };
}

async function readMobileConfigSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: mobileConfigSettingKey
    }
  });

  return {
    config: mergeMobileConfig(setting?.value),
    source: setting ? ("database" as const) : ("default" as const),
    updatedAt: setting?.updatedAt ?? null
  };
}

export async function getPublicMobileConfig() {
  const { config } = await readMobileConfigSetting();

  return {
    announcement: config.announcement,
    apiVersion: config.apiVersion,
    app: config.appName,
    environment: config.environment,
    features: config.features,
    maintenance: config.maintenance,
    supportEmail: config.supportEmail,
    theme: config.theme
  };
}

export async function getAdminMobileConfigData(): Promise<AdminMobileConfigData> {
  const { config, source, updatedAt } = await readMobileConfigSetting();
  const enabledFeatures = mobileFeatureKeys.filter((key) => config.features[key]).length;

  return {
    checks: [
      {
        detail:
          source === "database"
            ? "The mobile API is serving the saved admin configuration."
            : "The mobile API is serving built-in defaults until this page is saved.",
        label: "Config source",
        status: source === "database" ? "ready" : "warning",
        value: source
      },
      {
        detail: config.maintenance.enabled
          ? config.maintenance.message ?? "Maintenance mode is active."
          : "The mobile API is open to normal app traffic.",
        label: "Maintenance mode",
        status: config.maintenance.enabled ? "warning" : "ready",
        value: config.maintenance.enabled ? "enabled" : "disabled"
      },
      {
        detail: config.announcement ? config.announcement.title : "No current in-app announcement.",
        label: "Announcement",
        status: config.announcement ? "warning" : "ready",
        value: config.announcement ? "active" : "none"
      }
    ],
    config,
    source,
    stats: {
      enabledFeatures,
      publicEndpoint: "/api/mobile/v1/config",
      updatedAt: updatedAt?.toISOString() ?? null
    }
  };
}

export async function updateMobileConfig(input: MobileConfigInput, actorId: string) {
  const config = normalizeMobileConfigInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: mobileConfigSettingKey
    },
    update: {
      description: "Public mobile app configuration and feature flags.",
      isSecret: false,
      value: config as Prisma.InputJsonValue
    },
    create: {
      description: "Public mobile app configuration and feature flags.",
      isSecret: false,
      key: mobileConfigSettingKey,
      value: config as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "mobile.config.update",
    target: "app-setting:mobile.config",
    severity: config.maintenance.enabled ? "warning" : "info",
    metadata: {
      appName: config.appName,
      enabledFeatures: mobileFeatureKeys.filter((key) => config.features[key]),
      maintenanceEnabled: config.maintenance.enabled,
      themeMode: config.theme.mode
    }
  });

  return config;
}
