#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_ROOT/.env.instance"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
BACKUP_ROOT="/srv/bouncecore-backups"
RETENTION_DAYS=14
ON_CALENDAR="*-*-* 03:15:00"
SERVICE_NAME="bouncecore-backup"
AGE_RECIPIENT=""
AGE_RECIPIENT_FILE=""
RCLONE_REMOTE=""
OFFSITE_OUTPUT_DIR=""
REMOVE_LOCAL_AFTER_UPLOAD=false
INSTALL_PACKAGES=false
SKIP_RCLONE_PROBE=false
RUN_NOW=false
DRY_RUN=false

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
Usage: sudo scripts/setup-offsite-backups.sh --age-recipient KEY --rclone-remote REMOTE [options]

Options:
  --app-root PATH       Bouncecore checkout path. Default: current repo root.
  --env-file PATH       Environment file. Default: APP_ROOT/.env.instance.
  --compose-file PATH   Compose file. Default: APP_ROOT/docker-compose.instance.yml.
  --backup-root PATH    Local backup root. Default: /srv/bouncecore-backups.
  --retention-days N    Delete local dated backup folders older than N days. Default: 14.
  --on-calendar VALUE   systemd OnCalendar value. Default: *-*-* 03:15:00.
  --service-name NAME   systemd unit prefix. Default: bouncecore-backup.
  --age-recipient KEY   age public recipient key, for example age1...
  --age-recipient-file PATH
                        File containing age public recipient keys.
  --rclone-remote REMOTE
                        rclone destination directory, for example r2:bouncecore-backups/prod.
  --offsite-output-dir PATH
                        Local encrypted export directory. Default: BACKUP_ROOT/offsite.
  --remove-local-after-upload
                        Delete local encrypted export files after successful rclone upload.
  --install-packages    Install age and rclone with apt-get when missing.
  --skip-rclone-probe   Do not perform the rclone upload/delete probe.
  --run-now             Start the backup service once after installing the timer.
  --dry-run             Validate and print the install command without changing systemd.
  -h, --help            Show this help.

This helper validates age/rclone prerequisites, proves the rclone destination can
accept and delete a small probe file, then installs the Bouncecore backup timer
with encrypted off-server export enabled.

Keep the private age identity key off this server. Pass only the public key here.
USAGE
}

resolve_path() {
  local value="$1"

  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$APP_ROOT" "$value" ;;
  esac
}

quote_arg() {
  printf '%q' "$1"
}

install_missing_packages() {
  local packages=()

  command -v age >/dev/null 2>&1 || packages+=("age")
  command -v rclone >/dev/null 2>&1 || packages+=("rclone")

  if [ "${#packages[@]}" -eq 0 ]; then
    return
  fi

  if [ "$INSTALL_PACKAGES" != "true" ]; then
    die "Missing required command(s): ${packages[*]}. Install them or rerun with --install-packages."
  fi

  command -v apt-get >/dev/null 2>&1 || die "--install-packages currently supports Debian/Ubuntu apt-get hosts."
  info "Installing ${packages[*]}"
  apt-get update -y
  apt-get install -y "${packages[@]}"
}

validate_rclone_remote() {
  local temp_file
  local probe_name

  if [ "$SKIP_RCLONE_PROBE" = "true" ]; then
    warn "Skipping rclone upload/delete probe."
    return
  fi

  temp_file="$(mktemp)"
  probe_name=".bouncecore-offsite-probe-$(date -u +"%Y%m%d%H%M%S")-$$.txt"

  {
    printf 'bouncecore offsite backup probe\n'
    printf 'created_at=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } > "$temp_file"

  info "Probing rclone destination $RCLONE_REMOTE"
  rclone mkdir "$RCLONE_REMOTE"
  rclone copyto "$temp_file" "$RCLONE_REMOTE/$probe_name"
  rclone deletefile "$RCLONE_REMOTE/$probe_name"
  rm -f "$temp_file"
}

print_install_command() {
  local arg

  printf 'Install command:'
  for arg in "${INSTALL_ARGS[@]}"; do
    printf ' %s' "$(quote_arg "$arg")"
  done
  printf '\n'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root)
      [ "$#" -ge 2 ] || die "--app-root requires a path."
      APP_ROOT="$(resolve_path "$2")"
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
    --age-recipient)
      [ "$#" -ge 2 ] || die "--age-recipient requires a key."
      AGE_RECIPIENT="$2"
      shift 2
      ;;
    --age-recipient-file)
      [ "$#" -ge 2 ] || die "--age-recipient-file requires a path."
      AGE_RECIPIENT_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --rclone-remote)
      [ "$#" -ge 2 ] || die "--rclone-remote requires a destination."
      RCLONE_REMOTE="$2"
      shift 2
      ;;
    --offsite-output-dir)
      [ "$#" -ge 2 ] || die "--offsite-output-dir requires a path."
      OFFSITE_OUTPUT_DIR="$(resolve_path "$2")"
      shift 2
      ;;
    --remove-local-after-upload)
      REMOVE_LOCAL_AFTER_UPLOAD=true
      shift
      ;;
    --install-packages)
      INSTALL_PACKAGES=true
      shift
      ;;
    --skip-rclone-probe)
      SKIP_RCLONE_PROBE=true
      shift
      ;;
    --run-now)
      RUN_NOW=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
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

[ "$(id -u)" -eq 0 ] || die "Run this setup helper with sudo or as root."
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "--retention-days must be a non-negative integer."
[[ "$SERVICE_NAME" =~ ^[A-Za-z0-9_.@-]+$ ]] || die "--service-name contains unsupported characters."

if [ -n "$AGE_RECIPIENT" ] && [ -n "$AGE_RECIPIENT_FILE" ]; then
  die "Use either --age-recipient or --age-recipient-file, not both."
fi

if [ -z "$AGE_RECIPIENT" ] && [ -z "$AGE_RECIPIENT_FILE" ]; then
  die "An age recipient is required. Use --age-recipient or --age-recipient-file."
fi

[ -n "$RCLONE_REMOTE" ] || die "--rclone-remote is required."

APP_ROOT="$(cd "$APP_ROOT" && pwd)"
ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
BACKUP_ROOT="$(resolve_path "$BACKUP_ROOT")"

[ -f "$APP_ROOT/scripts/install-backup-schedule.sh" ] || die "Missing installer under $APP_ROOT."
[ -f "$ENV_FILE" ] || die "Missing environment file: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || die "Missing Compose file: $COMPOSE_FILE"
if [ -n "$AGE_RECIPIENT_FILE" ] && [ ! -f "$AGE_RECIPIENT_FILE" ]; then
  die "Missing age recipient file: $AGE_RECIPIENT_FILE"
fi

install_missing_packages
validate_rclone_remote

INSTALL_ARGS=(
  "bash"
  "$APP_ROOT/scripts/install-backup-schedule.sh"
  "--app-root"
  "$APP_ROOT"
  "--env-file"
  "$ENV_FILE"
  "--compose-file"
  "$COMPOSE_FILE"
  "--backup-root"
  "$BACKUP_ROOT"
  "--retention-days"
  "$RETENTION_DAYS"
  "--on-calendar"
  "$ON_CALENDAR"
  "--service-name"
  "$SERVICE_NAME"
  "--offsite-rclone-remote"
  "$RCLONE_REMOTE"
)

if [ -n "$AGE_RECIPIENT" ]; then
  INSTALL_ARGS+=("--offsite-age-recipient" "$AGE_RECIPIENT")
fi

if [ -n "$AGE_RECIPIENT_FILE" ]; then
  INSTALL_ARGS+=("--offsite-age-recipient-file" "$AGE_RECIPIENT_FILE")
fi

if [ -n "$OFFSITE_OUTPUT_DIR" ]; then
  INSTALL_ARGS+=("--offsite-output-dir" "$OFFSITE_OUTPUT_DIR")
fi

if [ "$REMOVE_LOCAL_AFTER_UPLOAD" = "true" ]; then
  INSTALL_ARGS+=("--offsite-remove-local-after-upload")
fi

print_install_command

if [ "$DRY_RUN" = "true" ]; then
  info "Dry run complete"
  exit 0
fi

info "Installing verified off-server backup timer"
"${INSTALL_ARGS[@]}"

if [ "$RUN_NOW" = "true" ]; then
  info "Starting ${SERVICE_NAME}.service once"
  systemctl start "${SERVICE_NAME}.service"
fi

info "Off-server backup setup complete"
systemctl list-timers "${SERVICE_NAME}.timer" --no-pager
