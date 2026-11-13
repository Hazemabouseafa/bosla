import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { EditorialStatus, LeadStatus, SupportRecoveryStatus, UserRole, UserStatus } from '@bosla/db';
import {
  adminUpdateUserRoleSchema,
  diplomaSchema,
  learningPathSchema,
  membershipPlanSchema,
  normalizePhoneToE164,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { VideoService } from '../video/video.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VideoService) private readonly videoService: VideoService,
  ) {}

  async getOverview() {
    const [
      usersByRole,
      coursesByStatus,
      activeSubscriptions,
      paidTransactionsAgg,
      pendingReviewsCount,
      pendingRecoveryCount,
      newLeadsCount,
      certificatesCount,
      videoHealth,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      this.prisma.course.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.subscription.count({
        where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'PAID' },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      this.prisma.courseVersion.count({ where: { status: 'SUBMITTED_FOR_REVIEW' } }),
      this.prisma.supportRecoveryRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.leadSubmission.count({ where: { status: 'NEW' } }),
      this.prisma.certificate.count({ where: { revokedAt: null } }),
      this.videoService.getInfrastructureHealthForAdmin(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
    ]);

    return {
      usersByRole: Object.fromEntries(usersByRole.map((u) => [u.role, u._count.id])),
      coursesByStatus: Object.fromEntries(
        coursesByStatus.map((c) => [c.status, c._count.id]),
      ),
      activeSubscriptions,
      revenue: {
        totalPaidCents: paidTransactionsAgg._sum.amountCents ?? 0,
        paidCount: paidTransactionsAgg._count.id,
        currency: 'EGP',
      },
      queues: {
        pendingEditorialReviews: pendingReviewsCount,
        pendingSupportRecoveries: pendingRecoveryCount,
        newLeads: newLeadsCount,
      },
      certificatesIssued: certificatesCount,
      infrastructure: videoHealth,
      recentAuditLogs,
    };
  }

  // ============================================================
  // USERS & INSTRUCTORS
  // ============================================================

  async listUsers(params: { role?: UserRole; status?: UserStatus; q?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(params.role ? { role: params.role } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.q
          ? {
              OR: [
                { fullName: { contains: params.q, mode: 'insensitive' } },
                { email: { contains: params.q, mode: 'insensitive' } },
                { phoneE164: { contains: params.q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        authProvider: true,
        headlineAr: true,
        bioAr: true,
        createdAt: true,
        _count: {
          select: {
            passkeys: true,
            instructedCourses: true,
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateUserRoleAndStatus(
    adminId: string,
    targetUserId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = adminUpdateUserRoleSchema.parse(rawInput);
    const existing = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) throw new NotFoundException('المستخدم غير موجود');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        role: parsed.role,
        ...(parsed.status ? { status: parsed.status } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        headlineAr: true,
      },
    });

    if (parsed.status === 'SUSPENDED') {
      await this.prisma.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_USER_UPDATED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { role: parsed.role, status: parsed.status },
      ipAddress: ip,
    });

    return updated;
  }

  async createInstructorAccount(
    adminId: string,
    input: {
      fullName: string;
      phoneNumber: string;
      countryCode?: string;
      email?: string;
      password: string;
      headlineAr?: string;
      bioAr?: string;
      activateImmediately?: boolean;
    },
    ip?: string,
  ) {
    const phoneE164 = normalizePhoneToE164(
      input.phoneNumber,
      input.countryCode || '+20',
    );
    if (!phoneE164) {
      throw new BadRequestException('رقم الموبايل غير صالح بالصيغة الدولية E.164');
    }

    const dupPhone = await this.prisma.user.findUnique({ where: { phoneE164 } });
    if (dupPhone) {
      throw new ConflictException('رقم الموبايل مسجل مسبقاً');
    }

    if (input.email) {
      const dupEmail = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (dupEmail) {
        throw new ConflictException('البريد الإلكتروني مسجل مسبقاً');
      }
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const created = await this.prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        phoneE164,
        email: input.email?.trim() || null,
        passwordHash,
        role: 'INSTRUCTOR',
        status: input.activateImmediately ? 'ACTIVE' : 'ENROLLMENT_PENDING',
        authProvider: 'PHONE_PASSWORD',
        headlineAr: input.headlineAr?.trim() || null,
        bioAr: input.bioAr?.trim() || null,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        headlineAr: true,
        bioAr: true,
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_INSTRUCTOR_CREATED',
      entityType: 'User',
      entityId: created.id,
      metadata: { phoneE164 },
      ipAddress: ip,
    });

    return created;
  }

  // ============================================================
  // CATEGORIES & COURSES (ALL COURSES VIEW FOR ADMIN)
  // ============================================================

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
  }

  async upsertCategory(input: {
    id?: string;
    slug: string;
    nameAr: string;
    descriptionAr?: string | null;
    thumbnailUrl?: string | null;
    isAvailable?: boolean;
    sortOrder?: number;
  }) {
    if (input.id) {
      return this.prisma.category.update({
        where: { id: input.id },
        data: {
          slug: input.slug,
          nameAr: input.nameAr,
          descriptionAr: input.descriptionAr ?? null,
          thumbnailUrl: input.thumbnailUrl ?? null,
          isAvailable: input.isAvailable ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    }
    return this.prisma.category.create({
      data: {
        slug: input.slug,
        nameAr: input.nameAr,
        descriptionAr: input.descriptionAr ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        isAvailable: input.isAvailable ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async deleteCategory(id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true, id };
  }

  listAllCourses() {
    return this.prisma.course.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        category: true,
        draftVersion: { select: { id: true, versionNumber: true, status: true, titleAr: true } },
        publishedVersion: { select: { id: true, versionNumber: true, status: true, titleAr: true, publishedAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ============================================================
  // LEARNING PATHS (REUSE EXISTING COURSES ONLY)
  // ============================================================

  listLearningPaths() {
    return this.prisma.learningPath.findMany({
      include: {
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              include: {
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createLearningPath(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = learningPathSchema.parse(rawInput);
    await this.assertCoursesExist(parsed.courseLinks.map((c) => c.courseId));

    const path = await this.prisma.learningPath.create({
      data: {
        slug: parsed.slug,
        titleAr: parsed.titleAr,
        subtitleAr: parsed.subtitleAr ?? null,
        descriptionAr: parsed.descriptionAr,
        thumbnailUrl: parsed.thumbnailUrl ?? null,
        learningObjectives: parsed.learningObjectives,
        completionCriteria: parsed.completionCriteria,
        status: 'DRAFT',
        courses: {
          create: parsed.courseLinks.map((link) => ({
            courseId: link.courseId,
            sortOrder: link.sortOrder,
            isRequired: link.isRequired,
          })),
        },
      },
      include: { courses: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'LEARNING_PATH_CREATED',
      entityType: 'LearningPath',
      entityId: path.id,
      ipAddress: ip,
    });
    return path;
  }

  async updateLearningPath(adminId: string, id: string, rawInput: unknown, ip?: string) {
    const parsed = learningPathSchema.parse(rawInput);
    await this.assertCoursesExist(parsed.courseLinks.map((c) => c.courseId));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.learningPathCourse.deleteMany({ where: { learningPathId: id } });
      return tx.learningPath.update({
        where: { id },
        data: {
          slug: parsed.slug,
          titleAr: parsed.titleAr,
          subtitleAr: parsed.subtitleAr ?? null,
          descriptionAr: parsed.descriptionAr,
          thumbnailUrl: parsed.thumbnailUrl ?? null,
          learningObjectives: parsed.learningObjectives,
          completionCriteria: parsed.completionCriteria,
          courses: {
            create: parsed.courseLinks.map((link) => ({
              courseId: link.courseId,
              sortOrder: link.sortOrder,
              isRequired: link.isRequired,
            })),
          },
        },
        include: { courses: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'LEARNING_PATH_UPDATED',
      entityType: 'LearningPath',
      entityId: id,
      ipAddress: ip,
    });
    return updated;
  }

  async setLearningPathStatus(
    adminId: string,
    id: string,
    status: EditorialStatus,
    scheduledPublishAt?: string,
  ) {
    const updated = await this.prisma.learningPath.update({
      where: { id },
      data: {
        status,
        ...(status === 'PUBLISHED' ? { publishedAt: new Date(), scheduledPublishAt: null } : {}),
        ...(scheduledPublishAt ? { scheduledPublishAt: new Date(scheduledPublishAt) } : {}),
      },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'LEARNING_PATH_STATUS_CHANGED',
      entityType: 'LearningPath',
      entityId: id,
      metadata: { status },
    });
    return updated;
  }

  // ============================================================
  // DIPLOMAS (REUSE EXISTING COURSES + ASSESSMENTS + GRADING)
  // ============================================================

  listDiplomas() {
    return this.prisma.diploma.findMany({
      include: {
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              include: {
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
              },
            },
          },
        },
        assessments: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDiploma(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = diplomaSchema.parse(rawInput);
    await this.assertCoursesExist(parsed.courseLinks.map((c) => c.courseId));

    const diploma = await this.prisma.diploma.create({
      data: {
        slug: parsed.slug,
        titleAr: parsed.titleAr,
        subtitleAr: parsed.subtitleAr ?? null,
        descriptionAr: parsed.descriptionAr,
        thumbnailUrl: parsed.thumbnailUrl ?? null,
        totalHours: parsed.totalHours,
        hourBreakdown: parsed.hourBreakdown ?? [],
        completionRequirements: parsed.completionRequirements,
        hasOptionalFinalProject: parsed.hasOptionalFinalProject,
        certificateEnabled: parsed.certificateEnabled,
        status: 'DRAFT',
        courses: {
          create: parsed.courseLinks.map((link) => ({
            courseId: link.courseId,
            sortOrder: link.sortOrder,
            isRequired: link.isRequired,
          })),
        },
      },
      include: { courses: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_CREATED',
      entityType: 'Diploma',
      entityId: diploma.id,
      ipAddress: ip,
    });
    return diploma;
  }

  async updateDiploma(adminId: string, id: string, rawInput: unknown, ip?: string) {
    const parsed = diplomaSchema.parse(rawInput);
    await this.assertCoursesExist(parsed.courseLinks.map((c) => c.courseId));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.diplomaCourse.deleteMany({ where: { diplomaId: id } });
      return tx.diploma.update({
        where: { id },
        data: {
          slug: parsed.slug,
          titleAr: parsed.titleAr,
          subtitleAr: parsed.subtitleAr ?? null,
          descriptionAr: parsed.descriptionAr,
          thumbnailUrl: parsed.thumbnailUrl ?? null,
          totalHours: parsed.totalHours,
          hourBreakdown: parsed.hourBreakdown ?? [],
          completionRequirements: parsed.completionRequirements,
          hasOptionalFinalProject: parsed.hasOptionalFinalProject,
          certificateEnabled: parsed.certificateEnabled,
          courses: {
            create: parsed.courseLinks.map((link) => ({
              courseId: link.courseId,
              sortOrder: link.sortOrder,
              isRequired: link.isRequired,
            })),
          },
        },
        include: { courses: { orderBy: { sortOrder: 'asc' } }, assessments: true },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_UPDATED',
      entityType: 'Diploma',
      entityId: id,
      ipAddress: ip,
    });
    return updated;
  }

  async setDiplomaStatus(adminId: string, id: string, status: EditorialStatus) {
    const updated = await this.prisma.diploma.update({
      where: { id },
      data: {
        status,
        ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_STATUS_CHANGED',
      entityType: 'Diploma',
      entityId: id,
      metadata: { status },
    });
    return updated;
  }

  listDiplomaSubmissions() {
    return this.prisma.diplomaProjectSubmission.findMany({
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
        assessment: { include: { diploma: { select: { id: true, titleAr: true, slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async gradeDiplomaSubmission(
    adminId: string,
    submissionId: string,
    input: { scorePercent: number; feedbackAr?: string },
  ) {
    const submission = await this.prisma.diplomaProjectSubmission.findUnique({
      where: { id: submissionId },
      include: { assessment: true },
    });
    if (!submission) throw new NotFoundException('التسليم غير موجود');

    const passed = input.scorePercent >= submission.assessment.passingScorePercent;
    return this.prisma.diplomaProjectSubmission.update({
      where: { id: submissionId },
      data: {
        scorePercent: input.scorePercent,
        passed,
        feedbackAr: input.feedbackAr ?? null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  // ============================================================
  // MEMBERSHIP PLANS & REVISION ENTITLEMENTS
  // ============================================================

  listMembershipPlansAdmin() {
    return this.prisma.membershipPlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        revisions: {
          orderBy: { versionNumber: 'desc' },
          take: 3,
          include: {
            courses: { select: { courseId: true } },
            learningPaths: { select: { learningPathId: true } },
            diplomas: { select: { diplomaId: true } },
          },
        },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async createOrUpdateMembershipPlan(
    adminId: string,
    rawInput: unknown,
    planId?: string,
    ip?: string,
  ) {
    const parsed = membershipPlanSchema.parse(rawInput);

    const result = await this.prisma.$transaction(async (tx) => {
      let plan = planId
        ? await tx.membershipPlan.update({
            where: { id: planId },
            data: {
              slug: parsed.slug,
              interval: parsed.interval,
              nameAr: parsed.nameAr,
              descriptionAr: parsed.descriptionAr,
              priceCents: parsed.priceCents,
              compareAtPriceCents: parsed.compareAtPriceCents ?? null,
              discountLabelAr: parsed.discountLabelAr ?? null,
              isActive: parsed.isActive,
              isVisible: parsed.isVisible,
              sortOrder: parsed.sortOrder,
            },
          })
        : await tx.membershipPlan.create({
            data: {
              slug: parsed.slug,
              interval: parsed.interval,
              nameAr: parsed.nameAr,
              descriptionAr: parsed.descriptionAr,
              priceCents: parsed.priceCents,
              compareAtPriceCents: parsed.compareAtPriceCents ?? null,
              discountLabelAr: parsed.discountLabelAr ?? null,
              isActive: parsed.isActive,
              isVisible: parsed.isVisible,
              sortOrder: parsed.sortOrder,
            },
          });

      const latestRev = await tx.membershipPlanRevision.findFirst({
        where: { planId: plan.id },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVersion = (latestRev?.versionNumber ?? 0) + 1;

      const revision = await tx.membershipPlanRevision.create({
        data: {
          planId: plan.id,
          versionNumber: nextVersion,
          priceCents: parsed.priceCents,
          entitlementMode: parsed.entitlementMode,
          notesAr: parsed.notesAr ?? null,
          createdById: adminId,
          courses: {
            create: Array.from(new Set(parsed.courseIds)).map((courseId) => ({ courseId })),
          },
          learningPaths: {
            create: Array.from(new Set(parsed.learningPathIds)).map((learningPathId) => ({
              learningPathId,
            })),
          },
          diplomas: {
            create: Array.from(new Set(parsed.diplomaIds)).map((diplomaId) => ({
              diplomaId,
            })),
          },
        },
        include: { courses: true, learningPaths: true, diplomas: true },
      });

      plan = await tx.membershipPlan.update({
        where: { id: plan.id },
        data: { currentRevisionId: revision.id },
      });

      return { plan, revision };
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: planId ? 'MEMBERSHIP_PLAN_UPDATED' : 'MEMBERSHIP_PLAN_CREATED',
      entityType: 'MembershipPlan',
      entityId: result.plan.id,
      metadata: { revisionId: result.revision.id, versionNumber: result.revision.versionNumber },
      ipAddress: ip,
    });

    return result;
  }

  // ============================================================
  // PAYMENTS, SUBSCRIPTIONS, CERTIFICATES & SUPPORT RECOVERY
  // ============================================================

  listPaymentsAndWebhooks() {
    return Promise.all([
      this.prisma.paymentTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, fullName: true, phoneE164: true } },
          plan: { select: { id: true, nameAr: true, interval: true } },
        },
      }),
      this.prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, fullName: true, phoneE164: true } },
          plan: { select: { id: true, nameAr: true, interval: true } },
        },
      }),
      this.prisma.webhookEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]).then(([payments, subscriptions, webhooks]) => ({
      payments,
      subscriptions,
      webhooks,
    }));
  }

  listCertificatesAdmin() {
    return this.prisma.certificate.findMany({
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
        course: { select: { slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { slug: true, titleAr: true } },
        diploma: { select: { slug: true, titleAr: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 150,
    });
  }

  async revokeCertificate(adminId: string, certificateId: string) {
    const updated = await this.prisma.certificate.update({
      where: { id: certificateId },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'CERTIFICATE_REVOKED',
      entityType: 'Certificate',
      entityId: certificateId,
    });
    return updated;
  }

  listSupportRecoveryRequests() {
    return this.prisma.supportRecoveryRequest.findMany({
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, status: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveSupportRecoveryRequest(
    adminId: string,
    requestId: string,
    decision: { status: SupportRecoveryStatus; resolutionNotes?: string },
    ip?: string,
  ) {
    const reqRecord = await this.prisma.supportRecoveryRequest.findUnique({
      where: { id: requestId },
    });
    if (!reqRecord) throw new NotFoundException('طلب الاسترداد غير موجود');

    let issuedResetToken: string | null = null;
    if (decision.status === 'APPROVED' && reqRecord.userId) {
      issuedResetToken = randomBytes(24).toString('base64url');
      const tokenHash = createHash('sha256').update(issuedResetToken).digest('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: reqRecord.userId,
          tokenHash,
          method: 'SUPPORT_ASSISTED',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    const updated = await this.prisma.supportRecoveryRequest.update({
      where: { id: requestId },
      data: {
        status: decision.status,
        resolutionNotes: decision.resolutionNotes ?? null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'SUPPORT_RECOVERY_RESOLVED',
      entityType: 'SupportRecoveryRequest',
      entityId: requestId,
      metadata: { decision: decision.status },
      ipAddress: ip,
    });

    return {
      request: updated,
      supportResetToken: issuedResetToken,
    };
  }

  // ============================================================
  // CMS, SETTINGS, LEADS & AUDIT LOGS
  // ============================================================

  listCmsPages() {
    return this.prisma.cmsPage.findMany({ orderBy: { slug: 'asc' } });
  }

  upsertCmsPage(
    adminId: string,
    slug: string,
    input: {
      titleAr: string;
      seoTitleAr?: string | null;
      seoDescriptionAr?: string | null;
      sections: unknown;
      isPublished?: boolean;
    },
  ) {
    return this.prisma.cmsPage.upsert({
      where: { slug },
      update: {
        titleAr: input.titleAr,
        seoTitleAr: input.seoTitleAr ?? null,
        seoDescriptionAr: input.seoDescriptionAr ?? null,
        sections: input.sections as any,
        isPublished: input.isPublished ?? true,
        updatedById: adminId,
      },
      create: {
        slug,
        titleAr: input.titleAr,
        seoTitleAr: input.seoTitleAr ?? null,
        seoDescriptionAr: input.seoDescriptionAr ?? null,
        sections: input.sections as any,
        isPublished: input.isPublished ?? true,
        updatedById: adminId,
      },
    });
  }

  getCmsCollections() {
    return Promise.all([
      this.prisma.cmsTestimonial.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.cmsPartner.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.cmsFaq.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.siteSetting.findMany(),
    ]).then(([testimonials, partners, faqs, settings]) => ({
      testimonials,
      partners,
      faqs,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    }));
  }

  async saveCmsTestimonial(input: {
    id?: string;
    studentNameAr: string;
    roleTitleAr: string;
    companyAr?: string | null;
    quoteAr: string;
    rating?: number;
    isPublished?: boolean;
    sortOrder?: number;
  }) {
    if (input.id) {
      return this.prisma.cmsTestimonial.update({
        where: { id: input.id },
        data: {
          studentNameAr: input.studentNameAr,
          roleTitleAr: input.roleTitleAr,
          companyAr: input.companyAr ?? null,
          quoteAr: input.quoteAr,
          rating: input.rating ?? 5,
          isPublished: input.isPublished ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    }
    return this.prisma.cmsTestimonial.create({
      data: {
        studentNameAr: input.studentNameAr,
        roleTitleAr: input.roleTitleAr,
        companyAr: input.companyAr ?? null,
        quoteAr: input.quoteAr,
        rating: input.rating ?? 5,
        isPublished: input.isPublished ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async deleteCmsTestimonial(id: string) {
    await this.prisma.cmsTestimonial.delete({ where: { id } });
    return { deleted: true, id };
  }

  async saveCmsFaq(input: {
    id?: string;
    questionAr: string;
    answerAr: string;
    categoryAr?: string;
    isPublished?: boolean;
    sortOrder?: number;
  }) {
    if (input.id) {
      return this.prisma.cmsFaq.update({
        where: { id: input.id },
        data: {
          questionAr: input.questionAr,
          answerAr: input.answerAr,
          categoryAr: input.categoryAr ?? 'عام',
          isPublished: input.isPublished ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    }
    return this.prisma.cmsFaq.create({
      data: {
        questionAr: input.questionAr,
        answerAr: input.answerAr,
        categoryAr: input.categoryAr ?? 'عام',
        isPublished: input.isPublished ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async deleteCmsFaq(id: string) {
    await this.prisma.cmsFaq.delete({ where: { id } });
    return { deleted: true, id };
  }

  async saveCmsPartner(input: {
    id?: string;
    nameAr: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    descriptionAr?: string | null;
    isPublished?: boolean;
    sortOrder?: number;
  }) {
    if (input.id) {
      return this.prisma.cmsPartner.update({
        where: { id: input.id },
        data: {
          nameAr: input.nameAr,
          logoUrl: input.logoUrl ?? null,
          websiteUrl: input.websiteUrl ?? null,
          descriptionAr: input.descriptionAr ?? null,
          isPublished: input.isPublished ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    }
    return this.prisma.cmsPartner.create({
      data: {
        nameAr: input.nameAr,
        logoUrl: input.logoUrl ?? null,
        websiteUrl: input.websiteUrl ?? null,
        descriptionAr: input.descriptionAr ?? null,
        isPublished: input.isPublished ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async upsertSiteSetting(adminId: string, key: string, value: unknown) {
    return this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: value as any, updatedById: adminId },
      create: { key, value: value as any, updatedById: adminId },
    });
  }

  listLeads() {
    return this.prisma.leadSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  updateLeadStatus(leadId: string, status: LeadStatus, notes?: string) {
    return this.prisma.leadSubmission.update({
      where: { id: leadId },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
    });
  }

  listAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 300),
      include: { actor: { select: { id: true, fullName: true, role: true } } },
    });
  }

  private async assertCoursesExist(courseIds: string[]) {
    if (courseIds.length === 0) return;
    const uniqueIds = Array.from(new Set(courseIds));
    const found = await this.prisma.course.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestException('أحد الكورسات المحددة غير موجود');
    }
  }
}
