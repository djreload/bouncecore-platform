import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  mediaGatewayHlsAssetUrl,
  mediaGatewayHlsUrlFromTemplate,
  resolveStreamCorePlaybackUrls,
  secondaryPlaybackUrlFromTemplate
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

test("secondary playback uses an opaque public id and resolves MediaMTX paths only inside stream-core", () => {
  assert.equal(
    secondaryPlaybackUrlFromTemplate("https://example.test/hls-secondary/{id}/index.m3u8", "0123456789abcdef"),
    "https://example.test/hls-secondary/0123456789abcdef/index.m3u8"
  );
  assert.equal(
    mediaGatewayHlsAssetUrl(
      "http://media-gateway:8888/{path}/index.m3u8",
      "live/bc_live_private key",
      "segment_001.ts",
      "?token=1"
    ),
    "http://media-gateway:8888/live/bc_live_private%20key/segment_001.ts?token=1"
  );
  assert.equal(secondaryPlaybackUrlFromTemplate("https://example.test/{id}", "not-valid"), null);
  assert.equal(mediaGatewayHlsAssetUrl("http://media-gateway:8888/{path}/index.m3u8", "live/key", "../secret"), null);
});

test("install defaults proxy opaque secondary HLS separately from adaptive primary HLS", () => {
  const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  const installer = readFileSync(join(process.cwd(), "scripts/install-debian-main.sh"), "utf8");
  const interactiveInstaller = readFileSync(join(process.cwd(), "scripts/install-instance.sh"), "utf8");
  const streamCore = readFileSync(join(process.cwd(), "src/stream-core/server.ts"), "utf8");

  assert.match(envExample, /MEDIA_GATEWAY_INTERNAL_HLS_URL="http:\/\/media-gateway:8888\/\{path\}\/index\.m3u8"/);
  assert.match(envExample, /STREAM_CORE_SECONDARY_PLAYBACK_URL="https:\/\/bouncecore\.example\.com\/hls-secondary\/\{id\}\/index\.m3u8"/);
  assert.match(installer, /location \/hls-secondary\/ \{/);
  assert.match(installer, /proxy_pass http:\/\/127\.0\.0\.1:18088\/api\/playback\//);
  assert.match(installer, /STREAM_CORE_SECONDARY_PLAYBACK_URL=\$APP_URL\/hls-secondary\/\{id\}\/index\.m3u8/);
  assert.match(interactiveInstaller, /\$APP_URL\/hls-secondary\/\{id\}\/index\.m3u8/);
  assert.match(streamCore, /url\.pathname\.startsWith\("\/api\/playback\/"\)/);
  assert.doesNotMatch(streamCore, /secondaryPlaybackUrlFromTemplate\([^)]+\) \?\? ingest\.playbackUrl/);
});

test("secondary DJ video uses a compact muted corner PiP", () => {
  const player = readFileSync(join(process.cwd(), "src/app/live/live-playback-player.tsx"), "utf8");

  assert.match(player, /w-\[clamp\(9rem,22%,20rem\)\]/);
  assert.match(player, /border-2 border-\[#22c55e\]\/80/);
  assert.match(player, /secondaryPlaybackUrl/);
  assert.match(player, /muted/);
  assert.doesNotMatch(player, /w-\[min\(34rem,36%\)\]/);
  assert.doesNotMatch(player, /border-4 border-\[#22c55e\]/);
});
