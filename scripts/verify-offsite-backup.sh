#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENCRYPTED_FILE=""
IDENTITY_FILE=""
CHECKSUM_FILE=""
REPORT_FILE=""
TEMP_DIR=""
FAILURES=0
WARNINGS=0
BACKUP_NAME=""
EXPORT_SHA256=""
VERIFICATION_STATUS="unknown"

info() {
  printf '\n==> %s\n' "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf 'WARN: %s\n' "$1" >&2
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf 'FAIL: %s\n' "$1" >&2
}

die() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: scripts/verify-offsite-backup.sh ENCRYPTED_FILE --identity PATH [options]

Options:
  --identity PATH       age private identity key used to decrypt the export.
  --checksum-file PATH  SHA256 file. Default: ENCRYPTED_FILE.sha256.
  --report-file PATH    Verification report path. Default: ENCRYPTED_FILE.offsite-verify.env.
  -h, --help            Show this help.

Run this on a trusted recovery machine, not on the production server. The script
verifies the encrypted export checksum, decrypts it with age, confirms the tar
archive contains a Bouncecore backup manifest, and checks the original backup
verification report inside the archive.
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

tar_has() {
  local entry="$1"

  grep -Fxq "$entry" "$TEMP_DIR/listing.txt"
}

write_report() {
  local status="healthy"

  if [ "$FAILURES" -gt 0 ]; then
    status="failed"
  elif [ "$WARNINGS" -gt 0 ]; then
    status="warning"
  fi

  {
    printf 'verified_at=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf 'status=%s\n' "$status"
    printf 'failures=%s\n' "$FAILURES"
    printf 'warnings=%s\n' "$WARNINGS"
    printf 'encrypted_file=%s\n' "$ENCRYPTED_FILE"
    printf 'checksum_file=%s\n' "$CHECKSUM_FILE"
    printf 'backup_name=%s\n' "$BACKUP_NAME"
    printf 'sha256=%s\n' "$EXPORT_SHA256"
    printf 'original_verification_status=%s\n' "$VERIFICATION_STATUS"
  } > "$REPORT_FILE"

  chmod 600 "$REPORT_FILE"
  printf 'Offsite verification report: %s\n' "$REPORT_FILE"

  if [ "$FAILURES" -gt 0 ]; then
    return 1
  fi
}

verify_checksum() {
  local expected

  expected="$(awk 'NR == 1 {print $1}' "$CHECKSUM_FILE")"
  EXPORT_SHA256="$(sha256_file "$ENCRYPTED_FILE")"

  if [ -z "$expected" ]; then
    fail "Checksum file is empty or malformed: $CHECKSUM_FILE"
    return
  fi

  if [ "$EXPORT_SHA256" != "$expected" ]; then
    fail "Encrypted export checksum mismatch."
    return
  fi

  info "Checksum verified"
}

decrypt_archive() {
  info "Decrypting encrypted export"
  age --decrypt -i "$IDENTITY_FILE" "$ENCRYPTED_FILE" > "$TEMP_DIR/backup.tar.gz"

  info "Listing decrypted archive"
  tar -tzf "$TEMP_DIR/backup.tar.gz" > "$TEMP_DIR/listing.txt"

  BACKUP_NAME="$(awk -F/ 'NF >= 2 && $1 != "" {print $1; exit}' "$TEMP_DIR/listing.txt")"

  case "$BACKUP_NAME" in
    ????????T??????Z) ;;
    *) fail "Archive root is not a dated Bouncecore backup folder."; return ;;
  esac
}

verify_archive_contents() {
  local manifest_file="$TEMP_DIR/manifest.env"
  local verification_file="$TEMP_DIR/verification.env"
  local skip_db
  local skip_volumes

  for required in "$BACKUP_NAME/manifest.env" "$BACKUP_NAME/verification.env"; do
    if ! tar_has "$required"; then
      fail "Missing required archive entry: $required"
    fi
  done

  if [ "$FAILURES" -gt 0 ]; then
    return
  fi

  tar -xOzf "$TEMP_DIR/backup.tar.gz" "$BACKUP_NAME/manifest.env" > "$manifest_file"
  tar -xOzf "$TEMP_DIR/backup.tar.gz" "$BACKUP_NAME/verification.env" > "$verification_file"

  VERIFICATION_STATUS="$(file_value "$verification_file" status unknown)"
  if [ "$VERIFICATION_STATUS" != "healthy" ]; then
    fail "Original backup verification status is $VERIFICATION_STATUS."
  fi

  skip_db="$(file_value "$manifest_file" skip_db false)"
  skip_volumes="$(file_value "$manifest_file" skip_volumes false)"

  if [ "$skip_db" != "true" ] && ! tar_has "$BACKUP_NAME/postgres.dump"; then
    fail "Missing PostgreSQL dump in archive."
  fi

  if [ "$skip_volumes" != "true" ]; then
    for volume_archive in \
      "$BACKUP_NAME/volumes/uploads.tar.gz" \
      "$BACKUP_NAME/volumes/redis.tar.gz" \
      "$BACKUP_NAME/volumes/stream-core.tar.gz" \
      "$BACKUP_NAME/volumes/transcoder-hls.tar.gz"; do
      if ! tar_has "$volume_archive"; then
        fail "Missing volume archive: $volume_archive"
      fi
    done
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --identity)
      [ "$#" -ge 2 ] || die "--identity requires a path."
      IDENTITY_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --checksum-file)
      [ "$#" -ge 2 ] || die "--checksum-file requires a path."
      CHECKSUM_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    --report-file)
      [ "$#" -ge 2 ] || die "--report-file requires a path."
      REPORT_FILE="$(resolve_path "$2")"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$ENCRYPTED_FILE" ]; then
        die "Unexpected argument: $1"
      fi

      ENCRYPTED_FILE="$(resolve_path "$1")"
      shift
      ;;
  esac
done

[ -n "$ENCRYPTED_FILE" ] || die "Encrypted backup export is required."
[ -f "$ENCRYPTED_FILE" ] || die "Encrypted file does not exist: $ENCRYPTED_FILE"
[ -n "$IDENTITY_FILE" ] || die "--identity is required."
[ -f "$IDENTITY_FILE" ] || die "Identity file does not exist: $IDENTITY_FILE"
command -v age >/dev/null 2>&1 || die "age is required."
command -v tar >/dev/null 2>&1 || die "tar is required."

if [ -z "$CHECKSUM_FILE" ]; then
  CHECKSUM_FILE="$ENCRYPTED_FILE.sha256"
fi

if [ -z "$REPORT_FILE" ]; then
  case "$ENCRYPTED_FILE" in
    *.tar.gz.age) REPORT_FILE="${ENCRYPTED_FILE%.tar.gz.age}.offsite-verify.env" ;;
    *) REPORT_FILE="$ENCRYPTED_FILE.offsite-verify.env" ;;
  esac
fi

[ -f "$CHECKSUM_FILE" ] || die "Checksum file does not exist: $CHECKSUM_FILE"

TEMP_DIR="$(mktemp -d)"
trap cleanup EXIT

verify_checksum
decrypt_archive
verify_archive_contents
write_report
