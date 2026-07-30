# Core FPS Integration

Core FPS runs as an optional isolated service. Keep it on a different origin
from the main Bouncecore application.

It is Bouncecore's second chat game, not a replacement for Rave Wars. When
enabled, every signed-in chat user gets a `Core FPS` action in the chat tools
menu. That action opens `/games/core`, where players join a shared countdown
lobby and vote for the next map and game mode. Core has its own runtime, controls, route, and operational
lifecycle; enabling or stopping it does not alter active Rave War matches.

## 1. Create DNS and TLS

Create a dedicated hostname, for example:

```text
core.bouncecore.example.com
```

Point it at the Bouncecore host and issue a normal TLS certificate. Do not
publish port `18443`; it is intentionally bound to `127.0.0.1`.

Example host Nginx server:

```nginx
server {
    listen 443 ssl http2;
    server_name core.bouncecore.example.com;
    access_log off;

    ssl_certificate /etc/letsencrypt/live/core.bouncecore.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/core.bouncecore.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18443;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 24h;
    }
}
```

If Cloudflare is in front, leave WebSockets enabled and bypass caching for
`/ws/*`, `/api/*`, and the HTML document.

Keep query strings out of access logs on this dedicated virtual host because
the initial redirect carries an expiring signed launch ticket. The included
inner gateway disables logging for that request.

## 2. Generate Secrets

Generate three different secrets:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
```

Add the values to the same instance environment used by both Compose and the
Bouncecore app:

```dotenv
CORE_FPS_ENABLED=false
CORE_FPS_PUBLIC_URL=https://core.bouncecore.example.com
CORE_FPS_PARENT_ORIGIN=https://bouncecore.example.com
CORE_FPS_TICKET_SECRET=first-independent-random-secret
CORE_FPS_GATEWAY_SHARED_SECRET=second-independent-random-secret
CORE_FPS_TELEMETRY_SECRET=third-independent-random-secret
CORE_FPS_GATEWAY_BIND_HOST=127.0.0.1
CORE_FPS_GATEWAY_PORT=18443
```

`CORE_FPS_TICKET_SECRET` signs player tickets.
`CORE_FPS_GATEWAY_SHARED_SECRET` protects the private ticket-validation route.
`CORE_FPS_TELEMETRY_SECRET` authenticates score snapshots sent by the isolated
game service. Browser requests are never trusted as score evidence.
None of these values belongs in browser JavaScript or the admin database.

## 3. Build and Start

The first runtime image build downloads and verifies a roughly 285 MB
compressed release artifact. Start only the optional profile:

```bash
docker compose \
  -f docker-compose.instance.yml \
  --env-file .env.instance \
  --profile core-fps \
  up -d --build core-fps core-fps-telemetry core-fps-gateway
```

This does not recreate the app, database, stream, worker, PayPal, or Square
services unless Compose determines a declared dependency is absent.

Check the local gateway:

```bash
curl -fsS http://127.0.0.1:18443/healthz
curl -i http://127.0.0.1:18443/
```

The health endpoint should return `ok`. The root request without a signed ticket
should return `401`.

## 4. Enable the Launcher

1. Open `Admin -> Games -> Core FPS`.
2. Confirm the URL and all three secret checks show `Ready`.
3. Save the dedicated HTTPS game URL.
4. Enable the launcher.
5. Open `/games/core` while signed in, or select `Core FPS` from the chat tools
   menu.
6. Select the maps and modes available to lobby voters.
7. Press `Start game`. Gameplay opens at `/games/core/play`; the hub remains
   the home for controls, personal history, and the verified leaderboard.

The lobby supports `Free For All`, `Team Deathmatch`, and `Capture the Flag`.
Each signed-in participant gets one live map vote and one live mode vote.
Votes lock authoritatively at the end of the countdown; plurality wins and a
tie retains the lobby's seeded choice. CTF is limited to maps with valid red
and blue flag bases. Bouncecore's generated `neonvault` arena is the default
CTF map, with `dust2` and `xmwhub` retained as alternatives.

## Neon Vault arena

`neonvault` is generated during the Core FPS image build rather than copied
from an upstream game package. It includes symmetrical team bases, red and
blue flags, team and free-for-all spawns, weapon and health routes, a central
dancefloor, an upper catwalk, side routes, and original Bouncecore rave
textures.

The geometry generator lives in
`services/core-fps/runtime/neon_vault_map.go`.
`services/core-fps/runtime/install_neon_vault.py` creates the visual assets and
registers the content-addressed map bundle in Core's asset index. This keeps
local, staging, and production builds reproducible.

The launch command joins the isolated runtime space for the winning mode after
assigning the signed runtime player name. CTF uses branded red and blue
Bouncecore flag cloth while retaining the engine's original models and UV
layout. Click the game canvas once to capture keyboard and mouse input. Use
`WASD` to move, the mouse to aim, left click to fire, and `Esc` to release the
pointer.

The launcher creates a two-hour signed ticket and opens the game in a
cross-origin sandbox. The gateway moves the ticket into a Secure, HttpOnly
same-site cookie and redirects to a clean game URL before loading. Core never
receives the Bouncecore session cookie.

Each launch also creates an account-linked `CoreFpsSession`. The signed ticket
contains that session ID and a unique, 15-character runtime player name. Score
telemetry is posted server-to-server to:

```text
POST /api/internal/games/core/telemetry
X-Core-Telemetry-Secret: <CORE_FPS_TELEMETRY_SECRET>
```

The payload carries the signed session and user IDs plus the current
authoritative frags, deaths, damage, team kills, flags, map, and mode. Bouncecore
turns counter changes into durable totals and calculates leaderboard points.
The endpoint must never be called from browser code.

## 5. Operations

View service logs:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f core-fps core-fps-telemetry core-fps-gateway
```

Stop the game without affecting Bouncecore:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile core-fps stop core-fps-gateway core-fps-telemetry core-fps
```

Disable the admin launcher before maintenance so users see the controlled
offline state.

## Security Rules

- Never proxy Core below the main Bouncecore origin.
- Never bind the Core runtime or gateway publicly.
- Never expose `/service/proxy/`.
- Never reuse payment, session, database, SMTP, or stream secrets as Core
  secrets.
- Rotate all three Core secrets if a launch URL or server environment is disclosed.
- Review `docs/CORE_FPS_SOURCE_AUDIT.md` before public commercial distribution.
