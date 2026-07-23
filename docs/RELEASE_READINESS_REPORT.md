# Release Readiness Report

Date: 2026-07-23 UTC
Target: Bouncecore production deployment

## Safety controls

- Destructive account, Rave War, payment, refund, and webhook checks were restricted to the local PostgreSQL/Redis/Docker stack.
- The release drill refuses non-local app/database hosts, requires `RELEASE_DRILL_CONFIRM=LOCAL-ONLY`, and refuses PayPal or Square modes other than `sandbox`.
- Production PayPal and Square settings were inspected read-only. Both are in `live` mode and have their required server credentials configured.
- No production purchase, capture, refund, payout, or webhook replay was performed.
- Production payment modes, setting fingerprints, and setting timestamps were unchanged after deployment.

## Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Automated application tests | Passed | 395/395 tests passed after stream, Play preflight, and auth throttling coverage was added. |
| Lint | Passed | ESLint completed without findings. |
| TypeScript | Passed | `tsc --noEmit` completed successfully. |
| Production build | Passed | Optimized Next.js Docker build completed successfully. |
| Rave War lifecycle | Passed | Challenge, notification, acceptance, movement dedupe, firing, turn handoff, timeout, reconnect, completion, decline, and exact refund verified locally. |
| Payment accounting | Passed | Supporter assignment, Square duplicate and partial refunds, PayPal merch restock, music entitlement revocation, and payout blocking verified locally. |
| Fixture cleanup | Passed | Synthetic users, rooms, products, payout batches, and webhook events returned to zero. |
| Local security smoke | Passed | 8/8 checks after upload-auth ordering and baseline response-header hardening. |
| Authentication abuse controls | Passed | Web/mobile login and registration plus password reset use Redis-backed fixed windows with hashed client IDs and bounded local fallback. |
| Dependency and secret scan | Passed | Runtime and full npm audits report zero vulnerabilities; no tracked high-confidence secret patterns found. |
| Android validation | Passed | Debug and signed release version 1.0.14 (15) installed on API 35, consent flows and production WebView loaded, full Android lint passed, and no fatal/network errors were observed. |
| Android release artifacts | Passed | Existing release key produced signed APK/AAB; package, version, signature, generated bundle manifest, and Play preflight verified. |
| Backup restore | Passed | Full backup `20260721T031833Z` restored 57 tables and all four volume archives; temporary resources cleaned. |
| Pre-deploy production backup | Passed | Full backup `20260723T075905Z` verified the database and all four volume archives with zero failures or warnings. |
| Dual-ingest stream soak | Passed | Both HLS playlists advanced for 3,600 seconds, the secondary source promoted after the primary stopped, and both temporary stream keys were revoked. |
| Production post-deploy smoke | Passed | 17 public, 20 authenticated, and 8 security checks passed against `https://bouncecore.co.uk`. |
| Production service isolation | Passed | App and worker moved to the new image; stream-core, gateway, transcoder, HLS origin, and restream container IDs and start times remained unchanged. |

## Remaining manual actions

- Upload the signed AAB to the Google Play internal testing track when the Play Console release is ready.
- Test the release APK on at least one physical Android phone; the current automated pass used an emulator because no physical ADB device was attached.
- Complete a real low-value purchase and refund for each live provider under operator supervision after release. Automated tooling intentionally does not transact against live credentials.
- Obtain legal review of privacy, cookie, terms, refund, and data-retention wording before a formal public launch.

## Release decision

All automated release gates pass and commit `3a9c716` is deployed. Remaining items require operator or legal action and do not indicate an automated deployment failure.
