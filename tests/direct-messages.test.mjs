import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  directConversationPair,
  directMessageActionUrl,
  directMessageMaxLength,
  directMessageNotificationContent,
  normalizeDirectMessageBody
} from "../src/lib/messages/direct-message-core.ts";

test("direct conversation pairs are stable and reject self messaging", () => {
  assert.deepEqual(directConversationPair("user-b", "user-a"), {
    pairKey: "user-a:user-b",
    userOneId: "user-a",
    userTwoId: "user-b"
  });
  assert.throws(() => directConversationPair("same", "same"), /another active user/);
});

test("direct message content is bounded and creates private notification links", () => {
  assert.equal(normalizeDirectMessageBody(" hello\r\nthere "), "hello\nthere");
  assert.throws(() => normalizeDirectMessageBody("x".repeat(directMessageMaxLength + 1)), /2,000 characters/);
  assert.equal(directMessageActionUrl("conversation/1", "message 2"), "/account/messages?conversation=conversation%2F1#direct-message-message%202");
  assert.deepEqual(directMessageNotificationContent({ body: "", kind: "attachment-file", senderDisplayName: "Reload" }), {
    body: "Sent you a ZIP file.",
    title: "Reload sent you a private message",
    type: "chat.direct_message"
  });
});

test("private messaging schema cascades account deletion and keeps participants explicit", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

  assert.match(schema, /model DirectConversation/);
  assert.match(schema, /pairKey\s+String\s+@unique/);
  assert.match(schema, /DirectConversationUserOne[\s\S]*onDelete: Cascade/);
  assert.match(schema, /DirectConversationUserTwo[\s\S]*onDelete: Cascade/);
  assert.match(schema, /model DirectMessage[\s\S]*conversation[\s\S]*onDelete: Cascade/);
});

test("direct message routes authorize participants and private attachment downloads", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/messages/direct-message-service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/direct-messages/route.ts"), "utf8");
  const uploads = readFileSync(join(process.cwd(), "src/app/uploads/[...path]/route.ts"), "utf8");
  const cleanup = readFileSync(join(process.cwd(), "src/lib/media/upload-cleanup-service.ts"), "utf8");

  assert.match(service, /OR: \[\{ userOneId: userId \}, \{ userTwoId: userId \}\]/);
  assert.match(service, /directMessageSendIntervalMs/);
  assert.match(service, /readAt && readAt >= conversation\.lastMessageAt/);
  assert.match(api, /getCurrentUser\(\)/);
  assert.match(api, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(uploads, /mediaSource: "direct_message_attachment"/);
  assert.match(uploads, /OR: \[\{ userOneId: user\.id \}, \{ userTwoId: user\.id \}\]/);
  assert.match(cleanup, /prisma\.directMessage\.count\(\{ where: \{ mediaUrl: uploadPath \} \}\)/);
  assert.match(cleanup, /source: "Private message media"/);
});

test("account messages provides polling unread counts and private file controls", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/account/messages/direct-messages-panel.tsx"), "utf8");
  const navigation = readFileSync(join(process.cwd(), "src/config/navigation.ts"), "utf8");
  const smoke = readFileSync(join(process.cwd(), "scripts/authenticated-smoke-check.mjs"), "utf8");

  assert.match(navigation, /Private messages.*\/account\/messages/);
  assert.match(smoke, /Private message inbox[\s\S]*\/account\/messages/);
  assert.match(panel, /document\.visibilityState === "visible"/);
  assert.match(panel, /conversation\.unreadCount/);
  assert.match(panel, /\.jpg,\.jpeg,\.jfif,\.png,\.gif,\.webp,\.avif,\.bmp,\.zip/);
  assert.match(panel, /message\.kind === "attachment-image"/);
  assert.match(panel, /message\.kind === "attachment-file"/);
  const imageBranch = panel.slice(panel.indexOf('message.kind === "attachment-image"'), panel.indexOf('message.kind === "attachment-file"'));
  assert.doesNotMatch(imageBranch, /download/);
});

test("direct message notifications are durable and account deletion removes private files", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/messages/direct-message-service.ts"), "utf8");
  const deletion = readFileSync(join(process.cwd(), "src/lib/auth/user-deletion-service.ts"), "utf8");

  assert.match(service, /await queueDirectMessageNotification/);
  assert.doesNotMatch(service, /void queueDirectMessageNotification/);
  assert.match(deletion, /removedDirectMessageMedia/);
  assert.match(deletion, /conversation:[\s\S]*OR: \[\{ userOneId: user\.id \}, \{ userTwoId: user\.id \}\]/);
  assert.match(deletion, /removedDirectMessageMedia\.flatMap/);
});
