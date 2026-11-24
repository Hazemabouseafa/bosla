# BOSLA UX Overhaul, 4-Step Course Builder, Video Recovery, Live Editor, Homepage Pricing & Encrypted Paymob Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a measurable, production-grade UX and functional upgrade to BOSLA Academy: a 4-step course builder with auto-save and bulk free-preview controls, root-cause video transcoding & HLS playback recovery, role-focused dashboard UX, an in-product Live Editor with draft/publish/version rollback and optimistic locking, a server-driven Homepage Pricing section, and AES-256-GCM encrypted Paymob settings (`الإعدادات ← المدفوعات ← Paymob`).

**Architecture:** Extend `@bosla/db` with migration `0008_live_editor_paymob_course_ux` adding `SiteLayoutRevision` (draft/published versions, optimistic `versionNumber`, audit actor IDs) and `PaymentGatewayConfig` (AES-256-GCM encrypted secrets using an external server key, Test/Live mode separation, readiness checklist), plus optional `introVideoUrl` / `posterUrl` support on `CourseVersion`. Upgrade `@bosla/api` with in-process FFmpeg transcode fallback when Redis worker is not running separately, re-transcode & diagnostic endpoints, Live Editor draft/publish/rollback endpoints, and encrypted Paymob configuration + connection test endpoints. Upgrade `@bosla/web` with the 4-step Course Wizard, resilient `BoslaHlsPlayer` + multi-file `VideoChunkUploader`, Live Editor workspace, and Homepage Pricing section.

**Tech Stack:** TypeScript, NestJS 10, Prisma 6 (PostgreSQL), Next.js 15 App Router (React 19, Tailwind CSS, RTL Arabic), FFmpeg/FFprobe HLS, hls.js, Node `crypto` (AES-256-GCM + HMAC-SHA512), Vitest, Playwright.

**Spec:** User Request (Sections 0–10) & `PRODUCT.md`.

## Global Constraints

- Preserve Arabic RTL (`dir="rtl"`, `lang="ar"`), approved homepage visual identity (royal purple `#6B21A8` / `#C084FC` + deep cobalt `#050A24` / `#0B1440`), official `bosla-logo.webp`, and all existing data/RBAC/business rules.
- No scroll effects or 3D in dashboards (`Operate` mode: crisp hairlines, 150–250ms state transitions only).
- Every new lesson defaults to `isFreePreview: false` (locked); free preview lessons in published courses are accessible to visitors, while draft/unapproved courses are never exposed publicly even if a lesson is marked free preview.
- Never trust client-sent prices or amounts; never grant access from return/callback URLs alone; never return raw Paymob secrets to the browser after saving; never describe subscriptions as auto-renewing unless implemented.

## Review Focus

1. **Unpublished course with `isFreePreview: true` lesson:** Public visitor requesting playback session or attachment on a `DRAFT` / `PENDING_REVIEW` course must be rejected (`403 Forbidden`), while the owning Instructor and Admin can preview it via their authenticated session.
2. **Concurrent Live Editor edits by two admins:** Saving or publishing a draft with a stale `baseVersion` must return `409 Conflict` with the latest server version rather than silently overwriting another admin's changes.
3. **XSS / Script injection in Live Editor fields:** Any `<script>`, `javascript:` URL, or inline `on*=` handler submitted in Live Editor text/links must be stripped/rejected on the server before saving.
4. **Video playback token expiry mid-stream & missing worker process:** When a short-lived token expires during playback, `BoslaHlsPlayer` must silently refresh the token and call `hls.startLoad()` without losing `currentTime`; when `ALLOW_INMEMORY_REDIS=true` or Redis worker is absent, `VideoService.completeUpload` / `retranscodeVideo` must execute local FFmpeg HLS transcoding so videos reach `READY` deterministically.
5. **Masked Paymob secret replacement:** Updating non-secret Paymob fields (e.g. toggling `TEST` / `LIVE` or `isEnabled`) when the UI sends masked secret placeholders (`••••••••`) must preserve existing encrypted secrets in the database rather than overwriting them with bullets.

---

### Task 1: Prisma Schema & Migration `0008_live_editor_paymob_course_ux` + Shared Schemas

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/0008_live_editor_paymob_course_ux/migration.sql`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/audit-helpers.ts`
- Modify: `packages/shared/src/audit-helpers.test.ts`

- [ ] **Step 1: Write failing unit tests in `packages/shared/src/audit-helpers.test.ts`** for:
  - `encryptSecretAesGcm` / `decryptSecretAesGcm` / `maskSecretValue` (AES-256-GCM encryption with external key, masking secrets so only last 4 chars show, and detecting masked placeholders).
  - `sanitizeLiveEditorConfig` (strips `<script>`, event handlers, and `javascript:`/`data:text/html` URLs from Live Editor configuration objects while preserving valid Arabic text and internal/HTTPS links).
  - `evaluateCourseWizardCompleteness` (computes missing items per wizard step 1–4 with step index and field anchor IDs).
- [ ] **Step 2: Run `@bosla/shared` unit tests to verify RED** (`npm run test --workspace=@bosla/shared`).
- [ ] **Step 3: Implement helpers in `packages/shared/src/audit-helpers.ts` & schemas in `packages/shared/src/schemas.ts`**, and add `SiteLayoutRevision`, `PaymentGatewayConfig`, plus `CourseVersion.posterUrl` to `packages/db/prisma/schema.prisma` and `0008_live_editor_paymob_course_ux/migration.sql`.
- [ ] **Step 4: Run `@bosla/shared` unit tests and `@bosla/db` build to verify GREEN.**

### Task 2: Video Pipeline Root-Cause Fix, In-Process FFmpeg Fallback, Re-Transcode & Diagnostic Logs

**Files:**
- Create: `apps/api/src/modules/video/local-hls-transcoder.ts`
- Modify: `apps/api/src/modules/video/video.service.ts`
- Modify: `apps/api/src/modules/video/video.controller.ts`
- Modify: `apps/api/src/modules/learning/learning.service.ts`
- Modify: `apps/web/src/components/player/BoslaHlsPlayer.tsx`
- Modify: `apps/web/src/components/instructor/VideoChunkUploader.tsx`

- [ ] **Step 1: Write failing integration test** verifying:
  - Separate "Upload Complete (`QUEUED`/`PROCESSING`)" vs "Ready for Playback (`READY`)" state returned by `GET /api/v1/learning/lessons/:lessonId/playback-readiness` and `POST /api/v1/lessons/:lessonId/playback-session`.
  - Automatic local FFmpeg transcode execution when Redis worker is in memory fallback mode (`ALLOW_INMEMORY_REDIS=true`) or via `POST /api/v1/instructor/videos/:videoId/retranscode`.
  - Server-side draft course protection: a lesson with `isFreePreview: true` inside a `DRAFT` or `PENDING_REVIEW` course is blocked (`403`) for anonymous visitors and regular students, but allowed for the course's instructor and admins.
  - Sanitized diagnostic logs (`GET /api/v1/instructor/videos/:videoId/diagnostics`) containing FFmpeg stage, duration, renditions, and zero signing secrets.
- [ ] **Step 2: Implement backend video readiness, re-transcode, draft-course free-preview guard, and diagnostic endpoint, plus `BoslaHlsPlayer.tsx` bounded auto-recovery (`hls.startLoad()`, `hls.recoverMediaError()`, token refresh on 401/403 fragment errors, in-player retry button preserving `currentTime`, and processing stage polling) and multi-file `VideoChunkUploader.tsx` with `beforeunload` warning.**

### Task 3: Live Editor Backend (`Draft` / `Publish` / `Rollback` / Optimistic Concurrency) & Encrypted Paymob Settings Backend

**Files:**
- Create: `apps/api/src/modules/admin/live-editor-paymob.service.ts`
- Modify: `apps/api/src/modules/admin/admin.controller.ts`
- Modify: `apps/api/src/modules/admin/admin.module.ts`
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.service.ts`
- Modify: `apps/api/src/modules/membership/paymob.client.ts`
- Modify: `apps/api/src/modules/membership/membership.service.ts`

- [ ] **Step 1: Write failing integration tests** for:
  - `GET /api/v1/admin/live-editor/state`, `PUT /api/v1/admin/live-editor/draft` (with `baseVersion` conflict check `409`, XSS sanitization, media protection), `POST /api/v1/admin/live-editor/publish`, and `POST /api/v1/admin/live-editor/rollback/:revisionId`.
  - Public `GET /api/v1/catalog/live-layout` returning only the `PUBLISHED` revision (never exposing `DRAFT` changes) plus ordered published courses, ordered published membership plans (with highlighted plan ID), partners, FAQs, header/footer, and contact info.
  - `GET /api/v1/admin/payments/paymob/config`, `PUT /api/v1/admin/payments/paymob/config`, and `POST /api/v1/admin/payments/paymob/verify` enforcing RBAC (`ADMIN`/`SUPER_ADMIN` only, `403` for unauthorized roles), AES-256-GCM encryption at rest, masked secret responses (`••••••••`), preservation of existing secrets when masked values are submitted, and audit logging without secret values.
- [ ] **Step 2: Implement `LiveEditorAndPaymobService` and wire into `AdminController`, `CatalogService`, and `PaymobClient`.**

### Task 4: 4-Step Course Builder Wizard (Admin & Instructor), Auto-Save, Bulk Free-Preview & Dashboard UX Polish

**Files:**
- Create: `apps/web/src/components/instructor/CourseWizardEditor.tsx`
- Modify: `apps/web/src/app/instructor/courses/[courseId]/page.tsx`
- Modify: `apps/web/src/components/admin/AdminCourseModals.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/instructor/page.tsx`

- [ ] **Step 1: Build `CourseWizardEditor.tsx`** implementing the 4 clear steps:
  - **Step 1 (`أ. معلومات الكورس`):** Title*, Description*, Category, Instructor (for Admin), with advanced options (Slug, Subtitle, Objectives, Requirements, Certificate Mode) in a collapsible optional section.
  - **Step 2 (`ب. واجهة الكورس`):** Drag-and-drop or file picker cover image + thumbnail preview/replace/delete + separate Intro Video & custom Video Poster selector distinct from lesson videos.
  - **Step 3 (`ج. المحتوى والدروس`):** Add sections & lessons on the same screen, single default section auto-created for simple courses, multi-video batch upload auto-creating lesson drafts with extracted durations and clear status badges, inline rename, drag-and-drop + keyboard/mobile up/down reordering, attachment manager, per-lesson `معاينة مجانية — متاحة للجميع` toggle (default locked `false`), and **Bulk Lesson Availability bar** (`قفل جميع الدروس` / `فتح أول درس كمعاينة مجانية` / `تحديد الكل كمعاينة مجانية`).
  - **Step 4 (`د. السعر والإتاحة والمراجعة`):** Free vs. paid EGP price, membership inclusion, standalone purchase toggle, summary of free vs. locked lessons, **Visitor vs. Enrolled Student Preview drawer**, **Missing Requirements Checklist** with one-click jump to the exact step & field, and role-appropriate primary action (`نشر الكورس الآن` for Admin, `إرسال للمراجعة الإدارية` for Instructor).
  - **Reliable Auto-Save:** Status pill displaying `«جارٍ الحفظ»` / `«تم الحفظ»` / `«تعذر الحفظ — إعادة المحاولة»` confirmed by server response + local draft backup on network failure.

### Task 5: In-Product Live Editor UI (`تخصيص الموقع`), Homepage Pricing Section (`الباقات والأسعار`), and Paymob Settings UI (`الإعدادات ← المدفوعات ← Paymob`)

**Files:**
- Create: `apps/web/src/components/admin/AdminLiveSiteEditorPanel.tsx`
- Create: `apps/web/src/components/admin/AdminPaymobSettingsPanel.tsx`
- Create: `apps/web/src/components/home/BoslaPricingSection.tsx`
- Modify: `apps/web/src/components/home/BoslaIntroHome.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Build `BoslaPricingSection.tsx` and integrate into `BoslaIntroHome.tsx` & `page.tsx`**:
  - Server-driven membership plans (`MONTHLY` / `ANNUAL` filter if both exist), admin-selected featured plan badge without fabricated claims, real benefits and course counts, hides automatically when zero plans are published, and preserves selected plan across `/login?next=/pricing?plan=<slug>`.
- [ ] **Step 2: Build `AdminLiveSiteEditorPanel.tsx` (`تخصيص الموقع`)**:
  - Split-screen editor with structured controls on the right (RTL start) and instant interactive preview on the left (`Desktop 1440px` / `Tablet 768px` / `Mobile 390px`).
  - Click-to-select section in preview or sidebar list (Header, Hero, Pillars, Elevation, Courses Showcase with course picker, Pricing Section with plan picker & link to plan price management, Partners, FAQs, Contact & Footer).
  - Reorder sections (up/down + drag), show/hide sections, upload/replace media, edit texts/buttons/links without HTML/CSS, save as separate draft, publish with server confirmation, and view version history with one-click rollback and conflict resolution banner.
- [ ] **Step 3: Build `AdminPaymobSettingsPanel.tsx` (`الإعدادات ← المدفوعات ← Paymob`)**:
  - Enable/disable toggle, `Test (Sandbox)` vs `Live (Production)` mode selector, required Paymob Egypt fields (`API Key`, `Card Integration ID`, `Wallet Integration ID (optional)`, `iFrame ID`, `HMAC Secret`, `Public Key`, `Secret Key`), step-by-step Arabic guide on where to get each value from Paymob Accept Egypt dashboard, one-click copyable Webhook & Callback URLs, masked secrets with explicit "استبدال القيمة السرية" mode, readiness checklist showing what is complete vs. missing, and connection/configuration verification button.

### Task 6: Automated Verification (Unit, Integration, Playwright Browser E2E) & Impeccable UX Critique/Polish

**Files:**
- Create: `apps/api/test/ux-live-editor-paymob.integration.test.ts`
- Create: `apps/web/e2e/ux-live-editor-paymob.spec.ts`

- [ ] **Step 1: Run unit and integration test suites** (`npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`).
- [ ] **Step 2: Run full Next.js build and Playwright E2E browser journeys** (`npx playwright test e2e/ux-live-editor-paymob.spec.ts`) covering desktop + mobile RTL + keyboard navigation + screenshots.
- [ ] **Step 3: Run Impeccable detector & polish pass** on modified flows and prepare final delivery report.
