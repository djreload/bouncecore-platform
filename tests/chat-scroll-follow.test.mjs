import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  chatDistanceFromBottom,
  countNewChatMessageIds,
  shouldFollowLatestChatMessage
} from "../src/lib/chat/chat-scroll-core.ts";

test("chat follows new messages only while the reader remains near the bottom", () => {
  assert.equal(shouldFollowLatestChatMessage({ clientHeight: 400, scrollHeight: 1_000, scrollTop: 600 }), true);
  assert.equal(shouldFollowLatestChatMessage({ clientHeight: 400, scrollHeight: 1_000, scrollTop: 520 }), true);
  assert.equal(shouldFollowLatestChatMessage({ clientHeight: 400, scrollHeight: 1_000, scrollTop: 503 }), false);
  assert.equal(chatDistanceFromBottom({ clientHeight: 400, scrollHeight: 300, scrollTop: 0 }), 0);
});

test("chat counts only genuinely new message ids", () => {
  const knownIds = new Set(["message-1", "message-2"]);

  assert.equal(countNewChatMessageIds(knownIds, ["message-1", "message-2"]), 0);
  assert.equal(countNewChatMessageIds(knownIds, ["message-1", "message-2", "message-3"]), 1);
  assert.equal(countNewChatMessageIds(knownIds, ["message-2", "message-3", "message-4"]), 2);
});

test("chat message list preserves history reading and offers an explicit jump to latest", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(panel, /followLatestMessagesRef/);
  assert.match(panel, /onScroll=\{handleMessagesScroll\}/);
  assert.match(panel, /countNewChatMessageIds\(knownMessageIdsRef\.current, messageIds\)/);
  assert.match(panel, /setUnseenMessageCount\(\(count\) => count \+ newMessageCount\)/);
  assert.match(panel, /onClick=\{jumpToLatestMessages\}/);
  assert.match(panel, /new \{unseenMessageCount === 1 \? "message" : "messages"\}/);
  assert.doesNotMatch(panel, /onLoad=\{scrollToLatestMessage\}/);
});
