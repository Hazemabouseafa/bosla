# BOSLA Academy — Business Logic Audit Coverage Matrix

**Branch:** `audit/superpowers-logic-audit` (forked from `91a4fac`)  
**Scope:** End-to-end audit of business rules, permissions, ownership, entitlements, payments, concurrency, worker execution, and frontend/API integration across `@bosla/api`, `@bosla/shared`, `@bosla/worker`, and `@bosla/web`.  
**Specifications Referenced:**
- `docs/CLIENT_V1_2_REQUIREMENTS_MATRIX.md`
- `docs/RBAC_PERMISSION_MATRIX.md`
- `docs/BUSINESS_DECISIONS_REQUIRED.md`

---

## 1. Module & Role Inventory

Roles defined in `docs/RBAC_PERMISSION_MATRIX.md` (9 roles, 34 permissions, including Maker-Checker & Support payout restrictions):
- `STUDENT`
- `INSTRUCTOR`
- `ADMIN`
- `SUPER_ADMIN`
- `FINANCE` / `SELLER` / `SUPPORT` / `CRM` / `ORG_ADMIN` (verified against `rbac` and `guards.ts`)

| # | Module (`apps/api/src/modules/*`) | Core Workflows & Business Rules | Key Files | Ownership & Permission Rules | Audit Status |
|---|---|---|---|---|---|
| 1 | `auth` & `rbac` | Registration, login, Google OIDC, recovery, sessions, logout, CSRF, rate limiting, multi-role `roles[]` vs primary `role`, permission matrix, maker-checker | `apps/api/src/core/guards.ts`, `apps/api/src/core/redis.service.ts`, `apps/api/src/modules/rbac/rbac.controller.ts`, `apps/api/src/modules/rbac/rbac.service.ts` | `SessionAuthGuard`, `OptionalSessionAuthGuard`, `RolesGuard`, `CsrfGuard`; Google OIDC live tokens unverified externally | Findings logged (`F-06`) |
| 2 | `catalog` & `editorial` | Three-entity taxonomy (Course / Learning Path / Diploma), course reuse, independent pricing, draft vs published versions, editorial approval | `apps/api/src/modules/catalog/catalog.service.ts`, `apps/api/src/modules/editorial/editorial.service.ts` | Public read vs `ADMIN`/`SUPER_ADMIN`/`INSTRUCTOR`/editorial RBAC | Audited |
| 3 | `membership` | Subscription plans, boundaries, `checkCourseAccessForUser`, tier access vs individual course purchase, event booking helper | `apps/api/src/modules/membership/membership.controller.ts`, `apps/api/src/modules/membership/membership.service.ts`, `packages/shared/src/entitlements.ts` | Enrolled/active subscriber vs `ADMIN`/`SUPER_ADMIN` bypass | Findings logged (`F-06`, `F-08`) |
| 4 | `learning` | Course player, lesson progress, completion tracking, certificate eligibility | `apps/api/src/modules/learning/learning.controller.ts`, `apps/api/src/modules/learning/learning.service.ts` | Course access entitlement or `ADMIN`/`SUPER_ADMIN` | Findings logged (`F-05`, `F-06`) |
| 5 | `commerce` | Cart & order pricing (`previewOrBuildOrderPricing`), server totals, coupons (`usageLimit`), course `maxCapacity`, Paymob checkout & webhook settlement, sandbox confirmation | `apps/api/src/modules/commerce/commerce.controller.ts`, `apps/api/src/modules/commerce/commerce.service.ts`, `packages/shared/src/money.ts` | Order owner check on sandbox confirmation; atomic coupon lock; capacity enforcement; live Paymob API unverified externally | Findings logged (`F-01`, `F-02`) |
| 6 | `finance` | Commission engine (`SellerCode.allowedCourseIds`, disabled membership seller commissions), proportional refund settlement, overlapping entitlement preservation, maker-checker payouts | `apps/api/src/modules/finance/commission-engine.service.ts`, `apps/api/src/modules/finance/refund-settlement.service.ts`, `apps/api/src/modules/finance/finance.controller.ts` | `FINANCE`/`ADMIN`/`SUPER_ADMIN` RBAC; seller code course allowlist; idempotent `@unique orderItemId` | Findings logged (`F-03`, `F-04`) |
| 7 | `video` | Private video storage, HLS stream authorization, signed playback tokens, chunked uploads, transcode job triggers | `apps/api/src/modules/video/video.service.ts` | Entitled learner, owning instructor, or `ADMIN`/`SUPER_ADMIN` (including secondary roles) | Findings logged (`F-06`) |
| 8 | `community` | Community spaces, posts, lesson questions, eligibility & isolation, moderation, entitlement revocation impact | `apps/api/src/modules/community/community-access.service.ts`, `apps/api/src/modules/community/community.service.ts` | Space/course eligibility; moderation by `ADMIN`/`SUPER_ADMIN`/instructor | Findings logged (`F-06`) |
| 9 | `instructor` & `instructor-collab` | Instructor course authoring, draft edits, analytics, super-admin/instructor direct chat & task assignments | `apps/api/src/modules/instructor/instructor.service.ts`, `apps/api/src/modules/instructor-collab/*` | Owner instructor or `ADMIN`/`SUPER_ADMIN`; direct messaging isolation | Findings logged (`F-06`) |
| 10 | `admin` | User provisioning (`createUserAccount`), manual subscription grants, manual course enrollment grant/revoke, manual certificate issuance, owner assignment | `apps/api/src/modules/admin/admin.controller.ts`, `apps/api/src/modules/admin/admin.service.ts`, `apps/api/src/modules/admin/admin-operations.service.ts` | Strict `ADMIN`/`SUPER_ADMIN` RBAC; grant must synchronize `DirectPurchase` & preserve paid purchases on revoke | Findings logged (`F-05`, `F-06`) |
| 11 | `events` | Offline events, capacity checks, free confirmation, paid webhook confirmation | `apps/api/src/modules/events/events.service.ts` | `FOR UPDATE` capacity locking to prevent concurrent overbooking | Findings logged (`F-08`) |
| 12 | `lms-advanced` | Cohorts, live sessions (`manualMeetingUrl`), assignments & submissions | `apps/api/src/modules/lms-advanced/lms-advanced.controller.ts`, `apps/api/src/modules/lms-advanced/lms-advanced.service.ts` | Strict course/cohort entitlement before listing private meeting URLs/assignments or submitting | Findings logged (`F-07`) |
| 13 | `organizations` | B2B organization seats, `B2B_ORG_ENROLLMENT` provisioning & isolation | `apps/api/src/modules/organizations/organizations.controller.ts`, `apps/api/src/modules/organizations/organizations.service.ts` | Org admin scope isolation; overlapping B2B entitlement preservation | Audited (`F-04` overlap) |
| 14 | `sellers` | Seller attribution cookies (`COOKIE_SECURE=auto` vs `true`), referral tracking, commission dashboards | `apps/api/src/modules/sellers/sellers.controller.ts`, `apps/api/src/modules/sellers/sellers.service.ts` | Seller role isolation; proxy-aware HTTPS cookie detection | Findings logged (`F-09`) |
| 15 | `support` | Support tickets, audit lookup, payout restrictions (Support cannot trigger financial payouts) | `apps/api/src/modules/support/support.service.ts` | Support RBAC boundaries | Audited |
| 16 | `crm`, `notifications`, `health` | Lead/CRM workflows, notifications dispatch, health checks | `apps/api/src/modules/crm/*`, `apps/api/src/modules/notifications/*`, `apps/api/src/modules/health/*` | Internal RBAC & operational boundaries | Audited |
| 17 | `apps/worker` | Background scheduler & FFmpeg HLS video transcoding, retry & failure recovery | `apps/worker/src/main.ts`, `apps/worker/src/scheduler.ts`, `apps/worker/src/transcoder.ts` | Safe retry/failure state transitions & worker bounds | Unit-tested; live worker/FFmpeg integration tracked |
| 18 | `apps/web` & Test Harness | Homepage/Auth/Catalog/Admin/Instructor/Student UI routes; integration suite determinism (`embedded-postgres`) | `apps/api/package.json`, `apps/api/test/*.integration.test.ts` | Deterministic serial integration execution (`--no-file-parallelism`) | Findings logged (`F-10`) |

---

## 2. Explicit Scope Exclusions & Untested External Providers
- **Section 15 Out-of-Scope (`docs/CLIENT_V1_2_REQUIREMENTS_MATRIX.md`):** Third-party external integrations marked out of scope remain unimplemented by design and are tracked as `NOT IMPLEMENTED (Out of Scope)` in final reporting.
- **External Providers (Local Test Boundaries):**
  - **Live Paymob Gateway:** Webhook signature/HMAC and order settlement flows are verified using sandbox/integration test payloads; live Paymob production/staging network calls are not executed in offline local tests.
  - **Live Google OIDC:** OAuth callback/linking structure is audited statically/locally; live Google token exchange against `accounts.google.com` requires live OAuth credentials/browser session.
