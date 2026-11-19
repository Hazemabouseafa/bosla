# BOSLA Academy — Course Community & Lesson Q&A Implementation Report

**Platform:** BOSLA Academy (`أكاديمية بوصلة`)  
**Scope:** Course Communities, Unified Lesson Q&A, Video Timestamp Linking, Notifications, Instructor Dashboard, Admin Governance  
**Constraint Compliance:** Existing LMS architecture, authentication (Google OIDC + WebAuthn Passkeys, Zero OTP), Paymob billing, and FFmpeg/HLS streaming infrastructure remain preserved without breaking changes or destructive database resets.

---

## 1. Architecture Summary & Design Decisions

### Unified Community Model (Course-Scoped)
- **Strictly Three Roles (`UserRole`):** `ADMIN`, `INSTRUCTOR`, `STUDENT`.
- **Strictly Three Educational Content Types (`ContentType`):** `COURSE`, `LEARNING_PATH`, `DIPLOMA` (no `Program` type exists).
- Every published course shares **one unified community** stored in `CommunityPost`, `CommunityComment`, `CommunityReaction`, `CommunityReport`, `CommunityModerationLog`, and `CourseCommunitySettings`.
- Students accessing a course via a **Monthly membership**, **Annual membership**, **Learning Path**, or **Diploma** share the same course community without duplicating discussions.
- **Unified Lesson Q&A (`lessonId` + `lessonStableKey`):** Lesson-specific questions are stored as `CommunityPost` rows (`type = 'QUESTION'`) with optional `lessonId`, `lessonStableKey`, `lessonTitleSnapshot`, and `videoTimestampSeconds`. Because courses support draft/published versioning (`CourseVersion`), storing `lessonStableKey` alongside `lessonId` preserves continuity across republished course versions via `resolveCurrentLessonMap()`.

### Lightweight KVM1-Conscious Architecture
Designed specifically to coexist cleanly with FFmpeg HLS transcoding on modest single-VPS hardware (1 vCPU / 4 GB RAM / 50 GB NVMe):
- **Standard REST + PostgreSQL Cursor Pagination:** No WebSockets server, no heavy fan-out pub/sub loops, and no aggressive polling loops (`NotificationBell` loads on mount, window focus, and bell open).
- **Indexed PostgreSQL Queries:** Composite indexes on `(courseId, deletedAt, status, isPinned, createdAt)`, `(courseId, lessonId, deletedAt, createdAt)`, `(courseId, lessonStableKey, deletedAt, createdAt)`, `(courseId, type, isAnswered, deletedAt)`, and `(userId, isRead, createdAt)`.
- **Bounded 2-Level Comment Threading:** Top-level replies plus one nested level (`parentCommentId`) prevent unbounded recursive N+1 queries.
- **Dual-Mode Notification Delivery (`RedisService` + `NotificationsService`):** Attempts asynchronous batch queuing via BullMQ queue `bosla-community-notifications` (consumed in `apps/worker/src/main.ts`, `concurrency: 2`, max 3 attempts) and falls back cleanly to inline `prisma.notification.createMany({ skipDuplicates: true })` when `ALLOW_INMEMORY_REDIS=true` or Redis is temporarily unavailable. Deduplication is enforced at PostgreSQL level via unique `(userId, dedupKey)`.

---

## 2. Database Schema & Additive Migration (`packages/db`)

**Migration:** `packages/db/prisma/migrations/0002_course_community_lesson_qa/migration.sql`  
Non-destructive, additive schema expansion (`prisma migrate deploy` safe; zero dropped columns or reset tables):

| Table / Model | Purpose | Key Columns & Constraints |
| :--- | :--- | :--- |
| `CourseEnrollment` | Tracks explicit/implicit course start for community rule #4 | Unique `(userId, courseId)`, index `(courseId, startedAt)`, `source` |
| `CourseCommunitySettings` | Per-course instructor & admin toggles | Unique `courseId`, `isEnabled`, `adminDisabled`, `allowStudentDiscussions` |
| `CommunityPost` | Unified course posts & lesson questions | `type` (`QUESTION`, `DISCUSSION`, `ANNOUNCEMENT`), `lessonId`, `lessonStableKey`, `lessonTitleSnapshot`, `videoTimestampSeconds`, `status` (`ACTIVE`, `HIDDEN`, `REMOVED`), `isPinned`, `isLocked`, `isAnswered`, `acceptedCommentId` (unique), `firstInstructorReplyAt`, `likeCount`, `commentCount`, `deletedAt` |
| `CommunityComment` | Replies & bounded 1-level sub-replies | `postId`, optional `parentCommentId`, `authorId`, `body`, `likeCount`, `deletedAt` |
| `CommunityReaction` | Duplicate-safe likes on posts or comments | `targetType` (`POST`, `COMMENT`), unique `(userId, postId, type)`, unique `(userId, commentId, type)` |
| `CommunityReport` | Moderation report queue | `status` (`PENDING`, `REVIEWED`, `ACTION_TAKEN`, `DISMISSED`), unique `(reporterId, postId)` & `(reporterId, commentId)` |
| `CommunityModerationLog` | Immutable moderation & governance trail | `courseId`, optional `postId`/`commentId`, `actorId`, `actorRole`, `action`, `reason`, `metadata` |
| `Notification` | User notifications with deep-link navigation | `type` (`NotificationType`), `titleAr`, `bodyAr`, `actionUrl`, `dedupKey`, unique `(userId, dedupKey)`, `isRead`, `readAt` |
| `NotificationPreference` | Per-user opt-in/out notification settings | Unique `userId`, `notifyOnInstructorReply`, `notifyOnDiscussionReply`, `notifyOnAcceptedAnswer`, `notifyOnNewStudentQuestion` |

### Safe Existing-Data Backfill Included in `0002`
1. Inserts default enabled `CourseCommunitySettings` rows (`ON CONFLICT ("courseId") DO NOTHING`) for all existing courses.
2. Backfills `CourseEnrollment` (`source = 'BACKFILL_PROGRESS'`, `ON CONFLICT ("userId", "courseId") DO NOTHING`) from existing `LessonProgress` rows so active learners retain immediate community access.
3. `packages/db/prisma/seed.ts` idempotently seeds starter community announcements, timestamped lesson questions, accepted instructor replies, course enrollments for the demo student, and sample notifications.

---

## 3. Shared Domain Logic & Validation (`packages/shared`)

- **`packages/shared/src/enums.ts`:** Defines `COMMUNITY_POST_TYPES`, `COMMUNITY_POST_STATUSES`, `COMMUNITY_TARGET_TYPES`, `COMMUNITY_REACTION_TYPES`, `COMMUNITY_REPORT_STATUSES` (`PENDING`, `REVIEWED`, `ACTION_TAKEN`, `DISMISSED`), and `NOTIFICATION_TYPES`.
- **`packages/shared/src/entitlements.ts` (`evaluateCommunityAccess`):** Pure single-source-of-truth access evaluator returning `{ allowed, canPost, canModerate, reason, messageAr }` enforcing all 6 student conditions (`NOT_AUTHENTICATED`, `COURSE_UNPUBLISHED`, `COMMUNITY_DISABLED`, `MEMBERSHIP_EXPIRED`, `NO_ACTIVE_MEMBERSHIP`, `COURSE_NOT_ENTITLED`, `NOT_ENROLLED`), assigned-course ownership for instructors (`OWNER_INSTRUCTOR` vs `UNASSIGNED_INSTRUCTOR`), and global oversight for `ADMIN`. Note: Free-preview lesson viewing alone (`!hasStartedCourse` or without entitlement for paid courses) does **not** bypass community access rules.
- **`packages/shared/src/community.ts`:**
  - `sanitizeCommunityText`: Strips control characters and HTML tags (`<[^>]*>`) while preserving Arabic/UTF-8 text.
  - `formatVideoTimestamp`: Formats integer seconds as `MM:SS` or `H:MM:SS`.
  - Zod schemas: `createCommunityPostSchema` (title 4–200, body 8–5000; enforces `videoTimestampSeconds` is integer `0..86400` and permitted only when `type === 'QUESTION'` with `lessonId`), `createCommunityCommentSchema` (body 2–3000), `acceptCommunityAnswerSchema`, `moderateCommunityPostSchema`, `updateCommunitySettingsSchema`, `createCommunityReportSchema`, `resolveCommunityReportSchema` (disallows `PENDING`), `updateNotificationPreferencesSchema`.

---

## 4. Backend REST APIs (`apps/api`)

### Enrollment Activation (`apps/api/src/modules/learning`)
- `POST /api/v1/learning/courses/:courseId/enroll` — Verifies course entitlement (`FREE_COURSE` or active membership via `MembershipService`) and idempotently creates `CourseEnrollment`, used automatically by the `/learn/[slug]` player and explicitly from community unlock CTAs.

### Course Community & Lesson Q&A (`apps/api/src/modules/community`)
- `GET /api/v1/community/courses/:courseId/access` (`OptionalSessionAuthGuard`) — Returns server-evaluated `access` decision (`evaluateCommunityAccess`), `course`, and `settings` without exposing private posts.
- `GET /api/v1/community/courses/:courseId/posts` (`SessionAuthGuard`) — Supports `lessonId` (resolving `lessonStableKey` automatically so questions stay visible across published course revisions), `filter` (`all`, `questions`, `lesson_questions`, `unanswered`, `answered`, `announcements`), `sort` (`latest`, `relevant`), `search`, `cursor`, `limit`, and `includeHidden` (moderators only).
- `POST /api/v1/community/courses/:courseId/posts` (`SessionAuthGuard, CsrfGuard`) — Enforces `canPost`, per-user Redis/memory sliding-window rate limit (`COMMUNITY_POST_RATE_LIMIT`, default 25 / 10 min), instructor-only `ANNOUNCEMENT`, `allowStudentDiscussions`, cross-course `lessonId` ownership check, and video duration ceiling validation on `videoTimestampSeconds`.
- `GET /api/v1/community/posts/:postId` — Returns post detail + 2-level comments + server `permissions` (`canModerate`, `canPost`, etc.).
- `GET /api/v1/community/posts/:postId/timestamp-target` — Verifies BOTH community access and media entitlement before returning `{ courseId, courseSlug, lessonId, seekSeconds, postId, playerPath }` (zero raw `.m3u8` paths or signing secrets returned).
- `POST /api/v1/community/posts/:postId/comments` (`CsrfGuard`) — Creates reply/nested sub-reply, increments `commentCount`, sets `firstInstructorReplyAt` on first instructor/admin response, updates rate limit (`COMMUNITY_COMMENT_RATE_LIMIT`, default 60 / 10 min), and dispatches targeted notifications.
- `POST /api/v1/community/posts/:postId/like` & `POST /api/v1/community/comments/:commentId/like` (`CsrfGuard`) — Transactional toggle backed by unique constraints.
- `POST /api/v1/community/posts/:postId/accept-answer` (`CsrfGuard`) — Assigned course `INSTRUCTOR` or `ADMIN` only; sets `acceptedCommentId` and `isAnswered = true`, logs to `CommunityModerationLog`, and notifies question author.
- `POST /api/v1/community/posts/:postId/moderate` (`CsrfGuard`) — Moderator actions (`PIN`, `UNPIN`, `LOCK`, `UNLOCK`, `HIDE`, `REMOVE`, `RESTORE`, `MARK_ANSWERED`, `MARK_UNANSWERED`).
- `DELETE /api/v1/community/comments/:commentId` (`CsrfGuard`) — Soft-deletes comment (author or course moderator).
- `POST /api/v1/community/reports` (`CsrfGuard`) — Enforces rate limit (`COMMUNITY_REPORT_RATE_LIMIT`, default 20 / hour) and prevents duplicate reports per user/target (`409 Conflict`).

### Instructor & Admin Endpoints
- `GET /api/v1/instructor/communities` & `PATCH /api/v1/instructor/communities/courses/:courseId/settings` (`RolesGuard` for `INSTRUCTOR`, `ADMIN`) — Scoped strictly to instructor-owned courses; blocks instructor re-enable when `adminDisabled === true`.
- `GET /api/v1/admin/communities/overview`, `GET /api/v1/admin/communities/posts`, `PATCH /api/v1/admin/communities/courses/:courseId/settings`, `GET /api/v1/admin/communities/reports?status=`, `POST /api/v1/admin/communities/reports/:reportId/resolve` (`RolesGuard` for `ADMIN`).

### Notifications (`apps/api/src/modules/notifications`)
- `GET /api/v1/notifications`, `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`, `GET /api/v1/notifications/preferences`, `PATCH /api/v1/notifications/preferences`.

---

## 5. Frontend Integration (`apps/web`)

- **Integrated Learning Player (`apps/web/src/app/learn/[slug]/page.tsx`):**
  - Renders `<LessonQaSection />` (`أسئلة هذا الدرس`) directly below the lesson content/HLS video player.
  - Provides tab switcher between **الدرس ومحتوى التعلم** and **مجتمع الكورس والمناقشات** (`<CourseCommunityPanel />`).
  - Handles query parameters (`?lesson=`, `?t=`, `?question=`, `?tab=community`) for deep-linking from notifications or community cards.
  - Awaits auto-enrollment (`POST /api/v1/learning/courses/:courseId/enroll`) when eligible learners first open the player so community access works seamlessly on first visit.
- **Course Detail Hero CTA (`apps/web/src/app/courses/[slug]/page.tsx`):** Links directly to `/courses/[slug]/community`.
- **Full Course Community Route (`apps/web/src/app/courses/[slug]/community/page.tsx`):** Displays full unified `CourseCommunityPanel` with server access notices (`NOT_AUTHENTICATED`, `NOT_ENROLLED`, `MEMBERSHIP_EXPIRED`, `NO_ACTIVE_MEMBERSHIP`, `COMMUNITY_DISABLED`).
- **Header & Notifications (`apps/web/src/components/layout/SiteShell.tsx`, `NotificationBell.tsx`, `apps/web/src/app/notifications/page.tsx`):** Displays unread count badge, notification dropdown with mark-read + deep-link navigation, and dedicated `/notifications` page.
- **Student Settings (`apps/web/src/app/student/settings/page.tsx`):** Adds 4 toggleable notification preference checkboxes backed by `/api/v1/notifications/preferences`:
  - `إشعار عند إجابة المدرب على سؤالي` (`notifyOnInstructorReply`)
  - `إشعار عند الرد على مناقشاتي وتعليقاتي` (`notifyOnDiscussionReply`)
  - `إشعار عند اعتماد إجابة لسؤالي` (`notifyOnAcceptedAnswer`)
  - `إشعارات أسئلة الطلاب الجديدة (للمدربين)` (`notifyOnNewStudentQuestion`)
- **Instructor & Admin Portals:**
  - `<InstructorCommunitiesPanel />` mounted in `apps/web/src/app/instructor/page.tsx` (`مجتمعات كورساتي`).
  - `<AdminCommunitiesPanel />` mounted as `'communities'` tab (`إدارة المجتمعات`) in `apps/web/src/app/admin/page.tsx`.
