-- 0009_platform_expansion_features
-- Adds emailVerifiedAt, Subscription manual grant metadata, uniform cover crop metadata,
-- InstructorProfile homepage ordering, CertificateTemplate layout/image configuration,
-- CmsTestimonial avatarUrl, EmailActionToken, SystemIntegrationConfig (Google OAuth & SMTP),
-- EmailDispatchLog, RecommendationRequest, CareerOpportunity, and WishlistItem.

DO $$ BEGIN
  CREATE TYPE "CoverFitMode" AS ENUM ('COVER', 'CONTAIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailActionTokenPurpose" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecommendationRequestStatus" AS ENUM ('PENDING', 'DRAFT_INSTRUCTOR', 'APPROVED', 'REJECTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WishlistTargetType" AS ENUM ('COURSE', 'LEARNING_PATH', 'DIPLOMA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User email verification timestamp
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Subscription manual support grant attribution
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "isManualGrant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "grantedById" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "grantReasonAr" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "grantedDurationDays" INTEGER;

CREATE INDEX IF NOT EXISTS "Subscription_isManualGrant_grantedById_idx"
  ON "Subscription"("isManualGrant", "grantedById");

DO $$ BEGIN
  ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Uniform cover crop/fit settings
ALTER TABLE "CourseVersion" ADD COLUMN IF NOT EXISTS "coverFocalX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "CourseVersion" ADD COLUMN IF NOT EXISTS "coverFocalY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "CourseVersion" ADD COLUMN IF NOT EXISTS "coverFitMode" "CoverFitMode" NOT NULL DEFAULT 'COVER';

ALTER TABLE "LearningPath" ADD COLUMN IF NOT EXISTS "coverFocalX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "LearningPath" ADD COLUMN IF NOT EXISTS "coverFocalY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "LearningPath" ADD COLUMN IF NOT EXISTS "coverFitMode" "CoverFitMode" NOT NULL DEFAULT 'COVER';

ALTER TABLE "Diploma" ADD COLUMN IF NOT EXISTS "coverFocalX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Diploma" ADD COLUMN IF NOT EXISTS "coverFocalY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Diploma" ADD COLUMN IF NOT EXISTS "coverFitMode" "CoverFitMode" NOT NULL DEFAULT 'COVER';

-- CmsTestimonial optional avatarUrl
ALTER TABLE "CmsTestimonial" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- InstructorProfile homepage visibility and sorting
ALTER TABLE "InstructorProfile" ADD COLUMN IF NOT EXISTS "showOnHomepage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InstructorProfile" ADD COLUMN IF NOT EXISTS "homepageSortOrder" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS "InstructorProfile_approvalStatus_showOnHomepage_homepageSortOrder_idx"
  ON "InstructorProfile"("approvalStatus", "showOnHomepage", "homepageSortOrder");

-- CertificateTemplate image upload + coordinate layout JSON
ALTER TABLE "CertificateTemplate" ADD COLUMN IF NOT EXISTS "templateImageUrl" TEXT;
ALTER TABLE "CertificateTemplate" ADD COLUMN IF NOT EXISTS "layoutConfig" JSONB;

-- EmailActionToken table (single-use time-limited verification & reset tokens)
CREATE TABLE IF NOT EXISTS "EmailActionToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "EmailActionTokenPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailActionToken_tokenHash_key"
  ON "EmailActionToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailActionToken_userId_purpose_expiresAt_idx"
  ON "EmailActionToken"("userId", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "EmailActionToken_email_purpose_idx"
  ON "EmailActionToken"("email", "purpose");

DO $$ BEGIN
  ALTER TABLE "EmailActionToken"
    ADD CONSTRAINT "EmailActionToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- SystemIntegrationConfig table (runtime Google OAuth & Outbound SMTP encrypted config)
CREATE TABLE IF NOT EXISTS "SystemIntegrationConfig" (
  "id" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publicConfig" JSONB,
  "encryptedSecrets" JSONB,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastVerifyStatus" TEXT,
  "lastVerifyMessageAr" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemIntegrationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemIntegrationConfig_providerKey_key"
  ON "SystemIntegrationConfig"("providerKey");

-- EmailDispatchLog table (idempotent transactional email queue & delivery audit)
CREATE TABLE IF NOT EXISTS "EmailDispatchLog" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "category" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "subjectAr" TEXT NOT NULL,
  "status" "EmailDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastErrorAr" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDispatchLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailDispatchLog_dedupeKey_key"
  ON "EmailDispatchLog"("dedupeKey");
CREATE INDEX IF NOT EXISTS "EmailDispatchLog_status_nextRetryAt_idx"
  ON "EmailDispatchLog"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "EmailDispatchLog_category_createdAt_idx"
  ON "EmailDispatchLog"("category", "createdAt");

-- RecommendationRequest table
CREATE TABLE IF NOT EXISTS "RecommendationRequest" (
  "id" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "targetType" "CertificateTargetType" NOT NULL,
  "courseId" TEXT,
  "learningPathId" TEXT,
  "status" "RecommendationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "studentGoalAr" TEXT NOT NULL,
  "purposeAr" TEXT,
  "letterTitleAr" TEXT,
  "letterBodyAr" TEXT,
  "instructorNoteAr" TEXT,
  "rejectionReasonAr" TEXT,
  "approvedSnapshot" JSONB,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokeReasonAr" TEXT,
  CONSTRAINT "RecommendationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecommendationRequest_verificationCode_key"
  ON "RecommendationRequest"("verificationCode");
CREATE INDEX IF NOT EXISTS "RecommendationRequest_studentId_courseId_idx"
  ON "RecommendationRequest"("studentId", "courseId");
CREATE INDEX IF NOT EXISTS "RecommendationRequest_studentId_learningPathId_idx"
  ON "RecommendationRequest"("studentId", "learningPathId");
CREATE INDEX IF NOT EXISTS "RecommendationRequest_instructorId_status_idx"
  ON "RecommendationRequest"("instructorId", "status");

DO $$ BEGIN
  ALTER TABLE "RecommendationRequest"
    ADD CONSTRAINT "RecommendationRequest_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecommendationRequest"
    ADD CONSTRAINT "RecommendationRequest_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecommendationRequest"
    ADD CONSTRAINT "RecommendationRequest_revokedById_fkey"
    FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecommendationRequest"
    ADD CONSTRAINT "RecommendationRequest_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecommendationRequest"
    ADD CONSTRAINT "RecommendationRequest_learningPathId_fkey"
    FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CareerOpportunity table
CREATE TABLE IF NOT EXISTS "CareerOpportunity" (
  "id" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "departmentAr" TEXT,
  "locationAr" TEXT,
  "employmentTypeAr" TEXT,
  "summaryAr" TEXT NOT NULL,
  "applyUrl" TEXT,
  "applyEmail" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareerOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CareerOpportunity_isPublished_sortOrder_idx"
  ON "CareerOpportunity"("isPublished", "sortOrder");

-- WishlistItem table with partial unique indexes per target
CREATE TABLE IF NOT EXISTS "WishlistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" "WishlistTargetType" NOT NULL,
  "courseId" TEXT,
  "learningPathId" TEXT,
  "diplomaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WishlistItem_userId_createdAt_idx"
  ON "WishlistItem"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WishlistItem_courseId_idx"
  ON "WishlistItem"("courseId");
CREATE INDEX IF NOT EXISTS "WishlistItem_learningPathId_idx"
  ON "WishlistItem"("learningPathId");
CREATE INDEX IF NOT EXISTS "WishlistItem_diplomaId_idx"
  ON "WishlistItem"("diplomaId");
CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userId_courseId_unique"
  ON "WishlistItem"("userId", "courseId") WHERE "courseId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userId_learningPathId_unique"
  ON "WishlistItem"("userId", "learningPathId") WHERE "learningPathId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userId_diplomaId_unique"
  ON "WishlistItem"("userId", "diplomaId") WHERE "diplomaId" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "WishlistItem"
    ADD CONSTRAINT "WishlistItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WishlistItem"
    ADD CONSTRAINT "WishlistItem_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WishlistItem"
    ADD CONSTRAINT "WishlistItem_learningPathId_fkey"
    FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WishlistItem"
    ADD CONSTRAINT "WishlistItem_diplomaId_fkey"
    FOREIGN KEY ("diplomaId") REFERENCES "Diploma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
