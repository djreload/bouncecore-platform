#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR=""
OUTPUT_DIR=""
STATUS_FILE=""
AGE_RECIPIENT=""
AGE_RECIPIENT_FILE=""
RCLONE_REMOTE=""
ALLOW_UNVERIFIED=false
REMOVE_LOCAL_AFTER_UPLOAD=false
UPLOADED=false
TEMP_DIR=""

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
Usage: scripts/export-backup-offsite.sh BACKUP_DIR [options]

Options:
  --age-recipient KEY       age public recipient key, for example age1...
  --age-recipient-file PATH File containing one or more age public recipient keys.
  --output-dir PATH         Local encrypted export directory. Default: BACKUP_ROOT/offsite.
  --status-file PATH        Latest export status file. Default: BACKUP_ROOT/latest-offsite-backup.env.
  --rclone-remote REMOTE    Optional rclone destination directory, for example remote:bucket/path.
  --remove-local-after-upload
                            Delete the local encrypted export after a successful rclone upload.
  --allow-unverified        Allow export when verification.env is missing or not healthy.
  -h, --help                Show this help.

The script packages a dated Bouncecore backup folder, encrypts it with age, writes
a SHA256 checksum plus an export report, and optionally uploads all three files
to an rclone remote. Keep the age private key off the production server.
USAGE
}

cleanup() {
  if [ -n "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

resolve_path() {
  local value="$1"

  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$APP_ROOT" "$value" ;;
  esac
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

sha256_file() {
  local file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return
  fi

  die "sha256sum or shasum is required."
}

check_verification() {
  local verification_file="$BACKUP_DIR/verification.env"
  local status

  if [ "$ALLOW_UNVERIFIED" = "true" ]; then
    warn "Exporting without requiring a healthy verification report."
    return
  fi

  status="$(file_value "$verification_file" status missing)"

  if [ "$status" != "healthy" ]; then
    die "Backup must have verification.env status=healthy before off-server export. Use --allow-unverified only for emergency manual handling."
  fi
}

write_report() {
  {
    printf 'exported_at=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf 'status=healthy\n'
    printf 'backup_dir=%s\n' "$BACKUP_DIR"
    printf 'backup_name=%s\n' "$BACKUP_NAME"
    printf 'encrypted_file=%s\n' "$ENCRYPTED_FILE"
    printf 'checksum_file=%s\n' "$CHECKSUM_FILE"
    printf 'sha256=%s\n' "$EXPORT_SHA256"
    printf 'bytes=%s\n' "$EXPORT_BYTES"
    printf 'age_recipient_source=%s\n' "$RECIPIENT_SOURCE"
    printf 'rclone_remote=%s\n' "${RCLONE_REMOTE:-}"
    printf 'uploaded=%s\n' "$UPLOADED"
    printf 'local_retained=%s\n' "$LOCAL_RETAINED"
  } > "$REPORT_FILE"

  chmod 600 "$REPORT_FILE"

  if [ -n "$STATUS_FILE" ]; then
    mkdir -p "$(dirname "$STATUS_FILE")"
    cp "$REPORT_FILE" "$STATUS_FILE"
    chmod 600 "$STATUS_FILE"
  fi
}

encrypt_backup() {
  local archive_file="$TEMP_DIR/$BACKUP_NAME.tar.gz"
  local backup_parent

  backup_parent="$(dirname "$BACKUP_DIR")"

  info "Packaging $BACKUP_DIR"
  tar -C "$backup_parent" -czf "$archive_file" "$BACKUP_NAME"

  info "Encrypting backup package with age"
  if [ -n "$AGE_RECIPIENT_FILE" ]; then
    age --recipients-file "$AGE_RECIPIENT_FILE" --output "$ENCRYPTED_FILE" "$archive_file"
  else
    age --recipient "$AGE_RECIPIENT" --output "$ENCRYPTED_FILE" "$archive_file"
  fi

  chmod 600 "$ENCRYPTED_FILE"
  EXPORT_SHA256="$(sha256_file "$ENCRYPTED_FILE")"
  EXPORT_BYTES="$(wc -c < "$ENCRYPTED_FILE" | tr -d '[:space:]')"
  printf '%s  %s\n' "$EXPORT_SHA256" "$(basename "$ENCRYPTED_FILE")" > "$CHECKSUM_FILE"
  chmod 600 "$CHECKSUM_FILE"
}

upload_export() {
  if [ -z "$RCLONE_REMOTE" ]; then
    return
  fi

  command -v rclone >/dev/null 2>&1 || die "rclone is required when --rclone-remote is used."

  info "Uploading encrypted backup to $RCLONE_REMOTE"
  rclone copy "$ENCRYPTED_FILE" "$RCLONE_REMOTE"
  rclone copy "$CHECKSUM_FILE" "$RCLONE_REMOTE"

  UPLOADED=true
  LOCAL_RETAINED=true
  write_report
  rclone copy "$REPORT_FILE" "$RCLONE_REMOTE"

  if [ "$REMOVE_LOCAL_AFTER_UPLOAD" = "true" ]; then
    info "Removing local encrypted export after successful upload"
    rm -f "$ENCRYPTED_FILE" "$CHECKSUM_FILE" "$REPORT_FILE"
    LOCAL_RETAINED=false
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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
    --output-dir)
      [ "$#" -ge 2 ] || die "--output-dir requires a path."
      OUTPUT_DIR="$(resolve_path "$2")"
      shift 2
      ;;
    --rclone-remote)
      [ "$#" -ge 2 ] || die "--rclone-remote requires a destination."
      RCLONE_REMOTE="$2"
      shift 2
      ;;
    --status-file)
      [ "$#" -ge 2 ] || die "--status-file requires a path."
      STATUS_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --remove-local-after-upload)
      REMOVE_LOCAL_AFTER_UPLOAD=true
      shift
      ;;
    --allow-unverified)
      ALLOW_UNVERIFIED=true
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
[ -f "$BACKUP_DIR/manifest.env" ] || die "Backup manifest does not exist: $BACKUP_DIR/manifest.env"
command -v age >/dev/null 2>&1 || die "age is required. Install it with apt install age or equivalent."

if [ -n "$AGE_RECIPIENT" ] && [ -n "$AGE_RECIPIENT_FILE" ]; then
  die "Use either --age-recipient or --age-recipient-file, not both."
fi

if [ -z "$AGE_RECIPIENT" ] && [ -z "$AGE_RECIPIENT_FILE" ]; then
  die "An age recipient is required. Use --age-recipient or --age-recipient-file."
fi

if [ -n "$AGE_RECIPIENT_FILE" ] && [ ! -f "$AGE_RECIPIENT_FILE" ]; then
  die "Recipient file does not exist: $AGE_RECIPIENT_FILE"
fi

if [ "$REMOVE_LOCAL_AFTER_UPLOAD" = "true" ] && [ -z "$RCLONE_REMOTE" ]; then
  die "--remove-local-after-upload requires --rclone-remote."
fi

BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
BACKUP_NAME="$(basename "$BACKUP_DIR")"
BACKUP_ROOT="$(dirname "$BACKUP_DIR")"

case "$BACKUP_NAME" in
  ????????T??????Z) ;;
  *) die "Backup directory must be a dated backup folder like 20260608T203000Z." ;;
esac

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="$BACKUP_ROOT/offsite"
fi

if [ -z "$STATUS_FILE" ]; then
  STATUS_FILE="$BACKUP_ROOT/latest-offsite-backup.env"
else
  STATUS_FILE="$(dirname "$STATUS_FILE")/$(basename "$STATUS_FILE")"
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
mkdir -p "$(dirname "$STATUS_FILE")"
STATUS_FILE="$(cd "$(dirname "$STATUS_FILE")" && pwd)/$(basename "$STATUS_FILE")"

if [ "$OUTPUT_DIR" = "$BACKUP_DIR" ]; then
  die "--output-dir must not be the backup directory being exported."
fi

case "$OUTPUT_DIR/" in
  "$BACKUP_DIR"/*) die "--output-dir must not be inside the backup directory being exported." ;;
esac

check_verification

RECIPIENT_SOURCE="inline"
if [ -n "$AGE_RECIPIENT_FILE" ]; then
  RECIPIENT_SOURCE="$AGE_RECIPIENT_FILE"
fi

TEMP_DIR="$(mktemp -d)"
trap cleanup EXIT

ENCRYPTED_FILE="$OUTPUT_DIR/$BACKUP_NAME.tar.gz.age"
CHECKSUM_FILE="$ENCRYPTED_FILE.sha256"
REPORT_FILE="$OUTPUT_DIR/$BACKUP_NAME.offsite.env"
EXPORT_SHA256=""
EXPORT_BYTES="0"
LOCAL_RETAINED=true

encrypt_backup
write_report
upload_export

info "Encrypted backup export complete"
printf 'Encrypted file: %s\n' "$ENCRYPTED_FILE"
printf 'Checksum file: %s\n' "$CHECKSUM_FILE"
printf 'Export report: %s\n' "$REPORT_FILE"
