import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  recommendRaveWarSpawns,
  raveWarLevelHeight,
  raveWarLevelWidth,
  terrainSurfaceAtX,
  terrainSurfaceFromRgba
} from "../src/lib/rave-wars/rave-war-terrain-core.ts";
import { analyzeRaveWarTerrainUpload } from "../src/lib/rave-wars/rave-war-terrain-upload.ts";

test("terrain alpha pixels generate interpolated collision heights", () => {
  const width = 64;
  const height = 32;
  const channels = 4;
  const pixels = new Uint8Array(width * height * channels);

  for (let x = 0; x < width; x += 1) {
    const surface = 10 + Math.floor(x / 16);

    for (let y = surface; y < height; y += 1) {
      pixels[(y * width + x) * channels + 3] = 255;
    }
  }

  const collision = terrainSurfaceFromRgba(pixels, width, height, channels, 16);

  assert.deepEqual(collision.surfaceY, [10, 11, 12, 13, 13]);
  assert.equal(collision.coveragePercent, 100);
});

test("terrain analysis normalizes transparent PNGs and recommends two grounded spawns", async () => {
  const sourceWidth = 320;
  const sourceHeight = 160;
  const channels = 4;
  const pixels = Buffer.alloc(sourceWidth * sourceHeight * channels);

  for (let y = 88; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const offset = (y * sourceWidth + x) * channels;
      pixels[offset] = 40;
      pixels[offset + 1] = 220;
      pixels[offset + 2] = 110;
      pixels[offset + 3] = 255;
    }
  }

  const png = await sharp(pixels, { raw: { channels, height: sourceHeight, width: sourceWidth } }).png().toBuffer();
  const analysis = await analyzeRaveWarTerrainUpload(new File([png], "terrain.png", { type: "image/png" }));

  assert.equal(analysis.width, raveWarLevelWidth);
  assert.equal(analysis.height, raveWarLevelHeight);
  assert.equal(analysis.surfaceY.length, 129);
  assert.equal(analysis.coveragePercent, 100);
  assert.ok(analysis.recommendedSpawns[0].x < raveWarLevelWidth / 2);
  assert.ok(analysis.recommendedSpawns[1].x > raveWarLevelWidth / 2);
  assert.ok(analysis.recommendedSpawns.every((spawn) => spawn.y > 500 && spawn.y < 600));
});

test("spawn recommendations and interpolation follow generated terrain", () => {
  const surfaceY = Array.from({ length: 129 }, (_, index) => 620 + Math.round(Math.sin(index / 9) * 12));
  const spawns = recommendRaveWarSpawns(surfaceY);

  assert.equal(spawns[0].facing, "right");
  assert.equal(spawns[1].facing, "left");
  assert.equal(spawns[0].y, terrainSurfaceAtX(surfaceY, spawns[0].x));
  assert.equal(spawns[1].y, terrainSurfaceAtX(surfaceY, spawns[1].x));
});

test("custom Rave War levels are admin managed and selected for new challenges", () => {
  const levelService = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-level-service.ts"), "utf8");
  const warService = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-service.ts"), "utf8");
  const panel = readFileSync(join(process.cwd(), "src/app/admin/rave-war-levels/rave-war-levels-panel.tsx"), "utf8");

  assert.match(levelService, /rave-wars\.levels/);
  assert.match(levelService, /prisma\.raveWar\.count/);
  assert.match(levelService, /cleanupDeletedManagedUploads/);
  assert.match(warService, /await getActiveRaveWarLevel\(\)/);
  assert.match(warService, /levelKey: level\.key/);
  assert.match(panel, /name="terrainFile"/);
  assert.match(panel, /name="firstSpawnX"/);
  assert.match(panel, /Levels referenced by wars are retained/);
});
