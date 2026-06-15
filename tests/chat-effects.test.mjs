import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseChatEffect,
  chatEffects,
  getAvailableChatEffects,
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
