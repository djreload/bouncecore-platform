#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR=""
KEEP=false
POSTGRES_IMAGE="postgres:18-alpine"
ALPINE_IMAGE="alpine:3.20"
DRILL_ID="bouncecore-restore-drill-$(date -u +"%Y%m%d%H%M%S")-$$"
POSTGRES_PASSWORD="restore-drill-password"

info() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

die() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: scripts/restore-drill.sh BACKUP_DIR [options]

Options:
  --keep                Keep temporary Docker containers, network, and volumes for inspection.
  --postgres-image IMG  PostgreSQL image used for the temporary restore. Default: postgres:18-alpine.
  --alpine-image IMG    Alpine image used for volume extraction. Default: alpine:3.20.
  -h, --help            Show this help.

The restore drill is non-destructive. It restores the PostgreSQL dump and Docker
volume archives into temporary Docker resources, writes restore-drill.env inside
the backup folder, and removes temporary resources unless --keep is used.
USAGE
}

resolve_path() {
  local value="$1"

  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$APP_ROOT" "$value" ;;
  esac
}

manifest_value() {
  local key="$1"
  local default_value="$2"
  local manifest="$BACKUP_DIR/manifest.env"
  local line

  if [ ! -f "$manifest" ]; then
    printf '%s' "$default_value"
    return
  fi

  line="$(grep -E "^${key}=" "$manifest" | tail -n 1 || true)"

  if [ -z "$line" ]; then
    printf '%s' "$default_value"
    return
  fi

  printf '%s' "${line#*=}"
}

cleanup() {
  rm -f "${VOLUME_STATUS_FILE:-}" >/dev/null 2>&1 || true

  if [ "$KEEP" = "true" ]; then
    warn "Keeping restore drill resources with prefix $DRILL_ID."
    return
  fi

  docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true

  for volume in "${TEMP_VOLUMES[@]}"; do
    docker volume rm "$volume" >/dev/null 2>&1 || true
  done
}

wait_for_postgres() {
  for _ in $(seq 1 60); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return
    fi

    sleep 2
  done

  return 1
}

restore_database_drill() {
  local dump_file="$BACKUP_DIR/postgres.dump"

  if [ "$SKIP_DB" = "true" ]; then
    warn "Database restore drill skipped because manifest records skip_db=true."
    DB_STATUS="skipped"
    DB_TABLES="0"
    return
  fi

  if [ ! -s "$dump_file" ]; then
    warn "Database restore drill failed because postgres.dump is missing or empty."
    DB_STATUS="failed"
    FAILURES=$((FAILURES + 1))
    return
  fi

  info "Restoring PostgreSQL dump into temporary container"
  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    --network "$NETWORK_NAME" \
    -e "POSTGRES_DB=$POSTGRES_DB" \
    -e "POSTGRES_USER=$POSTGRES_USER" \
    -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
    -v "$POSTGRES_VOLUME:/var/lib/postgresql/data" \
    "$POSTGRES_IMAGE" >/dev/null

  if ! wait_for_postgres; then
    warn "Temporary PostgreSQL did not become ready."
    DB_STATUS="failed"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if ! docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl < "$dump_file"; then
    warn "pg_restore failed inside the temporary PostgreSQL container."
    DB_STATUS="failed"
    FAILURES=$((FAILURES + 1))
    return
  fi

  DB_TABLES="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from information_schema.tables where table_schema = 'public';" 2>/dev/null || printf '0')"
  DB_STATUS="healthy"
}

restore_volume_drill() {
  local label="$1"
  local archive="$2"
  local volume="$3"
  local key="$4"
  local archive_path="$BACKUP_DIR/$archive"
  local file_count

  if [ "$SKIP_VOLUMES" = "true" ]; then
    warn "$label restore drill skipped because manifest records skip_volumes=true."
    printf '%s_status=skipped\n' "$key" >> "$VOLUME_STATUS_FILE"
    printf '%s_files=0\n' "$key" >> "$VOLUME_STATUS_FILE"
    return
  fi

  if [ ! -s "$archive_path" ]; then
    warn "$label restore drill failed because $archive_path is missing or empty."
    printf '%s_status=failed\n' "$key" >> "$VOLUME_STATUS_FILE"
    printf '%s_files=0\n' "$key" >> "$VOLUME_STATUS_FILE"
    FAILURES=$((FAILURES + 1))
    return
  fi

  info "Extracting $label archive into temporary volume"
  docker run --rm -v "$volume:/volume" -v "$BACKUP_DIR:/backup:ro" "$ALPINE_IMAGE" sh -c "tar -xzf \"/backup/$archive\" -C /volume"
  file_count="$(docker run --rm -v "$volume:/volume:ro" "$ALPINE_IMAGE" sh -c "find /volume -type f | wc -l" | tr -d '[:space:]')"

  printf '%s_status=healthy\n' "$key" >> "$VOLUME_STATUS_FILE"
  printf '%s_files=%s\n' "$key" "${file_count:-0}" >> "$VOLUME_STATUS_FILE"
}

write_report() {
  local report="$BACKUP_DIR/restore-drill.env"
  local status="healthy"

  if [ "$FAILURES" -gt 0 ]; then
    status="failed"
  elif [ "$SKIP_DB" = "true" ] || [ "$SKIP_VOLUMES" = "true" ]; then
    status="warning"
  fi

  {
    printf 'drilled_at=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf 'status=%s\n' "$status"
    printf 'failures=%s\n' "$FAILURES"
    printf 'backup_dir=%s\n' "$BACKUP_DIR"
    printf 'drill_id=%s\n' "$DRILL_ID"
    printf 'database_status=%s\n' "$DB_STATUS"
    printf 'database_tables=%s\n' "$DB_TABLES"
    cat "$VOLUME_STATUS_FILE"
  } > "$report"

  printf 'Restore drill report: %s\n' "$report"

  if [ "$FAILURES" -gt 0 ]; then
    return 1
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep)
      KEEP=true
      shift
      ;;
    --postgres-image)
      [ "$#" -ge 2 ] || die "--postgres-image requires an image."
      POSTGRES_IMAGE="$2"
      shift 2
      ;;
    --alpine-image)
      [ "$#" -ge 2 ] || die "--alpine-image requires an image."
      ALPINE_IMAGE="$2"
      shift 2
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
[ -f "$BACKUP_DIR/manifest.env" ] || die "Backup manifest does not exist: $BACKUP_DIR/manifest.env"
command -v docker >/dev/null 2>&1 || die "Docker is required."

POSTGRES_DB="$(manifest_value postgres_db bouncecore_platform)"
POSTGRES_USER="$(manifest_value postgres_user bouncecore_app)"
SKIP_DB="$(manifest_value skip_db false)"
SKIP_VOLUMES="$(manifest_value skip_volumes false)"
NETWORK_NAME="$DRILL_ID-network"
POSTGRES_CONTAINER="$DRILL_ID-postgres"
POSTGRES_VOLUME="$DRILL_ID-postgres-data"
UPLOADS_VOLUME="$DRILL_ID-uploads"
REDIS_VOLUME="$DRILL_ID-redis"
STREAM_CORE_VOLUME="$DRILL_ID-stream-core"
TRANSCODER_HLS_VOLUME="$DRILL_ID-transcoder-hls"
TEMP_VOLUMES=("$POSTGRES_VOLUME" "$UPLOADS_VOLUME" "$REDIS_VOLUME" "$STREAM_CORE_VOLUME" "$TRANSCODER_HLS_VOLUME")
VOLUME_STATUS_FILE="$(mktemp)"
FAILURES=0
DB_STATUS="pending"
DB_TABLES="0"

trap cleanup EXIT
docker network create "$NETWORK_NAME" >/dev/null

for volume in "${TEMP_VOLUMES[@]}"; do
  docker volume create "$volume" >/dev/null
done

: > "$VOLUME_STATUS_FILE"

info "Running non-destructive restore drill for $BACKUP_DIR"
restore_database_drill
restore_volume_drill "uploads" "volumes/uploads.tar.gz" "$UPLOADS_VOLUME" "uploads"
restore_volume_drill "Redis" "volumes/redis.tar.gz" "$REDIS_VOLUME" "redis"
restore_volume_drill "stream-core state" "volumes/stream-core.tar.gz" "$STREAM_CORE_VOLUME" "stream_core"
restore_volume_drill "transcoder HLS" "volumes/transcoder-hls.tar.gz" "$TRANSCODER_HLS_VOLUME" "transcoder_hls"

info "Writing restore drill report"
write_report
