import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatMentionActionUrl,
  chatMentionDedupeKey,
  chatMentionNotificationContent,
  chatMentionNotificationType,
  userMatchesChatMention
} from "../src/lib/chat/mention-notifications-core.ts";

test("chat mention notification content creates a jump-to-chat action", () => {
  assert.equal(
    chatMentionActionUrl({
      messageId: "message 1",
      roomSlug: "live room"
    }),
    "/chat?room=live%20room#chat-message-message%201"
  );
  assert.equal(
    chatMentionDedupeKey({
      messageId: "message_1",
      userId: "user_1"
    }),
    `${chatMentionNotificationType}:message_1:user:user_1`
  );
  assert.deepEqual(
    chatMentionNotificationContent({
      authorDisplayName: "Reload",
      body: "Big up @DJReload in the live room",
      roomSlug: "live"
    }),
    {
      body: "Big up @DJReload in the live room",
      title: "Reload mentioned you in #live",
      type: chatMentionNotificationType
    }
  );
});

test("chat mention matching uses display names and profile slugs", () => {
  assert.equal(
    userMatchesChatMention(["reload"], {
      displayName: "Reload",
      profileSlug: "dj-reload"
    }),
    true
  );
  assert.equal(
    userMatchesChatMention(["dj-reload"], {
      displayName: "Reload",
      profileSlug: "dj-reload"
    }),
    true
  );
  assert.equal(
    userMatchesChatMention(["someone-else"], {
      displayName: "Reload",
      profileSlug: "dj-reload"
    }),
    false
  );
});
