# BOSLA Academy — Coolify Prebuilt GHCR Deployment Setup Guide

This guide switches Coolify on your Hostinger KVM1 VPS from **building Docker images on the VPS** (`docker-compose.yml`) to **pulling prebuilt `linux/amd64` images from GitHub Container Registry (GHCR)** (`docker-compose.prod.yml`), without touching existing databases or media files.

> [!CAUTION]
> **Keep Your Existing Coolify Resource!**  
> Do **not** delete and recreate your Coolify application resource. Modifying the existing resource preserves your existing Compose project prefix and existing named volumes (`bosla_pg_data`, `bosla_redis_data`, `bosla_media_data`). Never run `docker compose down -v`, `docker volume prune`, or `prisma migrate reset`.

---

## Step 1: Configure Non-Secret GitHub Actions Repository Variables

In GitHub -> Repository **Settings -> Secrets and variables -> Actions -> Variables** tab, add only public frontend variables (never add database, Paymob, session, or OAuth client secrets here):

| Variable Name | Value Example | Required? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api/v1` | Optional (defaults to `/api/v1`) |
| `NEXT_PUBLIC_APP_URL` | `https://academy.boslaagri.com` | Recommended |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `your-public-google-client-id.apps.googleusercontent.com` | Required if Google Sign-In button is enabled |

Check **Settings -> Actions -> General -> Workflow permissions**:
- Confirm **Read and write permissions** is allowed (the workflow also declares `packages: write` in `.github/workflows/deploy-images.yml`).

---

## Step 2: Publish the First Prebuilt Images on GitHub

1. Push the updated repository changes to `main` (or trigger **Actions -> Build and Publish Production Docker Images -> Run workflow**).
2. Wait for both jobs to succeed:
   - **Lint, Typecheck, and Test** (`verify`)
   - **Build & Push api / worker / web (linux/amd64)** (`build-and-push`)
3. Open the workflow summary to see the exact published immutable tag, for example:
   - `ghcr.io/hazemabouseafa/boslaacademy-web:sha-abc1234`
   - `ghcr.io/hazemabouseafa/boslaacademy-api:sha-abc1234`
   - `ghcr.io/hazemabouseafa/boslaacademy-worker:sha-abc1234`

---

## Step 3: Authorize VPS / Coolify to Pull GHCR Images

Choose **one** of these options:

- **Option A (Private GHCR Images — Recommended for Private Repos):**
  1. Create a GitHub Personal Access Token (classic) with scope `read:packages` only (or fine-grained PAT with Packages: Read).
  2. On Coolify's server (or via Coolify's **Server / Docker Registry** settings), authenticate Docker against GHCR:
     ```bash
     echo "<GITHUB_READ_PACKAGES_PAT>" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
     ```
- **Option B (Public GHCR Packages — Zero Token Needed on VPS):**
  - Open your GitHub profile/repo **Packages** -> `boslaacademy-web`, `boslaacademy-api`, `boslaacademy-worker` -> **Package settings -> Change visibility -> Public**.
  - Because zero runtime secrets are baked into these images, public image pulls work directly without Docker login on Coolify.

---

## Step 4: Switch Existing Coolify Resource to `docker-compose.prod.yml`

1. Open your **existing** BOSLA Academy Compose resource in Coolify.
2. Back up your database/volumes manually on VPS (recommended precaution before any infrastructure switch):
   - Keep `bosla_pg_data`, `bosla_redis_data`, `bosla_media_data` untouched.
3. Under **Configuration -> General**:
   - Change **Docker Compose Location** from `/docker-compose.yml` to `/docker-compose.prod.yml`.
   - Confirm no build steps or Nixpacks builders are enabled.
4. Under **Environment Variables**, keep all existing runtime secrets intact (`POSTGRES_*`, `SESSION_SECRET`, `RECOVERY_CODE_PEPPER`, `PLAYBACK_TOKEN_SECRET`, `PAYMOB_*`, `GOOGLE_*`, `WEBAUTHN_*`), and add/confirm:
   - `BOSLA_IMAGE_TAG=latest` *(or pin an exact commit tag such as `sha-abc1234`)*
   - `WORKER_CONCURRENCY=1`
   - `FFMPEG_THREADS=1`
5. Confirm Coolify **Domains / Network Routing**:
   - Your domain (e.g. `https://academy.boslaagri.com`) points to the **`nginx`** service internal port **`80`**.
   - Note: `docker-compose.prod.yml` uses `expose: ["80"]` instead of host `ports: "80:80"` so it never collides with Coolify's Traefik proxy serving your other websites.
6. Click **Deploy** in Coolify. Coolify now pulls the prebuilt images and restarts containers without running `npm ci` or `next build` on the VPS.

---

## Step 5: Post-Switch Verification Checklist

1. Verify `/api/v1/health` returns `status: "ok"` (`postgres: "up"`, `redis: "up"`).
2. Confirm existing database courses/users and uploaded HLS media remain intact.
3. Verify other websites hosted on the same KVM1 VPS remain responsive during and after deployment.
4. Inspect live resource consumption:
   ```bash
   docker stats --no-stream
   ```
   Confirm total BOSLA container memory remains within the `2.4 GB` ceiling and CPU load drops near idle once containers finish starting.
5. Note on Automatic Webhooks: If GitHub auto-deploy webhook is enabled in Coolify, delay webhook triggering until **after** GitHub Actions finishes pushing new images (e.g., use manual Coolify Deploy or trigger Coolify webhook at the end of a workflow once tested) so Coolify does not re-pull an old tag while CI is still building.
