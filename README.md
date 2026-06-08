# Bouncecore Platform

Bouncecore is a new all-in-one UK rave/music livestream platform foundation. It is designed to own the public site, accounts, roles, DJ/Streamer dashboards, stream-key management, native chatrooms, merch shop, music marketplace, rewards, mobile APIs, and admin control room.

## Architecture Summary

- Main platform repo: `bouncecore-platform`
- Future stream engine repo: `bouncecore-stream-core`
- The platform owns users, login, roles, dashboards, admin, chat, commerce, music, rewards, stream keys, and mobile APIs.
- Stream-engine code stays behind a replaceable `StreamProvider` boundary.
- Owncast-derived media-server code is not included in this repo; the embedded stream-core exposes compatible control/auth hooks for a future headless ingest/transcode service.

## Chosen Stack

- Next.js 16 App Router
- React 19
- TypeScript 6
- Node.js 24 LTS
- npm 11
- Tailwind CSS 4
- Prisma 7 with PostgreSQL target
- Prisma PostgreSQL driver adapter
- Redis planned for realtime, queues, and presence

## Current Status

This scaffold includes:

- Rave-themed public shell and homepage
- Editable public navigation and stage-1 public modules
- Account dashboard shell
- Admin control room shell with grouped sidebar
- Data-backed streamer dashboard and stream-key management
- Producer dashboard shell
- Central navigation config
- Role and permission constants
- Stream provider interface with mock fallback and stream-core HTTP status provider
- Optional embedded stream-core control service with internal status, playback, health, ingest heartbeat, manual status, and stream-key auth endpoints
- Optional MediaMTX RTMP/HLS gateway profile with Bouncecore stream-key HTTP auth for local/prod ingest trials
- Optional FFmpeg adaptive HLS transcoder profile with low/standard/HD variants and a CORS-enabled HLS origin
- Admin integrations and system-health checks for direct HLS versus adaptive HLS stream-stack readiness
- Admin HLS manifest reachability checks while streams are active, including adaptive variant-count validation
- Worker-backed stream-provider sync that records live/offline transitions into stream sessions and stream events
- Manual admin stream-session sync control with audit logging for provider refreshes
- Database-backed stream profiles for low bitrate through high-HD OBS/transcoding settings
- Adaptive browser playback using HLS variant switching when the playback URL points to a multi-variant `.m3u8` master manifest
- Optional background worker for chat retention pruning and mobile push dispatch/receipt processing
- Health endpoint
- Mobile config endpoint
- Prisma schema and deployed migration set
- Phase 1 RBAC foundation with role and permission catalogue
- Admin Users, Roles, and Permissions pages
- Admin user invite links with hashed invite tokens, role presets, expiry, and revoke controls
- Password/session/token helper scaffolding
- Form-backed login, register, logout, and session route scaffolding
- Dedicated account security page
- Data-backed account overview, profile editor, settings summary, and notifications inbox
- Role-aware account dashboard links for assigned Admin, Moderator, Streamer, Producer, and Supporter workspaces
- Data-backed mobile app configuration API with admin feature flags, maintenance mode, and announcements
- Mobile v1 public feeds for live status, chat, shop, music, and rewards data
- Mobile v1 bearer-token auth and account feeds for profile, notifications, orders, downloads, and rewards
- Mobile v1 account registration and profile update endpoints using the shared session/auth model
- Mobile v1 push-device registration, listing, and revocation using hashed plus encrypted token storage
- Mobile push delivery queue records for admin notification sends, with blocked-state tracking when encryption is missing
- Admin-triggered Expo mobile push dispatch with provider ticket and receipt tracking, plus unsupported-provider blocking
- Token-protected internal mobile push task endpoint for scheduled queue and receipt processing
- Mobile v1 authenticated chat actions for text, Tenor GIFs, live stars, and message reports
- Mobile v1 PayPal checkout start, capture, and cancel endpoints for shop, music, and stars
- Admin notification sender for account/mobile notification surfaces
- Account session directory with current-session sign out and other-session revoke controls
- Native chat GIF search and media messages through the Tenor API
- Automatic chat-history pruning for messages older than 24 hours
- Auto-refreshing public and live chat message feeds
- Chat report intake, admin report review, and global or room-specific chat bans
- Database-backed admin system-health dashboard
- Database-backed admin VIP supporter directory and role controls
- Database-backed admin stream schedule management
- Streamer and public live schedule views
- Data-backed streamer overview, status, and health dashboards
- Data-backed OBS setup help for streamer connection settings
- Data-backed streamer profile editor and public DJ directory
- Data-backed producer profiles, track management, and public music catalogue
- Producer track artwork, MP3 sample uploads, and Google Drive/direct MP3 delivery-link normalization
- Data-backed admin music track management and producer approval queue
- Data-backed merch product catalogue and admin product management
- Merch product image URLs/uploads displayed in public shop cards
- Data-backed account orders, admin order management, and fulfilment queue
- PayPal shop checkout routes with order line items, capture references, and stock decrement on paid orders
- PayPal stars checkout with purchase records, wallet credits, and admin purchase visibility for live support
- PayPal music checkout with track purchase records and producer earnings visibility
- Music download entitlements with buyer downloads, license snapshots, and producer delivery dashboards
- PayPal producer payout batches with recipient setup, local ledger records, and status sync
- Data-backed stars wallets, live chat star sending, stream overlay alerts, and sent-stars leaderboards
- Data-backed reward spin-wheel configuration and prize-claim fulfilment admin
- PayPal-only payment integration foundation for stars, shop checkout, and producer payouts
- Admin integrations readiness overview for PayPal, Tenor GIF search, stream-provider wiring, and public app URLs
- Database-backed admin Site & Design controls for public page cards, public menu labels/order/visibility, and theme colour token overrides
- Initial Prisma migration and Owner bootstrap route at `/setup/owner`
- Docker staging scaffold for isolated app, PostgreSQL, and Redis containers
- GitHub Actions CI for Prisma validation, migrations, lint, typecheck, build, production dependency audit, and installer syntax checks
- Backup and restore scripts for PostgreSQL plus Docker volumes used by uploads, Redis, stream-core state, and adaptive HLS output
- Required planning, design, navigation, stream-boundary, and deployment docs

## Local Development

Use `npm.cmd` in PowerShell if the npm PowerShell shim is blocked by execution policy.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run db:migrate
npm.cmd run db:seed
```

Open the app locally at:

```text
http://localhost:3000
```

## Staging Deployment Target

- Temporary domain: `develop.k-nrg.co.uk`
- VPS: `root@77.68.103.65`
- Target path: `/var/www/bouncecore-platform`

The VPS currently appears to be Plesk-managed. Do not edit global nginx, Apache, mail, database, or unrelated site configs without confirming the Plesk domain layout first.

## Interactive Server Install

For a fresh Linux server with a checked-out copy of this repo, run:

```bash
bash scripts/install-instance.sh
```

The installer prompts for the public URL, bind ports, PostgreSQL database/user/password, stream URLs/tokens, stream-key validation endpoint/token, internal task token, Tenor GIF API key, push-token encryption key, optional Expo push access token, PayPal app details, and the first server-owner account. Database passwords can include normal strong-password punctuation; the installer URL-encodes the database password inside `DATABASE_URL`. It writes `.env.instance`, starts PostgreSQL/Redis/app with `docker-compose.instance.yml`, runs migrations and seeds, then bootstraps the owner account through the setup endpoint.

## Backup and Restore

Create a dated local backup bundle with:

```bash
bash scripts/backup-instance.sh
```

Restore a backup bundle with:

```bash
bash scripts/restore-instance.sh backups/20260608T203000Z
```

Backups can contain private data and paid media files, so keep them out of git and copy them to secure off-server storage. See `docs/BACKUP_RESTORE.md`.

## Optional Media Gateway

The `media-gateway` Docker profile runs MediaMTX for RTMP ingest and HLS playback. It delegates publish authentication to stream-core at `/api/mediamtx/auth`, so only active Bouncecore stream keys are accepted. It is off by default because live stream ports may already be owned by another service.

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway
```

Configure `MEDIA_GATEWAY_PUBLIC_HLS_URL` with a fixed public HLS URL or a `{path}` template. Avoid exposing raw stream keys in public playback URLs; pass stream keys as RTMP credentials/query values whenever possible.

For MediaMTX, set `RTMP_INGEST_URL` as a template such as:

```text
rtmp://develop.k-nrg.co.uk/live?user=bouncecore&pass={streamKey}
```

The streamer dashboard masks `{streamKey}` by default and only resolves the full URL immediately after a key is created or rotated.

On Windows/Docker Desktop, run a local RTMP-to-HLS smoke test with a fresh local stream key:

```powershell
$env:STREAM_TEST_KEY = "bc_live_..."
npm.cmd run stream:smoke
```

The smoke test starts the local stream-core/media-gateway profiles, pulls a disposable FFmpeg Docker image if needed, publishes a realtime test pattern over RTMP, and polls the HLS playlist until it is available.

## Optional Adaptive HLS Transcoder

The `transcoder` Docker profile runs an FFmpeg worker that reads from the internal MediaMTX RTMP stream and writes a multi-variant HLS output to a static Nginx origin. It creates `240p`, `480p`, and `720p` variants plus a `master.m3u8` playlist for browser automatic bitrate switching. It is off by default so it does not claim ports or CPU on servers that already run another stream stack.

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
```

When enabling this path, set:

```text
TRANSCODER_ENABLED=true
TRANSCODER_HLS_PUBLIC_URL=https://develop.k-nrg.co.uk/hls/live/master.m3u8
HLS_PLAYBACK_HEALTH_URL=http://hls-origin/live/master.m3u8
PUBLIC_PLAYBACK_URL=https://develop.k-nrg.co.uk/hls/live/master.m3u8
STREAM_CORE_PUBLIC_PLAYBACK_URL=https://develop.k-nrg.co.uk/hls/live/master.m3u8
```

`HLS_PLAYBACK_HEALTH_URL` is optional and server-side only. Use it when the app container should check an internal HLS origin URL while browsers use the public playback URL.

On Windows/Docker Desktop, run the adaptive smoke test with:

```powershell
$env:STREAM_TEST_KEY = "bc_live_..."
npm.cmd run stream:smoke -- -UseTranscoder
```

The adaptive smoke test requires the HLS master playlist to include at least three variant entries before it passes.

## Secrets Warning

Never commit:

- `.env`
- API keys
- database passwords
- SSH keys
- private tokens
- generated app keys
- raw stream keys
- generated credentials

Use `.env.example` as a template only.

## Next Steps

1. Run the interactive installer against a disposable Linux target and record any server-package edge cases before using it on production.
2. Promote the local MediaMTX/FFmpeg stream stack to a hardened production rollout once VPS stream-port ownership and reverse-proxy routing are confirmed.
3. Extend CI with stream-smoke tests and Docker image build/publish once the stream-core profile is ready for production rollout.
4. Add production monitoring for app health, worker heartbeat, stream-core health, HLS manifest reachability, queue backlog, and PayPal webhook failures.
5. Add encrypted off-server backup upload and retention once the production storage target is chosen.
