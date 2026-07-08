export type SheepThrowSprite = {
  id: string;
  label: string;
  spriteSheetUrl: string;
  glassSmashUrl: string;
  frameCount: number;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  enabled: boolean;
};

export type SheepThrowSettings = {
  enabled: boolean;
  cooldownSeconds: number;
  costStars: number;
  overlayDurationMs: number;
  pollMs: number;
  maxRecentEvents: number;
  sprites: SheepThrowSprite[];
};

export type SheepThrowSpriteInput = {
  id?: string;
  label?: string;
  spriteSheetUrl?: string;
  frameCount?: string;
  columns?: string;
  rows?: string;
  frameWidth?: string;
  frameHeight?: string;
  enabled?: boolean;
};

export type SheepThrowSettingsInput = {
  enabled: boolean;
  cooldownMinutes: string;
  costStars: string;
  overlayDurationSeconds?: string;
  pollSeconds?: string;
  maxRecentEvents?: string;
  sprites?: SheepThrowSpriteInput[];
};

export const defaultSheepThrowSprite: SheepThrowSprite = {
  id: "sheep",
  label: "Sheep",
  spriteSheetUrl: "/sheep-throw/SheepThrowSequence.png",
  glassSmashUrl: "/sheep-throw/glass-smash.png",
  frameCount: 12,
  columns: 12,
  rows: 1,
  frameWidth: 400,
  frameHeight: 400,
  enabled: true
};

export const defaultSheepThrowSettings: SheepThrowSettings = {
  enabled: true,
  cooldownSeconds: 300,
  costStars: 10,
  overlayDurationMs: 4300,
  pollMs: 2000,
  maxRecentEvents: 16,
  sprites: [defaultSheepThrowSprite]
};

export function formatSheepThrowToast(throwerDisplayName: string, targetDisplayName: string, spriteLabel = "Sheep") {
  const normalizedLabel = (spriteLabel.trim() || "Sheep").toLowerCase();
  const article = /^(uni|user|use|euro)/.test(normalizedLabel) ? "a" : /^[aeiou]/.test(normalizedLabel) ? "an" : "a";

  return `${throwerDisplayName} threw ${article} ${normalizedLabel} at ${targetDisplayName} \u{1f602}`;
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

function compactText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  if (!text) {
    return fallback;
  }

  return text.slice(0, maxLength);
}

function compactSpriteId(value: unknown, fallback: string) {
  const text = compactText(value, "", 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return text || fallback;
}

function normalizeSpriteUrl(value: unknown, label: string, fallback?: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    if (fallback) {
      return fallback;
    }

    throw new Error(`${label} needs an uploaded sprite sheet image.`);
  }

  if (text.length > 500) {
    throw new Error(`${label} must be 500 characters or fewer.`);
  }

  if (
    /^\/sheep-throw\/[^/]+\.(png|jpg|jpeg|webp|gif|avif)$/i.test(text) ||
    /^\/uploads\/throw-sprites\/[^/]+\.(png|jpg|jpeg|webp|gif|avif)$/i.test(text)
  ) {
    return text;
  }

  let url: URL;

  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be an uploaded sprite image or a valid https URL.`);
  }

  if (url.protocol !== "https:" || !/\.(png|jpg|jpeg|webp|gif|avif)$/i.test(url.pathname)) {
    throw new Error(`${label} must point to a PNG, JPG, WebP, GIF, or AVIF sprite image.`);
  }

  return text;
}

function normalizeSprite(value: unknown, index: number): SheepThrowSprite | null {
  const record = isObject(value) ? value : {};
  const rawLabel = compactText(record.label, "", 40);
  const spriteSheetUrl = compactText(record.spriteSheetUrl, "", 500);

  if (!rawLabel && !spriteSheetUrl) {
    return null;
  }

  const label = rawLabel || `Throwable ${index + 1}`;
  const id = compactSpriteId(record.id, compactSpriteId(label, `throwable-${index + 1}`));

  if (id === defaultSheepThrowSprite.id) {
    return {
      ...defaultSheepThrowSprite,
      enabled: typeof record.enabled === "boolean" ? record.enabled : defaultSheepThrowSprite.enabled
    };
  }

  return {
    id,
    label,
    spriteSheetUrl: normalizeSpriteUrl(spriteSheetUrl, `${label || "Throwable"} sprite sheet`),
    glassSmashUrl: normalizeSpriteUrl(record.glassSmashUrl, `${label || "Throwable"} glass smash`, defaultSheepThrowSprite.glassSmashUrl),
    frameCount: wholeNumber(record.frameCount, defaultSheepThrowSprite.frameCount, 1, 120),
    columns: wholeNumber(record.columns, defaultSheepThrowSprite.columns, 1, 60),
    rows: wholeNumber(record.rows, defaultSheepThrowSprite.rows, 1, 20),
    frameWidth: wholeNumber(record.frameWidth, defaultSheepThrowSprite.frameWidth, 32, 2000),
    frameHeight: wholeNumber(record.frameHeight, defaultSheepThrowSprite.frameHeight, 32, 2000),
    enabled: typeof record.enabled === "boolean" ? record.enabled : true
  };
}

function normalizeSprites(value: unknown): SheepThrowSprite[] {
  const seen = new Set([defaultSheepThrowSprite.id]);
  const customSprites = (Array.isArray(value) ? value : [])
    .map((item, index) => normalizeSprite(item, index))
    .filter((item): item is SheepThrowSprite => Boolean(item))
    .filter((sprite) => {
      if (sprite.id === defaultSheepThrowSprite.id) {
        return false;
      }

      if (seen.has(sprite.id)) {
        return false;
      }

      seen.add(sprite.id);
      return true;
    })
    .slice(0, 12);

  return [defaultSheepThrowSprite, ...customSprites];
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
    maxRecentEvents: wholeNumber(value.maxRecentEvents, defaultSheepThrowSettings.maxRecentEvents, 4, 50),
    sprites: normalizeSprites(value.sprites)
  };
}

export function normalizeSheepThrowSettingsInput(input: SheepThrowSettingsInput): SheepThrowSettings {
  const cooldownMinutes = Number(input.cooldownMinutes);
  const costStars = Number(input.costStars);
  const overlayDurationSeconds =
    input.overlayDurationSeconds === undefined
      ? defaultSheepThrowSettings.overlayDurationMs / 1000
      : requiredDecimal(input.overlayDurationSeconds, "Sheep overlay duration", 1.8, 10);
  const pollSeconds =
    input.pollSeconds === undefined ? defaultSheepThrowSettings.pollMs / 1000 : requiredDecimal(input.pollSeconds, "Sheep polling speed", 1, 10);
  const maxRecentEvents =
    input.maxRecentEvents === undefined
      ? defaultSheepThrowSettings.maxRecentEvents
      : requiredWholeNumber(input.maxRecentEvents, "Sheep event queue", 4, 50);

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
    costStars,
    overlayDurationMs: Math.round(overlayDurationSeconds * 1000),
    pollMs: Math.round(pollSeconds * 1000),
    maxRecentEvents,
    sprites: normalizeSprites(input.sprites)
  };
}

export function getAvailableSheepThrowSprites(settings: SheepThrowSettings) {
  const sprites = settings.sprites.filter((sprite) => sprite.enabled);

  return sprites.length ? sprites : [defaultSheepThrowSprite];
}

export function getSheepThrowSprite(settings: SheepThrowSettings, spriteId?: string | null) {
  const sprites = getAvailableSheepThrowSprites(settings);

  return sprites.find((sprite) => sprite.id === spriteId) ?? sprites[0] ?? defaultSheepThrowSprite;
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

export function formatSheepThrowCooldownLabel(seconds: number) {
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
