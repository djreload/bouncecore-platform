const tenorBaseUrl = "https://tenor.googleapis.com/v2";
const tenorClientKey = "bouncecore-platform";

type TenorMediaFormat = {
  url?: string;
  dims?: [number, number];
};

type TenorResponseObject = {
  id?: string;
  content_description?: string;
  title?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
  };
};

type TenorSearchResponse = {
  results?: TenorResponseObject[];
};

export type ChatGifResult = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
};

function tenorApiKey() {
  return process.env.TENOR_API_KEY?.trim() ?? "";
}

function mediaDimensions(media: TenorMediaFormat | undefined) {
  if (!media?.dims || media.dims.length !== 2) {
    return {
      width: null,
      height: null
    };
  }

  return {
    width: Number.isFinite(media.dims[0]) ? media.dims[0] : null,
    height: Number.isFinite(media.dims[1]) ? media.dims[1] : null
  };
}

function toGifResult(result: TenorResponseObject): ChatGifResult | null {
  const id = result.id?.trim();
  const gif = result.media_formats?.gif;
  const preview = result.media_formats?.tinygif ?? gif;
  const url = gif?.url?.trim();
  const previewUrl = preview?.url?.trim() ?? url;

  if (!id || !url || !previewUrl) {
    return null;
  }

  const dimensions = mediaDimensions(gif);

  return {
    id,
    title: result.content_description?.trim() || result.title?.trim() || "Tenor GIF",
    url,
    previewUrl,
    width: dimensions.width,
    height: dimensions.height
  };
}

export async function searchTenorGifs(query: string) {
  const key = tenorApiKey();
  const normalizedQuery = query.trim().slice(0, 80);

  if (!key) {
    throw new Error("Tenor API key is not configured.");
  }

  if (!normalizedQuery) {
    return [];
  }

  const url = new URL(`${tenorBaseUrl}/search`);
  url.searchParams.set("key", key);
  url.searchParams.set("client_key", tenorClientKey);
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("limit", "12");
  url.searchParams.set("media_filter", "gif,tinygif");
  url.searchParams.set("contentfilter", "medium");
  url.searchParams.set("country", "GB");
  url.searchParams.set("locale", "en_GB");

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Tenor search failed.");
  }

  const payload = (await response.json()) as TenorSearchResponse;

  return (payload.results ?? []).map(toGifResult).filter((result): result is ChatGifResult => Boolean(result));
}

export async function registerTenorShare(gifId: string, query: string) {
  const key = tenorApiKey();
  const normalizedGifId = gifId.trim();
  const normalizedQuery = query.trim().slice(0, 80);

  if (!key || !normalizedGifId) {
    return;
  }

  const url = new URL(`${tenorBaseUrl}/registershare`);
  url.searchParams.set("key", key);
  url.searchParams.set("client_key", tenorClientKey);
  url.searchParams.set("id", normalizedGifId);
  url.searchParams.set("country", "GB");
  url.searchParams.set("locale", "en_GB");

  if (normalizedQuery) {
    url.searchParams.set("q", normalizedQuery);
  }

  try {
    await fetch(url, {
      cache: "no-store"
    });
  } catch {
    // Search selection should still send the chat message if share registration is unavailable.
  }
}
