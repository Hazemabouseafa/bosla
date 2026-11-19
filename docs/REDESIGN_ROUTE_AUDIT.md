# BOSLA Academy — Full Route, Component & Risk Audit (Approved Navy/White/Turquoise Redesign)

**Date:** 2026-11-14  
**Reference Direction:** `01_APPROVED_COMPOSITION.png`, `02_CINEMATIC_MOODBOARD.png`, `DESIGN_TOKENS.md`, `ANTIGRAVITY_HYDROGEN_EXTRA_MASTER_PROMPT.txt`  
**Stack:** Next.js 15 App Router + React 19 + Tailwind CSS + NestJS REST API (`/api/v1/*`) + PostgreSQL/Prisma

---

## 1. Visual System Shift Summary

| Token Role | Previous Interim State | Approved Final System (`DESIGN_TOKENS.md`) |
| --- | --- | --- |
| Brand Dark Navy | `#071b59` / `#02071a` | `#06142D` (`navy-950`), `#081E40` (`navy-900`), `#0C2B55` (`navy-800`) |
| Accent / Primary Action | `#1554ff` bright cobalt gradients | `#05C6C3` turquoise accent (`#04AAA7` hover, `#D8F8F5` soft tint, `#037A77` accessible text-on-light) |
| Light Canvas & Cards | `#f2f7ff` / mixed indigo tints | `#F6F8FC` canvas (`--bosla-canvas`), `#FFFFFF` surface (`--bosla-surface`) |
| Text & Borders | `#041136` / `#cfe0ff` | `#102744` (`ink`), `#63728A` (`muted`), `#E1E8F2` (`border`) |
| Highlight Gold (Limited) | Bold gold buttons everywhere | `#F6B950` subtle badge/pro accent only |
| Global Header | Translucent white light bar | Dark Navy `#06142D` sticky bar with turquoise active indicator, search modal trigger, bell & account pills |
| Motion Philosophy | Large 32–42px vertical/3D drops | Subtle GPU `transform`/`opacity`, `<= 16px` reveal-once (`450–650ms`), hero entrance `<1.05s`, clean `prefers-reduced-motion` support |

---

## 2. Complete 30-Route Inventory & Upgrade Plan

### A. Public Storefront & Detail Routes (15 Routes)

| # | Route | File | Current State | Target Approved Design & Motion | Backend APIs Used (Preserved) | Risks & Preserved Contracts |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/` | `apps/web/src/app/page.tsx` + `HomeExperience.tsx` | Cobalt blue hero + mixed light sections | Dark Navy `#06142D` hero w/ subtle curved turquoise energy arcs, sequential <1.05s entrance, fanned BOSLA media frame, 4 bottom navy glass tiles, floating white trust strip, crisp course carousel/grid w/ `الأكثر طلباً`/`جديد` pills, learning paths w/ circular turquoise arrow CTAs, quiz, vault, FAQ, B2B lead form | `GET /catalog/home` | `#specialization-quiz button.text-start` -> `المركز #1`; `#lead-name`, `#lead-phone`, `#lead-company`, `'تدريب شركات ومزارع B2B'`, `'إرسال الطلب الآن'`; real DB fields `opt.label`, `weights`/`species`, `studentNameAr`, `cat.thumbnailUrl`, `partner.nameAr` |
| 2 | `/courses` | `apps/web/src/app/courses/page.tsx` + `CourseCatalogClient.tsx` | Cobalt PageHero + cards | Navy `#06142D` compact PageHero + pill track filters (`الكل` active navy pill) + turquoise-accented course cards w/ hover elevation `-3px` | SSR `catalog/home` + `catalog/courses` | Preserve search input, track filter query params, difficulty filter |
| 3 | `/courses/[slug]` | `apps/web/src/app/courses/[slug]/page.tsx` | White-indigo banner + sections | Navy compact banner + split white Course Summary Card (duration/lessons/difficulty pills, `#05C6C3` primary CTA, bookmark/community quick link) + clean Overview/Syllabus tabs + instructor bio card matching `01_APPROVED_COMPOSITION.png` | `GET /catalog/courses/:slug` | Preserve SEO SSR links to `/learn/[slug]`, `/courses/[slug]/community`, curriculum accordion |
| 4 | `/learning-paths` | `apps/web/src/app/learning-paths/page.tsx` | Basic cobalt PageHero + list | Navy PageHero + crisp path cards w/ step badges & circular turquoise CTA pills | `GET /catalog/learning-paths` | Preserve slug routing & step count mapping |
| 5 | `/learning-paths/[slug]` | `apps/web/src/app/learning-paths/[slug]/page.tsx` | Plain slate header + step cards | Navy hero summary + visual numbered turquoise timeline rail + step course cards | `GET /catalog/learning-paths/:slug` | Preserve step navigation to `/courses/[slug]` |
| 6 | `/diplomas` | `apps/web/src/app/diplomas/page.tsx` | Cobalt PageHero + cards | Navy PageHero + structured accreditation cards w/ turquoise metadata pills | `GET /catalog/diplomas` | Preserve credit hours & graduate summary |
| 7 | `/diplomas/[slug]` | `apps/web/src/app/diplomas/[slug]/page.tsx` | Plain header + course cards | Navy banner + structured diploma requirements grid + redesigned `DiplomaSubmissionBox` | `GET /catalog/diplomas/:slug`, `POST /learning/diplomas/:id/submit` | Preserve `DiplomaSubmissionBox` project link submission |
| 8 | `/instructors` | `apps/web/src/app/instructors/page.tsx` | Cobalt PageHero + bios | Navy PageHero + veterinary/agribusiness faculty portrait cards w/ teal specialty accents | `GET /catalog/home` | Real instructor bios only |
| 9 | `/pricing` | `apps/web/src/app/pricing/page.tsx` + `PricingClient.tsx` | Mixed indigo/amber plan cards | Navy PageHero + `#FFFFFF` billing comparison cards w/ highlighted `#05C6C3` annual badge & Paymob CTA button | `GET /memberships/plans`, `POST /memberships/checkout` | Button text `/اشترك/`, Paymob checkout redirect flow untouched |
| 10 | `/about` | `apps/web/src/app/about/page.tsx` | Cobalt PageHero + story | Navy PageHero + BOSLA mission pillar grid + veterinary practical methodology cards | `GET /catalog/cms/about` | CMS content intact |
| 11 | `/contact` | `apps/web/src/app/contact/page.tsx` | Cobalt PageHero + B2B toggle | Navy PageHero + crisp B2B/Individual split inquiry card + WhatsApp direct CTA | `POST /catalog/leads` | Preserve `'تدريب شركات ومزارع B2B'`, `#lead-*`, WhatsApp link |
| 12 | `/certificates/verify` | `apps/web/src/app/certificates/verify/page.tsx` | Cobalt PageHero + verify form | Navy PageHero + crisp centered Vault Verification Card w/ code lookup & QR guidance | `GET /learning/certificates/verify/:code` | Preserve exact verification redirect/display |
| 13 | `/certificates/[code]` | `apps/web/src/app/certificates/[code]/page.tsx` | Plain card | Official Navy & Gold-bordered Print-ready BOSLA Certificate frame w/ verification badge | `GET /learning/certificates/verify/:code` | Preserve printable styling & exact certificate code text |
| 14 | `/privacy` | `apps/web/src/app/privacy/page.tsx` | Basic prose | Navy compact header + readable typographic legal sheet (`#FFFFFF`, max-w-4xl) | Static/legal content | Arabic readability & RTL lists |
| 15 | `/terms` | `apps/web/src/app/terms/page.tsx` | Basic prose | Navy compact header + readable typographic legal sheet (`#FFFFFF`, max-w-4xl) | Static/legal content | Arabic readability & RTL lists |

---

### B. Auth, Security & Paymob Flow Routes (6 Routes)

| # | Route | File | Target Design Update | Preserved Contracts & Risks |
| --- | --- | --- | --- | --- |
| 16 | `/login` | `apps/web/src/app/login/page.tsx` | Dark Navy `#06142D` accent split/glass backdrop card, `#F6F8FC` canvas, `#05C6C3` submit & WebAuthn Passkey button styling | `#login-phone`, `#login-pass`, `'دخول برقم الموبايل وكلمة المرور'`, `'دخول سريع عبر Passkey'`, `GoogleSignInButton` |
| 17 | `/register` | `apps/web/src/app/register/page.tsx` | Harmonized Navy/Turquoise registration card w/ `'بدون رموز OTP'` FIDO2 security badge | `#reg-name`, `#reg-phone`, `#reg-pass`, `#reg-pass-confirm`, `'بدون رموز OTP'`, redirect to `/security/passkey-setup` |
| 18 | `/recovery` | `apps/web/src/app/recovery/page.tsx` | Clean stepped Navy/Turquoise recovery flow (Phone -> Passkey / Recovery Code / Admin Request -> Reset) | `#rec-phone`, `'متابعة خيارات الاسترداد الآمنة'`, `'عبر Passkey'`, `'كود استرداد'`, `#rec-code`, `'التحقق واستهلاك الكود'`, `#rst-pass`, `#rst-confirm`, `'حفظ كلمة المرور الجديدة'` |
| 19 | `/security/passkey-setup` | `apps/web/src/app/security/passkey-setup/page.tsx` | Crisp security onboarding step + Navy-framed 10 recovery codes vault (`<code>` monospace chips) | `#pk-name`, `'تفعيل الحساب وتسجيل Passkey الآن'`, `'تم تفعيل حسابك بنجاح!'`, `code` elements >= 10, `'الدخول إلى لوحة التعلم'` |
| 20 | `/membership/sandbox-checkout` | `apps/web/src/app/membership/sandbox-checkout/page.tsx` | Clean Navy & Turquoise Paymob sandbox terminal card | `'محاكاة دفع ناجح (HMAC)'` exact button & callback |
| 21 | `/membership/checkout-result` | `apps/web/src/app/membership/checkout-result/page.tsx` | Clean payment receipt status banner w/ Student Dashboard CTA | Preserve status query parsing & membership activation check |

---

### C. Learning Player, Private Course Community & Student Portal (5 Routes)

| # | Route | File | Target Approved Design & Motion | APIs & Critical Selectors |
| --- | --- | --- | --- | --- |
| 22 | `/learn/[slug]` | `apps/web/src/app/learn/[slug]/page.tsx` | Dark Navy `#06142D` top learning bar + 2-column RTL stage matching `01_APPROVED_COMPOSITION.png`: crisp Right Syllabus Sidebar (`bg-white rounded-2xl border-[#E1E8F2]`, `#05C6C3` progress bar + active `#D8F8F5` item + `الدرس التالي` CTA), dominant HLS Video Stage + jump tabs (`المحتوى والاختبار`, `المرفقات`, `أسئلة هذا الدرس`) + always-mounted `LessonQaSection` underneath so video state & E2E assertions stay intact | `GET /learning/courses/:slug/player`, `POST /learning/lessons/:id/progress`, `POST /learning/quizzes/:id/attempts`, Community/Q&A endpoints. Preserve `'هذا الدرس متاح للمشتركين فقط'`, `<video>`, `'تحديد هذا الدرس كمكتمل'`, `'إرسال إجابات الاختبار'`, `'عرض الشهادة'`, `'أسئلة هذا الدرس'`, `'اسأل عن هذا الدرس'`, `#lesson-q-title`, `#lesson-q-body`, `'نشر السؤال'`, timestamp jump buttons |
| 23 | `/courses/[slug]/community` | `apps/web/src/app/courses/[slug]/community/page.tsx` + `CourseCommunityPanel.tsx` | Dark Navy community banner + crisp filter pills (`الكل`, `الأسئلة`, `المناقشات`, `إعلانات المدرب`), `#05C6C3` `+ طرح سؤال جديد` CTA, turquoise `إجابة المدرب` / `معتمد` badges matching `01_APPROVED_COMPOSITION.png` | `GET /community/courses/:slug`, `POST /community/courses/:slug/posts`, likes, replies, accept, report. Preserve auth gate string `'يلزم تسجيل الدخول للوصول إلى مجتمع الكورس وأسئلة الدروس'`, disabled notice `'مجتمع هذا الكورس معطّل حاليًا'` |
| 24 | `/student` | `apps/web/src/app/student/page.tsx` | Wrapped in `DashboardShell` (Dark Navy `#06142D` RTL sidebar + `#F6F8FC` workspace). Top greeting w/ real SVG completion progress ring (`#05C6C3` arc), 4 white KPI tiles, membership banner, `استأنف التعلم` progress cards, Paths & Diplomas progress, Certificates & Paymob log | `GET /learning/dashboard`, `POST /memberships/subscriptions/:id/cancel` |
| 25 | `/student/settings` | `apps/web/src/app/student/settings/page.tsx` | Wrapped in `DashboardShell` Student nav: Passkey device list, recovery code regeneration, notification preferences | `/auth/passkeys/*`, `/auth/recovery-codes/*`, `/notifications/preferences` |
| 26 | `/notifications` | `apps/web/src/app/notifications/page.tsx` | Crisp notifications center w/ Navy filter pills + mark-all-read action & deep links | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` |

---

### D. Instructor & Admin Portals (4 Routes)

| # | Route | File | Target Approved Design & Motion | APIs & Critical Selectors |
| --- | --- | --- | --- | --- |
| 27 | `/instructor` | `apps/web/src/app/instructor/page.tsx` + `InstructorCommunitiesPanel.tsx` | `DashboardShell` (Dark Navy RTL sidebar: `لوحة المدرب`, `كورساتي ومشاريع الدروس`, `مكتبة الفيديوهات HLS`, `مجتمعات كورساتي`). White KPI tiles, real course/video chart computed from live `data.courses` & `stats` (no mock earnings/stats), crisp course project cards + harmonised `InstructorCommunitiesPanel` | `GET /instructor/dashboard`, `POST /instructor/courses`, `POST /instructor/courses/:id/submit`, `/community/instructor/*`. Preserve `إنشاء كورس جديد`, `#nc-title`, `#nc-slug`, `#nc-desc`, `'إنشاء وفتح محرر الكورس'`, heading `'مجتمعات كورساتي'`, `'أسئلة بدون إجابة'`, **`div.space-y-3 > div.rounded-2xl`**, `'فتح والرد / اعتماد الإجابة'`, `#thread-reply-body`, `'نشر الرد'`, `'اعتماد الإجابة'` |
| 28 | `/instructor/courses/[courseId]` | `apps/web/src/app/instructor/courses/[courseId]/page.tsx` | `DashboardShell` Instructor sidebar + streamlined editorial draft workspace (course metadata, sections, lessons, quiz builder, submit for admin review) | `GET/PATCH /instructor/courses/:id`, sections/lessons/quizzes CRUD, submit. Preserve `'اختبار جديد'`, `#qz-t`, `#qz-pct`, `#qz-q`, `#qz-a`, `#qz-b`, `'حفظ الاختبار'`, `'إضافة قسم'`, `'إضافة درس'`, `/حفظ المسودة/`, `'إرسال للمراجعة الإدارية'` |
| 29 | `/instructor/videos` | `apps/web/src/app/instructor/videos/page.tsx` + `VideoChunkUploader.tsx` | `DashboardShell` Instructor sidebar + crisp chunked uploader card w/ turquoise progress bar & HLS transcode status grid | `POST /instructor/videos/init`, `/chunk`, `/complete`, `GET /instructor/videos`. Preserve `#vid-title`, `#vid-file`, `/بدء الرفع المجزأ/`, `'تحديث حالة المعالجة'`, `'جاهز للبث HLS'` |
| 30 | `/admin` | `apps/web/src/app/admin/page.tsx` + `AdminCommunitiesPanel.tsx` | `DashboardShell` Admin Dark Navy RTL sidebar hosting all 8 control sections (`نظرة عامة`, `مراجعة الكورسات`, `إدارة المجتمعات`, `المستخدمون`, `المسارات والدبلومات`, `العضويات وPaymob`, `الشهادات والاسترداد`, `المحتوى والعملاء والسجل`). Crisp white KPI tiles, real platform distribution bar chart built strictly from `overview`, preserved editorial approval & plan version modals | `/admin/overview`, `/admin/editorial/*`, `/admin/users`, `/admin/membership-plans`, `/admin/payments`, `/admin/certificates`, `/admin/support-recovery`, `/admin/cms/pages`, `/admin/leads`, `/admin/audit-logs`, `/community/admin/*`. Preserve ALL tab button labels (`'مراجعة الكورسات'`, `'إدارة المجتمعات'`, `'العضويات وPaymob'`), **`div.rounded-2xl`**, `'اعتماد (Approve)'`, `'نشر فوري للطلاب'`, `'تعديل السعر والمحتوى المشمول'`, `'حفظ التغييرات وإصدار نسخة خطة جديدة'`, **`div.rounded-xl`**, `'تعطيل المجتمع'` |

---

## 3. Shared Components Audited (18 Files)

1. `components/ui/primitives.tsx` — Update `Button`, `Badge`, `Card`, `Field`, `inputClassName`, `PasswordInput`, `AlertBanner`, `NativeModal`, `EmptyState` to Navy/Turquoise tokens (`Card` retains `rounded-2xl`!).
2. `components/layout/SiteShell.tsx` — Update `SiteHeader` (Dark Navy `#06142D`, Search quick overlay trigger, Notification bell pill, crisp mobile drawer) and `SiteFooter` (`#06142D` navy architectural footer).
3. `components/layout/PageHero.tsx` — Align compact Navy hero band with `#05C6C3` curved accent glow & breadcrumb support.
4. `components/layout/DashboardShell.tsx` *(new)* — Unified RTL Dark Navy (`#06142D`) right sidebar + `#F6F8FC` workspace + responsive mobile slide-over drawer for Student, Instructor, and Admin portals.
5. `components/motion/ScrollMotionSystem.tsx` — Refined ultra-lightweight top scroll hairline (`#05C6C3`) + single-pass reveal-once `IntersectionObserver` fallback (`data-reveal` -> `data-revealed="true"`).
6. `components/home/HomeExperience.tsx` — Full visual overhaul matching `01_APPROVED_COMPOSITION.png` + `02_CINEMATIC_MOODBOARD.png` while preserving 100% real BOSLA CMS schema fields and E2E selectors.
7. `components/catalog/CourseCatalogClient.tsx` — Align category filter chips (`bg-[#06142D] text-white` active pill) and crisp hover cards.
8. `components/pricing/PricingClient.tsx` — Align Paymob pricing comparison grid & annual turquoise highlight.
9. `components/community/NotificationBell.tsx` — Dark-glass bell button when placed inside `#06142D` header + crisp white popover dropdown.
10. `components/community/CourseCommunityPanel.tsx` — Match `01_APPROVED_COMPOSITION.png` community header/filters/`+ طرح سؤال جديد` button.
11. `components/community/LessonQaSection.tsx` — Navy/Turquoise lesson Q&A cards + timestamp jump pill badges.
12. `components/community/CommunityThreadModal.tsx` — Align modal styling & `إجابة المدرب` turquoise badges.
13. `components/community/InstructorCommunitiesPanel.tsx` — Replace indigo accents with Navy/Turquoise while keeping `div.space-y-3 > div.rounded-2xl` exact structure.
14. `components/community/AdminCommunitiesPanel.tsx` — Replace indigo accents with Navy/Turquoise while keeping `div.rounded-xl` exact structure.
15. `components/player/BoslaHlsPlayer.tsx` — Align cinema frame & controls accents to `#05C6C3` while keeping `loadedmetadata` seek & HLS token playback intact.
16. `components/auth/GoogleSignInButton.tsx` — Harmonized `#FFFFFF`/`#E1E8F2` Google SSO pill button.
17. `components/instructor/VideoChunkUploader.tsx` — Turquoise upload bar + clean chunk progress status.
18. `components/learning/DiplomaSubmissionBox.tsx` — Clean `#FFFFFF` card & `#05C6C3` submit action.
