# BOSLA Academy — Business Logic Audit Findings Register

**Audit Branch:** `audit/superpowers-logic-audit`  
**Methodology:** Superpowers (`systematic-debugging` + `test-driven-development` RED -> minimal fix -> GREEN + `verification-before-completion` + `requesting-code-review`).

---

## Findings Summary

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| **F-01** | Critical | Commerce / Authorization | `POST /commerce/orders/:orderNumber/sandbox-confirm` lacked caller ownership check | **Fixed & Verified (RED -> GREEN)** |
| **F-02** | High | Commerce / Concurrency | Direct order creation bypassed `course.maxCapacity`, and coupon `usageLimit` increment was non-atomic | **Fixed & Verified (RED -> GREEN)** |
| **F-03** | High | Finance / Commissions | `SellerCode.allowedCourseIds` was ignored when attributing per-item commissions in multi-course carts | **Fixed & Verified (RED -> GREEN)** |
| **F-04** | High | Finance / Refunds & Access | Refund settlement blindly revoked all active `DirectPurchase` rows, wiping overlapping paid/admin/B2B entitlements | **Fixed & Verified (RED -> GREEN)** |
| **F-05** | High | Admin / Learning Access | `AdminOperationsService.grantCourseEnrollment` created `CourseEnrollment` without `DirectPurchase`, leaving playback blocked | **Fixed & Verified (RED -> GREEN)** |
| **F-06** | High | RBAC / Multi-role | Single-role `=== 'ADMIN'` / `!== 'ADMIN'` checks blocked `SUPER_ADMIN` and secondary-role `ADMIN` across 6 modules | **Fixed & Verified (RED -> GREEN)** |
| **F-07** | High | LMS Advanced / IDOR | `listSessions`, `listAssignments`, and `submitAssignment` lacked course/cohort entitlement checks and leaked meeting URLs | **Fixed & Verified (RED -> GREEN)** |
| **F-08** | High | Events / Concurrency | Free & paid event confirmations lacked row locking (`FOR UPDATE`), allowing concurrent capacity overbooking | **Fixed & Verified (RED -> GREEN)** |
| **F-09** | Medium | Sellers / Cookies | `SellersController.trackReferral` checked `COOKIE_SECURE === 'true'` instead of shared proxy-aware `isRequestHttps(req)` | **Fixed & Verified (RED -> GREEN)** |
| **F-10** | Medium | Testing / Reliability | `test:integration` ran parallel `embedded-postgres` clusters causing intermittent `P1001` connection failures | **Fixed & Verified (`--no-file-parallelism`)** |

---

## Implemented Repairs & Regression Tests

### F-01: Sandbox Order Confirmation Ownership
- **Fix:** Added `CommerceService.confirmSandboxOrderPayment` enforcing `order.userId === user.id || isAdminRole(user.role, user.roles)` before delegation in `apps/api/src/modules/commerce/commerce.service.ts` and `commerce.controller.ts`.
- **Verification:** `audit-regressions.integration.test.ts` (`F-01`) confirmed `403` when an unassociated student attempts sandbox confirmation.

### F-02: Course `maxCapacity` & Atomic Coupon `usageLimit`
- **Fix:** Extracted `assertCourseCapacityForEnrollmentTx` and `throwCourseCapacityExceededError` in `apps/api/src/core/course-entitlement.helper.ts`, enforcing `"Course" FOR UPDATE` capacity locks both during `CommerceService.createOrder` AND during settlement enrollment (`CommissionEngineService.grantCourseEntitlementTx`), plus locking `"Coupon"` (`FOR UPDATE`) inside `createOrder` before incrementing `usageCount`.
- **Verification:** `audit-regressions.integration.test.ts` (`F-02` & `F-02 Settlement capacity race`) confirmed `400` above `maxCapacity`, `1` winner out of `3` concurrent single-use coupon orders (`usageCount = 1`), and at most `1` enrollment when two concurrent `PENDING_PAYMENT` orders attempt settlement on a `maxCapacity: 1` course.

### F-03: `SellerCode.allowedCourseIds` Commission Filtering
- **Fix:** Selected `sellerCode.allowedCourseIds` inside `CommissionEngineService` (`apps/api/src/modules/finance/commission-engine.service.ts`) and skipped commission attribution on order items whose `courseId` is excluded by non-empty `allowedCourseIds`.
- **Verification:** `audit-regressions.integration.test.ts` (`F-03`) confirmed mixed cart `[courseA, courseB]` with `allowedCourseIds: [courseA]` generates commission strictly for `courseA`.

### F-04 & F-05: Overlapping Entitlement Preservation & Admin Course Grants
- **Fix:** Extracted shared `apps/api/src/core/course-entitlement.helper.ts` (`ensureActiveCourseDirectPurchase`, `revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant`). Updated `AdminOperationsService.grantCourseEnrollment` & `revokeCourseEnrollment` (`admin-operations.service.ts`) and `RefundSettlementService` (`refund-settlement.service.ts`) so admin grants create an active unlinked `DirectPurchase`, and revocations/order-refunds only cancel unlinked (`paymentTransactionId: null`) rows when no remaining paid `OrderItem` or independent (`B2B_ORG_ENROLLMENT` / `ADMIN_GRANTED`) grant exists.
- **Verification:** `audit-regressions.integration.test.ts` (`F-05` & `F-04`) verified admin grant unlocks `/learning/courses/:slug/player`, revoke cleans up unlinked grant, and refunding duplicate Order B preserves access backed by valid Order A.

### F-06: Multi-Role `ADMIN` & `SUPER_ADMIN` Resolution
- **Fix:** Added shared `hasAnyRole` and `isAdminRole` in `packages/shared/src/rbac.ts`, extended `evaluateCommunityAccess` (`packages/shared/src/entitlements.ts`) for `SUPER_ADMIN`, and added `resolveEffectiveRoleForLegacyCheck` in `apps/api/src/core/rbac-resolver.ts`; updated `MembershipService`, `VideoService`/`VideoController`, `InstructorService`/`InstructorController` (including post-mutation `getCourseDetail` forwarding), `LearningService`/`LearningController`, `AdminService.assertValidCourseOwner`, `CommunityService`, `CommunityAccessService.resolveCourseAccess` & `requireCourseCommunityAccess`, and `InstructorCollabController`. In `VideoService.authorizeAndResolveStream`, dynamically resolved `userRoleAssignment` roles via `resolveUserAccess`.
- **Verification:** `apps/api/src/modules/rbac/multi-role-admin.spec.ts` (6/6 PASS) and `npm run typecheck`.

### F-07: Advanced LMS Sessions & Assignments Entitlement Checks
- **Fix:** Imported `MembershipModule` into `LmsAdvancedModule` and injected `MembershipService` into `LmsAdvancedService`; added `resolveLmsVisibilityScope(user)` scoping `listSessions` and `listAssignments` to entitled/free courses and active cohorts for learners and owned/co-taught courses for instructors (without treating `'lms.grade'` as unrestricted staff), while preserving unrestricted staff/admin access (`AdminEnterpriseSuitePanel`); enforced course/cohort entitlement check inside `submitAssignment`.
- **Verification:** `audit-regressions.integration.test.ts` (`F-07` & `F-07 Instructor isolation`) verified hidden private `manualMeetingUrl` & `403` submit rejection for un-enrolled outsiders, instructor isolation from unowned courses, staff visibility intact, and submission success once enrolled.

### F-08: Concurrent Event Capacity Locking
- **Fix:** Extracted `lockOfflineEventAndCheckCapacity` (`FOR UPDATE` on `"OfflineEvent"`) in `apps/api/src/core/event-capacity.helper.ts` and applied it in both `EventsService.initiateEventCheckout` (free confirmation transaction) and `MembershipService` Paymob webhook settlement (`OFFLINE_EVENT` transaction, returning `{ activated, reason }` so `EVENT_TICKET_ACTIVATED_PAYMOB` is only logged on actual activation).
- **Verification:** `audit-regressions.integration.test.ts` (`F-08`) confirmed 4 parallel booking requests on a `capacity: 1` event yield exactly `1` HTTP `201` and `1` `CONFIRMED` DB row.

### F-09: Proxy-Aware HTTPS Cookie Detection
- **Fix:** Extracted shared `isRequestHttps` in `apps/api/src/core/http-security.helper.ts` reused by both `AuthController` and `SellersController`.
- **Verification:** `audit-regressions.integration.test.ts` (`F-09`) verified `Set-Cookie` includes `Secure` under `COOKIE_SECURE=auto` + `X-Forwarded-Proto: https`.

### F-10: Deterministic Integration Test Runner
- **Fix:** Updated `@bosla/api` `test:integration` script to `vitest run test --no-file-parallelism`.
- **Verification:** Full `npm run test:integration` passed deterministically across all 4 suites (`24/24` tests).
