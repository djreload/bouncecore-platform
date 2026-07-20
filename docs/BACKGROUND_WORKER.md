# Background Worker

Bouncecore includes an optional worker process in the same app image.

It opens no ports. It is started through the `worker` Compose profile:

```bash
docker compose --env-file .env.instance -f docker-compose.instance.yml --profile worker up -d worker
```

## Current Jobs

- Chat history pruning for messages older than 24 hours.
- Stream provider state synchronization.
- Authoritative Rave War challenge, turn, and match deadline reconciliation.
- Stalled Rave War alerts for active owners and admins, linked to match diagnostics.
- Mobile push dispatch for queued Expo push deliveries.
- Expo push receipt checks for sent deliveries.

## Environment

```bash
WORKER_CHAT_PRUNE_ENABLED=true
WORKER_CHAT_PRUNE_INTERVAL_SECONDS=3600
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
```

The worker uses the same `DATABASE_URL`, push encryption key, and optional Expo access token as the main app. Rave War reconciliation uses the normal authoritative game settlement functions, so timeout winners, chat result messages, events, and realtime updates remain consistent with player-driven requests. A stalled-match alert is created once per operator and match revision after at least 150 seconds without server activity. Expired matches are settled instead of generating stalled alerts.
