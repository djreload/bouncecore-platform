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
  assert.match(game, /stopBattlefieldControlEvent/);
  assert.match(game, /onPointerDown=\{stopBattlefieldControlEvent\}/);
  assert.doesNotMatch(game, /bc-rave-war-mobile-controls/);
  assert.match(game, /bc-rave-war-shell fixed inset-0 z-\[80\] flex h-dvh w-dvw max-w-none/);
  assert.match(game, /bc-rave-war-battlefield relative aspect-\[2\/1\] w-full max-w-full/);
  assert.doesNotMatch(game, /lg:static/);
  assert.doesNotMatch(game, /bc-rave-war-battlefield[^\n]+h-full/);
  assert.match(game, /formatCountdown\(remainingWarSeconds\)/);
  assert.match(css, /bc-rave-war-active/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /bc-rave-war-rotate-prompt/);
  assert.match(css, /html\.bc-rave-war-active,\s*html\.bc-rave-war-active body\s*{\s*height: 100%;\s*overflow: hidden;/s);
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
  assert.match(types, /"bass-bomb"/);
  assert.match(types, /"glow-grenade"/);
  assert.match(types, /"sheep-launcher"/);
  assert.match(types, /"homing-bee"/);
  assert.match(types, /"tnt-barrel"/);
  assert.match(types, /"stink-sock"/);
  assert.match(types, /weaponAmmo: RaveWarWeaponAmmo/);
  assert.match(types, /craters: RaveWarTerrainCrater\[\]/);
  assert.match(types, /blastRadius: number/);
  assert.match(types, /turnEndsAt: string \| null/);
  assert.match(service, /appendTerrainCrater/);
  assert.match(engine, /terrainSurfaceY\(level, craters/);
  assert.match(service, /moveRaveWarPlayer/);
  assert.match(engine, /raveWarWeaponConfigs/);
  assert.match(engine, /"bass-bomb":/);
  assert.match(engine, /"tnt-barrel":/);
  assert.match(engine, /"homing-bee":/);
  assert.match(engine, /homingTurnRate/);
  assert.match(service, /settlePlayersOnTerrain/);
  assert.match(service, /craters: nextCraters/);
  assert.match(service, /weaponAmmo: nextShooterWeaponAmmo/);
  assert.match(game, /mask id=\{terrainMaskId\}/);
  assert.match(game, /war\.state\.craters\.map/);
  assert.match(game, /window\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(game, /startMoveHold/);
  assert.match(game, /startAimHold/);
  assert.match(game, /bc-rave-war-worm-body/);
  assert.match(game, /bc-rave-war-worm-weapon/);
  assert.match(game, /bc-rave-war-character-anchor absolute bottom-0/);
  assert.match(game, /bc-rave-war-player-name/);
  assert.match(game, /rave-worm-pink\.png/);
  assert.match(game, /rave-worm-lime\.png/);
  assert.match(game, /playerIndex=\{player\.playerIndex\}/);
  assert.match(game, /showWeapon=\{war\.status === "active"\}/);
  assert.match(game, /walkingPlayerIds/);
  assert.match(game, /markPlayerWalking/);
  assert.match(game, /moveCurrentPlayer/);
  assert.doesNotMatch(game, /closest\("input, textarea, select, button/);
  assert.match(game, /selectedWeapon/);
  assert.match(game, /simulateRaveWarShot/);
  assert.match(game, /startShotAnimation/);
  assert.match(game, /visibleShotWeapon\.projectileUrl/);
  assert.match(game, /visibleProjectileSize/);
  assert.match(css, /\.bc-rave-war-worm-shell\s*{\s*position: relative;\s*display: block;\s*width: 78px;/s);
  assert.match(css, /\.bc-rave-war-worm-body\s*{[^}]*width: 78px;[^}]*object-fit: contain;/s);
  assert.match(css, /\.bc-rave-war-player-name\s*{\s*bottom: calc\(100% \+ 1rem\);/s);
  assert.match(css, /@keyframes bc-rave-war-worm-wriggle/);
  assert.match(game, /raveWarAssets\.explosion/);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/rave-worm-pink.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/rave-worm-lime.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/bazooka-shell.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/big-explosion.png")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-bass-bomb.svg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-glow-grenade.svg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-sheep-launcher.svg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-homing-bee.svg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-tnt-barrel.svg")), true);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/assets/weapon-stink-sock.svg")), true);
});

test("homing bee costs ten stars and battlefield camera supports full-map zoom", () => {
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const weapons = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-weapons.ts"), "utf8");
  const level = readFileSync(join(process.cwd(), "src/lib/rave-wars/levels/bazooka-battlefield.ts"), "utf8");
  const android = readFileSync(join(process.cwd(), "android-webview/app/src/main/java/uk/co/bouncecore/app/MainActivity.java"), "utf8");

  assert.match(weapons, /id: "homing-bee"[\s\S]*starCost: 10/);
  assert.match(service, /const weaponStarCost = raveWarWeaponStarCost\(weaponId\)/);
  assert.match(service, /balance:\s*{\s*gte: weaponStarCost/s);
  assert.match(service, /decrement: weaponStarCost/);
  assert.match(service, /updatedAt: war\.updatedAt/);
  assert.match(game, /const cameraFitZoom = 1\.02/);
  assert.match(game, /handleBattlefieldWheel/);
  assert.match(game, /bc-rave-war-world/);
  assert.match(game, /className="bc-rave-war-world-svg[^\"]*overflow-visible"/);
  assert.match(game, /overflow="visible"/);
  assert.match(game, /wind: currentWar\.state\.wind/);
  assert.match(level, /rave-arena-background\.png/);
  assert.match(android, /"Z-", "Zoom out", "zoom-out"/);
  assert.match(android, /"Z\+", "Zoom in", "zoom-in"/);
  assert.equal(existsSync(join(process.cwd(), "public/rave-wars/maps/bazooka-battlefield/rave-arena-background.png")), true);
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

test("rave war challenges queue preference-aware mobile push notifications", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  assert.match(service, /getNotificationDeliveryPreferencesForUser\(target\.id, "chat\.rave_war\.challenge"\)/);
  assert.match(service, /queueMobilePushForNotification\(\{/);
  assert.match(service, /notificationId: result\.notification\.id/);
  assert.match(service, /reason: "Push disabled by notification preferences\."/);
  assert.match(service, /action: "chat\.rave_war\.challenge\.notification\.queue"/);
  assert.match(service, /type: "chat\.rave_war\.challenge"/);
});

test("rave war active challenges auto-open once and finished wars return to live", () => {
  const overlay = readFileSync(join(process.cwd(), "src/components/rave-wars/rave-war-challenge-overlay.tsx"), "utf8");
  const game = readFileSync(join(process.cwd(), "src/app/rave-wars/[warId]/rave-war-game.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(overlay, /const pollMs = 2500/);
  assert.match(overlay, /activeChallenge = challenges\.find\(\(challenge\) => challenge\.status === "active"\)/);
  assert.match(overlay, /window\.sessionStorage\.getItem\(`rave-war-opened:\$\{activeChallenge\.id\}`\)/);
  assert.match(overlay, /navigateToWar\(activeChallenge\.id\)/);
  assert.match(game, /const liveReturnDelayMs = 4500/);
  assert.match(game, /terminalRaveWarStatuses/);
  assert.match(game, /window\.location\.assign\("\/live"\)/);
  assert.match(game, /turnAnnouncement/);
  assert.match(game, /bc-rave-war-announcement/);
  assert.match(game, /bc-rave-war-titleplate/);
  assert.doesNotMatch(game, /rave-war-crater-rim-gradient/);
  assert.doesNotMatch(game, /war\.state\.lastShot && !animatedShot/);
  assert.match(css, /bc-rave-war-player-card/);
  assert.match(css, /bc-rave-war-weapon-dock/);
  assert.match(game, /setRaveWarControlState/);
  assert.match(game, /canControl && !busy/);
});

test("rave war timers and chat toasts use enforced match state", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const types = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-types.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(service, /const raveWarMatchSeconds = 10 \* 60/);
  assert.match(service, /const raveWarTurnSeconds = 90/);
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
