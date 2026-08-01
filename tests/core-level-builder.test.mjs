import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  coreLevelTextureCatalog,
  createCoreLevelObject,
  createEmptyCoreLevelDocument,
  normalizeCoreLevelDocument,
  validateCoreLevelDocument
} from "../src/lib/games/core-level-builder-core.ts";

function validFfaDocument() {
  const document = createEmptyCoreLevelDocument("Test arena");
  document.modes = ["ffa"];

  for (let index = 0; index < 4; index++) {
    const spawn = createCoreLevelObject("entity", "player-spawn", index + 10);
    spawn.transform.position = {
      x: 192 + index * 128,
      y: index % 2 ? 640 : 384,
      z: 96
    };
    document.objects.push(spawn);
  }

  const light = createCoreLevelObject("entity", "light", 30);
  light.transform.position = { x: 512, y: 512, z: 384 };
  document.objects.push(light);
  return document;
}

test("Core level builder ships a large unique texture catalog", () => {
  assert.equal(coreLevelTextureCatalog.length, 48);
  assert.equal(new Set(coreLevelTextureCatalog.map((texture) => texture.id)).size, 48);
  assert.ok(new Set(coreLevelTextureCatalog.map((texture) => texture.category)).size >= 5);
});

test("Core level validation accepts a playable Free For All arena", () => {
  const result = validateCoreLevelDocument(validFfaDocument());

  assert.equal(result.valid, true);
  assert.equal(result.stats.playerSpawns, 4);
  assert.equal(result.stats.geometry, 1);
  assert.equal(result.stats.lights, 1);
});

test("Core level validation rejects geometry the voxel compiler cannot represent", () => {
  const document = validFfaDocument();
  document.objects[0].transform.rotation.x = Math.PI / 4;

  const result = validateCoreLevelDocument(document);

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some((issue) => issue.code === "unsupported-geometry-rotation")
  );
});

test("Core level validation requires balanced team spawns and flags for CTF", () => {
  const document = validFfaDocument();
  document.modes = ["ctf"];
  const missingResult = validateCoreLevelDocument(document);
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.issues.some((issue) => issue.code === "ctf-flags"));
  assert.ok(missingResult.issues.some((issue) => issue.code === "ctf-spawns"));

  const spawns = document.objects.filter(
    (object) => object.kind === "entity" && object.entityKind === "player-spawn"
  );
  spawns.forEach((spawn, index) => {
    spawn.properties = { ...spawn.properties, team: index < 2 ? 1 : 2 };
  });
  for (const team of [1, 2]) {
    const flag = createCoreLevelObject("entity", "flag", 100 + team);
    flag.properties = { ...flag.properties, team };
    flag.transform.position = {
      x: team === 1 ? 192 : 832,
      y: 512,
      z: 96
    };
    document.objects.push(flag);
  }

  const result = validateCoreLevelDocument(document);
  assert.equal(result.valid, true);
  assert.equal(result.stats.redFlags, 1);
  assert.equal(result.stats.blueFlags, 1);
});

test("Core level documents normalize unsafe names, slugs, and object values", () => {
  const document = normalizeCoreLevelDocument({
    gridSize: 7,
    name: "  My <> Arena  ",
    objects: [
      {
        id: "../../bad",
        kind: "geometry",
        materialId: "not-a-texture",
        shape: "not-a-shape",
        transform: {
          position: { x: Number.POSITIVE_INFINITY, y: 20, z: 20 },
          scale: { x: -10, y: 10, z: 10 }
        }
      }
    ],
    slug: "../../my arena",
    worldSize: 999
  });

  assert.equal(document.gridSize, 16);
  assert.equal(document.worldSize, 1024);
  assert.equal(document.slug, "bc-my-arena");
  assert.equal(document.objects[0].shape, "block");
  assert.equal(document.objects[0].materialId, "stone-grey");
  assert.ok(document.objects[0].transform.scale.x >= 0.25);
});

test("Core level publication is permission protected and has a guarded install pipeline", async () => {
  const [
    routeSource,
    serviceSource,
    pageSource,
    navigationSource,
    uploadRouteSource,
    runtimeDockerfile,
    installerSource
  ] = await Promise.all([
    readFile(new URL("../src/app/api/admin/core-fps/levels/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/games/core-level-builder-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/core-fps/level-builder/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/config/navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/uploads/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/core-fps/runtime/Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../scripts/install-core-level.sh", import.meta.url), "utf8")
  ]);

  assert.match(routeSource, /getApiUserWithPermission\("settings\.manage"\)/);
  assert.match(pageSource, /requireUserPermission\("settings\.manage"\)/);
  assert.match(serviceSource, /validateCoreLevelDocument/);
  assert.match(serviceSource, /publishedDefinitionUrl/);
  assert.doesNotMatch(serviceSource, /docker|child_process/i);
  assert.match(navigationSource, /Core Level Builder/);
  assert.match(uploadRouteSource, /"core-levels"/);
  assert.match(uploadRouteSource, /application\/json/);
  assert.match(runtimeDockerfile, /cmd\/published-levels/);
  assert.match(runtimeDockerfile, /install_published_levels\.py/);
  assert.match(installerSource, /CoreFpsLobby/);
  assert.match(installerSource, /--no-rebuild/);
});
