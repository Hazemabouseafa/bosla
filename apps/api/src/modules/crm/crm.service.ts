import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LeadStatus } from '@bosla/db';
import {
  crmActivitySchema,
  crmLeadCreateSchema,
  crmLeadUpdateSchema,
  marketingCampaignSchema,
  marketingCampaignUpdateSchema,
  normalizePhoneToE164,
  piastersToDecimalString,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

const DEFAULT_PIPELINE_STAGES = [
  { key: 'NEW', nameAr: 'عميل محتمل جديد', sortOrder: 1, colorHex: '#6C4DF6', isDefault: true },
  { key: 'CONTACTED', nameAr: 'تم التواصل', sortOrder: 2, colorHex: '#3B82F6', isDefault: false },
  { key: 'QUALIFIED', nameAr: 'مؤهل للتسجيل', sortOrder: 3, colorHex: '#F5B841', isDefault: false },
  { key: 'PROPOSAL', nameAr: 'عرض سعر / متابعة', sortOrder: 4, colorHex: '#F97316', isDefault: false },
  { key: 'WON', nameAr: 'تم التسجيل', sortOrder: 5, colorHex: '#10B981', isDefault: false },
  { key: 'LOST', nameAr: 'غير مهتم حالياً', sortOrder: 6, colorHex: '#64748B', isDefault: false },
];

@Injectable()
export class CrmService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private mapStageToLeadStatus(stageKey: string): LeadStatus {
    if (stageKey === 'WON' || stageKey === 'LOST') return 'CLOSED';
    if (stageKey === 'QUALIFIED' || stageKey === 'PROPOSAL') return 'QUALIFIED';
    if (stageKey === 'CONTACTED') return 'CONTACTED';
    return 'NEW';
  }

  async listPipelineStages() {
    const existing = await this.prisma.crmPipelineStage.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    if (existing.length >= DEFAULT_PIPELINE_STAGES.length) return existing;
    for (const s of DEFAULT_PIPELINE_STAGES) {
      await this.prisma.crmPipelineStage.upsert({
        where: { key: s.key },
        update: {},
        create: s,
      });
    }
    return this.prisma.crmPipelineStage.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async upsertPipelineStage(body: { key: string; nameAr: string; sortOrder?: number; colorHex?: string }) {
    const key = (body?.key || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!key || !body?.nameAr?.trim()) {
      throw new BadRequestException('معرف واسم المرحلة مطلوبان');
    }
    return this.prisma.crmPipelineStage.upsert({
      where: { key },
      update: {
        nameAr: body.nameAr.trim(),
        ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
        ...(body.colorHex ? { colorHex: body.colorHex } : {}),
      },
      create: {
        key,
        nameAr: body.nameAr.trim(),
        sortOrder: Number(body.sortOrder ?? 10),
        colorHex: body.colorHex || '#6C4DF6',
      },
    });
  }

  async listLeads(params: {
    stage?: string;
    priority?: string;
    type?: string;
    courseId?: string;
    campaignId?: string;
    assignedToId?: string;
    consentOnly?: boolean;
    q?: string;
  }) {
    const now = new Date();
    const stages = await this.listPipelineStages();

    const [leads, allLeadsSummary, overdueFollowUps, upcomingFollowUps, staffMembers, coupons] =
      await Promise.all([
        this.prisma.leadSubmission.findMany({
          where: {
            ...(params.stage ? { pipelineStageKey: params.stage } : {}),
            ...(params.priority ? { priority: params.priority as any } : {}),
            ...(params.type ? { type: params.type as any } : {}),
            ...(params.courseId ? { interestedCourseId: params.courseId } : {}),
            ...(params.campaignId ? { campaignId: params.campaignId } : {}),
            ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
            ...(params.consentOnly ? { consentMarketing: true } : {}),
            ...(params.q?.trim()
              ? {
                  OR: [
                    { fullName: { contains: params.q.trim(), mode: 'insensitive' } },
                    { phoneE164: { contains: params.q.trim() } },
                    { email: { contains: params.q.trim(), mode: 'insensitive' } },
                    { companyName: { contains: params.q.trim(), mode: 'insensitive' } },
                    { interest: { contains: params.q.trim(), mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 250,
          include: {
            interestedCourse: {
              select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } },
            },
            assignedTo: { select: { id: true, fullName: true, role: true } },
            campaign: { select: { id: true, nameAr: true, channel: true } },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: { actor: { select: { id: true, fullName: true } } },
            },
          },
        }),
        this.prisma.leadSubmission.findMany({
          select: {
            id: true,
            phoneE164: true,
            email: true,
            pipelineStageKey: true,
            priority: true,
            consentMarketing: true,
            leadScore: true,
          },
        }),
        this.prisma.leadActivity.findMany({
          where: {
            activityType: 'FOLLOW_UP',
            completedAt: null,
            dueAt: { lte: now },
          },
          orderBy: { dueAt: 'asc' },
          take: 50,
          include: {
            lead: { select: { id: true, fullName: true, phoneE164: true, priority: true, pipelineStageKey: true } },
            actor: { select: { id: true, fullName: true } },
          },
        }),
        this.prisma.leadActivity.findMany({
          where: {
            activityType: 'FOLLOW_UP',
            completedAt: null,
            dueAt: { gt: now },
          },
          orderBy: { dueAt: 'asc' },
          take: 50,
          include: {
            lead: { select: { id: true, fullName: true, phoneE164: true, priority: true, pipelineStageKey: true } },
            actor: { select: { id: true, fullName: true } },
          },
        }),
        this.prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            role: {
              in: ['SUPER_ADMIN', 'ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR', 'SUPPORT'],
            },
          },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, role: true },
        }),
        this.prisma.coupon.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, discountType: true, discountValue: true },
        }),
      ]);

    const byStage: Record<string, number> = {};
    for (const st of stages) {
      byStage[st.key] = 0;
    }
    const phoneCounts = new Map<string, number>();
    let consentedCount = 0;
    let highPriorityCount = 0;

    for (const row of allLeadsSummary) {
      byStage[row.pipelineStageKey] = (byStage[row.pipelineStageKey] || 0) + 1;
      phoneCounts.set(row.phoneE164, (phoneCounts.get(row.phoneE164) || 0) + 1);
      if (row.consentMarketing) consentedCount += 1;
      if (row.priority === 'HIGH') highPriorityCount += 1;
    }

    const duplicatePhoneGroups = Array.from(phoneCounts.values()).filter((c) => c > 1).length;
    const totalLeads = allLeadsSummary.length;
    const wonCount = byStage.WON || 0;
    const qualifiedAndProposalCount = (byStage.QUALIFIED || 0) + (byStage.PROPOSAL || 0);
    const conversionRatePercent =
      totalLeads > 0 ? Number(((wonCount / totalLeads) * 100).toFixed(1)) : 0;

    // Annotate duplicate flag on returned leads
    const enrichedLeads = leads.map((l) => ({
      ...l,
      isDuplicatePhone: (phoneCounts.get(l.phoneE164) || 0) > 1,
    }));

    return {
      leads: enrichedLeads,
      stages,
      overdueFollowUps,
      upcomingFollowUps,
      staffMembers,
      coupons,
      kpis: {
        totalLeads,
        newLeadsCount: byStage.NEW || 0,
        contactedCount: byStage.CONTACTED || 0,
        qualifiedAndProposalCount,
        wonCount,
        lostCount: byStage.LOST || 0,
        conversionRatePercent,
        consentedCount,
        highPriorityCount,
        duplicatePhoneGroups,
        overdueFollowUpsCount: overdueFollowUps.length,
        upcomingFollowUpsCount: upcomingFollowUps.length,
        byStage,
      },
    };
  }

  async createLead(actor: AuthenticatedContextUser | undefined, body: unknown, ipAddress?: string) {
    const parsed = crmLeadCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات العميل المحتمل غير صالحة');
    }

    const d = parsed.data;
    const phoneE164 = normalizePhoneToE164(d.phoneNumber, '+20');
    if (!phoneE164) {
      throw new BadRequestException('رقم الهاتف غير صالح — يرجى إدخال رقم هاتف صحيح');
    }
    const normalizedEmail = d.email?.trim().toLowerCase() || null;

    // Duplicate detection by normalized phone or email
    const duplicate = await this.prisma.leadSubmission.findFirst({
      where: {
        OR: [
          { phoneE164 },
          ...(normalizedEmail ? [{ email: { equals: normalizedEmail, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const stageKey = d.pipelineStageKey || 'NEW';
    const mappedStatus = this.mapStageToLeadStatus(stageKey);

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leadSubmission.create({
        data: {
          type: d.type,
          fullName: d.fullName,
          companyName: d.companyName ?? null,
          phoneE164,
          email: normalizedEmail,
          roleLabel: d.roleLabel ?? null,
          sector: d.sector ?? null,
          teamSize: d.teamSize ?? null,
          timeline: d.timeline ?? null,
          interest: d.interest ?? null,
          interestedCourseId: d.interestedCourseId ?? null,
          leadScore: d.leadScore ?? (d.priority === 'HIGH' ? 85 : d.priority === 'MEDIUM' ? 60 : 35),
          priority: d.priority,
          pipelineStageKey: stageKey,
          assignedToId: d.assignedToId ?? actor?.id ?? null,
          campaignId: d.campaignId ?? null,
          consentMarketing: d.consentMarketing,
          notes: d.notes ?? null,
          status: mappedStatus,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          actorId: actor?.id ?? null,
          activityType: 'NOTE',
          summaryAr: duplicate
            ? `تم تسجيل العميل المحتمل (تنبيه: رقم هاتف أو بريد مطابق لسجل سابق #${duplicate.id.slice(-6)})`
            : 'تم تسجيل العميل المحتمل في مسار المبيعات (CRM)',
        },
      });

      return created;
    });

    if (actor) {
      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CRM_LEAD_CREATED',
        entityType: 'LeadSubmission',
        entityId: lead.id,
        metadata: {
          phoneE164,
          duplicateDetected: Boolean(duplicate),
          existingLeadId: duplicate?.id ?? null,
          stageKey,
        },
        ipAddress,
      });
    }

    return {
      lead,
      duplicateDetected: Boolean(duplicate),
      existingLeadId: duplicate?.id ?? null,
      existingLeadName: duplicate?.fullName ?? null,
    };
  }

  async updateLead(
    actor: AuthenticatedContextUser,
    leadId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = crmLeadUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التحديث غير صالحة');
    }

    const existing = await this.prisma.leadSubmission.findUnique({ where: { id: leadId } });
    if (!existing) throw new NotFoundException('سجل العميل المحتمل غير موجود');

    const d = parsed.data;
    let phoneE164: string | undefined;
    if (d.phoneNumber !== undefined) {
      const norm = normalizePhoneToE164(d.phoneNumber, '+20');
      if (!norm) throw new BadRequestException('رقم الهاتف غير صالح');
      phoneE164 = norm;
    }

    const nextStage = d.pipelineStageKey ?? existing.pipelineStageKey;
    const stageChanged = d.pipelineStageKey !== undefined && d.pipelineStageKey !== existing.pipelineStageKey;
    const nextStatus = this.mapStageToLeadStatus(nextStage);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.leadSubmission.update({
        where: { id: leadId },
        data: {
          ...(d.type !== undefined ? { type: d.type } : {}),
          ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
          ...(d.companyName !== undefined ? { companyName: d.companyName } : {}),
          ...(phoneE164 !== undefined ? { phoneE164 } : {}),
          ...(d.email !== undefined ? { email: d.email ? d.email.toLowerCase() : null } : {}),
          ...(d.roleLabel !== undefined ? { roleLabel: d.roleLabel } : {}),
          ...(d.sector !== undefined ? { sector: d.sector } : {}),
          ...(d.teamSize !== undefined ? { teamSize: d.teamSize } : {}),
          ...(d.timeline !== undefined ? { timeline: d.timeline } : {}),
          ...(d.interest !== undefined ? { interest: d.interest } : {}),
          ...(d.interestedCourseId !== undefined ? { interestedCourseId: d.interestedCourseId } : {}),
          ...(d.leadScore !== undefined ? { leadScore: d.leadScore } : {}),
          ...(d.priority !== undefined ? { priority: d.priority } : {}),
          ...(d.pipelineStageKey !== undefined
            ? { pipelineStageKey: d.pipelineStageKey, status: nextStatus }
            : {}),
          ...(d.assignedToId !== undefined ? { assignedToId: d.assignedToId } : {}),
          ...(d.campaignId !== undefined ? { campaignId: d.campaignId } : {}),
          ...(d.consentMarketing !== undefined ? { consentMarketing: d.consentMarketing } : {}),
          ...(d.notes !== undefined ? { notes: d.notes } : {}),
        },
      });

      if (stageChanged) {
        await tx.leadActivity.create({
          data: {
            leadId: saved.id,
            actorId: actor.id,
            activityType: 'STAGE_CHANGE',
            summaryAr: `تم نقل العميل من مرحلة (${existing.pipelineStageKey}) إلى (${nextStage})`,
          },
        });
      }

      return saved;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CRM_LEAD_UPDATED',
      entityType: 'LeadSubmission',
      entityId: leadId,
      metadata: {
        previousStage: existing.pipelineStageKey,
        newStage: updated.pipelineStageKey,
        priority: updated.priority,
      },
      ipAddress,
    });

    return updated;
  }

  async deleteLead(actor: AuthenticatedContextUser, leadId: string, ipAddress?: string) {
    const existing = await this.prisma.leadSubmission.findUnique({ where: { id: leadId } });
    if (!existing) throw new NotFoundException('سجل العميل المحتمل غير موجود');

    await this.prisma.leadSubmission.delete({ where: { id: leadId } });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CRM_LEAD_DELETED',
      entityType: 'LeadSubmission',
      entityId: leadId,
      metadata: { fullName: existing.fullName, phoneE164: existing.phoneE164 },
      ipAddress,
    });

    return { deleted: true, id: leadId };
  }

  async addLeadActivity(
    actor: AuthenticatedContextUser,
    leadId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = crmActivitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات النشاط غير صالحة');
    }

    const lead = await this.prisma.leadSubmission.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('سجل العميل المحتمل غير موجود');

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          actorId: actor.id,
          activityType: parsed.data.activityType,
          summaryAr: parsed.data.summaryAr,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        },
        include: { actor: { select: { id: true, fullName: true } } },
      });

      if (parsed.data.pipelineStageKey) {
        const mappedStatus = this.mapStageToLeadStatus(parsed.data.pipelineStageKey);
        await tx.leadSubmission.update({
          where: { id: lead.id },
          data: {
            pipelineStageKey: parsed.data.pipelineStageKey,
            status: mappedStatus,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CRM_LEAD_ACTIVITY_LOGGED',
      entityType: 'LeadSubmission',
      entityId: lead.id,
      metadata: { activityType: parsed.data.activityType, stage: parsed.data.pipelineStageKey ?? null },
      ipAddress,
    });

    return activity;
  }

  async completeFollowUpActivity(
    actor: AuthenticatedContextUser,
    activityId: string,
    ipAddress?: string,
  ) {
    const act = await this.prisma.leadActivity.findUnique({ where: { id: activityId } });
    if (!act) throw new NotFoundException('نشاط المتابعة غير موجود');

    const updated = await this.prisma.leadActivity.update({
      where: { id: activityId },
      data: { completedAt: new Date() },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CRM_FOLLOWUP_COMPLETED',
      entityType: 'LeadActivity',
      entityId: activityId,
      metadata: { leadId: act.leadId },
      ipAddress,
    });

    return updated;
  }

  async listCampaignsWithMetrics() {
    const campaigns = await this.prisma.marketingCampaign.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        coupon: {
          include: {
            orders: {
              where: { status: { in: ['PAID', 'PARTIALLY_PAID'] } },
              select: { id: true, paidAmount: true },
            },
          },
        },
        _count: { select: { leads: true } },
        leads: { select: { id: true, pipelineStageKey: true, phoneE164: true } },
      },
    });

    return campaigns.map((c) => {
      const spendPiasters = toPiasters(c.spendAmount.toString());
      const budgetPiasters = toPiasters(c.budgetAmount.toString());
      const wonLeads = c.leads.filter((l) => l.pipelineStageKey === 'WON').length;
      const qualifiedLeads = c.leads.filter(
        (l) => l.pipelineStageKey === 'QUALIFIED' || l.pipelineStageKey === 'PROPOSAL' || l.pipelineStageKey === 'WON',
      ).length;
      const attributedRevenuePiasters = (c.coupon?.orders ?? []).reduce(
        (sum, o) => sum + toPiasters(o.paidAmount.toString()),
        0,
      );
      const cacEgp = wonLeads > 0 ? Math.round(spendPiasters / wonLeads) / 100 : null;
      const cplEgp = c._count.leads > 0 ? Math.round(spendPiasters / c._count.leads) / 100 : null;
      const roas = spendPiasters > 0 ? Number((attributedRevenuePiasters / spendPiasters).toFixed(2)) : null;

      return {
        id: c.id,
        nameAr: c.nameAr,
        channel: c.channel,
        budgetEgp: budgetPiasters / 100,
        spendEgp: spendPiasters / 100,
        startDate: c.startDate,
        endDate: c.endDate,
        couponId: c.couponId,
        couponCode: c.coupon?.code ?? null,
        totalLeads: c._count.leads,
        qualifiedLeads,
        wonLeads,
        conversionRatePercent:
          c._count.leads > 0 ? Number(((wonLeads / c._count.leads) * 100).toFixed(1)) : 0,
        attributedRevenueEgp: attributedRevenuePiasters / 100,
        cplEgp,
        cacEgp,
        roas,
        notesAr: c.notesAr,
      };
    });
  }

  async createCampaign(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = marketingCampaignSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الحملة غير صالحة');
    }

    const saved = await this.prisma.marketingCampaign.create({
      data: {
        nameAr: parsed.data.nameAr,
        channel: parsed.data.channel,
        budgetAmount: piastersToDecimalString(toPiasters(parsed.data.budgetEgp)),
        spendAmount: piastersToDecimalString(toPiasters(parsed.data.spendEgp)),
        couponId: parsed.data.couponId ?? null,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        notesAr: parsed.data.notesAr ?? null,
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'MARKETING_CAMPAIGN_CREATED',
      entityType: 'MarketingCampaign',
      entityId: saved.id,
      metadata: { nameAr: saved.nameAr, channel: saved.channel },
      ipAddress,
    });

    return saved;
  }

  async updateCampaign(
    actor: AuthenticatedContextUser,
    campaignId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = marketingCampaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات تحديث الحملة غير صالحة');
    }

    const existing = await this.prisma.marketingCampaign.findUnique({ where: { id: campaignId } });
    if (!existing) throw new NotFoundException('الحملة التسويقية غير موجودة');

    const d = parsed.data;
    const saved = await this.prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        ...(d.nameAr !== undefined ? { nameAr: d.nameAr } : {}),
        ...(d.channel !== undefined ? { channel: d.channel } : {}),
        ...(d.budgetEgp !== undefined
          ? { budgetAmount: piastersToDecimalString(toPiasters(d.budgetEgp)) }
          : {}),
        ...(d.spendEgp !== undefined
          ? { spendAmount: piastersToDecimalString(toPiasters(d.spendEgp)) }
          : {}),
        ...(d.couponId !== undefined ? { couponId: d.couponId } : {}),
        ...(d.startDate !== undefined ? { startDate: new Date(d.startDate) } : {}),
        ...(d.endDate !== undefined ? { endDate: d.endDate ? new Date(d.endDate) : null } : {}),
        ...(d.notesAr !== undefined ? { notesAr: d.notesAr } : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'MARKETING_CAMPAIGN_UPDATED',
      entityType: 'MarketingCampaign',
      entityId: saved.id,
      metadata: { nameAr: saved.nameAr, spendAmount: saved.spendAmount.toString() },
      ipAddress,
    });

    return saved;
  }
}
