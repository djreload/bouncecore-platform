# Embedded Stream Core

Bouncecore now includes an optional embedded stream-core control service in this repository.

It is intentionally opt-in. Do not start it on a server where another streaming stack already owns the required ports.

## What It Provides

- `GET /health`
- `GET /status`
- `GET /playback-url`
- `POST /events/ingest`
- `POST /status`

The service stores lightweight stream state: live/offline status, playback URL, viewer count, ingest connection state, bitrate, dropped frames, and the latest stream-key fingerprint.

It does not replace a full RTMP/HLS media engine yet. It is the control and telemetry layer that the platform can poll through `STREAM_PROVIDER=stream-core`.

## Docker Profile

The service is defined in Compose behind the `stream-core` profile:

```bash
docker compose --env-file .env.instance -f docker-compose.instance.yml --profile stream-core up -d stream-core
```

Staging deploys should not use this profile while the existing Owncast fork is using the stream ports.

## Required Environment

```bash
STREAM_PROVIDER=stream-core
STREAM_CORE_INTERNAL_URL=http://stream-core:8088
STREAM_CORE_STATUS_PATH=/status
STREAM_CORE_INTERNAL_TOKEN=change-me
STREAM_CORE_HTTP_BIND_PORT=18088
STREAM_CORE_OFFLINE_AFTER_SECONDS=30
STREAM_CORE_PUBLIC_PLAYBACK_URL=https://example.com/hls/live.m3u8
```

Mutating endpoints require `Authorization: Bearer <STREAM_CORE_INTERNAL_TOKEN>` or `x-internal-stream-token`.

## Ingest Heartbeat Example

```bash
curl -X POST http://127.0.0.1:18088/events/ingest \
  -H "Authorization: Bearer $STREAM_CORE_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"heartbeat","viewerCount":12,"bitrateKbps":4500,"droppedFrames":0}'
```
