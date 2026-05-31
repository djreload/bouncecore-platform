# Stream Core Boundary

## Allowed Owncast-Derived Scope

Owncast-derived or Owncast-inspired code may only be used later for:

- RTMP ingest
- FFmpeg/transcoding
- HLS output/playback
- Live/offline stream status
- Stream health
- Stream key validation
- Recording/VOD if needed
- Internal stream API/webhooks
- Public playback endpoints only where required

## Forbidden Owncast Scope

Bouncecore must not use Owncast for:

- Public site shell
- Public branding
- Admin login
- Admin authentication
- Admin user system
- Built-in chat identity
- Built-in chatroom system
- User/profile logic
- Roles/permissions
- Shop, marketplace, rewards, payments, mobile APIs, or non-streaming admin features

## Headless Stream-Core Design

The future stream core should be a separate headless service controlled by Bouncecore Platform. Normal users never log into it directly. Bouncecore owns the user-facing dashboard and sends internal stream commands through authenticated server-to-server APIs.

Future repo:

- `djreload/bouncecore-stream-core`

Platform repo:

- Keeps only provider interfaces, config, API clients, and product UI.

## Private Internal API

Suggested endpoints:

- `GET /internal/stream/status`
- `GET /internal/stream/health`
- `GET /internal/stream/playback-url`
- `POST /internal/stream/key/create`
- `POST /internal/stream/key/rotate`
- `POST /internal/stream/key/revoke`
- `POST /internal/stream/settings`
- `POST /internal/stream/recording/start`
- `POST /internal/stream/recording/stop`
- `POST /internal/stream/restart`

Suggested webhooks back to Bouncecore:

- `stream.started`
- `stream.stopped`
- `stream.health.warning`
- `stream.health.recovered`
- `recording.started`
- `recording.finished`
- `viewer.count.updated`

## Public Playback Rules

- Public pages may expose playback URLs and live/offline state.
- Public pages must not expose ingest URLs that include secrets.
- Public pages must not expose private stream keys.
- Public APIs must not expose internal stream-core tokens.
- Stream playback should be cache/CDN ready.

## Stream-Key Security Rules

- Generate stream keys with cryptographically strong randomness.
- Store hash, encrypted secret, or public identifier plus secret token.
- Never log raw stream keys.
- Raw stream keys appear only in secure authenticated dashboard/admin views.
- Moderators do not view raw keys by default.
- Stream-key create, rotate, revoke, disable, and reveal events require audit logs.

## Licence Rules

- No Owncast-derived code is copied into the initial platform scaffold.
- Before copying any Owncast-derived code, identify the license and preserve required notices.
- Do not use Owncast trademarks or logos as Bouncecore branding.
- Keep third-party notices in `NOTICE.md` or a dedicated notices file.
- Document which code is original Bouncecore and which code is derived.
