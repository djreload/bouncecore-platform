# Google Play Compliance Guide

This document is for the Bouncecore Android app package `uk.co.bouncecore.app`.

Reference policy sources:

- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Data safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
- Google UMP guidance for AdMob/Google ads: https://developers.google.com/admob/android/privacy

## SDK Inventory

| SDK / service | Purpose | Consent / disclosure status |
| --- | --- | --- |
| Android WebView | Loads the Bouncecore web application. | Disclose account, cookie, and browser storage use in Privacy Policy and Cookie Policy. |
| Unity LevelPlay mediation `9.4.0` | Banner and app-open/interstitial ads. | Gated behind native mobile advertising consent before SDK initialization or ad requests. Uses `LevelPlay.setConsent(...)`. |
| Firebase Cloud Messaging | Push notifications. | Runtime notification permission is preceded by an in-app disclosure on Android 13+. Push can be controlled from account notification settings. |
| Google Play services Ads Identifier `18.1.0` | Advertising ID access for ad SDK use. | Declare Advertising ID and ad/marketing data use in Play Console. Only used when mobile ad consent is granted and ads are enabled. |
| Google Play services App Set `16.0.0` | App set/device support library included by the Android app. | Disclose if used by SDK dependencies. Do not use for ad personalization. |

No native analytics SDK, crash reporting SDK, attribution SDK, location SDK, camera SDK, microphone SDK, or contacts SDK was found.

## Permission Inventory

| Permission | Used for | Sensitive | Current handling |
| --- | --- | --- | --- |
| `android.permission.INTERNET` | WebView, API, ads, push, media. | No | Required for app operation. |
| `android.permission.ACCESS_NETWORK_STATE` | Network availability checks by app/SDKs. | No | Required for app/SDK operation. |
| `android.permission.ACCESS_WIFI_STATE` | Network status by app/SDKs. | Low | Disclose as device/network data. |
| `android.permission.POST_NOTIFICATIONS` | Android push notifications. | Runtime permission | Pre-permission disclosure added before request. |
| `com.google.android.gms.permission.AD_ID` | Mobile ads / measurement through LevelPlay dependencies. | Yes for Play Data Safety | Ads are gated behind native ad consent. Declare Advertising ID usage. |

No camera, microphone, location, contacts, SMS, call log, calendar, or storage permissions were detected.

## Data Collected

Declare collection where applicable:

- Account info: email address, display name, profile details, roles.
- User content: chat messages, reactions, GIF/sticker usage, uploaded avatars, product images, sticker assets, music artwork, audio samples, downloadable files.
- Purchases: PayPal order IDs, capture IDs, payer email where returned by PayPal, order totals, line items, download entitlements, star wallet transactions, producer payout references.
- Shipping info: name, email, phone if supplied, address lines, city, region, postcode, country for physical shop orders.
- App activity: chat activity, stream interactions, purchases, downloads, account actions, support requests, moderation actions.
- App info and performance/security: session records, audit logs, IP/user agent on server requests where logged, stream state, device push token metadata.
- Device or other IDs: Android Advertising ID for ads, Firebase Cloud Messaging token, token hash/preview, app version, device name, OS version, platform.

## Data Shared

Declare sharing/processing by service providers:

- PayPal: checkout, captures, payouts, payer/merchant/payment references.
- Brevo/SMTP provider: transactional email delivery.
- Firebase Cloud Messaging / Google: push notification delivery.
- Unity LevelPlay and mediated ad partners: ads, ad delivery, measurement, fraud prevention when mobile ad consent is granted.
- Tenor: GIF search query and GIF asset retrieval when users search/send GIFs.
- Hosting/database/storage providers: application hosting, database, Redis, uploaded media, logs.

Do not declare sale of personal and sensitive user data unless business practices change.

## Encryption And Security

- Production site and app endpoints should use HTTPS.
- Android manifest has `android:usesCleartextTraffic="false"`.
- Session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Push tokens are encrypted server-side when `PUSH_TOKEN_ENCRYPTION_KEY` is configured.
- PayPal secrets, Firebase service account keys, SMTP keys, and encryption keys must stay in server environment variables only.

## Account Deletion

The app supports account creation. Google Play requires an in-app and web-accessible account deletion request path.

Implemented path:

- Website/account: `/account/settings#delete-account`
- Android app: WebView account settings exposes the same flow.
- Outside-app URL for Play Console: configure a public account deletion help URL, for example `https://bouncecore.example.com/account/settings` or a dedicated public deletion request page if you require non-authenticated requests.

The current implementation creates a tracked account deletion support request. Operators must process deletion/anonymisation and document any retained records required for payment, tax, fraud prevention, security, or legal obligations.

## Consent Implementation

Android:

- LevelPlay ads do not initialize until the user grants mobile advertising consent.
- Users can choose "Allow ads" or "Necessary only".
- The `/mobile/privacy-choices` path opens native privacy choices inside the Android WebView.
- Notification permission is requested only after a pre-permission disclosure.
- UMP is not included because no AdMob / Google Mobile Ads SDK is currently present. If AdMob mediation is added later, add UMP and call `requestConsentInfoUpdate()` on every app launch before Google ad requests.

Website:

- Cookie/privacy consent manager supports Necessary, Analytics, Marketing, and Preferences.
- Necessary is always enabled.
- Optional categories are stored in `localStorage` and can be changed or withdrawn later.
- No analytics or marketing scripts were found at audit time; future scripts must check consent before loading.

## Play Console Data Safety Guidance

Use this as a starting point; the developer/operator remains responsible for final declarations.

- Data collected: Yes.
- Data shared: Yes, with service providers listed above.
- Data encrypted in transit: Yes, when deployed behind HTTPS.
- Users can request deletion: Yes, via account settings and web URL.
- Account creation: Yes.
- Financial info: Purchases and payment references are handled by PayPal. Full card details are not stored by Bouncecore.
- User IDs / device IDs: Declare FCM token/device metadata and Advertising ID for ads.
- App activity: Declare chat, purchases, downloads, interactions, and app feature usage.
- User content: Declare messages, uploads, profile content, stickers/media, music/product content.
- Location: Do not declare unless future code adds location access.
- Photos/videos/audio/files: Declare user-uploaded images/audio/files for profile, shop, sticker, and music features.

## Manual Play Console Actions

1. Add a public Privacy Policy URL in Play Console. Example: `https://bouncecore.example.com/privacy`.
2. Add an account deletion URL in Play Console.
3. Complete Data Safety using this document and current third-party SDK provider guidance.
4. Confirm whether Unity LevelPlay mediated networks require additional consent strings or adapter-specific disclosures.
5. If AdMob is introduced later, add Google UMP and update this document.
6. Confirm the app is not directed to children unless the full Families policy path is implemented.
