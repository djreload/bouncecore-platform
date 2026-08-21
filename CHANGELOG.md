# Changelog

- Profile pictures now use a dedicated authenticated upload route with a drag, zoom, and position editor that creates an optimized square avatar without sending large phone photos through profile Server Actions.

- User invitations are now consumed immediately after acceptance, expired records are removed automatically by the worker, and Admin Users shows only active pending invitations.

- Kept live chat pinned to incoming messages only while the viewer is near the bottom; readers browsing older messages now retain their position and receive a new-message jump control.
- Moved destructive live-chat moderation controls into a moderator-only dropdown and added named confirmation prompts for message removal and chat bans to prevent accidental actions.
- Removed the legacy Core FPS game, level builder, chat launcher, admin controls, runtime containers, and telemetry worker; added a single mobile-friendly Games hub for Rave Wars, Rewards Wheel, and future games.
- Updated the live video player controls to stay hidden until desktop hover, keyboard focus, or a touch press, then fade away automatically after inactivity.

## Unreleased

- Replaced the former Neon Vault arena with Bouncecore Blocklands, a completely new outdoor voxel world featuring stepped grass-and-dirt terrain, a river and timber bridge, oak-and-stone village houses, forest, crop farm, mine, castle, balanced team routes, and a physical `BOUNCECORE` block mural spanning the castle wall.
- Added server-authoritative Core FPS lobby voting for maps and Free For All, Team Deathmatch, or Capture the Flag, with live vote totals, deterministic tie handling, CTF-safe map selection, a second bundled CTF arena, and branded red/blue Bouncecore flags.
- Hardened Core FPS solo play so spectators no longer displace the bot, AI-owned movement/combat packets reach observers exactly once, and the runtime image runs the bot relay regression test during every build.
- Added worker-driven Core FPS lifecycle reconciliation for stale participants, abandoned launches, disconnected sessions, completed lobbies, persisted results, and realtime result announcements in chat.
- Improved Core FPS reconnect handling by clearing stale session end timestamps, keeping lobby presence alive from verified game telemetry, and preventing completed sessions from being resurrected by delayed packets.
- Added a dedicated completed-match screen that links to scores and chat before returning players to the Core FPS hub automatically.
- Restored Core FPS multiplayer presets and persistent shared arenas, auto-joined players to `lobby`, and added reliable iframe/canvas keyboard focus plus click-to-capture mouse input.
- Fixed Core FPS startup stalls by streaming large mod-data assets through the signed gateway, retrying interrupted downloads, and automatically recovering closed game sockets with capped reconnect backoff.
- Split Core FPS into an account-facing `/games/core` hub and dedicated `/games/core/play` arena, with controls, score rules, live player presence, personal session history, and an all-time top-20 leaderboard.
- Added account-linked Core FPS sessions, signed runtime player identities, a secret-only telemetry API, and a transparent WebSocket relay that records authoritative frags, deaths, damage, team kills, flags, maps, and modes without trusting browser-submitted scores.
- Audited `djreload/core` at commit `2ed2b492`, covering its C++/WebAssembly engine, React launcher, Go/ENet multiplayer server, asset pipeline, licences, privacy surface, and production risks.
- Added an opt-in Core FPS runtime and localhost-only Nginx gateway Compose profile.
- Added signed, expiring player launch tickets and a private gateway validation endpoint.
- Added the signed-in `/games/core` iframe/fullscreen launcher, public navigation item, and Admin -> Games -> Core FPS settings.
- Added Core FPS to the chat tools as a distinct second game for every signed-in chat user, with a shared lobby and no changes to Rave Wars.
- Isolated the imported engine from Bouncecore cookies and secrets, and blocked its original arbitrary external WebSocket proxy surface.
- Added Core FPS DNS/TLS, operations, rollback, security, and mixed-asset-licensing documentation.
- Added a hard-guarded local release drill covering two-player Rave War lifecycle, reconnect recovery, timeout handling, star accounting, Square duplicate refunds, PayPal merch/music refunds, stock restoration, download revocation, payout blocking, and Supporter assignment without permitting live payment modes.
- Added non-mutating security smoke checks for protected admin/upload/Rave War routes, unsigned payment webhooks, upload traversal, HTTPS, and security headers.
- Added a real dual-ingest continuity soak that verifies both publishers, stable primary/secondary assignment, advancing HLS media sequences, and final promotion after primary disconnect.
- Hardened global responses with HSTS, clickjacking, MIME-sniffing, and referrer headers, and moved admin upload authentication ahead of multipart parsing.
- Added a repeatable release freeze checklist and evidence-based release readiness report covering payments, streaming, Android, security, backups, rollback, and post-deploy checks.
- Strengthened Play Store preflight so AAB package and version metadata must match the generated release bundle manifest and stale artifacts are rejected.
- Fixed Android API 23-26 style compatibility, native Rave War control accessibility/RTL behavior, and documented the required JavaScript WebView use so full Android lint passes.
- Added shared Redis-backed request throttling with hashed client identifiers and a bounded local fallback across web/mobile login, registration, and password-reset entry points.
- Added idempotent Rave War entry-fee refunds for declined, cancelled, expired, force-ended, and manually repaired matches, including admin-visible refund state and audit history.
- Added Rave War reconnect recovery on browser focus, page visibility, network restoration, page cache restore, Android app resume, and realtime transport reconnection.
- Added automated Rave War accounting, lifecycle, timeout, reconnect, mobile-layout, private-flow, and admin-repair coverage.
- Added durable Square webhook recording, duplicate protection, retry processing, completed-payment recovery, and PayPal/Square refund reconciliation for stars, merch, and music purchases.
- Added refund-aware stock, wallet, download-entitlement, and producer-payout safeguards so duplicate or partial provider events cannot silently grant value twice.
- Added a release-candidate smoke runner covering public routes, authenticated account pages, admin controls, streamer health, chat, uploads, purchases, notifications, privacy, backups, permissions, and account deletion access.
- Added Android app-resume recovery signaling and automated debug/release compilation checks for mobile Rave War recovery.
- Added participant-authorized private messaging with unread tracking, in-site/mobile alerts, responsive account inboxes, and private image/ZIP sharing whose downloads remain limited to both conversation members.
- Made targeted throwable visuals, motion, impact feedback, and mobile haptics bypass every in-site performance setting while retaining operating-system reduced-motion accessibility support.
- Made targeted throwable delivery fail-safe with immediate animated fallbacks, canvas pixel confirmation, interrupted-load replay, uncached victim polling, burst-safe event retrieval, and guaranteed impact feedback even when custom sprite assets fail.
- Added moderator/admin temporary chat attachments with a paperclip composer action, inline-only image display, ZIP download controls, signature-based validation, active-message download authorization, and automatic file revocation on moderation, room clear, or chat-history pruning.
- Made targeted throwables reliable on the victim's first poll and after visibility interruptions, added static and asset-failure visual fallbacks, and kept GIFs, stickers, emoji, and safe chat-effect styling visible under reduced performance settings.
- Added Admin -> Rave War levels with transparent PNG terrain uploads, server-generated collision heightfields, automatic spawn recommendations, battlefield previews, editable spawn positions, active-level selection, and deletion guards for referenced levels.
- Made successful chat composer notices such as sent messages and throws dismiss automatically after 1.8 seconds, while actionable errors remain visible.
- Added continuous press-and-hold walking to the visible Rave Wars left/right controls for touch and mouse input.
- Reworked account and admin navigation into compact mobile menus and collapsible related submenus with active-route guidance.
- Split account notification delivery and privacy/data controls into focused pages, and added section jump navigation to the long admin settings editor.
- Changed new-user performance preferences to maximum performance by default, with every reduction disabled until the user explicitly changes and saves a setting.
- Kept automatic mobile protection as a clearly labelled optional preset instead of applying it implicitly on mobile devices.

All notable project changes are tracked here. Dates use UTC.

## 0.1.0 - Development Build

### Added

- Created the Bouncecore Next.js platform foundation with App Router, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Redis, Docker, and CI checks.
- Added public homepage, live page, music catalogue, merch shop, DJ profiles, account area, and mobile-friendly navigation.
- Added account registration, login, logout, owner bootstrap, account dashboard, profile editing, settings, session management, security page, notifications, orders, downloads, and rewards views.
- Added role and permission foundations with Viewer, Supporter, Moderator, Developer, Owner, Admin, Streamer, and Producer workspace access patterns.
- Added admin control room sections for users, roles, permissions, invites, menus, public pages, design settings, integrations, system health, chat rooms, chat assets, reports, bans, supporters, schedules, stream keys, products, fulfilment, music, stars, and audit logs.
- Added editable role badge labels, including original-role helper text in the role admin UI and safe propagation into chat rendering.
- Added Brevo SMTP configuration support for site email and email verification flows.
- Added native live chat with GIF search through Tenor, stickers, animated emoji, message reactions, role badges, reports, bans, and auto-scroll to new messages.
- Added permission-based animated chat text effects with a central effect registry, role inheritance, safe class mapping, client/server validation, hidden staff effects, a composer selector, previews, tests, and reduced-motion support.
- Added automatic chat-history pruning for messages older than 24 hours through the worker.
- Added admin-managed custom sticker packs and animated emoji for chat.
- Added stars donation packages, wallet credits, live chat star sending, leaderboards, stream overlay alerts, alert animations, and queued display behavior.
- Added PayPal checkout flows for merch shop purchases, music purchases, stars purchases, and producer payout ledger records.
- Added merch product management with image URLs/uploads, public shop cards, stock tracking, checkout, order management, and fulfilment queues.
- Added producer profile, track management, public music catalogue, track artwork, sample MP3 uploads, download file/link handling, Google Drive direct-download normalization, review queues, sales, downloads, and earnings views.
- Added upload validation and larger configured limits for product/track images, chat assets, sample MP3s, and download MP3s.
- Added mobile v1 APIs for config, public feeds, auth, profile, notifications, orders, downloads, rewards, chat actions, stars, shop checkout, music checkout, and push-device management.
- Added mobile push queue records, dispatch logic, receipt polling, encrypted token storage, and admin notification sends.
- Added data-backed schedule management, streamer/public schedule views, streamer overview, stream health, OBS setup help, profile editing, and public DJ directory.
- Added Rave War Homing Bee guidance, one-use ammo, atomic 10-star launch charging, wind-aware projectiles, full-map camera zoom, native Android zoom controls, and an original layered rave-arena battlefield background.
- Added stream-key management for streamers and admins, including separate OBS server URL and Stream Key display.
- Added optional embedded stream-core HTTP service with status, playback, health, ingest heartbeat, manual status, stream-key auth, and MediaMTX auth hooks.
- Added optional MediaMTX RTMP/RTMPS/HLS gateway profile with Bouncecore stream-key validation.
- Added optional FFmpeg adaptive HLS transcoder profile with 240p, 480p, and 720p variants plus HLS origin service.
- Added browser adaptive HLS playback using HLS.js and automatic variant switching when a master manifest is available.
- Added dual-DJ stream ingest support with primary video/audio, muted picture-in-picture secondary playback, and automatic secondary promotion when the primary publisher disconnects.
- Added dual-DJ stream smoke scripts that publish two disposable FFmpeg streams, validate primary/secondary ingest state, and verify promotion after primary disconnect.
- Added offline stream image handling and live/offline state updates without requiring a browser reload.
- Added worker-backed stream-provider sync, stream sessions, stream events, manual admin sync, and readiness checks.
- Added database-backed stream profiles for low bitrate through high-HD stream configurations.
- Added backup and restore scripts for PostgreSQL and Docker volumes used by uploads, Redis, stream-core state, and transcoder HLS output.
- Added backup verification, local retention pruning, and a Debian/Ubuntu systemd timer installer for automated Bouncecore instance backups.
- Added backup status tracking in the uploads volume and production readiness warnings for missing, failed, or stale verified backups.
- Added a non-destructive restore drill script that restores backups into temporary Docker resources and reports database/table and volume extraction status.
- Added encrypted off-server backup export using age, optional rclone upload, and scheduled-backup integration flags.
- Added off-server backup status reporting in Admin -> System health and production readiness.
- Added a recovery-side verifier for encrypted off-server backup packages.
- Added a guided off-server backup setup helper that validates age/rclone, probes the remote, and installs the backup timer.
- Added verified-backup and off-server backup status cards to Admin -> Storage with the exact repair commands owners need.
- Added Admin -> Storage controls for the external encrypted backup location, with scheduled backups auto-loading the saved config from the uploads volume.
- Added Google Drive as a first-class Admin -> Storage backup destination backed by a configured rclone Drive remote.
- Improved off-server backup readiness wording so it distinguishes missing admin config from a configured destination awaiting its first export.
- Added an Admin -> Storage rewrite action for regenerating the off-server backup config file from saved settings after restores or volume repairs.
- Added an Admin -> Storage `Run backup now` request flow with host-side systemd processing and manual run status reporting.
- Added System health monitoring for queued, running, failed, and completed admin-requested backup runs.
- Added interactive Linux instance installer for Docker Compose deployments.
- Added a Debian/Ubuntu main-branch auto installer that pulls from GitHub `main`, generates internal secrets, configures nginx and Let's Encrypt, enables RTMPS by default, and only prompts for public URL plus operating credentials.
- Added a per-account Resource Monitor with browser-reported battery, frame-rate, long-task, memory, network, media, animation, and page-size readings.
- Added persisted battery and heat controls for livestream quality, second-DJ video, background playback, animations, particles, animated chat media, haptics, realtime polling, and native Android ads.
- Added automatic mobile protection for Android, data-saver connections, and lower-resource devices, plus a stronger manually enabled Battery Saver.

### Changed

- Reworked the live page into a full-page viewing layout with larger video, side chat on desktop, mobile sticky video, translucent mobile chat overlay, compact mobile composer controls, and social links below the player/chat area.
- Consolidated mobile navigation into a usable menu for small screens.
- Moved star sending/buying on mobile behind compact chat controls to preserve video/chat space.
- Swapped role-badge wording so server ownership and stream ownership can be presented clearly through configurable labels.
- Updated OBS guidance so RTMP/RTMPS server URL and stream key are shown separately.
- Increased upload limits to: product/track images 100MB, chat stickers/animated emoji 150MB, sample MP3s 100MB, download MP3s 200MB, and server action body limit 512MB.
- Rewrote public repository docs to use dummy domains and generic deployment examples.
- Replaced environment-specific README deployment notes with a portable install and operations summary.
- Split MediaMTX RTMP, RTMPS, and HLS bind-host settings so production installs can expose RTMPS publicly while keeping unencrypted RTMP and HLS origins local.
- Changed external restream output to transcode by default with a forced 2 second keyframe interval for Facebook/YouTube RTMP compatibility.
- Reduced fallback polling frequency, animated chat DOM, overlay particles, dual-video decoding, HLS quality, haptics, and Android ad activity when the effective performance profile disables them.
- Disabled Android WebView off-screen prerastering and made native ad and vibration activity respond immediately to the signed-in user's performance settings.
- Grouped Resource Monitor controls by quick protection, visual/chat media, livestream playback, and network/native app usage, with consistent reduction-style switch labels and detailed usage guidance.

### Fixed

- Fixed chat role badge labels not updating outside the roles page after label changes were saved.
- Fixed live chat badge rendering so updated labels appear beside sent messages.
- Fixed mobile live layout overflow and chat panel overhang issues.
- Fixed upload body-size failures caused by app/proxy limits not matching media requirements.
- Fixed producer track save failures caused by upload validation and request-size limits.
- Fixed producer artwork, sample MP3, and download MP3 uploads by uploading media through a dedicated producer upload API before saving track metadata.
- Fixed uploaded artwork and MP3 playback returning 404 in production by adding a runtime `/uploads/...` file-serving route with byte-range support.
- Fixed local Streamlabs/OBS connection behavior by supporting separate RTMP/RTMPS server URL and stream key values.
- Fixed live page social/menu placement issues on mobile.
- Fixed app example configuration and docs so public repo material does not include real deployment hostnames.
- Fixed the chat GIF picker opening with an empty result grid by automatically loading the first search page and exposing an inline retry action.

### Security

- Removed real-looking credentials and deployment host references from tracked example/documentation material.
- Added guidance to keep `.env`, API keys, database passwords, stream keys, private RTMPS keys, and generated tokens out of git.
- Added server-side validation for role-gated chat text effects so clients cannot force unauthorized effect IDs.
- Added internal tokens for stream-core and worker/task endpoints.
- Added hashed or encrypted handling patterns for sensitive tokens where supported by the feature.

### Documentation

- Added this changelog.
- Rewrote the README as a portable project overview.
- Added a complete Ubuntu/Debian install and setup guide.
- Added generic deployment notes to replace environment-specific deployment documentation.
