import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeSupportRequestInput,
  supportCategories,
  supportPriorities,
  supportStatuses
} from "../src/lib/support/support-request-core.ts";

test("support options expose expected categories priorities and statuses", () => {
  assert.deepEqual([...supportCategories], ["account", "stream", "chat", "orders", "music", "shop", "mobile", "other"]);
  assert.deepEqual([...supportPriorities], ["normal", "high", "urgent"]);
  assert.deepEqual([...supportStatuses], ["open", "reviewing", "waiting", "resolved", "dismissed"]);
});

test("support request input normalizes email and falls back unknown options", () => {
  const request = normalizeSupportRequestInput({
    category: "bad",
    email: "USER@EXAMPLE.COM ",
    message: " Help needed ",
    priority: "unknown",
    subject: " Login issue "
  });

  assert.equal(request.category, "other");
  assert.equal(request.email, "user@example.com");
  assert.equal(request.message, "Help needed");
  assert.equal(request.priority, "normal");
  assert.equal(request.subject, "Login issue");
});

test("support request input can use signed-in user email fallback", () => {
  const request = normalizeSupportRequestInput(
    {
      message: "Stream key issue",
      subject: "OBS"
    },
    "streamer@example.com"
  );

  assert.equal(request.email, "streamer@example.com");
});

test("support request input rejects missing required fields", () => {
  assert.throws(
    () =>
      normalizeSupportRequestInput({
        email: "person@example.com",
        message: "",
        subject: "Hello"
      }),
    /Message is required/
  );
});
