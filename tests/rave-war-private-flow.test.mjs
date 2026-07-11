import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  assert.match(streamRoute, /player\.x/);
  assert.match(streamRoute, /player\.movementLeft/);
  assert.match(streamRoute, /war\.state\.craters/);
  assert.match(actionRoute, /getCurrentUser/);
  assert.match(actionRoute, /fireRaveWarShot\(warId, user\.id/);
  assert.match(actionRoute, /moveRaveWarPlayer\(warId, user\.id/);
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

test("chat message action menu exposes compact rave war and throw buttons for online authors", () => {
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(panel, /const messageActionButtonClass =/);
  assert.match(panel, /canStartRaveWarAtMessageAuthor/);
  assert.match(panel, /onlinePresenceUserIds\.has\(message\.authorUserId\)/);
  assert.match(panel, /name="targetUserId" type="hidden" value=\{message\.authorUserId \?\? ""\}/);
  assert.match(panel, /className=\{messageActionButtonClass\}/);
});

test("rave war battlefield supports mouse aiming animated shots and sfx only", () => {
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");

  assert.match(game, /aimSettingsFromLevelPoint/);
  assert.match(game, /onPointerDown=\{handleBattlefieldPointerDown\}/);
  assert.match(game, /onPointerMove=\{handleBattlefieldPointerMove\}/);
  assert.match(game, /requestAnimationFrame\(tick\)/);
  assert.match(game, /setAnimatedShot/);
  assert.match(game, /playRaveWarSfx/);
  assert.match(game, /AudioContext/);
  assert.doesNotMatch(game, /new Audio\(/);
  assert.doesNotMatch(game, /loop/);
});

test("rave war shots carve authoritative terrain craters and render imported game assets", () => {
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const types = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-types.ts"), "utf8");

  assert.match(types, /export type RaveWarTerrainCrater/);
  assert.match(types, /export const raveWarWeaponIds/);
  assert.match(types, /craters: RaveWarTerrainCrater\[\]/);
  assert.match(types, /blastRadius: number/);
  assert.match(types, /turnEndsAt: string \| null/);
  assert.match(service, /appendTerrainCrater/);
  assert.match(service, /terrainSurfaceY\(level, craters/);
  assert.match(service, /moveRaveWarPlayer/);
  assert.match(service, /raveWarWeaponConfigs/);
  assert.match(service, /settlePlayersOnTerrain/);
  assert.match(service, /craters: nextCraters/);
  assert.match(game, /mask id=\{terrainMaskId\}/);
  assert.match(game, /war\.state\.craters\.map/);
  assert.match(game, /onKeyDown=\{handleBattlefieldKeyDown\}/);
  assert.match(game, /bc-rave-war-hog-frame/);
  assert.match(game, /moveCurrentPlayer/);
  assert.match(game, /selectedWeapon/);
  assert.match(game, /raveWarAssets\.shell/);
  assert.match(game, /raveWarAssets\.explosion/);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/hedgehog.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/hedgehog-idle.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/bazooka-shell.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/big-explosion.png")), true);
});

test("rave war prompts auto open accepted wars and leave an active reopen button", () => {
  const overlay = readFileSync(join(process.cwd(), "src/components/rave-wars/rave-war-challenge-overlay.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(service, /in: \["pending", "active"\]/);
  assert.match(overlay, /rave-war-opened:/);
  assert.match(overlay, /window\.location\.assign\(`\/rave-wars\/\$\{activeChallenge\.id\}`\)/);
  assert.match(overlay, /Open Battle/);
});

test("ci workflow uses node24-compatible official actions", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /node-version: 24/);
});
