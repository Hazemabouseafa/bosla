# BOSLA Academy — Audit Findings & Implementation Fixes

**Branch:** `feat/audit-video-commerce-certificates`  
**Migration:** `packages/db/prisma/migrations/0007_video_commerce_cert_audit/migration.sql`  
**Excluded Scope:** Searchable AI Transcription (no transcript pages, no transcript search, no transcription API).

---

## 1. Video Features (`3.A` – `3.K`)

### 3.A — Adaptive Streaming (`VERIFIED`)
- **Findings:**
  - `apps/worker/src/main.ts` probed source resolution with `ffprobe` and generated non-upscaled HLS variants (`480p`, `720p`, `1080p`) plus `master.m3u8` with `BANDWIDTH`, `RESOLUTION`, and `CODECS`.
  - However, `BoslaHlsPlayer.tsx` always initialized `hls.js` in auto mode with no learner UI to inspect available levels or manually switch between `Auto` and specific renditions (`480p`, `720p`, `1080p`).
- **Fixes Implemented:**
  - Upgraded `apps/web/src/components/player/BoslaHlsPlayer.tsx` (`data-testid="player-quality-select"`) to read `hls.levels` on `MANIFEST_PARSED`, expose `تلقائي (Auto)` (`currentLevel = -1`) plus each transcoded resolution level, and display the currently active streaming resolution badge (`LIVE AUTO • 720p`).

### 3.B — Resume Watching (`VERIFIED`)
- **Findings:**
  - `LearningService.saveLessonProgress` in `apps/api/src/modules/learning/learning.service.ts` unconditionally overwrote `lastPositionSec` and `progressPercent` on every `POST /learning/lessons/:lessonId/progress` call.
  - Out-of-order network requests could regress `progressPercent`, and completing a lesson (`completed: true`) followed by seeking backward could un-complete or lower completion progress.
  - `BoslaHlsPlayer.tsx` neither restored `lastPositionSec` on mount nor provided a learner action to restart from `00:00`.
- **Fixes Implemented:**
  - Implemented `resolveMonotonicLessonProgress` in `packages/shared/src/audit-helpers.ts` and wired it into `LearningService.saveLessonProgress`:
    - `progressPercent` is strictly monotonic (`Math.max(existing.progressPercent, incoming.progressPercent)`).
    - `completedAt` is preserved permanently once a lesson reaches completion.
    - `lastPositionSec` tracks the learner's current resume bookmark independently of completion state, and supports explicit `restartFromZero: true` without revoking lesson completion.
  - Updated `BoslaHlsPlayer.tsx` to seek to `initialPositionSec` on `loadedmetadata`, throttle background progress writes, and display a resume banner with a one-click **"البدء من الأول"** (`data-testid="player-restart-btn"`) button.

### 3.C — Personalized Video Watermark (`VERIFIED`)
- **Findings:**
  - No watermark overlay or admin watermark policy existed in the player or backend settings.
- **Fixes Implemented:**
  - Added `watermarkPolicySchema` in `packages/shared/src/schemas.ts` (`enabled`, `opacity`, `rotationIntervalSec`, `showLearnerCode`, `showCourseId`, `showTimestamp`) and admin policy persistence at `PUT /api/v1/admin/settings/video_watermark` (`AdminService.upsertSiteSetting` + `AdminCmsSettingsPanel.tsx`).
  - Added `buildLearnerWatermarkDescriptor` in `packages/shared/src/audit-helpers.ts`, generating a non-sensitive masked learner identifier (`USR-<6-char-id> • **1201`) that never exposes full phone numbers, emails, or national IDs.
  - Rendered a pointer-events-none moving overlay inside the `<video>` fullscreen container in `BoslaHlsPlayer.tsx` (`data-testid="bosla-video-watermark"`) that remains visible in both normal and fullscreen playback without blocking controls, and respects `prefers-reduced-motion`.
  - **Honest Architectural Disclosure:** The watermark is a **dynamic client-side HTML/CSS overlay** inside the video container, **not** a server-side forensic per-subscriber video burn-in.

### 3.D — Signed Playback Access, Token Refresh & Session Revocation (`VERIFIED`)
- **Findings:**
  - `MediaStorageService.signPlaybackPath` signed `{ sub, assetId, pathPrefix, exp }` with HMAC-SHA256 (15-minute TTL) and `VideoService.authorizeHlsFile` rewrote child playlists/segments with per-file tokens.
  - **Gap 1:** Tokens were not bound to the user's `AuthSession.id`, so revoking a user session or logging out did not invalidate already-issued 15-minute HLS tokens.
  - **Gap 2:** No playback token refresh endpoint existed for lessons longer than 15 minutes.
- **Fixes Implemented:**
  - Added optional `sessionId` and `playbackSessionId` claims (`sid`, `psid`) to `MediaStorageService.signPlaybackPath` and `verifyPlaybackToken`.
  - In `VideoService.authorizeHlsFile`, when `sid` is present on a token, the server verifies that `AuthSession` exists, belongs to `payload.sub`, has `revokedAt === null`, and has `expiresAt > now`. Revoked sessions immediately receive `401 Unauthorized`.
  - Added `POST /api/v1/learning/lessons/:lessonId/refresh-playback-token` (`LearningController.refreshPlaybackToken` -> `VideoCaptionsAndAnalyticsService.refreshLessonPlaybackToken`) which re-verifies active session + course entitlement + B2B seat validity before issuing a fresh signed master playlist URL and signed caption track URLs.
  - Wired proactive token refresh every 10 minutes + automatic recovery on `hls.js` network `401/403` errors in `BoslaHlsPlayer.tsx`.

### 3.E — Domain / Origin / Hotlink Restriction (`VERIFIED`)
- **Findings:**
  - `VideoController.serveHlsFile` did not inspect `Origin` or `Referer` headers, and `infrastructure/nginx/nginx.conf` did not enforce `valid_referers` on `/api/v1/media/hls/` or `/_protected_media/hls/`.
- **Fixes Implemented:**
  - Added `MediaStorageService.isOriginOrRefererAllowed(origin, referer)` checking against `MEDIA_ALLOWED_ORIGINS` / `CORS_ORIGIN` (`localhost:3000`, `127.0.0.1:3000`, and configured production domains).
  - Enforced origin/referer validation in `VideoController.serveHlsFile` (for both HLS files and `.vtt` subtitle tracks), returning `403 Forbidden` to cross-origin hotlink requests.
  - Updated `infrastructure/nginx/nginx.conf` with `valid_referers none blocked server_names localhost 127.0.0.1 ~\.bosla\.academy;` on `/api/v1/media/hls/` and `internal;` on `/_protected_media/captions/`.

### 3.F — Meaningful Video Analytics (`VERIFIED`)
- **Findings:**
  - Only `LessonProgress` (`progressPercent`, `lastPositionSec`) existed; no watch sessions, heartbeat validation, drop-off buckets, or instructor/admin video analytics existed.
- **Fixes Implemented:**
  - Added `VideoPlaybackSession` in Prisma (`0007_video_commerce_cert_audit`) storing `userId`, `courseId`, `lessonId`, `videoAssetId`, `authSessionId`, `activeWatchSeconds`, `maxPositionSec`, `lastPositionSec`, `playbackRate`, `selectedQuality`, `reached25/50/75/100`, `completed`, and `heartbeatCount`.
  - Implemented `clampHeartbeatWatchDelta` in `packages/shared/src/audit-helpers.ts` so seeks, paused tabs, or rapid spoofed requests cannot inflate `activeWatchSeconds` beyond elapsed wall-clock time × playback speed.
  - Added `POST /api/v1/learning/lessons/:lessonId/playback-session`, `POST /api/v1/learning/lessons/:lessonId/playback-heartbeat`, and `GET /api/v1/instructor/courses/:courseId/video-analytics`.

### 3.G — Automatic & Manual Timed WebVTT Subtitles (No Searchable AI Transcription) (`VERIFIED` / Auto ASR `BLOCKED` by local Whisper binary)
- **Findings:**
  - Zero subtitle/caption support existed in Prisma, worker, API, or `BoslaHlsPlayer.tsx`.
- **Fixes Implemented:**
  - Added `CaptionTrackStatus` (`QUEUED`, `PROCESSING`, `READY`, `FAILED`, `BLOCKED`) and `VideoCaptionTrack` in Prisma (`0007_video_commerce_cert_audit`).
  - Implemented `validateAndNormalizeWebVtt` in `packages/shared/src/audit-helpers.ts` (rejects non-WebVTT files, strips `<script>` tags, validates timestamp cue arrows `-->`).
  - Added instructor/admin manual WebVTT upload (`POST /api/v1/instructor/videos/:videoId/captions`), automatic local ASR queue job (`POST /api/v1/instructor/videos/:videoId/captions/auto`), track listing (`GET /api/v1/instructor/videos/:videoId/captions`), deletion (`DELETE /api/v1/instructor/videos/:videoId/captions/:trackId`), and signed WebVTT delivery (`GET /api/v1/media/hls/:assetId/captions/:file?token=...`).
  - Built `apps/worker/src/captions.ts` (`runAutomaticCaptionJob`) which extracts 16 kHz mono WAV audio via local FFmpeg and invokes a local Whisper CLI binary (`ASR_WHISPER_CLI_PATH`). When `ASR_WHISPER_CLI_PATH` is not configured, it records an honest `BLOCKED` status without uploading private media to any external API.
  - Wired `<track kind="subtitles">` and a subtitle language selector (`data-testid="player-subtitle-select"`) into `BoslaHlsPlayer.tsx` and built the instructor WebVTT management modal in `apps/web/src/app/instructor/videos/page.tsx`.
  - **Strict Scope Exclusion:** No transcript pages, transcript search endpoints, or transcription APIs were created.

### 3.H — Download Control (`VERIFIED`)
- **Findings:**
  - `LearningService.resolveLessonAttachmentDownload` did not check `LessonAttachment.isDownloadable`, and videos had no `isDownloadable` policy flag or controlled download endpoint.
- **Fixes Implemented:**
  - Added `VideoAsset.isDownloadable` (default `false`) in Prisma (`0007_video_commerce_cert_audit`).
  - Enforced `attachment.isDownloadable` in `LearningService.resolveLessonAttachmentDownload` (`403 Forbidden` when disabled).
  - Added `PATCH /api/v1/instructor/videos/:videoId/download-policy`, `PATCH /api/v1/instructor/attachments/:id/download-policy`, and `GET /api/v1/learning/videos/:assetId/download` (entitlement + `isDownloadable` gated).
  - Configured `controlsList="nodownload"` and `onContextMenu={(e) => e.preventDefault()}` on `<video>` in `BoslaHlsPlayer.tsx` whenever `isDownloadable === false`, and showed the controlled download button (`data-testid="player-download-video-btn"`) only when enabled.

### 3.I — Persistent Playback Speed (`VERIFIED`)
- **Findings:**
  - No playback speed selector or server-side learner preference existed.
- **Fixes Implemented:**
  - Added `User.preferredPlaybackRate` (default `1.0`) in Prisma (`0007_video_commerce_cert_audit`).
  - Validated allowed playback rates (`0.5`, `0.75`, `1`, `1.25`, `1.5`, `1.75`, `2`) via `normalizePlaybackSpeed` and persisted them via `GET/PUT /api/v1/learning/preferences` + `localStorage` fallback.
  - Added speed selector (`data-testid="player-speed-select"`) in `BoslaHlsPlayer.tsx` that reapplies `video.playbackRate` across lesson changes, quality switches, and page reloads.

### 3.J — Quiz Integration (`VERIFIED`)
- **Findings:**
  - `LearningService.submitQuizAttempt` returned `correctOptionId` and `explanationAr` unconditionally even when a learner failed and still had remaining attempts (`maxAttempts > attemptCount`), leaking the answer key before retry.
  - Rapid concurrent submissions could bypass `maxAttempts` due to lack of row-level serialization.
- **Fixes Implemented:**
  - Wrapped `LearningService.submitQuizAttempt` inside a `prisma.$transaction` acquiring a PostgreSQL advisory transaction lock (`pg_advisory_xact_lock`) per `(userId, quizId)` before counting attempts.
  - Gated `correctOptionId` and `explanationAr` via `shouldDiscloseQuizAnswers` so answer keys are only disclosed when the learner passes (`passed === true`) or exhausts all allowed attempts (`remainingAttempts === 0`).

### 3.K — Course Completion Certificates (`VERIFIED`)
- **Findings:**
  - `LearningService.saveLessonProgress` auto-issued `ATTENDANCE_COMPLETION` certificates as soon as video/article/pdf lessons were marked complete, even if the course contained a required quiz that the learner had not passed (`certificateMode === 'QUIZ_AND_PROGRESS'`).
  - Concurrent lesson completion + quiz submission could create duplicate certificates for the same `(userId, courseId, kind)`.
  - `AdminOperationsService.revokeCertificate` only set `Certificate.revokedAt` without syncing `LmsCertificateRevocation`, whereas `/lms/certificates/verify/:code` checked `LmsCertificateRevocation`.
- **Fixes Implemented:**
  - Enforced `course.certificateMode` in `LearningService.evaluateCourseCompletionAndCertificate` (`NONE`, `ATTENDANCE_ONLY`, `QUIZ_AND_PROGRESS`, `COMPETENCY_ROUTED`, `ACCREDITED_PROGRAM`).
  - Added deduplication by `(userId, courseId, kind)` before issuing any certificate.
  - Added `GET /api/v1/learning/certificates/:code/svg` returning a downloadable printable SVG certificate.
  - Unified `LearningService.verifyCertificate` and `LmsAdvancedService.verifyCertificateRich` so both check `cert.revokedAt || cert.revocation` and return unified `status` (`VALID` / `REVOKED`), `kind`, and accreditation metadata.

---

## 2. Commercial Features (`4.A` – `4.E`)

### 4.A — Memberships & Subscriptions (`VERIFIED`)
- **Findings:**
  - `MembershipService.initiateCheckout` did not support discount coupons (`couponCode`).
  - Automatic recurring card vaulting/charging does not exist in the codebase, so renewal behavior needed explicit, honest metadata.
- **Fixes Implemented:**
  - Added optional `couponCode` to `initiateCheckoutSchema` and `MembershipService.initiateCheckout`, validating coupons targeted to `ALL` or `MEMBERSHIP_PLAN` and recording atomic `CouponRedemption` on payment settlement.
  - Added `POST /api/v1/memberships/validate-coupon` and a live coupon preview input (`data-testid="membership-coupon-input"`) on `/pricing`.
  - Exposed `autoRenewSupported: false` and `renewalMode: 'MANUAL_TERM_RENEWAL'` in `MembershipService.getMyMembershipSummary`.

### 4.B — Standalone Purchases (`VERIFIED`)
- **Findings:**
  - `CommerceService.createDirectOrder` allowed a learner who already owned an active lifetime `CourseAccessGrant` for a standalone course to create and pay for a duplicate order for the same course.
- **Fixes Implemented:**
  - Added a pre-checkout guard in `CommerceService.createDirectOrder` checking `prisma.courseAccessGrant.findFirst({ userId, courseId, revokedAt: null })` and rejecting duplicate purchases with `400 Bad Request` (`لديك صلاحية وصول مفعلة بالفعل لهذا الكورس، لا حاجة لإعادة شرائه`).

### 4.C — Discount Coupons (`VERIFIED`)
- **Findings:**
  - `DiscountCoupon` only supported `applicableCourseId` (single course or global), had no per-user usage limit (`perUserLimit`), no seller-code stacking flag (`allowSellerStacking`), no `CouponRedemption` ledger table, and no Admin CRUD endpoints or UI.
- **Fixes Implemented:**
  - Added `CouponTargetType` (`ALL`, `COURSE`, `LEARNING_PATH`, `DIPLOMA`, `MEMBERSHIP_PLAN`), `DiscountCoupon.applicableTargetType`, `applicableTargetId`, `perUserLimit`, `allowSellerStacking`, and `CouponRedemption` in Prisma (`0007_video_commerce_cert_audit`).
  - Created `apps/api/src/core/coupon-redemption.helper.ts` (`validateCouponForCheckout`, `recordCouponRedemptionTx`) enforcing row-level `FOR UPDATE` locking on `DiscountCoupon`, global `usageLimit`, per-user `perUserLimit`, target matching across courses/paths/diplomas/membership plans, and seller-sale stacking rules.
  - Added Admin CRUD endpoints (`GET /api/v1/commerce/admin/coupons`, `POST /api/v1/commerce/admin/coupons`, `PATCH /api/v1/commerce/admin/coupons/:id`) and built `AdminCouponsAndTemplatesPanel.tsx` in `/admin`.

### 4.D — Institution Packages (`VERIFIED`)
- **Findings:**
  - `OrganizationsService.assignSeat` checked `activeSeats >= org.seatLimit` without locking the `Organization` row in a transaction, allowing concurrent requests to exceed `seatLimit`.
  - `OrganizationsService.assignSeat` did not create `CourseAccessGrant` records for the organization's `assignedCourseIds`, and there was no seat revocation endpoint that revoked org-sponsored access while preserving the learner's personal purchases.
- **Fixes Implemented:**
  - Wrapped `OrganizationsService.assignSeat` in `prisma.$transaction` with `SELECT id, "seatLimit", "isActive", "contractEnd" FROM "Organization" WHERE id = $1 FOR UPDATE`, blocking expired contracts and concurrent seat over-allocation.
  - Tagged organization-granted access with `grantReason: "ORG_SEAT:<orgId>"`.
  - Added `DELETE /api/v1/organizations/:id/seats/:seatId` (`OrganizationsService.revokeSeat`) which sets `OrganizationSeat.revokedAt` and revokes only `CourseAccessGrant` rows where `grantReason === "ORG_SEAT:<orgId>"` and `orderId === null`, leaving the learner's personal purchases and memberships untouched.

### 4.E — Payment Gateway Integration (`VERIFIED`)
- **Findings:**
  - `PaymobClient` was injected directly as a concrete class without a provider interface token, and `MembershipService.handlePaymobWebhook` did not reject currency mismatches or failed webhooks arriving *after* a transaction was already settled (`SUCCEEDED`).
- **Fixes Implemented:**
  - Created `PaymentGatewayProvider` interface and `PAYMENT_GATEWAY_PROVIDER` DI token in `apps/api/src/modules/membership/payment-gateway.interface.ts`, implemented by `PaymobClient`.
  - Hardened `MembershipService.handlePaymobWebhook` to:
    1. Reject currency mismatches (`payload.obj.currency !== txRow.currency`) with `400 Bad Request` and audit log `PAYMOB_WEBHOOK_CURRENCY_MISMATCH`.
    2. Ignore out-of-order failure webhooks arriving after a transaction has already reached `SUCCEEDED` (`ignoredOutOfOrderFailure: true`), preventing accidental revocation of paid entitlements.

---

## 3. Three Certificate Types (`Section 5` — `VERIFIED`)

1. **Completion Certificate (`ATTENDANCE_COMPLETION`)**:
   - Issued when the learner meets the course's completion criteria (`ATTENDANCE_ONLY` or `QUIZ_AND_PROGRESS`).
2. **Professional Training Certificate (`COMPETENCY`)**:
   - Issued via dual review (`CompetencyCertificateRequest` approved by instructor/admin) or admin issuance (`AdminOperationsService.issueUserCertificate`).
3. **Accredited Program Certificate (`ACCREDITED_PROGRAM`)**:
   - Added `CertificateKind.ACCREDITED_PROGRAM` and `CertificateMode.ACCREDITED_PROGRAM` plus `accreditationEnabled` (default `false`), `accreditingBodyNameAr`, `accreditingBodyCode`, and `authorizationRef` on `CertificateTemplate` and `Certificate`.
   - Enforced `validateAccreditedCertificateIssuance` across every issuance path (`LmsAdvancedService.upsertTemplate`, `LearningService.evaluateCourseCompletionAndCertificate`, `AdminOperationsService.issueUserCertificate`): issuance is **strictly blocked (`400 Bad Request`)** unless an admin has explicitly enabled accreditation and configured a real accrediting body name and authorization reference. Zero fabricated accreditation claims or numbers exist anywhere in code or seed data.
