# BOSLA Academy — Safe Production Deployment Guide (Coolify / VPS, v1.2)

> **CRITICAL SAFETY NOTICE**: This guide preserves the existing production PostgreSQL database, VPS HLS media volume, Paymob configuration, and Google OIDC setup. **Never** run `prisma migrate reset`, `prisma db push --force-reset`, `docker compose down -v`, or `docker volume prune`.

## 1. Pre-Deployment Checklist
1. **Written Client Sign-Offs**: Review [BUSINESS_DECISIONS_REQUIRED.md](BUSINESS_DECISIONS_REQUIRED.md) before enabling live seller payouts (specifically §2 partial refund signature and §5 accountant/legal KYC & tax review). Subscription commissions (`MONTHLY_MEMBERSHIP` / `ANNUAL_MEMBERSHIP`) remain **disabled** by code safeguard until written policy approval.
2. **Full PostgreSQL Backup Before Migration**:
   ```bash
   pg_dump "$DATABASE_URL" -Fc -f "bosla_pre_v1_2_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Environment Variables Verification**:
   - Preserve existing `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `RECOVERY_CODE_PEPPER`, `PLAYBACK_TOKEN_SECRET`, `PAYMOB_*`, `GOOGLE_CLIENT_ID`, `WEBAUTHN_*`, `MEDIA_ROOT`, `APP_URL`, `API_URL`, `CORS_ORIGINS`.
   - Ensure `COOKIE_SECURE=true` in HTTPS production and `PAYMOB_MODE=live` (sandbox confirmation endpoint `/commerce/orders/:orderNumber/sandbox-confirm` automatically rejects calls when `PAYMOB_MODE !== 'sandbox'`).

## 2. Additive Database Migration (`0005_enterprise_v1_2_expansion`)
Migration `packages/db/prisma/migrations/0005_enterprise_v1_2_expansion/migration.sql` is **strictly additive and non-destructive**:
- Extends `UserRole` and `NotificationType` enums via `ALTER TYPE ... ADD VALUE`.
- Adds nullable/defaulted delivery/capacity columns on `Course`, template/reissue fields on `Certificate`, question-bank/manual-grading columns on `QuizQuestion`/`QuizAttempt`, CRM fields on `LeadSubmission`, and `accountingType` on `MembershipPlan`.
- Creates new RBAC, Seller, Order/Payment/Allocation, Commission/Refund/Settlement, Expense/PeriodClose, InstructorProfile/Contract, CRM, B2B, Advanced LMS, Certificate Template, and Support tables.
- Adds DB-level integrity guards:
  - Partial unique index `seller_payout_items_active_commission_uq` (`WHERE "isVoided" = false`)
  - `CHECK` constraints for Maker-Checker (`approvedById <> createdById`), commission ceiling (`appliedAmount <= cappedAmount`), and non-negative payout/allocation amounts.

Apply via Coolify deploy hook or container exec:
```bash
npx --workspace=@bosla/db prisma migrate deploy --schema=prisma/schema.prisma
```

## 3. Role & Permission Seeding (Idempotent)
`packages/db/prisma/seed-enterprise.ts` uses `upsert` throughout and may be invoked safely for `RoleDefinition`, `PermissionDefinition`, default `RolePermission` grants, `CrmPipelineStage`, and `CertificateTemplate`. **In production, rotate or disable demo staff accounts** (`+201000000301`..`306`) or seed only `RoleDefinition`/`PermissionDefinition` without demo users.

## 4. Build & Deploy Sequence (Coolify Prebuilt Images)
1. Push verified tag/branch to GitHub to trigger `.github/workflows/deploy-images.yml` (builds `api`, `worker`, `web` images).
2. Run `prisma migrate deploy` prior to swapping `api`/`worker`/`web` containers.
3. Verify `/api/v1/health` returns HTTP 200, worker scheduler logs active hourly commission maturation check, and `/admin` -> `المطابقة المالية الآلي` passes `REC-01`..`REC-06`.
