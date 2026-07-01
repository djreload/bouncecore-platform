#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="$APP_ROOT/.env.instance"
BACKUP_ROOT="$APP_ROOT/backups"
RETENTION_DAYS=0
SKIP_DB=false
SKIP_VOLUMES=false
SKIP_STATUS_VOLUME=false
STATUS_VOLUME_PATH=".ops/backup-status.env"
OFFSITE_STATUS_VOLUME_PATH=".ops/offsite-backup-status.env"
OFFSITE_CONFIG_VOLUME_PATH=".ops/offsite-backup-config.env"
OFFSITE_RCLONE_CONFIG_VOLUME_PATH=".ops/google-drive-rclone.conf"
VERIFY_BACKUP=true
OFFSITE_DESTINATION_TYPE="rclone"
OFFSITE_AGE_RECIPIENT=""
OFFSITE_AGE_RECIPIENT_FILE=""
OFFSITE_OUTPUT_DIR=""
OFFSITE_RCLONE_REMOTE=""
OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=false
OFFSITE_CONFIG_FILE=""
OFFSITE_ARGS_PROVIDED=false
SKIP_OFFSITE_CONFIG=false
OFFSITE_TEMP_RCLONE_CONFIG_DIR=""

cleanup_temp_rclone_config() {
  if [ -n "$OFFSITE_TEMP_RCLONE_CONFIG_DIR" ] && [ -d "$OFFSITE_TEMP_RCLONE_CONFIG_DIR" ]; then
    rm -rf "$OFFSITE_TEMP_RCLONE_CONFIG_DIR"
  fi
}

trap cleanup_temp_rclone_config EXIT

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
  --retention-days N    Delete dated backup folders older than N days after a successful backup. Default: disabled
  --status-volume-path PATH
                        Path inside the uploads Docker volume for latest backup status. Default: .ops/backup-status.env
  --offsite-status-volume-path PATH
                        Path inside the uploads Docker volume for latest off-server export status. Default: .ops/offsite-backup-status.env
  --offsite-config-volume-path PATH
                        Path inside the uploads Docker volume for admin-managed offsite config. Default: .ops/offsite-backup-config.env
  --offsite-rclone-config-volume-path PATH
                        Path inside the uploads Docker volume for app-generated rclone config. Default: .ops/google-drive-rclone.conf
  --offsite-config-file PATH
                        Host-side offsite config file to load when explicit offsite flags are not supplied.
  --skip-offsite-config
                        Do not load admin-managed offsite backup settings.
  --skip-db             Do not create a PostgreSQL dump.
  --skip-volumes        Do not archive Docker volumes.
  --skip-status-volume  Do not copy latest backup status into the uploads Docker volume.
  --skip-verify         Do not verify the completed backup artifacts.
  --offsite-age-recipient KEY
                        age public recipient key for encrypted off-server export.
  --offsite-age-recipient-file PATH
                        File containing age public recipient keys for encrypted export.
  --offsite-output-dir PATH
                        Local encrypted export directory. Default: BACKUP_ROOT/offsite.
  --offsite-rclone-remote REMOTE
                        Optional rclone destination directory for encrypted exports.
  --offsite-remove-local-after-upload
                        Delete local encrypted export files after successful rclone upload.
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

file_value() {
  local file="$1"
  local key="$2"
  local default_value="$3"
  local line

  if [ ! -f "$file" ]; then
    printf '%s' "$default_value"
    return
  fi

  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"

  if [ -z "$line" ]; then
    printf '%s' "$default_value"
    return
  fi

  printf '%s' "${line#*=}"
}

validate_volume_path() {
  local label="$1"
  local value="$2"

  case "$value" in
    *[!A-Za-z0-9._/-]*) die "$label supports only letters, numbers, dot, underscore, dash, and slash." ;;
    *..*) die "$label cannot contain '..'." ;;
    "") die "$label cannot be empty." ;;
  esac
}

validate_offsite_options() {
  case "$OFFSITE_DESTINATION_TYPE" in
    rclone|google-drive) ;;
    *) die "OFFSITE_DESTINATION_TYPE must be rclone or google-drive." ;;
  esac

  if [ -n "$OFFSITE_AGE_RECIPIENT" ] && [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
    die "Use either --offsite-age-recipient or --offsite-age-recipient-file, not both."
  fi

  if [ "$OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD" = "true" ] && [ -z "$OFFSITE_RCLONE_REMOTE" ]; then
    die "--offsite-remove-local-after-upload requires --offsite-rclone-remote."
  fi

  if [ "$OFFSITE_DESTINATION_TYPE" = "google-drive" ] && [ -n "$OFFSITE_RCLONE_REMOTE" ]; then
    validate_volume_path "OFFSITE_RCLONE_CONFIG_VOLUME_PATH" "$OFFSITE_RCLONE_CONFIG_VOLUME_PATH"
  fi
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

is_service_running() {
  local service="$1"
  compose ps --services --status running 2>/dev/null | grep -qx "$service"
}

resolve_docker_volume_name() {
  local configured_name="$1"
  local candidate

  if docker volume inspect "$configured_name" >/dev/null 2>&1; then
    printf '%s' "$configured_name"
    return
  fi

  while IFS= read -r candidate; do
    if [ "$candidate" = "$configured_name" ] || [ "${candidate%"_$configured_name"}" != "$candidate" ]; then
      printf '%s' "$candidate"
      return
    fi
  done < <(docker volume ls --format '{{.Name}}')

  printf '%s' "$configured_name"
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

verify_backup() {
  VERIFY_EXIT_CODE=0

  if [ "$VERIFY_BACKUP" = "false" ]; then
    warn "Backup verification skipped."
    VERIFICATION_STATUS="warning"
    VERIFICATION_FAILURES=0
    VERIFICATION_WARNINGS=1
    return
  fi

  info "Verifying backup artifacts"
  if ! bash "$APP_ROOT/scripts/verify-backup-instance.sh" "$BACKUP_DIR"; then
    VERIFY_EXIT_CODE=1
  fi

  VERIFICATION_STATUS="$(file_value "$BACKUP_DIR/verification.env" status failed)"
  VERIFICATION_FAILURES="$(file_value "$BACKUP_DIR/verification.env" failures 1)"
  VERIFICATION_WARNINGS="$(file_value "$BACKUP_DIR/verification.env" warnings 0)"
}

prune_old_backups() {
  if [ "$RETENTION_DAYS" = "0" ]; then
    return
  fi

  info "Pruning local backup folders older than $RETENTION_DAYS days"
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '????????T??????Z' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
}

write_latest_backup_status() {
  local created_at="$1"
  local status_file="$BACKUP_ROOT/latest-backup.env"

  {
    printf 'status=%s\n' "$VERIFICATION_STATUS"
    printf 'created_at=%s\n' "$created_at"
    printf 'verified_at=%s\n' "$(file_value "$BACKUP_DIR/verification.env" verified_at "$created_at")"
    printf 'backup_dir=%s\n' "$BACKUP_DIR"
    printf 'backup_root=%s\n' "$BACKUP_ROOT"
    printf 'git_commit=%s\n' "$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
    printf 'failures=%s\n' "$VERIFICATION_FAILURES"
    printf 'warnings=%s\n' "$VERIFICATION_WARNINGS"
    printf 'skip_db=%s\n' "$SKIP_DB"
    printf 'skip_volumes=%s\n' "$SKIP_VOLUMES"
  } > "$status_file"

  chmod 600 "$status_file"
  printf 'Latest backup status: %s\n' "$status_file"
}

copy_status_to_uploads_volume() {
  local status_file="$BACKUP_ROOT/latest-backup.env"
  local target_path="$STATUS_VOLUME_PATH"
  local target_dir
  local target_name

  if [ "$SKIP_STATUS_VOLUME" = "true" ]; then
    warn "Upload-volume backup status copy skipped."
    return
  fi

  if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
    warn "Upload-volume backup status copy skipped because Docker volume $UPLOADS_VOLUME does not exist."
    return
  fi

  target_path="${target_path#/}"
  target_dir="$(dirname "$target_path")"
  target_name="$(basename "$target_path")"

  info "Writing latest backup status to uploads volume $UPLOADS_VOLUME:$target_path"
  docker run --rm -v "$UPLOADS_VOLUME:/uploads" -v "$status_file:/status.env:ro" alpine:3.20 sh -c "mkdir -p \"/uploads/$target_dir\" && chown 1001:65534 \"/uploads/$target_dir\" && chmod 775 \"/uploads/$target_dir\" && cp /status.env \"/uploads/$target_dir/$target_name\" && chmod 644 \"/uploads/$target_dir/$target_name\""
}

copy_offsite_status_to_uploads_volume() {
  local status_file="$BACKUP_ROOT/latest-offsite-backup.env"
  local target_path="$OFFSITE_STATUS_VOLUME_PATH"
  local target_dir
  local target_name

  if [ "$SKIP_STATUS_VOLUME" = "true" ]; then
    warn "Upload-volume offsite backup status copy skipped."
    return
  fi

  if [ ! -f "$status_file" ]; then
    warn "Upload-volume offsite backup status copy skipped because $status_file does not exist."
    return
  fi

  if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
    warn "Upload-volume offsite backup status copy skipped because Docker volume $UPLOADS_VOLUME does not exist."
    return
  fi

  target_path="${target_path#/}"
  target_dir="$(dirname "$target_path")"
  target_name="$(basename "$target_path")"

  info "Writing latest offsite backup status to uploads volume $UPLOADS_VOLUME:$target_path"
  docker run --rm -v "$UPLOADS_VOLUME:/uploads" -v "$status_file:/status.env:ro" alpine:3.20 sh -c "mkdir -p \"/uploads/$target_dir\" && chown 1001:65534 \"/uploads/$target_dir\" && chmod 775 \"/uploads/$target_dir\" && cp /status.env \"/uploads/$target_dir/$target_name\" && chmod 644 \"/uploads/$target_dir/$target_name\""
}

load_offsite_config_values() {
  local config_file="$1"
  local enabled
  local recipient
  local recipient_file
  local output_dir
  local rclone_remote
  local rclone_config_volume_path
  local remove_local
  local destination_type

  enabled="$(file_value "$config_file" OFFSITE_ENABLED false)"
  enabled="${enabled,,}"

  case "$enabled" in
    true|1|yes|on) ;;
    *)
      warn "Admin-managed offsite backup export is disabled in $config_file."
      return
      ;;
  esac

  destination_type="$(file_value "$config_file" OFFSITE_DESTINATION_TYPE rclone)"
  destination_type="${destination_type,,}"
  recipient="$(file_value "$config_file" OFFSITE_AGE_RECIPIENT "")"
  recipient_file="$(file_value "$config_file" OFFSITE_AGE_RECIPIENT_FILE "")"
  output_dir="$(file_value "$config_file" OFFSITE_OUTPUT_DIR "")"
  rclone_remote="$(file_value "$config_file" OFFSITE_RCLONE_REMOTE "")"
  rclone_config_volume_path="$(file_value "$config_file" OFFSITE_RCLONE_CONFIG_VOLUME_PATH "$OFFSITE_RCLONE_CONFIG_VOLUME_PATH")"
  remove_local="$(file_value "$config_file" OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD false)"
  remove_local="${remove_local,,}"

  case "$destination_type" in
    rclone|google-drive) OFFSITE_DESTINATION_TYPE="$destination_type" ;;
    *) die "Unsupported OFFSITE_DESTINATION_TYPE in $config_file." ;;
  esac

  if [ -n "$recipient" ]; then
    OFFSITE_AGE_RECIPIENT="$recipient"
  fi

  if [ -n "$recipient_file" ]; then
    OFFSITE_AGE_RECIPIENT_FILE="$(resolve_path "$recipient_file")"
  fi

  if [ -n "$output_dir" ]; then
    OFFSITE_OUTPUT_DIR="$(resolve_path "$output_dir")"
  fi

  if [ -n "$rclone_remote" ]; then
    OFFSITE_RCLONE_REMOTE="$rclone_remote"
  fi

  if [ -n "$rclone_config_volume_path" ]; then
    OFFSITE_RCLONE_CONFIG_VOLUME_PATH="$rclone_config_volume_path"
  fi

  case "$remove_local" in
    true|1|yes|on) OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=true ;;
    *) OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=false ;;
  esac

  info "Loaded admin-managed offsite backup config from $config_file"
}

load_offsite_config_from_uploads_volume() {
  local target_path="${OFFSITE_CONFIG_VOLUME_PATH#/}"
  local temp_dir

  if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
    warn "Admin-managed offsite backup config skipped because Docker volume $UPLOADS_VOLUME does not exist."
    return
  fi

  temp_dir="$(mktemp -d)"
  docker run --rm -v "$UPLOADS_VOLUME:/uploads:ro" -v "$temp_dir:/config" alpine:3.20 sh -c "if [ -f \"/uploads/$target_path\" ]; then cp \"/uploads/$target_path\" /config/offsite.env; fi"

  if [ -f "$temp_dir/offsite.env" ]; then
    load_offsite_config_values "$temp_dir/offsite.env"
  else
    warn "No admin-managed offsite backup config found at uploads volume path $OFFSITE_CONFIG_VOLUME_PATH."
  fi

  rm -rf "$temp_dir"
}

load_offsite_config() {
  if [ "$SKIP_OFFSITE_CONFIG" = "true" ] || [ "$OFFSITE_ARGS_PROVIDED" = "true" ]; then
    return
  fi

  if [ -n "$OFFSITE_CONFIG_FILE" ]; then
    if [ -f "$OFFSITE_CONFIG_FILE" ]; then
      load_offsite_config_values "$OFFSITE_CONFIG_FILE"
    else
      warn "Offsite backup config file not found: $OFFSITE_CONFIG_FILE"
    fi
    return
  fi

  load_offsite_config_from_uploads_volume
}

prepare_google_drive_rclone_config() {
  local target_path
  local temp_dir

  if [ "$OFFSITE_DESTINATION_TYPE" != "google-drive" ] || [ -z "$OFFSITE_RCLONE_REMOTE" ]; then
    return
  fi

  if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
    die "Google Drive rclone config cannot be loaded because Docker volume $UPLOADS_VOLUME does not exist."
  fi

  target_path="${OFFSITE_RCLONE_CONFIG_VOLUME_PATH#/}"
  temp_dir="$(mktemp -d)"
  docker run --rm -v "$UPLOADS_VOLUME:/uploads:ro" -v "$temp_dir:/config" alpine:3.20 sh -c "if [ -f \"/uploads/$target_path\" ]; then cp \"/uploads/$target_path\" /config/rclone.conf; fi"

  if [ ! -s "$temp_dir/rclone.conf" ]; then
    rm -rf "$temp_dir"
    die "Google Drive rclone config not found at uploads volume path $OFFSITE_RCLONE_CONFIG_VOLUME_PATH. Connect Google Drive in Admin -> Storage first."
  fi

  chmod 600 "$temp_dir/rclone.conf"
  OFFSITE_TEMP_RCLONE_CONFIG_DIR="$temp_dir"
  export RCLONE_CONFIG="$temp_dir/rclone.conf"

  info "Loaded Google Drive rclone config from uploads volume path $OFFSITE_RCLONE_CONFIG_VOLUME_PATH"
}

export_offsite_backup() {
  local -a args

  if [ -z "$OFFSITE_AGE_RECIPIENT" ] && [ -z "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
    return
  fi

  if [ "$VERIFICATION_STATUS" != "healthy" ]; then
    warn "Encrypted off-server export skipped because backup verification status is $VERIFICATION_STATUS."
    return
  fi

  args=("$APP_ROOT/scripts/export-backup-offsite.sh" "$BACKUP_DIR")
  args+=("--status-file" "$BACKUP_ROOT/latest-offsite-backup.env")

  if [ -n "$OFFSITE_AGE_RECIPIENT" ]; then
    args+=("--age-recipient" "$OFFSITE_AGE_RECIPIENT")
  fi

  if [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
    args+=("--age-recipient-file" "$OFFSITE_AGE_RECIPIENT_FILE")
  fi

  if [ -n "$OFFSITE_OUTPUT_DIR" ]; then
    args+=("--output-dir" "$OFFSITE_OUTPUT_DIR")
  fi

  if [ -n "$OFFSITE_RCLONE_REMOTE" ]; then
    args+=("--rclone-remote" "$OFFSITE_RCLONE_REMOTE")
  fi

  if [ "$OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD" = "true" ]; then
    args+=("--remove-local-after-upload")
  fi

  prepare_google_drive_rclone_config

  info "Creating encrypted off-server backup export"
  bash "${args[@]}"
  copy_offsite_status_to_uploads_volume
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
    --retention-days)
      [ "$#" -ge 2 ] || die "--retention-days requires a number."
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --status-volume-path)
      [ "$#" -ge 2 ] || die "--status-volume-path requires a path."
      STATUS_VOLUME_PATH="$2"
      shift 2
      ;;
    --offsite-status-volume-path)
      [ "$#" -ge 2 ] || die "--offsite-status-volume-path requires a path."
      OFFSITE_STATUS_VOLUME_PATH="$2"
      shift 2
      ;;
    --offsite-config-volume-path)
      [ "$#" -ge 2 ] || die "--offsite-config-volume-path requires a path."
      OFFSITE_CONFIG_VOLUME_PATH="$2"
      shift 2
      ;;
    --offsite-rclone-config-volume-path)
      [ "$#" -ge 2 ] || die "--offsite-rclone-config-volume-path requires a path."
      OFFSITE_RCLONE_CONFIG_VOLUME_PATH="$2"
      shift 2
      ;;
    --offsite-config-file)
      [ "$#" -ge 2 ] || die "--offsite-config-file requires a path."
      OFFSITE_CONFIG_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --skip-offsite-config)
      SKIP_OFFSITE_CONFIG=true
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
    --skip-status-volume)
      SKIP_STATUS_VOLUME=true
      shift
      ;;
    --skip-verify)
      VERIFY_BACKUP=false
      shift
      ;;
    --offsite-age-recipient)
      [ "$#" -ge 2 ] || die "--offsite-age-recipient requires a key."
      OFFSITE_AGE_RECIPIENT="$2"
      OFFSITE_ARGS_PROVIDED=true
      shift 2
      ;;
    --offsite-age-recipient-file)
      [ "$#" -ge 2 ] || die "--offsite-age-recipient-file requires a path."
      OFFSITE_AGE_RECIPIENT_FILE="$(resolve_path "$2")"
      OFFSITE_ARGS_PROVIDED=true
      shift 2
      ;;
    --offsite-output-dir)
      [ "$#" -ge 2 ] || die "--offsite-output-dir requires a path."
      OFFSITE_OUTPUT_DIR="$(resolve_path "$2")"
      OFFSITE_ARGS_PROVIDED=true
      shift 2
      ;;
    --offsite-rclone-remote)
      [ "$#" -ge 2 ] || die "--offsite-rclone-remote requires a destination."
      OFFSITE_RCLONE_REMOTE="$2"
      OFFSITE_ARGS_PROVIDED=true
      shift 2
      ;;
    --offsite-remove-local-after-upload)
      OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=true
      OFFSITE_ARGS_PROVIDED=true
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
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "--retention-days must be a non-negative integer."
validate_offsite_options
validate_volume_path "--status-volume-path" "$STATUS_VOLUME_PATH"
validate_volume_path "--offsite-status-volume-path" "$OFFSITE_STATUS_VOLUME_PATH"
validate_volume_path "--offsite-config-volume-path" "$OFFSITE_CONFIG_VOLUME_PATH"
validate_volume_path "--offsite-rclone-config-volume-path" "$OFFSITE_RCLONE_CONFIG_VOLUME_PATH"

POSTGRES_DB="$(env_value POSTGRES_DB bouncecore_platform)"
POSTGRES_USER="$(env_value POSTGRES_USER bouncecore_app)"
UPLOADS_VOLUME="$(env_value UPLOADS_VOLUME bouncecore_uploads)"
REDIS_VOLUME="$(env_value REDIS_VOLUME bouncecore_redis_data)"
STREAM_CORE_VOLUME="$(env_value STREAM_CORE_VOLUME bouncecore_stream_core_data)"
TRANSCODER_HLS_VOLUME="$(env_value TRANSCODER_HLS_VOLUME bouncecore_transcoder_hls)"

UPLOADS_VOLUME="$(resolve_docker_volume_name "$UPLOADS_VOLUME")"
REDIS_VOLUME="$(resolve_docker_volume_name "$REDIS_VOLUME")"
STREAM_CORE_VOLUME="$(resolve_docker_volume_name "$STREAM_CORE_VOLUME")"
TRANSCODER_HLS_VOLUME="$(resolve_docker_volume_name "$TRANSCODER_HLS_VOLUME")"

load_offsite_config
validate_offsite_options
validate_volume_path "--offsite-rclone-config-volume-path" "$OFFSITE_RCLONE_CONFIG_VOLUME_PATH"

mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
BACKUP_DIR="$BACKUP_ROOT/$(date -u +"%Y%m%dT%H%M%SZ")"
mkdir -p "$BACKUP_DIR/volumes"
chmod 700 "$BACKUP_DIR"

CREATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

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
  printf 'created_at=%s\n' "$CREATED_AT"
  printf 'git_commit=%s\n' "$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  printf 'compose_file=%s\n' "$COMPOSE_FILE"
  printf 'env_file=%s\n' "$ENV_FILE"
  printf 'postgres_db=%s\n' "$POSTGRES_DB"
  printf 'postgres_user=%s\n' "$POSTGRES_USER"
  printf 'uploads_volume=%s\n' "$UPLOADS_VOLUME"
  printf 'redis_volume=%s\n' "$REDIS_VOLUME"
  printf 'stream_core_volume=%s\n' "$STREAM_CORE_VOLUME"
  printf 'transcoder_hls_volume=%s\n' "$TRANSCODER_HLS_VOLUME"
  printf 'skip_db=%s\n' "$SKIP_DB"
  printf 'skip_volumes=%s\n' "$SKIP_VOLUMES"
} > "$BACKUP_DIR/manifest.env"

verify_backup
write_latest_backup_status "$CREATED_AT"
copy_status_to_uploads_volume

if [ "$VERIFY_EXIT_CODE" -ne 0 ]; then
  die "Backup verification failed. Inspect $BACKUP_DIR/verification.env"
fi

export_offsite_backup
prune_old_backups

info "Backup complete"
printf 'Backup directory: %s\n' "$BACKUP_DIR"
