import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { defaultSiteFaviconUrl, resolveDefaultSupportEmail } from "../src/lib/admin/site-settings-service.ts";
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

test("support email defaults prefer explicit public support env", () => {
  assert.equal(
    resolveDefaultSupportEmail({
      MAIL_REPLY_TO: "reply@example.com",
      PUBLIC_SUPPORT_EMAIL: "Support@Example.com",
      SUPPORT_EMAIL: "fallback@example.com"
    }),
    "support@example.com"
  );
});

test("support email defaults fall back to reply-to email", () => {
  assert.equal(
    resolveDefaultSupportEmail({
      MAIL_FROM: "no-reply@example.com",
      MAIL_REPLY_TO: "Reply@Example.com"
    }),
    "reply@example.com"
  );
});

test("support email defaults ignore no-reply sender addresses", () => {
  assert.equal(resolveDefaultSupportEmail({ MAIL_FROM: "no-reply@example.com" }), null);
  assert.equal(resolveDefaultSupportEmail({ MAIL_FROM: "do-not-reply@example.com" }), null);
});

test("support email defaults can use a normal sender address as final fallback", () => {
  assert.equal(resolveDefaultSupportEmail({ MAIL_FROM: "hello@example.com" }), "hello@example.com");
});
