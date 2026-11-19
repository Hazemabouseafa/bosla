# BOSLA Academy — Premium Dark Redesign Route & Component Audit

- **Audit Date:** 2026-11-15
- **Design Source:** `BOSLA_Premium_Existing_Project` (`DESIGN_SYSTEM_AR.md`, `tokens.css`, `references/01_Approved_Homepage.png`, `references/02_Admin_Dashboard.png`, `ANTIGRAVITY_IMPLEMENT_EXISTING_PROJECT.md`)
- **Scope Constraint:** Frontend presentation & layout layer inside `apps/web/**` ONLY. Zero changes to `apps/api/**`, `apps/worker/**`, `packages/**`, Prisma schema/migrations/seeds, Paymob/WebAuthn/auth/HLS logic, or deployment infrastructure.

---

## 1. Visual Token & Typography Migration Matrix

| Token / Property | Previous Value | Approved Dark Value | Role |
| :--- | :--- | :--- | :--- |
| `--bosla-bg-void` | `#F6F8FC` / `#06142D` | `#07121E` | Primary midnight canvas background |
| `--bosla-bg-deep` | `#081E40` | `#081725` | Header, sidebar, drawer & recessed surface |
| `--bosla-bg-surface` | `#FFFFFF` | `#0F2031` | Cards, panels, tables, modals, dropdowns |
| `--bosla-bg-surface-hover` | `#EEF3FA` | `#142B3D` | Hover states, table headers, subtle elevated groups |
| `--bosla-border-subtle` | `#E1E8F2` | `#284354` | Restrained 1px card/table/input borders |
| `--bosla-border-active` | `#05C6C3` | `#32D7C8` | Active focus/hover/selected border |
| `--bosla-text-primary` | `#102744` | `#F4F7FB` | Primary headings & high-contrast body text |
| `--bosla-text-secondary` | `#63728A` | `#A7B8C9` | Muted metadata, captions, subtitles |
| `--bosla-accent-teal` | `#05C6C3` | `#08A69B` | Primary CTA button fill (`#041418` high-contrast dark label) |
| `--bosla-accent-teal-text` | `#037A77` | `#32D7C8` | Teal links, active nav bars, semantic focus highlights |
| `--bosla-accent-focus` | `#05C6C3` | `#8AF5E9` | Accessible keyboard `:focus-visible` ring |
| `--bosla-status-success` | `#059669` | `#77E2B5` | Published / Approved / Verified states |
| `--bosla-status-warning` | `#F6B950` | `#F2C66D` | Pending Review / Needs Revision / Draft states |
| `--bosla-status-danger` | `#DC2626` | `#FF9CAA` | Rejected / Deleted / Error states |
| Font Family | `IBM_Plex_Sans_Arabic` | `IBM_Plex_Sans_Arabic` (`400,500,600,700`) | Self-hosted via `next/font/google`, `dir="rtl"` |
| Typography Scale | Mixed custom scales | `48–64px` (32–40m) H1, `28–32px` H2, `22–26px` H3, `16px` body, `>=14px` meta/tables | Line height `1.7`, touch targets `>=44px`, radius `10–12px` |

---

## 2. Preserved Invariants & Explicit User Rules

1. **Brand Mark:** Keep the exact uploaded `/images/brand/bosla-logo.webp` everywhere (no custom compass SVGs or regenerated logos).
2. **Real Media & Content Only:** Keep uploaded hero `hero-banner.webp`, real instructor photos (`instructor-1..8.webp`), real partner logos, and live DB counts/pricing. Never inject fabricated video buttons, non-functional carousel dots/arrows, fake date selectors, or hardcoded dummy counters.
3. **Prior User Decisions Preserved (Turns 1–5):**
   - Zero public copy mentioning Paymob or OTP.
   - Plain phone text input without country-code dropdown; avoid technical jargon ("passkey", "OpenID") in user-facing UI.
   - Admin `+ إضافة كورس جديد` remains prominent in header & quick actions.
   - Deleted homepage sections stay removed: NO `شهادة إتمام قابلة للتحقق الفوري`, NO `أقسام المعرفة التطبيقية`, NO `ابدأ من حيث أنت`.
   - `المسارات التعليمية` stays large, prominent, and visually scannable in dark `#0F2031` surface cards.
4. **Playwright E2E Contract Selectors Preserved:**
   - Homepage: `#specialization-quiz`, `button.text-start`, `المركز #1`, `#lead-name`, `#lead-phone`, `#lead-company`, `'تدريب شركات ومزارع'`, `'إرسال الطلب الآن'`.
   - Auth: `#login-phone`, `#login-pass`, `#reg-*`, `#rec-*`, `#pk-*`.
   - Instructor: `#nc-*`, `#qz-*`, `#vid-*`, `/حفظ المسودة/`, `'إرسال للمراجعة الإدارية'`.
   - Admin: 8 tab labels, `div.rounded-2xl`, `div.rounded-xl`, `'اعتماد الكورس'`, `'نشر فوري للطلاب'`, `'إضافة كورس جديد'`, `'تعديل السعر والمحتوى المشمول'`, `'حفظ التغييرات وإصدار نسخة خطة جديدة'`.
   - Player/Community: `/learn/[slug]` & `/courses/[slug]/community` Q&A thread creation, reply, best-answer controls.

---

## 3. Complete Inventory — Actual `apps/web/src` Files & Route Plan

### 3A. App Router Pages (`apps/web/src/app/**` — 31 pages + 1 API proxy + root layout/styles)

| Route / File | Access | Purpose & Key Actions | Backend APIs Used | Dark Redesign Plan |
| :--- | :--- | :--- | :--- | :--- |
| `/` (`src/app/page.tsx`) | Public | Editorial RTL homepage (`HomeExperience`) | `GET /catalog/home`, `POST /leads` | Transform to `#07121E` midnight canvas + `#081725` header + `#0F2031` structured cards matching `01_Approved_Homepage.png`, keeping real photos, large `المسارات التعليمية`, `#specialization-quiz`, B2B form, FAQ, and keeping deleted sections removed. |
| `/courses` (`src/app/courses/page.tsx`) | Public | Filterable catalog (`CourseCatalogClient`) | `GET /catalog/courses` | Dark card grid (`#0F2031`, `#284354`), crisp `#F4F7FB` titles, `#08A69B` CTA, dark filter chips & search input. |
| `/courses/[slug]` (`src/app/courses/[slug]/page.tsx`) | Public | Course landing page, syllabus, instructor, smart CTA, community link | `GET /catalog/courses/:slug` | Replace light cards/banners with dark `#0F2031` / `#081725` surfaces, readable `16px` syllabus rows, high-contrast badges. |
| `/courses/[slug]/community` (`src/app/courses/[slug]/community/page.tsx`) | Enrolled / Staff | Course discussions & instructor Q&A (`CourseCommunityPanel`) | `GET/POST /community/*` | Dark thread list, pinned posts, filter controls, reply/best-answer panels. |
| `/learning-paths` (`src/app/learning-paths/page.tsx`) | Public | All learning tracks index | `GET /catalog/learning-paths` | Large dark `#0F2031` `LearningPathCard` grid with numbered step badges. |
| `/learning-paths/[slug]` (`src/app/learning-paths/[slug]/page.tsx`) | Public | Track details, step sequence, enrollment CTA | `GET /catalog/learning-paths/:slug` | Dark timeline step cards + sticky enrollment sidebar. |
| `/diplomas` (`src/app/diplomas/page.tsx`) | Public | Structured diploma programs index | `GET /catalog/diplomas` | Dark diploma program cards (`#0F2031`), clear duration/course count metadata. |
| `/diplomas/[slug]` (`src/app/diplomas/[slug]/page.tsx`) | Public | Diploma curriculum, capstone info, smart CTA | `GET /catalog/diplomas/:slug` | Dark curriculum breakdown & certificate pathway card. |
| `/instructors` (`src/app/instructors/page.tsx`) | Public | Academy instructors directory | `GET /catalog/instructors` | Dark instructor cards with real avatars & clean 16px bio copy. |
| `/pricing` (`src/app/pricing/page.tsx`) | Public | Membership tiers comparison (`PricingClient`) | `GET /plans`, `POST /billing/checkout` | Dark comparison matrix matching midnight theme; highlighted recommended tier with `#32D7C8` border & `#08A69B` CTA. |
| `/about` (`src/app/about/page.tsx`) | Public | Academy methodology & practical engineering ethos | Static / CMS | Dark `#0F2031` story & pillar cards matching `#F4F7FB` / `#A7B8C9`. |
| `/contact` (`src/app/contact/page.tsx`) | Public | Support & enterprise advisory contact form | `POST /leads` | Dark `#0F2031` B2B lead card & clean contact channels. |
| `/certificates/verify` (`src/app/certificates/verify/page.tsx`) | Public | Certificate lookup by code (`verify` route stays active independently of homepage section removal) | `GET /certificates/verify/:code` | Dark verification lookup card & status banner. |
| `/certificates/[code]` (`src/app/certificates/[code]/page.tsx`) | Public | Public verified certificate detail view | `GET /certificates/verify/:code` | Dark frame with clean print contrast & `#77E2B5` verified badge. |
| `/privacy` (`src/app/privacy/page.tsx`) | Public | Arabic privacy policy | Static | Readable `16px` `line-height: 1.7` prose on `#0F2031`. |
| `/terms` (`src/app/terms/page.tsx`) | Public | Arabic terms of use | Static | Readable `16px` `line-height: 1.7` prose on `#0F2031`. |
| `/login` (`src/app/login/page.tsx`) | Guest | Sign in with phone + password & Google (`GoogleSignInButton`) | `POST /auth/login` | Dark auth card (`#0F2031`), `#081725` `#login-phone` / `#login-pass` inputs, clear error/focus states. |
| `/register` (`src/app/register/page.tsx`) | Guest | New learner registration | `POST /auth/register` | Dark multi-field registration card preserving `#reg-*` IDs & clean copy. |
| `/recovery` (`src/app/recovery/page.tsx`) | Guest | Password recovery flow | `POST /auth/recovery/*` | Dark recovery card preserving `#rec-*` IDs. |
| `/security/passkey-setup` (`src/app/security/passkey-setup/page.tsx`) | Authenticated | Biometric device security registration | `POST /auth/webauthn/*` | Dark setup card preserving `#pk-*` IDs & plain Arabic copy. |
| `/membership/sandbox-checkout` (`src/app/membership/sandbox-checkout/page.tsx`) | Authenticated | Simulated sandbox billing completion screen | `POST /billing/sandbox/complete` | Dark summary & action card (`#0F2031`). |
| `/membership/checkout-result` (`src/app/membership/checkout-result/page.tsx`) | Authenticated | Payment confirmation & redirect status | `GET /billing/orders/:id` | Dark semantic result card (`#77E2B5` / `#FF9CAA`). |
| `/student` (`src/app/student/page.tsx`) | Student / Any logged user | Learner dashboard: active membership, enrolled courses, continue learning, certificates, tracks | `GET /student/dashboard` | `DashboardShell` dark RTL sidebar + `#0F2031` progress cards + real progress bars. |
| `/student/settings` (`src/app/student/settings/page.tsx`) | Student | Profile, password, device security management | `GET/PATCH /student/profile` | `DashboardShell` + dark settings cards. |
| `/learn/[slug]` (`src/app/learn/[slug]/page.tsx`) | Enrolled / Staff | Focused theater lesson player, sidebar syllabus, lesson Q&A (`LessonQaSection`), capstone submission (`DiplomaSubmissionBox`) | `GET /learn/:slug`, `POST /learn/:slug/progress` | Dark studio workspace (`#07121E` player stage, `#0F2031` syllabus & Q&A drawer/tabs). |
| `/notifications` (`src/app/notifications/page.tsx`) | Authenticated | Notifications center with read-all & navigation | `GET/POST /notifications/*` | Dark list cards with unread `#32D7C8` indicator & mark-read button. |
| `/instructor` (`src/app/instructor/page.tsx`) | Instructor / Admin | Course authoring studio, new course form (`#nc-*`), editorial status & community tab (`InstructorCommunitiesPanel`) | `GET/POST /instructor/*` | `DashboardShell` dark RTL studio, high-contrast status badges, `#0F2031` cards. |
| `/instructor/courses/[courseId]` (`src/app/instructor/courses/[courseId]/page.tsx`) | Instructor / Admin | Curriculum builder, sections, lessons, quizzes (`#qz-*`), submit for review | `GET/PATCH/POST /instructor/courses/:id` | Dark curriculum editor preserving `#qz-*`, `/حفظ المسودة/`, `'إرسال للمراجعة الإدارية'`. |
| `/instructor/videos` (`src/app/instructor/videos/page.tsx`) | Instructor / Admin | Video upload library (`VideoChunkUploader`) & encoding status | `GET/POST /videos/*` | Dark upload dropzone & video encoding table preserving `#vid-*`. |
| `/admin` (`src/app/admin/page.tsx`) | Admin | 8-tab Executive & Operational Control Center | `GET/POST/PATCH /admin/*`, `/plans`, `/community` | Aligned with `02_Admin_Dashboard.png`: dark `#081725` RTL sidebar, `#07121E` canvas, `+ إضافة كورس جديد` header CTA, 4 KPI cards, overview courses table with live search + status filter + thumbnails + pagination, editorial review widget, community moderation widget, membership content matrix shortcuts, and crisp contrast across all 8 tabs & modals. |
| `/api/[...path]` (`src/app/api/[...path]/route.ts`) | Proxy | Server-side API proxy to backend | All API endpoints | **Untouched** (backend integration boundary). |

### 3B. Shared Components & Libraries (`apps/web/src/components/**`, `apps/web/src/lib/**`)

| Category | Files | Update Scope |
| :--- | :--- | :--- |
| **Core Theme & Primitives** | `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `components/ui/primitives.tsx`, `components/motion/ScrollMotionSystem.tsx`, `lib/labels.ts` | Replace tokens with `tokens.css` dark system; enforce typography & `>=44px` hit targets; update `Button`, `Badge`, `Card`, `Field`, `inputClassName`, `PasswordInput`, `AlertBanner`, `NativeModal`, `EmptyState`, status badge tone styling. |
| **Shells & Heroes** | `components/layout/SiteShell.tsx`, `components/layout/DashboardShell.tsx`, `components/layout/PageHero.tsx` | Dark `#081725` header with inline course search bar, original `bosla-logo.webp`, active bottom underline, mobile drawer; `DashboardShell` RTL `#081725` sidebar + keyboard-accessible mobile drawer (`Escape`, backdrop, focus handling); dark `PageHero`. |
| **Storefront & Catalog** | `components/home/HomeExperience.tsx`, `components/catalog/CourseCatalogClient.tsx`, `components/catalog/LearningPathCard.tsx`, `components/pricing/PricingClient.tsx` | Match `01_Approved_Homepage.png` aesthetic on dark `#07121E` / `#0F2031` while preserving all real content, large paths, quiz, B2B form, FAQ, and deleted-section exclusions. |
| **Admin Modals** | `components/admin/AdminCatalogModals.tsx`, `components/admin/AdminCourseModals.tsx`, `components/admin/AdminMembershipModals.tsx` | Replace hardcoded light slate/amber/emerald classes inside modals with dark `#0F2031` / `#081725` / `#284354` semantic colors. |
| **Community & Notifications** | `components/community/AdminCommunitiesPanel.tsx`, `components/community/InstructorCommunitiesPanel.tsx`, `components/community/CourseCommunityPanel.tsx`, `components/community/LessonQaSection.tsx`, `components/community/CommunityThreadModal.tsx`, `components/community/NotificationBell.tsx`, `components/community/types.ts` | Dark card/thread styling, `#77E2B5` best-answer styling, dark notification popover dropdown. |
| **Learning & Video** | `components/player/BoslaHlsPlayer.tsx`, `components/learning/DiplomaSubmissionBox.tsx`, `components/learning/SmartLearningCta.tsx`, `components/instructor/VideoChunkUploader.tsx`, `components/auth/GoogleSignInButton.tsx` | Ensure dark theme compatibility across player chrome, capstone box, smart CTA, uploader dropzone, and Google auth button. |
| **Untouched Data/Auth Libs** | `lib/api.ts`, `lib/auth-context.tsx` | **Untouched** except verifying no broken color helpers exist (API & auth logic stay 100% intact). |

---

## 4. Verification Plan
1. `npm run lint` (zero lint errors)
2. `npm run typecheck` (zero TypeScript errors)
3. `npm run build` (clean production Next.js build)
4. `npm test` (workspace tests)
5. `npm run test:e2e --workspace=@bosla/web -- --reporter=list` (full Playwright E2E regression suite)
6. Playwright multi-viewport visual & contrast audit across `1440px`, `1024px`, `768px`, and `390px` viewports checking: zero contrast bugs (e.g., white text on white background), zero horizontal overflow, console/network cleanliness, modal focus & Escape close, mobile drawer toggle, and screenshot inspection for Homepage, Courses, Admin Dashboard, Student, Instructor, Player, and Login.
