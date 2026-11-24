import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  normalizePhoneToE164,
  organizationBulkEnrollSchema,
  organizationContractCreateSchema,
  organizationCreateSchema,
  organizationMemberAssignSchema,
  piastersToDecimalString,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import {
  ensureActiveCourseDirectPurchase,
  revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant,
} from '../../core/course-entitlement.helper';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async assertOrgAccess(user: AuthenticatedContextUser, organizationId: string) {
    if (
      user.permissions.includes('b2b.manage') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN')
    ) {
      return;
    }
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!membership || membership.orgRole !== 'ORG_ADMIN') {
      throw new ForbiddenException('لا تملك صلاحية إدارة هذه المؤسسة');
    }
  }

  async listOrganizations(user: AuthenticatedContextUser) {
    const canSeeAll =
      user.permissions.includes('b2b.manage') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    return this.prisma.organization.findMany({
      where: canSeeAll
        ? undefined
        : {
            members: {
              some: { userId: user.id, orgRole: 'ORG_ADMIN' },
            },
          },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, cohorts: true, contracts: true } },
      },
    });
  }

  async createOrganization(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = organizationCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات المؤسسة غير صالحة');
    }

    const d = parsed.data;
    const contactPhone = normalizePhoneToE164(d.contactPhone, '+20');
    if (!contactPhone) {
      throw new BadRequestException('رقم هاتف التواصل غير صالح');
    }
    const saved = await this.prisma.organization.create({
      data: {
        nameAr: d.nameAr,
        type: d.type,
        taxNumber: d.taxNumber ?? null,
        contactNameAr: d.contactNameAr,
        contactPhone,
        contactEmail: d.contactEmail ?? null,
        seatCapacity: d.seatCapacity,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORGANIZATION_CREATED',
      entityType: 'Organization',
      entityId: saved.id,
      metadata: { nameAr: saved.nameAr, type: saved.type, seatCapacity: saved.seatCapacity },
      ipAddress,
    });

    return saved;
  }

  async getOrganizationDashboard(user: AuthenticatedContextUser, organizationId: string) {
    await this.assertOrgAccess(user, organizationId);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneE164: true,
                _count: {
                  select: {
                    courseEnrollments: true,
                    certificates: true,
                    attendanceRecords: { where: { status: 'PRESENT' } },
                  },
                },
              },
            },
          },
        },
        cohorts: {
          orderBy: { startsAt: 'desc' },
          include: {
            course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
            _count: { select: { enrollments: true, sessions: true } },
          },
        },
        contracts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!org) throw new NotFoundException('المؤسسة غير موجودة');

    const memberIds = org.members.map((m) => m.userId);
    const [progressRows, certificatesCount, attendanceSummary] = await Promise.all([
      memberIds.length > 0
        ? this.prisma.lessonProgress.findMany({
            where: { userId: { in: memberIds } },
            select: { userId: true, progressPercent: true, isCompleted: true },
          })
        : [],
      memberIds.length > 0
        ? this.prisma.certificate.count({
            where: { userId: { in: memberIds }, revokedAt: null },
          })
        : 0,
      memberIds.length > 0
        ? this.prisma.attendanceRecord.groupBy({
            by: ['status'],
            where: { userId: { in: memberIds } },
            _count: true,
          })
        : [],
    ]);

    const avgProgress =
      progressRows.length > 0
        ? Math.round(
            progressRows.reduce((s, p) => s + p.progressPercent, 0) / progressRows.length,
          )
        : 0;

    return {
      organization: org,
      impactReport: {
        seatCapacity: org.seatCapacity,
        usedSeats: org.members.length,
        availableSeats: Math.max(0, org.seatCapacity - org.members.length),
        averageLessonProgressPercent: avgProgress,
        completedLessonsCount: progressRows.filter((p) => p.isCompleted).length,
        issuedCertificatesCount: certificatesCount,
        attendanceBreakdown: Object.fromEntries(
          attendanceSummary.map((a) => [a.status, a._count]),
        ),
      },
    };
  }

  async assignMember(
    actor: AuthenticatedContextUser,
    organizationId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    await this.assertOrgAccess(actor, organizationId);
    const parsed = organizationMemberAssignSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات العضو غير صالحة');
    }

    const rawIdOrIdent = (parsed.data.userId || parsed.data.identifier || '').trim();
    const normalizedPhone = normalizePhoneToE164(rawIdOrIdent, '+20');
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: rawIdOrIdent },
          { email: { equals: rawIdOrIdent, mode: 'insensitive' } },
          ...(normalizedPhone ? [{ phoneE164: normalizedPhone }] : []),
        ],
      },
      select: { id: true, fullName: true, email: true, phoneE164: true },
    });
    if (!targetUser) {
      throw new NotFoundException('المستخدم المطلوب إضافته لمقاعد المؤسسة غير موجود');
    }

    const now = new Date();
    const member = await this.prisma.$transaction(async (tx) => {
      const [lockedOrg] = await tx.$queryRaw<
        Array<{ id: string; seatCapacity: number }>
      >`SELECT id, "seatCapacity" FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      if (!lockedOrg) {
        throw new NotFoundException('المؤسسة غير موجودة');
      }

      const existing = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUser.id,
          },
        },
      });
      if (!existing) {
        const usedSeats = await tx.organizationMember.count({
          where: { organizationId },
        });
        if (usedSeats >= lockedOrg.seatCapacity) {
          throw new BadRequestException('تم استنفاد جميع المقاعد المخصصة لهذه المؤسسة');
        }
      }

      const upserted = await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUser.id,
          },
        },
        update: {
          orgRole: parsed.data.orgRole,
          departmentAr: parsed.data.departmentAr ?? null,
        },
        create: {
          organizationId,
          userId: targetUser.id,
          orgRole: parsed.data.orgRole,
          departmentAr: parsed.data.departmentAr ?? null,
        },
      });

      // Automatically grant active contracted courses to the newly seated member
      const activeContracts = await tx.organizationContract.findMany({
        where: {
          organizationId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        select: { assignedCourseIds: true },
      });
      const contractedCourseIds = Array.from(
        new Set(activeContracts.flatMap((c) => c.assignedCourseIds)),
      );
      for (const courseId of contractedCourseIds) {
        await tx.courseEnrollment.upsert({
          where: { userId_courseId: { userId: targetUser.id, courseId } },
          update: {},
          create: {
            userId: targetUser.id,
            courseId,
            source: 'B2B_ORG_ENROLLMENT',
            startedAt: now,
          },
        });
        await ensureActiveCourseDirectPurchase(tx, {
          userId: targetUser.id,
          courseId,
          amountCents: 0,
          purchasedAt: now,
        });
      }

      return upserted;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORGANIZATION_MEMBER_ASSIGNED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { targetUserId: targetUser.id, orgRole: parsed.data.orgRole },
      ipAddress,
    });

    return member;
  }

  async revokeMember(
    actor: AuthenticatedContextUser,
    organizationId: string,
    targetUserId: string,
    ipAddress?: string,
  ) {
    await this.assertOrgAccess(actor, organizationId);

    await this.prisma.$transaction(async (tx) => {
      const [lockedOrg] = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      if (!lockedOrg) {
        throw new NotFoundException('المؤسسة غير موجودة');
      }

      const existing = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });
      if (!existing) {
        throw new NotFoundException('المتدرب غير مسجل ضمن مقاعد هذه المؤسسة');
      }

      // Collect courses associated with this organization's contracts & cohorts
      const [contracts, cohorts, b2bEnrollments] = await Promise.all([
        tx.organizationContract.findMany({
          where: { organizationId },
          select: { assignedCourseIds: true },
        }),
        tx.trainingCohort.findMany({
          where: { organizationId },
          select: { id: true, courseId: true },
        }),
        tx.courseEnrollment.findMany({
          where: { userId: targetUserId, source: 'B2B_ORG_ENROLLMENT' },
          select: { courseId: true },
        }),
      ]);

      const cohortIds = cohorts.map((c) => c.id);
      if (cohortIds.length > 0) {
        await tx.cohortEnrollment.deleteMany({
          where: { userId: targetUserId, cohortId: { in: cohortIds } },
        });
      }

      const candidateCourseIds = Array.from(
        new Set([
          ...contracts.flatMap((c) => c.assignedCourseIds),
          ...cohorts.map((c) => c.courseId),
          ...b2bEnrollments.map((e) => e.courseId),
        ]),
      );

      if (candidateCourseIds.length > 0) {
        await tx.courseEnrollment.deleteMany({
          where: {
            userId: targetUserId,
            courseId: { in: candidateCourseIds },
            source: 'B2B_ORG_ENROLLMENT',
          },
        });
        for (const courseId of candidateCourseIds) {
          await revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant(tx, {
            userId: targetUserId,
            courseId,
          });
        }
      }

      await tx.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORGANIZATION_MEMBER_REVOKED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { targetUserId },
      ipAddress,
    });

    return { revoked: true, organizationId, userId: targetUserId };
  }

  async createCohort(
    actor: AuthenticatedContextUser,
    organizationId: string,
    body: { courseId: string; titleAr: string; startsAt: string; endsAt: string; maxSeats?: number },
  ) {
    await this.assertOrgAccess(actor, organizationId);
    if (!body?.courseId || !body?.titleAr?.trim()) {
      throw new BadRequestException('معرف الكورس وعنوان الدفعة مطلوبان');
    }

    return this.prisma.trainingCohort.create({
      data: {
        courseId: body.courseId,
        organizationId,
        titleAr: body.titleAr.trim(),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        maxSeats: Number(body.maxSeats ?? 30),
      },
    });
  }

  async bulkEnrollMembers(
    actor: AuthenticatedContextUser,
    organizationId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    await this.assertOrgAccess(actor, organizationId);
    const parsed = organizationBulkEnrollSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التسجيل الجماعي غير صالحة');
    }

    const { courseId, cohortId, userIds } = parsed.data;
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, userId: { in: userIds } },
    });
    const allowedUserIds = members.map((m) => m.userId);
    if (allowedUserIds.length === 0) {
      throw new BadRequestException('المستخدمون المحددون غير مسجلين ضمن أعضاء هذه المؤسسة');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const uid of allowedUserIds) {
        await tx.courseEnrollment.upsert({
          where: { userId_courseId: { userId: uid, courseId } },
          update: {},
          create: { userId: uid, courseId, source: 'B2B_ORG_ENROLLMENT', startedAt: now },
        });
        await ensureActiveCourseDirectPurchase(tx, {
          userId: uid,
          courseId,
          amountCents: 0,
          purchasedAt: now,
        });
        if (cohortId) {
          await tx.cohortEnrollment.upsert({
            where: { cohortId_userId: { cohortId, userId: uid } },
            update: { status: 'ACTIVE' },
            create: { cohortId, userId: uid, enrolledById: actor.id, status: 'ACTIVE' },
          });
        }
      }
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORGANIZATION_BULK_ENROLLED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { courseId, cohortId: cohortId ?? null, enrolledCount: allowedUserIds.length },
      ipAddress,
    });

    return { enrolledCount: allowedUserIds.length, userIds: allowedUserIds };
  }

  async createContract(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = organizationContractCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات العقد المؤسسي غير صالحة');
    }

    const d = parsed.data;
    const contractNumber = `B2B-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const saved = await this.prisma.organizationContract.create({
      data: {
        organizationId: d.organizationId,
        contractNumber,
        titleAr: d.titleAr,
        quotationAmount: piastersToDecimalString(toPiasters(d.quotationAmountEgp)),
        discountPercent: d.discountPercent.toFixed(2),
        validFrom: new Date(d.validFrom),
        validTo: d.validTo ? new Date(d.validTo) : null,
        assignedCourseIds: d.assignedCourseIds,
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORGANIZATION_CONTRACT_CREATED',
      entityType: 'OrganizationContract',
      entityId: saved.id,
      metadata: {
        organizationId: d.organizationId,
        contractNumber,
        quotationAmountEgp: d.quotationAmountEgp,
      },
      ipAddress,
    });

    return saved;
  }
}
