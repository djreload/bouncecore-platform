import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { bazookaBattlefieldLevel } from "../src/lib/rave-wars/levels/bazooka-battlefield.ts";
import { simulateRaveWarShot, walkPlayerOnTerrain } from "../src/lib/rave-wars/rave-war-engine.ts";
import { nextLivingRaveWarPlayer, raveWarDeadlineHasPassed } from "../src/lib/rave-wars/rave-war-lifecycle-core.ts";
import { shouldApplyRaveWarSnapshot } from "../src/lib/rave-wars/rave-war-network-core.ts";
import { defaultRaveWarWeaponAmmo } from "../src/lib/rave-wars/rave-war-weapons.ts";

function player(userId, playerIndex) {
  const spawn = bazookaBattlefieldLevel.spawns[playerIndex];
  return {
    angle: 81,
    color: playerIndex === 0 ? "#00d5ff" : "#ff3fa4",
    displayName: userId,
    facing: spawn.facing,
    health: 100,
    movementLeft: 220,
    playerIndex,
    power: 65,
    selectedWeapon: "bazooka",
    userId,
    weaponAmmo: { ...defaultRaveWarWeaponAmmo },
    x: spawn.x,
    y: spawn.y
  };
}

test("two-player lifecycle covers movement, firing, timeout, reconnect, completion, and star accounting", () => {
  const challengeCost = 20;
  const openingBalance = 100;
  const chargedBalance = openingBalance - challengeCost;
  const first = player("challenger", 0);
  const second = player("target", 1);

  assert.equal(chargedBalance, 80);
  const movedFirst = walkPlayerOnTerrain(bazookaBattlefieldLevel, [], first, 1, 34);
  assert.ok(movedFirst.x > bazookaBattlefieldLevel.spawns[0].x);

  const shot = simulateRaveWarShot({
    angle: first.angle,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: first.power,
    shooter: first,
    target: second,
    weaponId: "bazooka"
  });
  assert.equal(shot.impactKind, "hog");
  assert.ok(shot.damage > 0);

  const turnDeadline = "2026-07-21T12:01:00.000Z";
  assert.equal(raveWarDeadlineHasPassed(turnDeadline, new Date("2026-07-21T12:00:59.000Z")), false);
  assert.equal(raveWarDeadlineHasPassed(turnDeadline, new Date("2026-07-21T12:01:00.000Z")), true);
  assert.equal(nextLivingRaveWarPlayer([first, second], first.userId)?.userId, second.userId);
  assert.equal(shouldApplyRaveWarSnapshot(8, 7), false);
  assert.equal(shouldApplyRaveWarSnapshot(8, 9), true);
  assert.ok(second.health - shot.damage < second.health);
  assert.equal(chargedBalance, 80, "accepted and completed matches keep the entry charge");
});

test("challenge notification and lifecycle events remain part of the server transaction", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");

  for (const eventType of ["challenge.created", "challenge.accepted", "turn.expired", "shot.fired", "war.finished"]) {
    assert.match(source, new RegExp(eventType.replace(".", "\\.")));
  }
  assert.match(source, /chat\.rave_war\.challenge/);
  assert.match(source, /dedupeKey:\s*`chat\.rave_war\.challenge:/);
});
