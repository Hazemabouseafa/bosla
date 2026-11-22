import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@bosla/db';
import {
  addCairoCalendarDays,
  allocatePaymentSequentially,
  computeCappedCommission,
  piastersToDecimalString,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import {
  assertCourseCapacityForEnrollmentTx,
  ensureActiveCourseDirectPurchase,
} from '../../core/course-entitlement.helper';
import { PrismaService } from '../../core/prisma.service';
import { CommissionRulesService } from './commission-rules.service';

@Injectable()
export class CommissionEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommissionEngineService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CommissionRulesService) private readonly rules: CommissionRulesService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_COMMISSION_SCHEDULER === 'true') {
      return;
    }
    // Hourly check for 14-day Cairo commission hold maturation
    this.timer = setInterval(() => {
      void this.runHourlyEligibilityMaturation().catch((err) => {
        this.logger.warn(`Hourly commission eligibility job failed: ${String(err)}`);
      });
    }, 3600_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Allocates a confirmed payment sequentially across order_items (sorted by sortOrder ASC),
   * grants item-level course entitlement when item reaches 100% paid, updates Order totals,
   * and evaluates seller commissions for newly fully paid items.
   */
  async allocateAndSettlePaymentTx(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      paymentId: string;
      paymentAmountPiasters: number;
      paidAtUtc: Date;
    },
  ) {
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!order) {
      throw new BadRequestException('الطلب غير موجود');
    }

    const allocations = allocatePaymentSequentially({
      paymentAmountPiasters: params.paymentAmountPiasters,
      items: order.items.map((item) => ({
        orderItemId: item.id,
        netAmountPiasters: toPiasters(item.finalPrice.toString()),
        alreadyPaidPiasters: toPiasters(item.allocatedPaidAmount.toString()),
      })),
    });

    let totalNewlyAllocatedPiasters = 0;
    const newlyFullyPaidItemIds: string[] = [];

    for (const alloc of allocations) {
      if (alloc.allocatedPiasters <= 0) continue;
      totalNewlyAllocatedPiasters += alloc.allocatedPiasters;

      await tx.paymentAllocation.upsert({
        where: {
          paymentId_orderItemId: {
            paymentId: params.paymentId,
            orderItemId: alloc.orderItemId,
          },
        },
        update: {
          allocatedAmount: piastersToDecimalString(alloc.allocatedPiasters),
        },
        create: {
          paymentId: params.paymentId,
          orderId: order.id,
          orderItemId: alloc.orderItemId,
          allocatedAmount: piastersToDecimalString(alloc.allocatedPiasters),
          isManualOverride: false,
        },
      });

      const item = order.items.find((i) => i.id === alloc.orderItemId)!;
      const wasFullyPaid =
        toPiasters(item.allocatedPaidAmount.toString()) >= toPiasters(item.finalPrice.toString());

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          allocatedPaidAmount: piastersToDecimalString(alloc.newItemPaidPiasters),
          ...(alloc.becomesFullyPaid && !item.entitlementGrantedAt
            ? { entitlementGrantedAt: params.paidAtUtc }
            : {}),
        },
      });

      if (alloc.becomesFullyPaid && !wasFullyPaid) {
        newlyFullyPaidItemIds.push(item.id);
        await this.grantCourseEntitlementTx(tx, {
          userId: order.userId,
          courseId: item.courseId,
          amountCents: toPiasters(item.finalPrice.toString()),
          purchasedAt: params.paidAtUtc,
        });
      }
    }

    await tx.orderPayment.update({
      where: { id: params.paymentId },
      data: {
        allocatedAmount: piastersToDecimalString(totalNewlyAllocatedPiasters),
      },
    });

    const refreshedItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const newPaidPiasters = refreshedItems.reduce(
      (sum, i) => sum + toPiasters(i.allocatedPaidAmount.toString()),
      0,
    );
    const totalOrderPiasters = toPiasters(order.totalAmount.toString());
    const nextOrderStatus =
      newPaidPiasters >= totalOrderPiasters
        ? 'PAID'
        : newPaidPiasters > 0
          ? 'PARTIALLY_PAID'
          : order.status;

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paidAmount: piastersToDecimalString(newPaidPiasters),
        status: nextOrderStatus,
        paidAt: nextOrderStatus === 'PAID' ? order.paidAt ?? params.paidAtUtc : order.paidAt,
      },
    });

    // Evaluate commissions for newly fully paid items (COURSE_PURCHASE only!)
    const createdCommissions = await this.evaluateCommissionsForOrderTx(
      tx,
      order.id,
      params.paidAtUtc,
    );

    return {
      order: updatedOrder,
      newlyAllocatedPiasters: totalNewlyAllocatedPiasters,
      newlyFullyPaidItemIds,
      createdCommissions,
    };
  }

  async grantCourseEntitlementTx(
    tx: Prisma.TransactionClient,
    params: { userId: string; courseId: string; amountCents: number; purchasedAt: Date },
  ) {
    await assertCourseCapacityForEnrollmentTx(tx, {
      courseId: params.courseId,
      userId: params.userId,
    });

    await ensureActiveCourseDirectPurchase(tx, {
      userId: params.userId,
      courseId: params.courseId,
      amountCents: params.amountCents,
      purchasedAt: params.purchasedAt,
    });

    await tx.courseEnrollment.upsert({
      where: {
        userId_courseId: {
          userId: params.userId,
          courseId: params.courseId,
        },
      },
      update: {},
      create: {
        userId: params.userId,
        courseId: params.courseId,
        source: 'DIRECT_ORDER',
        startedAt: params.purchasedAt,
      },
    });
  }

  /**
   * Generates immutable SellerCommission snapshots for each fully paid order item.
   * - Disabled for MONTHLY_MEMBERSHIP & ANNUAL_MEMBERSHIP (pending written business decision).
   * - Strict per-item rule resolution: Seller+Course > Course Default > No rule + admin warning.
   * - Exact integer piaster 50% (or configured) cap calculation.
   * - Hold expiration computed in Africa/Cairo timezone (+14 calendar days).
   */
  async evaluateCommissionsForOrderTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    paidAtUtc: Date,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
        sellerCode: { select: { id: true, allowedCourseIds: true } },
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { commission: true },
        },
      },
    });

    if (!order || !order.sellerId || !order.seller) return [];
    // Policy safeguard: Membership subscriptions never generate seller commissions in v1.2
    if (order.accountingType !== 'COURSE_PURCHASE') {
      return [];
    }

    const allowedCourseIds = order.sellerCode?.allowedCourseIds ?? [];
    const created = [];
    for (const item of order.items) {
      if (item.commission) continue; // @unique orderItemId idempotency guard
      if (
        allowedCourseIds.length > 0 &&
        (!item.courseId || !allowedCourseIds.includes(item.courseId))
      ) {
        continue;
      }
      if (item.entitlementRevokedAt) continue;

      const finalPiasters = toPiasters(item.finalPrice.toString());
      const allocatedPiasters = toPiasters(item.allocatedPaidAmount.toString());
      const refundedPiasters = toPiasters(item.refundedAmount.toString());

      // Item must be fully paid (and net positive) before generating commission
      if (allocatedPiasters < finalPiasters || finalPiasters <= refundedPiasters) {
        continue;
      }

      const rule = await this.rules.resolveRuleForOrderItem(
        tx,
        item.courseId,
        order.sellerId,
        paidAtUtc,
      );

      if (!rule) {
        // v1.2: Do NOT fall back to any global rule; emit explicit admin warning in audit log
        await tx.auditLog.create({
          data: {
            action: 'COMMISSION_RULE_MISSING_WARNING',
            entityType: 'OrderItem',
            entityId: item.id,
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              courseId: item.courseId,
              sellerId: order.sellerId,
              message: 'لا توجد قاعدة عمولة نشطة للكورس أو البائع — لم يتم إنشاء عمولة تلقائية',
            },
          },
        });
        continue;
      }

      const configuredPiasters = toPiasters(rule.fixedAmount.toString());
      const capPercent = Number(rule.capPercent);
      const netPricePiasters = finalPiasters - refundedPiasters;
      const calc = computeCappedCommission({
        fixedCommissionPiasters: configuredPiasters,
        netItemPricePiasters: netPricePiasters,
        capPercent,
      });

      const eligibleAt = addCairoCalendarDays(paidAtUtc, 14);
      const commission = await tx.sellerCommission.create({
        data: {
          sellerId: order.sellerId,
          sellerCodeId: order.sellerCodeId,
          orderId: order.id,
          orderItemId: item.id,
          courseId: item.courseId,
          ruleId: rule.id,
          itemNetPrice: piastersToDecimalString(netPricePiasters),
          allocatedPaidAmount: piastersToDecimalString(allocatedPiasters),
          configuredAmount: piastersToDecimalString(calc.originalPiasters),
          capPercent: capPercent.toFixed(2),
          cappedAmount: piastersToDecimalString(calc.capLimitPiasters),
          appliedAmount: piastersToDecimalString(calc.appliedPiasters),
          reversedAmount: '0.00',
          netAmount: piastersToDecimalString(calc.appliedPiasters),
          status: 'ON_HOLD',
          holdStartsAt: paidAtUtc,
          eligibleAt,
          warningNote: order.isFlaggedSuspicious
            ? order.suspiciousReason || 'طلب مريب بانتظار المراجعة المالية'
            : calc.wasCapped
              ? `تم تطبيق سقف العمولة (${capPercent}%)`
              : null,
        },
      });

      await tx.commissionStatusHistory.create({
        data: {
          commissionId: commission.id,
          fromStatus: null,
          toStatus: 'ON_HOLD',
          reasonAr: 'إنشاء عمولة تلقائي بعد اكتمال سداد البند (فترة الانتظار 14 يوماً بتوقيت القاهرة)',
          metadata: {
            ruleId: rule.id,
            configuredAmount: piastersToDecimalString(calc.originalPiasters),
            cappedAmount: piastersToDecimalString(calc.capLimitPiasters),
            appliedAmount: piastersToDecimalString(calc.appliedPiasters),
            wasCapped: calc.wasCapped,
            eligibleAt: eligibleAt.toISOString(),
          },
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: order.seller.userId,
            type: 'COMMISSION_STATUS_UPDATED',
            titleAr: 'تم تسجيل عمولة جديدة (قيد الانتظار)',
            bodyAr: `تم احتساب عمولة بقيمة ${piastersToDecimalString(calc.appliedPiasters)} ج.م على الطلب ${order.orderNumber} وتصبح مستحقة بعد 14 يوماً.`,
            actionUrl: '/seller',
            dedupKey: `comm-created-${commission.id}`,
            courseId: item.courseId,
          },
        ],
        skipDuplicates: true,
      });

      created.push(commission);
    }

    return created;
  }

  /**
   * Hourly maturation engine: moves ON_HOLD commissions whose eligibleAt <= nowUtc to ELIGIBLE,
   * strictly skipping suspicious/flagged orders, refunded items, or zero-net commissions.
   */
  async runHourlyEligibilityMaturation(nowUtc: Date = new Date()) {
    const candidates = await this.prisma.sellerCommission.findMany({
      where: {
        status: 'ON_HOLD',
        eligibleAt: { lte: nowUtc },
      },
      include: {
        order: { select: { id: true, orderNumber: true, status: true, isFlaggedSuspicious: true } },
        orderItem: { select: { id: true, entitlementRevokedAt: true, refundedAmount: true } },
        seller: { select: { id: true, userId: true } },
      },
    });

    let transitioned = 0;
    let skipped = 0;

    for (const comm of candidates) {
      const netPiasters = toPiasters(comm.netAmount.toString());
      if (
        comm.order.isFlaggedSuspicious ||
        comm.order.status === 'REFUNDED' ||
        comm.order.status === 'CANCELLED' ||
        comm.orderItem.entitlementRevokedAt ||
        netPiasters <= 0
      ) {
        skipped += 1;
        continue;
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const res = await tx.sellerCommission.updateMany({
          where: { id: comm.id, status: 'ON_HOLD' },
          data: { status: 'ELIGIBLE' },
        });
        if (res.count === 0) return false;

        await tx.commissionStatusHistory.create({
          data: {
            commissionId: comm.id,
            fromStatus: 'ON_HOLD',
            toStatus: 'ELIGIBLE',
            reasonAr: 'انتهاء فترة الانتظار (14 يوماً بتوقيت القاهرة) بدون استرداد أو نزاع',
            metadata: { evaluatedAtUtc: nowUtc.toISOString() },
          },
        });

        await tx.notification.createMany({
          data: [
            {
              userId: comm.seller.userId,
              type: 'COMMISSION_STATUS_UPDATED',
              titleAr: 'أصبحت عمولتك مؤهلة للاعتماد',
              bodyAr: `انتهت فترة الانتظار لعمولة الطلب ${comm.order.orderNumber} بقيمة ${comm.netAmount.toString()} ج.م وأصبحت مؤهلة للاعتماد المالي.`,
              actionUrl: '/seller',
              dedupKey: `comm-eligible-${comm.id}`,
              courseId: comm.courseId,
            },
          ],
          skipDuplicates: true,
        });

        return true;
      });

      if (updated) transitioned += 1;
    }

    return {
      evaluatedAtUtc: nowUtc.toISOString(),
      checkedCount: candidates.length,
      transitionedCount: transitioned,
      skippedCount: skipped,
    };
  }
}
