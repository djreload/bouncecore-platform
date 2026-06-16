# Generic Deployment Notes

This file captures deployment rules that apply to any Bouncecore Linux server. Use dummy values in committed docs and store real hostnames, IPs, secrets, and panel paths only in private runbooks.

## Safety Rules

- Do not commit `.env`, generated certificates, private keys, API keys, PayPal secrets, SMTP keys, database passwords, or raw stream keys.
- Keep the app bound to localhost behind a reverse proxy unless you have a specific reason to expose it directly.
- Do not edit global nginx, Apache, Plesk, mail, or database configuration without first confirming which sites and services depend on it.
- Back up panel-generated vhost files before changing domain-specific includes.
- Test proxy configuration before reload.
- Keep unrelated streaming services online by using separate RTMP/RTMPS/HLS ports.

## Standard Target

```text
Project path: /opt/bouncecore
Public URL: https://bouncecore.example.com
App bind: 127.0.0.1:3000
PostgreSQL bind: 127.0.0.1:5432
Redis bind: 127.0.0.1:6379
Stream-core bind: 127.0.0.1:18088
MediaMTX RTMP: 1935
MediaMTX RTMPS: 1936
MediaMTX internal HLS: 127.0.0.1:18888
Adaptive HLS origin: 127.0.0.1:18889
```

For RTMPS-first production installs, bind MediaMTX ports separately:

```text
MEDIA_GATEWAY_RTMP_BIND_HOST=127.0.0.1
MEDIA_GATEWAY_RTMPS_BIND_HOST=0.0.0.0
MEDIA_GATEWAY_HLS_BIND_HOST=127.0.0.1
MEDIA_GATEWAY_RTMP_ENCRYPTION=optional
```

## Reverse Proxy

The public HTTPS vhost should proxy:

- `/` to `http://127.0.0.1:3000`
- `/hls/` to `http://127.0.0.1:18889/` when adaptive HLS is enabled

Set the public request body limit to at least `512m`.

## Streaming

Use RTMPS for production ingest:

```text
Server: rtmps://bouncecore.example.com:1936/live
Stream Key: generated in Bouncecore
```

Cloudflare-style web tunnels generally proxy HTTP/HTTPS, not public raw RTMP/RTMPS. Public OBS ingest needs direct TCP exposure, a TCP-capable proxy product, VPN, or a local relay that OBS can reach.

## Rollback

1. Create a backup before deploy.
2. Record the current git commit.
3. Deploy the new commit and run migrations.
4. If rollback is needed, restore the previous commit and app image.
5. Restore the database only from a tested backup when the migration cannot safely run forward.

## Verification

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance ps
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://bouncecore.example.com/api/health
```

When streaming profiles are enabled, also verify:

```bash
curl -fsS http://127.0.0.1:18088/health
curl -fsS https://bouncecore.example.com/hls/live/master.m3u8
```
