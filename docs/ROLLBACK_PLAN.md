# BOSLA Academy — v1.2 Rollback Plan

## 1. Zero-Data-Loss Application Rollback (Preferred)
Because `0005_enterprise_v1_2_expansion` is strictly **additive and backward-compatible** with the previous v1.1 schema (all existing columns, primary keys, user IDs, courses, memberships, payments, and community tables remain untouched):
1. Roll back Coolify deployment images (`api`, `worker`, `web`) to the previous known-good Docker image tag.
2. Keep the PostgreSQL database online — older v1.1 Prisma clients ignore newly added tables and nullable/defaulted columns cleanly.
3. Verify `/api/v1/health`, `/api/v1/catalog/home`, student login, HLS video playback, and Paymob membership checkout.

## 2. Database Restore Rollback (Only if Schema/Data Corruption Occurs)
If a full point-in-time DB rollback is strictly required:
1. Place maintenance page / stop `api` and `worker` containers cleanly (do **NOT** drop Docker media volumes).
2. Restore the pre-deployment dump taken in `DEPLOYMENT_GUIDE.md`:
   ```bash
   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" bosla_pre_v1_2_YYYYMMDD_HHMMSS.dump
   ```
3. Redeploy previous v1.1 container tags and run smoke tests.

## 3. Financial Freeze Procedure (Operational Safeguard)
If a seller commission or payout anomaly is detected after launch without needing a full rollback:
- Suspend affected seller via `PATCH /api/v1/sellers/admin/:sellerId/status` (`status: "SUSPENDED"`) to freeze all settlements and payouts immediately.
- Set `DISABLE_COMMISSION_SCHEDULER=true` on `api` to pause automatic 14-day maturation while Finance audits `GET /api/v1/finance/reconciliation` and `GET /api/v1/rbac/audit-logs`.
