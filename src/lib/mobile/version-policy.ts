export type MobileVersionPolicyInput = {
  androidLatestVersionCode?: number | string;
  androidLatestVersionName?: string;
  androidMinimumVersionCode?: number | string;
  androidUpdateMessage?: string;
  androidUpdateUrl?: string;
};

export type MobileVersionPolicy = {
  latestVersionCode: number | null;
  latestVersionName: string | null;
  minimumSupportedVersionCode: number;
  platform: "android";
  updateMessage: string;
  updateUrl: string | null;
};

const maxAndroidVersionCode = 2_100_000_000;
const defaultUpdateMessage = "A newer Bouncecore app is required. Please update to continue.";

export function defaultMobileVersionPolicy(): MobileVersionPolicy {
  return {
    latestVersionCode: null,
    latestVersionName: null,
    minimumSupportedVersionCode: 1,
    platform: "android",
    updateMessage: defaultUpdateMessage,
    updateUrl: null
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function normalizedVersionCode(value: number | string | undefined, label: string, fallback: number | null) {
  const rawValue = typeof value === "string" ? value.trim() : value;

  if (rawValue === "" || rawValue === undefined) {
    return fallback;
  }

  const versionCode = typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > maxAndroidVersionCode) {
    throw new Error(`${label} must be a whole number between 1 and ${maxAndroidVersionCode}.`);
  }

  return versionCode;
}

function normalizedUpdateUrl(value: string | undefined) {
  const url = normalizedText(value, 300);

  if (!url) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Android update URL must be a valid HTTPS URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Android update URL must use HTTPS.");
  }

  return parsedUrl.toString();
}

function normalizeStoredUpdateUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return normalizedUpdateUrl(value);
  } catch {
    return null;
  }
}

export function mergeMobileVersionPolicy(value: unknown): MobileVersionPolicy {
  const policy = defaultMobileVersionPolicy();

  if (!isObject(value)) {
    return policy;
  }

  if (typeof value.latestVersionCode === "number" && Number.isInteger(value.latestVersionCode) && value.latestVersionCode > 0) {
    policy.latestVersionCode = Math.min(value.latestVersionCode, maxAndroidVersionCode);
  }

  if (typeof value.latestVersionName === "string" && value.latestVersionName.trim()) {
    policy.latestVersionName = value.latestVersionName.trim().slice(0, 40);
  }

  if (
    typeof value.minimumSupportedVersionCode === "number" &&
    Number.isInteger(value.minimumSupportedVersionCode) &&
    value.minimumSupportedVersionCode > 0
  ) {
    policy.minimumSupportedVersionCode = Math.min(value.minimumSupportedVersionCode, maxAndroidVersionCode);
  }

  policy.updateUrl = normalizeStoredUpdateUrl(value.updateUrl);

  if (typeof value.updateMessage === "string" && value.updateMessage.trim()) {
    policy.updateMessage = value.updateMessage.trim().slice(0, 180);
  }

  return policy;
}

export function normalizeMobileVersionPolicyInput(input: MobileVersionPolicyInput): MobileVersionPolicy {
  const latestVersionCode = normalizedVersionCode(input.androidLatestVersionCode, "Latest Android version code", null);
  const minimumSupportedVersionCode =
    normalizedVersionCode(input.androidMinimumVersionCode, "Minimum supported Android version code", 1) ?? 1;
  const latestVersionName = normalizedText(input.androidLatestVersionName, 40);
  const updateUrl = normalizedUpdateUrl(input.androidUpdateUrl);
  const updateMessage = normalizedText(input.androidUpdateMessage, 180) ?? defaultUpdateMessage;

  if (latestVersionCode !== null && latestVersionCode < minimumSupportedVersionCode) {
    throw new Error("Latest Android version code cannot be lower than the minimum supported version code.");
  }

  if (minimumSupportedVersionCode > 1 && !updateUrl) {
    throw new Error("Android update URL is required when the minimum supported version code is above 1.");
  }

  return {
    latestVersionCode,
    latestVersionName,
    minimumSupportedVersionCode,
    platform: "android",
    updateMessage,
    updateUrl
  };
}

export function isAndroidUpdateRequired(currentVersionCode: number, policy: MobileVersionPolicy) {
  return Number.isInteger(currentVersionCode) && currentVersionCode < policy.minimumSupportedVersionCode;
}
