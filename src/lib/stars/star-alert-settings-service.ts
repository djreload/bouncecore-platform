import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  defaultStarAlertSettings,
  starAlertEffectModes,
  starAlertScopes,
  type StarAlertEffectMode,
  type StarAlertScope,
  type StarAlertSettings
} from "@/lib/stars/star-alert-settings";

const starAlertSettingsKey = "stars.alert_settings";

export type StarAlertSettingsInput = {
  enabled: boolean;
  scope: string;
  effectMode: string;
  durationSeconds: string;
  confettiMinimumStars: string;
  fireworksMinimumStars: string;
};

function parseInteger(value: string, label: string, min: number, max: number) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }

  return number;
}

function parseScope(value: unknown): StarAlertScope {
  return starAlertScopes.includes(value as StarAlertScope) ? (value as StarAlertScope) : defaultStarAlertSettings.scope;
}

function parseEffectMode(value: unknown): StarAlertEffectMode {
  return starAlertEffectModes.includes(value as StarAlertEffectMode)
    ? (value as StarAlertEffectMode)
    : defaultStarAlertSettings.effectMode;
}

function toStarAlertSettings(value: unknown): StarAlertSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStarAlertSettings;
  }

  const candidate = value as Partial<Record<keyof StarAlertSettings, unknown>>;

  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : defaultStarAlertSettings.enabled,
    scope: parseScope(candidate.scope),
    effectMode: parseEffectMode(candidate.effectMode),
    durationMs:
      typeof candidate.durationMs === "number" && Number.isInteger(candidate.durationMs)
        ? Math.min(10000, Math.max(2000, candidate.durationMs))
        : defaultStarAlertSettings.durationMs,
    pollMs:
      typeof candidate.pollMs === "number" && Number.isInteger(candidate.pollMs)
        ? Math.min(10000, Math.max(1000, candidate.pollMs))
        : defaultStarAlertSettings.pollMs,
    confettiMinimumStars:
      typeof candidate.confettiMinimumStars === "number" && Number.isInteger(candidate.confettiMinimumStars)
        ? Math.min(1000000, Math.max(1, candidate.confettiMinimumStars))
        : defaultStarAlertSettings.confettiMinimumStars,
    fireworksMinimumStars:
      typeof candidate.fireworksMinimumStars === "number" && Number.isInteger(candidate.fireworksMinimumStars)
        ? Math.min(1000000, Math.max(1, candidate.fireworksMinimumStars))
        : defaultStarAlertSettings.fireworksMinimumStars
  };
}

export async function getStarAlertSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: starAlertSettingsKey
    }
  });

  return toStarAlertSettings(setting?.value);
}

export async function updateStarAlertSettings(input: StarAlertSettingsInput, actorId: string) {
  if (!starAlertScopes.includes(input.scope as StarAlertScope)) {
    throw new Error("Choose a valid alert scope.");
  }

  if (!starAlertEffectModes.includes(input.effectMode as StarAlertEffectMode)) {
    throw new Error("Choose a valid alert effect.");
  }

  const durationSeconds = parseInteger(input.durationSeconds, "Alert duration", 2, 10);
  const confettiMinimumStars = parseInteger(input.confettiMinimumStars, "Confetti threshold", 1, 1000000);
  const fireworksMinimumStars = parseInteger(input.fireworksMinimumStars, "Fireworks threshold", 1, 1000000);

  if (fireworksMinimumStars < confettiMinimumStars) {
    throw new Error("Fireworks threshold must be greater than or equal to the confetti threshold.");
  }

  const settings: StarAlertSettings = {
    enabled: input.enabled,
    scope: input.scope as StarAlertScope,
    effectMode: input.effectMode as StarAlertEffectMode,
    durationMs: durationSeconds * 1000,
    pollMs: defaultStarAlertSettings.pollMs,
    confettiMinimumStars,
    fireworksMinimumStars
  };

  await prisma.appSetting.upsert({
    where: {
      key: starAlertSettingsKey
    },
    update: {
      value: settings,
      description: "Live star alert animation settings.",
      isSecret: false
    },
    create: {
      key: starAlertSettingsKey,
      value: settings,
      description: "Live star alert animation settings.",
      isSecret: false
    }
  });

  await writeAuditLog({
    actorId,
    action: "stars.alert_settings.update",
    target: `app-setting:${starAlertSettingsKey}`,
    severity: "info",
    metadata: settings
  });

  return settings;
}
