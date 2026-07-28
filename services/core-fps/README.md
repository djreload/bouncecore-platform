# Core FPS Sidecar

This directory packages the web FPS audited from
[`djreload/core`](https://github.com/djreload/core) at commit
`2ed2b492d5491dfaf41fb883e6646c666e0f6035`.

Core is intentionally not bundled into the Next.js process. Its WebAssembly
client includes an engine-to-JavaScript scripting bridge, uses an older React
runtime, and was originally designed to accept unauthenticated WebSockets from
any origin. The sidecar keeps that runtime away from Bouncecore cookies and
protects player connections with signed launch tickets.

## Runtime

The reproducible runtime image currently consumes the checksum-pinned Sour
v0.2.5 Linux artifact. That release is the runtime ancestor of the audited
fork. The fork's later changes affect documentation and asset build tooling,
not the shipped game engine. Update both the URL and SHA-256 together when a
new `djreload/core` runtime artifact is published.

The gateway:

- validates the initial launch and WebSocket through Bouncecore;
- stores the expiring ticket in a Secure, HttpOnly cookie on the game origin;
- redirects the initial ticket URL to a clean address before loading the game;
- blocks the original arbitrary-host `/service/proxy/` surface;
- prevents framing by origins other than the configured Bouncecore origin;
- does not receive PayPal, Square, SMTP, or Bouncecore session secrets.

The telemetry relay sits only between the authenticated gateway WebSocket and
the original runtime WebSocket. It observes authoritative `ServerInfo`,
`Resume`, `Damage`, `Died`, `ScoreFlag`, and map-change packets, associates
them with the gateway-verified account session, and sends debounced snapshots
to Bouncecore. It does not inspect chat text, accept public traffic, or decide
scores in browser code.

Bouncecore keeps the public game hub separate from gameplay:

- `/games/core` contains the start action, controls, score rules, personal
  history, and verified leaderboard;
- `/games/core/play` creates the signed game session and hosts the isolated
  iframe;
- `/api/internal/games/core/telemetry` accepts score snapshots only with the
  independent telemetry secret.

The Bouncecore lobby votes into three fixed runtime spaces: Free For All,
Team Deathmatch, and Capture the Flag. The selected map and mode are locked in
PostgreSQL before launch, and the browser receives only the corresponding
signed join command. CTF uses bundled red/blue flag models with flag cloth
branded during the reproducible runtime image build.

See `docs/CORE_FPS_INTEGRATION.md` and
`docs/CORE_FPS_SOURCE_AUDIT.md` for setup, licensing, and operations.
