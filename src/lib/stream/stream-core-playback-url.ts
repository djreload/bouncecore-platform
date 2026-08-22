type StreamCorePlaybackUrlInput = {
  mediaGatewayPublicHlsUrl: string;
  publicPlaybackUrl: string;
  streamCorePublicPlaybackUrl: string;
  transcoderEnabled: boolean;
  transcoderHlsPublicUrl: string;
};

export function resolveStreamCorePlaybackUrls(input: StreamCorePlaybackUrlInput) {
  const transcoderPlaybackUrl = input.transcoderEnabled ? input.transcoderHlsPublicUrl.trim() : "";

  return {
    directMediaGatewayPlaybackUrl: input.mediaGatewayPublicHlsUrl.trim(),
    primaryPublicPlaybackUrl:
      transcoderPlaybackUrl || input.streamCorePublicPlaybackUrl.trim() || input.publicPlaybackUrl.trim() || null,
    transcoderPlaybackUrl
  };
}

export function mediaGatewayHlsUrlFromTemplate(template: string, path: string | null, includeSensitivePath = false) {
  if (!template) {
    return null;
  }

  if (!template.includes("{path}")) {
    return template;
  }

  const safePath = (path ?? "live")
    .split("/")
    .filter((segment) => segment && (includeSensitivePath || !segment.startsWith("bc_live_")))
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return template.replace("{path}", safePath || "live");
}

export function secondaryPlaybackUrlFromTemplate(template: string, ingestId: string) {
  if (!template || !/^[a-f0-9]{16}$/.test(ingestId)) {
    return null;
  }

  return template.includes("{id}") ? template.replaceAll("{id}", ingestId) : null;
}

export function mediaGatewayHlsAssetUrl(template: string, ingestPath: string, assetPath: string, search = "") {
  const playbackUrl = mediaGatewayHlsUrlFromTemplate(template, ingestPath, true);

  if (!playbackUrl) {
    return null;
  }

  const assetSegments = assetPath.split("/").filter(Boolean);

  if (!assetSegments.length || assetSegments.some((segment) => !/^[a-zA-Z0-9._~-]+$/.test(segment) || segment === "." || segment === "..")) {
    return null;
  }

  const resolved = new URL(playbackUrl);
  const basePath = resolved.pathname.endsWith("/index.m3u8")
    ? resolved.pathname.slice(0, -"index.m3u8".length)
    : `${resolved.pathname.replace(/\/+$/, "")}/`;
  resolved.pathname = `${basePath}${assetSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  resolved.search = search;

  return resolved.toString();
}
