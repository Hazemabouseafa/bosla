# BOSLA Academy — Production & Coolify Deployment Guide

## Services Overview (`docker-compose.yml`)
| Service | Image / Dockerfile | Purpose | Persistent Volume |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | Primary PostgreSQL database | `bosla_pg_data` -> `/var/lib/postgresql/data` |
| `redis` | `redis:7-alpine` | BullMQ queues & distributed rate limits (AOF enabled) | `bosla_redis_data` -> `/data` |
| `api` | `infrastructure/docker/Dockerfile.api` | NestJS API, Swagger, Paymob webhooks, HLS token authority | `bosla_media_data` -> `/var/bosla/media` |
| `worker` | `infrastructure/docker/Dockerfile.worker` | BullMQ + `ffmpeg`/`ffprobe` HLS transcoding, scheduler, cleanup | `bosla_media_data` -> `/var/bosla/media` |
| `web` | `infrastructure/docker/Dockerfile.web` | Next.js App Router RTL web platform (`INTERNAL_API_URL=http://api:4000`) | — |
| `nginx` | `nginx:1.27-alpine` | Reverse proxy + internal `X-Accel-Redirect` media gateway | `bosla_media_data` -> `/var/bosla/media:ro` |

## Required Production Environment Variables
Copy `.env.example` and configure real secrets in your Coolify resource or VPS environment (never commit real secrets):
- **Core URLs & TLS**: `APP_URL`, `API_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL=/api/v1`, `COOKIE_SECURE=true`, `COOKIE_DOMAIN`
- **Crypto Secrets** (64+ random hex chars each): `SESSION_SECRET`, `RECOVERY_CODE_PEPPER`, `PLAYBACK_TOKEN_SECRET`
- **WebAuthn FIDO2**: `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID` (exact domain, no scheme/port), `WEBAUTHN_ORIGIN` (`https://...`)
- **Google OIDC**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- **Paymob (Egypt)**: `PAYMOB_MODE=live`, `PAYMOB_API_KEY`, `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_INTEGRATION_ID_WALLET`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC_SECRET`
- **Media & Streaming**: `USE_NGINX_ACCEL=true`, `MEDIA_ROOT=/var/bosla/media`, `MAX_VIDEO_UPLOAD_BYTES`, `INSTRUCTOR_STORAGE_QUOTA_BYTES`

## Deploying to Coolify / Docker Compose VPS
1. Provision a Linux VPS with Docker & Coolify (HTTPS termination handled by Coolify's Traefik/Caddy proxy in front of the `nginx` service on port 80).
2. Create a Docker Compose application pointing at `docker-compose.yml` and mount persistent volumes (`bosla_pg_data`, `bosla_redis_data`, `bosla_media_data`).
3. Ensure `api` runs migrations on startup (`npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma`, configured in `Dockerfile.api`).
4. Run the initial seed once inside the `api` container:
   ```bash
   npm run db:seed --workspace=@bosla/db
   ```
5. Log in as the seeded Admin (`+201000000001`), rotate default credentials, and verify `/api/v1/health` and `/api-docs`.

## Maintenance & Backups (`infrastructure/scripts/`)
- `backup-db.sh`: Creates compressed `pg_dump` archives under `BACKUP_DIR` with 14-day retention (`0600` permissions).
- `backup-media.sh`: Synchronizes `MEDIA_ROOT` via `rsync`, excluding transient `uploads-tmp/`.
- `check-disk.sh`: Checks media volume disk usage and exits with code `2` if `DISK_ALERT_THRESHOLD_PERCENT` (default `85%`) is exceeded.

## External Credential & Local Host Blockers
- **Google OIDC**: Live Google sign-in requires valid `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` matching authorized JavaScript origins.
- **Live Paymob Gateway**: Real card/wallet checkouts require merchant Paymob keys and live HMAC secrets; until configured, `PAYMOB_MODE=sandbox` exercises the local HMAC-SHA512 webhook checkout simulator.
- **Docker / Redis / Nginx on current Windows build host**: Docker Desktop, native Redis, and Nginx were not installed on the development machine used during implementation, so container compose execution and Nginx `X-Accel-Redirect` header offloading should be validated on the target Linux/Coolify VPS upon first deployment.
