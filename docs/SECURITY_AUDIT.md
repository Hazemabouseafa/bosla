# BOSLA Academy — Enterprise v1.2 Security Audit Report

## 1. Access Control & Privilege Separation
- **Multi-Role & Fine-Grained RBAC:** Verified via `SessionAuthGuard` + `RolesGuard` (`apps/api/src/core/guards.ts`, `apps/api/src/core/rbac-resolver.ts`). All 34 granular permissions are enforced at API route level and stored in PostgreSQL (`RoleDefinition`, `PermissionDefinition`, `RolePermission`, `UserRoleAssignment`).
- **Support Separation:** `SUPPORT` is strictly blocked from acquiring `settlements.approve` or `settlements.payout` even through the RBAC update endpoint (`400 Bad Request`), and receives `403 Forbidden` on Finance endpoints (`AT-001`..`AT-005`).
- **Maker-Checker Control (`AT-059`):** Enforced both in `RefundSettlementService.approveSettlement` (`403 Forbidden`) AND at the PostgreSQL layer (`CHECK ("approvedById" IS NULL OR "approvedById" <> "createdById")`). Changing user roles cannot bypass this constraint.
- **Tenant & Owner Isolation (`AT-061`):**
  - Sellers resolve strictly from `user.id`; cross-seller QR/payout reads return `403`.
  - B2B `ORG_ADMIN`s are restricted strictly to their assigned `organizationId`; cross-org dashboard access returns `403`.
  - Students only access their own orders/invoices and their own support tickets with `isInternalNote: false` enforced at the Prisma query layer.

## 2. Anti-Abuse, Anti-Enumeration & Fraud Controls
- **Seller Code Anti-Enumeration (`AT-071`):** Rate limited at **5 invalid attempts per 60 seconds** per IP+user using `RedisService.incrementRateLimit`, emitting uniform Arabic error text (`كود البائع غير صالح أو غير متاح حالياً`) and HTTP `429 Too Many Requests` on the 6th attempt.
- **No PII in Referral Tracking:** `bosla_ref` cookie is `HttpOnly`, `SameSite=Lax`, and carries only a 24-byte random opaque server token (`trackingToken`), never user data or raw seller code.
- **Self-Purchase Blocking (`AT-012`):** Cross-checks `userId`, normalized `email`, and normalized `phoneE164`, blocking attribution and recording `SELF_PURCHASE_BLOCKED` in `AuditLog`.
- **Suspicious Behavior Flagging (`AT-013`):** Shared `deviceFingerprint` between buyer and seller flags `Order.isFlaggedSuspicious`, holding commissions from automatic 14-day maturation until manual financial review.

## 3. Financial Concurrency & Integrity Guards
- **PostgreSQL `Serializable` + Row Locks (`FOR UPDATE`):** Protects `settleExternalOrderPayment`, `recordManualPayment`, `processRefund`, and `createMonthlySettlement` against race conditions (`AT-056`, `AT-057`, `AT-058`, `AT-060`).
- **DB-Level Constraints (`0005_enterprise_v1_2_expansion/migration.sql`):**
  - `payments.externalTxId @unique`
  - `seller_commissions.orderItemId @unique`
  - `seller_payout_items_active_commission_uq` partial unique index (`WHERE "isVoided" = false`)
  - `seller_commissions_cap_check`, `seller_payouts_maker_checker_chk`, `seller_payouts_non_negative_chk`, `payment_allocations_non_negative_chk`
- **Accounting Period Immutability:** `AccountingPeriodClose` blocks retroactive expenses or financial adjustments dated within closed months (`403 Forbidden`).

## 4. Input, Attachment, Session & Webhook Security
- **HMAC-SHA512 Payment Webhooks:** Verified with constant-time comparison (`timingSafeEqual`) via `PaymobClient.verifyTransactionHmac`.
- **CSRF Protection:** All mutating authenticated endpoints enforce `CsrfGuard` (`X-CSRF-Token`).
- **Attachment MIME & Path Allowlist:** Support ticket attachments reject `..` traversal, disallowed URL prefixes, and any MIME type outside `image/png`, `image/jpeg`, `image/webp`, `application/pdf`.
- **Preserved Non-OTP Auth:** Google OIDC, Phone + Argon2id + mandatory WebAuthn Passkeys, and non-OTP recovery codes remain fully operational (`api.integration.test.ts` Tests #2 & #3, `bosla.spec.ts` Test #2).
- **Zero External Payment Brand Leakage in UI:** Verified by automated Playwright assertion that `paymob` does not appear anywhere in customer checkout UI.
