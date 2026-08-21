# Embedded Stream Core

Bouncecore now includes an optional embedded stream-core control service in this repository.

It is intentionally opt-in. Do not start it on a server where another streaming stack already owns the required ports.

## What It Provides

- `GET /health`
- `GET /status`
- `GET /playback-url`
- `POST /events/ingest`
- `POST /status`

The service stores lightweight stream state: live/offline status, playback URL, viewer count, ingest connection state, bitrate, dropped frames, the authenticated ingest path, and the latest stream-key fingerprint. It also exposes the MediaMTX HTTP auth endpoint used to validate Bouncecore stream keys during RTMP publish attempts.

It remains the control and telemetry layer that the platform polls through `STREAM_PROVIDER=stream-core`. The optional Compose media profiles provide the local/prod media path:

- `media-gateway`: MediaMTX RTMP/RTMPS ingest and single-rendition HLS playback.
- `transcoder`: FFmpeg adaptive HLS output plus a CORS-enabled Nginx HLS origin. This is the preferred public playback path for OBS split `Server` plus `Stream Key` ingest because it keeps key-derived MediaMTX paths internal.

## Docker Profile

The service is defined in Compose behind the `stream-core` profile:

```bash
docker compose --env-file .env.instance -f docker-compose.instance.yml --profile stream-core up -d stream-core
```

Staging deploys should not use this profile while the existing Owncast fork is using the stream ports.

The MediaMTX gateway and adaptive HLS transcoder are also profile-gated:

```bash
docker compose --env-file .env.instance -f docker-compose.instance.yml --profile stream-core --profile media-gateway up -d stream-core media-gateway
docker compose --env-file .env.instance -f docker-compose.instance.yml --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
```

## Required Environment

```bash
STREAM_PROVIDER=stream-core
STREAM_CORE_INTERNAL_URL=http://stream-core:8088
STREAM_CORE_STATUS_PATH=/status
STREAM_CORE_INTERNAL_TOKEN=change-me
STREAM_CORE_HTTP_BIND_PORT=18088
STREAM_CORE_OFFLINE_AFTER_SECONDS=30
MEDIA_GATEWAY_PUBLIC_HLS_URL=https://example.com/hls/{path}/index.m3u8
MEDIA_GATEWAY_RTMP_ENCRYPTION=optional
MEDIA_GATEWAY_RTMPS_BIND_PORT=1936
MEDIA_GATEWAY_RTMPS_CERT_DIR=./.instance-certs/rtmps
TRANSCODER_ENABLED=false
TRANSCODER_INPUT_URL=rtmp://media-gateway:1935/{path}
TRANSCODER_HLS_PUBLIC_URL=https://example.com/hls/live/master.m3u8
RESTREAM_TRANSCODE=true
RESTREAM_KEYFRAME_SECONDS=2
STREAM_CORE_PUBLIC_PLAYBACK_URL=https://example.com/hls/live/master.m3u8
```

RTMPS requires `server.crt` and `server.key` in `MEDIA_GATEWAY_RTMPS_CERT_DIR`. The interactive installer creates a self-signed pair when RTMPS is enabled; replace it with a trusted certificate for public production ingest. Standard Cloudflare Zero Trust web tunnels do not expose public raw RTMP/RTMPS for OBS, so remote ingest needs a TCP-capable route such as an open server port, Cloudflare Spectrum, VPN, or cloudflared client access.

Stream-core also exposes `GET /api/transcoder/source` for internal FFmpeg workers. It requires `Authorization: Bearer <STREAM_CORE_INTERNAL_TOKEN>` and returns the current source URL resolved from `TRANSCODER_INPUT_URL`; do not expose this endpoint publicly.

The independent `media-restreamer` and `media-restreamer-secondary` workers read `GET /api/restream/source` and their own protected application target endpoint, then send the outgoing feed to up to two external RTMP/RTMPS platforms. Leave `RESTREAM_TRANSCODE=true` for Facebook Live and YouTube Live; it enforces `RESTREAM_KEYFRAME_SECONDS=2` with libx264 and prevents low-keyframe-rate warnings. `RESTREAM_TRANSCODE=false` keeps the old packet-copy behavior and depends entirely on the incoming OBS keyframe interval.

Mutating endpoints require `Authorization: Bearer <STREAM_CORE_INTERNAL_TOKEN>` or `x-internal-stream-token`.

## Ingest Heartbeat Example

```bash
curl -X POST http://127.0.0.1:18088/events/ingest \
  -H "Authorization: Bearer $STREAM_CORE_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"heartbeat","viewerCount":12,"bitrateKbps":4500,"droppedFrames":0}'
```
