# BOSLA Academy — Cinematic Frontend Redesign Implementation Report

**Date:** 2026-11-14  
**Scope:** Existing Next.js 15 frontend (`apps/web`) inside the `bosla-academy` monorepo  
**Approved Reference Direction:** `01_APPROVED_COMPOSITION.png`, `02_CINEMATIC_MOODBOARD.png`, `DESIGN_TOKENS.md`, `ANTIGRAVITY_HYDROGEN_EXTRA_MASTER_PROMPT.txt`

---

## 1. Executive Summary

The existing BOSLA Academy frontend (`apps/web`) has been redesigned across **all 30 routes** and **18 shared UI/domain components** into the approved **Navy (`#06142D`), White (`#FFFFFF` / `#F6F8FC`), and Turquoise (`#05C6C3`)** visual system with subtle GPU-compositor motion, strict Arabic RTL mirroring, and `prefers-reduced-motion` accessibility support.

All backend infrastructure, security boundaries, and functional contracts remain intact:
- NestJS API (`/api/v1/*`) + PostgreSQL/Prisma + FFmpeg/HLS worker
- WebAuthn Passkeys (`بدون رموز OTP`), Google Sign-In (`GoogleSignInButton`), and recovery code flows
- Paymob membership checkout & sandbox verification (`محاكاة دفع ناجح (HMAC)`)
- Protected HLS video streaming (`BoslaHlsPlayer`), Lesson Q&A (`LessonQaSection`), and Private Course Communities
- Admin-only content review & publishing workflow (`/admin` approval + publish modals)
- **Zero automatic deployment to Coolify** (local codebase and verification server only)

---

## 2. Visual System, Contrast & Motion Architecture

Full specification documented in [`docs/UI_MOTION_GUIDELINES.md`](./UI_MOTION_GUIDELINES.md) and configured in `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`:

- **Approved Palette:**
  - Deep Navy surfaces: `#06142D` (`bosla-navy`), `#081E40` (`bosla-deep`), `#0C2B55` (`bosla-sapphire`)
  - Turquoise signature accent: `#05C6C3` (`bosla-primary`), `#04AAA7` (`bosla-primaryHover`), `#D8F8F5` (`bosla-soft`)
  - Accessible Teal text on light surfaces: `#037A77` (`bosla-tealText`)
  - Canvas & Cards: `#F6F8FC` (`--bosla-bg`), `#FFFFFF` (`--bosla-card`), `#102744` (`--bosla-ink`), `#63728A` (`--bosla-muted`), `#E1E8F2` (`--bosla-line`)
  - Limited Gold highlight: `#F6B950` (`--bosla-amber`) for diploma/certificate highlights
- **WCAG AA Contrast Compliance:**
  - Primary turquoise `#05C6C3` buttons always pair with dark navy `#06142D` text (`9.15:1` contrast) — never white text on `#05C6C3`.
  - Small links, badges, and metric labels on white cards use `#037A77` (`bosla-tealText`) or `#06142D`.
- **Lightweight Cinematic Motion (`ScrollMotionSystem.tsx` & `globals.css`):**
  - Opt-in under `@media (prefers-reduced-motion: no-preference)`.
  - Hero entrance sequence (`.hero-seq-1`..`.hero-seq-4`, `.hero-seq-media`) uses GPU-only `transform` and `opacity` transitions (`<= 16px` travel) plus subtle 14s `.bosla-hero-portrait-mask` blend and GPU ambient arc drift (`@keyframes bosla-ambient-drift`).
  - `IntersectionObserver` combined with passive `scroll`, `hashchange`, and `focusin` catch-up sweeps (`rect.top <= vh() * 1.06`) guarantees all `[data-reveal]` elements transition reliably to `data-revealed="true"` even on fast scroll jumps or anchor navigation.
  - Passive top `#05C6C3` `scaleX` scroll progress hairline (`h-[3px]`), `@starting-style` `<dialog>` modal transitions, and `@media print` force-reveal rule.
  - Under `prefers-reduced-motion: reduce`, animations remain static (`opacity: 1; transform: none;`) and all `[data-reveal]` sections render immediately.

### 1:1 Composition Parity & Functional Polish Pass (`01_APPROVED_COMPOSITION.png` + `02_CINEMATIC_MOODBOARD.png`)
- **Approved Hero Portrait & Clean Public Copy (`HomeExperience.tsx`, `SiteShell.tsx`, `PricingClient.tsx`, auth/legal routes):** Updated [`hero-banner.webp`](../apps/web/public/images/brand/hero-banner.webp) (`1200x896`) to match the approved hero portrait with the glowing turquoise play chevron and deep navy backdrop, refined open horizontal hero pillars (`divide-white/10`), overlapping white KPI telemetry bar, clean active underline nav indicators (`h-[2.5px] bg-bosla-primary`), balanced 2-column Learning Paths layout when `<= 2` paths exist, and removed all public-facing and student-facing text references to `Paymob`, `OTP`, or `SMS` across storefront, pricing, footer, legal pages (`/about`, `/privacy`, `/terms`), and auth flows (`/login`, `/register`, `/recovery`, `/security/passkey-setup`, `/membership/*`, `/student`).
- **Learning Player Stage & Continuity (`learn/[slug]/page.tsx`, `BoslaHlsPlayer.tsx`):** Stage-first top video card, `الدرس التالي` CTA anchored cleanly at the bottom of the right RTL syllabus sidebar, silent background progress refreshes (`loadPlayer({ silent: true })`) with `initialWatchedSecondsRef` so saving progress never unmounts or resets active HLS playback, and timestamp navigation (`jumpToLessonAndSeek`) closing thread modals cleanly when jumping directly to video playback.
- **Dashboards (`DashboardShell.tsx`, `student/page.tsx`, `instructor/page.tsx`, `admin/page.tsx`):** Left border accent highlight (`border-s-2 border-bosla-primary`) on active sidebar items, rounded pastel KPI icon chips across Student/Instructor/Admin dashboards, SVG completion ring paired directly beside KPI tiles on `/student`, and a 6-column vertical metric bar chart on `/admin` driven strictly from live `overview` & `allCourses` metrics.

---

## 3. Scope Implemented Across All 30 Routes & 18 Shared Components

Complete route mapping recorded in [`docs/REDESIGN_ROUTE_AUDIT.md`](./REDESIGN_ROUTE_AUDIT.md):

### A. Layout Shell & Shared Primitives
- `apps/web/src/components/ui/primitives.tsx` (`Button`, `Badge`, `Card`, `Field`, `PasswordInput`, `AlertBanner`, `NativeModal`, `EmptyState`)
- `apps/web/src/components/layout/SiteShell.tsx` (Dark Navy `#06142D` sticky header, turquoise active indicator, search trigger, `NotificationBell`, architectural Navy footer)
- `apps/web/src/components/layout/PageHero.tsx` (Dark Navy compact hero with subtle SVG turquoise arcs)
- `apps/web/src/components/layout/DashboardShell.tsx` *(new)* — Dark Navy `#06142D` RTL right sidebar (`264px` desktop) + `#F6F8FC` workspace + responsive mobile slide-over drawer with a single semantic `<nav>` tree
- `apps/web/src/components/motion/ScrollMotionSystem.tsx`

### B. Storefront, Catalog & Public Information Routes (15 Routes)
- `/` (`HomeExperience.tsx`), `/courses` (`CourseCatalogClient.tsx`), `/courses/[slug]`
- `/learning-paths`, `/learning-paths/[slug]`
- `/diplomas`, `/diplomas/[slug]` (`DiplomaSubmissionBox.tsx`)
- `/instructors`, `/pricing` (`PricingClient.tsx`), `/about`, `/contact`
- `/certificates/verify`, `/certificates/[code]`, `/privacy`, `/terms`

### C. Auth, Security, Membership Checkout & Notifications (7 Routes)
- `/login` (with `GoogleSignInButton.tsx` + Passkey login + Navy backdrop), `/register` (with Passkey setup copy), `/recovery` (Navy active tab pills `bg-bosla-navy text-white`), `/security/passkey-setup`
- `/membership/sandbox-checkout`, `/membership/checkout-result`, `/notifications` (plus `lib/auth-context.tsx` visual consistency)

### D. Lesson Player & Private Course Communities (2 Routes + 5 Components)
- `/learn/[slug]` + `BoslaHlsPlayer.tsx` + `LessonQaSection.tsx`:
  - Dark Navy `#06142D` top learning progress bar
  - Two-column RTL layout (`lg:grid-cols-12`): sticky syllabus sidebar (`order-2 lg:order-1`) with `#05C6C3` progress bar, `#D8F8F5` active lesson indicator, and `الدرس التالي` CTA alongside dominant protected HLS player (`order-1 lg:order-2`), anchor pills (`#lesson-qa`, `#lesson-attachments`, `#lesson-quiz`), and always-mounted `LessonQaSection`
- `/courses/[slug]/community` + `CourseCommunityPanel.tsx` + `CommunityThreadModal.tsx` + `InstructorCommunitiesPanel.tsx` + `AdminCommunitiesPanel.tsx`

### E. Student, Instructor & Admin Dashboards (6 Routes + Uploader)
- `/student` & `/student/settings`: Wrapped in `DashboardShell`; displays real SVG completion ring computed from live `continueWatching` data, membership status, paths/diplomas progress, certificates, and payment logs.
- `/instructor`, `/instructor/videos` (`VideoChunkUploader.tsx`), `/instructor/courses/[courseId]`: Wrapped in `DashboardShell`; includes live course engagement bars driven directly from `data.courses` and `stats`, chunked video uploader progress bar (`#05C6C3`), editorial draft/quiz builder, and `InstructorCommunitiesPanel`.
- `/admin`: Wrapped in `DashboardShell` hosting all 8 management sections, real database role-distribution & video-queue status bars from `overview`, `AdminCommunitiesPanel`, editorial review/publish approvals, and plan versioning.

---

## 4. Build, Lint, Typecheck & Test Verification

All checks ran cleanly on the final implementation with **0 errors and 0 skipped/failed tests**:

| Check Command | Scope | Result |
|---|---|---|
| `npm run lint` | `@bosla/shared`, `@bosla/api`, `@bosla/worker`, `@bosla/web` | **Passed** (exit 0) |
| `npm run typecheck` | All 7 monorepo workspaces (`shared`, `config`, `db`, `ui`, `api`, `worker`, `web`) | **Passed** (exit 0) |
| `npm run build` | All 7 workspaces + Next.js `15.5.29` production build (`Compiled successfully in 14.0s`) | **Passed** (exit 0) |
| `npm test` | `@bosla/shared` (`11`), `@bosla/api` unit (`12`), `@bosla/worker` (`2`), `@bosla/api` integration (`6`) | **31 / 31 passed** across 8 test files |
| `npm run test:e2e -- --reporter=list` | Playwright E2E suite (`bosla.spec.ts`: 3 tests, `community.spec.ts`: 1 test) | **4 / 4 passed** (`1.9m`) |

---

## 5. Real Browser Screenshot & Responsive Audit (`docs/ui-redesign/`)

A full Playwright Chromium verification pass captured **18 real screenshots** against the live production server (`http://localhost:3000` + `http://127.0.0.1:4100`), verifying `dir="rtl"`, zero horizontal overflow (`overflowX: false` — `scrollWidth === clientWidth`), zero broken images (`brokenImages: []`), and immediate visibility under `prefers-reduced-motion: reduce` (`heroOpacity: "1"`, `unrevealedCount: 0`):

- Desktop `1440px`: `home-hero-1440.png`, `home-full-1440.png`, `courses-1440.png`, `course-detail-1440.png`, `learn-player-1440.png`, `community-1440.png`, `student-dashboard-1440.png`, `instructor-dashboard-1440.png`, `admin-dashboard-1440.png`, `home-reduced-motion-1440.png`
- Laptop `1024px`: `home-1024.png`, `student-1024.png`
- Tablet `768px`: `home-768.png`, `student-768.png`
- Mobile `390px`: `home-mobile-390.png`, `courses-mobile-390.png`, `student-mobile-390.png`, `learn-mobile-390.png`

Visual inspection of desktop, mobile, player, community, and dashboard captures confirmed clean Arabic RTL typography, zero clipping or overlap, `#06142D` + `#05C6C3` visual alignment, and live seeded database numbers (`+4`, `9`, `2`, `2` on home; `0/3` progress on `/learn`).

---

## 6. Live Local Server & Seeded Accounts

- **Web Server (Running):** `http://localhost:3000`
- **NestJS API (Running):** `http://127.0.0.1:4100`
- **Seeded Accounts (`packages/db/prisma/seed.ts`):**
  - **Admin:** `+201000000001` (`01000000001`) / `BoslaAdmin#2026`
  - **Instructor (`د/ الحسيني داود`):** `+201000000101` (`01000000101`) / `BoslaInstructor#2026`
  - **Student (`أحمد محمد علي`):** `+201000000201` (`010000000201`) / `BoslaStudent#2026`
