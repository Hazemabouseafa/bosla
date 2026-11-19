# BOSLA Academy — B2B Organizations & Institutional Training Report (v1.2)

## 1. Architecture & Isolation
- **Backend:** `apps/api/src/modules/organizations/` (`organizations.service.ts`, `organizations.controller.ts`, `organizations.module.ts`)
- **Database Tables:** `Organization`, `OrganizationMember`, `TrainingCohort`, `CohortEnrollment`, `OrganizationContract`
- **Frontend Portal:** `/org` (`apps/web/src/app/org/page.tsx`) inside `DashboardShell` + B2B Governance inside `/admin` -> `منظومة الإدارة الشاملة v1.2` -> `المؤسسات B2B`.
- **Tenant Isolation:** `OrganizationsService.assertOrgAccess` strictly restricts `ORG_ADMIN` accounts to their own `organizationId` (returning HTTP `403` on cross-organization access attempts). Only staff holding `b2b.manage` (or `ADMIN`/`SUPER_ADMIN`) can list/manage all organizations.

## 2. Capabilities Delivered
- **Company & University Profiles:** Tracks `OrganizationType` (`COMPANY`, `UNIVERSITY`), tax number, primary contact, and strict `seatCapacity`.
- **Seat Enforcement & Member Assignment:** `POST /api/v1/organizations/:id/members` rejects additions when `seatCapacity` is reached.
- **Training Cohorts & Bulk Enrollment:** `POST /api/v1/organizations/:id/cohorts` and `POST /api/v1/organizations/:id/bulk-enroll` atomically enroll organization learners into `CourseEnrollment`, `DirectPurchase` (institutional grant), and optional `CohortEnrollment`.
- **Contracts & Quotations:** `POST /api/v1/organizations/contracts` stores contract numbers (`B2B-YYYY-...`), quotation amount (`DECIMAL(12,2)`), institutional discount percent, validity period, and assigned course IDs.
- **Institutional Training Impact Report:** `GET /api/v1/organizations/:id/dashboard` computes live seat usage, average lesson progress, completed lessons, issued certificates, and confirmed attendance breakdown for organization learners.
