import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseChatEffect,
  chatEffects,
  chatEffectParticlePresets,
  getAvailableChatEffects,
  getChatEffectById,
  validateChatEffectSelection
} from "../src/lib/chat/chat-effects.ts";

const freeEffectIds = ["glow", "bounce", "wave", "pulse", "rainbow", "float", "shine", "spark", "shadow", "typing"];
const supporterEffectIds = [
  "neon",
  "gold",
  "fire",
  "ice",
  "heartbeat",
  "matrix",
  "slide",
  "storm",
  "glitch",
  "hype",
  "vhs",
  "laser",
  "galaxy",
  "inferno",
  "legend"
];
const moderatorEffectIds = ["moderator", "shield", "staff-pulse", "authority", "watchtower"];
const developerEffectIds = ["devmode", "debug", "compile", "terminal", "syntax"];
const ownerEffectIds = ["founder", "bouncecore", "reload", "mythic", "crown"];

function availableIds(roles) {
  return getAvailableChatEffects(roles).map((effect) => effect.id);
}

test("viewer only sees the 10 free chat effects", () => {
  assert.deepEqual(availableIds(["viewer"]), freeEffectIds);
});

test("supporter sees free and supporter chat effects", () => {
  assert.deepEqual(availableIds(["supporter"]), [...freeEffectIds, ...supporterEffectIds]);
});

test("moderator inherits supporter effects and receives moderator hidden effects", () => {
  assert.deepEqual(availableIds(["moderator"]), [...freeEffectIds, ...supporterEffectIds, ...moderatorEffectIds]);
});

test("developer inherits moderator effects and receives developer hidden effects", () => {
  assert.deepEqual(availableIds(["developer"]), [
    ...freeEffectIds,
    ...supporterEffectIds,
    ...moderatorEffectIds,
    ...developerEffectIds
  ]);
});

test("owner receives every registered chat effect", () => {
  assert.deepEqual(availableIds(["owner"]), [
    ...freeEffectIds,
    ...supporterEffectIds,
    ...moderatorEffectIds,
    ...developerEffectIds,
    ...ownerEffectIds
  ]);
  assert.deepEqual(availableIds(["owner"]), chatEffects.map((effect) => effect.id));
  assert.equal(chatEffects.length, 40);
});

test("unauthorized submitted effect is blocked", () => {
  assert.equal(canUseChatEffect(["viewer"], "neon"), false);
  assert.throws(() => validateChatEffectSelection(["viewer"], "neon"), /access/);
  assert.equal(validateChatEffectSelection(["viewer"], ""), null);
});

test("advanced chat particles use registered safe presets", () => {
  const registeredPresets = new Set(chatEffectParticlePresets);
  const particleEffects = chatEffects.filter((effect) => effect.particlePreset);

  assert.ok(particleEffects.length >= 20);

  for (const effect of particleEffects) {
    assert.ok(registeredPresets.has(effect.particlePreset));
  }

  assert.equal(getChatEffectById("fire")?.particlePreset, "fire");
  assert.equal(getChatEffectById("ice")?.particlePreset, "ice");
  assert.equal(getChatEffectById("heartbeat")?.particlePreset, "hearts");
  assert.equal(getChatEffectById("crown")?.particlePreset, "crowns");
});
