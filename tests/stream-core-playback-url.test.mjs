import assert from "node:assert/strict";
import test from "node:test";
import {
  mediaGatewayHlsUrlFromTemplate,
  resolveStreamCorePlaybackUrls
} from "../src/lib/stream/stream-core-playback-url.ts";

test("stream-core keeps secondary MediaMTX HLS separate from transcoded primary playback", () => {
  const urls = resolveStreamCorePlaybackUrls({
    mediaGatewayPublicHlsUrl: "http://127.0.0.1:18888/{path}/index.m3u8",
    publicPlaybackUrl: "http://example.test/fallback.m3u8",
    streamCorePublicPlaybackUrl: "http://example.test/live.m3u8",
    transcoderEnabled: true,
    transcoderHlsPublicUrl: "http://127.0.0.1:18889/live/master.m3u8"
  });

  assert.equal(urls.primaryPublicPlaybackUrl, "http://127.0.0.1:18889/live/master.m3u8");
  assert.equal(urls.directMediaGatewayPlaybackUrl, "http://127.0.0.1:18888/{path}/index.m3u8");
});

test("mediaGatewayHlsUrlFromTemplate can preserve keyed ingest paths for secondary PiP playback", () => {
  assert.equal(
    mediaGatewayHlsUrlFromTemplate("http://127.0.0.1:18888/{path}/index.m3u8", "live/bc_live_a b", true),
    "http://127.0.0.1:18888/live/bc_live_a%20b/index.m3u8"
  );
});

test("mediaGatewayHlsUrlFromTemplate can hide keyed ingest path segments for public generic URLs", () => {
  assert.equal(
    mediaGatewayHlsUrlFromTemplate("http://127.0.0.1:18888/{path}/index.m3u8", "live/bc_live_secret", false),
    "http://127.0.0.1:18888/live/index.m3u8"
  );
});
