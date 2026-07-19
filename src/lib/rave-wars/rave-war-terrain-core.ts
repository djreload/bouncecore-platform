import type { RaveWarLevelSpawn } from "@/lib/rave-wars/levels/bazooka-battlefield";

export const raveWarLevelWidth = 2048;
export const raveWarLevelHeight = 1024;
export const raveWarTerrainSampleStep = 16;
export const raveWarTerrainAlphaThreshold = 32;
export const raveWarMissingTerrainY = raveWarLevelHeight + 160;

export type RaveWarTerrainAnalysis = {
  coveragePercent: number;
  height: number;
  recommendedSpawns: [RaveWarLevelSpawn, RaveWarLevelSpawn];
  sampleStep: number;
  sourceHeight: number;
  sourceWidth: number;
  surfaceY: number[];
  width: number;
};

export function terrainSurfaceFromRgba(
  pixels: Uint8Array,
  width = raveWarLevelWidth,
  height = raveWarLevelHeight,
  channels = 4,
  sampleStep = raveWarTerrainSampleStep,
  alphaThreshold = raveWarTerrainAlphaThreshold
) {
  if (width < 1 || height < 1 || channels < 4 || pixels.length < width * height * channels) {
    throw new Error("Terrain pixel data is incomplete.");
  }

  const sampleCount = Math.floor(width / sampleStep) + 1;
  const surfaceY = Array.from({ length: sampleCount }, (_, index) => {
    const x = Math.min(width - 1, index * sampleStep);

    for (let y = 0; y < height; y += 1) {
      const alpha = pixels[(y * width + x) * channels + 3] ?? 0;

      if (alpha >= alphaThreshold) {
        return y;
      }
    }

    return height + 160;
  });
  const terrainColumns = surfaceY.filter((surface) => surface < height).length;

  return {
    coveragePercent: Math.round((terrainColumns / sampleCount) * 1000) / 10,
    surfaceY
  };
}

export function terrainSurfaceAtX(surfaceY: number[], x: number, sampleStep = raveWarTerrainSampleStep) {
  const sampleX = Math.min(raveWarLevelWidth, Math.max(0, x));
  const index = Math.floor(sampleX / sampleStep);
  const nextIndex = Math.min(surfaceY.length - 1, index + 1);
  const currentY = surfaceY[index] ?? raveWarMissingTerrainY;
  const nextY = surfaceY[nextIndex] ?? currentY;
  const blend = (sampleX - index * sampleStep) / sampleStep;

  return Math.round(currentY + (nextY - currentY) * blend);
}

function recommendedSpawnInRange(
  surfaceY: number[],
  startIndex: number,
  endIndex: number,
  preferredX: number,
  facing: RaveWarLevelSpawn["facing"]
) {
  let best: { score: number; spawn: RaveWarLevelSpawn } | null = null;

  for (let index = Math.max(2, startIndex); index <= Math.min(surfaceY.length - 3, endIndex); index += 1) {
    const y = surfaceY[index] ?? raveWarMissingTerrainY;

    if (y < 80 || y > raveWarLevelHeight - 30) {
      continue;
    }

    const leftY = surfaceY[index - 2] ?? y;
    const rightY = surfaceY[index + 2] ?? y;
    const localSlope = Math.max(Math.abs(y - leftY), Math.abs(y - rightY));
    const x = index * raveWarTerrainSampleStep;
    const score = Math.abs(x - preferredX) + localSlope * 5;

    if (!best || score < best.score) {
      best = {
        score,
        spawn: {
          facing,
          x,
          y
        }
      };
    }
  }

  return best?.spawn ?? null;
}

export function recommendRaveWarSpawns(surfaceY: number[]): [RaveWarLevelSpawn, RaveWarLevelSpawn] {
  const lastIndex = surfaceY.length - 1;
  const first = recommendedSpawnInRange(surfaceY, 4, Math.floor(lastIndex * 0.46), raveWarLevelWidth * 0.27, "right");
  const second = recommendedSpawnInRange(surfaceY, Math.ceil(lastIndex * 0.54), lastIndex - 4, raveWarLevelWidth * 0.73, "left");

  if (!first || !second) {
    throw new Error("Terrain needs a stable opaque walking surface on both the left and right sides.");
  }

  return [first, second];
}

