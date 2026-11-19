-- AlterEnum
ALTER TYPE "PaymentTargetType" ADD VALUE IF NOT EXISTS 'COURSE';
ALTER TYPE "PaymentTargetType" ADD VALUE IF NOT EXISTS 'LEARNING_PATH';
ALTER TYPE "PaymentTargetType" ADD VALUE IF NOT EXISTS 'DIPLOMA';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPETENCY_CERTIFICATE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPETENCY_CERTIFICATE_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIBER_QUESTION_ANSWERED';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CertificateKind" AS ENUM ('ATTENDANCE_COMPLETION', 'COMPETENCY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CompetencyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinancialLedgerEntryType" AS ENUM ('CREDIT_PURCHASE', 'CREDIT_SUBSCRIPTION_ALLOCATION', 'DEBIT_INSTRUCTOR_SHARE', 'DEBIT_REFUND', 'ADMIN_ADJUSTMENT', 'INSTRUCTOR_PAYOUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Course
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "priceCents" INTEGER NOT NULL DEFAULT 45000,
  ADD COLUMN IF NOT EXISTS "compareAtPriceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS "includedInMembership" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowIndividualPurchase" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable LearningPath
ALTER TABLE "LearningPath"
  ADD COLUMN IF NOT EXISTS "priceCents" INTEGER NOT NULL DEFAULT 95000,
  ADD COLUMN IF NOT EXISTS "compareAtPriceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS "includedInMembership" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowIndividualPurchase" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Diploma
ALTER TABLE "Diploma"
  ADD COLUMN IF NOT EXISTS "priceCents" INTEGER NOT NULL DEFAULT 180000,
  ADD COLUMN IF NOT EXISTS "compareAtPriceCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS "includedInMembership" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowIndividualPurchase" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable CourseReview
ALTER TABLE "CourseReview"
  ADD COLUMN IF NOT EXISTS "instructorId" TEXT,
  ADD COLUMN IF NOT EXISTS "learningPathId" TEXT,
  ADD COLUMN IF NOT EXISTS "diplomaId" TEXT,
  ADD COLUMN IF NOT EXISTS "instructorRating" INTEGER;

CREATE INDEX IF NOT EXISTS "CourseReview_instructorId_isPublished_idx" ON "CourseReview"("instructorId", "isPublished");

-- AlterTable PaymentTransaction
ALTER TABLE "PaymentTransaction"
  ADD COLUMN IF NOT EXISTS "courseId" TEXT,
  ADD COLUMN IF NOT EXISTS "learningPathId" TEXT,
  ADD COLUMN IF NOT EXISTS "diplomaId" TEXT;

-- AlterTable Certificate
ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "kind" "CertificateKind" NOT NULL DEFAULT 'ATTENDANCE_COMPLETION',
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

CREATE INDEX IF NOT EXISTS "Certificate_userId_kind_idx" ON "Certificate"("userId", "kind");

-- CreateTable DirectPurchase
CREATE TABLE IF NOT EXISTS "DirectPurchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" "CertificateTargetType" NOT NULL DEFAULT 'COURSE',
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "paymentTransactionId" TEXT,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DirectPurchase_paymentTransactionId_key" ON "DirectPurchase"("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "DirectPurchase_userId_status_idx" ON "DirectPurchase"("userId", "status");
CREATE INDEX IF NOT EXISTS "DirectPurchase_courseId_status_idx" ON "DirectPurchase"("courseId", "status");
CREATE INDEX IF NOT EXISTS "DirectPurchase_learningPathId_status_idx" ON "DirectPurchase"("learningPathId", "status");
CREATE INDEX IF NOT EXISTS "DirectPurchase_diplomaId_status_idx" ON "DirectPurchase"("diplomaId", "status");

-- CreateTable ProgramInstructorAssignment
CREATE TABLE IF NOT EXISTS "ProgramInstructorAssignment" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "targetType" "CertificateTargetType" NOT NULL DEFAULT 'COURSE',
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "roleTitleAr" TEXT NOT NULL DEFAULT 'مدرب مشارك',
  "revenueSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramInstructorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramInstructorAssignment_instructorId_targetType_idx" ON "ProgramInstructorAssignment"("instructorId", "targetType");
CREATE INDEX IF NOT EXISTS "ProgramInstructorAssignment_courseId_idx" ON "ProgramInstructorAssignment"("courseId");
CREATE INDEX IF NOT EXISTS "ProgramInstructorAssignment_learningPathId_idx" ON "ProgramInstructorAssignment"("learningPathId");
CREATE INDEX IF NOT EXISTS "ProgramInstructorAssignment_diplomaId_idx" ON "ProgramInstructorAssignment"("diplomaId");

-- CreateTable ProgramFinancialAccount
CREATE TABLE IF NOT EXISTS "ProgramFinancialAccount" (
  "id" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "targetType" "CertificateTargetType" NOT NULL DEFAULT 'COURSE',
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "totalGrossRevenueCents" INTEGER NOT NULL DEFAULT 0,
  "totalInstructorShareCents" INTEGER NOT NULL DEFAULT 0,
  "totalPlatformShareCents" INTEGER NOT NULL DEFAULT 0,
  "totalRefundedCents" INTEGER NOT NULL DEFAULT 0,
  "netBalanceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramFinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramFinancialAccount_accountCode_key" ON "ProgramFinancialAccount"("accountCode");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramFinancialAccount_courseId_key" ON "ProgramFinancialAccount"("courseId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramFinancialAccount_learningPathId_key" ON "ProgramFinancialAccount"("learningPathId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramFinancialAccount_diplomaId_key" ON "ProgramFinancialAccount"("diplomaId");

-- CreateTable ProgramLedgerEntry
CREATE TABLE IF NOT EXISTS "ProgramLedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "FinancialLedgerEntryType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "instructorShareCents" INTEGER NOT NULL DEFAULT 0,
  "platformShareCents" INTEGER NOT NULL DEFAULT 0,
  "balanceAfterCents" INTEGER NOT NULL DEFAULT 0,
  "descriptionAr" TEXT NOT NULL,
  "paymentRecordId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramLedgerEntry_accountId_createdAt_idx" ON "ProgramLedgerEntry"("accountId", "createdAt");

-- CreateTable InstructorFinancialAccount
CREATE TABLE IF NOT EXISTS "InstructorFinancialAccount" (
  "id" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "totalEarnedCents" INTEGER NOT NULL DEFAULT 0,
  "totalPaidOutCents" INTEGER NOT NULL DEFAULT 0,
  "pendingBalanceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstructorFinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorFinancialAccount_accountCode_key" ON "InstructorFinancialAccount"("accountCode");
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorFinancialAccount_instructorId_key" ON "InstructorFinancialAccount"("instructorId");

-- CreateTable InstructorStatementEntry
CREATE TABLE IF NOT EXISTS "InstructorStatementEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "type" "FinancialLedgerEntryType" NOT NULL,
  "targetType" "CertificateTargetType",
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "programTitleSnapshot" TEXT,
  "grossAmountCents" INTEGER NOT NULL DEFAULT 0,
  "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmountCents" INTEGER NOT NULL,
  "balanceAfterCents" INTEGER NOT NULL DEFAULT 0,
  "descriptionAr" TEXT NOT NULL,
  "paymentRecordId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorStatementEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorStatementEntry_accountId_createdAt_idx" ON "InstructorStatementEntry"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "InstructorStatementEntry_instructorId_createdAt_idx" ON "InstructorStatementEntry"("instructorId", "createdAt");

-- CreateTable FinancialPaymentRecord
CREATE TABLE IF NOT EXISTS "FinancialPaymentRecord" (
  "id" TEXT NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'INBOUND',
  "targetType" "CertificateTargetType",
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "programTitleSnapshot" TEXT,
  "payerUserId" TEXT,
  "payeeInstructorId" TEXT,
  "paymentTransactionId" TEXT,
  "grossAmountCents" INTEGER NOT NULL,
  "instructorShareCents" INTEGER NOT NULL DEFAULT 0,
  "platformShareCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "paymentMethodAr" TEXT NOT NULL DEFAULT 'الدفع الإلكتروني',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
  "notesAr" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialPaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialPaymentRecord_referenceCode_key" ON "FinancialPaymentRecord"("referenceCode");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialPaymentRecord_paymentTransactionId_key" ON "FinancialPaymentRecord"("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "FinancialPaymentRecord_createdAt_idx" ON "FinancialPaymentRecord"("createdAt");
CREATE INDEX IF NOT EXISTS "FinancialPaymentRecord_payeeInstructorId_createdAt_idx" ON "FinancialPaymentRecord"("payeeInstructorId", "createdAt");
CREATE INDEX IF NOT EXISTS "FinancialPaymentRecord_payerUserId_createdAt_idx" ON "FinancialPaymentRecord"("payerUserId", "createdAt");

-- CreateTable CompetencyCertificateRequest
CREATE TABLE IF NOT EXISTS "CompetencyCertificateRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" "CertificateTargetType" NOT NULL DEFAULT 'COURSE',
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "status" "CompetencyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "studentNotesAr" TEXT,
  "evidenceUrl" TEXT,
  "reviewedById" TEXT,
  "reviewedByRole" "UserRole",
  "reviewedAt" TIMESTAMP(3),
  "reviewNotesAr" TEXT,
  "certificateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetencyCertificateRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompetencyCertificateRequest_certificateId_key" ON "CompetencyCertificateRequest"("certificateId");
CREATE INDEX IF NOT EXISTS "CompetencyCertificateRequest_userId_status_idx" ON "CompetencyCertificateRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "CompetencyCertificateRequest_courseId_status_idx" ON "CompetencyCertificateRequest"("courseId", "status");
CREATE INDEX IF NOT EXISTS "CompetencyCertificateRequest_status_createdAt_idx" ON "CompetencyCertificateRequest"("status", "createdAt");

-- CreateTable SubscriberQuestion
CREATE TABLE IF NOT EXISTS "SubscriberQuestion" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "topicAr" TEXT NOT NULL DEFAULT 'عام',
  "titleAr" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL,
  "courseId" TEXT,
  "upvoteCount" INTEGER NOT NULL DEFAULT 0,
  "answerCount" INTEGER NOT NULL DEFAULT 0,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "acceptedAnswerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriberQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriberQuestion_acceptedAnswerId_key" ON "SubscriberQuestion"("acceptedAnswerId");
CREATE INDEX IF NOT EXISTS "SubscriberQuestion_deletedAt_createdAt_idx" ON "SubscriberQuestion"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriberQuestion_topicAr_deletedAt_createdAt_idx" ON "SubscriberQuestion"("topicAr", "deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriberQuestion_authorId_createdAt_idx" ON "SubscriberQuestion"("authorId", "createdAt");

-- CreateTable SubscriberAnswer
CREATE TABLE IF NOT EXISTS "SubscriberAnswer" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "bodyAr" TEXT NOT NULL,
  "upvoteCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriberAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubscriberAnswer_questionId_deletedAt_upvoteCount_createdAt_idx" ON "SubscriberAnswer"("questionId", "deletedAt", "upvoteCount", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriberAnswer_authorId_idx" ON "SubscriberAnswer"("authorId");

-- CreateTable SubscriberVote
CREATE TABLE IF NOT EXISTS "SubscriberVote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questionId" TEXT,
  "answerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriberVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriberVote_userId_questionId_key" ON "SubscriberVote"("userId", "questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriberVote_userId_answerId_key" ON "SubscriberVote"("userId", "answerId");

-- AddForeignKeys
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgramInstructorAssignment" ADD CONSTRAINT "ProgramInstructorAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramInstructorAssignment" ADD CONSTRAINT "ProgramInstructorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramInstructorAssignment" ADD CONSTRAINT "ProgramInstructorAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramInstructorAssignment" ADD CONSTRAINT "ProgramInstructorAssignment_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramInstructorAssignment" ADD CONSTRAINT "ProgramInstructorAssignment_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramFinancialAccount" ADD CONSTRAINT "ProgramFinancialAccount_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramFinancialAccount" ADD CONSTRAINT "ProgramFinancialAccount_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramFinancialAccount" ADD CONSTRAINT "ProgramFinancialAccount_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramLedgerEntry" ADD CONSTRAINT "ProgramLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ProgramFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramLedgerEntry" ADD CONSTRAINT "ProgramLedgerEntry_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "FinancialPaymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramLedgerEntry" ADD CONSTRAINT "ProgramLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorFinancialAccount" ADD CONSTRAINT "InstructorFinancialAccount_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorStatementEntry" ADD CONSTRAINT "InstructorStatementEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstructorFinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorStatementEntry" ADD CONSTRAINT "InstructorStatementEntry_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorStatementEntry" ADD CONSTRAINT "InstructorStatementEntry_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "FinancialPaymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructorStatementEntry" ADD CONSTRAINT "InstructorStatementEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialPaymentRecord" ADD CONSTRAINT "FinancialPaymentRecord_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialPaymentRecord" ADD CONSTRAINT "FinancialPaymentRecord_payeeInstructorId_fkey" FOREIGN KEY ("payeeInstructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialPaymentRecord" ADD CONSTRAINT "FinancialPaymentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialPaymentRecord" ADD CONSTRAINT "FinancialPaymentRecord_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_diplomaId_fkey" FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyCertificateRequest" ADD CONSTRAINT "CompetencyCertificateRequest_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriberQuestion" ADD CONSTRAINT "SubscriberQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberQuestion" ADD CONSTRAINT "SubscriberQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriberQuestion" ADD CONSTRAINT "SubscriberQuestion_acceptedAnswerId_fkey" FOREIGN KEY ("acceptedAnswerId") REFERENCES "SubscriberAnswer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "SubscriberAnswer" ADD CONSTRAINT "SubscriberAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SubscriberQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberAnswer" ADD CONSTRAINT "SubscriberAnswer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriberVote" ADD CONSTRAINT "SubscriberVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberVote" ADD CONSTRAINT "SubscriberVote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SubscriberQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriberVote" ADD CONSTRAINT "SubscriberVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "SubscriberAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
