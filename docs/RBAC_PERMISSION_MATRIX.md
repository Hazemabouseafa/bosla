# BOSLA Academy — Enterprise RBAC & Permission Matrix (v1.2)

## 1. Architecture Overview
- **Schema Models** (`packages/db/prisma/schema.prisma`, Migration `0005_enterprise_v1_2_expansion`):
  - `RoleDefinition` (9 system roles preserving existing `User.role` IDs & accounts)
  - `PermissionDefinition` (34 granular permission codes across RBAC, Platform, Academic, Certificates, Community, Commerce, Finance, Sellers, CRM, B2B, Support, Learning)
  - `RolePermission` (dynamic DB-backed role-to-permission grants editable via `/admin` -> RBAC tab and `PUT /api/v1/rbac/roles/:roleCode/permissions`)
  - `UserRoleAssignment` (multi-role support: any user may hold a primary role plus compatible secondary roles via `PUT /api/v1/rbac/users/:userId/roles`)
- **Enforcement** (`apps/api/src/core/rbac-resolver.ts`, `apps/api/src/core/guards.ts`, `apps/api/src/core/decorators.ts`):
  - `SessionAuthGuard` resolves `roles`, `permissions`, `sellerId`, and `organizationIds` on every request.
  - `RolesGuard` enforces BOTH `@Roles(...)` (treating `ADMIN` and `SUPER_ADMIN` equivalently for backward compatibility) AND `@RequirePermissions(...)`.
  - Financial Maker-Checker (`seller_payouts.createdById !== approvedById`) is enforced at BOTH application and PostgreSQL `CHECK` constraint levels — role reassignment can NEVER bypass financial Maker-Checker controls.
  - `SUPPORT` is strictly blocked at the API layer from receiving `settlements.approve` or `settlements.payout`.

## 2. Role Summary & Default Permission Grants

| Role Code | Arabic Name | Admin Portal | Core Scope | Financial Approval / Payout |
|---|---|---|---|---|
| `SUPER_ADMIN` | مدير النظام الأعلى | Yes | Full control over RBAC, settings, operations, finance | Yes (still subject to Maker !== Checker) |
| `ADMIN` | إدارة المنصة | Yes | Backward-compatible full admin alias | Yes (still subject to Maker !== Checker) |
| `ACADEMY_MANAGER` | مدير الأكاديمية | Yes | Academic catalog, instructors, seller reviews, commission rules, CRM, B2B, support | No settlement approval/payout by default |
| `TRAINING_COORDINATOR` | منسق التدريب | Yes | Course scheduling, sessions, attendance, grading, waitlists, events, B2B | No |
| `INSTRUCTOR` | مدرب / محاضر | Instructor Portal | Assigned courses, attendance, assignments/quizzes grading, own financial statement | No |
| `FINANCE_OFFICER` | مسؤول مالي | Yes (Finance view) | Orders, manual/partial payments, allocations, refunds, commissions, Maker/Checker settlements, expenses, period closing, reconciliation | Yes (Maker-Checker enforced) |
| `AFFILIATE_SELLER` | بائع / مسوّق بالعمولة | Seller Portal (`/seller`) | Own seller profile, codes, QR, referral links, attributed orders, commissions, payouts only | No |
| `SUPPORT` | خدمة العملاء والدعم | Yes (Support view) | Support tickets, internal notes, SLA, CRM, order viewing, community moderation | **Strictly Prohibited** |
| `STUDENT` | متدرب | Student Portal (`/student`) | Authorized courses, cart/orders, certificates, personal support tickets | No |

## 3. Sensitive Operations Audit Trail
All role permission edits (`RBAC_ROLE_PERMISSIONS_UPDATED`), user role assignments (`RBAC_USER_ROLES_UPDATED`), seller reviews/suspensions, commission rules/approvals, refunds, Maker-Checker settlements, expenses, period closing, and certificate revocations/reissues are recorded in the immutable `AuditLog` table and inspectable at `GET /api/v1/rbac/audit-logs` (`@RequirePermissions('audit.read')`).
