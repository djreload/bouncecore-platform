import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("sheep throws require an active online target session on the server", () => {
  const content = readFileSync(join(process.cwd(), "src/lib/chat/sheep-throw-service.ts"), "utf8");

  assert.match(content, /chatPresenceOnlineMs/);
  assert.match(content, /prisma\.authSession\.findFirst/);
  assert.match(content, /updatedAt:\s*{\s*gte:\s*new Date\(Date\.now\(\) - chatPresenceOnlineMs\)/s);
  assert.match(content, /Sheep can only be thrown at users who are online and active right now\./);
});

test("chat UI only shows sheep action for online message authors", () => {
  const content = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(content, /onlinePresenceUserIds/);
  assert.match(content, /onlinePresenceUserIds\.has\(message\.authorUserId\)/);
});
