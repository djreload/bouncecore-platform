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
import {
  formatRaveWarChallengeCost,
  formatRaveWarRuleDuration
} from "../src/lib/rave-wars/rave-war-challenge-terms.ts";

test("rave war settings default to enabled with free five minute challenges", () => {
  assert.equal(defaultRaveWarSettings.enabled, true);
  assert.equal(defaultRaveWarSettings.challengeTtlSeconds, 300);
  assert.equal(defaultRaveWarSettings.cooldownSeconds, 300);
  assert.equal(defaultRaveWarSettings.costStars, 0);
  assert.equal(defaultRaveWarSettings.matchDurationSeconds, 600);
  assert.equal(defaultRaveWarSettings.turnDurationSeconds, 90);
  assert.deepEqual(normalizeRaveWarSettings(null), defaultRaveWarSettings);
});

test("rave war settings input normalizes admin form values", () => {
  assert.deepEqual(
    normalizeRaveWarSettingsInput({
      enabled: false,
      challengeTtlMinutes: "7.5",
      cooldownMinutes: "2.5",
      costStars: "25",
      matchDurationMinutes: "12.5",
      turnDurationSeconds: "75"
    }),
    {
      enabled: false,
      challengeTtlSeconds: 450,
      cooldownSeconds: 150,
      costStars: 25,
      matchDurationSeconds: 750,
      turnDurationSeconds: 75
    }
  );

  const contradictorySavedTimers = normalizeRaveWarSettings({
    ...defaultRaveWarSettings,
    matchDurationSeconds: 120,
    turnDurationSeconds: 300
  });

  assert.equal(contradictorySavedTimers.matchDurationSeconds, defaultRaveWarSettings.matchDurationSeconds);
  assert.equal(contradictorySavedTimers.turnDurationSeconds, defaultRaveWarSettings.turnDurationSeconds);
});

test("rave war settings reject impossible admin values", () => {
  assert.throws(
    () =>
      normalizeRaveWarSettingsInput({
        enabled: true,
        challengeTtlMinutes: "0.5",
        cooldownMinutes: "5",
        costStars: "0",
        matchDurationMinutes: "10",
        turnDurationSeconds: "90"
      }),
    /challenge expiry/
  );
  assert.throws(
    () =>
      normalizeRaveWarSettingsInput({
        enabled: true,
        challengeTtlMinutes: "5",
        cooldownMinutes: "-1",
        costStars: "0",
        matchDurationMinutes: "10",
        turnDurationSeconds: "90"
      }),
    /cooldown/
  );
  assert.throws(
    () =>
      normalizeRaveWarSettingsInput({
        enabled: true,
        challengeTtlMinutes: "5",
        cooldownMinutes: "5",
        costStars: "1.5",
        matchDurationMinutes: "10",
        turnDurationSeconds: "90"
      }),
    /whole number/
  );
  assert.throws(
    () =>
      normalizeRaveWarSettingsInput({
        enabled: true,
        challengeTtlMinutes: "5",
        cooldownMinutes: "5",
        costStars: "0",
        matchDurationMinutes: "2",
        turnDurationSeconds: "180"
      }),
    /longer than the turn duration/
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

test("rave war challenge terms use compact, honest labels", () => {
  assert.equal(formatRaveWarRuleDuration(45), "45s");
  assert.equal(formatRaveWarRuleDuration(90), "1m 30s");
  assert.equal(formatRaveWarRuleDuration(600), "10m");
  assert.equal(formatRaveWarChallengeCost(0), "Free");
  assert.equal(formatRaveWarChallengeCost(10), "10 stars");
  assert.equal(formatRaveWarChallengeCost(null), "Legacy");
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
  assert.match(adminPanel, /name="matchDurationMinutes"/);
  assert.match(adminPanel, /name="turnDurationSeconds"/);
  assert.match(adminPanel, /Save Rave War/);
  assert.match(chatPanel, /raveWarDisabledReason/);
  assert.match(chatPanel, /formatRaveWarCooldownLabel/);
});

test("new challenges snapshot timer settings for their full lifecycle", () => {
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const adminService = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-admin-service.ts"), "utf8");

  assert.match(service, /matchDurationSeconds: settings\.matchDurationSeconds/);
  assert.match(service, /challengeCostStars: settings\.costStars/);
  assert.match(service, /turnDurationSeconds: settings\.turnDurationSeconds/);
  assert.match(service, /matchWindow\(now, state\.matchDurationSeconds\)/);
  assert.match(service, /turnWindow\(now, state\.turnDurationSeconds\)/);
  assert.match(service, /turnWindow\(new Date\(firedAt\), state\.turnDurationSeconds\)/);
  assert.match(adminService, /state\.matchDurationSeconds \* 1000/);
  assert.match(adminService, /state\.turnDurationSeconds \* 1000/);
});
