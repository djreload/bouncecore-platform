# Bouncecore Platform

Bouncecore is a self-hosted livestream and creator-commerce platform for music communities. It combines live video, chat, stream keys, animated chat features, stars donations, merch, music downloads, producer tools, mobile APIs, and an admin control room in one Next.js application.

The project is built to run as a normal web app plus optional worker and stream services. The web app owns users, roles, payments, uploads, chat data, dashboards, and public pages. The stream stack is kept behind service boundaries so it can run locally for testing or be replaced by another compatible provider later.

## Main Capabilities

- Public homepage, live page, music catalogue, merch shop, DJ profiles, and account area.
- Authentication, owner bootstrap, email verification, sessions, invites, RBAC, and role-aware navigation.
- Admin dashboards for users, roles, permissions, menus, pages, theme settings, integrations, system health, chat moderation, supporters, schedules, products, fulfilment, music, stars, and stream keys.
- Live chat with Tenor GIFs, uploaded stickers, animated emoji, message reactions, animated text effects, role badges, reports, bans, auto-scroll, and 24 hour retention pruning.
- Stars donations with PayPal checkout, user wallets, live chat sending, leaderboard data, stream overlay alerts, animations, and alert queueing.
- Streamer dashboard with stream keys, OBS setup, stream health, stream profiles, offline image handling, and optional embedded stream-core.
- Optional MediaMTX RTMP/RTMPS ingest, FFmpeg adaptive HLS transcoding, and browser HLS playback with automatic profile switching.
- Producer dashboards for profile management, track uploads, review state, sample MP3s, artwork, delivery links, sales, downloads, and payout visibility.
- Merch shop with product images, inventory, PayPal checkout, orders, and fulfilment workflow.
- Mobile v1 APIs for public feeds, auth, account data, notifications, orders, downloads, rewards, chat, stars, shop checkout, music checkout, and push devices.
- Background worker for chat pruning, stream-provider sync, mobile push dispatch, push receipt polling, and worker health.
- Backup and restore scripts for PostgreSQL and Docker volumes.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6
- Node.js 24 LTS
- npm 11
- Tailwind CSS 4
- Prisma 7 with PostgreSQL
- Redis for worker and realtime-adjacent state
- Docker Compose for instance deployment
- MediaMTX for optional RTMP/RTMPS ingest
- FFmpeg for optional adaptive HLS transcoding
- PayPal for shop, music, stars, and producer payout flows
- Brevo SMTP for site email and verification
- Tenor API for GIF search

## Repository Layout

```text
src/app/                 Next.js routes, pages, server actions, and API handlers
src/components/          Shared UI and feature components
src/config/              Navigation and platform configuration
src/lib/                 Domain services, auth, permissions, chat, media, payments
src/stream-core/         Embedded stream-core HTTP service
src/workers/             Background worker entrypoint
prisma/                  Prisma schema, migrations, and seed data
public/                  Public assets and upload mount point
android-webview/         Native Android WebView wrapper and Gradle project
deploy/                  Reverse-proxy and service support files
docs/                    Architecture, install, backup, and operations docs
scripts/                 Install, backup, restore, stream smoke, and utility scripts
tests/                   Node-based unit and integration test runner
```

## Local Development

Use `npm.cmd` on Windows PowerShell if the npm shim is blocked by execution policy.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run prisma:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Open the app at:

```text
http://localhost:3000
```

Useful checks:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run security:audit
npm.cmd run build
npm.cmd run smoke:public -- --base-url https://bouncecore.example.com
```

## Production Install

For a fresh Debian/Ubuntu server that should install directly from the GitHub `main` branch, use the auto installer:

```bash
curl -fsSL https://raw.githubusercontent.com/djreload/bouncecore-platform/main/scripts/install-debian-main.sh -o install-bouncecore.sh
bash install-bouncecore.sh
```

This installs system packages, clones or fast-forwards `/opt/bouncecore` from `main`, configures nginx and Let's Encrypt, generates internal secrets, enables RTMPS ingest, starts PostgreSQL, Redis, the app, worker, stream-core, MediaMTX, and adaptive HLS. It prompts for the public URL, first Owner login, Brevo SMTP credentials, Tenor API key, PayPal credentials, and optional Expo push token.

The recommended Ubuntu/Debian install path is Docker Compose with the included interactive installer:

```bash
bash scripts/install-instance.sh
```

The installer asks for the public URL, local bind ports, database name/user/password, email settings, stream settings, Tenor key, PayPal settings, push settings, and the first Owner account. It writes `.env.instance`, builds the app image, starts PostgreSQL and Redis, applies migrations, seeds defaults, starts selected service profiles, and bootstraps the Owner account.

For a full step-by-step Linux install guide, see [docs/INSTALL_UBUNTU_DEBIAN.md](docs/INSTALL_UBUNTU_DEBIAN.md).

## Environment

Start from `.env.example` and replace every placeholder before production use. Important values include:

```text
DATABASE_URL=postgresql://bouncecore:change-me@localhost:5432/bouncecore_platform
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=https://bouncecore.example.com

BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=
BREVO_SMTP_KEY=
MAIL_FROM=no-reply@example.com

STREAM_PROVIDER=mock
INTERNAL_TASK_TOKEN=
STREAM_CORE_INTERNAL_TOKEN=
STREAM_CORE_KEY_VALIDATION_TOKEN=

RTMP_INGEST_URL=rtmps://bouncecore.example.com:1936/live/{streamKey}
PUBLIC_PLAYBACK_URL=https://bouncecore.example.com/hls/live/master.m3u8

TENOR_API_KEY=
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
```

Never commit real `.env` files, generated credentials, API keys, database passwords, PayPal secrets, SMTP keys, push tokens, private stream keys, or RTMPS private keys.

## Service Profiles

Base services:
- Temporary domain: whatever domain
- VPS: a good one
- Target path: `/var/www/bouncecore-platform`

Do not edit global nginx, Apache, mail, database, or unrelated site configs without confirming the domain layout first.

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance up -d postgres redis app
```

Background worker:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker up -d worker
```

Embedded stream core:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core up -d stream-core
```

MediaMTX RTMP/RTMPS gateway:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway
```

Adaptive HLS transcoder:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
```

For OBS, use a separate server URL and stream key:

```text
Server: rtmps://bouncecore.example.com:1936/live
Stream Key: value from the streamer dashboard
```

Dual-DJ smoke testing can create temporary stream keys for a local user, publish two disposable FFmpeg streams, verify primary/secondary ingest state, stop the primary publisher, and verify secondary promotion:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stream-dual-smoke-with-temp-keys.ps1 -UserEmail owner@example.com
```

To use two existing keys instead:

```powershell
$env:STREAM_TEST_KEY="bc_live_primary_key"
$env:STREAM_TEST_KEY_2="bc_live_secondary_key"
npm.cmd run stream:smoke:dual
```

## Upload Limits

The application and production proxy should allow at least 512MB request bodies. Current application limits are:

- Product images and track artwork: 100MB
- Chat stickers and animated emoji: 150MB
- Producer sample MP3 uploads: 100MB
- Producer download MP3 uploads: 200MB
- Next.js server action body limit: 512MB

Production nginx, Apache, Plesk, Caddy, or CDN limits must be raised to match the app or uploads will fail before they reach Next.js.

## Backup and Restore

Create a backup:

```bash
bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups --retention-days 14
```

Verify a backup without restoring it:

```bash
bash scripts/verify-backup-instance.sh --backup-root /srv/bouncecore-backups --latest
```

Run a non-destructive restore drill against a dated backup:

```bash
bash scripts/restore-drill.sh /srv/bouncecore-backups/20260608T203000Z
```

Export a verified backup as an encrypted age package, optionally through rclone:

```bash
bash scripts/export-backup-offsite.sh /srv/bouncecore-backups/20260608T203000Z --age-recipient age1examplepublickey
```

Verify an encrypted off-server backup on a trusted recovery machine:

```bash
bash scripts/verify-offsite-backup.sh 20260608T203000Z.tar.gz.age --identity bouncecore-backup.agekey
```

Install a daily systemd backup timer:

```bash
sudo bash scripts/install-backup-schedule.sh --backup-root /srv/bouncecore-backups --retention-days 14
```

The backup script and timer installer also support `--offsite-age-recipient`, `--offsite-age-recipient-file`, `--offsite-rclone-remote`, and `--offsite-remove-local-after-upload` for automated encrypted off-server copies.

Verified backup status is copied into the uploads volume so Admin -> System health can warn when backups are missing, failed, or stale.
Encrypted off-server export status is also copied into the uploads volume when enabled, so Admin -> System health can warn when the latest export is missing, stale, or local-only.

Restore a backup:

```bash
bash scripts/restore-instance.sh backups/20260608T203000Z
```

Backups include private user data and paid media. Store them encrypted or in access-controlled off-server storage. See [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md).

## Operations Checks

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance ps
docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

For stream testing, use the stream smoke scripts after creating a valid stream key:

```powershell
$env:STREAM_TEST_KEY = "bc_live_example"
npm.cmd run stream:smoke
npm.cmd run stream:smoke -- -UseTranscoder
```

## Documentation

- [CHANGELOG.md](CHANGELOG.md)
- [docs/INSTALL_UBUNTU_DEBIAN.md](docs/INSTALL_UBUNTU_DEBIAN.md)
- [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md)
- [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)
- [docs/EMBEDDED_STREAM_CORE.md](docs/EMBEDDED_STREAM_CORE.md)
- [docs/STREAM_CORE_BOUNDARY.md](docs/STREAM_CORE_BOUNDARY.md)
- [docs/BOUNCECORE_PLATFORM_BLUEPRINT.md](docs/BOUNCECORE_PLATFORM_BLUEPRINT.md)
- [docs/IMPLEMENTATION_PHASES.md](docs/IMPLEMENTATION_PHASES.md)

## License

See [LICENSE_PLACEHOLDER.md](LICENSE_PLACEHOLDER.md). Replace the placeholder before distributing the project publicly.
