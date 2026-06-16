#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bouncecore}"
ENV_FILE="${ENV_FILE:-/etc/bouncecore/bouncecore.env}"
USER_EMAIL="${STREAM_SMOKE_USER_EMAIL:-}"
DURATION_SECONDS=30
HLS_TIMEOUT_SECONDS=45
RTMP_URL=""
HLS_URL="http://127.0.0.1/hls/live/master.m3u8"
STATUS_URL="http://127.0.0.1:8088/api/status"
APP_HEALTH_URL="http://127.0.0.1:3100/api/health"
KEY_ID=""
FFMPEG_PID=""
RAW_KEY=""
FFMPEG_LOG=""

usage() {
  cat <<USAGE
Usage:
  scripts/stream-smoke-wsl-dev.sh --email user@example.com [options]

Options:
  --duration seconds       FFmpeg publish duration. Default: ${DURATION_SECONDS}
  --hls-timeout seconds    HLS playlist wait timeout. Default: ${HLS_TIMEOUT_SECONDS}
  --app-dir path           Deployed app directory. Default: ${APP_DIR}
  --env-file path          Deployed environment file. Default: ${ENV_FILE}
  --hls-url url            HLS playlist URL to poll. Default: ${HLS_URL}
USAGE
}

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

json_field() {
  local json="$1"
  local field="$2"

  JSON_PAYLOAD="$json" node -e 'const data = JSON.parse(process.env.JSON_PAYLOAD); const value = data[process.argv[1]]; if (value !== undefined && value !== null) process.stdout.write(String(value));' "$field"
}

cleanup() {
  if [ -n "$FFMPEG_PID" ] && kill -0 "$FFMPEG_PID" >/dev/null 2>&1; then
    kill "$FFMPEG_PID" >/dev/null 2>&1 || true
    wait "$FFMPEG_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$KEY_ID" ] && [ -x "$(command -v node)" ] && [ -f "$APP_DIR/scripts/temp-stream-key.mjs" ]; then
    node "$APP_DIR/scripts/temp-stream-key.mjs" revoke --key-id "$KEY_ID" >/dev/null || true
    printf 'Temporary stream key revoked.\n'
  fi

  if [ -n "$FFMPEG_LOG" ] && [ -f "$FFMPEG_LOG" ]; then
    rm -f "$FFMPEG_LOG"
  fi
}

trap cleanup EXIT

print_ffmpeg_log() {
  if [ ! -f "$FFMPEG_LOG" ]; then
    return
  fi

  if [ -n "$RAW_KEY" ]; then
    sed "s|$RAW_KEY|[redacted-stream-key]|g" "$FFMPEG_LOG" >&2 || true
    return
  fi

  cat "$FFMPEG_LOG" >&2 || true
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --email)
      USER_EMAIL="${2:-}"
      shift 2
      ;;
    --duration)
      DURATION_SECONDS="${2:-}"
      shift 2
      ;;
    --hls-timeout)
      HLS_TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --hls-url)
      HLS_URL="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      die "Unknown option: $1"
      ;;
  esac
done

[ -n "$USER_EMAIL" ] || die "Pass --email or set STREAM_SMOKE_USER_EMAIL."
[ -d "$APP_DIR" ] || die "Missing app directory: $APP_DIR"
[ -f "$ENV_FILE" ] || die "Missing env file: $ENV_FILE"
command -v node >/dev/null 2>&1 || die "node is required."
command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg is required. Install it with apt install ffmpeg."
command -v curl >/dev/null 2>&1 || die "curl is required."

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

RTMP_URL="${RTMP_URL:-rtmps://127.0.0.1:1936/live/}"

curl -fsS "$APP_HEALTH_URL" >/dev/null || die "Bouncecore app health check failed at $APP_HEALTH_URL."
curl -fsS -H "Authorization: Bearer ${STREAM_CORE_INTERNAL_TOKEN}" "$STATUS_URL" >/dev/null ||
  die "Stream core status check failed at $STATUS_URL."

KEY_JSON="$(node "$APP_DIR/scripts/temp-stream-key.mjs" create --email "$USER_EMAIL")"
KEY_ID="$(json_field "$KEY_JSON" keyId)"
RAW_KEY="$(json_field "$KEY_JSON" rawKey)"
FINGERPRINT="$(json_field "$KEY_JSON" fingerprint)"

[ -n "$KEY_ID" ] || die "Temporary stream key creation did not return keyId."
[ -n "$RAW_KEY" ] || die "Temporary stream key creation did not return rawKey."

printf 'Temporary stream key created: %s\n' "$FINGERPRINT"

PUBLISH_URL="${RTMP_URL}${RAW_KEY}"
FFMPEG_LOG="$(mktemp)"

ffmpeg \
  -hide_banner -loglevel warning \
  -re -f lavfi -i "testsrc=size=1280x720:rate=30" \
  -re -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
  -t "$DURATION_SECONDS" \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -b:v 3000k -maxrate 3000k -bufsize 6000k \
  -g 60 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -ar 48000 \
  -f flv "$PUBLISH_URL" >"$FFMPEG_LOG" 2>&1 &

FFMPEG_PID="$!"
printf 'Started FFmpeg publisher with PID %s.\n' "$FFMPEG_PID"
printf 'Polling HLS playlist: %s\n' "$HLS_URL"

deadline=$((SECONDS + HLS_TIMEOUT_SECONDS))
playlist=""

while [ "$SECONDS" -lt "$deadline" ]; do
  if playlist="$(curl -fsS "$HLS_URL" 2>/dev/null)" && printf '%s' "$playlist" | grep -q '#EXTM3U'; then
    printf 'HLS playlist is available.\n'
    printf '%s\n' "$playlist" | sed -n '1,8p'
    STATUS_JSON="$(curl -fsS -H "Authorization: Bearer ${STREAM_CORE_INTERNAL_TOKEN}" "$STATUS_URL")"
    printf 'Stream-core status:\n%s\n' "$STATUS_JSON"
    exit 0
  fi

  if ! kill -0 "$FFMPEG_PID" >/dev/null 2>&1; then
    print_ffmpeg_log
    die "FFmpeg exited before HLS became available."
  fi

  sleep 2
done

print_ffmpeg_log
die "HLS playlist did not become available within ${HLS_TIMEOUT_SECONDS} seconds."
