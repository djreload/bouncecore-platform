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

require_nonempty() {
  local label="$1"
  local value="$2"

  if [ -z "$value" ]; then
    die "$label is required."
  fi
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

  for command_name in curl git openssl; do
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

APP_URL="$(prompt "Public app URL" "https://develop.k-nrg.co.uk")"
APP_BIND_HOST="$(prompt "App bind host" "127.0.0.1")"
APP_PORT="$(prompt "App host port" "3000")"
POSTGRES_DB="$(prompt "PostgreSQL database name" "bouncecore_platform")"
POSTGRES_USER="$(prompt "PostgreSQL username" "bouncecore_app")"
POSTGRES_PASSWORD="$(prompt_optional_secret "PostgreSQL password")"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_secret)}"
POSTGRES_BIND_HOST="$(prompt "PostgreSQL bind host" "127.0.0.1")"
POSTGRES_PORT="$(prompt "PostgreSQL host port" "5432")"
REDIS_BIND_HOST="$(prompt "Redis bind host" "127.0.0.1")"
REDIS_PORT="$(prompt "Redis host port" "6379")"
STREAM_PROVIDER="$(prompt "Stream provider" "mock")"
STREAM_CORE_INTERNAL_URL="$(prompt "Stream core internal URL" "http://127.0.0.1:8088")"
STREAM_CORE_INTERNAL_TOKEN="$(prompt_optional_secret "Stream core internal token")"
STREAM_CORE_INTERNAL_TOKEN="${STREAM_CORE_INTERNAL_TOKEN:-$(generate_secret)}"
RTMP_INGEST_URL="$(prompt "Public RTMP ingest URL" "rtmp://develop.k-nrg.co.uk/live")"
PUBLIC_PLAYBACK_URL="$(prompt "Public playback URL" "https://develop.k-nrg.co.uk/hls/live.m3u8")"
TENOR_API_KEY="$(prompt_secret_optional "Tenor API key")"
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
require_url_safe "PostgreSQL database name" "$POSTGRES_DB"
require_url_safe "PostgreSQL username" "$POSTGRES_USER"
require_url_safe "PostgreSQL password" "$POSTGRES_PASSWORD"

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

DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_APP_URL=$APP_URL
STREAM_PROVIDER=$STREAM_PROVIDER
STREAM_CORE_INTERNAL_URL=$STREAM_CORE_INTERNAL_URL
STREAM_CORE_INTERNAL_TOKEN=$STREAM_CORE_INTERNAL_TOKEN
RTMP_INGEST_URL=$RTMP_INGEST_URL
PUBLIC_PLAYBACK_URL=$PUBLIC_PLAYBACK_URL
TENOR_API_KEY=$TENOR_API_KEY
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

wait_for_app "$LOCAL_HEALTH_HOST" "$APP_PORT"
bootstrap_owner "$LOCAL_HEALTH_HOST" "$APP_PORT" "$OWNER_DISPLAY_NAME" "$OWNER_EMAIL" "$OWNER_PASSWORD"

info "Bouncecore install complete"
printf 'Public URL: %s\n' "$APP_URL"
printf 'Local app: http://%s:%s\n' "$LOCAL_HEALTH_HOST" "$APP_PORT"
printf 'Environment file: %s\n' "$ENV_FILE"
printf '\nUseful commands:\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance ps\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f app\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance pull && docker compose -f docker-compose.instance.yml --env-file .env.instance up -d --build\n'
