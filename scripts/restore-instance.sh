#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="$APP_ROOT/.env.instance"
BACKUP_DIR=""
YES=false
SKIP_DB=false
SKIP_VOLUMES=false
START_APP=true

info() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf '\nWARNING: %s\n' "$1" >&2
}

die() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: scripts/restore-instance.sh BACKUP_DIR [options]

Options:
  --env-file PATH       Environment file to use. Default: .env.instance
  --compose-file PATH   Compose file to use. Default: docker-compose.instance.yml
  --yes                 Skip the typed RESTORE confirmation.
  --skip-db             Do not restore the PostgreSQL dump.
  --skip-volumes        Do not restore Docker volume archives.
  --skip-start          Do not start postgres, redis, and app after restore.
  -h, --help            Show this help.
USAGE
}

resolve_path() {
  local value="$1"

  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$APP_ROOT" "$value" ;;
  esac
}

env_value() {
  local key="$1"
  local default_value="$2"
  local line
  local value

  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"

  if [ -z "$line" ]; then
    printf '%s' "$default_value"
    return
  fi

  value="${line#*=}"
  value="${value%$'\r'}"

  case "$value" in
    \"*\")
      value="${value#\"}"
      value="${value%\"}"
      ;;
    \'*\')
      value="${value#\'}"
      value="${value%\'}"
      ;;
  esac

  printf '%s' "$value"
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

wait_for_postgres() {
  for _ in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return
    fi

    sleep 2
  done

  die "PostgreSQL did not become ready in time."
}

wait_for_app() {
  local host="$1"
  local port="$2"
  local health_url="http://$host:$port/api/health"

  if ! command -v curl >/dev/null 2>&1; then
    warn "curl is not installed; skipping app health check."
    return
  fi

  info "Waiting for app health at $health_url"

  for _ in $(seq 1 60); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      return
    fi

    sleep 2
  done

  warn "App health check did not pass in time. Inspect logs with docker compose logs app."
}

confirm_restore() {
  local value

  if [ "$YES" = "true" ]; then
    return
  fi

  warn "This restore stops Bouncecore services, replaces the database contents, and replaces selected Docker volumes."
  read -r -p "Type RESTORE to continue: " value

  if [ "$value" != "RESTORE" ]; then
    die "Restore cancelled."
  fi
}

restore_database() {
  local dump_file="$BACKUP_DIR/postgres.dump"

  if [ ! -f "$dump_file" ]; then
    warn "Skipping database restore because $dump_file does not exist."
    return
  fi

  info "Restoring PostgreSQL database $POSTGRES_DB"
  compose up -d postgres >/dev/null
  wait_for_postgres
  compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl < "$dump_file"
}

restore_volume() {
  local label="$1"
  local volume="$2"
  local archive="$3"
  local archive_path="$BACKUP_DIR/$archive"

  if [ ! -f "$archive_path" ]; then
    warn "Skipping $label volume restore because $archive_path does not exist."
    return
  fi

  info "Restoring $label volume $volume"
  docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
  docker run --rm -v "$volume:/volume" -v "$BACKUP_DIR:/backup:ro" alpine:3.20 sh -c "find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} \\; && tar -xzf /backup/$archive -C /volume"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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
    --yes)
      YES=true
      shift
      ;;
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --skip-volumes)
      SKIP_VOLUMES=true
      shift
      ;;
    --skip-start)
      START_APP=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$BACKUP_DIR" ]; then
        die "Unexpected argument: $1"
      fi

      BACKUP_DIR="$(resolve_path "$1")"
      shift
      ;;
  esac
done

[ -n "$BACKUP_DIR" ] || die "Backup directory is required."
[ -d "$BACKUP_DIR" ] || die "Backup directory does not exist: $BACKUP_DIR"
[ -f "$COMPOSE_FILE" ] || die "Missing Compose file: $COMPOSE_FILE"
[ -f "$ENV_FILE" ] || die "Missing environment file: $ENV_FILE"
command -v docker >/dev/null 2>&1 || die "Docker is required."
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is required."

POSTGRES_DB="$(env_value POSTGRES_DB bouncecore_platform)"
POSTGRES_USER="$(env_value POSTGRES_USER bouncecore_app)"
UPLOADS_VOLUME="$(env_value UPLOADS_VOLUME bouncecore_uploads)"
REDIS_VOLUME="$(env_value REDIS_VOLUME bouncecore_redis_data)"
STREAM_CORE_VOLUME="$(env_value STREAM_CORE_VOLUME bouncecore_stream_core_data)"
TRANSCODER_HLS_VOLUME="$(env_value TRANSCODER_HLS_VOLUME bouncecore_transcoder_hls)"
APP_BIND_HOST="$(env_value APP_BIND_HOST 127.0.0.1)"
APP_PORT="$(env_value APP_PORT 3000)"

if [ "$APP_BIND_HOST" = "0.0.0.0" ]; then
  APP_BIND_HOST="127.0.0.1"
fi

confirm_restore

info "Stopping services that use restored data"
compose stop app worker stream-core media-gateway hls-origin media-transcoder redis >/dev/null 2>&1 || true

if [ "$SKIP_DB" = "false" ]; then
  restore_database
else
  warn "PostgreSQL restore skipped."
fi

if [ "$SKIP_VOLUMES" = "false" ]; then
  restore_volume "uploads" "$UPLOADS_VOLUME" "volumes/uploads.tar.gz"
  restore_volume "Redis" "$REDIS_VOLUME" "volumes/redis.tar.gz"
  restore_volume "stream-core state" "$STREAM_CORE_VOLUME" "volumes/stream-core.tar.gz"
  restore_volume "transcoder HLS" "$TRANSCODER_HLS_VOLUME" "volumes/transcoder-hls.tar.gz"
else
  warn "Docker volume restore skipped."
fi

if [ "$START_APP" = "true" ]; then
  info "Starting base services"
  compose up -d postgres redis app
  wait_for_app "$APP_BIND_HOST" "$APP_PORT"
else
  warn "Service start skipped."
fi

info "Restore complete"
