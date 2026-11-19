# BOSLA Academy — Deployment Root Cause Audit (Hostinger KVM1)

**Target VPS Profile:** Hostinger KVM1 (`1 vCPU`, `4 GB RAM`, `50 GB NVMe`) running Coolify alongside other hosted websites.  
**Audit Scope:** Static inspection and local workspace measurements across Dockerfiles, Docker Compose configuration, `package.json` workspaces, Next.js/NestJS/Worker build & runtime code, Nginx configuration, and scripts. Live production SSH / Coolify inspection was intentionally **not** performed per project constraints.

---

## 1. Confirmed Findings (Code & Local Build Evidence)

### 1.1 All Three Heavy Workloads Built from Source on the Production VPS
- **Evidence (`docker-compose.yml`, `docs/COOLIFY.md`):**
  - `docker-compose.yml` previously declared `build:` sections for `api` (`Dockerfile.api`), `worker` (`Dockerfile.worker`), and `web` (`Dockerfile.web`).
  - `docs/COOLIFY.md` instructed Coolify to deploy `docker-compose.yml` directly from Git.
- **Impact:** Every deployment executed `npm ci` (x3), `tsc` (x3), `prisma generate` (x2), and `next build` simultaneously on a single vCPU and 4 GB RAM shared with live websites, databases, and Coolify/Traefik.

### 1.2 Worker Resource Limits Exceeded Total Physical Host CPU & RAM
- **Evidence (`docker-compose.yml`, `.env.example`, `packages/config/src/index.ts`, `apps/worker/src/main.ts`, `apps/worker/src/transcoder.ts`):**
  - `worker.deploy.resources.limits` in `docker-compose.yml` previously specified:
    - `cpus: "2.0"` (twice the KVM1 host's 1 vCPU)
    - `memory: 3G` (75% of total 4 GB VPS RAM for the worker container alone)
  - `WORKER_CONCURRENCY` defaulted to `2` across `docker-compose.yml`, `.env.example`, `packages/config/src/index.ts`, and `apps/worker/src/main.ts`.
  - `apps/worker/src/transcoder.ts` invoked `ffmpeg` (`libx264 -preset veryfast`) for `480p,720p,1080p` without passing a `-threads` flag, allowing unrestricted encoder thread spawning on 1 vCPU.
- **Impact:** Combined with API, Web, Postgres, Redis, Nginx, Traefik, and other websites on the VPS, unconstrained worker + build workloads leave negligible CPU/RAM headroom.

### 1.3 Missing `.dockerignore` Caused >1.2 GB Build Contexts
- **Evidence (Repository root & local disk measurements):**
  - No `.dockerignore` file existed in the repository root.
  - Measured local workspace directories that Docker includes in context without `.dockerignore`:
    - `node_modules/`: **1014.56 MB**
    - `apps/web/.next/`: **230.80 MB**
- **Impact:** Whenever a working tree or cached runner contains dependencies or build outputs, Docker must archive and transfer >1.2 GB into the daemon context before building.

### 1.4 Missing Next.js Standalone Output & Unpruned `devDependencies` Inside All Production Images
- **Evidence (`apps/web/next.config.ts`, `infrastructure/docker/Dockerfile.web`, `Dockerfile.api`, `Dockerfile.worker`, `node_modules` directory sizes):**
  - `apps/web/next.config.ts` lacked `output: 'standalone'`.
  - `Dockerfile.web` copied the full `/app/node_modules` and `/app/apps/web/.next` (~1,245 MB combined locally) into the runtime image and started Next.js via `npm run start --workspace=@bosla/web`.
  - `Dockerfile.api` and `Dockerfile.worker` copied `/app/node_modules` without `--omit=dev` or pruning, bundling test/development-only dependencies into production runtime images, including:
    - `@embedded-postgres` (`104.4 MB` measured in `node_modules`)
    - `typescript` (`22.5 MB` measured in `node_modules`)
    - `vitest`, `tsx`, `@nestjs/testing`, `supertest` (`apps/api/package.json` `devDependencies`).
    - Workspace test packages (`playwright-core` `13.3 MB`, `vite` `12.8 MB`) also existed in the hoisted root workspace tree.

### 1.5 Unbounded Postgres/Redis Memory & Missing Service Healthchecks
- **Evidence (`docker-compose.yml`):**
  - `redis` launched with `["redis-server", "--appendonly", "yes"]` and no `--maxmemory` bound or container resource limit.
  - `postgres` had no tuned connection/buffer flags (`shared_buffers`, `max_connections`) and no memory/CPU limits.
  - `worker`, `web`, and `nginx` had no `healthcheck` definitions, and `nginx` depended on `web` and `api` without `condition: service_healthy`.

### 1.6 Direct Host Port `80` Collision Risk & Shell/PID 1 Signal Issues
- **Evidence (`docker-compose.yml`, `infrastructure/docker/Dockerfile.api`, `apps/api/src/modules/health/health.controller.ts`):**
  - `docker-compose.yml` bound `ports: ["${HTTP_PORT:-80}:80"]` directly on the host. When deployed on a Coolify VPS whose Traefik proxy owns host ports `80`/`443` for all hosted sites, an unoverridden `HTTP_PORT=80` conflicts with shared VPS ingress.
  - `Dockerfile.api` started with `CMD ["sh", "-c", "npx prisma migrate deploy ... && node apps/api/dist/main.js"]` — without `exec`, `sh` remained PID 1 and did not forward `SIGTERM` cleanly to NestJS (`app.enableShutdownHooks()`), while `npx` invoked an extra CLI wrapper on every boot.
  - `apps/api/src/modules/health/health.controller.ts` evaluated `Boolean(redisOk)` on `{ ok: boolean; mode }` returned by `RedisService.ping()`, which always evaluated truthy even if Redis was unreachable.

### 1.7 Ruled-Out Causes (Confirmed Healthy in Codebase)
- **`prisma generate` at runtime:** **Not present.** `Dockerfile.api` and `Dockerfile.worker` already ran `npm run build --workspace=@bosla/db` (`prisma generate && tsc`) in the build stage rather than at container startup.
- **Database seeding on startup:** **Not present.** Neither `Dockerfile.api` nor Compose runs `db:seed` automatically on boot.
- **Global destructive cleanup commands:** **Not present** in repository scripts or Compose files.

---

## 2. Hypotheses (Unverified on Live Hostinger KVM1 VPS)

Because live production commands and Coolify inspection were intentionally excluded, the following remain informed engineering hypotheses rather than directly measured VPS telemetry:

1. **Linux OOM Killer & Swap Thrashing Lock the Host:** During on-VPS `npm ci` + `next build` (`Creating an optimized production build`, ESLint/typechecking, and trace collection), peak memory demand exceeds free RAM on the 4 GB VPS, triggering kernel OOM kills or heavy swap thrashing that freezes Coolify's Traefik proxy and starves unrelated websites until VPS reboot.
2. **CPU Wait / I/O Contention Freeze SSH & Health Probes:** Parallel layer extraction and TypeScript/Next.js SWC compilation saturate the single KVM1 vCPU (`100%` load + disk NVMe queue contention), causing reverse-proxy health checks and SSH logins to time out across all sites on the host.
3. **Accumulated Docker Build Cache Pressure:** Repeated builds without moving builds off-host retain multi-gigabyte BuildKit/image caches inside the 50 GB NVMe root partition, reducing Linux filesystem page cache headroom available to live services.
