export const coreLevelSchemaVersion = 1;
export const coreLevelWorldSizes = [512, 1024, 2048] as const;
export const coreLevelGridSizes = [4, 8, 16, 32, 64] as const;
export const coreLevelMaximumObjects = 2_000;

export type CoreLevelMode = "ffa" | "teamplay" | "ctf";
export type CoreLevelShape = "arch" | "block" | "cylinder" | "ramp" | "sphere" | "stairs";
export type CoreLevelEntityKind =
  | "armour-green"
  | "armour-yellow"
  | "bullets"
  | "flag"
  | "grenades"
  | "health"
  | "light"
  | "player-spawn"
  | "quad"
  | "rifle-rounds"
  | "rockets"
  | "shotgun-shells"
  | "teleporter"
  | "teleporter-destination";
export type CoreLevelObjectKind = "entity" | "geometry";
export type CoreLevelTeam = 0 | 1 | 2;

export type CoreLevelVector3 = {
  x: number;
  y: number;
  z: number;
};

export type CoreLevelTransform = {
  position: CoreLevelVector3;
  rotation: CoreLevelVector3;
  scale: CoreLevelVector3;
};

export type CoreLevelObject = {
  entityKind?: CoreLevelEntityKind;
  id: string;
  kind: CoreLevelObjectKind;
  label: string;
  materialId?: string;
  properties?: {
    angle?: number;
    blue?: number;
    green?: number;
    radius?: number;
    red?: number;
    tag?: number;
    team?: CoreLevelTeam;
  };
  shape?: CoreLevelShape;
  transform: CoreLevelTransform;
};

export type CoreLevelDocument = {
  ambient: number;
  description: string;
  fog: number;
  fogColor: string;
  gridSize: (typeof coreLevelGridSizes)[number];
  modes: CoreLevelMode[];
  name: string;
  objects: CoreLevelObject[];
  schemaVersion: typeof coreLevelSchemaVersion;
  skyColor: string;
  slug: string;
  worldSize: (typeof coreLevelWorldSizes)[number];
};

export type CoreLevelValidationIssue = {
  code: string;
  message: string;
  objectId?: string;
  severity: "error" | "warning";
};

export type CoreLevelValidationResult = {
  issues: CoreLevelValidationIssue[];
  stats: {
    entities: number;
    geometry: number;
    lights: number;
    playerSpawns: number;
    redFlags: number;
    redSpawns: number;
    blueFlags: number;
    blueSpawns: number;
    total: number;
  };
  valid: boolean;
};

export type CoreLevelTextureDefinition = {
  accent: string;
  category: "Architectural" | "Industrial" | "Natural" | "Neon" | "Utility";
  color: string;
  displayName: string;
  id: string;
  metalness: number;
  pattern: "brick" | "circuit" | "grid" | "noise" | "panel" | "plank" | "tile";
  roughness: number;
};

const texture = (
  id: string,
  displayName: string,
  category: CoreLevelTextureDefinition["category"],
  color: string,
  accent: string,
  pattern: CoreLevelTextureDefinition["pattern"],
  roughness = 0.8,
  metalness = 0
): CoreLevelTextureDefinition => ({
  accent,
  category,
  color,
  displayName,
  id,
  metalness,
  pattern,
  roughness
});

export const coreLevelTextureCatalog: CoreLevelTextureDefinition[] = [
  texture("grass-lush", "Lush grass", "Natural", "#4f8e3c", "#79b957", "noise"),
  texture("grass-night", "Night grass", "Natural", "#254f39", "#42a75e", "noise"),
  texture("dirt-rich", "Rich dirt", "Natural", "#765039", "#a47751", "noise"),
  texture("dirt-rocky", "Rocky dirt", "Natural", "#66584c", "#9a876f", "noise"),
  texture("sand-gold", "Golden sand", "Natural", "#c9af6a", "#ead58e", "noise"),
  texture("sand-black", "Black sand", "Natural", "#34363c", "#666a75", "noise"),
  texture("stone-grey", "Grey stone", "Natural", "#737b82", "#a5abb0", "noise"),
  texture("stone-dark", "Dark stone", "Natural", "#303640", "#555f6c", "noise"),
  texture("stone-moss", "Moss stone", "Natural", "#596452", "#8ca36f", "noise"),
  texture("ice-blue", "Blue ice", "Natural", "#79c9e8", "#d1f4ff", "tile", 0.25),
  texture("lava-crust", "Lava crust", "Natural", "#391c1b", "#ff542e", "circuit", 0.9),
  texture("water-deep", "Deep water", "Natural", "#164d82", "#2ba8df", "tile", 0.2),
  texture("oak-planks", "Oak planks", "Architectural", "#91683f", "#c8955c", "plank"),
  texture("dark-planks", "Dark planks", "Architectural", "#493a35", "#786052", "plank"),
  texture("painted-planks", "Cyan planks", "Architectural", "#177f8f", "#45d7e9", "plank"),
  texture("red-brick", "Red brick", "Architectural", "#8f493b", "#c66d54", "brick"),
  texture("charcoal-brick", "Charcoal brick", "Architectural", "#343239", "#676270", "brick"),
  texture("white-brick", "White brick", "Architectural", "#b8bec4", "#ecf1f4", "brick"),
  texture("concrete", "Clean concrete", "Architectural", "#85888e", "#b9bdc3", "noise"),
  texture("concrete-rave", "Painted concrete", "Architectural", "#383848", "#ff2bd6", "panel"),
  texture("marble-white", "White marble", "Architectural", "#d8d9dd", "#ffffff", "noise", 0.35),
  texture("roof-slate", "Slate roof", "Architectural", "#3a4654", "#718296", "tile"),
  texture("ceramic-cyan", "Cyan ceramic", "Architectural", "#078ea8", "#61e5fa", "tile", 0.25),
  texture("ceramic-pink", "Pink ceramic", "Architectural", "#9c247d", "#ff75da", "tile", 0.25),
  texture("steel-clean", "Clean steel", "Industrial", "#68717c", "#c7d2dc", "panel", 0.3, 0.72),
  texture("steel-dark", "Dark steel", "Industrial", "#252b35", "#596271", "panel", 0.4, 0.7),
  texture("steel-rust", "Rust steel", "Industrial", "#674032", "#bd6a3d", "panel", 0.72, 0.42),
  texture("diamond-plate", "Diamond plate", "Industrial", "#59616b", "#aab4bd", "grid", 0.35, 0.76),
  texture("hazard-yellow", "Yellow hazard", "Industrial", "#d6a712", "#292710", "grid"),
  texture("hazard-red", "Red hazard", "Industrial", "#b62d35", "#241a1e", "grid"),
  texture("vent-dark", "Dark vent", "Industrial", "#202630", "#4d5967", "grid", 0.5, 0.6),
  texture("cargo-blue", "Blue cargo", "Industrial", "#195c8e", "#3e94c9", "panel"),
  texture("cargo-red", "Red cargo", "Industrial", "#8d3142", "#cf586b", "panel"),
  texture("tech-floor", "Tech floor", "Industrial", "#1c2933", "#00d5ff", "circuit", 0.45, 0.48),
  texture("neon-cyan", "Cyan glow", "Neon", "#063342", "#00d5ff", "circuit", 0.25, 0.2),
  texture("neon-pink", "Pink glow", "Neon", "#3e0b36", "#ff2bd6", "circuit", 0.25, 0.2),
  texture("neon-acid", "Acid glow", "Neon", "#29370d", "#b6ff2e", "circuit", 0.25, 0.2),
  texture("neon-violet", "Violet glow", "Neon", "#25143e", "#9d68ff", "circuit", 0.25, 0.2),
  texture("laser-grid", "Laser grid", "Neon", "#160e25", "#f14cff", "grid", 0.2),
  texture("dancefloor-cyan", "Cyan dancefloor", "Neon", "#101928", "#00d5ff", "tile", 0.3),
  texture("dancefloor-mix", "Rave dancefloor", "Neon", "#20152c", "#ff2bd6", "tile", 0.3),
  texture("speaker-black", "Speaker black", "Utility", "#111319", "#484e59", "grid", 0.75),
  texture("glass-clear", "Clear glass", "Utility", "#5ea2bc", "#d7f7ff", "grid", 0.12),
  texture("glass-pink", "Pink glass", "Utility", "#8d3976", "#ff9ce9", "grid", 0.12),
  texture("team-red", "Team red", "Utility", "#8d2039", "#ff416c", "panel"),
  texture("team-blue", "Team blue", "Utility", "#125b8b", "#22bdf5", "panel"),
  texture("bouncecore", "Bouncecore brand", "Utility", "#111421", "#00d5ff", "circuit", 0.35),
  texture("void", "Void black", "Utility", "#05050a", "#31374c", "noise")
];

export const coreLevelShapeCatalog: Array<{
  description: string;
  displayName: string;
  shape: CoreLevelShape;
}> = [
  { description: "Resizable structural cuboid.", displayName: "Block", shape: "block" },
  { description: "Rounded terrain or decorative volume.", displayName: "Sphere", shape: "sphere" },
  { description: "Pillar, tank, column, or circular platform.", displayName: "Cylinder", shape: "cylinder" },
  { description: "Walkable sloped wedge.", displayName: "Ramp", shape: "ramp" },
  { description: "Six-step modular staircase.", displayName: "Stairs", shape: "stairs" },
  { description: "Two supports with a clear opening.", displayName: "Arch", shape: "arch" }
];

export const coreLevelEntityCatalog: Array<{
  description: string;
  displayName: string;
  entityKind: CoreLevelEntityKind;
}> = [
  { description: "Neutral or team player entry point.", displayName: "Player spawn", entityKind: "player-spawn" },
  { description: "Red or blue Capture the Flag objective.", displayName: "Team flag", entityKind: "flag" },
  { description: "Restores player health.", displayName: "Health", entityKind: "health" },
  { description: "Green armour pickup.", displayName: "Green armour", entityKind: "armour-green" },
  { description: "Yellow armour pickup.", displayName: "Yellow armour", entityKind: "armour-yellow" },
  { description: "Rocket ammunition pickup.", displayName: "Rockets", entityKind: "rockets" },
  { description: "Grenade ammunition pickup.", displayName: "Grenades", entityKind: "grenades" },
  { description: "Bullet ammunition pickup.", displayName: "Bullets", entityKind: "bullets" },
  { description: "Shotgun ammunition pickup.", displayName: "Shells", entityKind: "shotgun-shells" },
  { description: "Rifle ammunition pickup.", displayName: "Rifle rounds", entityKind: "rifle-rounds" },
  { description: "Temporary damage power-up.", displayName: "Quad damage", entityKind: "quad" },
  { description: "Local point light with colour and radius.", displayName: "Light", entityKind: "light" },
  { description: "Teleporter entrance sharing a numeric tag.", displayName: "Teleporter", entityKind: "teleporter" },
  { description: "Teleporter exit sharing a numeric tag.", displayName: "Teleport exit", entityKind: "teleporter-destination" }
];

function cleanText(value: unknown, fallback: string, maximum: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, maximum);
}

export function normalizeCoreLevelSlug(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  const slug = text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug ? `bc-${slug.replace(/^bc-/, "")}` : "bc-untitled-arena";
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeVector(value: unknown, fallback: CoreLevelVector3, scale = false): CoreLevelVector3 {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const minimum = scale ? 0.25 : -4_096;
  const maximum = scale ? 1_024 : 4_096;

  return {
    x: clamp(finiteNumber(record.x, fallback.x), minimum, maximum),
    y: clamp(finiteNumber(record.y, fallback.y), minimum, maximum),
    z: clamp(finiteNumber(record.z, fallback.z), minimum, maximum)
  };
}

function objectId(value: unknown, index: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9_-]{4,80}$/.test(text) ? text : `object-${index + 1}`;
}

function validShape(value: unknown): CoreLevelShape {
  return coreLevelShapeCatalog.some((entry) => entry.shape === value) ? (value as CoreLevelShape) : "block";
}

function validEntityKind(value: unknown): CoreLevelEntityKind {
  return coreLevelEntityCatalog.some((entry) => entry.entityKind === value)
    ? (value as CoreLevelEntityKind)
    : "player-spawn";
}

function normalizeObject(value: unknown, index: number): CoreLevelObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind: CoreLevelObjectKind = record.kind === "entity" ? "entity" : "geometry";
  const transformRecord =
    record.transform && typeof record.transform === "object" && !Array.isArray(record.transform)
      ? (record.transform as Record<string, unknown>)
      : {};
  const propertiesRecord =
    record.properties && typeof record.properties === "object" && !Array.isArray(record.properties)
      ? (record.properties as Record<string, unknown>)
      : {};
  const materialId =
    typeof record.materialId === "string" && coreLevelTextureCatalog.some((entry) => entry.id === record.materialId)
      ? record.materialId
      : "stone-grey";
  const teamNumber = Math.round(finiteNumber(propertiesRecord.team, 0));
  const team: CoreLevelTeam = teamNumber === 1 || teamNumber === 2 ? teamNumber : 0;

  return {
    ...(kind === "entity"
      ? { entityKind: validEntityKind(record.entityKind) }
      : { materialId, shape: validShape(record.shape) }),
    id: objectId(record.id, index),
    kind,
    label: cleanText(record.label, kind === "entity" ? "Game object" : "Geometry", 64),
    properties: {
      angle: clamp(Math.round(finiteNumber(propertiesRecord.angle, 0)), 0, 359),
      blue: clamp(Math.round(finiteNumber(propertiesRecord.blue, 255)), 0, 255),
      green: clamp(Math.round(finiteNumber(propertiesRecord.green, 255)), 0, 255),
      radius: clamp(Math.round(finiteNumber(propertiesRecord.radius, 192)), 16, 1_024),
      red: clamp(Math.round(finiteNumber(propertiesRecord.red, 255)), 0, 255),
      tag: clamp(Math.round(finiteNumber(propertiesRecord.tag, 0)), 0, 999),
      team
    },
    transform: {
      position: normalizeVector(transformRecord.position, { x: 256, y: 256, z: 64 }),
      rotation: normalizeVector(transformRecord.rotation, { x: 0, y: 0, z: 0 }),
      scale: normalizeVector(transformRecord.scale, { x: 64, y: 64, z: 64 }, true)
    }
  };
}

export function normalizeCoreLevelDocument(value: unknown): CoreLevelDocument {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const name = cleanText(record.name, "Untitled arena", 60);
  const requestedWorldSize = Math.round(finiteNumber(record.worldSize, 1024));
  const worldSize = coreLevelWorldSizes.includes(requestedWorldSize as never)
    ? (requestedWorldSize as CoreLevelDocument["worldSize"])
    : 1024;
  const requestedGridSize = Math.round(finiteNumber(record.gridSize, 16));
  const gridSize = coreLevelGridSizes.includes(requestedGridSize as never)
    ? (requestedGridSize as CoreLevelDocument["gridSize"])
    : 16;
  const modes = Array.isArray(record.modes)
    ? [...new Set(record.modes.filter((mode): mode is CoreLevelMode => ["ffa", "teamplay", "ctf"].includes(String(mode))))]
    : [];
  const rawObjects = Array.isArray(record.objects) ? record.objects : [];
  const objects = rawObjects
    .slice(0, coreLevelMaximumObjects)
    .map(normalizeObject)
    .filter((object): object is CoreLevelObject => Boolean(object));
  const ids = new Set<string>();

  for (const object of objects) {
    if (ids.has(object.id)) {
      object.id = `${object.id}-${ids.size + 1}`;
    }
    ids.add(object.id);
  }

  return {
    ambient: clamp(Math.round(finiteNumber(record.ambient, 96)), 0, 255),
    description: cleanText(record.description, "A custom Bouncecore Core arena.", 500),
    fog: clamp(Math.round(finiteNumber(record.fog, 1_800)), 128, 16_384),
    fogColor: /^#[0-9a-f]{6}$/i.test(String(record.fogColor ?? "")) ? String(record.fogColor).toLowerCase() : "#6aa8d6",
    gridSize,
    modes: modes.length ? modes : ["ffa", "teamplay", "ctf"],
    name,
    objects,
    schemaVersion: coreLevelSchemaVersion,
    skyColor: /^#[0-9a-f]{6}$/i.test(String(record.skyColor ?? "")) ? String(record.skyColor).toLowerCase() : "#68b2ea",
    slug: normalizeCoreLevelSlug(record.slug ?? name),
    worldSize
  };
}

export function createCoreLevelObject(
  kind: CoreLevelObjectKind,
  subtype: CoreLevelShape | CoreLevelEntityKind,
  sequence = Date.now()
): CoreLevelObject {
  const id = `level-object-${sequence}-${Math.random().toString(36).slice(2, 8)}`;

  if (kind === "entity") {
    const entry = coreLevelEntityCatalog.find((candidate) => candidate.entityKind === subtype) ?? coreLevelEntityCatalog[0];
    const team: CoreLevelTeam = subtype === "flag" ? 1 : 0;

    return normalizeObject(
      {
        entityKind: entry.entityKind,
        id,
        kind,
        label: entry.displayName,
        properties: { angle: 0, blue: 255, green: 255, radius: 192, red: 255, tag: 0, team },
        transform: {
          position: { x: 512, y: 512, z: 192 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 24, y: 24, z: 24 }
        }
      },
      0
    )!;
  }

  const entry = coreLevelShapeCatalog.find((candidate) => candidate.shape === subtype) ?? coreLevelShapeCatalog[0];
  return normalizeObject(
    {
      id,
      kind,
      label: entry.displayName,
      materialId: "stone-grey",
      shape: entry.shape,
      transform: {
        position: { x: 512, y: 512, z: entry.shape === "sphere" ? 64 : 32 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: entry.shape === "block" ? { x: 128, y: 128, z: 64 } : { x: 96, y: 96, z: 96 }
      }
    },
    0
  )!;
}

export function createEmptyCoreLevelDocument(name = "New arena"): CoreLevelDocument {
  const floor = createCoreLevelObject("geometry", "block", 1);
  floor.id = "starter-floor";
  floor.label = "Arena floor";
  floor.materialId = "grass-lush";
  floor.transform = {
    position: { x: 512, y: 512, z: 32 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 768, y: 768, z: 64 }
  };

  return normalizeCoreLevelDocument({
    ambient: 96,
    description: "A custom Bouncecore Core arena.",
    fog: 1_800,
    fogColor: "#6aa8d6",
    gridSize: 16,
    modes: ["ffa", "teamplay", "ctf"],
    name,
    objects: [floor],
    schemaVersion: coreLevelSchemaVersion,
    skyColor: "#68b2ea",
    slug: name,
    worldSize: 1024
  });
}

export function validateCoreLevelDocument(value: unknown): CoreLevelValidationResult {
  const document = normalizeCoreLevelDocument(value);
  const issues: CoreLevelValidationIssue[] = [];
  const stats = {
    entities: 0,
    geometry: 0,
    lights: 0,
    playerSpawns: 0,
    redFlags: 0,
    redSpawns: 0,
    blueFlags: 0,
    blueSpawns: 0,
    total: document.objects.length
  };

  if (!document.objects.length) {
    issues.push({ code: "empty-level", message: "Add geometry before publishing.", severity: "error" });
  }

  for (const object of document.objects) {
    const { position, scale } = object.transform;

    if (
      position.x - scale.x / 2 < 0 ||
      position.y - scale.y / 2 < 0 ||
      position.z - scale.z / 2 < 0 ||
      position.x + scale.x / 2 > document.worldSize ||
      position.y + scale.y / 2 > document.worldSize ||
      position.z + scale.z / 2 > document.worldSize
    ) {
      issues.push({
        code: "object-out-of-bounds",
        message: `${object.label} extends outside the ${document.worldSize}-unit world.`,
        objectId: object.id,
        severity: "error"
      });
    }

    if (object.kind === "geometry") {
      stats.geometry++;
      const { rotation } = object.transform;
      const quarterTurn = Math.PI / 2;
      const isQuarterTurn = (angle: number) =>
        Math.abs(angle / quarterTurn - Math.round(angle / quarterTurn)) < 0.001;
      if (
        Math.abs(rotation.x) > 0.001 ||
        Math.abs(rotation.y) > 0.001 ||
        !isQuarterTurn(rotation.z)
      ) {
        issues.push({
          code: "unsupported-geometry-rotation",
          message: `${object.label} must use a 90-degree Z rotation and zero X/Y rotation for Core voxel compilation.`,
          objectId: object.id,
          severity: "error"
        });
      }
      continue;
    }

    stats.entities++;
    const team = object.properties?.team ?? 0;
    if (object.entityKind === "player-spawn") {
      stats.playerSpawns++;
      if (team === 1) stats.redSpawns++;
      if (team === 2) stats.blueSpawns++;
    }
    if (object.entityKind === "flag") {
      if (team === 1) stats.redFlags++;
      if (team === 2) stats.blueFlags++;
    }
    if (object.entityKind === "light") {
      stats.lights++;
    }
  }

  if (stats.geometry > 1_500) {
    issues.push({
      code: "geometry-budget",
      message: "Keep geometry below 1,500 objects for stable browser and Core performance.",
      severity: "error"
    });
  } else if (stats.geometry > 1_000) {
    issues.push({
      code: "geometry-warning",
      message: "This arena is approaching the recommended geometry budget.",
      severity: "warning"
    });
  }

  if (stats.playerSpawns < 4) {
    issues.push({
      code: "spawn-count",
      message: "Add at least four player spawns so matches can start reliably.",
      severity: "error"
    });
  }

  if (document.modes.includes("teamplay") && (stats.redSpawns < 2 || stats.blueSpawns < 2)) {
    issues.push({
      code: "team-spawns",
      message: "Team Deathmatch needs at least two red and two blue spawns.",
      severity: "error"
    });
  }

  if (document.modes.includes("ctf")) {
    if (stats.redFlags !== 1 || stats.blueFlags !== 1) {
      issues.push({
        code: "ctf-flags",
        message: "Capture the Flag needs exactly one red flag and one blue flag.",
        severity: "error"
      });
    }
    if (stats.redSpawns < 2 || stats.blueSpawns < 2) {
      issues.push({
        code: "ctf-spawns",
        message: "Capture the Flag needs at least two red and two blue spawns.",
        severity: "error"
      });
    }
  }

  if (!stats.lights) {
    issues.push({
      code: "lighting",
      message: "Add at least one light so the compiled arena is readable.",
      severity: "warning"
    });
  }

  return {
    issues,
    stats,
    valid: !issues.some((issue) => issue.severity === "error")
  };
}

export function snapCoreLevelValue(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}
