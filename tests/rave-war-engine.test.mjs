import assert from "node:assert/strict";
import test from "node:test";
import { bazookaBattlefieldLevel } from "../src/lib/rave-wars/levels/bazooka-battlefield.ts";
import {
  appendTerrainCrater,
  simulateRaveWarShot,
  terrainSurfaceY
} from "../src/lib/rave-wars/rave-war-engine.ts";

function player(id, spawnIndex) {
  const spawn = bazookaBattlefieldLevel.spawns[spawnIndex];

  return {
    angle: 80,
    color: spawnIndex === 0 ? "#00d5ff" : "#ff3fa4",
    displayName: id,
    facing: spawn.facing,
    health: 100,
    movementLeft: 220,
    playerIndex: spawnIndex,
    power: 65,
    selectedWeapon: "bazooka",
    userId: id,
    x: spawn.x,
    y: spawn.y
  };
}

test("rave war default spawns can hit in both directions", () => {
  const first = player("first", 0);
  const second = player("second", 1);
  const firstShot = simulateRaveWarShot({
    angle: first.angle,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: first.power,
    shooter: first,
    target: second,
    weaponId: "bazooka"
  });
  const secondShot = simulateRaveWarShot({
    angle: second.angle,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: second.power,
    shooter: second,
    target: first,
    weaponId: "bazooka"
  });

  assert.equal(firstShot.impactKind, "hog");
  assert.ok(firstShot.damage > 0);
  assert.equal(secondShot.impactKind, "hog");
  assert.ok(secondShot.damage > 0);
});

test("rave war terrain shots create visible craters that affect the surface", () => {
  const first = player("first", 0);
  const second = player("second", 1);
  const terrainShot = simulateRaveWarShot({
    angle: 35,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: 100,
    shooter: first,
    target: second,
    weaponId: "bazooka"
  });

  assert.equal(terrainShot.impactKind, "terrain");
  assert.ok(terrainShot.crater);
  assert.ok(terrainShot.crater.radius >= 150);

  const before = terrainSurfaceY(bazookaBattlefieldLevel, [], terrainShot.crater.x);
  const craters = appendTerrainCrater([], terrainShot.crater);
  const after = terrainSurfaceY(bazookaBattlefieldLevel, craters, terrainShot.crater.x);

  assert.ok(after > before + 40);
});
