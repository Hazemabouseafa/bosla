# BOSLA Academy — Verification & Test Report

**Date:** 2026-11-13  
**Workspace:** `bosla-academy` (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db`, `packages/ui`, `packages/config`)  
**Verification Status:** All locally executable static, build, unit, integration, and browser E2E checks passed (`0` failures, `0` skipped tests). Containerized infrastructure and live third-party SaaS credentials remain unexecuted due to environment blockers detailed below.

---

## 1. Automated Verification Summary

| Check | Command | Result | Scope & Exact Output Highlights |
| :--- | :--- | :--- | :--- |
| TypeScript Typecheck | `npm run typecheck` | **PASSED** (`exit 0`) | `@bosla/shared`, `@bosla/db`, `@bosla/ui`, `@bosla/api`, `@bosla/worker`, `@bosla/web` (`tsc --noEmit`). Note: `@bosla/config` has no `typecheck` script in root `package.json`. |
| ESLint Check | `npm run lint` | **PASSED** (`exit 0`) | `@bosla/shared`, `@bosla/api`, `@bosla/worker`, `@bosla/web` (`eslint src`). |
| Production Build | `npm run build` | **PASSED** (`exit 0`) | `@bosla/shared`, `@bosla/db` (`prisma generate` v6.19.3 + `tsc`), `@bosla/ui`, `@bosla/api`, `@bosla/worker`, `@bosla/web` (`next build`, Next.js `15.5.29`, 30 routes compiled). |
| Unit Tests (`@bosla/shared`) | `npm run test` | **PASSED** (`exit 0`) | `1 file`, `7 tests passed (7)` in `1.51s` (`src/shared.test.ts`). |
| Unit Tests (`@bosla/api`) | `npm run test` | **PASSED** (`exit 0`) | `3 files`, `8 tests passed (8)` in `3.44s` (`paymob.client.spec.ts` [2], `media-storage.service.spec.ts` [2], `guards.spec.ts` [4]). |
| Unit Tests (`@bosla/worker`) | `npm run test` | **PASSED** (`exit 0`) | `1 file`, `2 tests passed (2)` in `8.42s` (`src/transcoder.test.ts`: real FFmpeg `9.0.1` + FFprobe adaptive 480p+720p HLS transcode without upscaling + silent stream test). |
| Integration Tests (`@bosla/api`) | `npm run test` | **PASSED** (`exit 0`) | `1 file`, `4 tests passed (4)` in `56.51s` (`test/api.integration.test.ts` against `embedded-postgres` on port `54329`). |
| Browser E2E (`@bosla/web`) | `npm run test:e2e` | **PASSED** (`exit 0`) | `3 passed (2.0m)` in headless Chromium via `playwright test` (`e2e/bosla.spec.ts`) backed by `apps/api/test/e2e-server.ts` (`embedded-postgres` port `54339`, NestJS port `4100`, Next.js `3000`). |

---

## 2. Detailed Test Coverage

### 2.1 Unit Suites (`17` tests)

1. **`packages/shared/src/shared.test.ts` (`7 passed`)**
   - Shared schemas, constants, E.164 phone normalization helpers, and type invariants.
2. **`apps/api/src/modules/membership/paymob.client.spec.ts` (`2 passed`)**
   - Computes and timing-safe verifies Paymob HMAC-SHA512 signatures across Paymob's ordered payload fields.
   - Rejects tampered `amount_cents`, length-mismatched strings, undefined signatures, and missing secrets in `PAYMOB_MODE=live`.
3. **`apps/api/src/modules/video/media-storage.service.spec.ts` (`2 passed`)**
   - Enforces path traversal protection (`resolveSafeSubpath`) blocking `..` segments and null bytes.
   - Signs and verifies HMAC-SHA256 HLS playback tokens (`signPlaybackToken`, `verifyPlaybackToken`), rejecting tampered or expired tokens.
4. **`apps/api/src/core/guards.spec.ts` (`4 passed`)**
   - Verifies deterministic SHA-256 session token hashing (`hashSessionToken`).
   - Verifies `@Roles` enforcement via `RolesGuard`, `@SkipCsrf` / `x-csrf-token` validation via `CsrfGuard`, and `SessionAuthGuard` blocking `ENROLLMENT_PENDING` users unless `@AllowPendingEnrollment()` is set.
5. **`apps/worker/src/transcoder.test.ts` (`2 passed`)**
   - Runs real FFprobe and FFmpeg binaries (`9.0.1`) to probe a synthetic `720p` MP4 and generate adaptive `480p` + `720p` HLS playlists/segments without upscaling to `1080p`.
   - Transcodes a silent video track gracefully without failing on a missing audio stream.

### 2.2 Backend Integration Suite (`4` tests — `apps/api/test/api.integration.test.ts`)

Backed by a real PostgreSQL instance (`embedded-postgres`), Prisma migration `0001_init`, seeded catalog/CMS data, and NestJS HTTP test harness:

1. **Public Catalog & 3-Content-Type Enforcement:** Verifies seeded Arabic catalog endpoints (`COURSE`, `LEARNING_PATH`, `DIPLOMA`), confirms `/programs` is absent, and validates specialization assessment scoring.
2. **Option A — Google OIDC Auth:** Verifies automatic student account creation and login without forcing password or passkey setup (exercised with `ALLOW_TEST_GOOGLE_TOKENS` local test verifier).
3. **Option B — Phone + Argon2id -> Mandatory WebAuthn Passkey & Non-OTP Recovery:** Verifies `ENROLLMENT_PENDING` gating after mobile registration, real FIDO2 challenge/assertion enrollment via `@simplewebauthn/server`, single-use hashed recovery codes, passkey-based password reset, recovery-code password reset, and multi-passkey reauthentication (zero OTP flows).
4. **End-to-End LMS Lifecycle:** Verifies RBAC enforcement across `ADMIN`/`INSTRUCTOR`/`STUDENT`, course draft -> submit -> admin review/publish workflow, revision versioning, chunked video upload + FFmpeg HLS transcoding, Paymob HMAC-SHA512 webhook subscription activation, content entitlement gating, quiz submission, and certificate issuance.

### 2.3 Full-Stack Browser E2E Suite (`3` tests — `apps/web/e2e/bosla.spec.ts`)

Executed in Chromium against built Next.js (`next start` on `localhost:3000`, runtime `/api/[...path]` proxy to NestJS on `127.0.0.1:4100`), `embedded-postgres` (`54339`), and an in-process FFmpeg HLS transcoder loop:

1. **Public Arabic RTL Storefront, Specialization Quiz, B2B Lead & Catalog (`7.5s`):** Navigates `/`, `/courses`, `/learning-paths`, and `/diplomas`, verifies RTL layout, submits specialization quiz + B2B inquiry, and confirms `/programs` returns HTTP 404.
2. **Non-OTP Auth & Passkey Virtual Authenticator Flow (`8.9s`):** Registers via Mobile + Password, intercepts the mandatory `/security/passkey-setup` gate, enrolls a real FIDO2 WebAuthn credential via Chromium CDP `WebAuthn.addVirtualAuthenticator`, receives single-use recovery codes, authenticates via Passkey, and completes non-OTP password recovery on `/recovery`.
3. **Full LMS Value Chain (`35.6s`):** Instructor performs resumable chunked video upload -> FFmpeg/FFprobe produces HLS playlist -> Instructor submits course -> Admin reviews and publishes in `/admin` -> Student completes Paymob sandbox HMAC checkout -> Watches HLS lesson in `BoslaHlsPlayer` (`hls.js`) -> Passes quiz -> Verifies issued public certificate on `/certificates/[code]`.

*(Note: During `e2e-server.ts` teardown at process exit after all 3 tests pass, Prisma logs expected `ConnectionReset` notices when `embedded-postgres` shuts down.)*

---

## 3. Environment Gaps, Test Substitutions & Untested Integrations

In accordance with strict factual reporting:

1. **Docker & Multi-Container Stack (`Docker`, `Redis`, `Nginx`):** Docker CLI is not installed on this Windows host, so `docker compose up`, the standalone `apps/worker` BullMQ Redis consumer against a real Redis broker, Nginx `X-Accel-Redirect` HLS serving (`/internal-media/`), HTTPS TLS termination, and Coolify container deployment have **not** been runtime-tested locally. Local integration/E2E runs use `ALLOW_INMEMORY_REDIS` and an in-process FFmpeg worker poller (`apps/api/test/e2e-server.ts`).
2. **Google Identity Services (Live OIDC):** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not provisioned in this environment; Option A backend verification was tested with `ALLOW_TEST_GOOGLE_TOKENS` rather than live Google ID tokens.
3. **Paymob Live Merchant API:** `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_API_KEY`, and `PAYMOB_IFRAME_ID` live merchant credentials are unavailable in this environment. Checkout/webhooks ran under `PAYMOB_MODE=sandbox` (`local-sandbox-simulator`) and HMAC-SHA512 signature unit tests (`paymob.client.spec.ts`).
4. **ESLint Next Plugin Warning:** `next build` emits a non-blocking warning (`The Next.js plugin was not detected in your ESLint configuration`) because the workspace uses root ESLint 9 flat config (`eslint.config.mjs`) with `@typescript-eslint`.
