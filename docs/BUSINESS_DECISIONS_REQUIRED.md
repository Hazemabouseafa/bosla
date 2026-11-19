# Business Decisions & Policy Sign-Offs Required Before Production Launch

This document tracks commercial, legal, taxonomic, and financial items from Client Requirements v1.2 where either a specification conflict exists or formal written approval from BOSLA leadership / accounting / legal counsel is mandatory prior to enabling production behavior.

---

## 1. Subscription Seller Commissions (Monthly & Annual Memberships)
- **Status:** **DISABLED / PENDING WRITTEN DECISION**
- **Reference:** Master Prompt §6 ("Important Business Conflict") & Checklist v1.2 §3.
- **Detail:** Client v1.2 defines **fixed-amount per-course** commissions (`COURSE_PURCHASE`). It does **not** finalize commission rules (fixed amount vs. percentage, initial vs. recurring renewals, attribution persistence, or churn/refund clawback) for academy-wide `MONTHLY_MEMBERSHIP` or `ANNUAL_MEMBERSHIP` plans.
- **Implemented Safeguard:** All orders and ledger classifications distinguish `COURSE_PURCHASE`, `MONTHLY_MEMBERSHIP`, and `ANNUAL_MEMBERSHIP`. Membership orders are accounted under platform membership revenue and **never generate seller commissions** automatically. Setting/unblocking subscription commissions requires an explicit written client decision before adding a rule type.

## 2. Partial Refund Commission Reversal Sign-Off (Checklist v1.2 §3)
- **Status:** **IMPLEMENTED AS PROPORTIONAL PER v1.2 — AWAITING FORMAL SIGNATURE**
- **Detail:** Section 3 of v1.2 marks the proportional reversal policy (`☒ عكس العمولة بنسبة المبلغ المسترد`) as adopted pending BOSLA representative signature at the end of §3:
  - Partial refund reverses `(refundedAmount / netCollectedForItem) * appliedCommission`, rounded to `0.01 EGP`, with the final refund loading any rounding delta so total reversals equal full commission when 100% refunded.
  - Revoking course access or reaching 100% net refund reverses 100% of remaining commission immediately.
- **Action Required:** Client signature on Checklist v1.2 §3 sign-off block before live seller payouts.

## 3. Content Taxonomy Naming ("Programs" vs. Courses / Learning Paths / Diplomas)
- **Status:** **RESOLVED TO EXISTING 3-ENTITY TAXONOMY**
- **Reference:** Master Prompt §13.
- **Detail:** Client documentation frequently uses the Arabic label "البرامج" ("programs") generically, whereas the approved BOSLA platform architecture restricts catalog entities strictly to `COURSE`, `LEARNING_PATH`, and `DIPLOMA`.
- **Resolution:** Existing entities are preserved without creating an independent `Program` table. Delivery modes (`ONLINE`, `OFFLINE`, `HYBRID`), schedules, venues, capacities, and waitlists are modeled on `Course` and `TrainingSession` / `TrainingCohort`.

## 4. Seller Commissions & Instructor Revenue Share Deduction
- **Status:** **NO AUTOMATIC DEDUCTION (CONTRACT-OPT-IN ONLY)**
- **Reference:** Checklist v1.2 §3 ("العلاقة مع مستحقات المدرب") & Master Prompt §10.
- **Detail:** Seller commissions are treated as an academy marketing/sales cost by default and are **NOT** subtracted from instructor revenue shares. `InstructorContract.deductSellerCommission` defaults to `false` and only deducts if explicitly enabled on an approved contract record.

## 5. Tax Treatment & Individual Seller KYC / Privacy Notice Review
- **Status:** **PENDING ACCOUNTANT & LEGAL COUNSEL REVIEW**
- **Reference:** Checklist v1.2 §3 ("المعالجة الضريبية للبائعين الأفراد...") & §8.
- **Detail:** Tax withholding rates/declarations for individual Egyptian affiliates/sellers and cookie/referral disclosure clauses on `/privacy` require formal sign-off by BOSLA's external accountant and legal advisor before production activation.

## 6. Excluded Third-Party Integrations (Section 15)
- **Status:** **OUT OF SCOPE**
- **Detail:** Tally forms, WhatsApp Business API, Zoom API, Google Meet API, External Accounting software, Google Analytics, Meta Pixel, and external transactional email providers are intentionally omitted. Internal CRM, CSV exports, manual live meeting URLs, internal notification center, and webhook/API extension points are implemented in their place.

## 7. Statutory Tax Compliance & Official Accreditation Claims
- **Status:** **POLICY REVIEW REQUIRED**
- **Detail:** Internal ledger, revenue, refund, expense, and P&L calculations distinguish accounting recognition from cash collection for internal operational control, and do **not** claim statutory Egyptian tax authority compliance or external government/syndicate accreditation without official documentation and accreditation registration.
