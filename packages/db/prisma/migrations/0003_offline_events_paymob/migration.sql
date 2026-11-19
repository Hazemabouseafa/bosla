-- CreateEnum
CREATE TYPE "PaymentTargetType" AS ENUM ('MEMBERSHIP', 'OFFLINE_EVENT');

-- CreateEnum
CREATE TYPE "OfflineEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ATTENDED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "OfflineEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "subtitleAr" TEXT,
    "descriptionAr" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "categoryLabelAr" TEXT NOT NULL DEFAULT 'ورشة تطبيقية',
    "cityAr" TEXT NOT NULL,
    "venueNameAr" TEXT NOT NULL,
    "venueAddressAr" TEXT NOT NULL,
    "mapUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "status" "OfflineEventStatus" NOT NULL DEFAULT 'DRAFT',
    "highlights" TEXT[],
    "speakerNameAr" TEXT,
    "instructorId" TEXT,
    "createdById" TEXT NOT NULL,
    "featuredOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineEventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "ticketCode" TEXT NOT NULL,
    "seatsCount" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "attendeeNameAr" TEXT NOT NULL,
    "attendeePhoneE164" TEXT,
    "notes" TEXT,
    "paymentTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineEventRegistration_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PaymentTransaction"
    ALTER COLUMN "planId" DROP NOT NULL,
    ADD COLUMN "targetType" "PaymentTargetType" NOT NULL DEFAULT 'MEMBERSHIP',
    ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OfflineEvent_slug_key" ON "OfflineEvent"("slug");

-- CreateIndex
CREATE INDEX "OfflineEvent_status_startsAt_idx" ON "OfflineEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "OfflineEvent_featuredOrder_idx" ON "OfflineEvent"("featuredOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineEventRegistration_ticketCode_key" ON "OfflineEventRegistration"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineEventRegistration_paymentTransactionId_key" ON "OfflineEventRegistration"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "OfflineEventRegistration_eventId_status_idx" ON "OfflineEventRegistration"("eventId", "status");

-- CreateIndex
CREATE INDEX "OfflineEventRegistration_userId_status_idx" ON "OfflineEventRegistration"("userId", "status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_eventId_status_idx" ON "PaymentTransaction"("eventId", "status");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OfflineEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineEvent" ADD CONSTRAINT "OfflineEvent_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineEvent" ADD CONSTRAINT "OfflineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineEventRegistration" ADD CONSTRAINT "OfflineEventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OfflineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineEventRegistration" ADD CONSTRAINT "OfflineEventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineEventRegistration" ADD CONSTRAINT "OfflineEventRegistration_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
