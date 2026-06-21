import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultSheepThrowSettings,
  normalizeSheepThrowSettings,
  normalizeSheepThrowSettingsInput,
  remainingSheepThrowCooldownSeconds
} from "../src/lib/chat/sheep-throw-settings.ts";

test("sheep throw settings default to enabled with a five minute cooldown", () => {
  assert.deepEqual(normalizeSheepThrowSettings(null), defaultSheepThrowSettings);
  assert.equal(defaultSheepThrowSettings.enabled, true);
  assert.equal(defaultSheepThrowSettings.cooldownSeconds, 300);
  assert.equal(defaultSheepThrowSettings.costStars, 10);
});

test("sheep throw settings input converts admin minutes to seconds", () => {
  assert.deepEqual(normalizeSheepThrowSettingsInput({ enabled: false, cooldownMinutes: "2.5", costStars: "25" }), {
    ...defaultSheepThrowSettings,
    enabled: false,
    cooldownSeconds: 150,
    costStars: 25
  });
});

test("sheep throw settings reject impossible cooldown values", () => {
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "-1", costStars: "10" }), /between 0 and 1440/);
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "1441", costStars: "10" }), /between 0 and 1440/);
});

test("sheep throw settings reject impossible star costs", () => {
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "-1" }), /whole number/);
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "1.5" }), /whole number/);
});

test("sheep throw cooldown returns remaining seconds", () => {
  const now = new Date("2026-06-21T12:00:00.000Z");
  const latestThrow = new Date("2026-06-21T11:56:20.000Z");

  assert.equal(remainingSheepThrowCooldownSeconds(latestThrow, 300, now), 80);
  assert.equal(remainingSheepThrowCooldownSeconds(latestThrow, 180, now), 0);
  assert.equal(remainingSheepThrowCooldownSeconds(null, 300, now), 0);
});
