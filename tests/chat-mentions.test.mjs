import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractMentionTokens,
  getActiveMentionQuery,
  mentionTokenFromDisplayName,
  replaceActiveMention,
  splitTextMentions
} from "../src/lib/chat/mentions.ts";

test("chat mentions are extracted as normalized unique tokens", () => {
  assert.deepEqual(extractMentionTokens("Big up @Reload and @DJ-Reload and @reload"), ["reload", "dj-reload"]);
});

test("chat mention splitting keeps plain text safe", () => {
  assert.deepEqual(splitTextMentions("hello @Reload <script>"), [
    { kind: "text", text: "hello " },
    { kind: "mention", normalized: "reload", text: "@Reload" },
    { kind: "text", text: " <script>" }
  ]);
});

test("mention helper ignores email-like tokens", () => {
  assert.deepEqual(extractMentionTokens("send to test@example.com and tag @Owner"), ["owner"]);
});

test("active mention query tracks the token before the caret", () => {
  assert.equal(getActiveMentionQuery("hello @Re", 9), "Re");
  assert.equal(getActiveMentionQuery("hello @Re now", 13), null);
});

test("active mention replacement preserves spacing and normalizes display names", () => {
  assert.equal(mentionTokenFromDisplayName("DJ Reload!"), "DJReload");

  const result = replaceActiveMention("hello @Re", 9, "DJ Reload!");

  assert.equal(result.text, "hello @DJReload ");
  assert.equal(result.caretIndex, result.text.length);
});
