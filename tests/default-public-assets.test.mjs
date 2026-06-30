import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { defaultSiteFaviconUrl } from "../src/lib/admin/site-settings-service.ts";
import { defaultStreamOfflineImageUrl, resolveStreamOfflineImageUrl } from "../src/lib/stream/stream-channel-service.ts";

function publicPath(url) {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

test("built-in favicon exists for default branding metadata", () => {
  assert.equal(defaultSiteFaviconUrl, "/favicon.svg");
  assert.equal(existsSync(publicPath(defaultSiteFaviconUrl)), true);
});

test("built-in stream offline image exists and is used as fallback", () => {
  assert.equal(defaultStreamOfflineImageUrl, "/images/bouncecore-stage-hero.png");
  assert.equal(existsSync(publicPath(defaultStreamOfflineImageUrl)), true);
  assert.equal(resolveStreamOfflineImageUrl(null), defaultStreamOfflineImageUrl);
  assert.equal(resolveStreamOfflineImageUrl(""), defaultStreamOfflineImageUrl);
  assert.equal(resolveStreamOfflineImageUrl("/uploads/stream-offline-images/custom.png"), "/uploads/stream-offline-images/custom.png");
});
