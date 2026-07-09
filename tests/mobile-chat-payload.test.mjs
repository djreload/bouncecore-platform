import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("mobile chat payload exposes presence hit counts and sheep readiness", () => {
  const content = readFileSync(join(process.cwd(), "src/lib/mobile/public-api.ts"), "utf8");

  assert.match(content, /presenceUsers:\s*data\.presenceUsers\.map\(publicPresenceUser\)/);
  assert.match(content, /throwHitCount:\s*user\.throwHitCount/);
  assert.match(content, /sheepThrow:\s*publicSheepThrow\(sheepSettings, sheepReadiness\)/);
  assert.match(content, /getAvailableSheepThrowSprites\(settings\)/);
  assert.match(content, /getChatSheepThrowReadiness\(currentUserId, sheepSettings\)/);
});

test("mobile chat API can send direct sheep throws by target user id", () => {
  const content = readFileSync(join(process.cwd(), "src/app/api/mobile/v1/chat/route.ts"), "utf8");

  assert.match(content, /intent === "sheep"/);
  assert.match(content, /createChatSheepThrow\(/);
  assert.match(content, /bodyString\(payload, "targetUserId"\)/);
  assert.match(content, /intent must be text, gif, stars, or sheep\./);
});

test("mobile chat GET personalizes payload when a request user is present", () => {
  const content = readFileSync(join(process.cwd(), "src/app/api/mobile/v1/chat/route.ts"), "utf8");

  assert.match(content, /getCurrentUserFromRequest\(\)/);
  assert.match(content, /getMobileChatPayload\(firstParam\(url\.searchParams\.get\("room"\)\), user\?\.id\)/);
});
