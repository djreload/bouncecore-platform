# Bouncecore Platform

Bouncecore is a new all-in-one UK rave/music livestream platform foundation. It is designed to own the public site, accounts, roles, DJ/Streamer dashboards, stream-key management, native chatrooms, merch shop, music marketplace, rewards, mobile APIs, and admin control room.

## Architecture Summary

- Main platform repo: `bouncecore-platform`
- Future stream engine repo: `bouncecore-stream-core`
- The platform owns users, login, roles, dashboards, admin, chat, commerce, music, rewards, stream keys, and mobile APIs.
- Stream-engine code stays behind a replaceable `StreamProvider` boundary.
- Owncast-derived code is not included in this scaffold.

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
- Public navigation and placeholder modules
- Account dashboard shell
- Admin control room shell with grouped sidebar
- Streamer dashboard shell and stream-key placeholder
- Producer dashboard shell
- Central navigation config
- Role and permission constants
- Stream provider interface plus mock provider
- Health endpoint
- Mobile config endpoint
- Initial Prisma schema stub
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

The installer prompts for the public URL, bind ports, PostgreSQL database/user/password, stream URLs/tokens, internal task token, Tenor GIF API key, push-token encryption key, optional Expo push access token, PayPal app details, and the first server-owner account. It writes `.env.instance`, starts PostgreSQL/Redis/app with `docker-compose.instance.yml`, runs migrations and seeds, then bootstraps the owner account through the setup endpoint.

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

1. Wire real authentication, users, roles, and permission guards.
2. Create real PostgreSQL migrations and seeds.
3. Replace mock stream data with provider-backed services.
4. Add secure stream-key creation, reveal, rotate, revoke, and audit logs.
5. Confirm Plesk-safe deployment for `develop.k-nrg.co.uk`.
