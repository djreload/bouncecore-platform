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

test("sheep throws validate the target before star wallet deduction starts", () => {
  const content = readFileSync(join(process.cwd(), "src/lib/chat/sheep-throw-service.ts"), "utf8");
  const targetIndex = content.indexOf("const target = await resolveTarget(roomId, throwerId, targetMessageId);");
  const transactionIndex = content.indexOf("const result = await prisma.$transaction");
  const walletIndex = content.indexOf("tx.starWallet.upsert");

  assert.notEqual(targetIndex, -1);
  assert.notEqual(transactionIndex, -1);
  assert.notEqual(walletIndex, -1);
  assert.ok(targetIndex < transactionIndex);
  assert.ok(transactionIndex < walletIndex);
});

test("chat UI only shows sheep action for online message authors", () => {
  const content = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(content, /onlinePresenceUserIds/);
  assert.match(content, /onlinePresenceUserIds\.has\(message\.authorUserId\)/);
});

test("supporters get one free sheep throw per active livestream before wallet deduction", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/chat/sheep-throw-service.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(service, /freeThrowAvailable/);
  assert.match(service, /createdAt:\s*{\s*gte: activeStreamSession\.startedAt/s);
  assert.match(service, /const freeThrowApplied = Boolean\(activeStreamSession && priorStreamThrowCount === 0\)/);
  assert.match(service, /const costStars = freeThrowApplied \? 0 : settings\.costStars/);
  assert.match(panel, /Free live throw/);
  assert.match(panel, /setLocalSheepFreeThrowAvailable\(false\)/);
});
