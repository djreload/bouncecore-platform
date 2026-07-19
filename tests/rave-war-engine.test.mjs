import assert from "node:assert/strict";
import test from "node:test";
import { bazookaBattlefieldLevel } from "../src/lib/rave-wars/levels/bazooka-battlefield.ts";
import {
  appendTerrainCrater,
  raveWarWeaponConfigs,
  simulateRaveWarShot,
  terrainSurfaceY,
  walkPlayerOnTerrain
} from "../src/lib/rave-wars/rave-war-engine.ts";
import { raveWarWeaponIds } from "../src/lib/rave-wars/rave-war-types.ts";
import { defaultRaveWarWeaponAmmo } from "../src/lib/rave-wars/rave-war-weapons.ts";

function player(id, spawnIndex) {
  const spawn = bazookaBattlefieldLevel.spawns[spawnIndex];

  return {
    angle: 81,
    color: spawnIndex === 0 ? "#00d5ff" : "#ff3fa4",
    displayName: id,
    facing: spawn.facing,
    health: 100,
    movementLeft: 220,
    playerIndex: spawnIndex,
    power: 65,
    selectedWeapon: "bazooka",
    userId: id,
    weaponAmmo: { ...defaultRaveWarWeaponAmmo },
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

test("every registered rave war weapon has physics and produces a visible projectile path", () => {
  const first = player("first", 0);
  const second = player("second", 1);

  for (const weaponId of raveWarWeaponIds) {
    assert.ok(raveWarWeaponConfigs[weaponId], `${weaponId} needs an engine config`);

    const shot = simulateRaveWarShot({
      angle: first.angle,
      craters: [],
      level: bazookaBattlefieldLevel,
      power: first.power,
      shooter: {
        ...first,
        selectedWeapon: weaponId
      },
      target: second,
      weaponId
    });

    assert.ok(shot.path.length > 2, `${weaponId} should render a projectile trail`);
    assert.ok(shot.blastRadius > 0, `${weaponId} should have a blast radius`);
  }
});

test("rave war terrain shots create visible craters that affect the surface", () => {
  const first = player("first", 0);
  const second = player("second", 1);
  const terrainShot = simulateRaveWarShot({
    angle: 5,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: 55,
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

test("players receive crater traversal assistance and remain inside the visible battlefield", () => {
  const crater = {
    radius: 220,
    x: 900,
    y: 900
  };
  const trappedPlayer = {
    ...player("first", 0),
    x: crater.x,
    y: bazookaBattlefieldLevel.height + 80
  };
  const movedPlayer = walkPlayerOnTerrain(bazookaBattlefieldLevel, [crater], trappedPlayer, 1, 34);

  assert.ok(movedPlayer.x > trappedPlayer.x + 34);
  assert.ok(movedPlayer.y <= bazookaBattlefieldLevel.height - 28);
});

test("homing bee bends toward its target and remains wind resistant", () => {
  const first = player("first", 0);
  const second = player("second", 1);
  const beeShot = simulateRaveWarShot({
    angle: 45,
    craters: [],
    level: bazookaBattlefieldLevel,
    power: 55,
    shooter: { ...first, selectedWeapon: "homing-bee" },
    target: second,
    weaponId: "homing-bee",
    wind: -40
  });

  assert.equal(beeShot.impactKind, "hog");
  assert.ok(beeShot.damage > 0);
  assert.ok(beeShot.path.length > 20);
  assert.ok(beeShot.path.some((point, index) => index > 2 && point.y > beeShot.path[index - 1].y));
});
