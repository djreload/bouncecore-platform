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

Backups are verified by default after creation. Verification checks the manifest, validates the PostgreSQL dump with `pg_restore --list`, and opens each expected volume archive with `tar`.

Each completed backup also writes:

```text
/srv/bouncecore-backups/latest-backup.env
```

By default the same status is copied into the uploads Docker volume at:

```text
.ops/backup-status.env
```

The app reads that file from `/app/public/uploads/.ops/backup-status.env` and exposes it in Admin -> System health as `Verified backups`.

Useful options:

```bash
bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups
bash scripts/backup-instance.sh --env-file .env.staging --compose-file docker-compose.staging.yml
bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups --retention-days 14
bash scripts/backup-instance.sh --status-volume-path .ops/backup-status.env
bash scripts/backup-instance.sh --skip-status-volume
bash scripts/backup-instance.sh --skip-volumes
bash scripts/backup-instance.sh --skip-verify
```

## Verify a Backup

Run verification without restoring over the live site:

```bash
bash scripts/verify-backup-instance.sh backups/20260608T203000Z
```

Verify the newest backup under a custom backup root:

```bash
bash scripts/verify-backup-instance.sh --backup-root /srv/bouncecore-backups --latest
```

The verifier writes:

```text
backups/20260608T203000Z/verification.env
```

The report includes `status`, `failures`, `warnings`, and `verified_at`. Treat a failed verification as a broken backup until it is investigated.

## Restore Drill

Run a non-destructive restore drill before trusting a backup process in production:

```bash
bash scripts/restore-drill.sh backups/20260608T203000Z
```

The drill creates temporary Docker volumes, a temporary Docker network, and a temporary PostgreSQL container. It restores the database dump and extracts each saved volume archive, then writes:

```text
backups/20260608T203000Z/restore-drill.env
```

The report includes `status`, `failures`, restored database table count, and restored file counts for each volume. Temporary Docker resources are removed automatically unless `--keep` is passed for inspection:

```bash
bash scripts/restore-drill.sh /srv/bouncecore-backups/20260608T203000Z --keep
```

This does not stop or overwrite the live app. Use it as a regular disaster-recovery confidence check after backup-script changes and before major releases.

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

## Automated Backups

Create a directory outside the git checkout and restrict it:

```bash
mkdir -p /srv/bouncecore-backups
chmod 700 /srv/bouncecore-backups
```

Recommended systemd timer installation:

```bash
sudo bash scripts/install-backup-schedule.sh \
  --backup-root /srv/bouncecore-backups \
  --retention-days 14 \
  --on-calendar "*-*-* 03:15:00"
```

Inspect the installed timer:

```bash
systemctl list-timers bouncecore-backup.timer
journalctl -u bouncecore-backup.service -n 100 --no-pager
```

The timer runs verified backups. It also prunes local dated backup folders older than the configured retention period after a successful backup. Keep an off-server copy before relying on local pruning.

System health treats backups as stale after 30 hours by default. Override this with:

```env
BACKUP_STATUS_FILE=/app/public/uploads/.ops/backup-status.env
BACKUP_MAX_AGE_HOURS=30
```

Alternative daily cron entry:

```cron
15 3 * * * cd /var/www/bouncecore-platform && bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups --retention-days 14 >> /var/log/bouncecore-backup.log 2>&1
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
