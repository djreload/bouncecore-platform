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
