# BOSLA Academy — Financial & Seller Commission Engine Report (v1.2)

## 1. Exact Monetary Arithmetic & Timezone Correctness
- **Zero Floating-Point Money Math:** `packages/shared/src/money.ts` performs all calculations in integer piasters (`0.01 EGP`), using deterministic half-up rounding (`mulDivRoundHalfUp`) and persisting all monetary columns in PostgreSQL as `DECIMAL(12, 2)`.
- **Africa/Cairo Wall-Clock & DST Math:** `packages/shared/src/cairo-time.ts` computes exact 14-day hold expiration (`addCairoCalendarDays(paidAt, 14)`) and exact monthly settlement cutoffs (`getCairoMonthBoundsUtc(year, month)` ending `23:59:59.999 Africa/Cairo`) accurately across Egyptian DST transitions.

## 2. Commission Rules & Calculation Engine (`apps/api/src/modules/finance/`)
- **Resolution Priority:**
  1. Active `Seller + Course` override rule (`seller_commission_rules` where `sellerId = order.sellerId`)
  2. Active `Course Default` rule (`sellerId = null`)
  3. **No global fallback:** Missing rule emits an audited `COMMISSION_RULE_MISSING_WARNING` and generates zero commission.
- **Non-Overlapping Effective Dates:** Overlapping active date ranges for the same `(courseId, sellerId)` are rejected with HTTP `409`.
- **Configurable Cap:** Defaults to `50.00%` of the net discounted item price (`computeCappedCommission`), reinforced by PostgreSQL `CHECK ("appliedAmount" <= "cappedAmount")`.
- **Membership Exclusion Safeguard:** Orders classified as `MONTHLY_MEMBERSHIP` or `ANNUAL_MEMBERSHIP` are blocked from generating seller commissions until written client policy approval.
- **Instructor Revenue Share Preservation:** `InstructorContract.deductSellerCommission` defaults to `false` — seller commissions do NOT auto-deduct from instructor revenue shares.

## 3. Lifecycle, Hourly Hold Maturation & Refunds
- **States:** `ON_HOLD` -> `ELIGIBLE` -> `APPROVED` -> `PAID` (plus `DISPUTED` and `REVERSED`), with immutable `commission_status_history`.
- **Hourly Maturation:** Implemented in BOTH `CommissionEngineService.runHourlyEligibilityMaturation` (NestJS scheduler + `POST /api/v1/finance/jobs/mature-commissions`) and `apps/worker/src/commission-maturation.ts` (invoked by `apps/worker/src/scheduler.ts`). Skips suspicious, refunded, cancelled, or zero-net items.
- **Refunds & Chargebacks (`RefundSettlementService.processRefund`):**
  - Uses `SELECT ... FOR UPDATE` on `orders` inside a `Serializable` transaction to defeat concurrent double-refund races (`AT-060`).
  - Full refund, chargeback, or `revokeAccess: true` revokes item entitlement (`DirectPurchase` cancelled) and reverses 100% of remaining commission.
  - Partial refund without access revocation applies proportional exact piaster reversal `(refund / netCollected) * appliedCommission` with final-refund remainder loading.
  - Refund after commission `PAID` creates an open `ReversalDebit` record deducted automatically in subsequent monthly settlements.

## 4. Maker-Checker Monthly Settlements, Payouts & Reconciliation
- **Maker-Checker (`AT-059`):** `POST /finance/settlements` (Maker) creates `DRAFT`; `POST /finance/settlements/:id/approve` (Checker) requires `approvedById !== createdById` at BOTH service and PostgreSQL `CHECK` constraint levels.
- **Anti-Duplicate Settlement Guard (`AT-058`):** Seller row lock (`FOR UPDATE`) + partial unique index `seller_payout_items_active_commission_uq (commissionId) WHERE isVoided = false`.
- **Edge Cases:**
  - Below configurable minimum payout (`500.00 EGP` default): creates `CARRIED_FORWARD` statement with `netPayableAmount = 0.00`, keeping commissions `APPROVED` for the next cycle.
  - Negative net after `ReversalDebit`: clamps `netPayableAmount` to `0.00` (`CHECK ("netPayableAmount" >= 0)`), offsets open debits up to gross, and carries remaining debit forward.
  - `PAYOUT_FAILED` (`AT-080`): voids payout items and restores commissions to `APPROVED` for **one** replacement retry (`failedPayoutRetryCount`); a second failure escalates to `DISPUTED`.
- **Accounting Controls:** Expense ledger (`FinancialExpense`), P&L & Cash Flow dashboard (`GET /finance/dashboard`), monthly period closing (`AccountingPeriodClose` freezing historical edits), 6 automated reconciliation invariants (`REC-01`..`REC-06`), and UTF-8 BOM Arabic CSV exports.
