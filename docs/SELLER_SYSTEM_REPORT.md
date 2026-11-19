# BOSLA Academy — Affiliate / Seller System Report (v1.2)

## 1. Scope & Lifecycle
- **Supported Seller Type (v1.2):** Individual sellers only (`sellers`, `seller_applications`, `seller_codes`, `seller_referrals`, `MarketingMaterial`).
- **Lifecycle States:** `PENDING` -> `CHANGES_REQUESTED` / `APPROVED` / `REJECTED`, plus operational `SUSPENDED` / reactivation (`APPROVED`).
- **KYC & Payout Verification:** Separate flags `kycVerified` and `payoutVerified` on `Seller`. Both MUST be `true` before any monthly settlement or payout can be created or executed (`AT-073`).
- **Suspended Freeze:** Any seller in `SUSPENDED` status has codes rejected at checkout and settlements/payouts frozen (`AT-072`).

## 2. Seller Codes, Normalization & QR Generation
- Implemented in `packages/shared/src/seller-code.ts` (`parseAndNormalizeSellerCode`) and `apps/api/src/modules/sellers/sellers.service.ts`:
  - Strips internal and surrounding whitespace, converts to uppercase ASCII, validates length `4..20` alphanumeric characters (`[A-Z0-9]{4,20}`), and enforces uniqueness post-normalization (`seller_codes.code @unique`).
  - Optional `allowedCourseIds` scoping per seller code.
  - Generates shareable referral links (`/r/<CODE>`) and live downloadable SVG QR codes via `qrcode`.

## 3. Server-Side 30-Day Referral Tracking & Security Controls
- **No PII in Tracking Identifiers:** `POST /api/v1/sellers/referrals/track` creates an opaque 24-byte random base64url `trackingToken` stored in `seller_referrals` with 30-day expiry and sets an `HttpOnly`, `SameSite=Lax` cookie `bosla_ref`.
- **Checkout Attribution Precedence:**
  1. Manual seller code entry overrides any referral prefill.
  2. Otherwise, last valid non-expired referral prefills checkout unless buyer explicitly clears it (`clearSellerPrefill: true`).
  3. Attribution only persists when a valid code is applied to the order (`orders.sellerId` / `sellerCodeId` / `sellerCodeSnapshot`).
- **Anti-Enumeration Rate Limiting (`AT-071`):** Maximum **5 invalid seller code attempts per 60 seconds** per IP+user via `RedisService.incrementRateLimit`, returning a uniform error message (`كود البائع غير صالح أو غير متاح حالياً`) and HTTP `429` on the 6th failure.
- **Self-Purchase Prevention (`AT-012`):** Blocks attribution when buyer matches seller by `userId`, normalized `email`, or normalized `phoneE164`, logging `SELF_PURCHASE_BLOCKED` in `AuditLog`.
- **Suspicious Behavior Flagging (`AT-013`):** Shared `deviceFingerprint` between buyer and seller flags `Order.isFlaggedSuspicious = true`, blocking automatic 14-day commission maturation until manual finance clearance.

## 4. Seller Portal (`/seller`) & Strict Isolation (`AT-061`)
- Built in `apps/web/src/app/seller/page.tsx` inside `DashboardShell` (responsive Arabic RTL).
- Every Seller Portal endpoint (`GET /api/v1/sellers/portal`, `GET /api/v1/sellers/portal/payouts/:payoutId`, `GET /api/v1/sellers/codes/:codeId/qr`) resolves seller ownership exclusively from the authenticated session (`user.id`) and rejects cross-seller access with HTTP `403`.
