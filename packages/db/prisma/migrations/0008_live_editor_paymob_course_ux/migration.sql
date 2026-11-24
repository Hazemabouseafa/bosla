-- 0008_live_editor_paymob_course_ux
-- Adds CourseVersion.posterUrl, SiteLayoutRevision (in-product Live Editor with draft/publish/rollback & optimistic versionNumber),
-- and PaymentGatewayConfig (AES-256-GCM encrypted Paymob Test/Live settings).

ALTER TABLE "CourseVersion" ADD COLUMN IF NOT EXISTS "posterUrl" TEXT;

DO $$ BEGIN
  CREATE TYPE "SiteLayoutRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentGatewayMode" AS ENUM ('TEST', 'LIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SiteLayoutRevision" (
  "id" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL DEFAULT 'home',
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "SiteLayoutRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "config" JSONB NOT NULL,
  "summaryAr" TEXT,
  "editedById" TEXT,
  "editedByName" TEXT,
  "publishedById" TEXT,
  "publishedByName" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteLayoutRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteLayoutRevision_pageKey_status_versionNumber_idx"
  ON "SiteLayoutRevision"("pageKey", "status", "versionNumber");

CREATE INDEX IF NOT EXISTS "SiteLayoutRevision_pageKey_createdAt_idx"
  ON "SiteLayoutRevision"("pageKey", "createdAt");

CREATE TABLE IF NOT EXISTS "PaymentGatewayConfig" (
  "id" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL DEFAULT 'PAYMOB',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mode" "PaymentGatewayMode" NOT NULL DEFAULT 'TEST',
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "testApiKeyEnc" TEXT,
  "testIntegrationId" TEXT,
  "testWalletIntegrationId" TEXT,
  "testIframeId" TEXT,
  "testHmacSecretEnc" TEXT,
  "testPublicKey" TEXT,
  "testSecretKeyEnc" TEXT,
  "liveApiKeyEnc" TEXT,
  "liveIntegrationId" TEXT,
  "liveWalletIntegrationId" TEXT,
  "liveIframeId" TEXT,
  "liveHmacSecretEnc" TEXT,
  "livePublicKey" TEXT,
  "liveSecretKeyEnc" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastVerifyStatus" TEXT,
  "lastVerifyMessageAr" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGatewayConfig_providerKey_key"
  ON "PaymentGatewayConfig"("providerKey");
