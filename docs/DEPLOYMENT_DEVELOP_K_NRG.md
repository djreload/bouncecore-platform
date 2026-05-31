# Deployment Plan for develop.k-nrg.co.uk

## Server Assumptions Discovered

Read-only SSH inspection of `root@77.68.103.65` found:

- Hostname: `server.k-nrg.co.uk`
- OS: Debian GNU/Linux 13.5 trixie
- Kernel: `6.12.74+deb13+1-amd64`
- Running services relevant to hosting:
  - `nginx.service`
  - `apache2.service`
  - `mariadb.service`
  - `docker.service`
  - `php8.4-fpm.service`
  - `plesk-php83-fpm.service`
  - `plesk-ssh-terminal.service`
  - `plesk-task-manager.service`
  - `plesk-web-socket.service`
- Listening ports include 80 and 443 on nginx, 8443 for Plesk, 3306 on localhost for MariaDB, and a Docker proxy on localhost 8080.
- `/var/www` exists.
- `/var/www/bouncecore-platform` does not currently exist.
- `node`, `npm`, `pnpm`, `psql`, `redis-server`, `caddy`, and `certbot` were not detected in PATH.

## Safety Decision

No deployment changes were made because Plesk is present and actively managing nginx/Apache/PHP services. The safe next step is to confirm the Plesk subscription/domain layout for `develop.k-nrg.co.uk` before editing web server configs or installing platform services.

## Target Directory

Target project path:

```bash
/var/www/bouncecore-platform
```

Use this only after confirming it is not managed by another Plesk subscription or unrelated project.

## Stack Install Plan

Recommended server packages and tooling:

```bash
apt update
apt install -y ca-certificates curl gnupg git build-essential
# Install Node.js 24 LTS from the official NodeSource or Node.js distribution path approved for Debian 13.
# Install PostgreSQL 18 from official PostgreSQL packages if Debian default is older.
apt install -y redis-server
```

Do not run these commands until Plesk impact is reviewed.

Current safer staging path: use isolated Docker containers because Docker is already installed and this avoids changing Plesk-managed system packages.

Bouncecore containers:

- `bouncecore-postgres`, bound to `127.0.0.1:5432`
- `bouncecore-redis`, bound to `127.0.0.1:6379`
- `bouncecore-app`, bound to `127.0.0.1:3000`

These containers live in the Compose project defined by `docker-compose.staging.yml` and use Bouncecore-specific Docker volumes.

## Database Plan

- Create a dedicated PostgreSQL database: `bouncecore_platform`.
- Create a dedicated DB user with least privilege.
- Do not reuse MariaDB credentials.
- Do not modify unrelated databases.
- Store `DATABASE_URL` only in server-side `.env`.
- Run Prisma migrations only against the Bouncecore database.

Example once PostgreSQL is safely installed:

```bash
sudo -u postgres createuser --pwprompt bouncecore
sudo -u postgres createdb --owner=bouncecore bouncecore_platform
```

## Web Server and Reverse Proxy Plan

Use Plesk-safe nginx configuration for only `develop.k-nrg.co.uk`:

- App process listens on `127.0.0.1:3000`.
- nginx proxies `https://develop.k-nrg.co.uk` to `http://127.0.0.1:3000`.
- Do not edit unrelated vhosts.
- Back up Plesk-generated config before changes.
- Test nginx config before reload.

## SSL Plan

- Prefer Plesk Let's Encrypt for `develop.k-nrg.co.uk`.
- If Plesk already manages certificates, do not use standalone certbot.
- Verify HTTPS with `curl -I https://develop.k-nrg.co.uk`.

## Queue and Worker Plan

After Redis is installed:

- Run a queue worker as a systemd service.
- Keep queue logs under `/var/log/bouncecore-platform`.
- Use BullMQ for notifications, webhooks, order events, stream events, and scheduled jobs.

## Realtime Chat Service Plan

When chat is implemented:

- Run realtime service on `127.0.0.1:3010`.
- Use Redis for presence and pub/sub.
- Proxy websocket upgrade requests through nginx for only Bouncecore routes.

## Stream-Core Service Plan

Initial platform uses `MockStreamProvider`. Future stream core should run separately:

- Platform: `/var/www/bouncecore-platform`
- Future stream core: separate repo and service
- Internal stream API bound to localhost or private interface
- Internal token stored in `.env`

## Logs

Recommended paths:

- App logs: `/var/log/bouncecore-platform/app.log`
- Worker logs: `/var/log/bouncecore-platform/worker.log`
- Realtime logs: `/var/log/bouncecore-platform/realtime.log`
- nginx/Plesk logs: use Plesk domain log location for `develop.k-nrg.co.uk`

## Backups

- Back up `.env` securely outside git.
- Back up PostgreSQL daily.
- Back up uploaded media if stored locally.
- Prefer S3/R2-compatible object storage for media before production.

## Deployment Commands

Future deployment outline:

```bash
mkdir -p /var/www/bouncecore-platform
cd /var/www/bouncecore-platform
git clone git@github.com:djreload/bouncecore-platform.git .
git checkout codex/phase-1-auth-foundation

# Create .env.staging with server-only secrets before starting containers.
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d postgres redis
docker compose --env-file .env.staging -f docker-compose.staging.yml build app
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm app npm run db:migrate
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm app npm run db:seed
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d app
```

After migrations and seed data are applied, open:

```text
https://develop.k-nrg.co.uk/setup/owner
```

Use it once to create the first Owner account. The route locks itself once an Owner role assignment exists.

## Rollback Plan

- Keep previous release directory or git commit available.
- Stop app service.
- Check out previous known-good commit.
- Run `npm ci` if lockfile changed.
- Run `npm run build`.
- Restart app service.
- Roll back database only with a tested migration rollback plan or restored backup.

## Verification Plan

```bash
node -v
npm -v
git status
npm ci
npm run lint
npm run typecheck
npm run build
curl -I http://127.0.0.1:3000/api/health
curl -I https://develop.k-nrg.co.uk/api/health
```

Do not claim the public URL works until the public curl succeeds.
