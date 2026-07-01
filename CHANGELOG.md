# Changelog

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
- Added interactive Linux instance installer for Docker Compose deployments.
- Added a Debian/Ubuntu main-branch auto installer that pulls from GitHub `main`, generates internal secrets, configures nginx and Let's Encrypt, enables RTMPS by default, and only prompts for public URL plus operating credentials.

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
