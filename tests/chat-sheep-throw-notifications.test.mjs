import assert from "node:assert/strict";
import test from "node:test";
import {
  chatSheepThrowActionUrl,
  chatSheepThrowDedupeKey,
  chatSheepThrowNotificationContent,
  chatSheepThrowNotificationType
} from "../src/lib/chat/sheep-throw-notifications-core.ts";

test("sheep throw notifications include a jump-to-chat action", () => {
  assert.equal(
    chatSheepThrowActionUrl({
      messageId: "msg 1",
      roomSlug: "live room"
    }),
    "/chat?room=live%20room#chat-message-msg%201"
  );
});

test("sheep throw notification dedupe is scoped to throw and target user", () => {
  assert.equal(
    chatSheepThrowDedupeKey({
      sheepThrowId: "throw-123",
      userId: "user-456"
    }),
    `${chatSheepThrowNotificationType}:throw-123:user:user-456`
  );
});

test("sheep throw notification content is compact and chat categorized", () => {
  const content = chatSheepThrowNotificationContent({
    roomSlug: "live",
    throwerDisplayName: "Reload"
  });

  assert.equal(content.type, "chat.sheep_throw");
  assert.equal(content.title, "Reload threw a sheep at you 😂");
  assert.equal(content.body, "Open #live to jump back into the chat.");
});
