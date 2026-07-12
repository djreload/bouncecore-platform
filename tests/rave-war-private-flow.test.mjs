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
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(game, /aimSettingsFromLevelPoint/);
  assert.match(game, /onPointerDown=\{handleBattlefieldPointerDown\}/);
  assert.match(game, /onPointerMove=\{handleBattlefieldPointerMove\}/);
  assert.match(game, /screen\.orientation/);
  assert.match(game, /bouncecore:rave-war-native-control/);
  assert.match(game, /startChargingShot/);
  assert.match(game, /stopChargingShot\(true\)/);
  assert.doesNotMatch(game, /bc-rave-war-mobile-controls/);
  assert.match(game, /bc-rave-war-battlefield relative mx-auto aspect-\[2\/1\] w-full max-w-full/);
  assert.doesNotMatch(game, /bc-rave-war-battlefield[^\n]+h-full/);
  assert.match(game, /formatCountdown\(remainingWarSeconds\)/);
  assert.match(css, /bc-rave-war-active/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /bc-rave-war-rotate-prompt/);
  assert.match(css, /width: min\(100%, calc\(\(100dvh - 4rem\) \* 2\)\)/);
  assert.match(css, /html\[data-bc-android-webview="true"\]\.bc-rave-war-active \.bc-rave-war-battlefield/);
  assert.match(css, /bc-rave-war-sidebar\s*{\s*display: none;/);
  assert.match(game, /requestAnimationFrame\(tick\)/);
  assert.match(game, /setAnimatedShot/);
  assert.match(game, /playRaveWarSfx/);
  assert.match(game, /AudioContext/);
  assert.doesNotMatch(game, /new Audio\(/);
  assert.doesNotMatch(game, /loop/);
});

test("rave war shots carve authoritative terrain craters and render imported game assets", () => {
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const engine = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-engine.ts"), "utf8");
  const types = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-types.ts"), "utf8");

  assert.match(types, /export type RaveWarTerrainCrater/);
  assert.match(types, /export const raveWarWeaponIds/);
  assert.match(types, /craters: RaveWarTerrainCrater\[\]/);
  assert.match(types, /blastRadius: number/);
  assert.match(types, /turnEndsAt: string \| null/);
  assert.match(service, /appendTerrainCrater/);
  assert.match(engine, /terrainSurfaceY\(level, craters/);
  assert.match(service, /moveRaveWarPlayer/);
  assert.match(engine, /raveWarWeaponConfigs/);
  assert.match(service, /settlePlayersOnTerrain/);
  assert.match(service, /craters: nextCraters/);
  assert.match(game, /mask id=\{terrainMaskId\}/);
  assert.match(game, /war\.state\.craters\.map/);
  assert.match(game, /window\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(game, /startMoveHold/);
  assert.match(game, /startAimHold/);
  assert.match(game, /bc-rave-war-hog-frame/);
  assert.match(game, /bc-rave-war-hog-weapon/);
  assert.match(game, /walkingPlayerIds/);
  assert.match(game, /markPlayerWalking/);
  assert.match(game, /moveCurrentPlayer/);
  assert.match(game, /selectedWeapon/);
  assert.match(css, /\.bc-rave-war-hog-shell\s*{\s*position: relative;\s*display: block;\s*width: 32px;/s);
  assert.match(css, /\.bc-rave-war-hog-frame\s*{[^}]*width: 32px;[^}]*background-size: 64px 512px;/s);
  assert.match(game, /raveWarAssets\.shell/);
  assert.match(game, /raveWarAssets\.explosion/);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/hedgehog.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/hedgehog-idle.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/bazooka-shell.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/big-explosion.png")), true);
});

test("rave war prompts live in header and mobile menu instead of covering chat", () => {
  const overlay = readFileSync(join(process.cwd(), "src/components/rave-wars/rave-war-challenge-overlay.tsx"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src/components/layout/public-shell.tsx"), "utf8");
  const mobileMenu = readFileSync(join(process.cwd(), "src/components/navigation/public-mobile-menu.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(service, /in: \["pending", "active"\]/);
  assert.match(overlay, /RaveWarChallengeLauncher/);
  assert.doesNotMatch(overlay, /fixed bottom-4 right-4/);
  assert.match(shell, /<RaveWarChallengeOverlay \/>/);
  assert.match(mobileMenu, /placement="mobile-menu"/);
  assert.match(overlay, /Open Battle/);
});

test("rave war timers and chat toasts use enforced match state", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const types = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-types.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(service, /const raveWarMatchSeconds = 5 \* 60/);
  assert.match(service, /const raveWarTurnSeconds = 60/);
  assert.match(service, /finishExpiredActiveRaveWarIfNeeded/);
  assert.match(service, /advanceExpiredTurnIfNeeded/);
  assert.match(service, /kind: "rave-war"/);
  assert.match(types, /warEndsAt: string \| null/);
  assert.match(panel, /message\.kind === "sheep" \|\| message\.kind === "rave-war"/);
});

test("ci workflow uses node24-compatible official actions", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /node-version: 24/);
});
