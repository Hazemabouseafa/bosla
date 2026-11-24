import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@bosla/db';
import {
  evaluateCouponEligibilityAndDiscount,
  normalizeCouponCode,
  toPiasters,
  type CouponTargetTypeValue,
} from '@bosla/shared';
import type { PrismaService } from './prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

export interface SingleTargetCouponPreview {
  couponId: string;
  couponCode: string;
  discountCents: number;
  finalAmountCents: number;
  allowSellerStacking: boolean;
}

/**
 * Evaluates a coupon code (without mutating counters) for a single checkout target:
 * MEMBERSHIP_PLAN, COURSE, LEARNING_PATH, or DIPLOMA.
 */
export async function previewCouponForSingleTarget(
  db: DbClient,
  params: {
    rawCouponCode: string | null | undefined;
    userId: string;
    targetType: Exclude<CouponTargetTypeValue, 'ALL'>;
    targetId: string;
    subtotalCents: number;
    now?: Date;
  },
): Promise<SingleTargetCouponPreview | null> {
  if (!params.rawCouponCode?.trim()) {
    return null;
  }

  const code = normalizeCouponCode(params.rawCouponCode);
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) {
    throw new BadRequestException('كوبون الخصم غير صالح أو غير موجود');
  }

  const userRedemptionCount = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId: params.userId },
  });

  const discountValuePiastersOrPercent =
    coupon.discountType === 'PERCENT'
      ? Number(coupon.discountValue.toString())
      : toPiasters(coupon.discountValue.toString());

  const evalRes = evaluateCouponEligibilityAndDiscount({
    coupon: {
      isActive: coupon.isActive,
      discountType: coupon.discountType,
      discountValuePiastersOrPercent,
      maxDiscountPiasters: coupon.maxDiscountAmount
        ? toPiasters(coupon.maxDiscountAmount.toString())
        : null,
      minOrderPiasters: coupon.minOrderAmount
        ? toPiasters(coupon.minOrderAmount.toString())
        : null,
      applicableTargetType: coupon.applicableTargetType as CouponTargetTypeValue,
      applicableCourseId: coupon.applicableCourseId,
      applicableLearningPathId: coupon.applicableLearningPathId,
      applicableDiplomaId: coupon.applicableDiplomaId,
      applicablePlanId: coupon.applicablePlanId,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      perUserLimit: coupon.perUserLimit,
      userRedemptionCount,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
    },
    targetType: params.targetType,
    targetIds: [params.targetId],
    subtotalPiasters: params.subtotalCents,
    eligibleSubtotalPiasters: params.subtotalCents,
    now: params.now,
  });

  if (!evalRes.eligible) {
    throw new BadRequestException(evalRes.reasonAr || 'كوبون الخصم لا ينطبق على هذا الطلب');
  }

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountCents: evalRes.discountPiasters,
    finalAmountCents: evalRes.finalTotalPiasters,
    allowSellerStacking: coupon.allowSellerStacking,
  };
}

/**
 * Locks `"Coupon"` `FOR UPDATE` inside an active transaction, re-verifies global `usageLimit`
 * and per-user `perUserLimit`, increments `usageCount`, and inserts a `CouponRedemption` row.
 */
export async function lockAndRedeemCouponInTx(
  tx: Prisma.TransactionClient,
  params: {
    couponId: string;
    userId: string;
    targetType: Exclude<CouponTargetTypeValue, 'ALL'>;
    targetIds: string[];
    subtotalCents: number;
    eligibleSubtotalCents: number;
    orderId?: string | null;
    paymentTransactionId?: string | null;
  },
): Promise<{ discountCents: number; finalAmountCents: number; couponCode: string }> {
  const [locked] = await tx.$queryRaw<
    Array<{
      id: string;
      code: string;
      isActive: boolean;
      discountType: 'PERCENT' | 'FIXED';
      discountValue: string;
      maxDiscountAmount: string | null;
      minOrderAmount: string | null;
      applicableTargetType: CouponTargetTypeValue;
      applicableCourseId: string | null;
      applicableLearningPathId: string | null;
      applicableDiplomaId: string | null;
      applicablePlanId: string | null;
      usageLimit: number | null;
      usageCount: number;
      perUserLimit: number | null;
      validFrom: Date;
      validTo: Date | null;
    }>
  >`SELECT id, code, "isActive", "discountType", "discountValue"::text, "maxDiscountAmount"::text, "minOrderAmount"::text, "applicableTargetType", "applicableCourseId", "applicableLearningPathId", "applicableDiplomaId", "applicablePlanId", "usageLimit", "usageCount", "perUserLimit", "validFrom", "validTo" FROM "Coupon" WHERE id = ${params.couponId} FOR UPDATE`;

  if (!locked) {
    throw new BadRequestException('كوبون الخصم غير موجود');
  }

  const userRedemptionCount = await tx.couponRedemption.count({
    where: { couponId: locked.id, userId: params.userId },
  });

  const discountValuePiastersOrPercent =
    locked.discountType === 'PERCENT'
      ? Number(locked.discountValue)
      : toPiasters(locked.discountValue);

  const evalRes = evaluateCouponEligibilityAndDiscount({
    coupon: {
      isActive: locked.isActive,
      discountType: locked.discountType,
      discountValuePiastersOrPercent,
      maxDiscountPiasters: locked.maxDiscountAmount ? toPiasters(locked.maxDiscountAmount) : null,
      minOrderPiasters: locked.minOrderAmount ? toPiasters(locked.minOrderAmount) : null,
      applicableTargetType: locked.applicableTargetType,
      applicableCourseId: locked.applicableCourseId,
      applicableLearningPathId: locked.applicableLearningPathId,
      applicableDiplomaId: locked.applicableDiplomaId,
      applicablePlanId: locked.applicablePlanId,
      usageLimit: locked.usageLimit,
      usageCount: locked.usageCount,
      perUserLimit: locked.perUserLimit,
      userRedemptionCount,
      validFrom: locked.validFrom,
      validTo: locked.validTo,
    },
    targetType: params.targetType,
    targetIds: params.targetIds,
    subtotalPiasters: params.subtotalCents,
    eligibleSubtotalPiasters: params.eligibleSubtotalCents,
  });

  if (!evalRes.eligible) {
    throw new BadRequestException(evalRes.reasonAr || 'تعذر تطبيق كوبون الخصم');
  }

  await tx.coupon.update({
    where: { id: locked.id },
    data: { usageCount: { increment: 1 } },
  });

  await tx.couponRedemption.create({
    data: {
      couponId: locked.id,
      userId: params.userId,
      orderId: params.orderId ?? null,
      paymentTransactionId: params.paymentTransactionId ?? null,
      discountCents: evalRes.discountPiasters,
    },
  });

  return {
    discountCents: evalRes.discountPiasters,
    finalAmountCents: evalRes.finalTotalPiasters,
    couponCode: locked.code,
  };
}

/**
 * Releases a reserved coupon redemption when a PaymentTransaction fails, cancels, or refunds.
 */
export async function releaseCouponRedemptionForPaymentTx(
  tx: Prisma.TransactionClient,
  paymentTransactionId: string,
): Promise<void> {
  const redemptions = await tx.couponRedemption.findMany({
    where: { paymentTransactionId },
  });
  if (redemptions.length === 0) return;

  await tx.couponRedemption.deleteMany({ where: { paymentTransactionId } });
  for (const r of redemptions) {
    await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = GREATEST(0, "usageCount" - 1) WHERE id = ${r.couponId}`;
  }
}
