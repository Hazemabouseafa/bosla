-- BOSLA Academy Audit Expansion Migration
-- Adds:
-- 1) Video download controls, WebVTT caption tracks (strictly subtitles, no transcript search),
--    session-bound meaningful watch-time telemetry, resume monotonic guards, and preferred playback rate.
-- 2) Quiz disclosure policy + idempotent concurrent submission guard.
-- 3) Certificate type ACCREDITED_PROGRAM + accrediting organization config + active uniqueness lock.
-- 4) Expanded Coupon targets (Course / Path / Diploma / Membership Plan) + per-user limits + redemption ledger + PaymentTransaction coupon snapshot.

-- AlterEnum
ALTER TYPE "CertificateKind" ADD VALUE IF NOT EXISTS 'ACCREDITED_PROGRAM';

-- CreateEnum
CREATE TYPE "CaptionTrackStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "CaptionSourceType" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "QuizDisclosurePolicy" AS ENUM ('IMMEDIATE', 'AFTER_PASS', 'AFTER_MAX_ATTEMPTS', 'AFTER_PASS_OR_MAX_ATTEMPTS', 'NEVER');

-- CreateEnum
CREATE TYPE "CouponTargetType" AS ENUM ('ALL', 'COURSE', 'LEARNING_PATH', 'DIPLOMA', 'MEMBERSHIP_PLAN');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredPlaybackRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "requireQuizPassForCertificate" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable LessonAttachment
ALTER TABLE "LessonAttachment" ADD COLUMN IF NOT EXISTS "isDownloadable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable VideoAsset
ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "isDownloadable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable LessonProgress
ALTER TABLE "LessonProgress"
  ADD COLUMN IF NOT EXISTS "lastClientSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastClientEventAt" TIMESTAMP(3);

-- AlterTable PaymentTransaction
ALTER TABLE "PaymentTransaction"
  ADD COLUMN IF NOT EXISTS "couponId" TEXT,
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
  ADD COLUMN IF NOT EXISTS "discountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Quiz
ALTER TABLE "Quiz"
  ADD COLUMN IF NOT EXISTS "answerDisclosurePolicy" "QuizDisclosurePolicy" NOT NULL DEFAULT 'AFTER_PASS_OR_MAX_ATTEMPTS';

-- AlterTable QuizAttempt
ALTER TABLE "QuizAttempt"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- AlterTable Certificate
ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "accreditingBodyNameAr" TEXT,
  ADD COLUMN IF NOT EXISTS "accreditingBodyCode" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationRef" TEXT;

-- AlterTable Coupon
ALTER TABLE "Coupon"
  ADD COLUMN IF NOT EXISTS "applicableTargetType" "CouponTargetType" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "applicableLearningPathId" TEXT,
  ADD COLUMN IF NOT EXISTS "applicableDiplomaId" TEXT,
  ADD COLUMN IF NOT EXISTS "applicablePlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "perUserLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "allowSellerStacking" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable CertificateTemplate
ALTER TABLE "CertificateTemplate"
  ADD COLUMN IF NOT EXISTS "accreditationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accreditingBodyNameAr" TEXT,
  ADD COLUMN IF NOT EXISTS "accreditingBodyCode" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationRef" TEXT,
  ADD COLUMN IF NOT EXISTS "issuerNameAr" TEXT;

-- CreateTable VideoCaptionTrack
CREATE TABLE IF NOT EXISTS "VideoCaptionTrack" (
    "id" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "labelAr" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vtt',
    "source" "CaptionSourceType" NOT NULL DEFAULT 'MANUAL',
    "status" "CaptionTrackStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "cueCount" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "jobId" TEXT,
    "errorMessageAr" TEXT,
    "updatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCaptionTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoPlaybackSession
CREATE TABLE IF NOT EXISTS "VideoPlaybackSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authSessionId" TEXT,
    "videoAssetId" TEXT NOT NULL,
    "lessonId" TEXT,
    "courseId" TEXT,
    "activeWatchSeconds" INTEGER NOT NULL DEFAULT 0,
    "maxPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "clientDeviceKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "VideoPlaybackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable CouponRedemption
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentTransactionId" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "QuizAttempt_quizId_userId_idempotencyKey_key" ON "QuizAttempt"("quizId", "userId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoCaptionTrack_videoAssetId_language_key" ON "VideoCaptionTrack"("videoAssetId", "language");
CREATE INDEX IF NOT EXISTS "VideoCaptionTrack_videoAssetId_status_isPublished_idx" ON "VideoCaptionTrack"("videoAssetId", "status", "isPublished");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_userId_lessonId_idx" ON "VideoPlaybackSession"("userId", "lessonId");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_videoAssetId_startedAt_idx" ON "VideoPlaybackSession"("videoAssetId", "startedAt");
CREATE INDEX IF NOT EXISTS "VideoPlaybackSession_courseId_lessonId_idx" ON "VideoPlaybackSession"("courseId", "lessonId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_paymentTransactionId_idx" ON "CouponRedemption"("paymentTransactionId");

-- Partial unique index preventing concurrent duplicate active certificates of the same kind for the same target
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_active_unique_idx"
  ON "Certificate"(
    "userId",
    "targetType",
    "kind",
    COALESCE("courseId", ''),
    COALESCE("learningPathId", ''),
    COALESCE("diplomaId", '')
  )
  WHERE "revokedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "VideoCaptionTrack" ADD CONSTRAINT "VideoCaptionTrack_videoAssetId_fkey"
  FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoPlaybackSession" ADD CONSTRAINT "VideoPlaybackSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoPlaybackSession" ADD CONSTRAINT "VideoPlaybackSession_videoAssetId_fkey"
  FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_applicableLearningPathId_fkey"
  FOREIGN KEY ("applicableLearningPathId") REFERENCES "LearningPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_applicableDiplomaId_fkey"
  FOREIGN KEY ("applicableDiplomaId") REFERENCES "Diploma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_applicablePlanId_fkey"
  FOREIGN KEY ("applicablePlanId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
