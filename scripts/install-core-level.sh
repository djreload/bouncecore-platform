#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_ROOT/.env.instance"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
DEFINITION=""
FORCE=false
NO_REBUILD=false

info() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: sudo scripts/install-core-level.sh --definition FILE_OR_URL [options]

Options:
  --definition VALUE   Published level.json file or HTTPS URL. Required.
  --env-file PATH      Compose environment file. Default: .env.instance.
  --compose-file PATH  Compose file. Default: docker-compose.instance.yml.
  --no-rebuild         Validate and stage the level without rebuilding Core.
  --force              Permit a Core restart while a lobby is active.
  -h, --help           Show this help.

The script validates the immutable builder bundle, stages it in the Core runtime
build context, and rebuilds only the isolated Core services. It refuses to
restart while a lobby is waiting or active unless --force is explicitly used.
USAGE
}

resolve_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$APP_ROOT" "$1" ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --definition)
      [ "$#" -ge 2 ] || die "--definition requires a file or URL."
      DEFINITION="$2"
      shift 2
      ;;
    --env-file)
      [ "$#" -ge 2 ] || die "--env-file requires a path."
      ENV_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --compose-file)
      [ "$#" -ge 2 ] || die "--compose-file requires a path."
      COMPOSE_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --no-rebuild)
      NO_REBUILD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[ -n "$DEFINITION" ] || die "--definition is required."
[ -f "$ENV_FILE" ] || die "Environment file not found: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || die "Compose file not found: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "Docker is required."
command -v node >/dev/null 2>&1 || die "Node.js is required for bundle validation."

TEMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT

case "$DEFINITION" in
  https://*)
    command -v curl >/dev/null 2>&1 || die "curl is required for an HTTPS definition URL."
    curl --fail --location --retry 3 --silent --show-error "$DEFINITION" --output "$TEMP_FILE"
    ;;
  http://*)
    die "Level definitions must use HTTPS."
    ;;
  *)
    SOURCE_PATH="$(resolve_path "$DEFINITION")"
    [ -f "$SOURCE_PATH" ] || die "Level definition not found: $SOURCE_PATH"
    cp "$SOURCE_PATH" "$TEMP_FILE"
    ;;
esac

MAP_ID="$(
  node - "$TEMP_FILE" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
const document = bundle && bundle.document;
const map = bundle && bundle.map;
if (!document || !map || !/^bc-[a-z0-9-]{1,51}$/.test(String(map.id || ""))) {
  throw new Error("The file is not a safe published Bouncecore Core level bundle.");
}
if (![512, 1024, 2048].includes(Number(document.worldSize))) {
  throw new Error("The level uses an unsupported world size.");
}
if (![4, 8, 16, 32, 64].includes(Number(document.gridSize))) {
  throw new Error("The level uses an unsupported grid size.");
}
if (!Array.isArray(document.objects) || document.objects.length > 2000) {
  throw new Error("The level object collection is invalid.");
}
const spawns = document.objects.filter((object) => object?.kind === "entity" && object?.entityKind === "player-spawn");
if (spawns.length < 4) {
  throw new Error("The level needs at least four player spawns.");
}
process.stdout.write(map.id);
NODE
)" || die "Published level validation failed."

TARGET_DIRECTORY="$APP_ROOT/services/core-fps/runtime/published-levels"
TARGET_FILE="$TARGET_DIRECTORY/$MAP_ID.json"
mkdir -p "$TARGET_DIRECTORY"
if [ -f "$TARGET_FILE" ]; then
  cp "$TARGET_FILE" "$TARGET_FILE.previous"
fi
install -m 0644 "$TEMP_FILE" "$TARGET_FILE"
info "Staged $MAP_ID at $TARGET_FILE"

if [ "$NO_REBUILD" = true ]; then
  info "Level staged. Re-run without --no-rebuild during the maintenance window."
  exit 0
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile core-fps "$@"
}

if [ "$FORCE" != true ]; then
  active_lobbies="$(
    compose exec -T postgres sh -lc \
      'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM \"CoreFpsLobby\" WHERE status IN ('"'"'waiting'"'"','"'"'active'"'"');"' \
      2>/dev/null || printf 'unknown'
  )"
  case "$active_lobbies" in
    0) ;;
    unknown) die "Could not verify active Core lobbies. Retry after checking the database, or use --force deliberately." ;;
    *) die "$active_lobbies Core lobby/lobbies are waiting or active. Install after those matches finish." ;;
  esac
fi

info "Building the isolated Core runtime with $MAP_ID"
compose build core-fps
info "Restarting Core runtime and reconnecting its gateway services"
compose up -d --no-deps core-fps
compose up -d core-fps-telemetry core-fps-gateway

container_id="$(compose ps -q core-fps)"
[ -n "$container_id" ] || die "Core container was not created."
for _ in $(seq 1 40); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  if [ "$health" = "healthy" ]; then
    info "$MAP_ID is installed and the Core runtime is healthy."
    exit 0
  fi
  if [ "$health" = "unhealthy" ] || [ "$health" = "exited" ]; then
    compose logs --tail=100 core-fps >&2
    die "Core did not become healthy after installing $MAP_ID."
  fi
  sleep 3
done

compose logs --tail=100 core-fps >&2
die "Timed out waiting for the Core runtime health check."
