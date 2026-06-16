#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="$APP_ROOT/.env.instance"
BACKUP_ROOT="$APP_ROOT/backups"
SKIP_DB=false
SKIP_VOLUMES=false

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
Usage: scripts/backup-instance.sh [options]

Options:
  --env-file PATH       Environment file to use. Default: .env.instance
  --compose-file PATH   Compose file to use. Default: docker-compose.instance.yml
  --backup-root PATH    Directory that receives dated backup folders. Default: backups
  --skip-db             Do not create a PostgreSQL dump.
  --skip-volumes        Do not archive Docker volumes.
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

is_service_running() {
  local service="$1"
  compose ps --services --status running 2>/dev/null | grep -qx "$service"
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

backup_database() {
  local output="$BACKUP_DIR/postgres.dump"

  info "Backing up PostgreSQL database $POSTGRES_DB"
  compose up -d postgres >/dev/null
  wait_for_postgres
  compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl > "$output"
}

backup_volume() {
  local label="$1"
  local volume="$2"
  local archive="$3"

  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    warn "Skipping $label volume backup because Docker volume $volume does not exist."
    return
  fi

  info "Backing up $label volume $volume"
  docker run --rm -v "$volume:/volume:ro" -v "$BACKUP_DIR:/backup" alpine:3.20 sh -c "cd /volume && tar -czf /backup/$archive ."
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
    --backup-root)
      [ "$#" -ge 2 ] || die "--backup-root requires a path."
      BACKUP_ROOT="$(resolve_path "$2")"
      shift 2
      ;;
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --skip-volumes)
      SKIP_VOLUMES=true
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

mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
BACKUP_DIR="$BACKUP_ROOT/$(date -u +"%Y%m%dT%H%M%SZ")"
mkdir -p "$BACKUP_DIR/volumes"
chmod 700 "$BACKUP_DIR"

info "Creating Bouncecore backup at $BACKUP_DIR"

if [ "$SKIP_DB" = "false" ]; then
  backup_database
else
  warn "PostgreSQL dump skipped."
fi

if [ "$SKIP_VOLUMES" = "false" ]; then
  if is_service_running redis; then
    compose exec -T redis redis-cli BGSAVE >/dev/null 2>&1 || warn "Redis BGSAVE failed; continuing with volume archive."
  fi

  backup_volume "uploads" "$UPLOADS_VOLUME" "volumes/uploads.tar.gz"
  backup_volume "Redis" "$REDIS_VOLUME" "volumes/redis.tar.gz"
  backup_volume "stream-core state" "$STREAM_CORE_VOLUME" "volumes/stream-core.tar.gz"
  backup_volume "transcoder HLS" "$TRANSCODER_HLS_VOLUME" "volumes/transcoder-hls.tar.gz"
else
  warn "Docker volume archives skipped."
fi

{
  printf 'created_at=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf 'git_commit=%s\n' "$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  printf 'compose_file=%s\n' "$COMPOSE_FILE"
  printf 'env_file=%s\n' "$ENV_FILE"
  printf 'postgres_db=%s\n' "$POSTGRES_DB"
  printf 'postgres_user=%s\n' "$POSTGRES_USER"
  printf 'uploads_volume=%s\n' "$UPLOADS_VOLUME"
  printf 'redis_volume=%s\n' "$REDIS_VOLUME"
  printf 'stream_core_volume=%s\n' "$STREAM_CORE_VOLUME"
  printf 'transcoder_hls_volume=%s\n' "$TRANSCODER_HLS_VOLUME"
} > "$BACKUP_DIR/manifest.env"

info "Backup complete"
printf 'Backup directory: %s\n' "$BACKUP_DIR"
