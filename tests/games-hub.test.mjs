import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("the unified games hub exposes mobile-friendly games without the removed FPS integration", () => {
  const gamesPage = readFileSync(join(process.cwd(), "src/app/games/page.tsx"), "utf8");
  const navigation = readFileSync(join(process.cwd(), "src/config/navigation.ts"), "utf8");
  const chatPanel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");
  const compose = readFileSync(join(process.cwd(), "docker-compose.staging.yml"), "utf8");

  assert.match(gamesPage, /Play on Bouncecore/);
  assert.match(gamesPage, /Rave Wars/);
  assert.match(gamesPage, /Rewards Wheel/);
  assert.match(gamesPage, /8 Ball Pool/);
  assert.match(navigation, /label: "Games", href: "\/games"/);
  assert.doesNotMatch(chatPanel, /core-fps|Core FPS|Start Core/i);
  assert.doesNotMatch(compose, /core-fps|CORE_FPS/i);
  assert.equal(existsSync(join(process.cwd(), "src/app/games/core")), false);
  assert.equal(existsSync(join(process.cwd(), "src/app/admin/core-fps")), false);
  assert.equal(existsSync(join(process.cwd(), "services/core-fps")), false);
});
