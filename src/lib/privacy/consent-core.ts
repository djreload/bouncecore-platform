export const cookieConsentStorageKey = "bouncecore.cookieConsent.v1";
export const cookieConsentVersion = 1;

export const consentCategoryKeys = ["necessary", "analytics", "marketing", "preferences"] as const;

export type ConsentCategoryKey = (typeof consentCategoryKeys)[number];

export type ConsentPreferences = Record<ConsentCategoryKey, boolean>;

export type ConsentRecord = {
  preferences: ConsentPreferences;
  updatedAt: string;
  version: number;
};

export const consentCategories = [
  {
    description: "Required for login, security, checkout, carts, chat, and service operation.",
    key: "necessary",
    label: "Necessary",
    required: true
  },
  {
    description: "Used only if analytics tooling is added and enabled by the site operator.",
    key: "analytics",
    label: "Analytics",
    required: false
  },
  {
    description: "Used for advertising, attribution, marketing pixels, or similar tools if enabled.",
    key: "marketing",
    label: "Marketing",
    required: false
  },
  {
    description: "Stores non-essential display and experience preferences.",
    key: "preferences",
    label: "Preferences",
    required: false
  }
] as const satisfies ReadonlyArray<{
  description: string;
  key: ConsentCategoryKey;
  label: string;
  required: boolean;
}>;

export function defaultConsentPreferences(): ConsentPreferences {
  return {
    analytics: false,
    marketing: false,
    necessary: true,
    preferences: false
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeConsentPreferences(value: unknown): ConsentPreferences {
  const preferences = defaultConsentPreferences();
  const input = isObject(value) ? value : {};

  for (const key of consentCategoryKeys) {
    if (key === "necessary") {
      preferences.necessary = true;
      continue;
    }

    if (typeof input[key] === "boolean") {
      preferences[key] = input[key];
    }
  }

  return preferences;
}

export function normalizeConsentRecord(value: unknown): ConsentRecord | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    preferences: normalizeConsentPreferences(value.preferences),
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim() ? value.updatedAt : new Date(0).toISOString(),
    version: cookieConsentVersion
  };
}

export function createConsentRecord(preferences: unknown, now = new Date()): ConsentRecord {
  return {
    preferences: normalizeConsentPreferences(preferences),
    updatedAt: now.toISOString(),
    version: cookieConsentVersion
  };
}

export function consentAllowsCategory(record: ConsentRecord | null, category: ConsentCategoryKey) {
  if (category === "necessary") {
    return true;
  }

  return Boolean(record?.preferences[category]);
}
