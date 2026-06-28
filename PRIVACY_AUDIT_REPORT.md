# Privacy Audit Report

Audit date: 2026-06-21

Scope: Bouncecore website/web application and Android WebView application.

## Services Discovered

### Android

- WebView loading the configured Bouncecore web URL.
- Unity LevelPlay mediation SDK for banner and app-open/interstitial ads.
- Firebase Cloud Messaging for push notifications.
- Google Play services Ads Identifier and App Set support libraries.
- Android notification channel `bouncecore_notifications`.

### Website / Backend

- Next.js web application.
- PostgreSQL via Prisma.
- Redis.
- PayPal checkout, captures, webhooks, and producer payouts.
- SMTP/Brevo-compatible transactional email.
- Tenor GIF search API.
- Firebase Cloud Messaging server dispatch.
- Upload serving for avatars, shop images, sticker assets, music artwork, samples, and downloads.
- Chat, reactions, reports, bans, moderation, roles, stream keys, live streaming, star purchases/sends, reward wheels, orders, downloads, support requests, audit logs.

No analytics package, tracking pixel, Meta/Facebook pixel, Google Analytics tag, or native crash reporting SDK was detected in the audited dependencies and source searches.

## Cookies And Storage Discovered

- `bouncecore_session` cookie for authentication sessions.
- `localStorage` key `bouncecore.shopCart.v1` for shop basket state.
- `localStorage` key `bouncecore.musicCart.v1` for music basket state.
- `localStorage` key `bouncecore.cookieConsent.v1` for privacy/cookie choices.
- Android WebView DOM storage enabled for site operation.
- Server database records for sessions, orders, downloads, chat, notifications, mobile devices, audit logs, and support requests.

## Tracking Technologies Discovered

- Unity LevelPlay advertising SDK and Advertising ID permission.
- Firebase Cloud Messaging tokens and device metadata for push delivery.
- Tenor GIF API calls when a user searches/sends GIFs.
- PayPal payment references and payer email where returned by PayPal.

No first-party analytics tracking was detected.

## Compliance Risks Found

- Native LevelPlay ads could initialize before marketing/ad consent.
- Android notification permission was requested without a clear pre-permission disclosure.
- No website consent manager existed for cookies/local storage or future analytics/marketing scripts.
- Account deletion request flow was missing from account settings.
- Privacy policy links were not visible in all account decision points.
- Google Play Data Safety and cookie inventories were not documented.
- Cookie policy text did not reflect the newer mobile ads, push, shipping, wallet, and consent behavior.

## Fixes Implemented

- Added website cookie/privacy consent manager with Necessary, Analytics, Marketing, and Preferences categories.
- Added persistent privacy choices access and withdrawal/update mechanism.
- Added privacy/terms links on registration, login, checkout, stars purchases, and account settings.
- Added `/mobile/privacy-choices` web page and Android WebView interception for native ad privacy choices.
- Gated Unity LevelPlay initialization and ad requests behind explicit native ad consent.
- Added Android notification pre-permission disclosure before `POST_NOTIFICATIONS`.
- Added account deletion request flow in account settings.
- Updated default legal page copy for privacy and cookie disclosures.
- Added `.env.example` privacy URL configuration values.
- Added focused tests for consent and account deletion validation.
- Generated Google Play and cookie inventory documentation.

## Remaining Manual Actions

- Legal review and final privacy/cookie/terms wording.
- Confirm the real operator identity, privacy contact email, company details, retention periods, and lawful bases.
- Complete Play Console Data Safety and account deletion URL fields.
- Confirm Unity LevelPlay mediated networks and update disclosures for every active ad network.
- If analytics, marketing pixels, attribution, or AdMob are added later, wire them through consent before loading.
- Define and execute the operational deletion/anonymisation runbook for account deletion requests.
- Verify production HTTPS, domain, and reverse proxy headers before launch.
- Keep SDK versions and policies reviewed before every Play release.

## Compliance Assessment

The project now has the technical controls expected for a production compliance baseline: visible policy links, consent choices, native ad gating, notification disclosure, account deletion request flow, secure cookie settings, and audit documentation.

Full legal compliance still requires operator/legal review, accurate live third-party provider declarations, retention policy finalisation, and Play Console completion.
