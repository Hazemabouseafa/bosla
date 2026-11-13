# BOSLA Academy — Coolify & VPS Deployment Guide

## Architecture Summary
All services run self-hosted on your academy VPS (no external video SaaS):
- **postgres** (PostgreSQL 16 with persistent volume `bosla_pg_data`)
- **redis** (Redis 7 AOF persistence with `bosla_redis_data`)
- **api** (NestJS REST API + Swagger + Auth + Paymob + X-Accel-Redirect stream authority)
- **worker** (BullMQ + FFmpeg/FFprobe background transcoding + abandoned upload cleanup + scheduled publishing)
- **web** (Next.js App Router RTL Arabic storefront & Student/Instructor/Admin portals)
- **nginx** (Reverse proxy + protected internal HLS delivery via `X-Accel-Redirect`)

## Deploying on Coolify (Docker Compose)
1. Create a **Docker Compose** resource in Coolify pointing to this repository (`docker-compose.yml`).
2. Configure persistent storage volumes:
   - `bosla_pg_data` -> `/var/lib/postgresql/data`
   - `bosla_redis_data` -> `/data`
   - `bosla_media_data` -> `/var/bosla/media` (shared across `api`, `worker`, and read-only on `nginx`)
3. Configure HTTPS domain in Coolify pointing to the `nginx` service on port `80` (Coolify's Traefik/Caddy proxy terminates TLS/HTTPS and forwards to `nginx`).
4. Set required production environment variables in Coolify (never commit them):
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - `SESSION_SECRET`, `RECOVERY_CODE_PEPPER`, `PLAYBACK_TOKEN_SECRET` (each 64+ random hex chars)
   - `APP_URL=https://academy.boslaagri.com`
   - `API_URL=https://academy.boslaagri.com`
   - `NEXT_PUBLIC_API_URL=/api/v1`
   - `CORS_ORIGINS=https://academy.boslaagri.com`
   - `COOKIE_SECURE=true`
   - `WEBAUTHN_RP_ID=academy.boslaagri.com`
   - `WEBAUTHN_ORIGIN=https://academy.boslaagri.com`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `PAYMOB_MODE`, `PAYMOB_API_KEY`, `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_HMAC_SECRET`
5. After first deploy, run initial database seeding inside the `api` container:
   ```bash
   npm run db:seed --workspace=@bosla/db
   ```
   Then immediately log in as Admin and change the seeded admin password!

## Scaling Media Storage to a Second Academy VPS (Future Migration)
The media storage abstraction resolves relative paths against `MEDIA_ROOT` (`/var/bosla/media`). To split video delivery onto a second academy-owned VPS later:
1. Sync `/var/bosla/media/hls` to the second VPS (or mount NFS/Block storage).
2. Run Nginx on the second VPS with the same `/_internal_hls/` `internal;` rule and `auth_request` / signed playback token verification against the API.
3. Update `HLS_STREAM_BASE_URL` on the API without changing any database course/lesson records.
