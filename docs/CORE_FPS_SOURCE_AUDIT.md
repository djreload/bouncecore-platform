# Core FPS Source Audit

## Scope

- Repository: `https://github.com/djreload/core`
- Audited commit: `2ed2b492d5491dfaf41fb883e6646c666e0f6035`
- Audit date: 23 July 2026
- Upstream lineage: `cfoust/sour`, a browser-capable Sauerbraten/Cube 2 server and client

The audited checkout contains 742 tracked paths across a C++ game engine, a
React launcher, Go multiplayer services, an asset pipeline, and a native
WebSocket-to-ENet proxy. This is a complete 3D game stack, not a component that
can safely be copied into the existing Next.js runtime.

## Architecture

| Area | Technology | Responsibility |
| --- | --- | --- |
| Game engine | Sauerbraten/Cube 2 C++, Emscripten 3.1.8, WebGL 2 | Rendering, maps, weapons, movement, physics, menus, and game modes |
| Web client | React 17, Chakra UI 1, Parcel 2, TypeScript 4 | WASM loading, IndexedDB asset cache, server selection, touch controls, and HUD |
| Multiplayer | Go 1.22+, ENet, CBOR, WebSocket | In-process game spaces, packet relay, matchmaking, private games, and demos |
| Storage | Filesystem asset cache, SQLite/GORM, optional Redis | Asset indexes, server data, and runtime state |
| Assets | Python packaging tools and `.sour` bundles | Hashing, compression, map/model discovery, and browser delivery |
| Native proxy | C websockify derivative | Optional browser access to arbitrary ENet/TCP/UDP destinations |

The default server exposes FFA, insta, duel, cooperative editing/exploration,
private game creation, multiple maps, desktop ENet ingress, and browser
WebSocket ingress. The web client includes touch movement/aim/fire controls.

## Security Findings

### Critical boundary findings

1. `pkg/server/ingress/ws.go` accepts WebSockets with
   `OriginPatterns: []string{"*"}`.
2. `HandleLogin` is empty, so the original WebSocket path has no application
   authentication.
3. `client/src/index.tsx` exposes `Module.interop` through
   `window.eval(command)`. The engine command layer intentionally allows game
   scripts to call this bridge.
4. The optional `/service/proxy/` design can connect to arbitrary hosts and
   ports unless strict whitelist files are supplied.
5. The ingress trusts the first raw `X-Forwarded-For` value. That is only safe
   behind a proxy that overwrites, rather than appends to, the header.

These properties make same-origin integration with Bouncecore unacceptable.
Running the client under the primary site origin would put authenticated site
DOM, storage, and non-HttpOnly data in reach of the game scripting bridge.

### Additional hardening findings

- The client build targets Node 14 and React 17. It should remain isolated from
  the Next.js 16/React 19 dependency graph.
- Mobile rendering multiplies device-pixel dimensions and then doubles them
  again. That can create a very large framebuffer and should be profiled before
  enabling the game broadly on phones.
- The WebSocket uses bounded internal queues but the original route has no
  Bouncecore user quota or signed identity.
- Browser assets are retained in IndexedDB and local storage. Privacy
  documentation should identify this as necessary game storage when enabled.
- The source release workflow uses older GitHub action/runtime generations and
  should be modernised independently before publishing new Core binaries.
- The game server and asset cache need CPU, memory, connection, and disk quotas
  at the container/host level before a public launch.

## Licensing Findings

The source is not covered by one single licence:

- Root glue and server code: MIT licence in the Core repository.
- Sauerbraten engine source: zlib licence in
  `game/src/readme_source.txt`.
- ENet: permissive MIT-style licence.
- Sauerbraten game data and artwork: explicitly excluded from the engine source
  licence and governed by their individual notices.
- `client/src/static/readme.txt` identifies a mixture of attribution licences
  and assets marked `ALL RIGHTS RESERVED`.

The runtime image retains the upstream `LICENSE` and `README` files. Before
public commercial distribution, manually inventory the exact maps, models,
textures, sounds, icons, and fonts shipped in the chosen asset bundle. Replace
or obtain permission for any asset whose terms do not cover the intended use.
Do not describe the complete binary asset pack as MIT licensed.

## Data and Privacy

The standalone source does not understand Bouncecore accounts. At runtime it
can process:

- IP address and user-agent-derived device class;
- chosen player name and multiplayer chat;
- gameplay packets, server commands, map/demo data, and session activity;
- browser IndexedDB/local-storage asset and preference data.

The Bouncecore integration sends only a signed user ID and display name in an
expiring launch ticket. It does not send email addresses, payment details,
Bouncecore session cookies, star balances, private messages, or admin secrets.
The current sidecar uses the ticket as an access gate; the in-game alias remains
a game-level display value and must not be treated as authoritative identity
for moderation or commerce.

## Integration Decision

Core is integrated as:

1. a checksum-pinned, non-root runtime container;
2. a separate Nginx authentication gateway;
3. a dedicated HTTPS origin such as `core.bouncecore.example.com`;
4. a sandboxed cross-origin iframe and fullscreen launcher in Bouncecore;
5. a two-hour HMAC-signed launch ticket for signed-in users;
6. an opt-in Compose profile and admin enable switch.

The gateway disables the arbitrary external proxy path and authenticates the
initial page, WebSocket, and HTTP API through a private Bouncecore endpoint.
Static game assets can be fetched without repeatedly calling the app.

## Remaining Core Work

- Publish a fresh runtime release directly from `djreload/core` and replace the
  compatible upstream v0.2.5 artifact currently used by the image.
- Remove or tightly constrain the JavaScript eval bridge in the fork.
- Enforce signed display identity inside the game protocol if authoritative
  names or account-linked moderation are required.
- Add per-user connection quotas and server-side gameplay moderation.
- Profile and cap mobile framebuffer resolution, particles, and frame rate.
- Complete the asset-rights inventory before enabling public production use.
- Add Core-native automated unit/integration tests; the source currently relies
  mainly on build workflows.
