# BOSLA ACADEMY — Implementation Status

**Project:** أكاديمية بوصلة (`BOSLA ACADEMY`) — *من الطالب إلى المدير*  
**Architecture:** TypeScript Monorepo (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db`, `packages/ui`, `packages/config`, `infrastructure/*`, `docs/*`)  
**Updated:** 2026-11-13

---

## 1. Status Matrix

| Workstream | Status | Implemented Artifacts & Notes |
| :--- | :--- | :--- |
| Monorepo & Tooling | **COMPLETED** | Root npm workspaces (`packages/shared`, `packages/db`, `packages/ui`, `packages/config`, `apps/api`, `apps/worker`, `apps/web`), ESLint 9 (`eslint.config.mjs`), TypeScript configs, `.env.example`, `.gitignore`. |
| Database Schema & Seeding | **COMPLETED** | `packages/db/prisma/schema.prisma`, `0001_init/migration.sql`, `packages/db/prisma/seed.ts` (Admin, 8 Instructors, Demo Student, 9 categories, courses/lessons/quizzes, learning paths, diplomas, membership plans, specialization questions, CMS pages/testimonials/partners/FAQs). |
| Strictly 3 Educational Content Types | **COMPLETED** | Backend, Prisma schema, and Next.js routes enforce exclusively **Courses** (`/courses`, `/courses/[slug]`), **Learning Paths** (`/learning-paths`, `/learning-paths/[slug]`), and **Diplomas** (`/diplomas`, `/diplomas/[slug]`). `/programs` returns HTTP `404`. |
| Strictly 3 Roles & Backend RBAC | **COMPLETED** | `ADMIN`, `INSTRUCTOR`, and `STUDENT` enforced by `SessionAuthGuard`, `RolesGuard`, `CsrfGuard`, and `OptionalSessionAuthGuard` (`apps/api/src/core/guards.ts`), Swagger/OpenAPI configured in `apps/api/src/main.ts`. |
| Non-OTP Authentication & Security | **COMPLETED (Local + Unit/E2E Verified; Live OIDC Blocked on Creds)** | Option A: Google Identity Services (`GoogleSignInButton.tsx` + backend OIDC verification, zero forced password/passkey). Option B: Mobile E.164 + Argon2id password -> mandatory `@simplewebauthn/server` FIDO2 Passkey enrollment (`/security/passkey-setup`) + single-use hashed recovery codes (`/recovery`) + multi-passkey management with recent-auth re-verification. **Zero SMS/Email OTP anywhere.** |
| Self-Hosted Video Pipeline & Player | **COMPLETED (Local FFmpeg/HLS Verified; Redis Container/Nginx Unexecuted)** | Resumable chunked uploads (`apps/api/src/modules/video`), path-safe storage & HMAC-signed playback tokens (`MediaStorageService`), FFmpeg/FFprobe adaptive HLS transcoder without upscaling (`apps/worker/src/transcoder.ts`), and `hls.js` player (`apps/web/src/components/player/BoslaHlsPlayer.tsx`) on `/learn/[slug]`. |
| Memberships & Paymob Integration | **COMPLETED (Sandbox & HMAC Verified; Live Merchant Keys Needed)** | Monthly & annual academy memberships, `PaymobClient` supporting v1 Intention, Classic Iframe, HMAC-SHA512 webhook verification (`paymob.client.ts`), and local sandbox checkout routes (`/membership/sandbox-checkout`, `/membership/checkout-result`). |
| Editorial, Dashboards & Catalog UI | **COMPLETED** | Arabic-first RTL Next.js 15 App Router pages: `/` (`HomeExperience.tsx`), `/courses` (`CourseCatalogClient.tsx`), `/learning-paths`, `/diplomas`, `/pricing` (`PricingClient.tsx`), `/about`, `/instructors`, `/contact`, `/privacy`, `/terms`, `/student`, `/student/settings`, `/instructor`, `/instructor/videos`, `/instructor/courses/[courseId]`, `/admin`, `/certificates/verify`, `/certificates/[code]`, and runtime `/api/[...path]` Node.js proxy. |
| Docker, Nginx, Coolify & Operations Docs | **COMPLETED (Configs Written; Docker Runtime Blocked on Host)** | `docker-compose.yml`, `docker-compose.dev.yml`, `infrastructure/docker/Dockerfile.{api,web,worker}`, `infrastructure/nginx/nginx.conf`, `infrastructure/scripts/{backup-db.sh,backup-media.sh,check-disk.sh}`, and `docs/{ARCHITECTURE,SECURITY,API,DEPLOYMENT,COOLIFY,ADMIN_GUIDE,INSTRUCTOR_GUIDE,TEST_REPORT}.md`. |

---

## 2. Production Deployment Prerequisites & Known Environment Blockers

Before deploying to a production Linux VPS (Coolify or standalone Docker Compose):

1. **Docker Host Execution Required:** Docker Desktop / CLI is not installed on the current Windows build machine; execute `docker compose build` and `docker compose up -d` on the target Linux host to run `postgres`, `redis`, `api`, `worker`, `web`, and `nginx` containers together and validate Nginx `X-Accel-Redirect` (`/internal-media/`) in live traffic.
2. **External Credentials to Provision in `.env`:**
   - **Google OIDC:** Set real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and keep `ALLOW_TEST_GOOGLE_TOKENS` disabled in production.
   - **Paymob Live Keys:** Switch `PAYMOB_MODE=live` and configure real `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_IFRAME_ID`, and `PAYMOB_HMAC_SECRET`.
   - **WebAuthn & Cryptographic Secrets:** Configure HTTPS domain origins for `RP_ID` / `ORIGIN` and generate high-entropy `SESSION_SECRET`, `PLAYBACK_TOKEN_SECRET`, and `INTERNAL_API_URL` values per `docs/SECURITY.md` and `docs/DEPLOYMENT.md`.
