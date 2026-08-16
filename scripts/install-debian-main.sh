#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${BOUNCECORE_REPO_URL:-https://github.com/djreload/bouncecore-platform.git}"
REPO_BRANCH="${BOUNCECORE_REPO_BRANCH:-main}"
APP_ROOT="${BOUNCECORE_APP_ROOT:-/opt/bouncecore}"
COMPOSE_FILE="$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="$APP_ROOT/.env.instance"
NGINX_SITE_NAME="${BOUNCECORE_NGINX_SITE_NAME:-bouncecore}"

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

prompt_secret_optional() {
  local label="$1"
  local value
  read -r -s -p "$label (leave blank to skip): " value
  printf '\n' >&2
  printf '%s' "$value"
}

generate_secret() {
  openssl rand -hex 32
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    die "This installer needs root privileges. Re-run as root or install sudo."
  fi

  sudo "$@"
}

service_reload() {
  local service_name="$1"

  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl reload "$service_name"
    return
  fi

  run_as_root service "$service_name" reload
}

service_enable_now() {
  local service_name="$1"

  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl enable --now "$service_name"
    return
  fi

  run_as_root service "$service_name" start
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

require_single_line() {
  local label="$1"
  local value="$2"

  case "$value" in
    *$'\n'*|*$'\r'*)
      die "$label must be a single line."
      ;;
  esac
}

compose() {
  run_as_root docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

install_system_dependencies() {
  info "Installing Debian/Ubuntu system dependencies"

  command -v apt-get >/dev/null 2>&1 || die "This installer requires Debian or Ubuntu with apt-get."

  run_as_root apt-get update

  local packages=(
    ca-certificates
    certbot
    curl
    ffmpeg
    git
    gnupg
    nginx
    openssl
    python3-certbot-nginx
    ufw
  )

  if ! command -v docker >/dev/null 2>&1; then
    packages+=(docker.io)
  fi

  if ! run_as_root docker compose version >/dev/null 2>&1; then
    packages+=(docker-compose-plugin)
  fi

  run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
  service_enable_now docker
  service_enable_now nginx

  run_as_root docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is not available after package installation."
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    return
  fi

  info "Configuring firewall rules for HTTPS and RTMPS"
  run_as_root ufw allow OpenSSH >/dev/null || true
  run_as_root ufw allow 80/tcp >/dev/null || true
  run_as_root ufw allow 443/tcp >/dev/null || true
  run_as_root ufw allow 1936/tcp >/dev/null || true

  if run_as_root ufw status | grep -qi "Status: active"; then
    run_as_root ufw reload >/dev/null || true
  else
    warn "ufw is installed but inactive. Rules were added; enable ufw manually after confirming SSH access."
  fi
}

prepare_app_directory() {
  local install_user="${SUDO_USER:-$(id -un)}"
  local install_group

  install_group="$(id -gn "$install_user" 2>/dev/null || printf '%s' "$install_user")"

  run_as_root mkdir -p "$(dirname "$APP_ROOT")"

  if [ -e "$APP_ROOT" ] && [ ! -d "$APP_ROOT/.git" ]; then
    die "$APP_ROOT already exists but is not a git checkout."
  fi

  if [ ! -d "$APP_ROOT" ]; then
    run_as_root mkdir -p "$APP_ROOT"
    run_as_root chown "$install_user:$install_group" "$APP_ROOT"
  fi
}

checkout_repo() {
  info "Pulling Bouncecore from $REPO_URL branch $REPO_BRANCH"

  prepare_app_directory

  if [ -d "$APP_ROOT/.git" ]; then
    git -C "$APP_ROOT" remote set-url origin "$REPO_URL"
    git -C "$APP_ROOT" fetch origin "$REPO_BRANCH"
    git -C "$APP_ROOT" checkout "$REPO_BRANCH"
    git -C "$APP_ROOT" pull --ff-only origin "$REPO_BRANCH"
  else
    git clone --branch "$REPO_BRANCH" --single-branch "$REPO_URL" "$APP_ROOT"
  fi
}

write_nginx_http_config() {
  local site_available="/etc/nginx/sites-available/$NGINX_SITE_NAME.conf"
  local site_enabled="/etc/nginx/sites-enabled/$NGINX_SITE_NAME.conf"

  info "Writing temporary HTTP nginx config for certificate issue"

  run_as_root mkdir -p /var/www/html /etc/nginx/sites-available /etc/nginx/sites-enabled

  run_as_root tee "$site_available" >/dev/null <<NGINX
server {
    listen 80;
    server_name $APP_DOMAIN;

    client_max_body_size 512m;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
NGINX

  run_as_root ln -sfn "$site_available" "$site_enabled"
  run_as_root nginx -t
  service_reload nginx
}

issue_https_certificate() {
  info "Requesting Let's Encrypt certificate for $APP_DOMAIN"

  if [ -d "/etc/letsencrypt/live/$APP_DOMAIN" ]; then
    warn "Existing Let's Encrypt certificate found for $APP_DOMAIN; keeping it."
    return
  fi

  run_as_root certbot certonly \
    --webroot \
    --webroot-path /var/www/html \
    --domain "$APP_DOMAIN" \
    --agree-tos \
    --email "$OWNER_EMAIL" \
    --non-interactive \
    --keep-until-expiring
}

copy_rtmps_certificate() {
  local cert_dir="$APP_ROOT/.instance-certs/rtmps"

  info "Installing trusted certificate for RTMPS"

  run_as_root install -d -m 700 "$cert_dir"
  run_as_root cp -L "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" "$cert_dir/server.crt"
  run_as_root cp -L "/etc/letsencrypt/live/$APP_DOMAIN/privkey.pem" "$cert_dir/server.key"
  run_as_root chmod 644 "$cert_dir/server.crt"
  run_as_root chmod 600 "$cert_dir/server.key"
}

write_nginx_https_config() {
  local site_available="/etc/nginx/sites-available/$NGINX_SITE_NAME.conf"

  info "Writing HTTPS nginx reverse proxy config"

  run_as_root tee "$site_available" >/dev/null <<NGINX
server {
    listen 80;
    server_name $APP_DOMAIN;

    client_max_body_size 512m;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name $APP_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$APP_DOMAIN/privkey.pem;

    client_max_body_size 512m;

    location /hls/ {
        proxy_pass http://127.0.0.1:18889/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        add_header Access-Control-Allow-Origin "*" always;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300;
    }
}
NGINX

  run_as_root nginx -t
  service_reload nginx
}

write_certificate_renewal_hook() {
  local hook_path="/etc/letsencrypt/renewal-hooks/deploy/bouncecore-rtmps.sh"

  info "Writing RTMPS certificate renewal hook"

  run_as_root tee "$hook_path" >/dev/null <<HOOK
#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$APP_ROOT"
APP_DOMAIN="$APP_DOMAIN"
COMPOSE_FILE="\$APP_ROOT/docker-compose.instance.yml"
ENV_FILE="\$APP_ROOT/.env.instance"
CERT_DIR="\$APP_ROOT/.instance-certs/rtmps"

install -d -m 700 "\$CERT_DIR"
cp -L "/etc/letsencrypt/live/\$APP_DOMAIN/fullchain.pem" "\$CERT_DIR/server.crt"
cp -L "/etc/letsencrypt/live/\$APP_DOMAIN/privkey.pem" "\$CERT_DIR/server.key"
chmod 644 "\$CERT_DIR/server.crt"
chmod 600 "\$CERT_DIR/server.key"

if command -v docker >/dev/null 2>&1 && [ -f "\$COMPOSE_FILE" ] && [ -f "\$ENV_FILE" ]; then
  cd "\$APP_ROOT"
  docker compose -f "\$COMPOSE_FILE" --env-file "\$ENV_FILE" --profile stream-core --profile media-gateway restart media-gateway >/dev/null 2>&1 || true
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx >/dev/null 2>&1 || true
fi
HOOK

  run_as_root chmod 700 "$hook_path"
}

write_env_file() {
  local database_password_urlencoded

  database_password_urlencoded="$(urlencode "$POSTGRES_PASSWORD")"

  info "Writing generated instance environment"

  if [ -f "$ENV_FILE" ]; then
    run_as_root cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"
  fi

  run_as_root tee "$ENV_FILE" >/dev/null <<ENV
# Generated by scripts/install-debian-main.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
APP_IMAGE=bouncecore-platform
APP_IMAGE_TAG=instance
APP_CONTAINER=bouncecore-app
APP_BIND_HOST=127.0.0.1
APP_PORT=3000

POSTGRES_CONTAINER=bouncecore-postgres
POSTGRES_DB=bouncecore_platform
POSTGRES_USER=bouncecore_app
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_BIND_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_VOLUME=bouncecore_postgres_data

REDIS_CONTAINER=bouncecore-redis
REDIS_BIND_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_VOLUME=bouncecore_redis_data

DATABASE_URL=postgresql://bouncecore_app:$database_password_urlencoded@postgres:5432/bouncecore_platform
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_APP_URL=$APP_URL
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=$BREVO_SMTP_USER
BREVO_SMTP_KEY=$BREVO_SMTP_KEY
MAIL_FROM=$MAIL_FROM
MAIL_FROM_NAME=$MAIL_FROM_NAME
MAIL_REPLY_TO=$MAIL_REPLY_TO
STREAM_PROVIDER=stream-core
INTERNAL_TASK_TOKEN=$INTERNAL_TASK_TOKEN
STREAM_CORE_INTERNAL_URL=http://stream-core:8088
STREAM_CORE_STATUS_PATH=/status
STREAM_CORE_INTERNAL_TOKEN=$STREAM_CORE_INTERNAL_TOKEN
STREAM_CORE_KEY_VALIDATION_URL=http://app:3000/internal/stream/keys/validate
STREAM_CORE_KEY_VALIDATION_TOKEN=$INTERNAL_TASK_TOKEN
STREAM_CORE_CONTAINER=bouncecore-stream-core
STREAM_CORE_BIND_HOST=127.0.0.1
STREAM_CORE_HTTP_BIND_PORT=18088
STREAM_CORE_VOLUME=bouncecore_stream_core_data
STREAM_CORE_OFFLINE_AFTER_SECONDS=30
STREAM_CORE_PUBLIC_PLAYBACK_URL=$PUBLIC_PLAYBACK_URL
MEDIA_GATEWAY_CONTAINER=bouncecore-media-gateway
MEDIA_GATEWAY_BIND_HOST=127.0.0.1
MEDIA_GATEWAY_RTMP_ENCRYPTION=optional
MEDIA_GATEWAY_RTMP_BIND_HOST=127.0.0.1
MEDIA_GATEWAY_RTMP_BIND_PORT=1935
MEDIA_GATEWAY_RTMPS_BIND_HOST=0.0.0.0
MEDIA_GATEWAY_RTMPS_BIND_PORT=1936
MEDIA_GATEWAY_RTMPS_CERT_DIR=./.instance-certs/rtmps
MEDIA_GATEWAY_HLS_BIND_HOST=127.0.0.1
MEDIA_GATEWAY_HLS_BIND_PORT=18888
MEDIA_GATEWAY_PUBLIC_HLS_URL=$APP_URL/hls/{path}/index.m3u8
HLS_PLAYBACK_HEALTH_URL=http://hls-origin/live/master.m3u8
TRANSCODER_ENABLED=true
HLS_ORIGIN_CONTAINER=bouncecore-hls-origin
TRANSCODER_CONTAINER=bouncecore-media-transcoder
RESTREAMER_CONTAINER=bouncecore-media-restreamer
RESTREAM_TRANSCODE=true
RESTREAM_VIDEO_FPS=30
RESTREAM_KEYFRAME_SECONDS=2
RESTREAM_VIDEO_BITRATE=4500k
RESTREAM_VIDEO_MAXRATE=5000k
RESTREAM_VIDEO_BUFSIZE=9000k
RESTREAM_AUDIO_BITRATE=160k
TRANSCODER_INPUT_URL=rtmp://media-gateway:1935/{path}
TRANSCODER_HLS_BIND_HOST=127.0.0.1
TRANSCODER_HLS_BIND_PORT=18889
TRANSCODER_HLS_PUBLIC_URL=$PUBLIC_PLAYBACK_URL
TRANSCODER_HLS_VOLUME=bouncecore_transcoder_hls
WORKER_CONTAINER=bouncecore-worker
WORKER_CHAT_PRUNE_ENABLED=true
WORKER_CHAT_PRUNE_INTERVAL_SECONDS=3600
WORKER_USER_INVITE_PRUNE_ENABLED=true
WORKER_USER_INVITE_PRUNE_INTERVAL_SECONDS=60
WORKER_STREAM_SYNC_ENABLED=true
WORKER_STREAM_SYNC_INTERVAL_SECONDS=15
WORKER_RAVE_WAR_RECONCILE_ENABLED=true
WORKER_RAVE_WAR_RECONCILE_INTERVAL_SECONDS=10
WORKER_RAVE_WAR_ALERTS_ENABLED=true
WORKER_RAVE_WAR_ALERTS_INTERVAL_SECONDS=30
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

  run_as_root chmod 600 "$ENV_FILE"
}

wait_for_app() {
  info "Waiting for local app health"

  for _ in $(seq 1 90); do
    if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      return
    fi

    sleep 2
  done

  die "App did not become healthy. Check: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs app"
}

curl_config_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

bootstrap_owner() {
  local status_url="http://127.0.0.1:3000/api/setup/status"
  local setup_url="http://127.0.0.1:3000/api/setup/owner"
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

  cat > "$curl_config" <<CURL
url = "$setup_url"
request = "POST"
header = "Content-Type: application/x-www-form-urlencoded"
data-urlencode = "displayName=$(curl_config_escape "$OWNER_DISPLAY_NAME")"
data-urlencode = "email=$(curl_config_escape "$OWNER_EMAIL")"
data-urlencode = "password=$(curl_config_escape "$OWNER_PASSWORD")"
output = "$response_file"
write-out = "%{http_code}"
silent
show-error
max-time = 30
CURL

  http_code="$(curl --config "$curl_config")"
  rm -f "$curl_config" "$response_file"

  case "$http_code" in
    200|303)
      info "Owner bootstrap request accepted."
      ;;
    *)
      die "Owner bootstrap failed with HTTP $http_code."
      ;;
  esac
}

start_services() {
  info "Building app image"
  compose build app

  info "Starting PostgreSQL and Redis"
  compose up -d postgres redis

  info "Running database migrations"
  compose run --rm app npm run db:migrate

  info "Seeding platform defaults"
  compose run --rm app npm run db:seed

  info "Starting web app"
  compose up -d app

  info "Starting stream-core, RTMPS gateway, adaptive HLS, and worker"
  compose --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
  compose --profile worker up -d worker
}

collect_inputs() {
  APP_URL="${BOUNCECORE_PUBLIC_URL:-}"
  if [ -z "$APP_URL" ]; then
    APP_URL="$(prompt "Public HTTPS app URL" "https://bouncecore.example.com")"
  fi
  APP_URL="${APP_URL%/}"

  case "$APP_URL" in
    https://*) ;;
    *) die "Public app URL must start with https:// because this installer configures SSL and RTMPS." ;;
  esac

  APP_HOST="${APP_URL#https://}"
  APP_HOST="${APP_HOST%%/*}"
  APP_DOMAIN="${APP_HOST%%:*}"
  APP_MAIL_HOST="$APP_DOMAIN"
  RTMP_INGEST_URL="rtmps://$APP_DOMAIN:1936/live/{streamKey}"
  PUBLIC_PLAYBACK_URL="$APP_URL/hls/live/master.m3u8"

  OWNER_DISPLAY_NAME="${BOUNCECORE_OWNER_DISPLAY_NAME:-}"
  if [ -z "$OWNER_DISPLAY_NAME" ]; then
    OWNER_DISPLAY_NAME="$(prompt "First Owner display name" "Owner")"
  fi

  OWNER_EMAIL="${BOUNCECORE_OWNER_EMAIL:-}"
  if [ -z "$OWNER_EMAIL" ]; then
    OWNER_EMAIL="$(prompt "First Owner email")"
  fi

  OWNER_PASSWORD="${BOUNCECORE_OWNER_PASSWORD:-}"
  if [ -z "$OWNER_PASSWORD" ]; then
    OWNER_PASSWORD="$(prompt_secret "First Owner password (min 12 chars)")"
    local owner_password_confirm
    owner_password_confirm="$(prompt_secret "Confirm first Owner password")"

    if [ "$OWNER_PASSWORD" != "$owner_password_confirm" ]; then
      die "Owner passwords do not match."
    fi
  fi

  BREVO_SMTP_USER="${BREVO_SMTP_USER:-}"
  if [ -z "$BREVO_SMTP_USER" ]; then
    BREVO_SMTP_USER="$(prompt "Brevo SMTP username")"
  fi

  BREVO_SMTP_KEY="${BREVO_SMTP_KEY:-}"
  if [ -z "$BREVO_SMTP_KEY" ]; then
    BREVO_SMTP_KEY="$(prompt_secret "Brevo SMTP key")"
  fi

  MAIL_FROM="${MAIL_FROM:-}"
  if [ -z "$MAIL_FROM" ]; then
    MAIL_FROM="$(prompt "Site email from address" "no-reply@$APP_MAIL_HOST")"
  fi

  MAIL_FROM_NAME="${MAIL_FROM_NAME:-}"
  if [ -z "$MAIL_FROM_NAME" ]; then
    MAIL_FROM_NAME="$(prompt "Site email sender name" "Bouncecore")"
  fi

  MAIL_REPLY_TO="${MAIL_REPLY_TO:-}"
  if [ -z "$MAIL_REPLY_TO" ]; then
    MAIL_REPLY_TO="$(prompt "Site email reply-to address" "$OWNER_EMAIL")"
  fi

  TENOR_API_KEY="${TENOR_API_KEY:-}"
  if [ -z "$TENOR_API_KEY" ]; then
    TENOR_API_KEY="$(prompt_secret "Tenor API key")"
  fi

  PAYPAL_MODE="${PAYPAL_MODE:-}"
  if [ -z "$PAYPAL_MODE" ]; then
    PAYPAL_MODE="$(prompt "PayPal mode" "sandbox")"
  fi

  PAYPAL_CLIENT_ID="${PAYPAL_CLIENT_ID:-}"
  if [ -z "$PAYPAL_CLIENT_ID" ]; then
    PAYPAL_CLIENT_ID="$(prompt "PayPal client ID")"
  fi

  PAYPAL_CLIENT_SECRET="${PAYPAL_CLIENT_SECRET:-}"
  if [ -z "$PAYPAL_CLIENT_SECRET" ]; then
    PAYPAL_CLIENT_SECRET="$(prompt_secret "PayPal client secret")"
  fi

  PAYPAL_WEBHOOK_ID="${PAYPAL_WEBHOOK_ID:-}"
  if [ -z "$PAYPAL_WEBHOOK_ID" ]; then
    PAYPAL_WEBHOOK_ID="$(prompt "PayPal webhook ID")"
  fi

  PAYPAL_MERCHANT_EMAIL="${PAYPAL_MERCHANT_EMAIL:-}"
  if [ -z "$PAYPAL_MERCHANT_EMAIL" ]; then
    PAYPAL_MERCHANT_EMAIL="$(prompt "PayPal merchant email")"
  fi

  PAYPAL_MERCHANT_ID="${PAYPAL_MERCHANT_ID:-}"
  if [ -z "$PAYPAL_MERCHANT_ID" ]; then
    PAYPAL_MERCHANT_ID="$(prompt "PayPal merchant ID")"
  fi

  EXPO_PUSH_ACCESS_TOKEN="${EXPO_PUSH_ACCESS_TOKEN:-}"
  if [ -z "$EXPO_PUSH_ACCESS_TOKEN" ]; then
    EXPO_PUSH_ACCESS_TOKEN="$(prompt_secret_optional "Expo push access token")"
  fi

  POSTGRES_PASSWORD="$(generate_secret)"
  INTERNAL_TASK_TOKEN="$(generate_secret)"
  STREAM_CORE_INTERNAL_TOKEN="$(generate_secret)"
  PUSH_TOKEN_ENCRYPTION_KEY="$(generate_secret)"

  require_nonempty "Public app URL" "$APP_URL"
  require_nonempty "First Owner email" "$OWNER_EMAIL"
  require_nonempty "First Owner password" "$OWNER_PASSWORD"
  require_nonempty "Brevo SMTP username" "$BREVO_SMTP_USER"
  require_nonempty "Brevo SMTP key" "$BREVO_SMTP_KEY"
  require_nonempty "Site email from address" "$MAIL_FROM"
  require_nonempty "Tenor API key" "$TENOR_API_KEY"
  require_nonempty "PayPal client ID" "$PAYPAL_CLIENT_ID"
  require_nonempty "PayPal client secret" "$PAYPAL_CLIENT_SECRET"
  require_nonempty "PayPal webhook ID" "$PAYPAL_WEBHOOK_ID"
  require_nonempty "PayPal merchant email" "$PAYPAL_MERCHANT_EMAIL"
  require_nonempty "PayPal merchant ID" "$PAYPAL_MERCHANT_ID"

  case "$PAYPAL_MODE" in
    sandbox|live) ;;
    *) die "PayPal mode must be sandbox or live." ;;
  esac

  if [ "${#OWNER_PASSWORD}" -lt 12 ]; then
    die "Owner password must be at least 12 characters."
  fi

  for value_name in \
    APP_URL OWNER_DISPLAY_NAME OWNER_EMAIL OWNER_PASSWORD BREVO_SMTP_USER BREVO_SMTP_KEY \
    MAIL_FROM MAIL_FROM_NAME MAIL_REPLY_TO TENOR_API_KEY PAYPAL_MODE PAYPAL_CLIENT_ID \
    PAYPAL_CLIENT_SECRET PAYPAL_WEBHOOK_ID PAYPAL_MERCHANT_EMAIL PAYPAL_MERCHANT_ID \
    EXPO_PUSH_ACCESS_TOKEN; do
    require_single_line "$value_name" "${!value_name}"
  done
}

info "Bouncecore Debian main-branch auto installer"

collect_inputs
install_system_dependencies
configure_firewall
checkout_repo
write_nginx_http_config
issue_https_certificate
copy_rtmps_certificate
write_certificate_renewal_hook
write_nginx_https_config
write_env_file
start_services
wait_for_app
bootstrap_owner

info "Bouncecore install complete"
printf 'Public URL: %s\n' "$APP_URL"
printf 'OBS server: rtmps://%s:1936/live\n' "$APP_DOMAIN"
printf 'OBS stream key: use the raw key from the streamer dashboard\n'
printf 'App path: %s\n' "$APP_ROOT"
printf 'Environment file: %s\n' "$ENV_FILE"
printf '\nUseful commands:\n'
printf '  cd %s\n' "$APP_ROOT"
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance ps\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f app\n'
printf '  docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway logs -f media-gateway\n'
