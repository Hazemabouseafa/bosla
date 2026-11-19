-- CreateEnum
CREATE TYPE "SellerApplicationStatus" AS ENUM ('PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('BANK_TRANSFER', 'INSTAPAY', 'VODAFONE_CASH', 'WALLET');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "AccountingClassification" AS ENUM ('COURSE_PURCHASE', 'MONTHLY_MEMBERSHIP', 'ANNUAL_MEMBERSHIP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('PAYMOB_CARD', 'PAYMOB_WALLET', 'BANK_TRANSFER', 'MANUAL_CASH', 'OFFLINE_TRAINING', 'INSTITUTIONAL');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ON_HOLD', 'ELIGIBLE', 'APPROVED', 'PAID', 'DISPUTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "PayoutSettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'FAILED', 'CANCELLED', 'CARRIED_FORWARD');

-- CreateEnum
CREATE TYPE "InstructorApprovalStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('COMPANY', 'UNIVERSITY');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('ORG_ADMIN', 'LEARNER');

-- CreateEnum
CREATE TYPE "TrainingSessionType" AS ENUM ('ONLINE_LIVE', 'OFFLINE_CLASS', 'HYBRID');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'WRITTEN');

-- CreateEnum
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RESUBMIT_REQUESTED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('TECHNICAL', 'BILLING', 'CONTENT', 'CERTIFICATES', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ORDER_PAYMENT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_REFUND_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_STATUS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_STATEMENT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'TRAINING_SESSION_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_GRADED';
ALTER TYPE "NotificationType" ADD VALUE 'CERTIFICATE_ISSUED_NOTIFY';
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_TICKET_UPDATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'ACADEMY_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'TRAINING_COORDINATOR';
ALTER TYPE "UserRole" ADD VALUE 'FINANCE_OFFICER';
ALTER TYPE "UserRole" ADD VALUE 'AFFILIATE_SELLER';
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT';

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "reissueCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "accessDurationDays" INTEGER,
ADD COLUMN     "availabilityEndAt" TIMESTAMP(3),
ADD COLUMN     "availabilityStartAt" TIMESTAMP(3),
ADD COLUMN     "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "maxCapacity" INTEGER,
ADD COLUMN     "venueAddressAr" TEXT,
ADD COLUMN     "venueNameAr" TEXT,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LeadSubmission" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "interestedCourseId" TEXT,
ADD COLUMN     "pipelineStageKey" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "accountingType" "AccountingClassification" NOT NULL DEFAULT 'MONTHLY_MEMBERSHIP';

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "manualGradedById" TEXT,
ADD COLUMN     "manualGradingRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualScoreNotes" TEXT;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "questionBankItemId" TEXT,
ADD COLUMN     "questionType" "QuestionType" NOT NULL DEFAULT 'MCQ';

-- CreateTable
CREATE TABLE "RoleDefinition" (
    "id" TEXT NOT NULL,
    "code" "UserRole" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "email" TEXT,
    "nationalIdNumber" TEXT NOT NULL,
    "idDocumentUrl" TEXT NOT NULL,
    "experienceSummaryAr" TEXT NOT NULL,
    "marketingChannelsAr" TEXT,
    "payoutMethodType" "PayoutMethodType" NOT NULL,
    "payoutAccountName" TEXT NOT NULL,
    "payoutAccountDetails" TEXT NOT NULL,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "payoutVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "suspensionReasonAr" TEXT,
    "minPayoutAmount" DECIMAL(12,2) NOT NULL DEFAULT 500.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_applications" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedData" JSONB NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotesAr" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_codes" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "allowedCourseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_referrals" (
    "id" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerCodeId" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "userId" TEXT,
    "landingPath" TEXT NOT NULL DEFAULT '/',
    "sourceTag" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingMaterial" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'COPY',
    "assetUrl" TEXT,
    "copyTextAr" TEXT,
    "courseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(12,2),
    "minOrderAmount" DECIMAL(12,2),
    "applicableCourseId" TEXT,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountingType" "AccountingClassification" NOT NULL DEFAULT 'COURSE_PURCHASE',
    "membershipPlanId" TEXT,
    "organizationId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "couponId" TEXT,
    "couponCodeSnapshot" TEXT,
    "sellerId" TEXT,
    "sellerCodeId" TEXT,
    "sellerCodeSnapshot" TEXT,
    "referralId" TEXT,
    "attributionOverriddenById" TEXT,
    "attributionOverrideReason" TEXT,
    "isFlaggedSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "deviceFingerprint" TEXT,
    "notesAr" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseTitleSnapshotAr" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "allocatedPaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "entitlementGrantedAt" TIMESTAMP(3),
    "entitlementRevokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethod" "PaymentChannel" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "externalTxId" TEXT,
    "receiptReference" TEXT,
    "bankName" TEXT,
    "proofUrl" TEXT,
    "recordedById" TEXT,
    "notesAr" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overriddenById" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_commission_rules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sellerId" TEXT,
    "fixedAmount" DECIMAL(12,2) NOT NULL,
    "capPercent" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_commissions" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerCodeId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ruleId" TEXT,
    "itemNetPrice" DECIMAL(12,2) NOT NULL,
    "allocatedPaidAmount" DECIMAL(12,2) NOT NULL,
    "configuredAmount" DECIMAL(12,2) NOT NULL,
    "capPercent" DECIMAL(5,2) NOT NULL,
    "cappedAmount" DECIMAL(12,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL,
    "reversedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ON_HOLD',
    "holdStartsAt" TIMESTAMP(3) NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "disputedReason" TEXT,
    "warningNote" TEXT,
    "failedPayoutRetryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_status_history" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "fromStatus" "CommissionStatus",
    "toStatus" "CommissionStatus" NOT NULL,
    "changedById" TEXT,
    "reasonAr" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "paymentId" TEXT,
    "refundType" "RefundType" NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "commissionReversedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revokeAccess" BOOLEAN NOT NULL DEFAULT false,
    "reasonAr" TEXT NOT NULL,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReversalDebit" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "refundId" TEXT,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "settledAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "reasonAr" TEXT NOT NULL,
    "settledPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReversalDebit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodStartUtc" TIMESTAMP(3) NOT NULL,
    "periodEndUtc" TIMESTAMP(3) NOT NULL,
    "grossCommissionAmount" DECIMAL(12,2) NOT NULL,
    "reversalDebitDeducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayableAmount" DECIMAL(12,2) NOT NULL,
    "carriedForwardAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PayoutSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "transferReference" TEXT,
    "paymentProofUrl" TEXT,
    "failureReasonAr" TEXT,
    "notesAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payout_items" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payout_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_adjustments" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "payoutId" TEXT,
    "commissionId" TEXT,
    "orderId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reasonAr" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialExpense" (
    "id" TEXT NOT NULL,
    "categoryAr" TEXT NOT NULL,
    "courseId" TEXT,
    "descriptionAr" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "receiptRef" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriodClose" (
    "id" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodStartUtc" TIMESTAMP(3) NOT NULL,
    "periodEndUtc" TIMESTAMP(3) NOT NULL,
    "recognizedRevenue" DECIMAL(12,2) NOT NULL,
    "cashCollected" DECIMAL(12,2) NOT NULL,
    "totalRefunds" DECIMAL(12,2) NOT NULL,
    "totalCommissions" DECIMAL(12,2) NOT NULL,
    "totalInstructorShares" DECIMAL(12,2) NOT NULL,
    "totalExpenses" DECIMAL(12,2) NOT NULL,
    "netProfit" DECIMAL(12,2) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notesAr" TEXT,

    CONSTRAINT "AccountingPeriodClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "cvUrl" TEXT,
    "approvalStatus" "InstructorApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "reviewNotesAr" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorContract" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "defaultSharePercent" DECIMAL(5,2) NOT NULL,
    "deductSellerCommission" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmPipelineStage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "colorHex" TEXT NOT NULL DEFAULT '#6C4DF6',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "budgetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "spendAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "couponId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notesAr" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "activityType" TEXT NOT NULL,
    "summaryAr" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'COMPANY',
    "taxNumber" TEXT,
    "contactNameAr" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "seatCapacity" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgRole" "OrgMemberRole" NOT NULL DEFAULT 'LEARNER',
    "departmentAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCohort" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "organizationId" TEXT,
    "titleAr" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxSeats" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortEnrollment" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrolledById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "quotationAmount" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "assignedCourseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseWaitlist" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cohortId" TEXT,
    "instructorId" TEXT,
    "titleAr" TEXT NOT NULL,
    "sessionType" "TrainingSessionType" NOT NULL DEFAULT 'ONLINE_LIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "venueAr" TEXT,
    "manualMeetingUrl" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notesAr" TEXT,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankCategory" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "courseId" TEXT,
    "questionType" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "promptAr" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "explanationAr" TEXT,
    "defaultPoints" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "titleAr" TEXT NOT NULL,
    "instructionsAr" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "dueAt" TIMESTAMP(3),
    "isPracticalProject" BOOLEAN NOT NULL DEFAULT false,
    "rubric" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionTextAr" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" INTEGER,
    "rubricScores" JSONB,
    "feedbackAr" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "kind" "CertificateKind" NOT NULL DEFAULT 'ATTENDANCE_COMPLETION',
    "headlineAr" TEXT NOT NULL,
    "bodyTemplateAr" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#6C4DF6',
    "accentColor" TEXT NOT NULL DEFAULT '#F5B841',
    "logoUrl" TEXT,
    "signatureNameAr" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateReissueLog" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reasonAr" TEXT NOT NULL,
    "reissuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateReissueLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subjectAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "satisfactionRating" INTEGER,
    "satisfactionCommentAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "attachmentUrl" TEXT,
    "attachmentMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleDefinition_code_key" ON "RoleDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionDefinition_code_key" ON "PermissionDefinition"("code");

-- CreateIndex
CREATE INDEX "PermissionDefinition_module_idx" ON "PermissionDefinition"("module");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_userId_key" ON "sellers"("userId");

-- CreateIndex
CREATE INDEX "sellers_status_createdAt_idx" ON "sellers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sellers_phoneE164_idx" ON "sellers"("phoneE164");

-- CreateIndex
CREATE INDEX "seller_applications_sellerId_createdAt_idx" ON "seller_applications"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "seller_applications_status_createdAt_idx" ON "seller_applications"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "seller_codes_code_key" ON "seller_codes"("code");

-- CreateIndex
CREATE INDEX "seller_codes_sellerId_isActive_idx" ON "seller_codes"("sellerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "seller_referrals_trackingToken_key" ON "seller_referrals"("trackingToken");

-- CreateIndex
CREATE INDEX "seller_referrals_sellerId_createdAt_idx" ON "seller_referrals"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "seller_referrals_userId_expiresAt_idx" ON "seller_referrals"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "seller_referrals_expiresAt_idx" ON "seller_referrals"("expiresAt");

-- CreateIndex
CREATE INDEX "MarketingMaterial_isActive_createdAt_idx" ON "MarketingMaterial"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "CartItem_userId_addedAt_idx" ON "CartItem"("userId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_courseId_key" ON "CartItem"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_validFrom_idx" ON "Coupon"("isActive", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_userId_status_createdAt_idx" ON "orders"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_sellerId_status_createdAt_idx" ON "orders"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_accountingType_createdAt_idx" ON "orders"("accountingType", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_paidAt_idx" ON "orders"("status", "paidAt");

-- CreateIndex
CREATE INDEX "order_items_courseId_createdAt_idx" ON "order_items"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_courseId_key" ON "order_items"("orderId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_externalTxId_key" ON "payments"("externalTxId");

-- CreateIndex
CREATE INDEX "payments_orderId_status_createdAt_idx" ON "payments"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_allocations_orderId_createdAt_idx" ON "payment_allocations"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_allocations_orderItemId_idx" ON "payment_allocations"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_orderItemId_key" ON "payment_allocations"("paymentId", "orderItemId");

-- CreateIndex
CREATE INDEX "seller_commission_rules_courseId_sellerId_isActive_effectiv_idx" ON "seller_commission_rules"("courseId", "sellerId", "isActive", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "seller_commissions_orderItemId_key" ON "seller_commissions"("orderItemId");

-- CreateIndex
CREATE INDEX "seller_commissions_sellerId_status_eligibleAt_idx" ON "seller_commissions"("sellerId", "status", "eligibleAt");

-- CreateIndex
CREATE INDEX "seller_commissions_status_eligibleAt_idx" ON "seller_commissions"("status", "eligibleAt");

-- CreateIndex
CREATE INDEX "seller_commissions_orderId_idx" ON "seller_commissions"("orderId");

-- CreateIndex
CREATE INDEX "commission_status_history_commissionId_createdAt_idx" ON "commission_status_history"("commissionId", "createdAt");

-- CreateIndex
CREATE INDEX "refunds_orderId_createdAt_idx" ON "refunds"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReversalDebit_sellerId_remainingAmount_idx" ON "ReversalDebit"("sellerId", "remainingAmount");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_settlementNumber_key" ON "seller_payouts"("settlementNumber");

-- CreateIndex
CREATE INDEX "seller_payouts_sellerId_periodYear_periodMonth_idx" ON "seller_payouts"("sellerId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "seller_payouts_status_createdAt_idx" ON "seller_payouts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "seller_payout_items_payoutId_idx" ON "seller_payout_items"("payoutId");

-- CreateIndex
CREATE INDEX "seller_payout_items_commissionId_isVoided_idx" ON "seller_payout_items"("commissionId", "isVoided");

-- CreateIndex
CREATE INDEX "financial_adjustments_sellerId_createdAt_idx" ON "financial_adjustments"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialExpense_incurredAt_idx" ON "FinancialExpense"("incurredAt");

-- CreateIndex
CREATE INDEX "FinancialExpense_courseId_idx" ON "FinancialExpense"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriodClose_periodYear_periodMonth_key" ON "AccountingPeriodClose"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_userId_key" ON "InstructorProfile"("userId");

-- CreateIndex
CREATE INDEX "InstructorContract_instructorId_isActive_endDate_idx" ON "InstructorContract"("instructorId", "isActive", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "CrmPipelineStage_key_key" ON "CrmPipelineStage"("key");

-- CreateIndex
CREATE INDEX "MarketingCampaign_startDate_idx" ON "MarketingCampaign"("startDate");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadActivity_dueAt_idx" ON "LeadActivity"("dueAt");

-- CreateIndex
CREATE INDEX "Organization_isActive_createdAt_idx" ON "Organization"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "TrainingCohort_courseId_startsAt_idx" ON "TrainingCohort"("courseId", "startsAt");

-- CreateIndex
CREATE INDEX "TrainingCohort_organizationId_idx" ON "TrainingCohort"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortEnrollment_cohortId_userId_key" ON "CohortEnrollment"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationContract_contractNumber_key" ON "OrganizationContract"("contractNumber");

-- CreateIndex
CREATE INDEX "OrganizationContract_organizationId_status_idx" ON "OrganizationContract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CourseWaitlist_courseId_position_idx" ON "CourseWaitlist"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourseWaitlist_courseId_userId_key" ON "CourseWaitlist"("courseId", "userId");

-- CreateIndex
CREATE INDEX "TrainingSession_courseId_startsAt_idx" ON "TrainingSession"("courseId", "startsAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_userId_key" ON "AttendanceRecord"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankCategory_nameAr_key" ON "QuestionBankCategory"("nameAr");

-- CreateIndex
CREATE INDEX "QuestionBankItem_courseId_questionType_idx" ON "QuestionBankItem"("courseId", "questionType");

-- CreateIndex
CREATE INDEX "Assignment_courseId_createdAt_idx" ON "Assignment"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_status_createdAt_idx" ON "AssignmentSubmission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_key_key" ON "CertificateTemplate"("key");

-- CreateIndex
CREATE INDEX "CertificateReissueLog_certificateId_reissuedAt_idx" ON "CertificateReissueLog"("certificateId", "reissuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_status_createdAt_idx" ON "SupportTicket"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedAgentId_status_idx" ON "SupportTicket"("assignedAgentId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_slaDueAt_idx" ON "SupportTicket"("status", "priority", "slaDueAt");

-- CreateIndex
CREATE INDEX "SupportTicketReply_ticketId_createdAt_idx" ON "SupportTicketReply"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadSubmission_pipelineStageKey_createdAt_idx" ON "LeadSubmission"("pipelineStageKey", "createdAt");

-- CreateIndex
CREATE INDEX "LeadSubmission_phoneE164_idx" ON "LeadSubmission"("phoneE164");

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_manualGradedById_fkey" FOREIGN KEY ("manualGradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_interestedCourseId_fkey" FOREIGN KEY ("interestedCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PermissionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_codes" ADD CONSTRAINT "seller_codes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_referrals" ADD CONSTRAINT "seller_referrals_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_referrals" ADD CONSTRAINT "seller_referrals_sellerCodeId_fkey" FOREIGN KEY ("sellerCodeId") REFERENCES "seller_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_referrals" ADD CONSTRAINT "seller_referrals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMaterial" ADD CONSTRAINT "MarketingMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_applicableCourseId_fkey" FOREIGN KEY ("applicableCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerCodeId_fkey" FOREIGN KEY ("sellerCodeId") REFERENCES "seller_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "seller_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_attributionOverriddenById_fkey" FOREIGN KEY ("attributionOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commission_rules" ADD CONSTRAINT "seller_commission_rules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commission_rules" ADD CONSTRAINT "seller_commission_rules_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commission_rules" ADD CONSTRAINT "seller_commission_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_sellerCodeId_fkey" FOREIGN KEY ("sellerCodeId") REFERENCES "seller_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "seller_commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_status_history" ADD CONSTRAINT "commission_status_history_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "seller_commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_status_history" ADD CONSTRAINT "commission_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReversalDebit" ADD CONSTRAINT "ReversalDebit_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReversalDebit" ADD CONSTRAINT "ReversalDebit_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "seller_commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReversalDebit" ADD CONSTRAINT "ReversalDebit_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReversalDebit" ADD CONSTRAINT "ReversalDebit_settledPayoutId_fkey" FOREIGN KEY ("settledPayoutId") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payout_items" ADD CONSTRAINT "seller_payout_items_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "seller_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payout_items" ADD CONSTRAINT "seller_payout_items_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "seller_commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "seller_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialExpense" ADD CONSTRAINT "FinancialExpense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodClose" ADD CONSTRAINT "AccountingPeriodClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorContract" ADD CONSTRAINT "InstructorContract_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorContract" ADD CONSTRAINT "InstructorContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCohort" ADD CONSTRAINT "TrainingCohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCohort" ADD CONSTRAINT "TrainingCohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEnrollment" ADD CONSTRAINT "CohortEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "TrainingCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEnrollment" ADD CONSTRAINT "CohortEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEnrollment" ADD CONSTRAINT "CohortEnrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationContract" ADD CONSTRAINT "OrganizationContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationContract" ADD CONSTRAINT "OrganizationContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseWaitlist" ADD CONSTRAINT "CourseWaitlist_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseWaitlist" ADD CONSTRAINT "CourseWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "TrainingCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "QuestionBankCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateReissueLog" ADD CONSTRAINT "CertificateReissueLog_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateReissueLog" ADD CONSTRAINT "CertificateReissueLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================
-- Enterprise v1.2 Database-Level Financial & Anti-Race Guards
-- ============================================================

-- AT-058 & AT-080: Prevent simultaneous duplicate active payout settlements for the same commission,
-- while allowing a single replacement settlement after a PAYOUT_FAILED item is voided.
CREATE UNIQUE INDEX IF NOT EXISTS "seller_payout_items_active_commission_uq"
  ON "seller_payout_items" ("commissionId")
  WHERE "isVoided" = false;

-- Enforce commission ceiling and non-negative balances at PostgreSQL layer
ALTER TABLE "seller_commissions"
  ADD CONSTRAINT "seller_commissions_cap_check"
  CHECK ("appliedAmount" >= 0 AND "appliedAmount" <= "cappedAmount" AND "reversedAmount" >= 0 AND "netAmount" >= 0);

ALTER TABLE "seller_commission_rules"
  ADD CONSTRAINT "seller_commission_rules_non_negative_chk"
  CHECK ("fixedAmount" >= 0 AND "capPercent" > 0 AND "capPercent" <= 100);

-- AT-059: Maker-Checker strict DB separation (approver must differ from creator)
ALTER TABLE "seller_payouts"
  ADD CONSTRAINT "seller_payouts_maker_checker_chk"
  CHECK ("approvedById" IS NULL OR "approvedById" <> "createdById");

-- AT-079: Never emit negative cash payout amounts
ALTER TABLE "seller_payouts"
  ADD CONSTRAINT "seller_payouts_non_negative_chk"
  CHECK ("netPayableAmount" >= 0 AND "carriedForwardAmount" >= 0);

-- Payment allocations must never be negative
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_non_negative_chk"
  CHECK ("allocatedAmount" >= 0);
