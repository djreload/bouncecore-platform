import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultSheepThrowSettings,
  formatSheepThrowCooldownLabel,
  formatSheepThrowToast,
  normalizeSheepThrowSettings,
  normalizeSheepThrowSettingsInput,
  remainingSheepThrowCooldownSeconds
} from "../src/lib/chat/sheep-throw-settings.ts";

test("sheep throw settings default to enabled with a five minute cooldown", () => {
  assert.deepEqual(normalizeSheepThrowSettings(null), defaultSheepThrowSettings);
  assert.equal(defaultSheepThrowSettings.enabled, true);
  assert.equal(defaultSheepThrowSettings.cooldownSeconds, 300);
  assert.equal(defaultSheepThrowSettings.costStars, 10);
  assert.equal(defaultSheepThrowSettings.sprites[0].id, "sheep");
});

test("sheep throw settings input converts admin minutes to seconds", () => {
  assert.deepEqual(
    normalizeSheepThrowSettingsInput({
      enabled: false,
      cooldownMinutes: "2.5",
      costStars: "25",
      overlayDurationSeconds: "5.5",
      pollSeconds: "1.5",
      maxRecentEvents: "24"
    }),
    {
      ...defaultSheepThrowSettings,
      enabled: false,
      cooldownSeconds: 150,
      costStars: 25,
      overlayDurationMs: 5500,
      pollMs: 1500,
      maxRecentEvents: 24
    }
  );
});

test("sheep throw settings keep sheep as fallback and accept uploaded custom sprites", () => {
  const settings = normalizeSheepThrowSettingsInput({
    enabled: true,
    cooldownMinutes: "5",
    costStars: "10",
    sprites: [
      {
        columns: "8",
        enabled: true,
        frameCount: "16",
        frameHeight: "256",
        frameWidth: "256",
        impactSoundUrl: "/uploads/throw-sounds/unicorn.wav",
        label: "Unicorn",
        rows: "2",
        spriteSheetUrl: "/uploads/throw-sprites/unicorn.png"
      }
    ]
  });

  assert.equal(settings.sprites.length, 2);
  assert.equal(settings.sprites[0].id, "sheep");
  assert.equal(settings.sprites[1].id, "unicorn");
  assert.equal(settings.sprites[1].frameCount, 16);
  assert.equal(settings.sprites[1].impactSoundUrl, "/uploads/throw-sounds/unicorn.wav");
  assert.equal(settings.sprites[1].rows, 2);
});

test("sheep throw settings preserve default sheep impact sound", () => {
  const settings = normalizeSheepThrowSettingsInput({
    enabled: true,
    cooldownMinutes: "5",
    costStars: "10",
    sprites: [
      {
        id: "sheep",
        impactSoundUrl: "/uploads/throw-sounds/sheep-splat.mp3",
        label: "Sheep",
        spriteSheetUrl: "/sheep-throw/SheepThrowSequence.png"
      }
    ]
  });

  assert.equal(settings.sprites[0].id, "sheep");
  assert.equal(settings.sprites[0].impactSoundUrl, "/uploads/throw-sounds/sheep-splat.mp3");
});

test("sheep throw settings validate optional impact sounds", () => {
  assert.throws(
    () =>
      normalizeSheepThrowSettingsInput({
        enabled: true,
        cooldownMinutes: "5",
        costStars: "10",
        sprites: [
          {
            impactSoundUrl: "/uploads/throw-sprites/not-a-sound.png",
            label: "Unicorn",
            spriteSheetUrl: "/uploads/throw-sprites/unicorn.png"
          }
        ]
      }),
    /impact sound/
  );
});

test("sheep throw settings reject impossible cooldown values", () => {
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "-1", costStars: "10" }), /between 0 and 1440/);
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "1441", costStars: "10" }), /between 0 and 1440/);
});

test("sheep throw settings reject impossible star costs", () => {
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "-1" }), /whole number/);
  assert.throws(() => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "1.5" }), /whole number/);
});

test("sheep throw settings reject impossible overlay timing", () => {
  assert.throws(
    () => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "10", overlayDurationSeconds: "1" }),
    /duration/
  );
  assert.throws(
    () => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "10", pollSeconds: "0.2" }),
    /polling/
  );
  assert.throws(
    () => normalizeSheepThrowSettingsInput({ enabled: true, cooldownMinutes: "5", costStars: "10", maxRecentEvents: "3" }),
    /queue/
  );
});

test("sheep throw cooldown returns remaining seconds", () => {
  const now = new Date("2026-06-21T12:00:00.000Z");
  const latestThrow = new Date("2026-06-21T11:56:20.000Z");

  assert.equal(remainingSheepThrowCooldownSeconds(latestThrow, 300, now), 80);
  assert.equal(remainingSheepThrowCooldownSeconds(latestThrow, 180, now), 0);
  assert.equal(remainingSheepThrowCooldownSeconds(null, 300, now), 0);
});

test("sheep throw cooldown label is compact for chat buttons", () => {
  assert.equal(formatSheepThrowCooldownLabel(0), "Ready");
  assert.equal(formatSheepThrowCooldownLabel(12), "12s");
  assert.equal(formatSheepThrowCooldownLabel(60), "1m");
  assert.equal(formatSheepThrowCooldownLabel(75), "1m 15s");
});

test("sheep throw toast names both users and the selected sprite", () => {
  assert.equal(formatSheepThrowToast("Reload", "Richie P"), "Reload threw a sheep at Richie P \u{1f602}");
  assert.equal(formatSheepThrowToast("Reload", "Richie P", "Unicorn"), "Reload threw a unicorn at Richie P \u{1f602}");
});
