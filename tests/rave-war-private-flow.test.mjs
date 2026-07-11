import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("rave war records are participant scoped before summaries are returned", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(service, /participants:\s*{\s*some:\s*{\s*userId/s);
  assert.match(service, /getWarForUserRecord\(warId, userId\)/);
  assert.match(service, /throw new Error\("Rave War not found\."\)/);
});

test("rave war stream and action routes require the current signed-in participant", () => {
  const streamRoute = readFileSync(join(process.cwd(), "src/app/api/rave-wars/[warId]/stream/route.ts"), "utf8");
  const actionRoute = readFileSync(join(process.cwd(), "src/app/api/rave-wars/[warId]/actions/route.ts"), "utf8");

  assert.match(streamRoute, /getCurrentUser/);
  assert.match(streamRoute, /getRaveWarForUser\(warId, currentUserId\)/);
  assert.match(actionRoute, /getCurrentUser/);
  assert.match(actionRoute, /fireRaveWarShot\(warId, user\.id/);
  assert.match(actionRoute, /surrenderRaveWar\(warId, user\.id\)/);
});

test("chat presence rail can start rave wars only against online users", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(panel, /name="intent" type="hidden" value="rave-war"/);
  assert.match(panel, /raveWarDisabled = pending \|\| roomLockedForUser \|\| user\.status !== "online"/);
  assert.match(service, /chatPresenceOnlineMs/);
  assert.match(service, /Rave Wars can only target users who are online and active right now\./);
});
