import assert from "node:assert/strict";
import test from "node:test";
import { hasTranscoderPathPlaceholder, resolveTranscoderSourceUrlTemplate } from "../src/lib/stream/transcoder-source.ts";

test("resolveTranscoderSourceUrlTemplate inserts encoded stream paths", () => {
  assert.equal(
    resolveTranscoderSourceUrlTemplate("rtmp://media-gateway:1935/{path}", "live/bc_live_a b"),
    "rtmp://media-gateway:1935/live/bc_live_a%20b"
  );
});

test("resolveTranscoderSourceUrlTemplate leaves static source URLs usable", () => {
  assert.equal(resolveTranscoderSourceUrlTemplate("rtmp://media-gateway:1935/live", "live/bc_live_key"), "rtmp://media-gateway:1935/live");
});

test("hasTranscoderPathPlaceholder detects encoded and raw path placeholders", () => {
  assert.equal(hasTranscoderPathPlaceholder("rtmp://media-gateway:1935/{streamPath}"), true);
  assert.equal(hasTranscoderPathPlaceholder("rtmp://media-gateway:1935/{pathRaw}"), true);
  assert.equal(hasTranscoderPathPlaceholder("rtmp://media-gateway:1935/live"), false);
});
