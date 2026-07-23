import assert from "node:assert/strict";
import test from "node:test";
import { consumeRateLimit, requestRateLimitIdentifier } from "../src/lib/security/request-rate-limit.ts";

test("request rate-limit identifiers are stable hashes without raw client addresses", () => {
  const request = new Request("https://bouncecore.local/api/auth/login", { headers: { "cf-connecting-ip": "203.0.113.42" } });
  const identifier = requestRateLimitIdentifier(request);

  assert.match(identifier, /^[a-f0-9]{32}$/);
  assert.doesNotMatch(identifier, /203\.0\.113\.42/);
});

test("auth rate limiter blocks over-limit requests and returns retry timing", async () => {
  const scope = `test:auth:${Date.now()}`;
  const input = { identifier: "test-client", limit: 2, scope, windowSeconds: 60 };
  const first = await consumeRateLimit(input);
  const second = await consumeRateLimit(input);
  const third = await consumeRateLimit(input);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.ok(third.retryAfterSeconds > 0);
});
