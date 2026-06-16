#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="$APP_ROOT/.env.instance"

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

prompt() {
  local label="$1"
  local default_value="${2:-}"
  local value

  if [ -n "$default_value" ]; then
    read -r -p "$label [$default_value]: " value
    printf '%s' "${value:-$default_value}"
  else
    read -r -p "$label: " value
    printf '%s' "$value"
  fi
}

prompt_secret() {
  local label="$1"
  local value
  read -r -s -p "$label: " value
  printf '\n' >&2
  printf '%s' "$value"
}

prompt_optional_secret() {
  local label="$1"
  local value
  read -r -s -p "$label (leave blank to generate): " value
  printf '\n' >&2
  printf '%s' "$value"
}

prompt_secret_optional() {
  local label="$1"
  local value
  read -r -s -p "$label (leave blank to skip): " value
  printf '\n' >&2
  printf '%s' "$value"
}

confirm() {
  local label="$1"
  local default_value="${2:-y}"
  local value
  read -r -p "$label [$default_value]: " value
  value="${value:-$default_value}"
  case "$value" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

generate_secret() {
  openssl rand -hex 32
}

require_url_safe() {
  local label="$1"
  local value="$2"

  if [[ ! "$value" =~ ^[A-Za-z0-9_.~-]+$ ]]; then
    die "$label must contain only letters, numbers, underscore, dot, tilde, or dash."
  fi
}

require_single_line() {
  local label="$1"
  local value="$2"

  case "$value" in
    *$'\n'*|*$'\r'*)
      die "$label must be a single line."
      ;;
  esac
}

urlencode() {
  local value="$1"
  local encoded=""
  local char
  local hex
  local i
  local LC_ALL=C

  for ((i = 0; i < ${#value}; i += 1)); do
    char="${value:i:1}"

    case "$char" in
      [A-Za-z0-9_.~-])
        encoded+="$char"
        ;;
      *)
        printf -v hex '%%%02X' "'$char"
        encoded+="$hex"
        ;;
    esac
  done

  printf '%s' "$encoded"
}

require_nonempty() {
  local label="$1"
  local value="$2"

  if [ -z "$value" ]; then
    die "$label is required."
  fi
}

resolve_app_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$APP_ROOT" "$1" ;;
  esac
}

generate_rtmps_certificate() {
  local cert_dir="$1"
  local domain="$2"

  if [ -s "$cert_dir/server.crt" ] && [ -s "$cert_dir/server.key" ]; then
    return
  fi

  warn "Generating a self-signed RTMPS certificate in $cert_dir. Replace it with a trusted certificate before public production ingest."
  run_as_root install -d -m 700 "$cert_dir"

  run_as_root tee "$cert_dir/server.cnf" >/dev/null <<CERTCONF
[req]
distinguished_name=req_distinguished_name
x509_extensions=v3_req
prompt=no

[req_distinguished_name]
CN=${domain}

[v3_req]
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
DNS.1=${domain}
DNS.2=localhost
IP.1=127.0.0.1
CERTCONF

  run_as_root openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 825 \
    -keyout "$cert_dir/server.key" \
    -out "$cert_dir/server.crt" \
    -config "$cert_dir/server.cnf"
  run_as_root chmod 600 "$cert_dir/server.key"
  run_as_root chmod 644 "$cert_dir/server.crt"
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    die "This step needs root privileges. Re-run as root or install sudo."
  fi

  sudo "$@"
}

install_system_dependencies() {
  local missing_packages=()

  for command_name in curl ffmpeg git openssl; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      missing_packages+=("$command_name")
    fi
  done

  if ! command -v docker >/dev/null 2>&1; then
    missing_packages+=("docker.io")
  fi

  if command -v docker >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    missing_packages+=("docker-compose-plugin")
  fi

  if [ "${#missing_packages[@]}" -eq 0 ]; then
    return
  fi

  warn "Missing server dependencies: ${missing_packages[*]}."

  if ! command -v apt-get >/dev/null 2>&1; then
    die "Install these dependencies first, then re-run this script: ${missing_packages[*]}"
  fi

  if confirm "Install missing dependencies with apt now?" "y"; then
    run_as_root apt-get update
    run_as_root apt-get install -y ca-certificates "${missing_packages[@]}"

    if command -v systemctl >/dev/null 2>&1; then
      run_as_root systemctl enable --now docker
    fi
  else
    die "Missing dependencies are required to install a Bouncecore instance."
  fi

  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is still unavailable after install."
}

wait_for_app() {
  local local_host="$1"
  local local_port="$2"
  local health_url="http://$local_host:$local_port/api/health"

  info "Waiting for app health at $health_url"

  for _ in $(seq 1 60); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      return
    fi

    sleep 2
  done

  die "App did not become healthy in time. Check: docker compose -f docker-compose.instance.yml --env-file .env.instance logs app"
}

curl_config_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

bootstrap_owner() {
  local local_host="$1"
  local local_port="$2"
  local owner_display_name="$3"
  local owner_email="$4"
  local owner_password="$5"
  local setup_url="http://$local_host:$local_port/api/setup/owner"
  local status_url="http://$local_host:$local_port/api/setup/status"
  local status_body
  local curl_config
  local response_file
  local http_code

  status_body="$(curl -fsS "$status_url" || true)"

  if printf '%s' "$status_body" | grep -q '"ownerExists":true'; then
    warn "Owner account already exists; skipping owner bootstrap."
    return
  fi

  curl_config="$(mktemp)"
  response_file="$(mktemp)"
  trap 'rm -f "$curl_config" "$response_file"' RETURN

  cat > "$curl_config" <<CURL
url = "$setup_url"
request = "POST"
header = "Content-Type: application/x-www-form-urlencoded"
data-urlencode = "displayName=$(curl_config_escape "$owner_display_name")"
data-urlencode = "email=$(curl_config_escape "$owner_email")"
data-urlencode = "password=$(curl_config_escape "$owner_password")"
output = "$response_file"
write-out = "%{http_code}"
silent
show-error
max-time = 30
CURL

  http_code="$(curl --config "$curl_config")"

  case "$http_code" in
    200|303)
      info "Owner bootstrap request accepted."
      ;;
    *)
      cat "$response_file" >&2 || true
      die "Owner bootstrap failed with HTTP $http_code."
      ;;
  esac
}

info "Bouncecore interactive instance installer"

if [ ! -f "$COMPOSE_FILE" ]; then
  die "Missing $COMPOSE_FILE. Run this script from a checked-out Bouncecore repo."
fi

install_system_dependencies

if [ -f "$ENV_FILE" ]; then
  if confirm "$ENV_FILE already exists. Overwrite it?" "n"; then
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"
  else
    die "Cancelled before overwriting $ENV_FILE."
  fi
fi

APP_URL="$(prompt "Public app URL" "https://bouncecore.example.com")"
APP_HOST="${APP_URL#http://}"
APP_HOST="${APP_HOST#https://}"
APP_HOST="${APP_HOST%%/*}"
APP_MAIL_HOST="${APP_HOST%%:*}"
APP_BIND_HOST="$(prompt "App bind host" "127.0.0.1")"
APP_PORT="$(prompt "App host port" "3000")"
BREVO_SMTP_HOST="$(prompt "Brevo SMTP host" "smtp-relay.brevo.com")"
BREVO_SMTP_PORT="$(prompt "Brevo SMTP port" "587")"
BREVO_SMTP_USER="$(prompt "Brevo SMTP username" "")"
BREVO_SMTP_KEY="$(prompt_secret_optional "Brevo SMTP key")"
MAIL_FROM="$(prompt "Site email from address" "no-reply@$APP_MAIL_HOST")"
MAIL_FROM_NAME="$(prompt "Site email sender name" "Bouncecore")"
MAIL_REPLY_TO="$(prompt "Site email reply-to address" "")"
POSTGRES_DB="$(prompt "PostgreSQL database name" "bouncecore_platform")"
POSTGRES_USER="$(prompt "PostgreSQL username" "bouncecore_app")"
POSTGRES_PASSWORD="$(prompt_optional_secret "PostgreSQL password")"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_secret)}"
POSTGRES_BIND_HOST="$(prompt "PostgreSQL bind host" "127.0.0.1")"
POSTGRES_PORT="$(prompt "PostgreSQL host port" "5432")"
REDIS_BIND_HOST="$(prompt "Redis bind host" "127.0.0.1")"
REDIS_PORT="$(prompt "Redis host port" "6379")"
STREAM_PROVIDER="$(prompt "Stream provider" "mock")"
INTERNAL_TASK_TOKEN="$(prompt_optional_secret "Internal task token")"
INTERNAL_TASK_TOKEN="${INTERNAL_TASK_TOKEN:-$(generate_secret)}"
ENABLE_STREAM_CORE="$(prompt "Start embedded stream core service now? Use n if another service owns stream ports" "n")"
ENABLE_MEDIA_GATEWAY="$(prompt "Start MediaMTX RTMP/HLS gateway now? Use n if stream ports are already in use" "n")"
ENABLE_TRANSCODER="$(prompt "Start FFmpeg adaptive HLS transcoder now? Requires the MediaMTX gateway" "n")"
ENABLE_WORKER="$(prompt "Start background worker now?" "y")"
STREAM_CORE_INTERNAL_URL="$(prompt "Stream core internal URL" "http://stream-core:8088")"
STREAM_CORE_STATUS_PATH="$(prompt "Stream core status path" "/status")"
STREAM_CORE_INTERNAL_TOKEN="$(prompt_optional_secret "Stream core internal token")"
STREAM_CORE_INTERNAL_TOKEN="${STREAM_CORE_INTERNAL_TOKEN:-$(generate_secret)}"
STREAM_CORE_KEY_VALIDATION_URL="$(prompt "Stream core key validation URL" "http://app:3000/internal/stream/keys/validate")"
STREAM_CORE_KEY_VALIDATION_TOKEN="$(prompt_secret_optional "Stream core key validation token")"
STREAM_CORE_KEY_VALIDATION_TOKEN="${STREAM_CORE_KEY_VALIDATION_TOKEN:-$INTERNAL_TASK_TOKEN}"
STREAM_CORE_BIND_HOST="$(prompt "Stream core bind host" "127.0.0.1")"
STREAM_CORE_HTTP_BIND_PORT="$(prompt "Stream core host HTTP port" "18088")"
STREAM_CORE_OFFLINE_AFTER_SECONDS="$(prompt "Stream core offline timeout seconds" "30")"
MEDIA_GATEWAY_BIND_HOST="$(prompt "Media gateway bind host" "127.0.0.1")"
MEDIA_GATEWAY_RTMP_ENCRYPTION="$(prompt "Media gateway RTMP encryption mode (no, optional, strict)" "optional")"
MEDIA_GATEWAY_RTMP_BIND_HOST="$(prompt "Media gateway RTMP bind host" "$MEDIA_GATEWAY_BIND_HOST")"
MEDIA_GATEWAY_RTMP_BIND_PORT="$(prompt "Media gateway RTMP host port" "1935")"
MEDIA_GATEWAY_RTMPS_BIND_HOST="$(prompt "Media gateway RTMPS bind host" "$MEDIA_GATEWAY_BIND_HOST")"
MEDIA_GATEWAY_RTMPS_BIND_PORT="$(prompt "Media gateway RTMPS host port" "1936")"
MEDIA_GATEWAY_RTMPS_CERT_DIR="$(prompt "Media gateway RTMPS certificate directory" "./.instance-certs/rtmps")"
MEDIA_GATEWAY_HLS_BIND_HOST="$(prompt "Media gateway HLS bind host" "$MEDIA_GATEWAY_BIND_HOST")"
MEDIA_GATEWAY_HLS_BIND_PORT="$(prompt "Media gateway HLS host port" "18888")"
MEDIA_GATEWAY_PUBLIC_HLS_URL="$(prompt "Media gateway public HLS URL template" "$APP_URL/hls/{path}/index.m3u8")"
TRANSCODER_ENABLED=false
TRANSCODER_INPUT_URL="rtmp://media-gateway:1935/{path}"
TRANSCODER_HLS_BIND_HOST="127.0.0.1"
TRANSCODER_HLS_BIND_PORT="18889"
TRANSCODER_HLS_PUBLIC_URL="$APP_URL/hls/live/master.m3u8"

case "$ENABLE_TRANSCODER" in
  y|Y|yes|YES)
    TRANSCODER_ENABLED=true
    TRANSCODER_INPUT_URL="$(prompt "Transcoder RTMP input URL template" "$TRANSCODER_INPUT_URL")"
    TRANSCODER_HLS_BIND_HOST="$(prompt "Transcoder HLS origin bind host" "$TRANSCODER_HLS_BIND_HOST")"
    TRANSCODER_HLS_BIND_PORT="$(prompt "Transcoder HLS origin host port" "$TRANSCODER_HLS_BIND_PORT")"
    TRANSCODER_HLS_PUBLIC_URL="$(prompt "Transcoder public HLS master URL" "$TRANSCODER_HLS_PUBLIC_URL")"
    ;;
esac
case "$MEDIA_GATEWAY_RTMP_ENCRYPTION" in
  no|optional|strict) ;;
  *) die "Media gateway RTMP encryption mode must be no, optional, or strict." ;;
esac

if [ "$MEDIA_GATEWAY_RTMP_ENCRYPTION" = "no" ]; then
  DEFAULT_RTMP_INGEST_URL="rtmp://$APP_HOST/live/{streamKey}"
else
  DEFAULT_RTMP_INGEST_URL="rtmps://$APP_HOST:$MEDIA_GATEWAY_RTMPS_BIND_PORT/live/{streamKey}"
fi

RTMP_INGEST_URL="$(prompt "Public RTMP/RTMPS ingest URL" "$DEFAULT_RTMP_INGEST_URL")"
DEFAULT_PUBLIC_PLAYBACK_URL="$MEDIA_GATEWAY_PUBLIC_HLS_URL"

if [ "$TRANSCODER_ENABLED" = "true" ]; then
  DEFAULT_PUBLIC_PLAYBACK_URL="$TRANSCODER_HLS_PUBLIC_URL"
fi

PUBLIC_PLAYBACK_URL="$(prompt "Public playback URL" "$DEFAULT_PUBLIC_PLAYBACK_URL")"
DEFAULT_HLS_PLAYBACK_HEALTH_URL=""

case "$ENABLE_TRANSCODER" in
  y|Y|yes|YES)
    DEFAULT_HLS_PLAYBACK_HEALTH_URL="http://hls-origin/live/master.m3u8"
    ;;
  *)
    case "$ENABLE_MEDIA_GATEWAY" in
      y|Y|yes|YES)
        DEFAULT_HLS_PLAYBACK_HEALTH_URL="http://media-gateway:8888/live/index.m3u8"
        ;;
    esac
    ;;
esac

HLS_PLAYBACK_HEALTH_URL="$(prompt "Server-side HLS health URL, blank to use public playback URL" "$DEFAULT_HLS_PLAYBACK_HEALTH_URL")"
TENOR_API_KEY="$(prompt_secret_optional "Tenor API key")"
PUSH_TOKEN_ENCRYPTION_KEY="$(prompt_optional_secret "Push token encryption key")"
PUSH_TOKEN_ENCRYPTION_KEY="${PUSH_TOKEN_ENCRYPTION_KEY:-$(generate_secret)}"
EXPO_PUSH_ACCESS_TOKEN="$(prompt_secret_optional "Expo push access token")"
PAYPAL_MODE="$(prompt "PayPal mode" "sandbox")"
PAYPAL_CLIENT_ID="$(prompt "PayPal client ID" "")"
PAYPAL_CLIENT_SECRET="$(prompt_secret_optional "PayPal client secret")"
PAYPAL_WEBHOOK_ID="$(prompt "PayPal webhook ID" "")"
PAYPAL_MERCHANT_EMAIL="$(prompt "PayPal merchant email" "")"
PAYPAL_MERCHANT_ID="$(prompt "PayPal merchant ID" "")"
OWNER_DISPLAY_NAME="$(prompt "First server owner display name" "Owner")"
OWNER_EMAIL="$(prompt "First server owner email" "")"
OWNER_PASSWORD="$(prompt_secret "First server owner password (min 12 chars)")"
OWNER_PASSWORD_CONFIRM="$(prompt_secret "Confirm first server owner password")"

require_nonempty "Public app URL" "$APP_URL"
require_nonempty "PostgreSQL database name" "$POSTGRES_DB"
require_nonempty "PostgreSQL username" "$POSTGRES_USER"
require_nonempty "First server owner email" "$OWNER_EMAIL"
if [ -n "$BREVO_SMTP_USER$BREVO_SMTP_KEY" ]; then
  require_nonempty "Brevo SMTP username" "$BREVO_SMTP_USER"
  require_nonempty "Brevo SMTP key" "$BREVO_SMTP_KEY"
  require_nonempty "Site email from address" "$MAIL_FROM"
fi
require_url_safe "PostgreSQL database name" "$POSTGRES_DB"
require_url_safe "PostgreSQL username" "$POSTGRES_USER"
require_single_line "PostgreSQL password" "$POSTGRES_PASSWORD"
require_single_line "Brevo SMTP username" "$BREVO_SMTP_USER"
require_single_line "Brevo SMTP key" "$BREVO_SMTP_KEY"
require_single_line "Site email from address" "$MAIL_FROM"
require_single_line "Site email sender name" "$MAIL_FROM_NAME"
require_single_line "Site email reply-to address" "$MAIL_REPLY_TO"
DATABASE_PASSWORD_URLENCODED="$(urlencode "$POSTGRES_PASSWORD")"

if [ "$OWNER_PASSWORD" != "$OWNER_PASSWORD_CONFIRM" ]; then
  die "Owner passwords do not match."
fi

case "$PAYPAL_MODE" in
  sandbox|live) ;;
  *) die "PayPal mode must be sandbox or live." ;;
esac

if [ "${#OWNER_PASSWORD}" -lt 12 ]; then
  die "Owner password must be at least 12 characters."
fi

if [ "$MEDIA_GATEWAY_RTMP_ENCRYPTION" != "no" ]; then
  generate_rtmps_certificate "$(resolve_app_path "$MEDIA_GATEWAY_RTMPS_CERT_DIR")" "$APP_HOST"
fi

LOCAL_HEALTH_HOST="$APP_BIND_HOST"
if [ "$LOCAL_HEALTH_HOST" = "0.0.0.0" ]; then
  LOCAL_HEALTH_HOST="127.0.0.1"
fi

cat > "$ENV_FILE" <<ENV
# Generated by scripts/install-instance.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
APP_IMAGE=bouncecore-platform
APP_IMAGE_TAG=instance
APP_CONTAINER=bouncecore-app
APP_BIND_HOST=$APP_BIND_HOST
APP_PORT=$APP_PORT

POSTGRES_CONTAINER=bouncecore-postgres
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_BIND_HOST=$POSTGRES_BIND_HOST
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_VOLUME=bouncecore_postgres_data

REDIS_CONTAINER=bouncecore-redis
REDIS_BIND_HOST=$REDIS_BIND_HOST
REDIS_PORT=$REDIS_PORT
REDIS_VOLUME=bouncecore_redis_data

DATABASE_URL=postgresql://$POSTGRES_USER:$DATABASE_PASSWORD_URLENCODED@postgres:5432/$POSTGRES_DB
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_APP_URL=$APP_URL
BREVO_SMTP_HOST=$BREVO_SMTP_HOST
BREVO_SMTP_PORT=$BREVO_SMTP_PORT
BREVO_SMTP_USER=$BREVO_SMTP_USER
BREVO_SMTP_KEY=$BREVO_SMTP_KEY
MAIL_FROM=$MAIL_FROM
MAIL_FROM_NAME=$MAIL_FROM_NAME
MAIL_REPLY_TO=$MAIL_REPLY_TO
STREAM_PROVIDER=$STREAM_PROVIDER
INTERNAL_TASK_TOKEN=$INTERNAL_TASK_TOKEN
STREAM_CORE_INTERNAL_URL=$STREAM_CORE_INTERNAL_URL
STREAM_CORE_STATUS_PATH=$STREAM_CORE_STATUS_PATH
STREAM_CORE_INTERNAL_TOKEN=$STREAM_CORE_INTERNAL_TOKEN
STREAM_CORE_KEY_VALIDATION_URL=$STREAM_CORE_KEY_VALIDATION_URL
STREAM_CORE_KEY_VALIDATION_TOKEN=$STREAM_CORE_KEY_VALIDATION_TOKEN
STREAM_CORE_CONTAINER=bouncecore-stream-core
STREAM_CORE_BIND_HOST=$STREAM_CORE_BIND_HOST
STREAM_CORE_HTTP_BIND_PORT=$STREAM_CORE_HTTP_BIND_PORT
STREAM_CORE_VOLUME=bouncecore_stream_core_data
STREAM_CORE_OFFLINE_AFTER_SECONDS=$STREAM_CORE_OFFLINE_AFTER_SECONDS
STREAM_CORE_PUBLIC_PLAYBACK_URL=$PUBLIC_PLAYBACK_URL
MEDIA_GATEWAY_CONTAINER=bouncecore-media-gateway
MEDIA_GATEWAY_BIND_HOST=$MEDIA_GATEWAY_BIND_HOST
MEDIA_GATEWAY_RTMP_ENCRYPTION=$MEDIA_GATEWAY_RTMP_ENCRYPTION
MEDIA_GATEWAY_RTMP_BIND_HOST=$MEDIA_GATEWAY_RTMP_BIND_HOST
MEDIA_GATEWAY_RTMP_BIND_PORT=$MEDIA_GATEWAY_RTMP_BIND_PORT
MEDIA_GATEWAY_RTMPS_BIND_HOST=$MEDIA_GATEWAY_RTMPS_BIND_HOST
MEDIA_GATEWAY_RTMPS_BIND_PORT=$MEDIA_GATEWAY_RTMPS_BIND_PORT
MEDIA_GATEWAY_RTMPS_CERT_DIR=$MEDIA_GATEWAY_RTMPS_CERT_DIR
MEDIA_GATEWAY_HLS_BIND_HOST=$MEDIA_GATEWAY_HLS_BIND_HOST
MEDIA_GATEWAY_HLS_BIND_PORT=$MEDIA_GATEWAY_HLS_BIND_PORT
MEDIA_GATEWAY_PUBLIC_HLS_URL=$MEDIA_GATEWAY_PUBLIC_HLS_URL
HLS_PLAYBACK_HEALTH_URL=$HLS_PLAYBACK_HEALTH_URL
TRANSCODER_ENABLED=$TRANSCODER_ENABLED
HLS_ORIGIN_CONTAINER=bouncecore-hls-origin
TRANSCODER_CONTAINER=bouncecore-media-transcoder
TRANSCODER_INPUT_URL=$TRANSCODER_INPUT_URL
TRANSCODER_HLS_BIND_HOST=$TRANSCODER_HLS_BIND_HOST
TRANSCODER_HLS_BIND_PORT=$TRANSCODER_HLS_BIND_PORT
TRANSCODER_HLS_PUBLIC_URL=$TRANSCODER_HLS_PUBLIC_URL
TRANSCODER_HLS_VOLUME=bouncecore_transcoder_hls
WORKER_CONTAINER=bouncecore-worker
WORKER_CHAT_PRUNE_ENABLED=true
WORKER_CHAT_PRUNE_INTERVAL_SECONDS=3600
WORKER_STREAM_SYNC_ENABLED=true
WORKER_STREAM_SYNC_INTERVAL_SECONDS=15
WORKER_MOBILE_PUSH_DISPATCH_ENABLED=true
WORKER_MOBILE_PUSH_DISPATCH_INTERVAL_SECONDS=60
WORKER_MOBILE_PUSH_RECEIPTS_ENABLED=true
WORKER_MOBILE_PUSH_RECEIPT_INTERVAL_SECONDS=300
WORKER_MOBILE_PUSH_LIMIT=50
WORKER_HEARTBEAT_STALE_SECONDS=120
WORKER_QUEUE_BACKLOG_WARNING=250
RTMP_INGEST_URL=$RTMP_INGEST_URL
PUBLIC_PLAYBACK_URL=$PUBLIC_PLAYBACK_URL
TENOR_API_KEY=$TENOR_API_KEY
PUSH_TOKEN_ENCRYPTION_KEY=$PUSH_TOKEN_ENCRYPTION_KEY
EXPO_PUSH_ACCESS_TOKEN=$EXPO_PUSH_ACCESS_TOKEN
PAYPAL_MODE=$PAYPAL_MODE
PAYPAL_CLIENT_ID=$PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=$PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID=$PAYPAL_WEBHOOK_ID
PAYPAL_MERCHANT_EMAIL=$PAYPAL_MERCHANT_EMAIL
PAYPAL_MERCHANT_ID=$PAYPAL_MERCHANT_ID
NEXT_TELEMETRY_DISABLED=1
ENV

chmod 600 "$ENV_FILE"

info "Building Bouncecore app image"
compose build app

info "Starting database services"
compose up -d postgres redis

info "Running database migrations"
compose run --rm app npm run db:migrate

info "Seeding RBAC and platform defaults"
compose run --rm app npm run db:seed

info "Starting app"
compose up -d app

case "$ENABLE_STREAM_CORE" in
  y|Y|yes|YES)
    info "Starting embedded stream core"
    compose --profile stream-core up -d stream-core
    ;;
  *)
    case "$ENABLE_MEDIA_GATEWAY" in
      y|Y|yes|YES)
        info "Embedded stream core will be started with the MediaMTX gateway"
        ;;
      *)
        case "$ENABLE_TRANSCODER" in
          y|Y|yes|YES)
            info "Embedded stream core will be started with the adaptive HLS transcoder"
            ;;
          *)
            warn "Embedded stream core was not started. Start later with: docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core up -d stream-core"
            ;;
        esac
        ;;
    esac
    ;;
esac

case "$ENABLE_MEDIA_GATEWAY" in
  y|Y|yes|YES)
    info "Starting MediaMTX RTMP/HLS gateway"
    compose --profile stream-core --profile media-gateway up -d stream-core media-gateway
    ;;
  *)
    case "$ENABLE_TRANSCODER" in
      y|Y|yes|YES)
        info "MediaMTX gateway will be started with the adaptive HLS transcoder"
        ;;
      *)
        warn "MediaMTX gateway was not started. Start later with: docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway"
        ;;
    esac
    ;;
esac

case "$ENABLE_TRANSCODER" in
  y|Y|yes|YES)
    info "Starting adaptive HLS transcoder"
    compose --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
    ;;
  *)
    warn "Adaptive HLS transcoder was not started. Start later with: docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder"
    ;;
esac

case "$ENABLE_WORKER" in
  y|Y|yes|YES)
    info "Starting background worker"
    compose --profile worker up -d worker
    ;;
  *)
    warn "Background worker was not started. Start later with: docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker up -d worker"
    ;;
esac

wait_for_app "$LOCAL_HEALTH_HOST" "$APP_PORT"
bootstrap_owner "$LOCAL_HEALTH_HOST" "$APP_PORT" "$OWNER_DISPLAY_NAME" "$OWNER_EMAIL" "$OWNER_PASSWORD"

info "Bouncecore install complete"
printf 'Public URL: %s\n' "$APP_URL"
printf 'Local app: http://%s:%s\n' "$LOCAL_HEALTH_HOST" "$APP_PORT"
printf 'Environment file: %s\n' "$ENV_FILE"
printf '\nUseful commands:\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance ps\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f app\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core up -d stream-core\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker up -d worker\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance pull && docker compose -f docker-compose.instance.yml --env-file .env.instance up -d --build\n'
