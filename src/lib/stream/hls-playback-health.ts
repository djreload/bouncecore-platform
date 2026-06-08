export type HlsPlaybackHealthStatus = "healthy" | "warning";

export type HlsPlaybackHealth = {
  detail: string;
  status: HlsPlaybackHealthStatus;
  value: string;
  variantCount: number;
};

type HlsPlaybackHealthInput = {
  adaptive: boolean;
  live: boolean;
  playbackUrl: string | null | undefined;
};

function likelyHlsUrl(value: string) {
  try {
    return new URL(value).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return value.toLowerCase().includes(".m3u8");
  }
}

async function fetchPlaylist(playbackUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(playbackUrl, {
      headers: {
        Accept: "application/vnd.apple.mpegurl,text/plain;q=0.9,*/*;q=0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        error: `HTTP ${response.status}`,
        playlist: null
      };
    }

    return {
      error: null,
      playlist: await response.text()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Playlist request failed",
      playlist: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getHlsPlaybackHealth({
  adaptive,
  live,
  playbackUrl
}: HlsPlaybackHealthInput): Promise<HlsPlaybackHealth> {
  const url = playbackUrl?.trim();

  if (!url) {
    return {
      detail: "No public playback URL is configured.",
      status: "warning",
      value: "Missing",
      variantCount: 0
    };
  }

  if (!likelyHlsUrl(url)) {
    return {
      detail: `${url} is not an HLS .m3u8 playlist URL.`,
      status: "warning",
      value: "Not HLS",
      variantCount: 0
    };
  }

  if (!live) {
    return {
      detail: `Configured at ${url}. Playlist fetch waits for live ingest to avoid false offline warnings.`,
      status: "healthy",
      value: "Waiting for live ingest",
      variantCount: 0
    };
  }

  const result = await fetchPlaylist(url);

  if (!result.playlist) {
    return {
      detail: `Could not fetch ${url}: ${result.error ?? "unknown error"}.`,
      status: "warning",
      value: "Unavailable",
      variantCount: 0
    };
  }

  if (!result.playlist.includes("#EXTM3U")) {
    return {
      detail: `${url} responded but did not look like an HLS playlist.`,
      status: "warning",
      value: "Invalid playlist",
      variantCount: 0
    };
  }

  const variantCount = [...result.playlist.matchAll(/#EXT-X-STREAM-INF/g)].length;

  if (adaptive && variantCount < 3) {
    return {
      detail: `${url} is available, but only ${variantCount} adaptive variant${variantCount === 1 ? "" : "s"} were found.`,
      status: "warning",
      value: `${variantCount}/3 variants`,
      variantCount
    };
  }

  return {
    detail: adaptive ? `${url} is available with ${variantCount} adaptive variants.` : `${url} is available as an HLS playlist.`,
    status: "healthy",
    value: adaptive ? `${variantCount} variants` : "Available",
    variantCount
  };
}
