# Release Freeze Checklist

Use this checklist for every production deployment. A failed required gate stops the release.

## Safety boundary

- [ ] Create and verify a production backup before deployment.
- [ ] Record non-secret fingerprints for `payments.paypal` and `payments.square`.
- [ ] Confirm both production payment modes are `live` without printing credentials.
- [ ] Run checkout, refund, duplicate-webhook, stock, wallet, and payout drills only against the guarded local sandbox.
- [ ] Never copy local `.env*`, payment settings, databases, or upload volumes to production.
- [ ] Keep stream-core, MediaMTX, transcoder, HLS origin, and restream containers running unless their code or configuration changed.

## Required gates

- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm run drill:release:local` passes with `RELEASE_DRILL_CONFIRM=LOCAL-ONLY`.
- [ ] Local security smoke passes.
- [ ] One-hour dual-ingest/HLS soak passes, followed by secondary promotion.
- [ ] Android debug app launches on an emulator or device with no fatal log entries.
- [ ] Signed APK and AAB are built with a version code above the previous release.
- [ ] Play Store preflight passes.
- [ ] A recent full backup restores successfully into temporary resources.

## Deployment

- [ ] Record the source commit and current production image ID.
- [ ] Deploy the app and worker only when stream services are unchanged.
- [ ] Do not run migrations when no new migration exists.
- [ ] Wait for app and worker health before continuing.
- [ ] Run public, authenticated, and security smoke checks against production.
- [ ] Confirm payment setting fingerprints and timestamps are unchanged.
- [ ] Confirm stream containers remained running and their start times did not change.
- [ ] Confirm the public mobile configuration still points to the intended published APK.

## Rollback triggers

Rollback immediately when any of these occur:

- App or worker health does not recover within the deployment window.
- Login, chat, uploads, checkout initiation, live playback, or protected admin access regresses.
- A production payment setting fingerprint changes unexpectedly.
- Stream-core, gateway, transcoder, HLS, or restream services restart unexpectedly.
- Security smoke checks fail after deployment.

Rollback uses the previously recorded source commit and image. Re-run all production smoke checks after rollback.
