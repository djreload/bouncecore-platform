# Core FPS Integration

Core FPS runs as an optional isolated service. Keep it on a different origin
from the main Bouncecore application.

It is Bouncecore's second chat game, not a replacement for Rave Wars. When
enabled, every signed-in chat user gets a `Core FPS` action in the chat tools
menu. That action opens `/games/core`, where all players enter Core's shared
default lobby. Core has its own runtime, controls, route, and operational
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

Generate two different secrets:

```bash
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
CORE_FPS_GATEWAY_BIND_HOST=127.0.0.1
CORE_FPS_GATEWAY_PORT=18443
```

`CORE_FPS_TICKET_SECRET` signs player tickets.
`CORE_FPS_GATEWAY_SHARED_SECRET` protects the private ticket-validation route.
Neither value belongs in browser JavaScript or the admin database.

## 3. Build and Start

The first runtime image build downloads and verifies a roughly 285 MB
compressed release artifact. Start only the optional profile:

```bash
docker compose \
  -f docker-compose.instance.yml \
  --env-file .env.instance \
  --profile core-fps \
  up -d --build core-fps core-fps-gateway
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
2. Confirm the URL and both secret checks show `Ready`.
3. Save the dedicated HTTPS game URL.
4. Enable the launcher.
5. Open `/games/core` while signed in, or select `Core FPS` from the chat tools
   menu.

The launcher creates a two-hour signed ticket and opens the game in a
cross-origin sandbox. The gateway moves the ticket into a Secure, HttpOnly
same-site cookie and redirects to a clean game URL before loading. Core never
receives the Bouncecore session cookie.

## 5. Operations

View service logs:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f core-fps core-fps-gateway
```

Stop the game without affecting Bouncecore:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile core-fps stop core-fps-gateway core-fps
```

Disable the admin launcher before maintenance so users see the controlled
offline state.

## Security Rules

- Never proxy Core below the main Bouncecore origin.
- Never bind the Core runtime or gateway publicly.
- Never expose `/service/proxy/`.
- Never reuse payment, session, database, SMTP, or stream secrets as Core
  secrets.
- Rotate both Core secrets if a launch URL or server environment is disclosed.
- Review `docs/CORE_FPS_SOURCE_AUDIT.md` before public commercial distribution.
