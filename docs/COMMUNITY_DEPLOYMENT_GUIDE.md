# BOSLA Academy — Safe Coolify & KVM1 VPS Community Upgrade Guide

This guide covers deploying the **Course Community & Lesson Q&A** upgrade onto an existing production BOSLA Academy deployment on Coolify without data loss, without resetting PostgreSQL, and without interrupting Paymob, authentication, or HLS streaming.

---

## 1. Pre-Deployment Checklist (Production Safety First)

1. **Take an Immediate PostgreSQL Snapshot Before Merging/Deploying**  
   Run a backup from inside the running `postgres` / `api` container using the existing `infrastructure/scripts/backup-db.sh` logic:
   ```bash
   pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "/var/bosla/backups/postgres/pre_community_$(date +%Y%m%d_%H%M%S).sql.gz"
   ```
2. **Verify Persistent Volumes Stay Attached (Never Recreate Volumes)**  
   In `docker-compose.yml`, preserve these named volumes untouched:
   - `bosla_pg_data` -> `/var/lib/postgresql/data` (all existing users, courses, subscriptions, payments, progress)
   - `bosla_redis_data` -> `/data` (AOF persistence)
   - `bosla_media_data` -> `/var/bosla/media` (existing uploaded MP4 sources, transcoded HLS `.m3u8`/`.ts`, attachments, thumbnails)
3. **Never Run Destructive Prisma Commands on Production**  
   Do **NOT** run `prisma migrate reset`, `prisma db push --force-reset`, or volume pruning.

---

## 2. Database Migration & Idempotent Backfill

`infrastructure/docker/Dockerfile.api` automatically runs:
```sh
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/main.js
```
Upon startup of the updated `api` container, Prisma detects and applies only the new additive migration:
- `packages/db/prisma/migrations/0002_course_community_lesson_qa/migration.sql`

### What `0002_course_community_lesson_qa` Modifies
- **Creates new enums & tables only:** `CourseEnrollment`, `CourseCommunitySettings`, `CommunityPost`, `CommunityComment`, `CommunityReaction`, `CommunityReport`, `CommunityModerationLog`, `Notification`, `NotificationPreference`.
- **Zero existing tables dropped or altered destructively.** Existing `User`, `Course`, `Lesson`, `Subscription`, `PaymentTransaction`, `VideoAsset`, `Quiz`, and `Certificate` rows remain completely intact.
- **Safe Backfill Executed Inside the Migration:**
  - Creates default enabled `CourseCommunitySettings` rows for all existing courses (`ON CONFLICT ("courseId") DO NOTHING`).
  - Backfills `CourseEnrollment` (`source = 'BACKFILL_PROGRESS'`) from existing `LessonProgress` records (`ON CONFLICT ("userId", "courseId") DO NOTHING`) so active students immediately retain community access.

*(Optional)* Do **not** blindly run `db:seed` in production unless you specifically want demo accounts/sample posts, because `seed.ts` creates/updates demo seed records if missing. Production courses already receive `CourseCommunitySettings` via SQL backfill in `0002`.

---

## 3. Environment Variables & KVM1 Tuning (1 vCPU / 4 GB RAM / 50 GB NVMe)

No mandatory new environment variables are required for basic operation (all defaults work out of the box alongside existing variables in `docker-compose.yml`). Optional tuning variables supported by the API:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `COMMUNITY_POST_RATE_LIMIT` | `25` | Max posts/questions per user per 10 minutes |
| `COMMUNITY_COMMENT_RATE_LIMIT` | `60` | Max comments/replies per user per 10 minutes |
| `COMMUNITY_REPORT_RATE_LIMIT` | `20` | Max abuse reports per user per hour |
| `WORKER_CONCURRENCY` | `2` | Video transcoding worker concurrency (recommend `1` or `2` on 1 vCPU KVM1 to avoid starving API/Postgres during simultaneous FFmpeg jobs) |
| `ALLOW_INMEMORY_REDIS` | unset (`false` in prod) | **Must remain unset/`false` in production** so rate limiting and BullMQ queue `bosla-community-notifications` use Redis (`redis://redis:6379`) |

### KVM1 Resource Notes
- Notification delivery reuses the existing `worker` container (`apps/worker/dist/main.js`) with lightweight `notificationWorker` (`concurrency: 2`), avoiding an extra Node.js container in RAM.
- All community feeds use cursor pagination (`limit` capped at `50`) and indexed SQL lookups; `NotificationBell` loads on navigation/focus without background intervals or WebSocket memory overhead.
- Ensure swap space (e.g., 2 GB on NVMe) and disk monitoring (`infrastructure/scripts/check-disk.sh`) remain active alongside FFmpeg transcoding.

---

## 4. Coolify Redeploy Order & Post-Deploy Verification

1. **Rebuild & Redeploy via Coolify (`docker-compose.yml`):**  
   Redeploy the Docker Compose stack so `api`, `worker`, and `web` rebuild from the updated monorepo (`@bosla/shared`, `@bosla/db`, `@bosla/api`, `@bosla/worker`, `@bosla/web`). `nginx` continues routing `/api/*` -> `api:4000`, `/*` -> `web:3000`, and `X-Accel-Redirect` -> `/_internal_hls/`.
2. **Verify Migration Status inside `api` Container:**
   ```bash
   npx prisma migrate status --schema=packages/db/prisma/schema.prisma
   ```
   Confirm both `0001_init` and `0002_course_community_lesson_qa` are marked applied with zero drift.
3. **Verify Health & Swagger Endpoints:**
   - `GET /api/v1/health` returns `200 OK`.
   - `GET /api-docs` exposes the new tags (`Course Community & Lesson Q&A`, `Instructor Community Management`, `Admin Community Governance`, `Notifications & Preferences`).
4. **Functional Production Smoke Check:**
   - **Unauthenticated visitor** on `/courses/<published-slug>/community`: sees `"يلزم تسجيل الدخول للوصول إلى مجتمع الكورس وأسئلة الدروس"`, API `/posts` returns `401`.
   - **Eligible enrolled student** on `/learn/<published-slug>`: sees `أسئلة هذا الدرس` under the HLS player, submits a timestamped question, confirms click-to-seek works inside the player, and sees the same question under `مجتمع الكورس والمناقشات`.
   - **Assigned Instructor** on `/instructor`: sees `مجتمعات كورساتي`, answers with badge `إجابة المدرب`, clicks `اعتماد الإجابة`.
   - **Student header bell**: receives notification and deep-links back to `/learn/<slug>?lesson=...&t=...&question=...`.
   - **Admin** on `/admin` -> `إدارة المجتمعات`: confirms overview stats, report queue, and toggleable course community disable/enable.

---

## 5. Safe Rollback Procedure (If Needed)

1. If an unexpected frontend or API issue occurs, rollback only application containers (`api`, `worker`, `web`) to the previous Docker image/commit first. Because migration `0002` is strictly additive (new tables and new enums only), the previous version of the codebase can run safely against the upgraded database without touching existing tables.
2. Only if a full database rollback is explicitly required, restore the pre-deployment `pg_dump` snapshot taken in Step 1 into a maintenance window.
