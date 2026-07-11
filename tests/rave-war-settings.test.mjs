import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRaveWarSettings,
  formatRaveWarCooldownLabel,
  normalizeRaveWarSettings,
  normalizeRaveWarSettingsInput,
  remainingRaveWarCooldownSeconds
} from "../src/lib/rave-wars/rave-war-settings.ts";

test("rave war settings default to enabled with free five minute challenges", () => {
  assert.equal(defaultRaveWarSettings.enabled, true);
  assert.equal(defaultRaveWarSettings.challengeTtlSeconds, 300);
  assert.equal(defaultRaveWarSettings.cooldownSeconds, 300);
  assert.equal(defaultRaveWarSettings.costStars, 0);
  assert.deepEqual(normalizeRaveWarSettings(null), defaultRaveWarSettings);
});

test("rave war settings input normalizes admin form values", () => {
  assert.deepEqual(
    normalizeRaveWarSettingsInput({
      enabled: false,
      challengeTtlMinutes: "7.5",
      cooldownMinutes: "2.5",
      costStars: "25"
    }),
    {
      enabled: false,
      challengeTtlSeconds: 450,
      cooldownSeconds: 150,
      costStars: 25
    }
  );
});

test("rave war settings reject impossible admin values", () => {
  assert.throws(
    () => normalizeRaveWarSettingsInput({ enabled: true, challengeTtlMinutes: "0.5", cooldownMinutes: "5", costStars: "0" }),
    /challenge expiry/
  );
  assert.throws(
    () => normalizeRaveWarSettingsInput({ enabled: true, challengeTtlMinutes: "5", cooldownMinutes: "-1", costStars: "0" }),
    /cooldown/
  );
  assert.throws(
    () => normalizeRaveWarSettingsInput({ enabled: true, challengeTtlMinutes: "5", cooldownMinutes: "5", costStars: "1.5" }),
    /whole number/
  );
});

test("rave war cooldown returns remaining seconds and compact labels", () => {
  const now = new Date("2026-07-11T12:05:00.000Z");
  const latestChallenge = new Date("2026-07-11T12:02:40.000Z");

  assert.equal(remainingRaveWarCooldownSeconds(latestChallenge, 300, now), 160);
  assert.equal(remainingRaveWarCooldownSeconds(latestChallenge, 120, now), 0);
  assert.equal(formatRaveWarCooldownLabel(0), "Ready");
  assert.equal(formatRaveWarCooldownLabel(12), "12s");
  assert.equal(formatRaveWarCooldownLabel(75), "1m 15s");
});

test("rave war service enforces enabled flag cooldown and cost before creating", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const targetIndex = service.indexOf("resolveActiveChallengeTarget(challengerId, targetUserId)");
  const duplicateIndex = service.indexOf("A Rave War challenge is already pending.");
  const walletIndex = service.indexOf("tx.starWallet.upsert");
  const createIndex = service.indexOf("tx.raveWar.create");

  assert.match(service, /const raveWarSettingsKey = "chat\.rave_wars"/);
  assert.match(service, /throw new Error\("Rave Wars are currently disabled\."\)/);
  assert.match(service, /remainingRaveWarCooldownSeconds\(latestChallenge\?\.createdAt, settings\.cooldownSeconds\)/);
  assert.ok(targetIndex > -1 && duplicateIndex > targetIndex);
  assert.ok(walletIndex > duplicateIndex);
  assert.ok(createIndex > walletIndex);
});

test("admin chatrooms and chat rail expose rave war settings safely", () => {
  const adminPage = readFileSync(join(process.cwd(), "src/app/admin/chatrooms/page.tsx"), "utf8");
  const adminPanel = readFileSync(join(process.cwd(), "src/app/admin/chatrooms/chatrooms-panel.tsx"), "utf8");
  const chatPanel = readFileSync(join(process.cwd(), "src/app/chat/chat-room-panel.tsx"), "utf8");

  assert.match(adminPage, /getRaveWarSettings/);
  assert.match(adminPanel, /name="intent" type="hidden" value="rave-war-settings"/);
  assert.match(adminPanel, /Save Rave War/);
  assert.match(chatPanel, /raveWarDisabledReason/);
  assert.match(chatPanel, /formatRaveWarCooldownLabel/);
});
