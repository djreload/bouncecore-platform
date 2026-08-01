# Core Level Builder

Bouncecore includes a desktop-first 3D level editor for the isolated
`djreload/core` Cube 2 game service.

## Open the editor

Sign in with an account that has `settings.manage`, then open:

```text
/admin/core-fps/level-builder
```

The editor requires a desktop-sized browser, WebGL, a mouse, and a keyboard.
It deliberately does not initialise the 3D renderer on narrow/mobile screens.

## Build

- Add blocks, spheres, cylinders, ramps, stairs, and arches from **Build**.
- Add player spawns, red/blue flags, health, armour, ammunition, quad damage,
  lights, and linked teleporters from **Gameplay**.
- Apply any of the 48 original materials from **Textures**.
- Use `W`, `E`, and `R` for move, rotate, and resize.
- Use the hierarchy or click an object to select it.
- Use the inspector for exact position, rotation, size, team, light, and
  teleporter values.
- Use **Export** and **Import** for portable editable JSON backups.

Geometry uses the selected Cube grid. Rotations are limited to 90-degree
Z-axis turns because the production compiler emits deterministic voxel
geometry rather than arbitrary browser-only meshes.

## Validate and publish

The status strip reports blocking errors and warnings. A publishable arena
requires:

- all geometry inside the world bounds;
- at least four player spawns;
- at least two red and two blue spawns when a team mode is enabled;
- exactly one red and one blue flag when Capture the Flag is enabled; and
- no more than 1,500 geometry objects.

**Save** stores an editable draft. **Publish** repeats validation on the server,
captures a 1280x720 preview, and writes an immutable versioned bundle below:

```text
public/uploads/core-levels/<map-id>/v<version>/level.json
public/uploads/core-levels/<map-id>/v<version>/preview.webp
```

The web app never receives Docker or host privileges.

## Install into Core

Download **Published bundle** from the editor and run this on the Bouncecore
host during a maintenance window:

```bash
sudo scripts/install-core-level.sh \
  --definition /path/to/level.json \
  --env-file .env.instance \
  --compose-file docker-compose.instance.yml
```

An HTTPS bundle URL is also supported:

```bash
sudo scripts/install-core-level.sh \
  --definition https://bouncecore.example/uploads/core-levels/bc-arena/v1/level.json
```

The installer:

1. validates the bundle and stages it under
   `services/core-fps/runtime/published-levels`;
2. refuses to restart while a Core lobby is waiting or active;
3. compiles the document into an OGZ map;
4. installs the map config, preview, and texture assets into the Sour index;
5. adds the map to compatible FFA, Team Deathmatch, and CTF runtime presets;
6. rebuilds only the isolated Core runtime; and
7. waits for the Core health check.

Use `--no-rebuild` to stage a level for a later maintenance window. Use
`--force` only for a deliberate emergency restart because it can interrupt
active players.

Published files are immutable. Editing a published project returns it to draft;
publishing again creates the next version.

## Regenerate the texture pack

The texture generator writes matching browser and runtime copies:

```bash
node scripts/generate-core-level-textures.mjs
```

Commit both generated directories:

```text
public/games/core/builder/textures
services/core-fps/runtime/level-textures
```
