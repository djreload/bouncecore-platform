# Bouncecore Platform Blueprint

## Architecture

Bouncecore is a single branded platform that owns the public site, accounts, profiles, roles, admin, chat, commerce, music marketplace, rewards, mobile API, stream-key ownership, and navigation. The initial repo is a modular monolith using Next.js App Router and TypeScript.

The platform is split into modules:

- Core: users, roles, permissions, profiles, audit logs, settings, notifications.
- Live: public live page, stream status, health, playback URL, schedule, stream sessions, provider bridge.
- Stream keys: DJ/Streamer self-service keys plus Owner/Admin management and audit.
- Chat: native rooms, live chat, moderation, overlays, VIP/private rooms.
- Merch shop: products, variants, stock, PayPal checkout, orders, fulfilment.
- Music marketplace: producer profiles, track uploads, approvals, licenses, downloads, sales reports.
- Payments: PayPal-only model for checkout, stars, producer payouts, webhooks, and audit trail.
- Rewards: PayPal-funded stars, donations, supporter rankings, achievements, spin wheel, prize claims.
- Mobile API: config, auth, live, chat, profile, notifications, ads, shop, music, rewards.
- Admin: one organised control room with grouped navigation and consistent tables/forms/actions.

## Stream-Core Boundary

Bouncecore Platform never becomes an Owncast clone. Streaming internals sit behind `StreamProvider`:

- `getStreamStatus()`
- `getPlaybackUrl()`
- `getViewerCount()`
- `getStreamHealth()`
- `rotateStreamKey()`
- `createStreamKeyForUser(userId)`
- `revokeStreamKey(keyId)`
- `updateStreamSettings(settings)`
- `startRecording()`
- `stopRecording()`
- `handleWebhook(payload)`

The current code includes a `MockStreamProvider`. Future providers can target Owncast-derived headless code, Bouncecore Stream Core, or a native provider without changing public/product modules.

## Security Model

- Authentication is owned by Bouncecore.
- Roles: Owner, Admin, Moderator, DJ/Streamer, Producer, Customer, Viewer, Supporter/VIP.
- Permissions are checked at route, service, API, and action layers.
- Moderators cannot view raw stream keys unless a specific extra permission is granted.
- Public DJ profiles show live/offline/verified/scheduled/stream-enabled state only.
- Mobile/public APIs never expose private stream keys.
- Stream-key operations create audit logs.
- Payment and webhook operations require signature verification and idempotency.
- Internal stream APIs require a private token and should bind to localhost or a private network.

## Data Model

The initial Prisma schema starts with:

- Core: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Profile`, `AuditLog`, `Notification`.
- Streaming: `StreamChannel`, `StreamKey`, `StreamSession`, `StreamEvent`.
- Chat: `ChatRoom`, `ChatMessage`.
- Commerce: `Product`, `ProductVariant`, `Order`.
- Music marketplace: `ProducerProfile`, `DigitalTrack`.
- Rewards: `StarWallet`.

The final schema should expand to include all required tables from the brief: stream health checks, recordings, chat members, reactions, moderation actions, bans, timeouts, badges, product images, carts, payments, addresses, fulfilment events, track files, licenses, reviews, entitlements, downloads, reports, rewards, achievements, star transactions, donation events, spin wheels, prize wins, prize claims, mobile settings, feature flags, push tokens, and ad settings.

## API Plan

Public and app routes:

- `GET /api/health`
- `GET /api/mobile/v1/config`
- Future `POST /api/mobile/v1/auth`
- Future `GET /api/mobile/v1/live/status`
- Future `/api/mobile/v1/chat`
- Future `/api/mobile/v1/profile`
- Future `/api/mobile/v1/notifications`
- Future `/api/mobile/v1/ads`
- Future `/api/mobile/v1/shop`
- Future `/api/mobile/v1/music`
- Future `/api/mobile/v1/rewards`

Internal stream routes:

- `GET /internal/stream/status`
- Future `GET /internal/stream/health`
- Future `GET /internal/stream/playback-url`
- Future `POST /internal/stream/key/create`
- Future `POST /internal/stream/key/rotate`
- Future `POST /internal/stream/key/revoke`
- Future `POST /internal/stream/settings`
- Future `POST /internal/stream/recording/start`
- Future `POST /internal/stream/recording/stop`
- Future `POST /internal/stream/restart`

## Admin Panel Plan

Admin uses one sidebar grouped by:

- Overview
- Users & Access
- Live Streaming
- Chat & Moderation
- Music Marketplace
- Merch Shop
- Payments & Money
- Rewards
- Mobile App
- Site & Design
- Settings

Each admin page should use consistent breadcrumbs, heading, description, filters, table actions, bulk actions, audit visibility, and clear empty/error states.

## Public Route Plan

Initial scaffold routes:

- `/`
- `/live`
- `/chat`
- `/djs`
- `/djs/[slug]`
- `/producers`
- `/music`
- `/shop`
- `/rewards`
- `/auth/login`
- `/auth/register`
- `/account`
- `/streamer`
- `/streamer/stream-key`
- `/producer`
- `/admin`

Future routes include product detail, track detail, producer detail, chat room detail, account orders, downloads, security, settings, streamer schedule, streamer status, streamer health, and complete admin resources.

## Mobile API Plan

The mobile API is versioned under `/api/mobile/v1`. It exposes feature flags, public app config, auth token flows, live status, chat, profile, notifications, ads config, shop, music, and rewards. It must never expose server secrets, payment secrets, private stream keys, or internal stream-core tokens.

## Git and Repository Plan

- Local project path: `C:\Users\dj-re\Documents\Bouncecore`
- Repository name: `bouncecore-platform`
- Base branch name: `main`
- Working branch: `feature/initial-bouncecore-platform`
- Preferred remote: `djreload/bouncecore-platform`
- GitHub connector reported the preferred repo as not found or inaccessible, so no remote was added.

Recommended remote setup when ready:

```powershell
git remote add origin git@github.com:djreload/bouncecore-platform.git
git push -u origin feature/initial-bouncecore-platform
```

## Phased Build Plan

1. Core auth, users, roles, admin guards, navigation, design system.
2. Live pages and stream-provider integration.
3. DJ/Streamer keys, public profiles, stream health, OBS setup.
4. Native chatrooms, realtime service, moderation, overlays.
5. Merch shop, checkout model, order dashboard.
6. Music marketplace, uploads, approvals, downloads, producer reports.
7. Rewards, stars, donations, spin wheel, prize fulfilment.
8. Mobile API, push tokens, app config, ad config.
9. Hardening, observability, backups, deployment automation.
10. Separate Bouncecore Stream Core repository and provider integration.
