export const restreamProviders = ["custom", "youtube", "facebook"] as const;
export const restreamTargetSlots = ["primary", "secondary"] as const;

export type RestreamProvider = (typeof restreamProviders)[number];
export type RestreamTargetSlot = (typeof restreamTargetSlots)[number];

export type RestreamSettings = {
  enabled: boolean;
  label: string;
  provider: RestreamProvider;
  serverUrl: string;
  streamKey: string;
};

export type AdminRestreamSettings = Omit<RestreamSettings, "streamKey"> & {
  streamKeyConfigured: boolean;
  targetHost: string | null;
};

export type RestreamSettingsInput = {
  clearStreamKey?: boolean;
  enabled: boolean;
  label: string;
  provider: string;
  serverUrl: string;
  streamKey?: string;
};

export const defaultRestreamSettings: RestreamSettings = {
  enabled: false,
  label: "",
  provider: "custom",
  serverUrl: "",
  streamKey: ""
};

export function restreamTargetSlotValue(value: unknown): RestreamTargetSlot {
  if (!restreamTargetSlots.includes(value as RestreamTargetSlot)) {
    throw new Error("Invalid restream destination.");
  }

  return value as RestreamTargetSlot;
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function providerValue(value: unknown): RestreamProvider {
  return restreamProviders.includes(value as RestreamProvider) ? (value as RestreamProvider) : "custom";
}

function boolValue(value: unknown) {
  return typeof value === "boolean" ? value : value === "true" || value === "on" || value === 1;
}

function targetUrl(settings: Pick<RestreamSettings, "serverUrl" | "streamKey">) {
  const serverUrl = settings.serverUrl.trim();
  const streamKey = settings.streamKey.trim();

  if (!serverUrl) {
    return null;
  }

  if (serverUrl.includes("{streamKey}")) {
    return streamKey ? serverUrl.replaceAll("{streamKey}", encodeURIComponent(streamKey)) : null;
  }

  if (streamKey) {
    return `${serverUrl.replace(/\/+$/, "")}/${encodeURIComponent(streamKey)}`;
  }

  return serverUrl;
}

function ipv4Parts(hostname: string) {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const numbers = parts.map((part) => Number.parseInt(part, 10));

  return numbers.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? numbers : null;
}

function hostIsBlocked(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "host.docker.internal"
  ) {
    return true;
  }

  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }

  const parts = ipv4Parts(host);

  if (!parts) {
    return false;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export function normalizeRestreamSettings(value: unknown): RestreamSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultRestreamSettings;
  }

  const candidate = value as Partial<Record<keyof RestreamSettings, unknown>>;

  return {
    enabled: boolValue(candidate.enabled),
    label: textValue(candidate.label, 80),
    provider: providerValue(candidate.provider),
    serverUrl: textValue(candidate.serverUrl, 400),
    streamKey: textValue(candidate.streamKey, 500)
  };
}

export function mergeRestreamSettingsInput(input: RestreamSettingsInput, existing = defaultRestreamSettings): RestreamSettings {
  return {
    enabled: input.enabled,
    label: textValue(input.label, 80),
    provider: providerValue(input.provider),
    serverUrl: textValue(input.serverUrl, 400),
    streamKey: input.clearStreamKey ? "" : textValue(input.streamKey, 500) || existing.streamKey
  };
}

export function buildRestreamTargetUrl(settings: RestreamSettings) {
  if (!settings.enabled) {
    return null;
  }

  const resolvedTargetUrl = targetUrl(settings);

  if (!resolvedTargetUrl) {
    return null;
  }

  const parsed = new URL(resolvedTargetUrl);

  if (parsed.protocol !== "rtmp:" && parsed.protocol !== "rtmps:") {
    throw new Error("Restream target must use RTMP or RTMPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Restream target must not include URL username or password credentials.");
  }

  if (hostIsBlocked(parsed.hostname)) {
    throw new Error("Restream target must use a public streaming host.");
  }

  return parsed.toString();
}

export function toAdminRestreamSettings(settings: RestreamSettings): AdminRestreamSettings {
  let targetHost: string | null = null;

  try {
    const resolvedTargetUrl = targetUrl(settings);
    targetHost = resolvedTargetUrl ? new URL(resolvedTargetUrl).hostname : null;
  } catch {
    targetHost = null;
  }

  return {
    enabled: settings.enabled,
    label: settings.label,
    provider: settings.provider,
    serverUrl: settings.serverUrl,
    streamKeyConfigured: Boolean(settings.streamKey),
    targetHost
  };
}
