import assert from "node:assert/strict";
import test from "node:test";
import { releaseCandidateConfig } from "../scripts/release-candidate-check.mjs";

test("release candidate smoke requires a protected account and normalizes its target", () => {
  assert.throws(() => releaseCandidateConfig({ SMOKE_BASE_URL: "https://bouncecore.example.com" }), /SMOKE_AUTH_EMAIL/);

  const config = releaseCandidateConfig({
    SMOKE_AUTH_EMAIL: "owner@example.com",
    SMOKE_AUTH_PASSWORD: "secret",
    SMOKE_BASE_URL: "https://bouncecore.example.com/",
    SMOKE_TIMEOUT_MS: "20000"
  });

  assert.equal(config.baseUrl, "https://bouncecore.example.com");
  assert.equal(config.timeoutMs, 20000);
});
