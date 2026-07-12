import type { RaveWarLevel } from "@/lib/rave-wars/levels/bazooka-battlefield";
import type { RaveWarLastShot, RaveWarPlayerState, RaveWarShotPoint, RaveWarTerrainCrater, RaveWarWeaponId } from "@/lib/rave-wars/rave-war-types";

export const raveWarMaxTerrainCraters = 36;

export type RaveWarWeaponConfig = {
  blastRadius: number;
  craterMax: number;
  craterMin: number;
  craterPowerScale: number;
  gravity: number;
  hitRadius: number;
  maxDamage: number;
  pathStep: number;
  projectileStepLimit: number;
  speedBase: number;
  speedPowerScale: number;
};

export const raveWarWeaponConfigs: Record<RaveWarWeaponId, RaveWarWeaponConfig> = {
  bazooka: {
    blastRadius: 150,
    craterMax: 188,
    craterMin: 126,
    craterPowerScale: 0.52,
    gravity: 0.36,
    hitRadius: 58,
    maxDamage: 78,
    pathStep: 2,
    projectileStepLimit: 420,
    speedBase: 10,
    speedPowerScale: 0.35
  },
  grenade: {
    blastRadius: 138,
    craterMax: 164,
    craterMin: 112,
    craterPowerScale: 0.44,
    gravity: 0.48,
    hitRadius: 52,
    maxDamage: 66,
    pathStep: 2,
    projectileStepLimit: 390,
    speedBase: 7.5,
    speedPowerScale: 0.31
  },
  shotgun: {
    blastRadius: 76,
    craterMax: 96,
    craterMin: 54,
    craterPowerScale: 0.24,
    gravity: 0.015,
    hitRadius: 46,
    maxDamage: 36,
    pathStep: 1,
    projectileStepLimit: 115,
    speedBase: 38,
    speedPowerScale: 0.12
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function baseTerrainSurfaceY(level: RaveWarLevel, x: number) {
  const sampleStep = level.terrain.sampleStep;
  const sampleX = clamp(x, 0, level.width);
  const index = Math.floor(sampleX / sampleStep);
  const nextIndex = Math.min(level.terrain.surfaceY.length - 1, index + 1);
  const currentY = level.terrain.surfaceY[index] ?? level.height + 160;
  const nextY = level.terrain.surfaceY[nextIndex] ?? currentY;
  const blend = (sampleX - index * sampleStep) / sampleStep;

  return currentY + (nextY - currentY) * blend;
}

export function terrainSurfaceY(level: RaveWarLevel, craters: RaveWarTerrainCrater[], x: number) {
  let surface = baseTerrainSurfaceY(level, x);

  for (const crater of craters) {
    const dx = x - crater.x;
    const absDx = Math.abs(dx);

    if (absDx >= crater.radius) {
      continue;
    }

    const craterBottomY = crater.y + Math.sqrt(crater.radius ** 2 - dx ** 2);

    if (craterBottomY > surface) {
      surface = craterBottomY;
    }
  }

  return clamp(surface, 0, level.height + 220);
}

export function settlePlayerOnTerrain(level: RaveWarLevel, craters: RaveWarTerrainCrater[], player: RaveWarPlayerState): RaveWarPlayerState {
  return {
    ...player,
    y: Math.round(terrainSurfaceY(level, craters, player.x))
  };
}

export function settlePlayersOnTerrain(level: RaveWarLevel, craters: RaveWarTerrainCrater[], players: RaveWarPlayerState[]) {
  return players.map((player) => settlePlayerOnTerrain(level, craters, player));
}

export function craterForImpact(input: {
  impactKind: RaveWarLastShot["impactKind"];
  impactPoint: RaveWarShotPoint;
  level: RaveWarLevel;
  power: number;
  weaponId: RaveWarWeaponId;
}) {
  if (input.impactKind === "out-of-bounds") {
    return null;
  }

  const weapon = raveWarWeaponConfigs[input.weaponId];

  return {
    radius: Math.round(clamp(weapon.blastRadius * 0.82 + input.power * weapon.craterPowerScale, weapon.craterMin, weapon.craterMax)),
    x: Math.round(clamp(input.impactPoint.x, 0, input.level.width)),
    y: Math.round(clamp(input.impactPoint.y, 0, input.level.height + 120))
  } satisfies RaveWarTerrainCrater;
}

export function appendTerrainCrater(craters: RaveWarTerrainCrater[], crater: RaveWarTerrainCrater | null, maxCraters = raveWarMaxTerrainCraters) {
  return crater ? [...craters, crater].slice(-maxCraters) : craters;
}

export function shotDamageForDistance(distance: number, weapon: RaveWarWeaponConfig) {
  return distance <= weapon.blastRadius ? Math.max(10, Math.round((1 - distance / weapon.blastRadius) * weapon.maxDamage)) : 0;
}

export function simulateRaveWarShot(input: {
  angle: number;
  craters: RaveWarTerrainCrater[];
  level: RaveWarLevel;
  power: number;
  shooter: RaveWarPlayerState;
  target: RaveWarPlayerState;
  weaponId: RaveWarWeaponId;
}) {
  const weapon = raveWarWeaponConfigs[input.weaponId];
  const radians = (input.angle * Math.PI) / 180;
  const direction = input.shooter.facing === "left" ? -1 : 1;
  const speed = weapon.speedBase + input.power * weapon.speedPowerScale;
  let x = input.shooter.x + direction * 30;
  let y = input.shooter.y - 46;
  const vx = Math.cos(radians) * speed * direction;
  let vy = -Math.sin(radians) * speed;
  let closestDistance = Number.POSITIVE_INFINITY;
  let impactKind: RaveWarLastShot["impactKind"] = "out-of-bounds";
  let impactPoint = {
    x,
    y
  };
  const path: RaveWarShotPoint[] = [];
  let hasImpact = false;

  for (let step = 0; step < weapon.projectileStepLimit && !hasImpact; step += 1) {
    const previousX = x;
    const previousY = y;

    x += vx;
    y += vy;
    vy += weapon.gravity;

    const substeps = Math.max(2, Math.ceil(Math.hypot(x - previousX, y - previousY) / 18));

    for (let substep = 1; substep <= substeps; substep += 1) {
      const t = substep / substeps;
      const sampleX = previousX + (x - previousX) * t;
      const sampleY = previousY + (y - previousY) * t;
      const targetDistance = Math.hypot(sampleX - input.target.x, sampleY - (input.target.y - 34));

      closestDistance = Math.min(closestDistance, targetDistance);

      if (targetDistance <= weapon.hitRadius) {
        impactKind = "hog";
        impactPoint = {
          x: sampleX,
          y: sampleY
        };
        hasImpact = true;
        break;
      }

      if (sampleX >= 0 && sampleX <= input.level.width && sampleY >= terrainSurfaceY(input.level, input.craters, sampleX)) {
        impactKind = "terrain";
        impactPoint = {
          x: sampleX,
          y: terrainSurfaceY(input.level, input.craters, sampleX)
        };
        hasImpact = true;
        break;
      }

      if (sampleX < -96 || sampleX > input.level.width + 96 || sampleY > input.level.height + 220) {
        impactKind = "out-of-bounds";
        impactPoint = {
          x: sampleX,
          y: sampleY
        };
        hasImpact = true;
        break;
      }
    }

    if (step % weapon.pathStep === 0) {
      path.push({
        x: Math.round(x),
        y: Math.round(y)
      });
    }
  }

  const impactDistance = Math.hypot(impactPoint.x - input.target.x, impactPoint.y - (input.target.y - 34));
  const damage = shotDamageForDistance(impactKind === "out-of-bounds" ? closestDistance : impactDistance, weapon);
  const normalizedImpactPoint = {
    x: Math.round(impactPoint.x),
    y: Math.round(impactPoint.y)
  };
  const crater = craterForImpact({
    impactKind,
    impactPoint: normalizedImpactPoint,
    level: input.level,
    power: input.power,
    weaponId: input.weaponId
  });

  return {
    blastRadius: weapon.blastRadius,
    crater,
    damage,
    distance: Math.round(impactKind === "out-of-bounds" ? closestDistance : impactDistance),
    impactKind,
    impactPoint: normalizedImpactPoint,
    path: path.slice(0, 180)
  };
}
