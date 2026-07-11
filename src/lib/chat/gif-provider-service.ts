import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

const gifProviderSettingsKey = "chat.gif_providers";
const giphyBaseUrl = "https://api.giphy.com/v1/gifs/search";
const klipyBaseUrl = "https://api.klipy.com/v2/search";

export type GifProvider = "giphy" | "klipy";

export type GifResult = {
  id: string;
  provider: GifProvider;
  title: string;
  previewUrl: string;
  gifUrl: string;
  width?: number;
  height?: number;
  sourceUrl?: string;
  rating?: string;
};

export type GifProviderSettingsInput = {
  giphyApiKey?: string;
  klipyApiKey?: string;
};

export type GifProviderSettings = Required<GifProviderSettingsInput>;

export type AdminGifProviderSettingsData = {
  configured: Record<GifProvider, boolean>;
  envConfigured: Record<GifProvider, boolean>;
};

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function normalizeString(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return "";
  }

  if (text.length > maxLength) {
    throw new Error(`GIF provider credential must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstRecordWithUrl(...values: unknown[]): Record<string, unknown> {
  return values.map((value) => asRecord(value)).find((value) => typeof value.url === "string" && value.url.trim()) ?? {};
}

function toStoredSettings(value: unknown): GifProviderSettings {
  const stored = asRecord(value);

  return {
    // These server-side keys are used only by /api/gifs/search. Leaving a key blank disables that provider.
    giphyApiKey: (typeof stored.giphyApiKey === "string" && stored.giphyApiKey.trim()) || envValue("GIPHY_API_KEY"),
    klipyApiKey: (typeof stored.klipyApiKey === "string" && stored.klipyApiKey.trim()) || envValue("KLIPY_API_KEY")
  };
}

function publicConfigured(settings: GifProviderSettings): Record<GifProvider, boolean> {
  return {
    giphy: Boolean(settings.giphyApiKey),
    klipy: Boolean(settings.klipyApiKey)
  };
}

export async function getGifProviderSettings(): Promise<GifProviderSettings> {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: gifProviderSettingsKey
    }
  });

  return toStoredSettings(setting?.value);
}

export async function getAdminGifProviderSettingsData(): Promise<AdminGifProviderSettingsData> {
  const settings = await getGifProviderSettings();

  return {
    configured: publicConfigured(settings),
    envConfigured: {
      giphy: Boolean(envValue("GIPHY_API_KEY")),
      klipy: Boolean(envValue("KLIPY_API_KEY"))
    }
  };
}

export async function updateGifProviderSettings(input: GifProviderSettingsInput, actorId: string) {
  const existing = await getGifProviderSettings();
  const next: GifProviderSettings = {
    giphyApiKey: normalizeString(input.giphyApiKey, 300) || existing.giphyApiKey,
    klipyApiKey: normalizeString(input.klipyApiKey, 300) || existing.klipyApiKey
  };

  await prisma.appSetting.upsert({
    where: {
      key: gifProviderSettingsKey
    },
    create: {
      description: "Server-side GIF provider credentials for GIPHY and KLIPY chat search.",
      isSecret: true,
      key: gifProviderSettingsKey,
      value: next as Prisma.InputJsonValue
    },
    update: {
      description: "Server-side GIF provider credentials for GIPHY and KLIPY chat search.",
      isSecret: true,
      value: next as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.gif_providers.update",
    target: `app-setting:${gifProviderSettingsKey}`,
    severity: "warning",
    metadata: publicConfigured(next)
  });

  return publicConfigured(next);
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) {
    return 36;
  }

  return Math.min(60, Math.max(1, Math.round(value)));
}

function clampOffset(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(5000, Math.max(0, Math.round(value)));
}

function cleanQuery(value: string) {
  return value.trim().slice(0, 80);
}

function normalizeDimension(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;

  return number && Number.isFinite(number) && number > 0 && number <= 4000 ? Math.round(number) : undefined;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function gifLikeUrl(value: unknown) {
  const url = httpsUrl(value);

  if (!url) {
    return null;
  }

  return url.replace(/\.gifv($|\?)/i, ".gif$1");
}

function giphyRatingAllowed(value: unknown) {
  const rating = typeof value === "string" ? value.toLowerCase() : "";

  return !rating || ["y", "g", "pg", "pg-13"].includes(rating);
}

function safeTitle(value: unknown, fallback: string) {
  return (typeof value === "string" && value.trim().slice(0, 160)) || fallback;
}

export function normalizeGiphyResults(payload: unknown): GifResult[] {
  return asArray(asRecord(payload).data)
    .map((item) => asRecord(item))
    .filter((item) => giphyRatingAllowed(item.rating))
    .map((item): GifResult | null => {
      const images = asRecord(item.images);
      const original = asRecord(images.original);
      const preview = firstRecordWithUrl(images.fixed_width_small, images.preview_gif);
      const gifUrl = gifLikeUrl(original.url) ?? gifLikeUrl(asRecord(images.downsized_medium).url);
      const previewUrl = gifLikeUrl(preview.url) ?? gifUrl;

      if (!gifUrl || !previewUrl) {
        return null;
      }

      return {
        gifUrl,
        height: normalizeDimension(original.height),
        id: typeof item.id === "string" ? item.id : gifUrl,
        previewUrl,
        provider: "giphy",
        rating: typeof item.rating === "string" ? item.rating : undefined,
        sourceUrl: httpsUrl(item.url) ?? undefined,
        title: safeTitle(item.title, "GIPHY GIF"),
        width: normalizeDimension(original.width)
      };
    })
    .filter((item): item is GifResult => Boolean(item));
}

export function normalizeKlipyResults(payload: unknown): GifResult[] {
  const body = asRecord(payload);
  const candidates = asArray(body.results).length ? asArray(body.results) : asArray(body.data);

  return candidates
    .map((item) => asRecord(item))
    .map((item): GifResult | null => {
      const mediaFormats = asRecord(item.media_formats);
      const gif = firstRecordWithUrl(mediaFormats.gif, mediaFormats.mediumgif);
      const preview = firstRecordWithUrl(mediaFormats.tinygif, mediaFormats.nanogif, gif);
      const gifUrl = gifLikeUrl(gif.url);
      const previewUrl = gifLikeUrl(preview.url) ?? gifUrl;

      if (!gifUrl || !previewUrl) {
        return null;
      }

      const dims = asArray(gif.dims);

      return {
        gifUrl,
        height: normalizeDimension(gif.height) ?? normalizeDimension(dims[1]),
        id: typeof item.id === "string" ? item.id : gifUrl,
        previewUrl,
        provider: "klipy",
        sourceUrl: httpsUrl(item.url) ?? undefined,
        title: safeTitle(item.content_description, safeTitle(item.title, "KLIPY GIF")),
        width: normalizeDimension(gif.width) ?? normalizeDimension(dims[0])
      };
    })
    .filter((item): item is GifResult => Boolean(item));
}

async function fetchJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export async function searchGiphy(query: string, limit: number, apiKey?: string, offsetValue = 0): Promise<GifResult[]> {
  const key = apiKey?.trim() || envValue("GIPHY_API_KEY");

  if (!key) {
    return [];
  }

  const url = new URL(giphyBaseUrl);
  const offset = clampOffset(offsetValue);
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(clampLimit(limit)));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("lang", "en");

  return normalizeGiphyResults(await fetchJson(url));
}

export async function searchKlipy(query: string, limit: number, apiKey?: string, offsetValue = 0): Promise<GifResult[]> {
  const key = apiKey?.trim() || envValue("KLIPY_API_KEY");

  if (!key) {
    return [];
  }

  const url = new URL(klipyBaseUrl);
  const offset = clampOffset(offsetValue);
  url.searchParams.set("key", key);
  url.searchParams.set("client_key", "bouncecore-platform");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(clampLimit(limit)));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("pos", String(offset));
  url.searchParams.set("media_filter", "minimal");
  url.searchParams.set("contentfilter", "medium");
  url.searchParams.set("country", "GB");
  url.searchParams.set("locale", "en_GB");

  return normalizeKlipyResults(await fetchJson(url));
}

function providerPriority(provider: GifProvider) {
  switch (provider) {
    case "giphy":
      return 0;
    case "klipy":
      return 1;
  }
}

export function dedupeGifResults(results: GifResult[]) {
  const deduped = new Map<string, GifResult>();

  for (const result of results) {
    const key = result.gifUrl.trim().toLowerCase();
    const existing = deduped.get(key);

    if (!existing || providerPriority(result.provider) < providerPriority(existing.provider)) {
      deduped.set(key, result);
    }
  }

  return [...deduped.values()];
}

function interleaveGifResults(results: GifResult[]) {
  const byProvider = new Map<GifProvider, GifResult[]>();
  const orderedProviders: GifProvider[] = ["giphy", "klipy"];
  const interleaved: GifResult[] = [];

  for (const provider of orderedProviders) {
    byProvider.set(provider, []);
  }

  for (const result of results) {
    byProvider.get(result.provider)?.push(result);
  }

  const maxLength = Math.max(...orderedProviders.map((provider) => byProvider.get(provider)?.length ?? 0));

  for (let index = 0; index < maxLength; index += 1) {
    for (const provider of orderedProviders) {
      const result = byProvider.get(provider)?.[index];

      if (result) {
        interleaved.push(result);
      }
    }
  }

  return interleaved;
}

export async function searchUnifiedGifs(query: string, limitValue = 36, offsetValue = 0) {
  const normalizedQuery = cleanQuery(query);
  const limit = clampLimit(limitValue);
  const offset = clampOffset(offsetValue);

  if (!normalizedQuery) {
    return {
      nextOffset: null,
      query: "",
      results: [] as GifResult[]
    };
  }

  const credentials = await getGifProviderSettings();
  const providers: Array<[GifProvider, Promise<GifResult[]>]> = [
    ["giphy", searchGiphy(normalizedQuery, limit, credentials.giphyApiKey, offset)],
    ["klipy", searchKlipy(normalizedQuery, limit, credentials.klipyApiKey, offset)]
  ];
  const settled = await Promise.allSettled(providers.map(([, task]) => task));
  const results: GifResult[] = [];

  settled.forEach((settledResult, index) => {
    const provider = providers[index]?.[0] ?? "giphy";

    if (settledResult.status === "fulfilled") {
      results.push(...settledResult.value);
      return;
    }

    console.warn(`[gif-search] ${provider} failed`, settledResult.reason);
  });

  const orderedResults = interleaveGifResults(dedupeGifResults(results));
  const pageResults = orderedResults.slice(0, limit);

  return {
    nextOffset: pageResults.length >= limit ? offset + limit : null,
    query: normalizedQuery,
    results: pageResults
  };
}
