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
- Required planning, design, navigation, stream-boundary, and deployment docs

## Local Development

Use `npm.cmd` in PowerShell if the npm PowerShell shim is blocked by execution policy.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
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
