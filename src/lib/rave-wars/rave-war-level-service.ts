import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { cleanupDeletedManagedUploads } from "@/lib/media/upload-cleanup-service";
import {
  bazookaBattlefieldLevel,
  getBuiltInRaveWarLevel,
  raveWarLevels,
  type RaveWarLevel
} from "@/lib/rave-wars/levels/bazooka-battlefield";
import {
  raveWarLevelHeight,
  raveWarLevelWidth,
  raveWarMissingTerrainY,
  raveWarTerrainSampleStep,
  terrainSurfaceAtX,
  type RaveWarTerrainAnalysis
} from "@/lib/rave-wars/rave-war-terrain-core";

const raveWarLevelsSettingKey = "rave-wars.levels";
const maxCustomLevels = 20;
const expectedSurfaceSamples = raveWarLevelWidth / raveWarTerrainSampleStep + 1;
const catalogCacheMs = 5_000;

type StoredRaveWarLevelCatalog = {
  activeLevelKey: string;
  levels: RaveWarLevel[];
};

let cachedCatalog: { expiresAt: number; value: StoredRaveWarLevelCatalog } | null = null;

export type AdminRaveWarLevel = {
  isActive: boolean;
  isBuiltIn: boolean;
  level: RaveWarLevel;
  usageCount: number;
};

export type AdminRaveWarLevelsData = {
  activeLevelKey: string;
  levels: AdminRaveWarLevel[];
};

export type CreateRaveWarLevelInput = RaveWarTerrainAnalysis & {
  backgroundColor: string;
  backgroundImageUrl: string | null;
  makeActive: boolean;
  mapImageUrl: string;
  name: string;
  theme: string;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizedName(value: string, label: string, maxLength: number) {
  const text = value.trim().replace(/\s+/g, " ");

  if (text.length < 2 || text.length > maxLength) {
    throw new Error(`${label} must be between 2 and ${maxLength} characters.`);
  }

  return text;
}

function normalizedColor(value: string) {
  const color = value.trim().toLowerCase();

  if (!/^#[0-9a-f]{6}$/.test(color)) {
    throw new Error("Background colour must be a six-digit hex colour.");
  }

  return color;
}

function normalizedLevelUploadUrl(value: unknown, extensionPattern: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const pattern = new RegExp(`^/uploads/rave-war-levels/[^/]+\\.(${extensionPattern})$`, "i");

  return pattern.test(text) ? text : null;
}

function normalizedSurface(value: unknown) {
  if (!Array.isArray(value) || value.length !== expectedSurfaceSamples) {
    return null;
  }

  const surfaceY = value.map((entry) => Number(entry));

  if (surfaceY.some((entry) => !Number.isFinite(entry) || entry < 0 || entry > raveWarMissingTerrainY)) {
    return null;
  }

  return surfaceY.map(Math.round);
}

function normalizedSpawnX(value: unknown) {
  const x = Number(value);

  if (!Number.isFinite(x)) {
    return null;
  }

  const rounded = Math.round(x);

  return rounded >= 42 && rounded <= raveWarLevelWidth - 42 ? rounded : null;
}

function normalizeStoredCustomLevel(value: unknown): RaveWarLevel | null {
  const record = recordValue(value);
  const terrain = recordValue(record?.terrain);
  const spawns = Array.isArray(record?.spawns) ? record.spawns : [];
  const firstSpawn = recordValue(spawns[0]);
  const secondSpawn = recordValue(spawns[1]);
  const surfaceY = normalizedSurface(terrain?.surfaceY);
  const firstX = normalizedSpawnX(firstSpawn?.x);
  const secondX = normalizedSpawnX(secondSpawn?.x);
  const mapImageUrl = normalizedLevelUploadUrl(record?.mapImageUrl, "png");
  const uploadedBackgroundImageUrl = normalizedLevelUploadUrl(record?.backgroundImageUrl, "webp|jpg|jpeg|png|avif");
  const backgroundImageUrl = uploadedBackgroundImageUrl ??
    (record?.backgroundImageUrl === bazookaBattlefieldLevel.backgroundImageUrl ? bazookaBattlefieldLevel.backgroundImageUrl : null);
  const key = typeof record?.key === "string" && /^custom-[a-z0-9-]{4,80}$/.test(record.key) ? record.key : null;

  if (!key || !surfaceY || firstX === null || secondX === null || !mapImageUrl || !backgroundImageUrl) {
    return null;
  }

  const name = typeof record?.name === "string" ? record.name.trim().slice(0, 60) : "";
  const theme = typeof record?.theme === "string" ? record.theme.trim().slice(0, 40) : "";
  const backgroundColor = typeof record?.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(record.backgroundColor)
    ? record.backgroundColor.toLowerCase()
    : "#10151d";

  if (name.length < 2 || theme.length < 2 || Math.abs(firstX - secondX) < 160) {
    return null;
  }

  return {
    backgroundColor,
    backgroundImageUrl,
    height: raveWarLevelHeight,
    key,
    mapImageUrl,
    maskImageUrl: mapImageUrl,
    name,
    spawns: [
      {
        facing: "right",
        x: firstX,
        y: terrainSurfaceAtX(surfaceY, firstX)
      },
      {
        facing: "left",
        x: secondX,
        y: terrainSurfaceAtX(surfaceY, secondX)
      }
    ],
    terrain: {
      sampleStep: raveWarTerrainSampleStep,
      surfaceY
    },
    theme,
    width: raveWarLevelWidth
  };
}

function normalizeCatalog(value: unknown): StoredRaveWarLevelCatalog {
  const record = recordValue(value);
  const levels = Array.isArray(record?.levels)
    ? record.levels.map(normalizeStoredCustomLevel).filter((level): level is RaveWarLevel => Boolean(level)).slice(0, maxCustomLevels)
    : [];
  const uniqueLevels = [...new Map(levels.map((level) => [level.key, level])).values()];
  const requestedActiveKey = typeof record?.activeLevelKey === "string" ? record.activeLevelKey : bazookaBattlefieldLevel.key;
  const availableKeys = new Set([...Object.keys(raveWarLevels), ...uniqueLevels.map((level) => level.key)]);

  return {
    activeLevelKey: availableKeys.has(requestedActiveKey) ? requestedActiveKey : bazookaBattlefieldLevel.key,
    levels: uniqueLevels
  };
}

async function readCatalog() {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) {
    return cachedCatalog.value;
  }

  const setting = await prisma.appSetting.findUnique({
    where: {
      key: raveWarLevelsSettingKey
    }
  });

  const value = normalizeCatalog(setting?.value);
  cachedCatalog = {
    expiresAt: Date.now() + catalogCacheMs,
    value
  };

  return value;
}

async function saveCatalog(catalog: StoredRaveWarLevelCatalog) {
  const normalizedCatalog = normalizeCatalog(catalog);

  await prisma.appSetting.upsert({
    where: {
      key: raveWarLevelsSettingKey
    },
    update: {
      description: "Admin-managed Rave War terrain levels and active level selection.",
      isSecret: false,
      value: normalizedCatalog as unknown as Prisma.InputJsonValue
    },
    create: {
      description: "Admin-managed Rave War terrain levels and active level selection.",
      isSecret: false,
      key: raveWarLevelsSettingKey,
      value: normalizedCatalog as unknown as Prisma.InputJsonValue
    }
  });
  cachedCatalog = {
    expiresAt: Date.now() + catalogCacheMs,
    value: normalizedCatalog
  };
}

function allLevels(catalog: StoredRaveWarLevelCatalog) {
  return [...Object.values(raveWarLevels), ...catalog.levels];
}

export async function getRaveWarLevel(levelKey?: string | null) {
  if (levelKey && levelKey in raveWarLevels) {
    return getBuiltInRaveWarLevel(levelKey);
  }

  const catalog = await readCatalog();

  return catalog.levels.find((level) => level.key === levelKey) ?? bazookaBattlefieldLevel;
}

export async function getActiveRaveWarLevel() {
  const catalog = await readCatalog();

  return allLevels(catalog).find((level) => level.key === catalog.activeLevelKey) ?? bazookaBattlefieldLevel;
}

export async function getAdminRaveWarLevelsData(): Promise<AdminRaveWarLevelsData> {
  const catalog = await readCatalog();
  const levels = allLevels(catalog);
  const usageCounts = await Promise.all(
    levels.map((level) => prisma.raveWar.count({ where: { levelKey: level.key } }))
  );

  return {
    activeLevelKey: catalog.activeLevelKey,
    levels: levels.map((level, index) => ({
      isActive: level.key === catalog.activeLevelKey,
      isBuiltIn: level.key in raveWarLevels,
      level,
      usageCount: usageCounts[index] ?? 0
    }))
  };
}

export async function createRaveWarLevel(input: CreateRaveWarLevelInput, actorId: string) {
  const catalog = await readCatalog();

  if (catalog.levels.length >= maxCustomLevels) {
    throw new Error(`A maximum of ${maxCustomLevels} custom Rave War levels can be stored.`);
  }

  const name = normalizedName(input.name, "Level name", 60);
  const theme = normalizedName(input.theme || "Custom", "Theme", 40);
  const surfaceY = normalizedSurface(input.surfaceY);
  const mapImageUrl = normalizedLevelUploadUrl(input.mapImageUrl, "png");
  const uploadedBackground = normalizedLevelUploadUrl(input.backgroundImageUrl, "webp|jpg|jpeg|png|avif");

  if (!surfaceY || !mapImageUrl) {
    throw new Error("Generated terrain collision data is invalid.");
  }

  const backgroundImageUrl = uploadedBackground ?? bazookaBattlefieldLevel.backgroundImageUrl;
  const keySlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "level";
  const key = `custom-${keySlug}-${randomUUID().slice(0, 8)}`;
  const firstX = input.recommendedSpawns[0].x;
  const secondX = input.recommendedSpawns[1].x;
  const level: RaveWarLevel = {
    backgroundColor: normalizedColor(input.backgroundColor || "#10151d"),
    backgroundImageUrl,
    height: raveWarLevelHeight,
    key,
    mapImageUrl,
    maskImageUrl: mapImageUrl,
    name,
    spawns: [
      { facing: "right", x: firstX, y: terrainSurfaceAtX(surfaceY, firstX) },
      { facing: "left", x: secondX, y: terrainSurfaceAtX(surfaceY, secondX) }
    ],
    terrain: {
      sampleStep: raveWarTerrainSampleStep,
      surfaceY
    },
    theme,
    width: raveWarLevelWidth
  };
  const nextCatalog = {
    activeLevelKey: input.makeActive ? key : catalog.activeLevelKey,
    levels: [...catalog.levels, level]
  };

  await saveCatalog(nextCatalog);
  await writeAuditLog({
    action: "rave_wars.level.create",
    actorId,
    metadata: {
      coveragePercent: input.coveragePercent,
      key,
      mapImageUrl,
      name,
      sourceHeight: input.sourceHeight,
      sourceWidth: input.sourceWidth
    },
    severity: "info",
    target: `rave-war-level:${key}`
  });

  return level;
}

export async function updateRaveWarLevelSpawns(levelKey: string, firstSpawnX: number, secondSpawnX: number, actorId: string) {
  const catalog = await readCatalog();
  const levelIndex = catalog.levels.findIndex((level) => level.key === levelKey);

  if (levelIndex < 0) {
    throw new Error("Only custom Rave War level spawn points can be edited.");
  }

  const firstX = normalizedSpawnX(firstSpawnX);
  const secondX = normalizedSpawnX(secondSpawnX);

  if (firstX === null || secondX === null) {
    throw new Error(`Spawn X positions must be between 42 and ${raveWarLevelWidth - 42}.`);
  }

  if (Math.abs(firstX - secondX) < 160) {
    throw new Error("Spawn points need at least 160 map pixels between them.");
  }

  const level = catalog.levels[levelIndex];

  if (!level) {
    throw new Error("Rave War level was not found.");
  }

  const firstY = terrainSurfaceAtX(level.terrain.surfaceY, firstX);
  const secondY = terrainSurfaceAtX(level.terrain.surfaceY, secondX);

  if (firstY >= raveWarLevelHeight || secondY >= raveWarLevelHeight) {
    throw new Error("Both spawn positions must sit above opaque terrain.");
  }

  const updatedLevel: RaveWarLevel = {
    ...level,
    spawns: [
      { facing: "right", x: firstX, y: firstY },
      { facing: "left", x: secondX, y: secondY }
    ]
  };
  const levels = catalog.levels.slice();
  levels[levelIndex] = updatedLevel;
  await saveCatalog({ ...catalog, levels });
  await writeAuditLog({
    action: "rave_wars.level.spawns.update",
    actorId,
    metadata: { firstSpawnX: firstX, secondSpawnX: secondX },
    severity: "info",
    target: `rave-war-level:${levelKey}`
  });

  return updatedLevel;
}

export async function setActiveRaveWarLevel(levelKey: string, actorId: string) {
  const catalog = await readCatalog();

  if (!allLevels(catalog).some((level) => level.key === levelKey)) {
    throw new Error("Rave War level was not found.");
  }

  await saveCatalog({ ...catalog, activeLevelKey: levelKey });
  await writeAuditLog({
    action: "rave_wars.level.activate",
    actorId,
    severity: "info",
    target: `rave-war-level:${levelKey}`
  });
}

export async function deleteRaveWarLevel(levelKey: string, actorId: string) {
  if (levelKey in raveWarLevels) {
    throw new Error("The built-in fallback level cannot be deleted.");
  }

  const catalog = await readCatalog();
  const level = catalog.levels.find((entry) => entry.key === levelKey);

  if (!level) {
    throw new Error("Rave War level was not found.");
  }

  const usageCount = await prisma.raveWar.count({ where: { levelKey } });

  if (usageCount > 0) {
    throw new Error(`This level is referenced by ${usageCount} Rave War${usageCount === 1 ? "" : "s"} and cannot be deleted.`);
  }

  const nextCatalog = {
    activeLevelKey: catalog.activeLevelKey === levelKey ? bazookaBattlefieldLevel.key : catalog.activeLevelKey,
    levels: catalog.levels.filter((entry) => entry.key !== levelKey)
  };
  await saveCatalog(nextCatalog);
  await cleanupDeletedManagedUploads([level.mapImageUrl, level.backgroundImageUrl]);
  await writeAuditLog({
    action: "rave_wars.level.delete",
    actorId,
    metadata: { name: level.name },
    severity: "warning",
    target: `rave-war-level:${levelKey}`
  });
}
