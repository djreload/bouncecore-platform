export type RaveWarSettings = {
  enabled: boolean;
  challengeTtlSeconds: number;
  cooldownSeconds: number;
  costStars: number;
};

export type RaveWarSettingsInput = {
  enabled: boolean;
  challengeTtlMinutes: string;
  cooldownMinutes: string;
  costStars: string;
};

export const defaultRaveWarSettings: RaveWarSettings = {
  enabled: true,
  challengeTtlSeconds: 300,
  cooldownSeconds: 300,
  costStars: 0
};

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

function requiredDecimal(value: unknown, label: string, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return number;
}

function requiredWholeNumber(value: unknown, label: string, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }

  return number;
}

export function normalizeRaveWarSettings(value: unknown): RaveWarSettings {
  if (!isObject(value)) {
    return defaultRaveWarSettings;
  }

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : defaultRaveWarSettings.enabled,
    challengeTtlSeconds: wholeNumber(value.challengeTtlSeconds, defaultRaveWarSettings.challengeTtlSeconds, 60, 30 * 60),
    cooldownSeconds: wholeNumber(value.cooldownSeconds, defaultRaveWarSettings.cooldownSeconds, 0, 24 * 60 * 60),
    costStars: wholeNumber(value.costStars, defaultRaveWarSettings.costStars, 0, 1000000)
  };
}

export function normalizeRaveWarSettingsInput(input: RaveWarSettingsInput): RaveWarSettings {
  const challengeTtlMinutes = requiredDecimal(input.challengeTtlMinutes, "Rave War challenge expiry", 1, 30);
  const cooldownMinutes = requiredDecimal(input.cooldownMinutes, "Rave War cooldown", 0, 1440);
  const costStars = requiredWholeNumber(input.costStars, "Rave War cost", 0, 1000000);

  return {
    enabled: input.enabled,
    challengeTtlSeconds: Math.round(challengeTtlMinutes * 60),
    cooldownSeconds: Math.round(cooldownMinutes * 60),
    costStars
  };
}

export function remainingRaveWarCooldownSeconds(
  latestChallengeCreatedAt: Date | string | null | undefined,
  cooldownSeconds: number,
  now = new Date()
) {
  if (!latestChallengeCreatedAt || cooldownSeconds < 1) {
    return 0;
  }

  const latestChallengeTime =
    latestChallengeCreatedAt instanceof Date ? latestChallengeCreatedAt.getTime() : new Date(latestChallengeCreatedAt).getTime();

  if (!Number.isFinite(latestChallengeTime)) {
    return 0;
  }

  const elapsedSeconds = Math.floor((now.getTime() - latestChallengeTime) / 1000);

  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

export function formatRaveWarCooldownLabel(seconds: number) {
  const remaining = Math.max(0, Math.ceil(seconds));

  if (remaining < 1) {
    return "Ready";
  }

  if (remaining < 60) {
    return `${remaining}s`;
  }

  const minutes = Math.floor(remaining / 60);
  const trailingSeconds = remaining % 60;

  return trailingSeconds > 0 ? `${minutes}m ${trailingSeconds}s` : `${minutes}m`;
}
