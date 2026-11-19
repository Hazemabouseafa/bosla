import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@bosla/db';
import {
  piastersToDecimalString,
  toPiasters,
  upsertCommissionRuleSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class CommissionRulesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listRules(params: { courseId?: string; sellerId?: string; activeOnly?: boolean }) {
    return this.prisma.sellerCommissionRule.findMany({
      where: {
        ...(params.courseId ? { courseId: params.courseId } : {}),
        ...(params.sellerId !== undefined
          ? { sellerId: params.sellerId === 'DEFAULT' ? null : params.sellerId }
          : {}),
        ...(params.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ courseId: 'asc' }, { sellerId: 'asc' }, { effectiveFrom: 'desc' }],
      include: {
        course: { select: { id: true, slug: true, priceCents: true, publishedVersion: { select: { titleAr: true } } } },
        seller: { select: { id: true, fullName: true, status: true } },
      },
    });
  }

  async createRule(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = upsertCommissionRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات قاعدة العمولة غير صالحة');
    }

    const data = parsed.data;
    const effectiveFrom = new Date(data.effectiveFrom);
    const effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('تاريخ بداية السريان غير صالح');
    }
    if (effectiveTo && (Number.isNaN(effectiveTo.getTime()) || effectiveTo <= effectiveFrom)) {
      throw new BadRequestException('تاريخ نهاية السريان يجب أن يكون بعد تاريخ البداية');
    }

    const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    if (data.sellerId) {
      const seller = await this.prisma.seller.findUnique({ where: { id: data.sellerId } });
      if (!seller) throw new NotFoundException('البائع غير موجود');
    }

    const fixedPiasters = toPiasters(data.fixedAmountEgp);
    const fixedDecimal = piastersToDecimalString(fixedPiasters);

    // Enforce non-overlapping effective periods for identical (courseId, sellerId) scope
    const saved = await this.prisma.$transaction(async (tx) => {
      if (data.isActive) {
        const overlapping = await tx.sellerCommissionRule.findMany({
          where: {
            courseId: data.courseId,
            sellerId: data.sellerId ?? null,
            isActive: true,
          },
        });
        for (const existing of overlapping) {
          const exStart = existing.effectiveFrom.getTime();
          const exEnd = existing.effectiveTo ? existing.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
          const newStart = effectiveFrom.getTime();
          const newEnd = effectiveTo ? effectiveTo.getTime() : Number.POSITIVE_INFINITY;
          if (newStart < exEnd && exStart < newEnd) {
            throw new ConflictException(
              'يوجد تداخل زمني مع قاعدة عمولة نشطة أخرى لنفس الكورس والنطاق. قم بإنهاء أو تعطيل القاعدة السابقة أولاً.',
            );
          }
        }
      }

      return tx.sellerCommissionRule.create({
        data: {
          courseId: data.courseId,
          sellerId: data.sellerId ?? null,
          fixedAmount: fixedDecimal,
          capPercent: data.capPercent.toFixed(2),
          effectiveFrom,
          effectiveTo,
          isActive: data.isActive,
          createdById: actor.id,
        },
      });
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'COMMISSION_RULE_CREATED',
      entityType: 'SellerCommissionRule',
      entityId: saved.id,
      metadata: {
        courseId: saved.courseId,
        sellerId: saved.sellerId,
        fixedAmount: fixedDecimal,
        capPercent: data.capPercent,
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveTo: effectiveTo?.toISOString() ?? null,
      },
      ipAddress,
    });

    return saved;
  }

  async deactivateRule(actor: AuthenticatedContextUser, ruleId: string, ipAddress?: string) {
    const existing = await this.prisma.sellerCommissionRule.findUnique({ where: { id: ruleId } });
    if (!existing) throw new NotFoundException('قاعدة العمولة غير موجودة');

    const updated = await this.prisma.sellerCommissionRule.update({
      where: { id: ruleId },
      data: { isActive: false, effectiveTo: existing.effectiveTo ?? new Date() },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'COMMISSION_RULE_DEACTIVATED',
      entityType: 'SellerCommissionRule',
      entityId: ruleId,
      metadata: { courseId: existing.courseId, sellerId: existing.sellerId },
      ipAddress,
    });

    return updated;
  }

  /**
   * Strict v1.2 Rule Resolution Priority (AT-016..AT-018):
   * 1) Active Seller + Course override rule at `effectiveAt`
   * 2) Active Course Default rule (sellerId = null) at `effectiveAt`
   * 3) None (NEVER falls back to any global rule)
   */
  async resolveRuleForOrderItem(
    tx: Prisma.TransactionClient,
    courseId: string,
    sellerId: string,
    effectiveAt: Date,
  ) {
    const dateFilter = {
      isActive: true,
      effectiveFrom: { lte: effectiveAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }],
    };

    const sellerSpecific = await tx.sellerCommissionRule.findFirst({
      where: { courseId, sellerId, ...dateFilter },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (sellerSpecific) return sellerSpecific;

    const courseDefault = await tx.sellerCommissionRule.findFirst({
      where: { courseId, sellerId: null, ...dateFilter },
      orderBy: { effectiveFrom: 'desc' },
    });
    return courseDefault ?? null;
  }
}
