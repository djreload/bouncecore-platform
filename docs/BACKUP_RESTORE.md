# Backup and Restore

Bouncecore stores durable instance state in PostgreSQL plus named Docker volumes for uploads, Redis append-only data, stream-core state, and optional transcoder HLS output. Keep backups encrypted or stored somewhere access-controlled; they can contain private user data, paid download files, order data, and chat history.

## Create a Backup

From the checked-out repo on the server:

```bash
bash scripts/backup-instance.sh
```

The script writes a dated folder under `backups/`, for example:

```text
backups/20260608T203000Z/
  manifest.env
  postgres.dump
  volumes/uploads.tar.gz
  volumes/redis.tar.gz
  volumes/stream-core.tar.gz
  volumes/transcoder-hls.tar.gz
```

The PostgreSQL backup is a custom-format `pg_dump` created through the Compose `postgres` service. Volume archives are created with a short-lived Alpine container and the named volumes from `.env.instance`.

Useful options:

```bash
bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups
bash scripts/backup-instance.sh --env-file .env.staging --compose-file docker-compose.staging.yml
bash scripts/backup-instance.sh --skip-volumes
```

## Restore a Backup

Restores are destructive. The restore script stops services that use restored data, restores the database and volume archives, then starts the base `postgres`, `redis`, and `app` services.

```bash
bash scripts/restore-instance.sh backups/20260608T203000Z
```

For automation or an already-approved disaster recovery run:

```bash
bash scripts/restore-instance.sh backups/20260608T203000Z --yes
```

Useful options:

```bash
bash scripts/restore-instance.sh /srv/bouncecore-backups/20260608T203000Z --env-file .env.staging --compose-file docker-compose.staging.yml
bash scripts/restore-instance.sh backups/20260608T203000Z --skip-volumes
bash scripts/restore-instance.sh backups/20260608T203000Z --skip-start
```

After restoring optional services, restart the profiles you actually use:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker up -d worker
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core up -d stream-core
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
```

## Daily Cron Example

Create a directory outside the git checkout and restrict it:

```bash
mkdir -p /srv/bouncecore-backups
chmod 700 /srv/bouncecore-backups
```

Example daily cron entry:

```cron
15 3 * * * cd /var/www/bouncecore-platform && bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups >> /var/log/bouncecore-backup.log 2>&1
```

Prune older local backups only after you have an off-server copy:

```bash
find /srv/bouncecore-backups -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;
```

## Off-Server Copies

Local backups are not enough. Copy backup folders to a separate machine or object storage. A production-ready setup should eventually encrypt each dated backup and upload it to an S3/R2-compatible bucket with lifecycle retention.

## Restore Checks

After a restore:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance ps
curl -fsS http://127.0.0.1:3000/api/health
```

Then verify:

- Login works.
- Admin pages load.
- Uploaded product/track images load.
- Music download entitlements still resolve.
- Chat rooms load recent data as expected.
- Streamer stream keys and stream-core status are still valid if those profiles are enabled.
