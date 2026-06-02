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
- Password/session/token helper scaffolding
- Form-backed login, register, logout, and session route scaffolding
- Dedicated account security page
- Account session directory with current-session sign out and other-session revoke controls
- Native chat GIF search and media messages through the Tenor API
- Automatic chat-history pruning for messages older than 24 hours
- Auto-refreshing public and live chat message feeds
- Database-backed admin system-health dashboard
- Database-backed admin VIP supporter directory and role controls
- Database-backed admin stream schedule management
- Streamer and public live schedule views
- Data-backed streamer overview, status, and health dashboards
- Data-backed OBS setup help for streamer connection settings
- Data-backed streamer profile editor and public DJ directory
- Data-backed producer profiles, track management, and public music catalogue
- Data-backed admin music track management and producer approval queue
- Data-backed merch product catalogue and admin product management
- Data-backed account orders, admin order management, and fulfilment queue
- PayPal shop checkout routes with order line items, capture references, and stock decrement on paid orders
- PayPal stars checkout with purchase records, wallet credits, and admin purchase visibility
- PayPal music checkout with track purchase records and producer earnings visibility
- Data-backed stars wallets, public rewards, and admin stars controls
- PayPal-only payment integration foundation for stars, shop checkout, and producer payouts
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

The installer prompts for the public URL, bind ports, PostgreSQL database/user/password, stream URLs/tokens, Tenor GIF API key, PayPal app details, and the first server-owner account. It writes `.env.instance`, starts PostgreSQL/Redis/app with `docker-compose.instance.yml`, runs migrations and seeds, then bootstraps the owner account through the setup endpoint.

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
