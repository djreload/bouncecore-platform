#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_ROOT/.env.instance"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
BACKUP_ROOT="/srv/bouncecore-backups"
RETENTION_DAYS=14
ON_CALENDAR="*-*-* 03:15:00"
SERVICE_NAME="bouncecore-backup"
APP_ROOT_CHANGED=false
ENV_FILE_EXPLICIT=false
COMPOSE_FILE_EXPLICIT=false
OFFSITE_AGE_RECIPIENT=""
OFFSITE_AGE_RECIPIENT_FILE=""
OFFSITE_OUTPUT_DIR=""
OFFSITE_RCLONE_REMOTE=""
OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=false

info() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: sudo scripts/install-backup-schedule.sh [options]

Options:
  --app-root PATH       Bouncecore checkout path. Default: current repo root.
  --env-file PATH       Environment file to use. Default: .env.instance.
  --compose-file PATH   Compose file to use. Default: docker-compose.instance.yml.
  --backup-root PATH    Directory that receives dated backup folders. Default: /srv/bouncecore-backups.
  --retention-days N    Delete local dated backup folders older than N days. Default: 14.
  --on-calendar VALUE   systemd OnCalendar value. Default: *-*-* 03:15:00.
  --service-name NAME   systemd unit prefix. Default: bouncecore-backup.
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

The installed timer runs backup-instance.sh with verification enabled. Keep an
off-server encrypted copy as well; local retention is not disaster recovery.
USAGE
}

resolve_path() {
  local value="$1"

  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$APP_ROOT" "$value" ;;
  esac
}

validate_plain_value() {
  local label="$1"
  local value="$2"

  case "$value" in
    *"'"*) die "$label cannot contain single quotes." ;;
  esac
}

append_backup_arg() {
  local flag="$1"
  local value="$2"

  BACKUP_COMMAND="$BACKUP_COMMAND $flag \"$value\""
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root)
      [ "$#" -ge 2 ] || die "--app-root requires a path."
      APP_ROOT="$(resolve_path "$2")"
      APP_ROOT_CHANGED=true
      shift 2
      ;;
    --env-file)
      [ "$#" -ge 2 ] || die "--env-file requires a path."
      ENV_FILE="$(resolve_path "$2")"
      ENV_FILE_EXPLICIT=true
      shift 2
      ;;
    --compose-file)
      [ "$#" -ge 2 ] || die "--compose-file requires a path."
      COMPOSE_FILE="$(resolve_path "$2")"
      COMPOSE_FILE_EXPLICIT=true
      shift 2
      ;;
    --backup-root)
      [ "$#" -ge 2 ] || die "--backup-root requires a path."
      BACKUP_ROOT="$2"
      shift 2
      ;;
    --retention-days)
      [ "$#" -ge 2 ] || die "--retention-days requires a number."
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --on-calendar)
      [ "$#" -ge 2 ] || die "--on-calendar requires a value."
      ON_CALENDAR="$2"
      shift 2
      ;;
    --service-name)
      [ "$#" -ge 2 ] || die "--service-name requires a value."
      SERVICE_NAME="$2"
      shift 2
      ;;
    --offsite-age-recipient)
      [ "$#" -ge 2 ] || die "--offsite-age-recipient requires a key."
      OFFSITE_AGE_RECIPIENT="$2"
      shift 2
      ;;
    --offsite-age-recipient-file)
      [ "$#" -ge 2 ] || die "--offsite-age-recipient-file requires a path."
      OFFSITE_AGE_RECIPIENT_FILE="$2"
      shift 2
      ;;
    --offsite-output-dir)
      [ "$#" -ge 2 ] || die "--offsite-output-dir requires a path."
      OFFSITE_OUTPUT_DIR="$2"
      shift 2
      ;;
    --offsite-rclone-remote)
      [ "$#" -ge 2 ] || die "--offsite-rclone-remote requires a destination."
      OFFSITE_RCLONE_REMOTE="$2"
      shift 2
      ;;
    --offsite-remove-local-after-upload)
      OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD=true
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

[ "$(id -u)" -eq 0 ] || die "Run this installer with sudo or as root."
command -v systemctl >/dev/null 2>&1 || die "systemd is required."
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "--retention-days must be a non-negative integer."
[[ "$SERVICE_NAME" =~ ^[A-Za-z0-9_.@-]+$ ]] || die "--service-name contains unsupported characters."

APP_ROOT="$(cd "$APP_ROOT" && pwd)"

if [ "$APP_ROOT_CHANGED" = "true" ] && [ "$ENV_FILE_EXPLICIT" = "false" ]; then
  ENV_FILE="$APP_ROOT/.env.instance"
fi

if [ "$APP_ROOT_CHANGED" = "true" ] && [ "$COMPOSE_FILE_EXPLICIT" = "false" ]; then
  COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
fi

ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
BACKUP_ROOT="$(resolve_path "$BACKUP_ROOT")"
if [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
  OFFSITE_AGE_RECIPIENT_FILE="$(resolve_path "$OFFSITE_AGE_RECIPIENT_FILE")"
fi
if [ -n "$OFFSITE_OUTPUT_DIR" ]; then
  OFFSITE_OUTPUT_DIR="$(resolve_path "$OFFSITE_OUTPUT_DIR")"
fi

[ -f "$APP_ROOT/scripts/backup-instance.sh" ] || die "Missing backup script under $APP_ROOT."
[ -f "$ENV_FILE" ] || die "Missing environment file: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || die "Missing Compose file: $COMPOSE_FILE"
if [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ] && [ ! -f "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
  die "Missing offsite recipient file: $OFFSITE_AGE_RECIPIENT_FILE"
fi
if [ -n "$OFFSITE_AGE_RECIPIENT" ] && [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
  die "Use either --offsite-age-recipient or --offsite-age-recipient-file, not both."
fi
if [ "$OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD" = "true" ] && [ -z "$OFFSITE_RCLONE_REMOTE" ]; then
  die "--offsite-remove-local-after-upload requires --offsite-rclone-remote."
fi

validate_plain_value "APP_ROOT" "$APP_ROOT"
validate_plain_value "ENV_FILE" "$ENV_FILE"
validate_plain_value "COMPOSE_FILE" "$COMPOSE_FILE"
validate_plain_value "BACKUP_ROOT" "$BACKUP_ROOT"
validate_plain_value "ON_CALENDAR" "$ON_CALENDAR"
validate_plain_value "OFFSITE_AGE_RECIPIENT" "$OFFSITE_AGE_RECIPIENT"
validate_plain_value "OFFSITE_AGE_RECIPIENT_FILE" "$OFFSITE_AGE_RECIPIENT_FILE"
validate_plain_value "OFFSITE_OUTPUT_DIR" "$OFFSITE_OUTPUT_DIR"
validate_plain_value "OFFSITE_RCLONE_REMOTE" "$OFFSITE_RCLONE_REMOTE"

BACKUP_COMMAND="bash scripts/backup-instance.sh --env-file \"$ENV_FILE\" --compose-file \"$COMPOSE_FILE\" --backup-root \"$BACKUP_ROOT\" --retention-days \"$RETENTION_DAYS\""

if [ -n "$OFFSITE_AGE_RECIPIENT" ]; then
  append_backup_arg "--offsite-age-recipient" "$OFFSITE_AGE_RECIPIENT"
fi

if [ -n "$OFFSITE_AGE_RECIPIENT_FILE" ]; then
  append_backup_arg "--offsite-age-recipient-file" "$OFFSITE_AGE_RECIPIENT_FILE"
fi

if [ -n "$OFFSITE_OUTPUT_DIR" ]; then
  append_backup_arg "--offsite-output-dir" "$OFFSITE_OUTPUT_DIR"
fi

if [ -n "$OFFSITE_RCLONE_REMOTE" ]; then
  append_backup_arg "--offsite-rclone-remote" "$OFFSITE_RCLONE_REMOTE"
fi

if [ "$OFFSITE_REMOVE_LOCAL_AFTER_UPLOAD" = "true" ]; then
  BACKUP_COMMAND="$BACKUP_COMMAND --offsite-remove-local-after-upload"
fi

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

service_path="/etc/systemd/system/${SERVICE_NAME}.service"
timer_path="/etc/systemd/system/${SERVICE_NAME}.timer"

info "Writing $service_path"
cat > "$service_path" <<SERVICE
[Unit]
Description=Bouncecore instance backup
Wants=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_ROOT
ExecStart=/usr/bin/env bash -lc '$BACKUP_COMMAND'
SERVICE

info "Writing $timer_path"
cat > "$timer_path" <<TIMER
[Unit]
Description=Run Bouncecore instance backups

[Timer]
OnCalendar=$ON_CALENDAR
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
TIMER

info "Enabling ${SERVICE_NAME}.timer"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"

info "Backup schedule installed"
systemctl list-timers "${SERVICE_NAME}.timer" --no-pager
