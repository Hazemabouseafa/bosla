# BOSLA Academy — Course Community Security Architecture & Verification Report

**Date:** 2026-11-13  
**Scope:** Course Community access control, role isolation, Lesson Q&A timestamp validation, XSS/CSRF/rate-limit defenses, PII minimization, and full verification results after final implementation edits.

---

## 1. Security Model & Enforced Controls

### 1.1 Backend-Enforced 6-Rule Community Access (`evaluateCommunityAccess` + `CommunityAccessService`)
All community endpoints evaluate permissions server-side on every request (never trusting client state):
1. **Authentication Required:** Unauthenticated requests return `NOT_AUTHENTICATED` on `/access` and `401 Unauthorized` on `/posts`, `/comments`, and `/timestamp-target`.
2. **Active Membership Validated:** Students without an active non-expired subscription (`ACTIVE` with `currentPeriodEnd > now`) are blocked (`NO_ACTIVE_MEMBERSHIP` or `MEMBERSHIP_EXPIRED`) with `403 Forbidden`.
3. **Course Entitlement Checked via Shared Engine:** Reuses `@bosla/shared` (`evaluateCourseAccess` across monthly plans, annual plans, learning paths, and diplomas); unentitled or free-preview-only visits are rejected (`COURSE_NOT_ENTITLED` / `NOT_ENROLLED`).
4. **Course Enrollment / Start Verified:** Students must have an existing `CourseEnrollment`, `LessonProgress`, or `VideoPlaybackLog` (`NOT_ENROLLED`), preserving strict course-start verification while allowing `/learn/[slug]` auto-enroll or explicit `POST /api/v1/learning/courses/:courseId/enroll` (which validates entitlement first).
5. **Published Course Required:** Draft or unpublished courses reject student access (`COURSE_UNPUBLISHED`, HTTP `403`).
6. **Community Enablement & Admin Lock Respected:** Disabled communities block students (`COMMUNITY_DISABLED`, HTTP `403`); when `adminDisabled === true`, even the course instructor is blocked (`403 Forbidden`) from re-enabling the community via `PATCH /api/v1/instructor/communities/courses/:courseId/settings`.

**Expired Membership Behavior:** Once a student's subscription expires (`EXPIRED`, `PAST_DUE`, `CANCELLED`, or past `currentPeriodEnd`), private community endpoints immediately return `403` (`MEMBERSHIP_EXPIRED`), while existing database posts and replies remain preserved for eligible peers, instructors, and admins.

### 1.2 Role Boundaries (`ADMIN` / `INSTRUCTOR` / `STUDENT`)
- **Instructors (`INSTRUCTOR`):** Can manage/moderate/accept answers **only** on courses where `course.instructorId === user.id`. Requests targeting another instructor's course return `403 Forbidden` (`UNASSIGNED_INSTRUCTOR`).
- **Students (`STUDENT`):** Cannot create `ANNOUNCEMENT` posts (`403`), cannot pin/lock/hide/remove posts (`403`), and cannot accept answers (`POST .../accept-answer` -> `403`).
- **Admins (`ADMIN`):** Can view overview analytics, resolve `PENDING` moderation reports (`ACTION_TAKEN` / `DISMISSED` / `REVIEWED`), hide/remove/restore any post/comment, and toggle `adminDisabled`.

### 1.3 Content Safety, Timestamps, PII & Abuse Controls
- **No Raw HTML / XSS Execution:** User inputs (`title`, `body`, comments, report reasons/notes) pass through `sanitizeCommunityText` (`packages/shared/src/community.ts`), stripping `<[^>]*>` HTML tags and control characters; React renders plain UTF-8/Arabic text without `dangerouslySetInnerHTML`.
- **Cross-Course & Duration-Bounded Lesson Timestamps:** `createPost` verifies `lessonId` belongs to the target course's published version (`400 Bad Request` for foreign-course lesson IDs) and rejects negative or out-of-range timestamps (`videoTimestampSeconds > actualDuration`, `400`).
- **Safe Timestamp Resolution (`GET /api/v1/community/posts/:postId/timestamp-target`):** Re-checks BOTH community access and media entitlement (`checkCourseAccessForUser`) before returning internal `playerPath` metadata; never exposes `.m3u8` URLs, local media storage paths, or playback tokens.
- **Zero Author PII Leakage (`PUBLIC_COMMUNITY_AUTHOR_SELECT`):** Community post/comment payloads expose only `{ id, fullName, avatarUrl, headlineAr, isCourseInstructor, isAdminModerator }` — omitting `phoneE164`, `email`, `passwordHash`, and omitting `headlineAr` for student authors.
- **CSRF, Rate Limiting & Duplicate Prevention:**
  - All state-changing routes require HTTP-only session cookie + `X-CSRF-Token` (`CsrfGuard`).
  - Sliding-window per-user rate limits (`RedisService.incrementRateLimit`): `post` (default 25/10m), `comment` (default 60/10m), `report` (default 20/1h) return `429 Too Many Requests` when exceeded.
  - Database unique constraints enforce single-like per user/target and reject duplicate moderation reports (`409 Conflict`).

---

## 2. Executed Verification Results (Post-Final Edit)

All static checks, production builds, unit suites, PostgreSQL integration suites, and headless Chromium E2E suites ran cleanly after the final code/test edit with `0` failures and `0` skipped tests:

| Check | Command | Exit | Exact Scope & Observed Output |
| :--- | :--- | :--- | :--- |
| TypeScript Check | `npm run typecheck` | `0` | Passed across `@bosla/shared`, `@bosla/db`, `@bosla/ui`, `@bosla/api`, `@bosla/worker`, `@bosla/web`. |
| ESLint Check | `npm run lint` | `0` | Passed across `@bosla/shared`, `@bosla/api`, `@bosla/worker`, `@bosla/web` (`eslint src`). |
| Monorepo Build | `npm run build` | `0` | Prisma generate (`v6.19.3`) + `tsc` across packages/services + Next.js `15.5.29` build (`32` routes, including `/courses/[slug]/community` and `/notifications`). |
| Unit: `@bosla/shared` | `npm run test` | `0` | `1 file`, `11 passed (11)` (`src/shared.test.ts` — phone E.164, course/community access engine, timestamp formatting, XSS sanitization, schema rejection). |
| Unit: `@bosla/api` | `npm run test` | `0` | `4 files`, `12 passed (12)` (`paymob.client.spec.ts` [2], `media-storage.service.spec.ts` [2], `guards.spec.ts` [4], `community.service.spec.ts` [4]: rate limit `429`, PII-free author serialization, `adminDisabled` override block, out-of-bounds timestamp rejection). |
| Unit: `@bosla/worker` | `npm run test` | `0` | `1 file`, `2 passed (2)` (`src/transcoder.test.ts` — real FFmpeg + FFprobe adaptive HLS & silent video handling). |
| Integration: `@bosla/api` | `npm run test:integration` | `0` | `2 files`, `6 passed (6)` in `38.44s`: `test/community.integration.test.ts` (`2 passed` in `24.0s`, real `EmbeddedPostgres` port `54349`, migrations `0001`+`0002` + seed) & `test/api.integration.test.ts` (`4 passed` in `31.5s`, port `54329`). |
| Browser E2E: `@bosla/web` | `npm run test:e2e -- --reporter=list` | `0` | `4 passed (1.7m)` in headless Chromium via `e2e-server.ts` (`e2e/bosla.spec.ts` [3 passed] + `e2e/community.spec.ts` [1 passed in `24.4s`]). |

---

## 3. Environment Substitutions & Unexecuted Runtime Integrations

To keep reporting strictly factual:
1. **Docker Compose, Real Redis Broker & Nginx `X-Accel-Redirect`:** Docker CLI, native Redis, and Nginx are not installed on this local Windows build host. Consequently, `docker compose up`, standalone BullMQ consumer execution against Redis for `bosla-community-notifications`, and Nginx `/_internal_hls/` header offloading remain unexecuted locally (integration and E2E runs exercised `ALLOW_INMEMORY_REDIS=true` inline DB fallback and direct NestJS API HLS streaming).
2. **External Credentials (Google OIDC & Paymob Live):** Automated runs exercised local `ALLOW_TEST_GOOGLE_TOKENS=true` HMAC tokens and `PAYMOB_MODE=sandbox` (`HMAC-SHA512` webhook verification) rather than live external Google or Paymob merchant credentials.
3. **Production Deployment Deliberately Skipped:** Per task constraints, no automatic deployment or production database mutation was performed.
