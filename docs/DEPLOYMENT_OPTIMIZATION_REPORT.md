# BOSLA Academy — Deployment Optimization Report

## 1. Architectural Shift: Off-Host CI Builds -> Prebuilt GHCR Images

| Phase | Before Optimization | After Optimization |
|---|---|---|
| Dependency install & test | Not gated before VPS deploy | GitHub Actions (`verify` job): `npm ci`, `lint`, `typecheck`, `test:unit`, `test:integration` |
| Image compilation (`web`, `api`, `worker`) | Built directly on 1 vCPU / 4 GB VPS | Built on GitHub Actions `ubuntu-latest` (`linux/amd64`) with Buildx GHA layer cache |
| VPS deploy action | `npm ci` x3 + `tsc` x3 + `next build` on VPS | Pull compressed prebuilt GHCR images and restart cleanly |
| Tagging & traceability | Implicit latest local build | Immutable `sha-<7char>` + `commit-<40char>` + `main` / `latest` / release tags |

---

## 2. Image & Context Optimizations

### 2.1 Root `.dockerignore` & `.gitattributes`
- Added `.dockerignore` excluding `node_modules/` (`1014.56 MB`), `.next/` (`230.80 MB`), `dist/`, `.git/`, `storage/`, `test-results/`, `playwright-report/`, `.embedded-postgres/`, `coverage/`, and `.env*` files.
- Added `.gitattributes` enforcing LF (`eol=lf`) for `*.sh` and `infrastructure/docker/*-entrypoint.sh`, plus `sed -i 's/\r$//'` in Dockerfiles so Windows-edited shell scripts cannot fail on Linux.

### 2.2 Next.js Standalone Mode (`Dockerfile.web`)
- Enabled `output: 'standalone'` in `apps/web/next.config.ts`.
- Verified locally via `npm run build --workspace=@bosla/web`:
  - `apps/web/.next/standalone` = **59.86 MB**
  - `apps/web/.next/static` = **2.08 MB**
  - `apps/web/public` = **0.72 MB**
  - **Combined standalone runtime payload: ~62.7 MB** vs **~1,245 MB** (`node_modules` + `.next`) previously copied into the Web runner image (~95% payload reduction).
- `Dockerfile.web` runs as non-root `USER node`, binds `HOSTNAME=0.0.0.0` `PORT=3000`, caps Node heap (`--max-old-space-size=384`), includes a native `HEALTHCHECK`, and starts directly with `CMD ["node", "apps/web/server.js"]`.

### 2.3 Multi-Stage Production Pruning (`Dockerfile.api` & `Dockerfile.worker`)
- Added dedicated `prod-deps` stages using `npm ci --omit=dev` per service workspace:
  - Excludes `@embedded-postgres` (`104.4 MB`), `typescript` (`22.5 MB`), `vitest`, `tsx`, `@nestjs/testing`, and `supertest` from production runner images.
  - Added `prisma` (`^6.19.3`, matched to `@prisma/client` and locked in `package-lock.json`) specifically to `apps/api/package.json` `dependencies` so `Dockerfile.api` can run `migrate deploy` via `node ./node_modules/prisma/build/index.js` without `npx` downloads and without shipping dev dependencies, while `Dockerfile.worker` omits `prisma` CLI completely.
  - Copies pre-generated Prisma client binaries (`node_modules/.prisma`) from the `build` stage (zero `prisma generate` at runtime).
- Entrypoints (`infrastructure/docker/api-entrypoint.sh`, `worker-entrypoint.sh`):
  - Ensure `/var/bosla/media/*` directories exist and safely fix ownership to `node:node` (`1000:1000`) if migrating from earlier root-owned volumes, then drop root privileges via `exec gosu node node ...` so Node receives `SIGTERM` cleanly as PID 1.

---

## 3. Runtime Budget for Hostinger KVM1 (`1 vCPU / 4 GB RAM`)

Configured in `docker-compose.prod.yml`:

| Service | CPU Limit | Memory Limit | Memory Reservation | Additional Runtime Safeguards |
|---|---|---|---|---|
| `postgres` | `0.40` | `384M` | `128M` | `shared_buffers=128MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=50` |
| `redis` | `0.20` | `192M` | `32M` | `--maxmemory 128mb --maxmemory-policy noeviction` (BullMQ-safe) |
| `api` | `0.50` | `512M` | `192M` | `NODE_OPTIONS=--max-old-space-size=384`, `exec gosu node`, `SKIP_DB_MIGRATIONS` escape hatch |
| `worker` | `0.60` | `768M` | `128M` | `WORKER_CONCURRENCY=1`, `FFMPEG_THREADS=1`, `NODE_OPTIONS=--max-old-space-size=256` |
| `web` | `0.50` | `512M` | `192M` | `NODE_OPTIONS=--max-old-space-size=384`, Next.js `standalone`, `USER node` |
| `nginx` | `0.25` | `96M` | `16M` | `expose: ["80"]` (no host port 80 collision), `depends_on: service_healthy` |
| **Total Peak Envelope** | — | **2,464M (~2.4 GB)** | **688M** | Leaves **~1.5+ GB RAM** for Linux, Coolify, Traefik, and co-hosted websites |

*(Note: `docker-compose.yml` was also hardened to remove `cpus: "2.0"`, `memory: 3G`, `WORKER_CONCURRENCY=2`, and unbounded Redis in case local source builds are ever executed manually.)*

---

## 4. Verification Scope Notes
- Verified locally on Windows build workstation after final edits:
  - `npm run lint`: passed across `@bosla/shared`, `@bosla/api`, `@bosla/worker`, `@bosla/web`.
  - `npm run typecheck`: passed across `@bosla/shared`, `@bosla/config`, `@bosla/db`, `@bosla/ui`, `@bosla/api`, `@bosla/worker`, `@bosla/web`.
  - `npm run build`: passed across all 7 workspaces (including Next.js `output: 'standalone'`).
  - `npm run test:unit`: **25 passed** (`11` shared + `12` api + `2` worker real FFmpeg/FFprobe HLS transcode tests).
  - `npm run test:integration`: **6 passed** across `2` test files (Real PostgreSQL, WebAuthn Passkeys, FFmpeg HLS, Paymob HMAC, Community + Lesson Q&A).
  - `npm run test:e2e`: **4 passed** Playwright Chromium tests (`bosla.spec.ts` + `community.spec.ts`).
  - Standalone server smoke test: copied `apps/web/.next/standalone` + `.next/static` + `public` into a clean temp dir and verified `node apps/web/server.js` returned `HTTP 200` on `/`.
  - YAML & LF validation: parsed `.github/workflows/deploy-images.yml`, `docker-compose.prod.yml`, and `docker-compose.yml` via `js-yaml`; verified all `.sh` files use LF (`hasCR=False`).
- Local Docker Engine / CLI is not installed on the Windows workstation, so actual `docker buildx` multi-stage execution on `linux/amd64` and live container orchestration should be verified cleanly on the first GitHub Actions run and Coolify Compose switchover.
