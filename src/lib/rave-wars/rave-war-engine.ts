import type { RaveWarLevel } from "@/lib/rave-wars/levels/bazooka-battlefield";
import type { RaveWarLastShot, RaveWarPlayerState, RaveWarShotPoint, RaveWarTerrainCrater, RaveWarWeaponId } from "@/lib/rave-wars/rave-war-types";

export const raveWarMaxTerrainCraters = 36;

export type RaveWarWeaponConfig = {
  blastRadius: number;
  craterMax: number;
  craterMin: number;
  craterPowerScale: number;
  gravity: number;
  homingDelaySteps?: number;
  homingTurnRate?: number;
  hitRadius: number;
  maxDamage: number;
  pathStep: number;
  projectileStepLimit: number;
  speedBase: number;
  speedPowerScale: number;
  windInfluence: number;
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
    speedPowerScale: 0.35,
    windInfluence: 0.0014
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
    speedPowerScale: 0.31,
    windInfluence: 0.0018
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
    speedPowerScale: 0.12,
    windInfluence: 0.0002
  },
  "bass-bomb": {
    blastRadius: 190,
    craterMax: 228,
    craterMin: 148,
    craterPowerScale: 0.62,
    gravity: 0.42,
    hitRadius: 72,
    maxDamage: 88,
    pathStep: 2,
    projectileStepLimit: 430,
    speedBase: 8.2,
    speedPowerScale: 0.29,
    windInfluence: 0.0012
  },
  "glow-grenade": {
    blastRadius: 128,
    craterMax: 150,
    craterMin: 96,
    craterPowerScale: 0.38,
    gravity: 0.56,
    hitRadius: 58,
    maxDamage: 58,
    pathStep: 2,
    projectileStepLimit: 360,
    speedBase: 7,
    speedPowerScale: 0.3,
    windInfluence: 0.0017
  },
  "sheep-launcher": {
    blastRadius: 146,
    craterMax: 178,
    craterMin: 112,
    craterPowerScale: 0.42,
    gravity: 0.34,
    hitRadius: 78,
    maxDamage: 72,
    pathStep: 2,
    projectileStepLimit: 440,
    speedBase: 9.4,
    speedPowerScale: 0.33,
    windInfluence: 0.001
  },
  "homing-bee": {
    blastRadius: 142,
    craterMax: 168,
    craterMin: 108,
    craterPowerScale: 0.38,
    gravity: 0,
    hitRadius: 72,
    homingDelaySteps: 14,
    homingTurnRate: 0.055,
    maxDamage: 74,
    pathStep: 1,
    projectileStepLimit: 360,
    speedBase: 12.5,
    speedPowerScale: 0.08,
    windInfluence: 0.00015
  },
  "tnt-barrel": {
    blastRadius: 215,
    craterMax: 260,
    craterMin: 170,
    craterPowerScale: 0.7,
    gravity: 0.64,
    hitRadius: 76,
    maxDamage: 94,
    pathStep: 2,
    projectileStepLimit: 360,
    speedBase: 5.6,
    speedPowerScale: 0.24,
    windInfluence: 0.0019
  },
  "stink-sock": {
    blastRadius: 98,
    craterMax: 122,
    craterMin: 72,
    craterPowerScale: 0.3,
    gravity: 0.24,
    hitRadius: 64,
    maxDamage: 44,
    pathStep: 2,
    projectileStepLimit: 390,
    speedBase: 12.5,
    speedPowerScale: 0.24,
    windInfluence: 0.0013
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
    y: Math.round(Math.min(level.height - 28, terrainSurfaceY(level, craters, player.x)))
  };
}

export function walkPlayerOnTerrain(
  level: RaveWarLevel,
  craters: RaveWarTerrainCrater[],
  player: RaveWarPlayerState,
  direction: -1 | 1,
  distance: number
) {
  const isInsideCrater = craters.some((crater) => Math.abs(player.x - crater.x) < crater.radius);
  const traversalDistance = distance * (isInsideCrater ? 1.75 : 1);
  const x = Math.round(clamp(player.x + direction * traversalDistance, 42, level.width - 42));

  return settlePlayerOnTerrain(level, craters, {
    ...player,
    x
  });
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

function turnAngleTowards(current: number, target: number, maxStep: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + clamp(delta, -maxStep, maxStep);
}

function projectileIntersectsPlayer(x: number, y: number, player: RaveWarPlayerState, hitRadius: number) {
  const horizontalRadius = Math.max(38, hitRadius * 0.72);
  const verticalRadius = Math.max(52, hitRadius);
  const normalizedX = (x - player.x) / horizontalRadius;
  const normalizedY = (y - (player.y - 43)) / verticalRadius;

  return normalizedX ** 2 + normalizedY ** 2 <= 1;
}

export function simulateRaveWarShot(input: {
  angle: number;
  craters: RaveWarTerrainCrater[];
  level: RaveWarLevel;
  power: number;
  shooter: RaveWarPlayerState;
  target: RaveWarPlayerState;
  weaponId: RaveWarWeaponId;
  wind?: number;
}) {
  const weapon = raveWarWeaponConfigs[input.weaponId];
  const radians = (input.angle * Math.PI) / 180;
  const direction = input.shooter.facing === "left" ? -1 : 1;
  const speed = weapon.speedBase + input.power * weapon.speedPowerScale;
  let x = input.shooter.x + direction * 30;
  let y = input.shooter.y - 46;
  let vx = Math.cos(radians) * speed * direction;
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

    if (weapon.homingTurnRate && step >= (weapon.homingDelaySteps ?? 0)) {
      const targetDeltaX = input.target.x - x;
      const lookAheadX = clamp(x + Math.sign(targetDeltaX || vx) * 190, 0, input.level.width);
      const terrainAheadY = terrainSurfaceY(input.level, input.craters, lookAheadX);
      const needsClearance = Math.abs(targetDeltaX) > 220 && y > terrainAheadY - 150;
      const targetHeading = needsClearance ? -Math.PI / 2 : Math.atan2(input.target.y - 34 - y, targetDeltaX);
      const heading = turnAngleTowards(Math.atan2(vy, vx), targetHeading, weapon.homingTurnRate);
      vx = Math.cos(heading) * speed;
      vy = Math.sin(heading) * speed;
    }

    vx += clamp(input.wind ?? 0, -100, 100) * weapon.windInfluence;
    x += vx;
    y += vy;

    if (!weapon.homingTurnRate || step < (weapon.homingDelaySteps ?? 0)) {
      vy += weapon.gravity;
    }

    // Fine-grained swept sampling prevents fast projectiles from tunnelling through a player.
    const substeps = Math.max(2, Math.ceil(Math.hypot(x - previousX, y - previousY) / 6));

    for (let substep = 1; substep <= substeps; substep += 1) {
      const t = substep / substeps;
      const sampleX = previousX + (x - previousX) * t;
      const sampleY = previousY + (y - previousY) * t;
      const targetDistance = Math.hypot(sampleX - input.target.x, sampleY - (input.target.y - 34));

      closestDistance = Math.min(closestDistance, targetDistance);

      if (projectileIntersectsPlayer(sampleX, sampleY, input.target, weapon.hitRadius)) {
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

    if (hasImpact) {
      const finalPoint = {
        x: Math.round(impactPoint.x),
        y: Math.round(impactPoint.y)
      };
      const previousPoint = path[path.length - 1];

      if (!previousPoint || previousPoint.x !== finalPoint.x || previousPoint.y !== finalPoint.y) {
        path.push(finalPoint);
      }
    } else if (step % weapon.pathStep === 0) {
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
