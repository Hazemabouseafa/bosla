import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  directItemCheckoutSchema,
  evaluateCourseAccess,
  hasAnyRole,
  isAdminRole,
  resolvePlanCourseIds,
  type SystemRoleCode,
} from '@bosla/shared';
import type { CertificateTargetType, UserRole } from '@bosla/db';
import { AuditService } from '../../core/audit.service';
import { lockOfflineEventAndCheckCapacity } from '../../core/event-capacity.helper';
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
          courses: {
            include: {
              course: { select: { id: true, includedInMembership: true } },
            },
          },
          learningPaths: {
            include: {
              learningPath: { select: { id: true, includedInMembership: true } },
            },
          },
          diplomas: {
            include: {
              diploma: { select: { id: true, includedInMembership: true } },
            },
          },
        },
      });

      if (!revision) continue;

      const directIncludedCourseIds = revision.courses
        .filter((c) => c.course?.includedInMembership !== false)
        .map((c) => c.courseId);
      const includedPathIds = revision.learningPaths
        .filter((p) => p.learningPath?.includedInMembership !== false)
        .map((p) => p.learningPathId);
      const includedDiplomaIds = revision.diplomas
        .filter((d) => d.diploma?.includedInMembership !== false)
        .map((d) => d.diplomaId);

      const [pathCourses, diplomaCourses] = await Promise.all([
        includedPathIds.length
          ? this.prisma.learningPathCourse.findMany({
              where: {
                learningPathId: { in: includedPathIds },
                course: { includedInMembership: true },
              },
              select: { learningPathId: true, courseId: true },
            })
          : [],
        includedDiplomaIds.length
          ? this.prisma.diplomaCourse.findMany({
              where: {
                diplomaId: { in: includedDiplomaIds },
                course: { includedInMembership: true },
              },
              select: { diplomaId: true, courseId: true },
            })
          : [],
      ]);

      const entitledCourseIds = resolvePlanCourseIds({
        directCourseIds: directIncludedCourseIds,
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

  async getUserDirectPurchasedEntitlements(userId: string) {
    const purchases = await this.prisma.directPurchase.findMany({
      where: { userId, status: 'ACTIVE', revokedAt: null },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            publishedVersion: { select: { titleAr: true, thumbnailUrl: true } },
          },
        },
        learningPath: { select: { id: true, slug: true, titleAr: true, thumbnailUrl: true } },
        diploma: { select: { id: true, slug: true, titleAr: true, thumbnailUrl: true } },
      },
      orderBy: { purchasedAt: 'desc' },
    });

    const directCourseIds = purchases
      .filter((p) => p.courseId)
      .map((p) => p.courseId!);
    const directPathIds = purchases
      .filter((p) => p.learningPathId)
      .map((p) => p.learningPathId!);
    const directDiplomaIds = purchases
      .filter((p) => p.diplomaId)
      .map((p) => p.diplomaId!);

    const [pathCourses, diplomaCourses] = await Promise.all([
      directPathIds.length
        ? this.prisma.learningPathCourse.findMany({
            where: { learningPathId: { in: directPathIds } },
            select: { learningPathId: true, courseId: true },
          })
        : [],
      directDiplomaIds.length
        ? this.prisma.diplomaCourse.findMany({
            where: { diplomaId: { in: directDiplomaIds } },
            select: { diplomaId: true, courseId: true },
          })
        : [],
    ]);

    const resolvedCourseIds = resolvePlanCourseIds({
      directCourseIds,
      includedPathIds: directPathIds,
      learningPathCourses: pathCourses,
      includedDiplomaIds: directDiplomaIds,
      diplomaCourses,
    });

    return {
      purchases,
      courseIds: resolvedCourseIds,
      pathIds: Array.from(new Set(directPathIds)),
      diplomaIds: Array.from(new Set(directDiplomaIds)),
    };
  }

  async isUserAssignedInstructorForCourse(userId: string, courseId: string): Promise<boolean> {
    const count = await this.prisma.programInstructorAssignment.count({
      where: {
        instructorId: userId,
        courseId,
      },
    });
    return count > 0;
  }

  async checkCourseAccessForUser(params: {
    userId?: string | null;
    userRole?: UserRole | null;
    userRoles?: readonly SystemRoleCode[] | null;
    courseId: string;
    isLessonFreePreview?: boolean;
  }) {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      select: {
        id: true,
        status: true,
        isFree: true,
        includedInMembership: true,
        instructorId: true,
        publishedVersionId: true,
      },
    });
    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }

    const isInstructor = hasAnyRole(['INSTRUCTOR'], params.userRole, params.userRoles);
    const isAdmin = isAdminRole(params.userRole, params.userRoles);

    const [activeSubs, directEntitled, isCoInstructor] = params.userId
      ? await Promise.all([
          this.getUserActiveSubscriptionsWithEntitlements(params.userId),
          this.getUserDirectPurchasedEntitlements(params.userId),
          isInstructor && course.instructorId !== params.userId
            ? this.isUserAssignedInstructorForCourse(params.userId, course.id)
            : Promise.resolve(false),
        ])
      : [[], { courseIds: [], pathIds: [], diplomaIds: [], purchases: [] }, false];

    return evaluateCourseAccess({
      isCoursePublished: course.status === 'PUBLISHED' && Boolean(course.publishedVersionId),
      isCourseFree: course.isFree,
      isLessonFreePreview: Boolean(params.isLessonFreePreview),
      isAdmin,
      isCourseOwnerInstructor: isInstructor && course.instructorId === params.userId,
      isCoInstructor,
      directPurchasedCourseIds: directEntitled.courseIds,
      activeSubscriptions: course.includedInMembership
        ? activeSubs.map((s) => ({
            status: s.subscription.status as any,
            currentPeriodEnd: s.subscription.currentPeriodEnd,
            entitledCourseIds: s.entitledCourseIds,
          }))
        : [],
      courseId: course.id,
    });
  }

  async getMyMembershipSummary(userId: string) {
    const [activeSubs, directEntitled, allSubs, payments] = await Promise.all([
      this.getUserActiveSubscriptionsWithEntitlements(userId),
      this.getUserDirectPurchasedEntitlements(userId),
      this.prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { userId },
        include: {
          plan: { select: { nameAr: true, interval: true } },
          event: { select: { id: true, slug: true, titleAr: true, startsAt: true, cityAr: true } },
          course: {
            select: {
              id: true,
              slug: true,
              publishedVersion: { select: { titleAr: true } },
            },
          },
          learningPath: { select: { id: true, slug: true, titleAr: true } },
          diploma: { select: { id: true, slug: true, titleAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    const entitledCourseIdSet = new Set<string>(directEntitled.courseIds);
    const entitledPathIdSet = new Set<string>(directEntitled.pathIds);
    const entitledDiplomaIdSet = new Set<string>(directEntitled.diplomaIds);
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
      directPurchases: directEntitled.purchases,
      subscriptions: allSubs,
      payments,
      autoRenewSupported: this.paymob.hasRecurringEnabled,
    };
  }

  async initiateDirectItemCheckout(userId: string, rawInput: unknown) {
    const parsed = directItemCheckoutSchema.parse(rawInput);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('الحساب غير نشط لإتمام عملية الاشتراك');
    }

    let amountCents = 0;
    let currency = 'EGP';
    let itemTitleAr = '';
    let courseId: string | null = null;
    let learningPathId: string | null = null;
    let diplomaId: string | null = null;

    if (parsed.targetType === 'COURSE') {
      const course = await this.prisma.course.findFirst({
        where: { OR: [{ id: parsed.targetId }, { slug: parsed.targetId }] },
        include: { publishedVersion: { select: { titleAr: true } } },
      });
      if (!course || course.status !== 'PUBLISHED') {
        throw new NotFoundException('الكورس غير متاح حالياً');
      }
      if (!course.allowIndividualPurchase) {
        throw new BadRequestException('هذا الكورس متاح فقط ضمن باقات العضوية');
      }
      if (course.isFree || course.priceCents <= 0) {
        throw new BadRequestException('هذا الكورس مجاني ولا يتطلب سداد رسوم');
      }
      courseId = course.id;
      amountCents = course.priceCents;
      currency = course.currency || 'EGP';
      itemTitleAr = course.publishedVersion?.titleAr || course.slug;
    } else if (parsed.targetType === 'LEARNING_PATH') {
      const path = await this.prisma.learningPath.findFirst({
        where: { OR: [{ id: parsed.targetId }, { slug: parsed.targetId }] },
      });
      if (!path || path.status !== 'PUBLISHED') {
        throw new NotFoundException('المسار التعليمي غير متاح حالياً');
      }
      if (!path.allowIndividualPurchase || path.priceCents <= 0) {
        throw new BadRequestException('هذا المسار غير متاح للشراء المنفرد حالياً');
      }
      learningPathId = path.id;
      amountCents = path.priceCents;
      currency = path.currency || 'EGP';
      itemTitleAr = path.titleAr;
    } else {
      const diploma = await this.prisma.diploma.findFirst({
        where: { OR: [{ id: parsed.targetId }, { slug: parsed.targetId }] },
      });
      if (!diploma || diploma.status !== 'PUBLISHED') {
        throw new NotFoundException('البرنامج / الدبلومة غير متاحة حالياً');
      }
      if (!diploma.allowIndividualPurchase || diploma.priceCents <= 0) {
        throw new BadRequestException('هذا البرنامج غير متاح للشراء المنفرد حالياً');
      }
      diplomaId = diploma.id;
      amountCents = diploma.priceCents;
      currency = diploma.currency || 'EGP';
      itemTitleAr = diploma.titleAr;
    }

    const merchantOrderId = `BOSLA-PRG-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_URL || 'http://localhost:4000';

    const tx = await this.prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        targetType: parsed.targetType,
        courseId,
        learningPathId,
        diplomaId,
        amountCents,
        currency,
        status: 'INITIATED',
        merchantOrderId,
      },
    });

    const paymobResult = await this.paymob.createCheckout({
      amountCents,
      currency,
      merchantOrderId,
      billingUser: {
        fullName: user.fullName,
        email: user.email,
        phoneE164: user.phoneE164,
      },
      planNameAr: itemTitleAr,
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
      action: 'DIRECT_PROGRAM_CHECKOUT_INITIATED',
      entityType: 'PaymentTransaction',
      entityId: tx.id,
      metadata: {
        targetType: parsed.targetType,
        courseId,
        learningPathId,
        diplomaId,
        amountCents,
        itemTitleAr,
      },
    });

    return {
      transactionId: tx.id,
      merchantOrderId,
      amountCents,
      currency,
      mode: paymobResult.mode,
      checkoutUrl: paymobResult.checkoutUrl,
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
      throw new UnauthorizedException('توقيع التحقق للدفع غير صالح');
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
      include: {
        plan: true,
        event: true,
        eventRegistration: true,
        course: { include: { publishedVersion: { select: { titleAr: true } } } },
        learningPath: true,
        diploma: true,
        directPurchase: true,
      },
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
        if (tx.targetType === 'OFFLINE_EVENT' && tx.eventRegistration) {
          await db.offlineEventRegistration.update({
            where: { id: tx.eventRegistration.id },
            data: {
              status: isRefunded ? 'REFUNDED' : 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
        }
        if (tx.directPurchase) {
          await db.directPurchase.update({
            where: { id: tx.directPurchase.id },
            data: {
              status: isRefunded ? 'REFUNDED' : 'CANCELLED',
              revokedAt: new Date(),
            },
          });
        }
      });
    } else if (isSuccess && !isPending) {
      // Verify paid amount matches expected order amount
      if (Number(obj.amount_cents) !== tx.amountCents) {
        throw new BadRequestException('مبلغ الدفع لا يطابق قيمة الطلب');
      }

      if (tx.targetType === 'OFFLINE_EVENT' && tx.eventId) {
        const eventSettlement = await this.prisma.$transaction(async (db) => {
          const currentTx = await db.paymentTransaction.findUnique({ where: { id: tx.id } });
          if (currentTx?.status === 'PAID') {
            return { activated: false as const, reason: 'ALREADY_PAID' as const };
          }

          const now = new Date();
          if (tx.eventId) {
            const cap = await lockOfflineEventAndCheckCapacity(db, {
              eventId: tx.eventId,
              requestedSeats: tx.eventRegistration?.seatsCount ?? 1,
              excludeRegistrationId: tx.eventRegistration?.id,
            });
            if (!cap.allowed) {
              if (tx.eventRegistration) {
                await db.offlineEventRegistration.update({
                  where: { id: tx.eventRegistration.id },
                  data: { status: 'CANCELLED', cancelledAt: now },
                });
              }
              await db.paymentTransaction.update({
                where: { id: tx.id },
                data: {
                  status: 'FAILED',
                  paymobTransactionId: paymobTxId,
                  rawCallbackPayload: payload as any,
                  verifiedHmac: true,
                  failureReason: 'Event capacity exceeded during webhook settlement',
                },
              });
              return { activated: false as const, reason: 'CAPACITY_EXCEEDED' as const };
            }
          }
          if (tx.eventRegistration) {
            await db.offlineEventRegistration.update({
              where: { id: tx.eventRegistration.id },
              data: {
                status: 'CONFIRMED',
                paidAt: now,
                cancelledAt: null,
              },
            });
          } else {
            const payer = await db.user.findUnique({ where: { id: tx.userId } });
            await db.offlineEventRegistration.create({
              data: {
                eventId: tx.eventId!,
                userId: tx.userId,
                status: 'CONFIRMED',
                ticketCode: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
                seatsCount: 1,
                amountCents: tx.amountCents,
                currency: tx.currency,
                attendeeNameAr: payer?.fullName || 'متدرب بوصلة',
                attendeePhoneE164: payer?.phoneE164 ?? null,
                paymentTransactionId: tx.id,
                paidAt: now,
              },
            });
          }

          await db.paymentTransaction.update({
            where: { id: tx.id },
            data: {
              status: 'PAID',
              paidAt: now,
              paymobTransactionId: paymobTxId,
              paymobOrderId: paymobOrderId ?? tx.paymobOrderId,
              rawCallbackPayload: payload as any,
              verifiedHmac: true,
            },
          });
          return { activated: true as const, reason: 'ACTIVATED' as const };
        });

        if (eventSettlement.activated) {
          await this.audit.log({
            actorId: tx.userId,
            action: 'EVENT_TICKET_ACTIVATED_PAYMOB',
            entityType: 'PaymentTransaction',
            entityId: tx.id,
            metadata: { paymobTxId, merchantOrderId, eventId: tx.eventId },
          });
        } else if (eventSettlement.reason === 'CAPACITY_EXCEEDED') {
          await this.audit.log({
            actorId: tx.userId,
            action: 'EVENT_TICKET_CAPACITY_REJECTED_PAYMOB',
            entityType: 'PaymentTransaction',
            entityId: tx.id,
            metadata: { paymobTxId, merchantOrderId, eventId: tx.eventId },
          });
        }
      } else if (
        tx.targetType === 'COURSE' ||
        tx.targetType === 'LEARNING_PATH' ||
        tx.targetType === 'DIPLOMA'
      ) {
        const certTargetType = tx.targetType as CertificateTargetType;
        await this.prisma.$transaction(async (db) => {
          const currentTx = await db.paymentTransaction.findUnique({ where: { id: tx.id } });
          if (currentTx?.status === 'PAID') {
            return;
          }

          const now = new Date();
          await db.directPurchase.create({
            data: {
              userId: tx.userId,
              targetType: certTargetType,
              courseId: tx.courseId,
              learningPathId: tx.learningPathId,
              diplomaId: tx.diplomaId,
              amountCents: tx.amountCents,
              currency: tx.currency,
              status: 'ACTIVE',
              paymentTransactionId: tx.id,
              purchasedAt: now,
            },
          });

          // Auto-enroll in purchased course(s)
          const enrollCourseIds: string[] = [];
          if (tx.courseId) {
            enrollCourseIds.push(tx.courseId);
          } else if (tx.learningPathId) {
            const links = await db.learningPathCourse.findMany({
              where: { learningPathId: tx.learningPathId },
              select: { courseId: true },
            });
            enrollCourseIds.push(...links.map((l) => l.courseId));
          } else if (tx.diplomaId) {
            const links = await db.diplomaCourse.findMany({
              where: { diplomaId: tx.diplomaId },
              select: { courseId: true },
            });
            enrollCourseIds.push(...links.map((l) => l.courseId));
          }

          for (const cid of enrollCourseIds) {
            await db.courseEnrollment.upsert({
              where: { userId_courseId: { userId: tx.userId, courseId: cid } },
              update: {},
              create: {
                userId: tx.userId,
                courseId: cid,
                source: 'DIRECT_PURCHASE',
              },
            });
          }

          await db.paymentTransaction.update({
            where: { id: tx.id },
            data: {
              status: 'PAID',
              paidAt: now,
              paymobTransactionId: paymobTxId,
              paymobOrderId: paymobOrderId ?? tx.paymobOrderId,
              rawCallbackPayload: payload as any,
              verifiedHmac: true,
            },
          });

          await this.settleProgramPaymentInDb(db, {
            transactionId: tx.id,
            payerUserId: tx.userId,
            targetType: certTargetType,
            courseId: tx.courseId,
            learningPathId: tx.learningPathId,
            diplomaId: tx.diplomaId,
            programTitleSnapshot:
              tx.course?.publishedVersion?.titleAr ||
              tx.learningPath?.titleAr ||
              tx.diploma?.titleAr ||
              'برنامج تدريبي',
            grossAmountCents: tx.amountCents,
            currency: tx.currency,
          });
        });

        await this.audit.log({
          actorId: tx.userId,
          action: 'DIRECT_PROGRAM_PURCHASE_ACTIVATED',
          entityType: 'PaymentTransaction',
          entityId: tx.id,
          metadata: {
            paymobTxId,
            merchantOrderId,
            targetType: tx.targetType,
            courseId: tx.courseId,
            learningPathId: tx.learningPathId,
            diplomaId: tx.diplomaId,
            amountCents: tx.amountCents,
          },
        });
      } else {
        await this.prisma.$transaction(async (db) => {
          const currentTx = await db.paymentTransaction.findUnique({ where: { id: tx.id } });
          if (currentTx?.status === 'PAID') {
            return;
          }
          if (!tx.planId || !tx.plan) {
            throw new BadRequestException('خطة العضوية المرتبطة بالمعاملة غير موجودة');
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
      }
    } else if (!isPending) {
      await this.prisma.$transaction(async (db) => {
        await db.paymentTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'FAILED',
            paymobTransactionId: paymobTxId,
            rawCallbackPayload: payload as any,
            verifiedHmac: true,
            failureReason: String(obj.data?.message || 'Payment declined'),
          },
        });
        if (tx.targetType === 'OFFLINE_EVENT' && tx.eventRegistration) {
          await db.offlineEventRegistration.update({
            where: { id: tx.eventRegistration.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
        }
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
   * Settles a paid Course/Program transaction across:
   * - Rule 3: ProgramFinancialAccount + ProgramLedgerEntry
   * - Rule 4: InstructorFinancialAccount + InstructorStatementEntry (per assigned instructor share %)
   * - Rule 5: Separate FinancialPaymentRecord
   */
  private async settleProgramPaymentInDb(
    db: any,
    params: {
      transactionId: string;
      payerUserId: string;
      targetType: CertificateTargetType;
      courseId?: string | null;
      learningPathId?: string | null;
      diplomaId?: string | null;
      programTitleSnapshot: string;
      grossAmountCents: number;
      currency: string;
    },
  ) {
    // 1. Resolve instructor assignments for this program
    const assignments: Array<{ instructorId: string; revenueSharePercent: number }> =
      await db.programInstructorAssignment.findMany({
        where: {
          ...(params.courseId ? { courseId: params.courseId } : {}),
          ...(params.learningPathId ? { learningPathId: params.learningPathId } : {}),
          ...(params.diplomaId ? { diplomaId: params.diplomaId } : {}),
        },
        select: { instructorId: true, revenueSharePercent: true },
      });

    if (assignments.length === 0 && params.courseId) {
      const course = await db.course.findUnique({
        where: { id: params.courseId },
        select: { instructorId: true },
      });
      if (course?.instructorId) {
        assignments.push({ instructorId: course.instructorId, revenueSharePercent: 35 });
      }
    }

    const allocations = assignments
      .filter((a) => a.revenueSharePercent > 0)
      .map((a) => ({
        instructorId: a.instructorId,
        sharePercent: a.revenueSharePercent,
        netAmountCents: Math.round(params.grossAmountCents * (a.revenueSharePercent / 100)),
      }));

    const totalInstructorShareCents = allocations.reduce((sum, a) => sum + a.netAmountCents, 0);
    const platformShareCents = Math.max(0, params.grossAmountCents - totalInstructorShareCents);

    // 2. Create separate FinancialPaymentRecord (Rule 5)
    const paymentRecord = await db.financialPaymentRecord.create({
      data: {
        referenceCode: `FIN-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        direction: 'INBOUND',
        targetType: params.targetType,
        courseId: params.courseId ?? null,
        learningPathId: params.learningPathId ?? null,
        diplomaId: params.diplomaId ?? null,
        programTitleSnapshot: params.programTitleSnapshot,
        payerUserId: params.payerUserId,
        paymentTransactionId: params.transactionId,
        grossAmountCents: params.grossAmountCents,
        instructorShareCents: totalInstructorShareCents,
        platformShareCents,
        currency: params.currency,
        paymentMethodAr: 'الدفع الإلكتروني',
        status: 'PAID',
        notesAr: `سداد اشتراك مستقل في: ${params.programTitleSnapshot}`,
      },
    });

    // 3. Upsert & credit independent ProgramFinancialAccount (Rule 3)
    const whereProgramAcc = params.courseId
      ? { courseId: params.courseId }
      : params.learningPathId
        ? { learningPathId: params.learningPathId }
        : { diplomaId: params.diplomaId! };

    let programAccount = await db.programFinancialAccount.findUnique({
      where: whereProgramAcc,
    });
    if (!programAccount) {
      programAccount = await db.programFinancialAccount.create({
        data: {
          accountCode: `PRG-${randomUUID().slice(0, 8).toUpperCase()}`,
          targetType: params.targetType,
          courseId: params.courseId ?? null,
          learningPathId: params.learningPathId ?? null,
          diplomaId: params.diplomaId ?? null,
          currency: params.currency,
        },
      });
    }

    const updatedProgramNet = programAccount.netBalanceCents + platformShareCents;
    await db.programFinancialAccount.update({
      where: { id: programAccount.id },
      data: {
        totalGrossRevenueCents: { increment: params.grossAmountCents },
        totalInstructorShareCents: { increment: totalInstructorShareCents },
        totalPlatformShareCents: { increment: platformShareCents },
        netBalanceCents: updatedProgramNet,
      },
    });

    await db.programLedgerEntry.create({
      data: {
        accountId: programAccount.id,
        type: 'CREDIT_PURCHASE',
        amountCents: params.grossAmountCents,
        instructorShareCents: totalInstructorShareCents,
        platformShareCents,
        balanceAfterCents: updatedProgramNet,
        descriptionAr: `إيراد اشتراك متدرب في "${params.programTitleSnapshot}"`,
        paymentRecordId: paymentRecord.id,
        createdById: params.payerUserId,
      },
    });

    // 4. Upsert & credit each assigned Instructor's independent account statement (Rule 4)
    for (const alloc of allocations) {
      let instAccount = await db.instructorFinancialAccount.findUnique({
        where: { instructorId: alloc.instructorId },
      });
      if (!instAccount) {
        instAccount = await db.instructorFinancialAccount.create({
          data: {
            accountCode: `INS-${randomUUID().slice(0, 8).toUpperCase()}`,
            instructorId: alloc.instructorId,
            currency: params.currency,
          },
        });
      }

      const nextPending = instAccount.pendingBalanceCents + alloc.netAmountCents;
      await db.instructorFinancialAccount.update({
        where: { id: instAccount.id },
        data: {
          totalEarnedCents: { increment: alloc.netAmountCents },
          pendingBalanceCents: nextPending,
        },
      });

      await db.instructorStatementEntry.create({
        data: {
          accountId: instAccount.id,
          instructorId: alloc.instructorId,
          type: 'DEBIT_INSTRUCTOR_SHARE',
          targetType: params.targetType,
          courseId: params.courseId ?? null,
          learningPathId: params.learningPathId ?? null,
          diplomaId: params.diplomaId ?? null,
          programTitleSnapshot: params.programTitleSnapshot,
          grossAmountCents: params.grossAmountCents,
          sharePercent: alloc.sharePercent,
          netAmountCents: alloc.netAmountCents,
          balanceAfterCents: nextPending,
          descriptionAr: `نسبة المدرب (${alloc.sharePercent}%) من اشتراك "${params.programTitleSnapshot}"`,
          paymentRecordId: paymentRecord.id,
          createdById: params.payerUserId,
        },
      });
    }
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
      throw new ForbiddenException('الدفع التجريبي غير متاح حالياً');
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
        course: {
          select: {
            id: true,
            slug: true,
            publishedVersion: { select: { titleAr: true, thumbnailUrl: true } },
          },
        },
        learningPath: {
          select: { id: true, slug: true, titleAr: true, thumbnailUrl: true },
        },
        diploma: {
          select: { id: true, slug: true, titleAr: true, thumbnailUrl: true },
        },
        directPurchase: true,
        event: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            cityAr: true,
            venueNameAr: true,
            startsAt: true,
            thumbnailUrl: true,
          },
        },
        eventRegistration: {
          select: {
            id: true,
            ticketCode: true,
            status: true,
            seatsCount: true,
            attendeeNameAr: true,
          },
        },
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
