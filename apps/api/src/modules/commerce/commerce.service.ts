import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@bosla/db';
import {
  cartAddItemSchema,
  couponCreateSchema,
  manualAllocationOverrideSchema,
  mulDivRoundHalfUp,
  normalizeCouponCode,
  orderAttributionOverrideSchema,
  orderPreviewOrCreateSchema,
  piastersToDecimalString,
  recordManualPaymentSchema,
  isAdminRole,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import {
  assertCourseCapacityForEnrollmentTx,
  throwCourseCapacityExceededError,
} from '../../core/course-entitlement.helper';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import { CommissionEngineService } from '../finance/commission-engine.service';
import { PaymobClient } from '../membership/paymob.client';
import { SellersService } from '../sellers/sellers.service';

@Injectable()
export class CommerceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SellersService) private readonly sellers: SellersService,
    @Inject(CommissionEngineService) private readonly commissionEngine: CommissionEngineService,
    @Inject(PaymobClient) private readonly paymob: PaymobClient,
  ) {}

  // ============================================================
  // 1. SHOPPING CART
  // ============================================================

  async getCart(userId: string, referralCookieToken?: string) {
    const [items, prefill] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { userId },
        orderBy: { addedAt: 'asc' },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              priceCents: true,
              compareAtPriceCents: true,
              currency: true,
              deliveryMode: true,
              allowIndividualPurchase: true,
              includedInMembership: true,
              maxCapacity: true,
              waitlistEnabled: true,
              publishedVersion: { select: { titleAr: true, thumbnailUrl: true } },
            },
          },
        },
      }),
      this.sellers.resolvePrefillFromReferralToken(referralCookieToken, userId),
    ]);

    const mapped = items.map((ci) => ({
      id: ci.id,
      courseId: ci.courseId,
      addedAt: ci.addedAt,
      slug: ci.course.slug,
      titleAr: ci.course.publishedVersion?.titleAr || ci.course.slug,
      thumbnailUrl: ci.course.publishedVersion?.thumbnailUrl || null,
      priceCents: ci.course.priceCents,
      priceEgp: ci.course.priceCents / 100,
      deliveryMode: ci.course.deliveryMode,
      allowIndividualPurchase: ci.course.allowIndividualPurchase,
      includedInMembership: ci.course.includedInMembership,
    }));

    const subtotalPiasters = mapped.reduce((sum, i) => sum + i.priceCents, 0);

    return {
      items: mapped,
      itemCount: mapped.length,
      subtotalEgp: subtotalPiasters / 100,
      prefilledSellerCode: prefill?.code ?? null,
    };
  }

  private assertCourseCapacityAvailable(
    course: { maxCapacity: number | null; waitlistEnabled: boolean },
    enrollmentCount: number,
  ) {
    if (course.maxCapacity && enrollmentCount >= course.maxCapacity) {
      throwCourseCapacityExceededError(course.waitlistEnabled);
    }
  }

  async addToCart(userId: string, body: unknown) {
    const parsed = cartAddItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'معرف الكورس مطلوب');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: parsed.data.courseId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!course || course.status !== 'PUBLISHED') {
      throw new NotFoundException('الكورس غير متاح للشراء حالياً');
    }
    if (!course.allowIndividualPurchase) {
      throw new BadRequestException('هذا الكورس متاح ضمن الاشتراك فقط ولا يباع بشكل منفرد');
    }
    this.assertCourseCapacityAvailable(course, course._count.enrollments);

    await this.prisma.cartItem.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      update: {},
      create: { userId, courseId: course.id },
    });

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, courseId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId, courseId } });
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { cleared: true };
  }

  // ============================================================
  // 2. COUPONS MANAGEMENT & DISCOUNT COMPUTATION
  // ============================================================

  async listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        applicableCourse: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
      },
    });
  }

  async createCoupon(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = couponCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الكوبون غير صالحة');
    }

    const code = normalizeCouponCode(parsed.data.code);
    if (code.length < 3) {
      throw new BadRequestException('كود الكوبون يجب أن يكون 3 أحرف على الأقل');
    }

    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) throw new ConflictException('كود الكوبون مسجل بالفعل');

    const saved = await this.prisma.coupon.create({
      data: {
        code,
        discountType: parsed.data.discountType,
        discountValue: piastersToDecimalString(toPiasters(parsed.data.discountValue)),
        maxDiscountAmount: parsed.data.maxDiscountAmount
          ? piastersToDecimalString(toPiasters(parsed.data.maxDiscountAmount))
          : null,
        minOrderAmount: parsed.data.minOrderAmount
          ? piastersToDecimalString(toPiasters(parsed.data.minOrderAmount))
          : null,
        applicableCourseId: parsed.data.applicableCourseId ?? null,
        usageLimit: parsed.data.usageLimit ?? null,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : new Date(),
        validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
        isActive: parsed.data.isActive,
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: saved.id,
      metadata: { code: saved.code, discountType: saved.discountType, discountValue: saved.discountValue.toString() },
      ipAddress,
    });

    return saved;
  }

  async toggleCoupon(actor: AuthenticatedContextUser, couponId: string, isActive: boolean, ipAddress?: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) throw new NotFoundException('الكوبون غير موجود');
    const updated = await this.prisma.coupon.update({ where: { id: couponId }, data: { isActive } });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
      entityType: 'Coupon',
      entityId: couponId,
      metadata: { code: existing.code },
      ipAddress,
    });
    return updated;
  }

  private async evaluateCouponForItems(
    rawCouponCode: string | null | undefined,
    items: Array<{ courseId: string; unitPricePiasters: number }>,
  ): Promise<{
    coupon: { id: string; code: string } | null;
    itemDiscounts: Map<string, number>;
    totalDiscountPiasters: number;
  }> {
    const itemDiscounts = new Map<string, number>();
    if (!rawCouponCode?.trim()) {
      return { coupon: null, itemDiscounts, totalDiscountPiasters: 0 };
    }

    const code = normalizeCouponCode(rawCouponCode);
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    const now = new Date();

    if (
      !coupon ||
      !coupon.isActive ||
      coupon.validFrom > now ||
      (coupon.validTo && coupon.validTo < now) ||
      (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
    ) {
      throw new BadRequestException('كوبون الخصم غير صالح أو منتهي الصلاحية');
    }

    const eligibleItems = coupon.applicableCourseId
      ? items.filter((i) => i.courseId === coupon.applicableCourseId)
      : items;
    if (eligibleItems.length === 0) {
      throw new BadRequestException('كوبون الخصم لا ينطبق على الكورسات المختارة');
    }

    const eligibleSubtotal = eligibleItems.reduce((s, i) => s + i.unitPricePiasters, 0);
    const orderSubtotal = items.reduce((s, i) => s + i.unitPricePiasters, 0);

    if (coupon.minOrderAmount && orderSubtotal < toPiasters(coupon.minOrderAmount.toString())) {
      throw new BadRequestException(
        `الحد الأدنى لاستخدام هذا الكوبون هو ${coupon.minOrderAmount.toString()} ج.م`,
      );
    }

    let totalDiscount = 0;
    if (coupon.discountType === 'PERCENT') {
      const pctPiasters = toPiasters(coupon.discountValue.toString()); // 10.00% -> 1000
      totalDiscount = mulDivRoundHalfUp(eligibleSubtotal, pctPiasters, 10_000);
    } else {
      totalDiscount = toPiasters(coupon.discountValue.toString());
    }

    if (coupon.maxDiscountAmount) {
      totalDiscount = Math.min(totalDiscount, toPiasters(coupon.maxDiscountAmount.toString()));
    }
    totalDiscount = Math.min(totalDiscount, eligibleSubtotal);

    // Distribute discount across eligible items proportionally (exact piasters, remainder on last item)
    let distributed = 0;
    for (let idx = 0; idx < eligibleItems.length; idx++) {
      const item = eligibleItems[idx];
      let share = 0;
      if (idx === eligibleItems.length - 1) {
        share = totalDiscount - distributed;
      } else {
        share = mulDivRoundHalfUp(totalDiscount, item.unitPricePiasters, eligibleSubtotal);
      }
      share = Math.min(share, item.unitPricePiasters);
      distributed += share;
      itemDiscounts.set(item.courseId, share);
    }

    return {
      coupon: { id: coupon.id, code: coupon.code },
      itemDiscounts,
      totalDiscountPiasters: distributed,
    };
  }

  // ============================================================
  // 3. ORDER PREVIEW & MULTI-COURSE ORDER CREATION
  // ============================================================

  async previewOrBuildOrderPricing(params: {
    user: AuthenticatedContextUser;
    body: unknown;
    referralCookieToken?: string;
    ipAddress?: string;
    enforceSellerRateLimit: boolean;
  }) {
    const parsed = orderPreviewOrCreateSchema.safeParse(params.body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة');
    }

    const data = parsed.data;
    const uniqueCourseIds = Array.from(new Set(data.courseIds));
    const courses = await this.prisma.course.findMany({
      where: { id: { in: uniqueCourseIds } },
      include: {
        publishedVersion: { select: { titleAr: true } },
        _count: { select: { enrollments: true } },
      },
    });

    if (courses.length !== uniqueCourseIds.length) {
      throw new NotFoundException('أحد الكورسات المختارة غير موجود');
    }

    // Preserve exact cart / checkout item ordering (important for sequential payment allocation!)
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const orderedCourses = uniqueCourseIds.map((id) => {
      const c = courseById.get(id)!;
      if (c.status !== 'PUBLISHED' || !c.allowIndividualPurchase) {
        throw new BadRequestException(`الكورس (${c.publishedVersion?.titleAr || c.slug}) غير متاح للشراء المنفرد حالياً`);
      }
      this.assertCourseCapacityAvailable(c, c._count.enrollments);
      return c;
    });

    const baseItems = orderedCourses.map((c, idx) => ({
      courseId: c.id,
      slug: c.slug,
      titleAr: c.publishedVersion?.titleAr || c.slug,
      unitPricePiasters: c.priceCents,
      sortOrder: idx,
    }));

    const couponEval = await this.evaluateCouponForItems(data.couponCode, baseItems);

    const pricedItems = baseItems.map((item) => {
      const discountPiasters = couponEval.itemDiscounts.get(item.courseId) ?? 0;
      const finalPricePiasters = Math.max(0, item.unitPricePiasters - discountPiasters);
      return {
        ...item,
        discountPiasters,
        finalPricePiasters,
      };
    });

    const subtotalPiasters = pricedItems.reduce((s, i) => s + i.unitPricePiasters, 0);
    const discountPiasters = pricedItems.reduce((s, i) => s + i.discountPiasters, 0);
    const totalPiastersVal = pricedItems.reduce((s, i) => s + i.finalPricePiasters, 0);

    // Resolve seller code: manual entry overrides referral; clearSellerPrefill removes prefill (AT-008..AT-011)
    let resolvedReferralId: string | null = null;
    let effectiveRawSellerCode: string | null = null;
    let sellerAttributionSource: 'MANUAL' | 'REFERRAL_PREFILL' | 'NONE' = 'NONE';

    if (data.sellerCode && data.sellerCode.trim().length > 0) {
      effectiveRawSellerCode = data.sellerCode.trim();
      sellerAttributionSource = 'MANUAL';
    } else if (!data.clearSellerPrefill) {
      const prefill = await this.sellers.resolvePrefillFromReferralToken(
        params.referralCookieToken,
        params.user.id,
      );
      if (prefill) {
        effectiveRawSellerCode = prefill.code;
        resolvedReferralId = prefill.referralId;
        sellerAttributionSource = 'REFERRAL_PREFILL';
      }
    }

    let sellerResult: {
      sellerId: string;
      sellerUserId: string;
      sellerCodeId: string;
      sellerCode: string;
      sellerName: string;
    } | null = null;
    let sellerCodeWarning: string | null = null;

    if (effectiveRawSellerCode) {
      const check = await this.sellers.validateSellerCodeForCheckout({
        rawCode: effectiveRawSellerCode,
        courseIds: uniqueCourseIds,
        buyer: {
          id: params.user.id,
          email: params.user.email,
          phoneE164: params.user.phoneE164,
        },
        ipAddress: params.ipAddress,
        enforceRateLimit: params.enforceSellerRateLimit,
      });

      if (!check.valid) {
        if (sellerAttributionSource === 'MANUAL') {
          throw new BadRequestException(check.message || 'كود البائع غير صالح أو غير متاح حالياً');
        }
        // If referral prefill became invalid or self-purchase, silently drop attribution and surface warning
        sellerCodeWarning = check.message || null;
        resolvedReferralId = null;
        sellerAttributionSource = 'NONE';
      } else if (check.seller && check.sellerCode) {
        sellerResult = {
          sellerId: check.seller.id,
          sellerUserId: check.seller.userId,
          sellerCodeId: check.sellerCode.id,
          sellerCode: check.sellerCode.code,
          sellerName: check.seller.fullName,
        };
      }
    }

    // Suspicious pattern check (AT-013): shared deviceFingerprint between buyer & seller account
    let isFlaggedSuspicious = false;
    let suspiciousReason: string | null = null;
    if (sellerResult && data.deviceFingerprint?.trim()) {
      const sellerUsedSameDevice = await this.prisma.order.findFirst({
        where: {
          userId: sellerResult.sellerUserId,
          deviceFingerprint: data.deviceFingerprint.trim(),
        },
        select: { id: true },
      });
      if (sellerUsedSameDevice) {
        isFlaggedSuspicious = true;
        suspiciousReason = 'تم رصد تطابق بصمة الجهاز مع حساب البائع — بانتظار المراجعة المالية';
      }
    }

    return {
      data,
      pricedItems,
      subtotalPiasters,
      discountPiasters,
      totalPiasters: totalPiastersVal,
      coupon: couponEval.coupon,
      seller: sellerResult,
      referralId: sellerResult ? resolvedReferralId : null,
      sellerAttributionSource,
      sellerCodeWarning,
      isFlaggedSuspicious,
      suspiciousReason,
    };
  }

  async previewOrder(
    user: AuthenticatedContextUser,
    body: unknown,
    referralCookieToken?: string,
    ipAddress?: string,
  ) {
    const priced = await this.previewOrBuildOrderPricing({
      user,
      body,
      referralCookieToken,
      ipAddress,
      enforceSellerRateLimit: true,
    });

    return {
      items: priced.pricedItems.map((i) => ({
        courseId: i.courseId,
        slug: i.slug,
        titleAr: i.titleAr,
        unitPriceEgp: i.unitPricePiasters / 100,
        discountEgp: i.discountPiasters / 100,
        finalPriceEgp: i.finalPricePiasters / 100,
      })),
      subtotalEgp: priced.subtotalPiasters / 100,
      discountEgp: priced.discountPiasters / 100,
      totalEgp: priced.totalPiasters / 100,
      couponCode: priced.coupon?.code ?? null,
      sellerCode: priced.seller?.sellerCode ?? null,
      sellerName: priced.seller?.sellerName ?? null,
      sellerAttributionSource: priced.sellerAttributionSource,
      sellerCodeWarning: priced.sellerCodeWarning,
    };
  }

  async createOrder(
    user: AuthenticatedContextUser,
    body: unknown,
    referralCookieToken?: string,
    ipAddress?: string,
  ) {
    const priced = await this.previewOrBuildOrderPricing({
      user,
      body,
      referralCookieToken,
      ipAddress,
      enforceSellerRateLimit: true,
    });

    const seq = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${seq}`;

    const created = await this.prisma.$transaction(async (tx) => {
      // Lock courses (deterministic order) to enforce maxCapacity atomically under concurrency
      const sortedCourseIds = Array.from(new Set(priced.pricedItems.map((i) => i.courseId))).sort();
      for (const courseId of sortedCourseIds) {
        await assertCourseCapacityForEnrollmentTx(tx, { courseId, userId: user.id });
      }

      // Lock coupon row atomically before consuming a usage slot
      if (priced.coupon) {
        const [lockedCoupon] = await tx.$queryRaw<
          Array<{ id: string; usageCount: number; usageLimit: number | null; isActive: boolean }>
        >`SELECT id, "usageCount", "usageLimit", "isActive" FROM "Coupon" WHERE id = ${priced.coupon.id} FOR UPDATE`;
        if (
          !lockedCoupon ||
          !lockedCoupon.isActive ||
          (lockedCoupon.usageLimit !== null && lockedCoupon.usageCount >= lockedCoupon.usageLimit)
        ) {
          throw new BadRequestException('تم استهلاك الحد الأقصى لاستخدام هذا الكوبون');
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          accountingType: 'COURSE_PURCHASE',
          status: priced.totalPiasters === 0 ? 'PAID' : 'PENDING_PAYMENT',
          subtotalAmount: piastersToDecimalString(priced.subtotalPiasters),
          discountAmount: piastersToDecimalString(priced.discountPiasters),
          totalAmount: piastersToDecimalString(priced.totalPiasters),
          paidAmount: '0.00',
          refundedAmount: '0.00',
          currency: 'EGP',
          couponId: priced.coupon?.id ?? null,
          couponCodeSnapshot: priced.coupon?.code ?? null,
          sellerId: priced.seller?.sellerId ?? null,
          sellerCodeId: priced.seller?.sellerCodeId ?? null,
          sellerCodeSnapshot: priced.seller?.sellerCode ?? null,
          referralId: priced.referralId ?? null,
          isFlaggedSuspicious: priced.isFlaggedSuspicious,
          suspiciousReason: priced.suspiciousReason,
          deviceFingerprint: priced.data.deviceFingerprint?.trim() || null,
          notesAr: priced.data.notesAr ?? null,
          paidAt: priced.totalPiasters === 0 ? new Date() : null,
          items: {
            create: priced.pricedItems.map((item) => ({
              courseId: item.courseId,
              courseTitleSnapshotAr: item.titleAr,
              unitPrice: piastersToDecimalString(item.unitPricePiasters),
              discountAmount: piastersToDecimalString(item.discountPiasters),
              finalPrice: piastersToDecimalString(item.finalPricePiasters),
              allocatedPaidAmount: '0.00',
              refundedAmount: '0.00',
              sortOrder: item.sortOrder,
              entitlementGrantedAt: priced.totalPiasters === 0 ? new Date() : null,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      if (priced.coupon) {
        await tx.coupon.update({
          where: { id: priced.coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      if (priced.seller) {
        await tx.sellerCode.update({
          where: { id: priced.seller.sellerCodeId },
          data: { usageCount: { increment: 1 } },
        });
      }

      if (priced.referralId) {
        await tx.sellerReferral.update({
          where: { id: priced.referralId },
          data: { consumedOrderId: order.id },
        });
      }

      // If 100% discounted free order, grant course entitlements immediately (no commission because net = 0)
      if (priced.totalPiasters === 0) {
        for (const item of order.items) {
          await this.commissionEngine.grantCourseEntitlementTx(tx, {
            userId: user.id,
            courseId: item.courseId,
            amountCents: 0,
            purchasedAt: new Date(),
          });
        }
      }

      // Remove ordered courses from user's cart
      await tx.cartItem.deleteMany({
        where: { userId: user.id, courseId: { in: priced.pricedItems.map((i) => i.courseId) } },
      });

      return order;
    });

    if (priced.isFlaggedSuspicious) {
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'SUSPICIOUS_ORDER_FLAGGED',
        entityType: 'Order',
        entityId: created.id,
        metadata: {
          orderNumber: created.orderNumber,
          sellerId: priced.seller?.sellerId,
          reason: priced.suspiciousReason,
        },
        ipAddress,
      });
    }

    // Online payment initiation (PaymobCard / PaymobWallet) — internal gateway only, never expose brand in UI labels
    let checkoutUrl: string | null = null;
    if (
      priced.totalPiasters > 0 &&
      (priced.data.paymentMethod === 'PAYMOB_CARD' || priced.data.paymentMethod === 'PAYMOB_WALLET')
    ) {
      const pendingPayment = await this.prisma.orderPayment.create({
        data: {
          orderId: created.id,
          paymentMethod: priced.data.paymentMethod,
          status: 'PENDING',
          amount: piastersToDecimalString(priced.totalPiasters),
          allocatedAmount: '0.00',
        },
      });

      const appBase = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const apiBase = (process.env.API_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
      const checkout = await this.paymob.createCheckout({
        merchantOrderId: created.orderNumber,
        amountCents: priced.totalPiasters,
        currency: 'EGP',
        planNameAr: `طلب رقم ${created.orderNumber} (${created.items.length} دورات)`,
        billingUser: {
          fullName: user.fullName,
          email: user.email || 'student@bosla-academy.com',
          phoneE164: user.phoneE164 || '+201000000000',
        },
        returnUrl: `${appBase}/cart?order=${encodeURIComponent(created.orderNumber)}`,
        webhookUrl: `${apiBase}/api/v1/commerce/webhooks/paymob`,
      });
      checkoutUrl = checkout.checkoutUrl;
      await this.prisma.orderPayment.update({
        where: { id: pendingPayment.id },
        data: { receiptReference: checkout.paymobOrderId ?? checkout.paymobIntentionId ?? null },
      });
    }

    return {
      order: created,
      checkoutUrl,
    };
  }

  /**
   * Membership order record helper — explicitly classified as MONTHLY_MEMBERSHIP or ANNUAL_MEMBERSHIP
   * and NEVER generates seller commissions (v1.2 Business Decision #1).
   */
  async createMembershipOrder(
    user: AuthenticatedContextUser,
    params: { membershipPlanId: string; sellerCode?: string | null },
  ) {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: params.membershipPlanId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('باقة الاشتراك غير موجودة');
    }

    const accountingType =
      plan.interval === 'ANNUAL' ? 'ANNUAL_MEMBERSHIP' : 'MONTHLY_MEMBERSHIP';
    const seq = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `MEM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${seq}`;

    return this.prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        accountingType,
        membershipPlanId: plan.id,
        status: 'PENDING_PAYMENT',
        subtotalAmount: piastersToDecimalString(plan.priceCents),
        discountAmount: '0.00',
        totalAmount: piastersToDecimalString(plan.priceCents),
        paidAmount: '0.00',
        refundedAmount: '0.00',
        currency: plan.currency,
        notesAr: `اشتراك ${plan.nameAr} — عمولات البائعين معطلة على الاشتراكات في الإصدار 1.2`,
      },
    });
  }

  // ============================================================
  // 4. PAYMENT SETTLEMENT (IDEMPOTENT WEBHOOK + MANUAL / PARTIAL PAYMENTS)
  // ============================================================

  async handlePaymobOrderWebhook(payload: any, hmacFromQuery?: string) {
    const obj = payload?.obj ?? payload;
    const valid = this.paymob.verifyTransactionHmac(obj, hmacFromQuery || payload?.hmac);
    if (!valid) {
      throw new ForbiddenException('توقيع بوابة الدفع غير صالح');
    }

    const externalTxId = String(obj?.id ?? '');
    const merchantOrderId = String(obj?.order?.merchant_order_id ?? obj?.merchant_order_id ?? '');
    const isSuccess = Boolean(obj?.success);
    const amountPiasters = Number(obj?.amount_cents ?? 0);

    if (!externalTxId || !merchantOrderId) {
      throw new BadRequestException('بيانات إشعار الدفع غير مكتملة');
    }

    if (!isSuccess) {
      return { processed: false, reason: 'PAYMENT_NOT_SUCCESSFUL' };
    }

    return this.settleExternalOrderPayment({
      orderNumber: merchantOrderId,
      externalTxId,
      amountPiasters,
      paymentMethod: 'PAYMOB_CARD',
    });
  }

  async confirmSandboxOrderPayment(params: {
    user: Pick<AuthenticatedContextUser, 'id' | 'role' | 'roles'>;
    orderNumber: string;
    amountEgp?: number;
    externalTxId?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: params.orderNumber },
      select: { id: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }
    if (order.userId !== params.user.id && !isAdminRole(params.user.role, params.user.roles)) {
      throw new ForbiddenException('لا تملك صلاحية تأكيد هذا الطلب');
    }
    const txId = params.externalTxId || `sbx-ord-${params.orderNumber}-${Date.now()}`;
    return this.settleExternalOrderPayment({
      orderNumber: params.orderNumber,
      externalTxId: txId,
      amountPiasters: params.amountEgp ? Math.round(Number(params.amountEgp) * 100) : 999_999_999,
      paymentMethod: 'PAYMOB_CARD',
    });
  }

  async settleExternalOrderPayment(params: {
    orderNumber: string;
    externalTxId: string;
    amountPiasters: number;
    paymentMethod: 'PAYMOB_CARD' | 'PAYMOB_WALLET';
    paidAtUtc?: Date;
  }) {
    const paidAt = params.paidAtUtc ?? new Date();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Check idempotency via unique externalTxId BEFORE modifying anything (AT-056)
          const existingTx = await tx.orderPayment.findUnique({
            where: { externalTxId: params.externalTxId },
          });
          if (existingTx && existingTx.status === 'PAID') {
            return { idempotent: true, paymentId: existingTx.id, orderNumber: params.orderNumber };
          }

          // Row-level lock on Order to serialize concurrent webhook deliveries (AT-056, AT-057)
          await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "orderNumber" = ${params.orderNumber} FOR UPDATE`;

          const order = await tx.order.findUnique({ where: { orderNumber: params.orderNumber } });
          if (!order) throw new NotFoundException('الطلب غير موجود');

          // Re-check after lock acquisition
          const recheckTx = await tx.orderPayment.findUnique({
            where: { externalTxId: params.externalTxId },
          });
          if (recheckTx && recheckTx.status === 'PAID') {
            return { idempotent: true, paymentId: recheckTx.id, orderNumber: params.orderNumber };
          }

          const totalOrderPiasters = toPiasters(order.totalAmount.toString());
          const alreadyPaidPiasters = toPiasters(order.paidAmount.toString());
          const remaining = Math.max(0, totalOrderPiasters - alreadyPaidPiasters);
          const appliedAmount = Math.min(params.amountPiasters, remaining);

          if (appliedAmount <= 0) {
            return { idempotent: true, orderNumber: params.orderNumber, alreadyFullyPaid: true };
          }

          const pending = await tx.orderPayment.findFirst({
            where: { orderId: order.id, status: 'PENDING', externalTxId: null },
            orderBy: { createdAt: 'desc' },
          });

          const payment = pending
            ? await tx.orderPayment.update({
                where: { id: pending.id },
                data: {
                  status: 'PAID',
                  amount: piastersToDecimalString(appliedAmount),
                  externalTxId: params.externalTxId,
                  paidAt,
                },
              })
            : await tx.orderPayment.create({
                data: {
                  orderId: order.id,
                  paymentMethod: params.paymentMethod,
                  status: 'PAID',
                  amount: piastersToDecimalString(appliedAmount),
                  allocatedAmount: '0.00',
                  externalTxId: params.externalTxId,
                  paidAt,
                },
              });

          const settlement = await this.commissionEngine.allocateAndSettlePaymentTx(tx, {
            orderId: order.id,
            paymentId: payment.id,
            paymentAmountPiasters: appliedAmount,
            paidAtUtc: paidAt,
          });

          await tx.notification.createMany({
            data: [
              {
                userId: order.userId,
                type: 'ORDER_PAYMENT_CONFIRMED',
                titleAr: 'تم تأكيد سداد طلبك بنجاح',
                bodyAr: `تم تأكيد دفعة بقيمة ${piastersToDecimalString(appliedAmount)} ج.م على الطلب ${order.orderNumber}.`,
                actionUrl: '/student',
                dedupKey: `order-paid-${payment.id}`,
              },
            ],
            skipDuplicates: true,
          });

          return {
            idempotent: false,
            paymentId: payment.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderStatus: settlement.order.status,
            createdCommissionsCount: settlement.createdCommissions.length,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err: any) {
      const code = err?.code || err?.meta?.code;
      if (code === 'P2034' || code === 'P2002' || code === '40001') {
        const settled = await this.prisma.orderPayment.findUnique({
          where: { externalTxId: params.externalTxId },
        });
        if (settled) {
          return { idempotent: true, paymentId: settled.id, orderNumber: params.orderNumber };
        }
        throw new ConflictException('جاري معالجة نفس الدفعة بالتوازي، يرجى إعادة المحاولة');
      }
      throw err;
    }
  }

  async recordManualPayment(
    actor: AuthenticatedContextUser,
    orderId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = recordManualPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الدفعة غير صالحة');
    }

    const data = parsed.data;
    const amountPiasters = toPiasters(data.amountEgp);
    const paidAt = new Date();

    const settled = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;

        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('الطلب غير موجود');
        if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
          throw new BadRequestException('لا يمكن تسجيل دفعة على طلب ملغى أو مسترد');
        }

        const totalPiastersVal = toPiasters(order.totalAmount.toString());
        const paidPiastersVal = toPiasters(order.paidAmount.toString());
        const remaining = totalPiastersVal - paidPiastersVal;
        if (amountPiasters > remaining) {
          throw new BadRequestException(
            `مبلغ الدفعة يتجاوز الرصيد المتبقي للطلب (${piastersToDecimalString(remaining)} ج.م)`,
          );
        }

        const payment = await tx.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethod: data.paymentMethod,
            status: 'PAID',
            amount: piastersToDecimalString(amountPiasters),
            allocatedAmount: '0.00',
            receiptReference: data.receiptReference,
            bankName: data.bankName ?? null,
            proofUrl: data.proofUrl ?? null,
            recordedById: actor.id,
            notesAr: data.notesAr ?? null,
            paidAt,
          },
        });

        const allocationResult = await this.commissionEngine.allocateAndSettlePaymentTx(tx, {
          orderId: order.id,
          paymentId: payment.id,
          paymentAmountPiasters: amountPiasters,
          paidAtUtc: paidAt,
        });

        return { payment, ...allocationResult };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORDER_MANUAL_PAYMENT_RECORDED',
      entityType: 'OrderPayment',
      entityId: settled.payment.id,
      metadata: {
        orderId,
        amountEgp: data.amountEgp,
        paymentMethod: data.paymentMethod,
        receiptReference: data.receiptReference,
        newOrderStatus: settled.order.status,
      },
      ipAddress,
    });

    return settled;
  }

  /**
   * Finance Officer manual override of payment allocation across order_items with full audit trail.
   */
  async overridePaymentAllocation(
    actor: AuthenticatedContextUser,
    paymentId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = manualAllocationOverrideSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات إعادة التوزيع غير صالحة');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.orderPayment.findUnique({
          where: { id: paymentId },
          include: { order: { include: { items: true } } },
        });
        if (!payment || payment.status !== 'PAID') {
          throw new NotFoundException('الدفعة غير موجودة أو غير مؤكدة');
        }

        const paymentTotalPiasters = toPiasters(payment.amount.toString());
        const sumRequestedPiasters = parsed.data.allocations.reduce(
          (s, a) => s + toPiasters(a.allocatedAmountEgp),
          0,
        );
        if (sumRequestedPiasters !== paymentTotalPiasters) {
          throw new BadRequestException(
            `مجموع التوزيعات (${piastersToDecimalString(sumRequestedPiasters)}) يجب أن يساوي قيمة الدفعة (${payment.amount.toString()})`,
          );
        }

        const itemMap = new Map(payment.order.items.map((i) => [i.id, i]));
        for (const a of parsed.data.allocations) {
          if (!itemMap.has(a.orderItemId)) {
            throw new BadRequestException(`البند ${a.orderItemId} لا ينتمي لهذا الطلب`);
          }
        }

        await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
        for (const a of parsed.data.allocations) {
          const piasters = toPiasters(a.allocatedAmountEgp);
          if (piasters <= 0) continue;
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              orderId: payment.orderId,
              orderItemId: a.orderItemId,
              allocatedAmount: piastersToDecimalString(piasters),
              isManualOverride: true,
              overriddenById: actor.id,
              overrideReason: parsed.data.reasonAr,
            },
          });
        }

        // Recalculate allocatedPaidAmount for every item on the order from all allocations
        const allAllocations = await tx.paymentAllocation.findMany({
          where: { orderId: payment.orderId },
        });
        const totalsByItem = new Map<string, number>();
        for (const al of allAllocations) {
          totalsByItem.set(
            al.orderItemId,
            (totalsByItem.get(al.orderItemId) || 0) + toPiasters(al.allocatedAmount.toString()),
          );
        }

        const now = new Date();
        for (const item of payment.order.items) {
          const newAlloc = totalsByItem.get(item.id) || 0;
          const finalPrice = toPiasters(item.finalPrice.toString());
          if (newAlloc > finalPrice) {
            throw new BadRequestException(
              `توزيع الدفعات على البند (${item.courseTitleSnapshotAr}) يتجاوز سعره الصافي`,
            );
          }
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              allocatedPaidAmount: piastersToDecimalString(newAlloc),
              ...(newAlloc >= finalPrice && !item.entitlementGrantedAt ? { entitlementGrantedAt: now } : {}),
            },
          });
          if (newAlloc >= finalPrice) {
            await this.commissionEngine.grantCourseEntitlementTx(tx, {
              userId: payment.order.userId,
              courseId: item.courseId,
              amountCents: finalPrice,
              purchasedAt: now,
            });
          }
        }

        await this.commissionEngine.evaluateCommissionsForOrderTx(
          tx,
          payment.orderId,
          payment.paidAt ?? now,
        );

        return tx.paymentAllocation.findMany({ where: { paymentId: payment.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'PAYMENT_ALLOCATION_OVERRIDDEN',
      entityType: 'OrderPayment',
      entityId: paymentId,
      metadata: {
        reasonAr: parsed.data.reasonAr,
        allocations: parsed.data.allocations,
      },
      ipAddress,
    });

    return { paymentId, allocations: result };
  }

  /**
   * Admin attribution override before commission payout with mandatory reason & audit log.
   */
  async overrideOrderAttribution(
    actor: AuthenticatedContextUser,
    orderId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = orderAttributionOverrideSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات تعديل الإسناد غير صالحة');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, items: true, commissions: true },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.commissions.some((c) => c.status === 'PAID')) {
      throw new BadRequestException('لا يمكن تغيير إسناد بائع لطلب تم صرف عمولاته بالفعل');
    }

    const check = await this.sellers.validateSellerCodeForCheckout({
      rawCode: parsed.data.sellerCode,
      courseIds: order.items.map((i) => i.courseId),
      buyer: { id: order.user.id, email: order.user.email, phoneE164: order.user.phoneE164 },
      ipAddress,
      enforceRateLimit: false,
    });
    if (!check.valid || !check.seller || !check.sellerCode) {
      throw new BadRequestException(check.message || 'كود البائع الجديد غير صالح');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const savedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          sellerId: check.seller!.id,
          sellerCodeId: check.sellerCode!.id,
          sellerCodeSnapshot: check.sellerCode!.code,
          attributionOverriddenById: actor.id,
          attributionOverrideReason: parsed.data.reasonAr,
        },
      });

      for (const comm of order.commissions) {
        await tx.sellerCommission.update({
          where: { id: comm.id },
          data: {
            sellerId: check.seller!.id,
            sellerCodeId: check.sellerCode!.id,
          },
        });
        await tx.commissionStatusHistory.create({
          data: {
            commissionId: comm.id,
            fromStatus: comm.status,
            toStatus: comm.status,
            changedById: actor.id,
            reasonAr: `إعادة إسناد الطلب إدارياً إلى الكود ${check.sellerCode!.code}: ${parsed.data.reasonAr}`,
          },
        });
      }

      if (order.commissions.length === 0 && (order.status === 'PAID' || order.status === 'PARTIALLY_PAID')) {
        await this.commissionEngine.evaluateCommissionsForOrderTx(
          tx,
          order.id,
          order.paidAt ?? new Date(),
        );
      }

      return savedOrder;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORDER_ATTRIBUTION_OVERRIDDEN',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        previousSellerId: order.sellerId,
        newSellerId: check.seller.id,
        newCode: check.sellerCode.code,
        reasonAr: parsed.data.reasonAr,
      },
      ipAddress,
    });

    return updated;
  }

  // ============================================================
  // 5. ORDERS LISTING & INVOICES / RECEIPTS
  // ============================================================

  async listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async adminListOrders(params: { status?: string; accountingType?: string; q?: string }) {
    return this.prisma.order.findMany({
      where: {
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.accountingType ? { accountingType: params.accountingType as any } : {}),
        ...(params.q?.trim()
          ? {
              OR: [
                { orderNumber: { contains: params.q.trim(), mode: 'insensitive' } },
                { sellerCodeSnapshot: { contains: params.q.trim().toUpperCase() } },
                { user: { fullName: { contains: params.q.trim(), mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
        seller: { select: { id: true, fullName: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' }, include: { allocations: true } },
        commissions: { select: { id: true, status: true, appliedAmount: true, netAmount: true } },
        refunds: true,
      },
    });
  }

  async getOrderInvoice(user: AuthenticatedContextUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneE164: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        refunds: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('الفاتورة غير موجودة');

    const canReadAll =
      user.permissions.includes('orders.read') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!canReadAll && order.userId !== user.id) {
      throw new ForbiddenException('لا يمكنك الاطلاع على فواتير مستخدم آخر');
    }

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      issuerAr: 'أكاديمية بوصلة للتدريب البيطري والإنتاج الحيواني (BOSLA Academy)',
      orderNumber: order.orderNumber,
      accountingType: order.accountingType,
      status: order.status,
      issuedAt: order.createdAt,
      paidAt: order.paidAt,
      customer: {
        fullName: order.user.fullName,
        email: order.user.email,
        phoneE164: order.user.phoneE164,
      },
      currency: order.currency,
      subtotalEgp: Number(order.subtotalAmount),
      discountEgp: Number(order.discountAmount),
      totalEgp: Number(order.totalAmount),
      paidEgp: Number(order.paidAmount),
      refundedEgp: Number(order.refundedAmount),
      remainingEgp: Math.max(0, Number(order.totalAmount) - Number(order.paidAmount)),
      couponCode: order.couponCodeSnapshot,
      items: order.items.map((i) => ({
        id: i.id,
        titleAr: i.courseTitleSnapshotAr,
        unitPriceEgp: Number(i.unitPrice),
        discountEgp: Number(i.discountAmount),
        finalPriceEgp: Number(i.finalPrice),
        allocatedPaidEgp: Number(i.allocatedPaidAmount),
        refundedEgp: Number(i.refundedAmount),
        entitlementActive: Boolean(i.entitlementGrantedAt && !i.entitlementRevokedAt),
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        methodLabelAr:
          p.paymentMethod === 'PAYMOB_CARD'
            ? 'بطاقة بنكية إلكترونية'
            : p.paymentMethod === 'PAYMOB_WALLET'
              ? 'محفظة إلكترونية'
              : p.paymentMethod === 'BANK_TRANSFER'
                ? 'تحويل بنكي'
                : p.paymentMethod === 'MANUAL_CASH'
                  ? 'دفع نقدي مباشر'
                  : p.paymentMethod === 'OFFLINE_TRAINING'
                    ? 'سداد تدريب حضوري'
                    : 'سداد مؤسسي (B2B)',
        status: p.status,
        amountEgp: Number(p.amount),
        receiptReference: p.receiptReference,
        paidAt: p.paidAt,
      })),
      refunds: order.refunds.map((r) => ({
        id: r.id,
        refundType: r.refundType,
        amountEgp: Number(r.refundAmount),
        reasonAr: r.reasonAr,
        createdAt: r.createdAt,
      })),
    };
  }
}
