import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canEditChatMessage,
  normalizeEditableChatMessageBody
} from "../src/lib/chat/chat-message-edit-core.ts";

test("chat message edit permissions only allow the author to edit live text messages", () => {
  assert.equal(
    canEditChatMessage({
      authorUserId: "user-1",
      currentUserId: "user-1",
      deletedAt: null,
      kind: "text"
    }),
    true
  );
  assert.equal(
    canEditChatMessage({
      authorUserId: "user-1",
      currentUserId: "user-2",
      deletedAt: null,
      kind: "text"
    }),
    false
  );
  assert.equal(
    canEditChatMessage({
      authorUserId: "user-1",
      currentUserId: "user-1",
      deletedAt: null,
      kind: "gif"
    }),
    false
  );
  assert.equal(
    canEditChatMessage({
      authorUserId: "user-1",
      currentUserId: "user-1",
      deletedAt: "2026-07-02T10:00:00.000Z",
      kind: "text"
    }),
    false
  );
});

test("chat message edit body normalization matches send limits", () => {
  assert.equal(normalizeEditableChatMessageBody("  hello\r\nworld  "), "hello\nworld");
  assert.throws(() => normalizeEditableChatMessageBody("   "), /between 1 and 500 characters/);
  assert.throws(() => normalizeEditableChatMessageBody("x".repeat(501)), /between 1 and 500 characters/);
});

test("chat edit action is server validated and streamed to clients", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/chat/chat-service.ts"), "utf8");
  const actions = readFileSync(join(process.cwd(), "src/app/chat/actions.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const stream = readFileSync(join(process.cwd(), "src/app/api/chat/rooms/[roomId]/stream/route.ts"), "utf8");

  assert.match(service, /export async function editOwnChatMessage/);
  assert.match(service, /canEditChatMessage/);
  assert.match(service, /editedAt: new Date\(\)/);
  assert.match(actions, /intent === "edit-message"/);
  assert.match(panel, /value="edit-message"/);
  assert.match(panel, /\(edited\)/);
  assert.match(stream, /message\.editedAt/);
});
