# Implementation Phases

## Phase 1: Core Auth, Users, Admin, Navigation, Design System

- Install and configure authentication.
- Create user, role, permission, profile, audit, and setting migrations.
- Add route guards and permission helpers.
- Seed Owner/Admin roles.
- Build real admin tables for users, roles, permissions, and profiles.
- Finalise central navigation and breadcrumbs.
- Expand reusable UI components and empty/error/loading states.

## Phase 2: Live and Stream Provider Integration

- Configure and connect the stream-core HTTP provider for real status, health, playback, and viewer telemetry.
- Add stream channels, sessions, events, health checks, and playback config.
- Add internal stream status and webhook handlers.
- Add live/offline UI states and go-live notification flow.

## Phase 3: DJ/Streamer Stream Keys and Profiles

- Build secure stream-key create, reveal, rotate, revoke, disable flows.
- Hash or encrypt stream keys.
- Add Admin/Owner stream-key management.
- Add OBS setup help.
- Add public DJ profiles without private key exposure.
- Add stream schedule and health panels.

## Phase 4: Chatroom System

- Build native Bouncecore chat rooms.
- Add realtime service with Redis pub/sub.
- Add message history, reactions, badges, emotes-ready structure, GIF/sticker-ready structure.
- Add moderation: delete, timeout, ban, slow mode, lock room, pin message.
- Add overlay events and mobile chat API.

## Phase 5: Merch Shop

- Build products, variants, stock, cart, checkout model, orders, addresses, fulfilment events.
- Add customer order history.
- Add admin fulfilment dashboard.
- Prepare PayPal payment abstraction for stars, shop checkout, and producer payouts.

## Phase 6: Music Marketplace and Producers

- Build producer profiles and dashboard.
- Add track uploads, artwork, audio previews, full file storage, license options.
- Add approval/rejection workflow.
- Add protected downloads and customer library.
- Add producer sales/download reports.

## Phase 7: Rewards, Stars, and Spin Wheel

- Build stars wallet and transactions.
- Add donations and overlay notifications.
- Add supporter rankings and VIP perks.
- Add achievements.
- Add spin wheels, prizes, wins, and prize claims.

## Phase 8: Mobile API

- Expand `/api/mobile/v1`.
- Add mobile auth tokens.
- Add live status, chat, profile, notifications, ads, shop, music, rewards.
- Add admin-controlled app config and feature flags.
- Ensure no server secrets or stream keys are exposed.

## Phase 9: Hardening and Deployment

- Add CI checks.
- Add backup strategy.
- Add logging and monitoring.
- Add rate limits and security headers.
- Add production env templates.
- Configure Plesk-safe reverse proxy, systemd services, SSL, database, Redis, workers.

## Phase 10: Separate Bouncecore Stream Core

- Create `bouncecore-stream-core`.
- Implement headless RTMP/FFmpeg/HLS/health/key-validation service.
- Preserve required third-party notices if Owncast-derived code is used.
- Integrate through `StreamProvider`.
- Keep Bouncecore Platform as the owner of users, keys, chat, admin, and product UI.
