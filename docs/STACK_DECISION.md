# Bouncecore Stack Decision

## Chosen Stack

Bouncecore starts as a TypeScript-first modular monolith:

- Next.js 16.2.6 App Router
- React 19.2.6
- TypeScript 6.0.3
- Node.js 24 LTS runtime
- npm 11 package manager
- Tailwind CSS 4.3.0
- Prisma 7.8.0 ORM
- PostgreSQL 18 target database
- Redis target cache, pub/sub, presence, and queue backing store
- Zod 4.4.3 validation
- Better Auth planned for Phase 1 authentication
- BullMQ planned for jobs and scheduled work
- Socket.IO or a lightweight WebSocket service planned for realtime chat and presence
- Nginx reverse proxy, managed through Plesk-safe configuration on the staging VPS

## Why This Stack

Bouncecore needs one polished product shell, complex dashboards, public pages, mobile API endpoints, realtime chat/events, role-aware navigation, and a replaceable stream-provider boundary. A TypeScript-first Next.js platform gives the fastest route to a cohesive web app and API surface without splitting the first release into unnecessary microservices.

The initial architecture is a modular monolith because the product has many domains but one shared account, permission, navigation, and admin experience. Realtime chat and queue workers can run as separate Node processes when they need persistent connections or background processing.

## Alternatives Considered

- Laravel, Inertia, Livewire, or Filament: strong admin and commerce ecosystem, but this project benefits more from one TypeScript codebase, React UI, and native realtime/mobile API alignment.
- NestJS API plus Next.js frontend: strong separation, but too much initial operational overhead for the first scaffold.
- Fastify or Hono API plus Next.js frontend: attractive for lightweight APIs, but the current priority is a unified product shell.
- SvelteKit or Nuxt: capable, but React and Next have the strongest fit for the requested dashboard/admin/component ecosystem.
- Go or Rust: better reserved for the future stream core or high-throughput services, not the first platform shell.

## Why Laravel/PHP Was Not Chosen

The VPS already has PHP 8.4 and Plesk PHP services, so Laravel is available in principle. It was not chosen because Bouncecore's first platform needs a React-heavy UI, role-aware navigation, mobile API scaffolding, and future realtime chat/event surfaces that fit cleanly in a TypeScript stack. PHP remains useful on the server for existing Plesk-managed sites, but Bouncecore should not inherit that shape by default.

## Runtime Versions

Local versions detected:

- Node.js: v24.14.1
- npm: 11.11.0
- Git: 2.47.0.windows.1

Project package versions:

- next: 16.2.6
- react: 19.2.6
- react-dom: 19.2.6
- tailwindcss: 4.3.0
- prisma: 7.8.0
- @prisma/client: 7.8.0
- zod: 4.4.3
- lucide-react: 1.17.0
- eslint: 9.39.4

Server versions discovered:

- OS: Debian GNU/Linux 13.5 trixie
- Kernel: 6.12.74+deb13+1-amd64
- Web services: nginx and Apache running under Plesk
- Database currently present: MariaDB 11.8.6
- PHP services: php8.4-fpm and plesk-php83-fpm
- Node/PostgreSQL/Redis: not detected during read-only inspection

## Package Manager Choice

npm is used for the initial scaffold because it is installed locally and works via `npm.cmd`. pnpm was not installed locally. The project can move to pnpm later if the deployment environment standardises on Corepack-managed pnpm.

## Database Choice

PostgreSQL is the target database because it is mature, transactional, well supported by Prisma, and a good fit for orders, permissions, stream sessions, chat history, marketplace metadata, and audit logs.

MariaDB is already installed on the VPS, but using it would couple Bouncecore to existing Plesk database choices and weaken the long-term fit for this TypeScript/Prisma architecture. PostgreSQL should be installed only after confirming it will not conflict with Plesk operations.

## ORM Choice

Prisma is chosen for the initial schema because it gives clear TypeScript types, migrations, and a readable data model for a broad product domain. The initial schema is a scaffold, not a final migration set.

## Realtime and Chat Architecture

The platform will own chat identity, room membership, moderation, history, badges, and overlay events. Realtime delivery should be a Node service using WebSockets with Redis pub/sub or a Socket.IO Redis adapter when scaled beyond one process. Next.js owns the page shell and API contracts; the realtime service owns persistent connections.

## Queue and Job Architecture

BullMQ backed by Redis is the planned queue layer for notifications, emails, payment webhooks, order fulfilment events, stream events, prize claim processing, scheduled jobs, and mobile push notifications.

## Deployment Architecture

Initial local scaffold only:

- Next.js app builds as a standalone Node process.
- Future staging should run under `/var/www/bouncecore-platform`.
- A systemd service should run the Next.js server.
- Separate systemd services should run the realtime worker and queue worker once implemented.
- Plesk-safe nginx reverse proxy should route `develop.k-nrg.co.uk` to the local app port.

## Reverse Proxy Choice

Nginx is already active on the VPS and appears to be part of the Plesk web stack. Use nginx through Plesk-safe include files or Plesk domain configuration. Do not overwrite global nginx, Apache, or mail configs.

## Security Considerations

- Never commit `.env` or generated keys.
- Store stream keys as hashes or encrypted secrets, never plain text.
- Show raw stream keys only in authenticated dashboard/admin views.
- Never log raw stream keys.
- Public and mobile APIs must never expose private stream keys.
- Roles and permissions must guard every dashboard/admin action.
- Stream-core internal APIs require server-side tokens and network restrictions.
- Webhooks require signature verification.
- Audit logs are required for stream-key, role, payment, moderation, and admin actions.

## Known Tradeoffs

- A modular monolith reduces early deployment complexity but requires disciplined module boundaries.
- Next.js API routes are not ideal for long-lived WebSocket connections, so realtime should become a separate process.
- Prisma gives strong developer speed, but very high-volume chat history may later need careful indexing, partitioning, or a dedicated event store.
- PostgreSQL is not currently installed on the VPS, so deployment needs a careful Plesk-safe install step.
- `npm audit` currently reports moderate advisories in transitive `prisma` and `next` dependencies. The suggested `npm audit fix --force` would downgrade major packages, so it was not applied.

## Exact Install Commands Used

Local commands used during this scaffold:

```powershell
git branch -m main
git switch -c feature/initial-bouncecore-platform
npm.cmd view next version
npm.cmd view react version
npm.cmd view tailwindcss version
npm.cmd view prisma version
npm.cmd view @prisma/client version
npm.cmd view zod version
npm.cmd view lucide-react version
npm.cmd install
```

Attempted command that was abandoned because the workspace folder name contains a capital letter:

```powershell
npx.cmd create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

## Exact Services Configured

No server services were configured in this pass. The VPS was inspected read-only. No Plesk, nginx, Apache, database, firewall, mail, Docker, or domain configuration was modified.

## Upgrade Strategy

- Keep Node on the active LTS line.
- Update Next.js and React in a feature branch, then run lint, typecheck, build, and smoke tests.
- Use Prisma migrations only after the Bouncecore PostgreSQL database exists.
- Keep stream-provider integrations behind the provider interface so the future Bouncecore Stream Core can replace mock or Owncast-derived providers.
- Track security advisories with `npm audit`, but do not apply `npm audit fix --force` without reviewing breaking changes.
- Prisma 7 keeps connection URLs in `prisma.config.ts`, not in `schema.prisma`. The scaffold uses a non-secret local fallback URL so `prisma generate` can run before a real `.env` exists.

## Sources Checked

- Node.js release status: https://nodejs.org/en/about/releases/
- PostgreSQL latest major version: https://www.postgresql.org/
- npm package versions were checked with `npm.cmd view`.
- Prisma configuration format: https://docs.prisma.io/docs/v6/orm/reference/prisma-config-reference
