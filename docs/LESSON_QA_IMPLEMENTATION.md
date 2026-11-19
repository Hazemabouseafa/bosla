# BOSLA Academy — Lesson Q&A & Video Timestamp Linking Technical Reference

This document details how lesson-specific Q&A integrates seamlessly into both the **self-hosted HLS player (`BoslaHlsPlayer`)** and the **unified Course Community** without splitting discussions into siloed systems or modifying HLS security/streaming infrastructure.

---

## 1. Unified Data Flow (`Course Community` ↔ `Lesson Q&A`)

1. **No Separate Lesson Forum Tables:** Every question posted in a lesson player is a standard `CommunityPost` (`type = 'QUESTION'`) in the parent course's community with:
   - `courseId`: Parent course ID.
   - `lessonId`: Exact `Lesson.id` from the published `CourseVersion`.
   - `lessonStableKey`: Stable key persisted across course version republishes (`DRAFT` -> `PUBLISHED`).
   - `lessonTitleSnapshot`: Historical fallback title if the lesson is later removed in a newer course version.
   - `videoTimestampSeconds`: Optional non-negative integer bounded by the video duration.
2. **Version-Resilient Lesson Resolution (`resolveCurrentLessonMap` & `listCoursePosts`):**
   - When listing a lesson's questions (`GET /api/v1/community/courses/:courseId/posts?lessonId=...`), the backend resolves the lesson's `stableKey` and queries `{ OR: [{ lessonId }, { lessonStableKey }] }`.
   - When displaying any community card, `formatPostSummary()` resolves the current published lesson ID by `lessonStableKey` so clicking jump-to-lesson navigates to the active lesson revision automatically.
3. **One Thread Everywhere:** Replying, liking, accepting an answer, pinning, locking, or reporting inside `"أسئلة هذا الدرس"` updates the exact same record shown inside `"مجتمع الكورس والمناقشات"`, `/courses/[slug]/community`, `"مجتمعات كورساتي"` (Instructor), and `"إدارة المجتمعات"` (Admin).

---

## 2. Player Integration (`BoslaHlsPlayer` + `/learn/[slug]`)

### Preserved HLS Streaming Contract (`apps/web/src/components/player/BoslaHlsPlayer.tsx`)
- Session minting (`POST /api/v1/lessons/:lessonId/playback-session`), `hls.js` / Safari native playback, adaptive quality selector, playback speed selector, and 10s/pause/ended progress syncing (`POST /api/v1/learning/lessons/:lessonId/progress`) remain untouched.
- **Additive Optional Props for Lesson Q&A Timestamps:**
  - `onTimeChange?: (currentSeconds: number, durationSeconds: number) => void`: Emits current playback position on `onTimeUpdate` to a mutable ref in `/learn/[slug]` (`livePlaybackSecondsRef` & `livePlaybackDurationRef`), avoiding high-frequency React re-renders during playback.
  - `seekToSeconds?: number | null` and `seekTriggerKey?: number`: Changes trigger immediate safe clamping and seeking without destroying/recreating the active `Hls` instance or re-requesting `playback-session`.
  - If playback has not yet finished loading metadata when a deep link (`?t=120`) arrives, `pendingSeekRef` retains `seekToSeconds` and applies it smoothly inside `Hls.Events.MANIFEST_PARSED` (or `loadedmetadata` for native HLS) instead of seeking prematurely to `0`.

### Deep Linking & Video Seeking Flow (`apps/web/src/app/learn/[slug]/page.tsx`)
- **Inbound Notification / Community URL Format:**  
  `/learn/{courseSlug}?lesson={lessonId}&t={seekSeconds}&question={postId}`
- **In-Player Timestamp Seek (`jumpToLessonAndSeek`):**
  1. Switches tab to `'lesson'`, selects `lessonId`, increments `seekTriggerKey`, updates `seekToSeconds`, and scrolls smoothly (`playerContainerRef.current?.scrollIntoView`).
  2. When initiated from outside the active lesson or from `/courses/[slug]/community`, calls `GET /api/v1/community/posts/:postId/timestamp-target` first so the backend validates both community access and course/lesson media access before resolving `playerPath`.
  3. Zero `.m3u8` paths, raw VPS media file paths, or HMAC playback tokens are returned in community payloads.

---

## 3. UI Component Contract (`apps/web/src/components/community/LessonQaSection.tsx`)

Mounted directly below the lesson stage inside `/learn/[slug]`:

- **Section Header:** `أسئلة هذا الدرس` with action button `اسأل عن هذا الدرس`.
- **Inline Question Composer:**
  - Checkbox `ربط السؤال بالوقت الحالي من الفيديو` (default checked for `VIDEO` lessons with known duration > 0), capturing live player position or last watched progress and displaying formatted `MM:SS` badge.
  - Fields: `#lesson-q-title` (`عنوان السؤال`, min 4 / max 180 UI input) and `#lesson-q-body` (`تفاصيل سؤالك`, min 8 / max 5000).
  - Submit button: `نشر السؤال` -> `POST /api/v1/community/courses/:courseId/posts`.
- **Toolbar Controls:**
  - Filter tabs: `جميع الأسئلة` (`all`), `بدون إجابة` (`unanswered`), `تمت الإجابة` (`answered`).
  - Search input: `#` search across question titles and bodies.
  - Sort dropdown: `الأحدث` (`latest`) vs `الأكثر تفاعلاً` (`relevant`).
- **Question Cards & Thread Modal (`CommunityThreadModal.tsx`):**
  - Displays `مثبت`, `تمت الإجابة` / `بانتظار الإجابة`, instructor participation badge `إجابة المدرب`, clickable timestamp button `شاهد الجزء المرتبط بالسؤال — MM:SS` calling `onSeekTimestamp(seconds)`, accepted answer preview box `الإجابة المعتمدة`, like counter toggle, and reply count.
  - Clicking a question opens `CommunityThreadModal` (`عرض الإجابات والمناقشة`) with 2-level threaded replies, `إجابة المدرب` / `إدارة الأكاديمية` / `الإجابة المعتمدة` badges, duplicate-safe likes (`مفيد`), instructor/admin `اعتماد الإجابة` & moderation bar (`تثبيت`, `إغلاق`/`فتح`, `إخفاء`/`إظهار`, `حذف`), and user content reporting (`إبلاغ`).

---

## 4. Server-Side Validation Rules for Lesson Timestamps

Enforced in both `@bosla/shared` (`createCommunityPostSchema`) and `CommunityService.validateTimestampForLesson`:
1. `videoTimestampSeconds` is permitted **only** when `type === 'QUESTION'` and `lessonId` is supplied (`400 Bad Request` otherwise).
2. `lessonId` must belong to the target `courseId` and (for students) match the currently published `CourseVersion` (`400 Bad Request` on cross-course IDs).
3. Target lesson must be a video lesson (`lesson.type === 'VIDEO'` or `Boolean(lesson.videoAssetId)`).
4. Value must be a finite integer `>= 0` and `<= actualDuration` (derived from `videoAsset.durationSeconds` or `lesson.durationSeconds`). Out-of-bounds values return HTTP `400`.
