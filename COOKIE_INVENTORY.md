# Cookie And Browser Storage Inventory

Audit date: 2026-06-21

## First-Party Cookies

| Name | Purpose | Provider | Expiration | Category |
| --- | --- | --- | --- | --- |
| `bouncecore_session` | Authenticates signed-in users. Server stores only the token hash; cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. | Bouncecore | Session max age from `sessionMaxAgeSeconds` in auth service | Necessary |

## First-Party Browser Storage

| Name | Type | Purpose | Provider | Expiration | Category |
| --- | --- | --- | --- | --- | --- |
| `bouncecore.cookieConsent.v1` | `localStorage` | Stores cookie/privacy category choices and timestamp. | Bouncecore | Until user clears browser data or changes choices | Necessary |
| `bouncecore.shopCart.v1` | `localStorage` | Stores shop basket variant IDs and quantities before checkout. | Bouncecore | Until basket is changed/cleared or browser data is cleared | Necessary |
| `bouncecore.musicCart.v1` | `localStorage` | Stores music basket track IDs before checkout. | Bouncecore | Until basket is changed/cleared or browser data is cleared | Necessary |

## Android App Local Storage

| Name | Type | Purpose | Provider | Expiration | Category |
| --- | --- | --- | --- | --- | --- |
| `bouncecore_privacy.ads_consent_set` | Android SharedPreferences | Records whether the user has made a mobile advertising consent choice. | Bouncecore Android app | Until app data is cleared or choice is changed | Necessary |
| `bouncecore_privacy.ads_marketing_consent` | Android SharedPreferences | Records whether Unity LevelPlay ads may initialize. | Bouncecore Android app | Until app data is cleared or choice is changed | Marketing |
| `bouncecore_privacy.notification_disclosure_shown` | Android SharedPreferences | Prevents repeated notification pre-permission disclosure prompts. | Bouncecore Android app | Until app data is cleared | Necessary |

## Third-Party Cookies / Identifiers

| Provider | Purpose | Trigger | Category | Notes |
| --- | --- | --- | --- | --- |
| PayPal | Checkout, payment approval, capture, payouts. | User starts PayPal checkout or payout flow. | Necessary for purchase/payout transaction | PayPal may set its own cookies/identifiers on PayPal domains. |
| Tenor | GIF search and image delivery. | User searches/sends GIFs. | Necessary for user-requested GIF feature | Search query is sent to Tenor API. |
| Firebase Cloud Messaging | Push notification delivery. | User logs in through Android app with push enabled and permission granted. | Preferences / necessary for requested push delivery | FCM token is encrypted server-side when encryption is configured. |
| Unity LevelPlay and ad partners | Advertising, ad delivery, measurement, fraud prevention. | Android app ads enabled and user grants mobile advertising consent. | Marketing | Advertising ID permission is declared for this use. |

## Consent Categories

- Necessary: required for login, security, carts, checkout, chat, account settings, support, and app operation.
- Analytics: reserved for future analytics tooling; no analytics tool was detected during audit.
- Marketing: advertising, attribution, marketing pixels, or similar technologies.
- Preferences: optional display or experience preferences outside essential service operation.

## Operational Rule

Do not load analytics, marketing pixels, advertising scripts, or attribution scripts on the website until the relevant consent category is granted. The Android app must continue to gate Unity LevelPlay behind native marketing consent.
