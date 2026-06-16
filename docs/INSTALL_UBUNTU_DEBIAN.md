# Ubuntu/Debian Install Guide

This guide installs Bouncecore on a fresh Ubuntu or Debian server using Docker Compose. It uses dummy domains throughout. Replace `bouncecore.example.com` with your own domain.

## 1. Requirements

- Ubuntu 22.04, Ubuntu 24.04, Debian 12, or newer Debian stable.
- A non-root sudo user or root shell.
- A domain such as `bouncecore.example.com` pointing to the server.
- Ports `80` and `443` open for HTTPS.
- Port `1936` open if you want public RTMPS ingest from OBS.
- Port `1935` open only if you intentionally allow unencrypted RTMP ingest.
- At least 2 CPU cores and 4GB RAM for the base app.
- More CPU headroom if running FFmpeg adaptive HLS transcoding.

Recommended production shape:

```text
Internet
  -> HTTPS 443
  -> reverse proxy
  -> 127.0.0.1:3000 Bouncecore app

OBS
  -> RTMPS 1936
  -> MediaMTX gateway
  -> stream-core auth
  -> optional FFmpeg HLS transcoder
```

## 2. DNS

Create an `A` or `AAAA` record before requesting certificates:

```text
bouncecore.example.com -> your server IP address
```

Wait for DNS to resolve:

```bash
dig +short bouncecore.example.com
```

## 3. Install Server Packages

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git gnupg openssl ufw
```

Install Docker Engine and the Compose plugin. On many Debian/Ubuntu servers the packaged Docker is enough for this project:

```bash
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in if you want to run Docker without `sudo`.

Verify:

```bash
docker --version
docker compose version
```

## 4. Firewall

Allow SSH, HTTP, HTTPS, and RTMPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1936/tcp
sudo ufw enable
sudo ufw status
```

Only allow unencrypted RTMP if you really need it:

```bash
sudo ufw allow 1935/tcp
```

## 5. Clone the Repository

Use your own repository URL:

```bash
sudo mkdir -p /opt/bouncecore
sudo chown "$USER":"$USER" /opt/bouncecore
git clone https://github.com/your-org/bouncecore-platform.git /opt/bouncecore
cd /opt/bouncecore
```

## 6. Run the Interactive Installer

```bash
bash scripts/install-instance.sh
```

Use values like these when prompted:

```text
Public app URL: https://bouncecore.example.com
App bind host: 127.0.0.1
App host port: 3000
Brevo SMTP host: smtp-relay.brevo.com
Brevo SMTP port: 587
Site email from address: no-reply@bouncecore.example.com
PostgreSQL database name: bouncecore_platform
PostgreSQL username: bouncecore_app
PostgreSQL bind host: 127.0.0.1
Redis bind host: 127.0.0.1
Start embedded stream core service now: y
Start MediaMTX RTMP/HLS gateway now: y
Start FFmpeg adaptive HLS transcoder now: y
Start background worker now: y
Media gateway bind host: 0.0.0.0
Media gateway RTMP encryption mode: optional
Media gateway RTMPS host port: 1936
Media gateway HLS host port: 18888
Public RTMP/RTMPS ingest URL: rtmps://bouncecore.example.com:1936/live/{streamKey}
Public playback URL: https://bouncecore.example.com/hls/live/master.m3u8
PayPal mode: sandbox
First server owner email: owner@example.com
```

If another service already owns the streaming ports, answer `n` for the stream-core, MediaMTX, or transcoder profiles and start them later after choosing non-conflicting ports.

The installer creates `.env.instance`. Protect it:

```bash
chmod 600 .env.instance
```

## 7. Add HTTPS Reverse Proxy

The app container should stay bound to `127.0.0.1:3000`. Put nginx, Caddy, Apache, Plesk, or another reverse proxy in front of it.

### Option A: nginx with Certbot

Install nginx and Certbot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/bouncecore`:

```nginx
server {
    listen 80;
    server_name bouncecore.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name bouncecore.example.com;

    client_max_body_size 512m;

    location /hls/ {
        proxy_pass http://127.0.0.1:18889/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Access-Control-Allow-Origin "*" always;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300;
    }
}
```

Enable it and request a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/bouncecore /etc/nginx/sites-enabled/bouncecore
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d bouncecore.example.com
```

After Certbot writes the SSL settings, test again:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://bouncecore.example.com/api/health
```

### Option B: Caddy

Install Caddy using the package path recommended for your OS, then use a Caddyfile like:

```caddyfile
bouncecore.example.com {
    request_body {
        max_size 512MB
    }

    handle_path /hls/* {
        reverse_proxy 127.0.0.1:18889
        header Access-Control-Allow-Origin "*"
    }

    reverse_proxy 127.0.0.1:3000
}
```

Reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 8. RTMPS Certificate

The installer can generate a self-signed RTMPS certificate for local testing. For public production RTMPS, replace it with a trusted certificate for the ingest domain.

If you use Let's Encrypt certificates from nginx/Certbot, copy or mount them into the RTMPS cert directory as:

```text
.instance-certs/rtmps/server.crt
.instance-certs/rtmps/server.key
```

Example:

```bash
sudo install -d -m 700 /opt/bouncecore/.instance-certs/rtmps
sudo cp /etc/letsencrypt/live/bouncecore.example.com/fullchain.pem /opt/bouncecore/.instance-certs/rtmps/server.crt
sudo cp /etc/letsencrypt/live/bouncecore.example.com/privkey.pem /opt/bouncecore/.instance-certs/rtmps/server.key
sudo chown -R "$USER":"$USER" /opt/bouncecore/.instance-certs
chmod 600 /opt/bouncecore/.instance-certs/rtmps/server.key
```

Restart the gateway:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway up -d stream-core media-gateway
```

## 9. Owner Account

The installer attempts to bootstrap the first Owner account. If you skipped that step or it failed, open:

```text
https://bouncecore.example.com/setup/owner
```

Create the first Owner account. The setup route locks after an Owner assignment exists.

## 10. Admin Configuration

After logging in as Owner, configure:

- Admin > Integrations: PayPal, Tenor, Brevo, stream provider, public URLs.
- Admin > Roles: visible role badge labels.
- Admin > Menus: public navigation and mobile menu items.
- Admin > Site & Design: theme settings and public card content.
- Admin > Stream Keys: issue and verify streamer keys.
- Admin > Stream Profiles: bitrate and resolution presets.
- Admin > Chat Assets: sticker packs and animated emoji.
- Admin > Stars: packages, alerts, and donation settings.
- Admin > Products: merch products and images.
- Admin > Music: producer track review and catalogue settings.

## 11. OBS / Streamlabs Settings

Use separate fields:

```text
Server: rtmps://bouncecore.example.com:1936/live
Stream Key: paste the raw Bouncecore stream key
```

Do not paste a combined URL plus key into Stream Key.

Recommended first test settings:

```text
Video bitrate: 3000 Kbps
Audio bitrate: 160 Kbps
Keyframe interval: 2 seconds
Encoder: x264 or hardware H.264
Output: RTMPS
```

The public player should read:

```text
https://bouncecore.example.com/hls/live/master.m3u8
```

## 12. Health Checks

```bash
cd /opt/bouncecore
docker compose -f docker-compose.instance.yml --env-file .env.instance ps
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://bouncecore.example.com/api/health
```

Check logs:

```bash
docker compose -f docker-compose.instance.yml --env-file .env.instance logs -f app
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker logs -f worker
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core logs -f stream-core
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile media-gateway logs -f media-gateway
```

## 13. Backups

Create a restricted backup directory:

```bash
sudo mkdir -p /srv/bouncecore-backups
sudo chown "$USER":"$USER" /srv/bouncecore-backups
chmod 700 /srv/bouncecore-backups
```

Run:

```bash
cd /opt/bouncecore
bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups
```

Add a daily cron entry:

```cron
15 3 * * * cd /opt/bouncecore && bash scripts/backup-instance.sh --backup-root /srv/bouncecore-backups >> /var/log/bouncecore-backup.log 2>&1
```

Copy backups off-server. Local backups alone are not production-grade.

## 14. Updates

```bash
cd /opt/bouncecore
git pull
docker compose -f docker-compose.instance.yml --env-file .env.instance build app
docker compose -f docker-compose.instance.yml --env-file .env.instance run --rm app npm run db:migrate
docker compose -f docker-compose.instance.yml --env-file .env.instance up -d app
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile worker up -d worker
docker compose -f docker-compose.instance.yml --env-file .env.instance --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
```

Verify:

```bash
curl -fsS https://bouncecore.example.com/api/health
```

## 15. Troubleshooting

Uploads fail with 413:

- Raise `client_max_body_size` or the equivalent body limit in your reverse proxy to at least `512m`.
- Check CDN or panel limits if one sits in front of the server.
- Confirm `next.config.ts` still has the 512MB server action body limit.

OBS cannot connect:

- Confirm port `1936/tcp` is open.
- Confirm `media-gateway` is running.
- Use `rtmps://bouncecore.example.com:1936/live` as the server and only the raw key in the Stream Key field.
- If using a self-signed RTMPS certificate, OBS may reject it. Use a trusted certificate for production.

OBS says the channel or stream key is unavailable:

- Create a fresh stream key in the streamer/admin dashboard.
- Confirm the key is active and belongs to a user allowed to stream.
- Check stream-core and media-gateway logs.
- Confirm `STREAM_CORE_KEY_VALIDATION_TOKEN` matches `INTERNAL_TASK_TOKEN` unless you intentionally changed it.

Player stays offline:

- Check `PUBLIC_PLAYBACK_URL` and `TRANSCODER_HLS_PUBLIC_URL`.
- Confirm `/hls/live/master.m3u8` is reachable through the reverse proxy.
- Check the transcoder logs for input errors.
- Confirm OBS is sending video and audio.

Emails do not send:

- Confirm `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `MAIL_FROM`, and `MAIL_FROM_NAME`.
- Use a verified sender/domain in Brevo.
- Check app logs for SMTP errors.

PayPal checkout fails:

- Confirm sandbox versus live mode.
- Confirm client ID, secret, merchant email, merchant ID, and webhook ID.
- Use HTTPS for production callbacks.
