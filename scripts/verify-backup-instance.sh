#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$APP_ROOT/backups"
BACKUP_DIR=""
LATEST=false

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
Usage: scripts/verify-backup-instance.sh BACKUP_DIR [options]

Options:
  --backup-root PATH    Backup root used with --latest. Default: backups
  --latest              Verify the newest dated backup folder under --backup-root.
  -h, --help            Show this help.

The verifier checks the backup manifest, PostgreSQL custom dump readability,
and every expected Docker volume tar archive. It writes verification.env inside
the backup folder and exits non-zero when required backup artifacts are broken.
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

newest_backup_dir() {
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '????????T??????Z' -printf '%f\n' 2>/dev/null | sort | tail -n 1
}

check_file() {
  local label="$1"
  local file="$2"

  if [ ! -s "$file" ]; then
    warn "$label is missing or empty: $file"
    return 1
  fi

  printf 'OK: %s exists\n' "$label"
  return 0
}

verify_tar_archive() {
  local label="$1"
  local archive="$2"

  if ! check_file "$label archive" "$archive"; then
    return 1
  fi

  if ! tar -tzf "$archive" >/dev/null; then
    warn "$label archive cannot be read by tar: $archive"
    return 1
  fi

  printf 'OK: %s archive opens\n' "$label"
  return 0
}

verify_postgres_dump() {
  local dump="$BACKUP_DIR/postgres.dump"

  if ! check_file "PostgreSQL dump" "$dump"; then
    return 1
  fi

  if command -v pg_restore >/dev/null 2>&1; then
    if pg_restore --list "$dump" >/dev/null; then
      printf 'OK: PostgreSQL dump is readable by local pg_restore\n'
      return 0
    fi

    warn "PostgreSQL dump failed local pg_restore --list."
    return 1
  fi

  if command -v docker >/dev/null 2>&1; then
    if docker run --rm -v "$BACKUP_DIR:/backup:ro" postgres:18-alpine pg_restore --list /backup/postgres.dump >/dev/null; then
      printf 'OK: PostgreSQL dump is readable by container pg_restore\n'
      return 0
    fi

    warn "PostgreSQL dump failed container pg_restore --list."
    return 1
  fi

  warn "Neither pg_restore nor Docker is available; PostgreSQL dump readability could not be verified."
  return 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backup-root)
      [ "$#" -ge 2 ] || die "--backup-root requires a path."
      BACKUP_ROOT="$(resolve_path "$2")"
      shift 2
      ;;
    --latest)
      LATEST=true
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

if [ "$LATEST" = "true" ]; then
  [ -d "$BACKUP_ROOT" ] || die "Backup root does not exist: $BACKUP_ROOT"
  latest="$(newest_backup_dir)"
  [ -n "$latest" ] || die "No dated backup folders were found under $BACKUP_ROOT."
  BACKUP_DIR="$BACKUP_ROOT/$latest"
fi

[ -n "$BACKUP_DIR" ] || die "Backup directory is required."
[ -d "$BACKUP_DIR" ] || die "Backup directory does not exist: $BACKUP_DIR"

info "Verifying Bouncecore backup at $BACKUP_DIR"

failures=0
warnings=0

if ! check_file "Backup manifest" "$BACKUP_DIR/manifest.env"; then
  failures=$((failures + 1))
fi

skip_db="$(manifest_value skip_db false)"
skip_volumes="$(manifest_value skip_volumes false)"

if [ "$skip_db" = "true" ]; then
  warn "PostgreSQL verification skipped because manifest records skip_db=true."
  warnings=$((warnings + 1))
elif ! verify_postgres_dump; then
  failures=$((failures + 1))
fi

if [ "$skip_volumes" = "true" ]; then
  warn "Volume archive verification skipped because manifest records skip_volumes=true."
  warnings=$((warnings + 1))
else
  for item in \
    "uploads:volumes/uploads.tar.gz" \
    "Redis:volumes/redis.tar.gz" \
    "stream-core state:volumes/stream-core.tar.gz" \
    "transcoder HLS:volumes/transcoder-hls.tar.gz"; do
    label="${item%%:*}"
    archive="${item#*:}"

    if ! verify_tar_archive "$label" "$BACKUP_DIR/$archive"; then
      failures=$((failures + 1))
    fi
  done
fi

verified_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
status="healthy"

if [ "$failures" -gt 0 ]; then
  status="failed"
elif [ "$warnings" -gt 0 ]; then
  status="warning"
fi

{
  printf 'verified_at=%s\n' "$verified_at"
  printf 'status=%s\n' "$status"
  printf 'failures=%s\n' "$failures"
  printf 'warnings=%s\n' "$warnings"
  printf 'backup_dir=%s\n' "$BACKUP_DIR"
} > "$BACKUP_DIR/verification.env"

info "Backup verification: $status"
printf 'Verification report: %s\n' "$BACKUP_DIR/verification.env"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
