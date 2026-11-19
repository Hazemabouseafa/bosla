# BOSLA Academy — E-Commerce, Cart, Multi-Course Orders & Payments Report (v1.2)

## 1. Key Modules Implemented
- **Backend:** `apps/api/src/modules/commerce/` (`commerce.service.ts`, `commerce.controller.ts`, `commerce.module.ts`)
- **Database Tables:** `CartItem`, `Coupon`, `orders`, `order_items`, `payments`, `payment_allocations`
- **Frontend:** `/cart` (`apps/web/src/app/cart/page.tsx`) & `/r/[code]` (`apps/web/src/app/r/[code]/page.tsx`)

## 2. Capabilities Delivered
- **Shopping Cart & Multi-Course Orders:** Students may purchase a single course or bundle multiple courses into one `Order` preserving deterministic `order_items.sortOrder`.
- **Coupons Engine:** Percentage or fixed-amount coupons with optional minimum order, max discount cap, single-course scope, usage limit, and validity dates. Discounts distribute proportionally across eligible items in exact integer piasters (no negative totals, no coupon stacking).
- **Payment Methods & UI Brand Compliance:** Supports electronic card & electronic wallet checkout (using existing internal Paymob gateway client while **strictly omitting any "Paymob" text from customer-facing UI**), bank transfers, manual cash, offline training payments, and B2B institutional payments.
- **Sequential & Manual Payment Allocations (`payment_allocations`):**
  - Partial installment payments allocate sequentially across `order_items` in `sortOrder` order.
  - Course access (`DirectPurchase` + `CourseEnrollment`) and seller commissions trigger per item as soon as that item reaches 100% allocated payment.
  - Finance Officers with `payments.allocate_manual` may manually override payment allocations (`POST /api/v1/commerce/admin/payments/:paymentId/allocations/override`) with mandatory audit reason.
- **Idempotent Electronic Webhook Settlement (`AT-056`):** HMAC-SHA512 verified (`PaymobClient.verifyTransactionHmac`), row-locked on `orders`, unique-constrained on `payments.externalTxId`, safely converting parallel duplicate deliveries into idempotent no-ops.
- **Admin Attribution Override:** Authorized managers may adjust seller attribution before commission payout with mandatory reason and immutable audit entry.
- **Accounting Classification & Invoices:** Distinguishes `COURSE_PURCHASE`, `MONTHLY_MEMBERSHIP`, and `ANNUAL_MEMBERSHIP`; exposes structured printable Arabic invoices at `GET /api/v1/commerce/orders/:orderId/invoice`.
