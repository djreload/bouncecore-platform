import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  recommendRaveWarSpawns,
  raveWarLevelHeight,
  raveWarLevelWidth,
  raveWarTerrainSampleStep,
  terrainSurfaceFromRgba,
  type RaveWarTerrainAnalysis
} from "@/lib/rave-wars/rave-war-terrain-core";

const maxRaveWarImageBytes = 100 * 1024 * 1024;
const uploadKind = "rave-war-levels";
const uploadRoot = path.join(process.cwd(), "public", "uploads", uploadKind);

function extension(name: string) {
  return path.extname(name).trim().toLowerCase();
}

function assertUploadSize(file: File, label: string) {
  if (!file.size) {
    throw new Error(`Choose a ${label.toLowerCase()} file.`);
  }

  if (file.size > maxRaveWarImageBytes) {
    throw new Error(`${label} is too large. Maximum 100MB.`);
  }
}

async function normalizedTerrain(file: File) {
  assertUploadSize(file, "Terrain PNG");

  if (extension(file.name) !== ".png") {
    throw new Error("Terrain must be a PNG so its transparent sky can be converted into collision data.");
  }

  const source = Buffer.from(await file.arrayBuffer());
  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000
  });
  const metadata = await image.metadata();

  if (metadata.format !== "png") {
    throw new Error("Terrain must contain valid PNG image data.");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("Terrain image dimensions could not be read.");
  }

  if (!metadata.hasAlpha) {
    throw new Error("Terrain PNG needs a transparent sky above the opaque walkable ground.");
  }

  const normalized = image.rotate().resize(raveWarLevelWidth, raveWarLevelHeight, {
    fit: "fill"
  });
  const [{ data, info }, png] = await Promise.all([
    normalized.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    normalized.clone().png({ compressionLevel: 9 }).toBuffer()
  ]);
  const collision = terrainSurfaceFromRgba(data, info.width, info.height, info.channels, raveWarTerrainSampleStep);

  if (collision.coveragePercent < 20) {
    throw new Error("Terrain covers too little of the map. Add opaque ground beneath the transparent sky.");
  }

  return {
    analysis: {
      coveragePercent: collision.coveragePercent,
      height: raveWarLevelHeight,
      recommendedSpawns: recommendRaveWarSpawns(collision.surfaceY),
      sampleStep: raveWarTerrainSampleStep,
      sourceHeight: metadata.height,
      sourceWidth: metadata.width,
      surfaceY: collision.surfaceY,
      width: raveWarLevelWidth
    } satisfies RaveWarTerrainAnalysis,
    png
  };
}

export async function analyzeRaveWarTerrainUpload(file: File) {
  const result = await normalizedTerrain(file);

  return result.analysis;
}

async function writeLevelImage(buffer: Buffer, fileExtension: ".png" | ".webp") {
  await mkdir(uploadRoot, {
    recursive: true
  });

  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${fileExtension}`;
  await writeFile(path.join(uploadRoot, filename), buffer);

  return `/uploads/${uploadKind}/${filename}`;
}

export async function saveRaveWarTerrainUpload(file: File) {
  const result = await normalizedTerrain(file);

  return {
    ...result.analysis,
    mapImageUrl: await writeLevelImage(result.png, ".png")
  };
}

export async function saveOptionalRaveWarBackgroundUpload(file: File | null | undefined) {
  if (!file || !file.size) {
    return null;
  }

  assertUploadSize(file, "Level background");
  const source = Buffer.from(await file.arrayBuffer());
  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000
  });
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height || !["avif", "gif", "jpeg", "png", "webp"].includes(metadata.format ?? "")) {
    throw new Error("Level background must be a valid JPG, PNG, WebP, GIF, or AVIF image.");
  }

  const output = await image
    .rotate()
    .resize(raveWarLevelWidth, raveWarLevelHeight, {
      fit: "cover",
      position: "centre"
    })
    .webp({ quality: 88 })
    .toBuffer();

  return writeLevelImage(output, ".webp");
}
