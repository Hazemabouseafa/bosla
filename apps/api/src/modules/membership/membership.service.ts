import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { evaluateCourseAccess, resolvePlanCourseIds } from '@bosla/shared';
import type { UserRole } from '@bosla/db';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { PaymobClient } from './paymob.client';

@Injectable()
export class MembershipService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymobClient) private readonly paymob: PaymobClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listPublicPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { isActive: true, isVisible: true },
      orderBy: { sortOrder: 'asc' },
    });

    const enriched = await Promise.all(
      plans.map(async (plan) => {
        const rev = plan.currentRevisionId
          ? await this.prisma.membershipPlanRevision.findUnique({
              where: { id: plan.currentRevisionId },
              include: {
                courses: {
                  include: {
                    course: {
                      select: {
                        id: true,
                        slug: true,
                        status: true,
                        publishedVersion: { select: { titleAr: true } },
                      },
                    },
                  },
                },
                learningPaths: {
                  include: {
                    learningPath: { select: { id: true, slug: true, titleAr: true, status: true } },
                  },
                },
                diplomas: {
                  include: {
                    diploma: { select: { id: true, slug: true, titleAr: true, status: true } },
                  },
                },
              },
            })
          : null;
        return {
          ...plan,
          autoRenewSupported: this.paymob.hasRecurringEnabled,
          includedContent: rev
            ? {
                courses: rev.courses.map((c) => c.course).filter((c) => c.status === 'PUBLISHED'),
                learningPaths: rev.learningPaths
                  .map((p) => p.learningPath)
                  .filter((p) => p.status === 'PUBLISHED'),
                diplomas: rev.diplomas.map((d) => d.diploma).filter((d) => d.status === 'PUBLISHED'),
              }
            : { courses: [], learningPaths: [], diplomas: [] },
        };
      }),
    );

    return enriched;
  }

  /**
   * Lazily expires overdue subscriptions and resolves all deduplicated entitled course IDs
   * for the user's active memberships.
   */
  async getUserActiveSubscriptionsWithEntitlements(userId: string) {
    const now = new Date();
    // Mark overdue ACTIVE subscriptions as EXPIRED immediately
    await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        expiredAt: now,
      },
    });

    const activeSubs = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now },
      },
      include: {
        plan: true,
        planRevision: true,
      },
    });

    const results: Array<{
      subscription: (typeof activeSubs)[number];
      entitledCourseIds: string[];
      entitledPathIds: string[];
      entitledDiplomaIds: string[];
    }> = [];

    for (const sub of activeSubs) {
      const targetRevisionId =
        sub.planRevision.entitlementMode === 'FOLLOW_LATEST_PLAN' && sub.plan.currentRevisionId
          ? sub.plan.currentRevisionId
          : sub.planRevisionId;

      const revision = await this.prisma.membershipPlanRevision.findUnique({
        where: { id: targetRevisionId },
        include: {
          courses: true,
          learningPaths: true,
          diplomas: true,
        },
      });

      if (!revision) continue;

      const includedPathIds = revision.learningPaths.map((p) => p.learningPathId);
      const includedDiplomaIds = revision.diplomas.map((d) => d.diplomaId);

      const [pathCourses, diplomaCourses] = await Promise.all([
        includedPathIds.length
          ? this.prisma.learningPathCourse.findMany({
              where: { learningPathId: { in: includedPathIds } },
              select: { learningPathId: true, courseId: true },
            })
          : [],
        includedDiplomaIds.length
          ? this.prisma.diplomaCourse.findMany({
              where: { diplomaId: { in: includedDiplomaIds } },
              select: { diplomaId: true, courseId: true },
            })
          : [],
      ]);

      const entitledCourseIds = resolvePlanCourseIds({
        directCourseIds: revision.courses.map((c) => c.courseId),
        includedPathIds,
        learningPathCourses: pathCourses,
        includedDiplomaIds,
        diplomaCourses,
      });

      results.push({
        subscription: sub,
        entitledCourseIds,
        entitledPathIds: includedPathIds,
        entitledDiplomaIds: includedDiplomaIds,
      });
    }

    return results;
  }

  async checkCourseAccessForUser(params: {
    userId?: string | null;
    userRole?: UserRole | null;
    courseId: string;
    isLessonFreePreview?: boolean;
  }) {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      select: {
        id: true,
        status: true,
        isFree: true,
        instructorId: true,
        publishedVersionId: true,
      },
    });
    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }

    const activeSubs = params.userId
      ? await this.getUserActiveSubscriptionsWithEntitlements(params.userId)
      : [];

    return evaluateCourseAccess({
      isCoursePublished: course.status === 'PUBLISHED' && Boolean(course.publishedVersionId),
      isCourseFree: course.isFree,
      isLessonFreePreview: Boolean(params.isLessonFreePreview),
      isAdmin: params.userRole === 'ADMIN',
      isCourseOwnerInstructor:
        params.userRole === 'INSTRUCTOR' && course.instructorId === params.userId,
      activeSubscriptions: activeSubs.map((s) => ({
        status: s.subscription.status as any,
        currentPeriodEnd: s.subscription.currentPeriodEnd,
        entitledCourseIds: s.entitledCourseIds,
      })),
      courseId: course.id,
    });
  }

  async getMyMembershipSummary(userId: string) {
    const activeSubs = await this.getUserActiveSubscriptionsWithEntitlements(userId);
    const allSubs = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const payments = await this.prisma.paymentTransaction.findMany({
      where: { userId },
      include: { plan: { select: { nameAr: true, interval: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const entitledCourseIdSet = new Set<string>();
    const entitledPathIdSet = new Set<string>();
    const entitledDiplomaIdSet = new Set<string>();
    for (const s of activeSubs) {
      s.entitledCourseIds.forEach((id) => entitledCourseIdSet.add(id));
      s.entitledPathIds.forEach((id) => entitledPathIdSet.add(id));
      s.entitledDiplomaIds.forEach((id) => entitledDiplomaIdSet.add(id));
    }

    return {
      activeSubscription: activeSubs[0]?.subscription ?? null,
      entitledCourseIds: Array.from(entitledCourseIdSet),
      entitledPathIds: Array.from(entitledPathIdSet),
      entitledDiplomaIds: Array.from(entitledDiplomaIdSet),
      subscriptions: allSubs,
      payments,
      autoRenewSupported: this.paymob.hasRecurringEnabled,
    };
  }

  async initiateCheckout(userId: string, planId: string) {
    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.membershipPlan.findUnique({ where: { id: planId } }),
    ]);

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('الحساب غير نشط لإتمام الاشتراك');
    }
    if (!plan || !plan.isActive || !plan.currentRevisionId) {
      throw new NotFoundException('خطة العضوية غير متاحة حاليًا');
    }

    const merchantOrderId = `BOSLA-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_URL || 'http://localhost:4000';

    const tx = await this.prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: 'INITIATED',
        merchantOrderId,
      },
    });

    const paymobResult = await this.paymob.createCheckout({
      amountCents: plan.priceCents,
      currency: plan.currency,
      merchantOrderId,
      billingUser: {
        fullName: user.fullName,
        email: user.email,
        phoneE164: user.phoneE164,
      },
      planNameAr: plan.nameAr,
      returnUrl: `${appUrl}/membership/checkout-result?merchantOrderId=${encodeURIComponent(
        merchantOrderId,
      )}`,
      webhookUrl: `${apiUrl}/api/v1/payments/paymob/webhook`,
    });

    await this.prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'PENDING',
        paymobOrderId: paymobResult.paymobOrderId,
        paymobIntentionId: paymobResult.paymobIntentionId,
        paymentKey: paymobResult.paymentKey,
        rawInitPayload: paymobResult.rawPayload as any,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_CHECKOUT_INITIATED',
      entityType: 'PaymentTransaction',
      entityId: tx.id,
      metadata: { planId: plan.id, amountCents: plan.priceCents, mode: paymobResult.mode },
    });

    return {
      transactionId: tx.id,
      merchantOrderId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      mode: paymobResult.mode,
      checkoutUrl: paymobResult.checkoutUrl,
    };
  }

  /**
   * Processes authenticated Paymob transaction webhook idempotently.
   */
  async processPaymobWebhook(payload: Record<string, any>, queryHmac?: string) {
    const obj = payload.obj ?? payload;
    const hmacProvided = queryHmac || payload.hmac;
    const signatureValid = this.paymob.verifyTransactionHmac(obj, hmacProvided);

    const externalEventId = `paymob_${obj.id ?? obj.order?.merchant_order_id ?? randomUUID()}_${
      obj.success
    }_${obj.is_refunded}`;

    if (!signatureValid) {
      await this.prisma.webhookEvent
        .create({
          data: {
            provider: 'PAYMOB',
            externalEventId: `invalid_${randomUUID()}`,
            eventType: String(payload.type || 'TRANSACTION'),
            signatureValid: false,
            payload: payload as any,
            processingError: 'Invalid Paymob HMAC signature',
          },
        })
        .catch(() => {});
      throw new UnauthorizedException('توقيع Paymob HMAC غير صالح');
    }

    // Check duplicate webhook idempotency via unique externalEventId
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { externalEventId },
    });
    if (existingEvent) {
      return { deduplicated: true, processedAt: existingEvent.processedAt };
    }

    await this.prisma.webhookEvent.create({
      data: {
        provider: 'PAYMOB',
        externalEventId,
        eventType: String(payload.type || 'TRANSACTION'),
        signatureValid: true,
        payload: payload as any,
      },
    });

    const paymobTxId = obj.id ? String(obj.id) : undefined;
    const merchantOrderId = obj.order?.merchant_order_id
      ? String(obj.order.merchant_order_id)
      : undefined;
    const paymobOrderId = obj.order?.id ? String(obj.order.id) : undefined;

    const tx = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          ...(merchantOrderId ? [{ merchantOrderId }] : []),
          ...(paymobOrderId ? [{ paymobOrderId }] : []),
        ],
      },
      include: { plan: true },
    });

    if (!tx) {
      await this.prisma.webhookEvent.update({
        where: { externalEventId },
        data: { processingError: 'Transaction not found' },
      });
      throw new NotFoundException('معاملة الدفع غير موجودة');
    }

    // If this exact paymobTransactionId was already settled to PAID, skip idempotently
    const isSuccess = obj.success === true || obj.success === 'true';
    const isRefunded = obj.is_refunded === true || obj.is_refunded === 'true';
    const isVoided = obj.is_voided === true || obj.is_voided === 'true';
    const isPending = obj.pending === true || obj.pending === 'true';

    if (tx.status === 'PAID' && tx.paymobTransactionId === paymobTxId && !isRefunded && !isVoided) {
      await this.prisma.webhookEvent.update({
        where: { externalEventId },
        data: { processedAt: new Date() },
      });
      return { deduplicated: true, transactionId: tx.id, status: tx.status };
    }

    if (isRefunded || isVoided) {
      await this.prisma.$transaction(async (db) => {
        await db.paymentTransaction.update({
          where: { id: tx.id },
          data: {
            status: isRefunded ? 'REFUNDED' : 'CANCELLED',
            refundedAt: new Date(),
            paymobTransactionId: paymobTxId ?? tx.paymobTransactionId,
            rawCallbackPayload: payload as any,
            verifiedHmac: true,
          },
        });
        if (tx.subscriptionId) {
          await db.subscription.update({
            where: { id: tx.subscriptionId },
            data: { status: 'REFUNDED', cancelledAt: new Date() },
          });
        }
      });
    } else if (isSuccess && !isPending) {
      // Verify paid amount matches expected plan amount
      if (Number(obj.amount_cents) !== tx.amountCents) {
        throw new BadRequestException('مبلغ الدفع لا يطابق قيمة الخطة');
      }

      await this.prisma.$transaction(async (db) => {
        const currentTx = await db.paymentTransaction.findUnique({ where: { id: tx.id } });
        if (currentTx?.status === 'PAID') {
          return;
        }

        const now = new Date();
        // Check if user already has an active subscription to extend/renew seamlessly
        const existingActive = await db.subscription.findFirst({
          where: {
            userId: tx.userId,
            status: 'ACTIVE',
            currentPeriodEnd: { gt: now },
          },
          orderBy: { currentPeriodEnd: 'desc' },
        });

        const baseStart = existingActive ? existingActive.currentPeriodEnd : now;
        const durationDays = tx.plan.interval === 'ANNUAL' ? 365 : 30;
        const periodEnd = new Date(baseStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

        const revisionId = tx.plan.currentRevisionId!;
        const sub = await db.subscription.create({
          data: {
            userId: tx.userId,
            planId: tx.planId,
            planRevisionId: revisionId,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            autoRenewSupported: this.paymob.hasRecurringEnabled,
          },
        });

        await db.paymentTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'PAID',
            paidAt: now,
            subscriptionId: sub.id,
            paymobTransactionId: paymobTxId,
            paymobOrderId: paymobOrderId ?? tx.paymobOrderId,
            rawCallbackPayload: payload as any,
            verifiedHmac: true,
          },
        });
      });

      await this.audit.log({
        actorId: tx.userId,
        action: 'SUBSCRIPTION_ACTIVATED_PAYMOB',
        entityType: 'PaymentTransaction',
        entityId: tx.id,
        metadata: { paymobTxId, merchantOrderId },
      });
    } else if (!isPending) {
      await this.prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          paymobTransactionId: paymobTxId,
          rawCallbackPayload: payload as any,
          verifiedHmac: true,
          failureReason: String(obj.data?.message || 'Payment declined'),
        },
      });
    }

    await this.prisma.webhookEvent.update({
      where: { externalEventId },
      data: { processedAt: new Date() },
    });

    const updated = await this.prisma.paymentTransaction.findUnique({ where: { id: tx.id } });
    return {
      deduplicated: false,
      transactionId: tx.id,
      status: updated?.status,
    };
  }

  /**
   * Sandbox-only helper endpoint that builds a validly HMAC-signed Paymob webhook payload
   * and feeds it directly through the exact same verified processPaymobWebhook pipeline.
   * Disabled completely when PAYMOB_MODE=live.
   */
  async triggerSandboxOutcome(
    userId: string,
    merchantOrderId: string,
    outcome: 'PAID' | 'FAILED',
  ) {
    if (!this.paymob.isSandboxMode) {
      throw new ForbiddenException('محاكي Paymob متاح في وضع Sandbox فقط');
    }

    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { merchantOrderId },
    });
    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('معاملة الدفع غير موجودة');
    }

    const secret = process.env.PAYMOB_HMAC_SECRET || 'bosla_sandbox_hmac_secret';
    const obj: Record<string, any> = {
      id: Math.floor(100000000 + Math.random() * 900000000),
      pending: false,
      amount_cents: tx.amountCents,
      success: outcome === 'PAID',
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      is_voided: false,
      is_refunded: false,
      is_3d_secure: true,
      integration_id: Number(process.env.PAYMOB_INTEGRATION_ID_CARD || 1),
      has_parent_transaction: false,
      order: {
        id: tx.paymobOrderId || 900001,
        merchant_order_id: tx.merchantOrderId,
      },
      created_at: new Date().toISOString(),
      currency: tx.currency,
      source_data: {
        type: 'card',
        pan: '2346',
        sub_type: 'MasterCard',
      },
      owner: 1,
      error_occured: outcome === 'FAILED',
      data: {
        message: outcome === 'PAID' ? 'Approved' : 'Sandbox test card declined',
      },
    };

    const hmac = this.paymob.computeTransactionHmac(obj, secret);
    return this.processPaymobWebhook({ type: 'TRANSACTION', obj }, hmac);
  }

  async getTransactionStatus(userId: string, merchantOrderId: string) {
    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { merchantOrderId },
      include: {
        plan: { select: { nameAr: true, interval: true } },
        subscription: true,
      },
    });
    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('معاملة الدفع غير موجودة');
    }
    return tx;
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub || sub.userId !== userId) {
      throw new NotFoundException('الاشتراك غير موجود');
    }
    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('لا يمكن إلغاء اشتراك غير نشط');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SUBSCRIPTION_CANCEL_REQUESTED',
      entityType: 'Subscription',
      entityId: sub.id,
    });

    return updated;
  }
}
