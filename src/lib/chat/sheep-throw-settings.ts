export type SheepThrowSettings = {
  enabled: boolean;
  cooldownSeconds: number;
  costStars: number;
  overlayDurationMs: number;
  pollMs: number;
  maxRecentEvents: number;
};

export type SheepThrowSettingsInput = {
  enabled: boolean;
  cooldownMinutes: string;
  costStars: string;
};

export const defaultSheepThrowSettings: SheepThrowSettings = {
  enabled: true,
  cooldownSeconds: 300,
  costStars: 10,
  overlayDurationMs: 4300,
  pollMs: 2000,
  maxRecentEvents: 16
};

export function formatSheepThrowToast(throwerDisplayName: string, targetDisplayName: string) {
  return `${throwerDisplayName} threw a sheep at ${targetDisplayName} 😂`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

export function normalizeSheepThrowSettings(value: unknown): SheepThrowSettings {
  if (!isObject(value)) {
    return defaultSheepThrowSettings;
  }

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : defaultSheepThrowSettings.enabled,
    cooldownSeconds: wholeNumber(value.cooldownSeconds, defaultSheepThrowSettings.cooldownSeconds, 0, 24 * 60 * 60),
    costStars: wholeNumber(value.costStars, defaultSheepThrowSettings.costStars, 0, 1000000),
    overlayDurationMs: wholeNumber(value.overlayDurationMs, defaultSheepThrowSettings.overlayDurationMs, 1800, 10000),
    pollMs: wholeNumber(value.pollMs, defaultSheepThrowSettings.pollMs, 1000, 10000),
    maxRecentEvents: wholeNumber(value.maxRecentEvents, defaultSheepThrowSettings.maxRecentEvents, 4, 50)
  };
}

export function normalizeSheepThrowSettingsInput(input: SheepThrowSettingsInput): SheepThrowSettings {
  const cooldownMinutes = Number(input.cooldownMinutes);
  const costStars = Number(input.costStars);

  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > 1440) {
    throw new Error("Sheep cooldown must be between 0 and 1440 minutes.");
  }

  if (!Number.isInteger(costStars) || costStars < 0 || costStars > 1000000) {
    throw new Error("Sheep throw cost must be a whole number between 0 and 1000000 stars.");
  }

  return {
    ...defaultSheepThrowSettings,
    enabled: input.enabled,
    cooldownSeconds: Math.round(cooldownMinutes * 60),
    costStars
  };
}

export function remainingSheepThrowCooldownSeconds(
  latestThrowCreatedAt: Date | string | null | undefined,
  cooldownSeconds: number,
  now = new Date()
) {
  if (!latestThrowCreatedAt || cooldownSeconds < 1) {
    return 0;
  }

  const latestThrowTime = latestThrowCreatedAt instanceof Date ? latestThrowCreatedAt.getTime() : new Date(latestThrowCreatedAt).getTime();

  if (!Number.isFinite(latestThrowTime)) {
    return 0;
  }

  const elapsedSeconds = Math.floor((now.getTime() - latestThrowTime) / 1000);

  return Math.max(0, cooldownSeconds - elapsedSeconds);
}
