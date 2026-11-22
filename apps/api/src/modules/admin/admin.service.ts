import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type {
  CertificateTargetType,
  EditorialStatus,
  LeadStatus,
  SupportRecoveryStatus,
  UserRole,
  UserStatus,
} from '@bosla/db';
import {
  adminCreateCourseSchema,
  adminUpdateCourseSchema,
  adminUpdateUserRoleSchema,
  competencyRequestReviewSchema,
  diplomaSchema,
  gradeDiplomaSubmissionSchema,
  instructorPayoutSchema,
  isAdminRole,
  hasAnyRole,
  learningPathSchema,
  membershipPlanSchema,
  normalizePhoneToE164,
  programInstructorAssignmentsSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { syncUserRoleAssignmentsAndProvision } from '../../core/rbac-resolver';
import { tryIssuePathAndDiplomaCertificates } from '../learning/certificate.helper';
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
      publishedEventsCount,
      confirmedEventRegsCount,
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
      this.prisma.offlineEvent.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.offlineEventRegistration.count({
        where: { status: { in: ['CONFIRMED', 'ATTENDED'] } },
      }),
    ]);

    return {
      usersByRole: Object.fromEntries(usersByRole.map((u) => [u.role, u._count.id])),
      coursesByStatus: Object.fromEntries(
        coursesByStatus.map((c) => [c.status, c._count.id]),
      ),
      activeSubscriptions,
      offlineEvents: {
        publishedCount: publishedEventsCount,
        confirmedRegistrations: confirmedEventRegsCount,
      },
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
        assignedUserRoles: {
          include: { role: { select: { code: true } } },
        },
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

    await syncUserRoleAssignmentsAndProvision(this.prisma, {
      userId: targetUserId,
      primaryRole: parsed.role,
      assignedById: adminId,
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
      throw new BadRequestException('أدخل رقم موبايل صحيحاً');
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
        instructorAssignments: {
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        category: true,
        draftVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            titleAr: true,
            subtitleAr: true,
            descriptionAr: true,
            thumbnailUrl: true,
            learningObjectives: true,
            requirements: true,
          },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            titleAr: true,
            subtitleAr: true,
            descriptionAr: true,
            thumbnailUrl: true,
            publishedAt: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            reviews: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createCourse(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminCreateCourseSchema.parse(rawInput);

    const existingSlug = await this.prisma.course.findUnique({ where: { slug: parsed.slug } });
    if (existingSlug) {
      throw new BadRequestException('الرابط المختصر مستخدم بالفعل لكورس آخر');
    }

    if (parsed.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!cat) throw new BadRequestException('التخصص المحدد غير موجود');
    }

    const ownerId = parsed.instructorId || adminId;
    await this.assertValidCourseOwner(ownerId);

    const now = new Date();
    const initialStatus = parsed.publishImmediately ? 'PUBLISHED' : 'DRAFT';

    const created = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          slug: parsed.slug,
          instructorId: ownerId,
          categoryId: parsed.categoryId ?? null,
          status: initialStatus,
          isFree: parsed.isFree,
          ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
          ...(parsed.compareAtPriceCents !== undefined
            ? { compareAtPriceCents: parsed.compareAtPriceCents }
            : {}),
          ...(parsed.includedInMembership !== undefined
            ? { includedInMembership: parsed.includedInMembership }
            : {}),
          ...(parsed.allowIndividualPurchase !== undefined
            ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
            : {}),
          difficulty: parsed.difficulty,
          ...(parsed.featuredOrder !== undefined ? { featuredOrder: parsed.featuredOrder } : {}),
          ...(parsed.publishImmediately ? { publishedAt: now } : {}),
        },
      });

      await tx.programFinancialAccount.create({
        data: {
          accountCode: `PRG-CRS-${randomBytes(3).toString('hex').toUpperCase()}`,
          targetType: 'COURSE',
          courseId: course.id,
        },
      });

      const version = await tx.courseVersion.create({
        data: {
          courseId: course.id,
          versionNumber: 1,
          status: initialStatus,
          titleAr: parsed.titleAr,
          subtitleAr: parsed.subtitleAr ?? null,
          descriptionAr: parsed.descriptionAr,
          thumbnailUrl: parsed.thumbnailUrl ?? null,
          learningObjectives: parsed.learningObjectives,
          requirements: parsed.requirements,
          ...(parsed.publishImmediately
            ? { reviewedById: adminId, reviewedAt: now, publishedById: adminId, publishedAt: now }
            : {}),
        },
      });

      return tx.course.update({
        where: { id: course.id },
        data: {
          draftVersionId: version.id,
          ...(parsed.publishImmediately ? { publishedVersionId: version.id } : {}),
        },
        include: {
          instructor: { select: { id: true, fullName: true } },
          category: true,
          draftVersion: true,
          publishedVersion: true,
        },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: parsed.publishImmediately ? 'ADMIN_COURSE_CREATED_AND_PUBLISHED' : 'ADMIN_COURSE_CREATED',
      entityType: 'Course',
      entityId: created.id,
      metadata: { slug: created.slug, instructorId: ownerId },
      ipAddress: ip,
    });

    return created;
  }

  async updateCourse(adminId: string, courseId: string, rawInput: unknown, ip?: string) {
    const parsed = adminUpdateCourseSchema.parse(rawInput);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { draftVersion: true, publishedVersion: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    if (parsed.slug && parsed.slug !== course.slug) {
      const dup = await this.prisma.course.findUnique({ where: { slug: parsed.slug } });
      if (dup) throw new BadRequestException('الرابط المختصر مستخدم بالفعل لكورس آخر');
    }

    if (parsed.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!cat) throw new BadRequestException('التخصص المحدد غير موجود');
    }

    if (parsed.instructorId) {
      await this.assertValidCourseOwner(parsed.instructorId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: {
          ...(parsed.slug ? { slug: parsed.slug } : {}),
          ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
          ...(parsed.isFree !== undefined ? { isFree: parsed.isFree } : {}),
          ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
          ...(parsed.compareAtPriceCents !== undefined
            ? { compareAtPriceCents: parsed.compareAtPriceCents }
            : {}),
          ...(parsed.includedInMembership !== undefined
            ? { includedInMembership: parsed.includedInMembership }
            : {}),
          ...(parsed.allowIndividualPurchase !== undefined
            ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
            : {}),
          ...(parsed.difficulty ? { difficulty: parsed.difficulty } : {}),
          ...(parsed.instructorId ? { instructorId: parsed.instructorId } : {}),
          ...(parsed.featuredOrder !== undefined ? { featuredOrder: parsed.featuredOrder } : {}),
        },
      });

      const versionIdsToUpdate = Array.from(
        new Set([course.draftVersionId, course.publishedVersionId].filter((v): v is string => Boolean(v))),
      );
      if (versionIdsToUpdate.length > 0) {
        const versionData: Record<string, any> = {};
        if (parsed.titleAr !== undefined) versionData.titleAr = parsed.titleAr;
        if (parsed.subtitleAr !== undefined) versionData.subtitleAr = parsed.subtitleAr;
        if (parsed.descriptionAr !== undefined) versionData.descriptionAr = parsed.descriptionAr;
        if (parsed.thumbnailUrl !== undefined) versionData.thumbnailUrl = parsed.thumbnailUrl;
        if (parsed.learningObjectives !== undefined) versionData.learningObjectives = parsed.learningObjectives;
        if (parsed.requirements !== undefined) versionData.requirements = parsed.requirements;

        if (Object.keys(versionData).length > 0) {
          await tx.courseVersion.updateMany({
            where: { id: { in: versionIdsToUpdate } },
            data: versionData,
          });
        }
      }

      return tx.course.findUnique({
        where: { id: courseId },
        include: {
          instructor: { select: { id: true, fullName: true } },
          category: true,
          draftVersion: true,
          publishedVersion: true,
        },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COURSE_UPDATED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { updatedFields: Object.keys(parsed) },
      ipAddress: ip,
    });

    return updated;
  }

  async publishCourseNow(adminId: string, courseId: string, ip?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { draftVersion: true, publishedVersion: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const targetVersion = course.draftVersion ?? course.publishedVersion;
    if (!targetVersion) {
      throw new BadRequestException('لا يوجد إصدار قابل للنشر لهذا الكورس');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.courseVersion.update({
        where: { id: targetVersion.id },
        data: {
          status: 'PUBLISHED',
          reviewedById: adminId,
          reviewedAt: now,
          publishedById: adminId,
          publishedAt: now,
        },
      });

      await tx.editorialReviewLog.create({
        data: {
          courseId,
          courseVersionId: targetVersion.id,
          fromStatus: targetVersion.status,
          toStatus: 'PUBLISHED',
          actorId: adminId,
          comment: 'تم النشر المباشر للطلاب من لوحة الإدارة.',
        },
      });

      return tx.course.update({
        where: { id: courseId },
        data: {
          status: 'PUBLISHED',
          publishedVersionId: targetVersion.id,
          publishedAt: now,
          unpublishedAt: null,
          scheduledPublishAt: null,
        },
        include: {
          instructor: { select: { id: true, fullName: true } },
          category: true,
          draftVersion: true,
          publishedVersion: true,
        },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COURSE_PUBLISHED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { versionId: targetVersion.id },
      ipAddress: ip,
    });

    return updated;
  }

  async unpublishCourseNow(adminId: string, courseId: string, ip?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (course.publishedVersionId) {
        await tx.courseVersion.update({
          where: { id: course.publishedVersionId },
          data: { status: 'UNPUBLISHED' },
        });
      }
      return tx.course.update({
        where: { id: courseId },
        data: { status: 'UNPUBLISHED', unpublishedAt: now },
        include: {
          instructor: { select: { id: true, fullName: true } },
          category: true,
          draftVersion: true,
          publishedVersion: true,
        },
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COURSE_UNPUBLISHED',
      entityType: 'Course',
      entityId: courseId,
      ipAddress: ip,
    });

    return updated;
  }

  async deleteCourse(adminId: string, courseId: string, ip?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            learningPathLinks: true,
            diplomaLinks: true,
            planCourseAssignments: true,
          },
        },
      },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    if (
      course._count.enrollments > 0 ||
      course._count.certificates > 0 ||
      course._count.learningPathLinks > 0 ||
      course._count.diplomaLinks > 0 ||
      course._count.planCourseAssignments > 0
    ) {
      throw new BadRequestException(
        'لا يمكن حذف كورس مرتبط بطلاب مسجلين أو شهادات أو مسارات أو خطط اشتراك؛ يمكنك إيقاف نشره بدلاً من ذلك.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: { draftVersionId: null, publishedVersionId: null },
      });
      await tx.editorialReviewLog.deleteMany({ where: { courseId } });
      await tx.courseVersion.deleteMany({ where: { courseId } });
      await tx.course.delete({ where: { id: courseId } });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COURSE_DELETED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { slug: course.slug },
      ipAddress: ip,
    });

    return { deleted: true, id: courseId };
  }

  // ============================================================
  // LEARNING PATHS (REUSE EXISTING COURSES ONLY)
  // ============================================================

  listLearningPaths() {
    return this.prisma.learningPath.findMany({
      include: {
        instructorAssignments: {
          include: { instructor: { select: { id: true, fullName: true, headlineAr: true } } },
          orderBy: { isPrimary: 'desc' },
        },
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
        ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
        ...(parsed.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: parsed.compareAtPriceCents }
          : {}),
        ...(parsed.includedInMembership !== undefined
          ? { includedInMembership: parsed.includedInMembership }
          : {}),
        ...(parsed.allowIndividualPurchase !== undefined
          ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
          : {}),
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

    await this.prisma.programFinancialAccount.create({
      data: {
        accountCode: `PRG-PTH-${randomBytes(3).toString('hex').toUpperCase()}`,
        targetType: 'LEARNING_PATH',
        learningPathId: path.id,
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'LEARNING_PATH_CREATED',
      entityType: 'LearningPath',
      entityId: path.id,
      metadata: {
        priceCents: path.priceCents,
        includedInMembership: path.includedInMembership,
        allowIndividualPurchase: path.allowIndividualPurchase,
      },
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
          ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
          ...(parsed.compareAtPriceCents !== undefined
            ? { compareAtPriceCents: parsed.compareAtPriceCents }
            : {}),
          ...(parsed.includedInMembership !== undefined
            ? { includedInMembership: parsed.includedInMembership }
            : {}),
          ...(parsed.allowIndividualPurchase !== undefined
            ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
            : {}),
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
      metadata: {
        priceCents: updated.priceCents,
        includedInMembership: updated.includedInMembership,
        allowIndividualPurchase: updated.allowIndividualPurchase,
      },
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

  async deleteLearningPath(adminId: string, id: string, ip?: string) {
    const pathRecord = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        _count: { select: { certificates: true, planPathAssignments: true } },
      },
    });
    if (!pathRecord) throw new NotFoundException('المسار التعليمي غير موجود');
    if (pathRecord._count.certificates > 0 || pathRecord._count.planPathAssignments > 0) {
      throw new BadRequestException(
        'لا يمكن حذف مسار مرتبط بشهادات صادرة أو خطط عضوية؛ يمكنك إيقاف نشره أو تعديله.',
      );
    }

    await this.prisma.learningPath.delete({ where: { id } });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'LEARNING_PATH_DELETED',
      entityType: 'LearningPath',
      entityId: id,
      metadata: { slug: pathRecord.slug },
      ipAddress: ip,
    });
    return { deleted: true, id };
  }

  // ============================================================
  // DIPLOMAS (REUSE EXISTING COURSES + ASSESSMENTS + GRADING)
  // ============================================================

  listDiplomas() {
    return this.prisma.diploma.findMany({
      include: {
        instructorAssignments: {
          include: { instructor: { select: { id: true, fullName: true, headlineAr: true } } },
          orderBy: { isPrimary: 'desc' },
        },
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
        ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
        ...(parsed.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: parsed.compareAtPriceCents }
          : {}),
        ...(parsed.includedInMembership !== undefined
          ? { includedInMembership: parsed.includedInMembership }
          : {}),
        ...(parsed.allowIndividualPurchase !== undefined
          ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
          : {}),
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

    await this.prisma.programFinancialAccount.create({
      data: {
        accountCode: `PRG-DIP-${randomBytes(3).toString('hex').toUpperCase()}`,
        targetType: 'DIPLOMA',
        diplomaId: diploma.id,
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_CREATED',
      entityType: 'Diploma',
      entityId: diploma.id,
      metadata: {
        priceCents: diploma.priceCents,
        includedInMembership: diploma.includedInMembership,
        allowIndividualPurchase: diploma.allowIndividualPurchase,
      },
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
          ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
          ...(parsed.compareAtPriceCents !== undefined
            ? { compareAtPriceCents: parsed.compareAtPriceCents }
            : {}),
          ...(parsed.includedInMembership !== undefined
            ? { includedInMembership: parsed.includedInMembership }
            : {}),
          ...(parsed.allowIndividualPurchase !== undefined
            ? { allowIndividualPurchase: parsed.allowIndividualPurchase }
            : {}),
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
      metadata: {
        priceCents: updated.priceCents,
        includedInMembership: updated.includedInMembership,
        allowIndividualPurchase: updated.allowIndividualPurchase,
      },
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

  async deleteDiploma(adminId: string, id: string, ip?: string) {
    const diploma = await this.prisma.diploma.findUnique({
      where: { id },
      include: {
        _count: { select: { certificates: true, planDiplomaAssignments: true } },
      },
    });
    if (!diploma) throw new NotFoundException('الدبلومة غير موجودة');
    if (diploma._count.certificates > 0 || diploma._count.planDiplomaAssignments > 0) {
      throw new BadRequestException(
        'لا يمكن حذف دبلومة مرتبطة بشهادات أو خطط عضوية؛ يمكنك إيقاف نشرها أو تعديلها.',
      );
    }

    await this.prisma.diploma.delete({ where: { id } });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_DELETED',
      entityType: 'Diploma',
      entityId: id,
      metadata: { slug: diploma.slug },
      ipAddress: ip,
    });
    return { deleted: true, id };
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
    rawInput: unknown,
  ) {
    const parsed = gradeDiplomaSubmissionSchema.parse(rawInput);
    const submission = await this.prisma.diplomaProjectSubmission.findUnique({
      where: { id: submissionId },
      include: { assessment: true },
    });
    if (!submission) throw new NotFoundException('التسليم غير موجود');

    const passed = parsed.scorePercent >= submission.assessment.passingScorePercent;
    const updated = await this.prisma.diplomaProjectSubmission.update({
      where: { id: submissionId },
      data: {
        scorePercent: parsed.scorePercent,
        passed,
        feedbackAr: parsed.feedbackAr ?? null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    let issuedCertificates: any[] = [];
    if (passed) {
      issuedCertificates = await tryIssuePathAndDiplomaCertificates({
        prisma: this.prisma,
        audit: this.audit,
        userId: submission.userId,
        onlyDiplomaId: submission.assessment.diplomaId,
      });
    }

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'DIPLOMA_SUBMISSION_GRADED',
      entityType: 'DiplomaProjectSubmission',
      entityId: submissionId,
      metadata: { scorePercent: parsed.scorePercent, passed, diplomaId: submission.assessment.diplomaId },
    });

    return { ...updated, issuedCertificates };
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
          event: { select: { id: true, slug: true, titleAr: true } },
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

  async restoreCertificate(adminId: string, certificateId: string) {
    const updated = await this.prisma.certificate.update({
      where: { id: certificateId },
      data: { revokedAt: null },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'CERTIFICATE_RESTORED',
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

  async deleteCmsPartner(id: string) {
    await this.prisma.cmsPartner.delete({ where: { id } });
    return { deleted: true, id };
  }

  async upsertSiteSetting(adminId: string, key: string, value: unknown) {
    const updated = await this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: value as any, updatedById: adminId },
      create: { key, value: value as any, updatedById: adminId },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_SETTING_UPDATED',
      entityType: 'SiteSetting',
      entityId: key,
      metadata: { key },
    });
    return updated;
  }

  listLeads() {
    return this.prisma.leadSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  updateLeadStatus(leadId: string, rawStatus: LeadStatus | 'CONVERTED', notes?: string) {
    const isConverted = rawStatus === 'CONVERTED';
    const safeStatus: LeadStatus = rawStatus === 'CONVERTED' ? 'CLOSED' : rawStatus;
    const mappedStage = isConverted
      ? 'WON'
      : safeStatus === 'CLOSED'
        ? 'LOST'
        : safeStatus === 'QUALIFIED'
          ? 'QUALIFIED'
          : safeStatus === 'CONTACTED'
            ? 'CONTACTED'
            : 'NEW';
    return this.prisma.leadSubmission.update({
      where: { id: leadId },
      data: {
        status: safeStatus,
        pipelineStageKey: mappedStage,
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

  private async assertValidCourseOwner(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, role: true },
    });
    if (!owner) {
      throw new BadRequestException('المدرب المحدد غير موجود أو لا يملك صلاحية التدريس');
    }
    const assignments = this.prisma.userRoleAssignment?.findMany
      ? await this.prisma.userRoleAssignment.findMany({
          where: { userId: ownerId },
          include: { role: { select: { code: true } } },
        })
      : [];
    const extraRoles = assignments.map((a) => a.role.code);
    if (
      !isAdminRole(owner.role, extraRoles) &&
      !hasAnyRole(['INSTRUCTOR'], owner.role, extraRoles)
    ) {
      throw new BadRequestException('المدرب المحدد غير موجود أو لا يملك صلاحية التدريس');
    }
    return owner;
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

  // ============================================================
  // MULTI-INSTRUCTOR REVENUE SHARES, PROGRAM FINANCIAL ACCOUNTS,
  // INSTRUCTOR STATEMENTS, SEPARATE PAYMENT RECORDS & COMPETENCY
  // ============================================================

  async setProgramInstructorAssignments(
    adminId: string,
    targetType: CertificateTargetType,
    targetId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = programInstructorAssignmentsSchema.parse(rawInput);
    const totalPercent = parsed.assignments.reduce((sum, a) => sum + a.revenueSharePercent, 0);
    if (totalPercent > 100) {
      throw new BadRequestException('مجموع نسب المدربين في البرنامج الواحد لا يمكن أن يتجاوز 100%');
    }

    const whereTarget =
      targetType === 'COURSE'
        ? { courseId: targetId }
        : targetType === 'LEARNING_PATH'
          ? { learningPathId: targetId }
          : { diplomaId: targetId };

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.programInstructorAssignment.deleteMany({ where: whereTarget });

      const created = [];
      for (const a of parsed.assignments) {
        const row = await tx.programInstructorAssignment.create({
          data: {
            instructorId: a.instructorId,
            targetType,
            ...(targetType === 'COURSE' ? { courseId: targetId } : {}),
            ...(targetType === 'LEARNING_PATH' ? { learningPathId: targetId } : {}),
            ...(targetType === 'DIPLOMA' ? { diplomaId: targetId } : {}),
            roleTitleAr: a.roleTitleAr,
            revenueSharePercent: a.revenueSharePercent,
            isPrimary: a.isPrimary,
            assignedById: adminId,
          },
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true } },
          },
        });
        created.push(row);
      }

      if (targetType === 'COURSE') {
        const primary = parsed.assignments.find((a) => a.isPrimary) ?? parsed.assignments[0];
        if (primary) {
          await tx.course.update({
            where: { id: targetId },
            data: { instructorId: primary.instructorId },
          });
        }
      }

      return created;
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_PROGRAM_INSTRUCTORS_UPDATED',
      entityType: targetType,
      entityId: targetId,
      metadata: {
        targetType,
        targetId,
        assignments: parsed.assignments,
        totalPercent,
      },
      ipAddress: ip,
    });

    return saved;
  }

  async getFinanceOverview() {
    const [programAccounts, instructorAccounts, paymentRecords, assignments, financialAuditLogs] =
      await Promise.all([
        this.prisma.programFinancialAccount.findMany({
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                priceCents: true,
                includedInMembership: true,
                allowIndividualPurchase: true,
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
                instructorAssignments: {
                  include: { instructor: { select: { id: true, fullName: true } } },
                },
              },
            },
            learningPath: {
              select: {
                id: true,
                slug: true,
                titleAr: true,
                priceCents: true,
                includedInMembership: true,
                allowIndividualPurchase: true,
                instructorAssignments: {
                  include: { instructor: { select: { id: true, fullName: true } } },
                },
              },
            },
            diploma: {
              select: {
                id: true,
                slug: true,
                titleAr: true,
                priceCents: true,
                includedInMembership: true,
                allowIndividualPurchase: true,
                instructorAssignments: {
                  include: { instructor: { select: { id: true, fullName: true } } },
                },
              },
            },
            entries: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.instructorFinancialAccount.findMany({
          include: {
            instructor: {
              select: {
                id: true,
                fullName: true,
                phoneE164: true,
                email: true,
                headlineAr: true,
              },
            },
            entries: {
              orderBy: { createdAt: 'desc' },
              take: 25,
            },
          },
          orderBy: { totalEarnedCents: 'desc' },
        }),
        this.prisma.financialPaymentRecord.findMany({
          include: {
            payer: { select: { id: true, fullName: true, phoneE164: true } },
            payeeInstructor: { select: { id: true, fullName: true, phoneE164: true } },
            recordedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.programInstructorAssignment.findMany({
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true } },
            course: {
              select: {
                id: true,
                slug: true,
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
              },
            },
            learningPath: { select: { id: true, slug: true, titleAr: true } },
            diploma: { select: { id: true, slug: true, titleAr: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.auditLog.findMany({
          where: {
            action: {
              in: [
                'ADMIN_PROGRAM_INSTRUCTORS_UPDATED',
                'ADMIN_INSTRUCTOR_PAYOUT_RECORDED',
                'DIRECT_PROGRAM_PURCHASE_ACTIVATED',
                'DIRECT_PROGRAM_CHECKOUT_INITIATED',
                'COMPETENCY_CERTIFICATE_APPROVED',
                'COMPETENCY_CERTIFICATE_REJECTED',
                'ADMIN_COURSE_UPDATED',
              ],
            },
          },
          include: { actor: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
          take: 40,
        }),
      ]);

    return {
      programAccounts,
      instructorAccounts,
      paymentRecords,
      assignments,
      financialAuditLogs,
    };
  }

  async recordInstructorPayout(
    adminId: string,
    instructorId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = instructorPayoutSchema.parse(rawInput);

    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, fullName: true, role: true },
    });
    if (!instructor) {
      throw new NotFoundException('المدرب غير موجود');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let account = await tx.instructorFinancialAccount.findUnique({
        where: { instructorId },
      });
      if (!account) {
        account = await tx.instructorFinancialAccount.create({
          data: {
            accountCode: `INS-${randomBytes(3).toString('hex').toUpperCase()}`,
            instructorId,
            currency: 'EGP',
          },
        });
      }

      const paymentRecord = await tx.financialPaymentRecord.create({
        data: {
          referenceCode: `PAYOUT-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
          direction: 'OUTBOUND',
          payeeInstructorId: instructorId,
          grossAmountCents: parsed.amountCents,
          instructorShareCents: parsed.amountCents,
          platformShareCents: 0,
          currency: 'EGP',
          paymentMethodAr: parsed.paymentMethodAr,
          status: 'PAID',
          notesAr: parsed.notesAr ?? `صرف مستحقات مالية للمدرب ${instructor.fullName}`,
          recordedById: adminId,
        },
      });

      const nextPending = Math.max(0, account.pendingBalanceCents - parsed.amountCents);
      const updatedAccount = await tx.instructorFinancialAccount.update({
        where: { id: account.id },
        data: {
          totalPaidOutCents: { increment: parsed.amountCents },
          pendingBalanceCents: nextPending,
        },
      });

      await tx.instructorStatementEntry.create({
        data: {
          accountId: account.id,
          instructorId,
          type: 'INSTRUCTOR_PAYOUT',
          grossAmountCents: parsed.amountCents,
          sharePercent: 100,
          netAmountCents: -parsed.amountCents,
          balanceAfterCents: nextPending,
          descriptionAr:
            parsed.notesAr ||
            `تحويل دفعة مستحقات (${parsed.paymentMethodAr}) — مرجع ${paymentRecord.referenceCode}`,
          paymentRecordId: paymentRecord.id,
          createdById: adminId,
        },
      });

      return { account: updatedAccount, paymentRecord };
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_INSTRUCTOR_PAYOUT_RECORDED',
      entityType: 'FinancialPaymentRecord',
      entityId: result.paymentRecord.id,
      metadata: {
        instructorId,
        instructorName: instructor.fullName,
        amountCents: parsed.amountCents,
        paymentMethodAr: parsed.paymentMethodAr,
        referenceCode: result.paymentRecord.referenceCode,
      },
      ipAddress: ip,
    });

    return result;
  }

  async listCompetencyRequests() {
    return this.prisma.competencyCertificateRequest.findMany({
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
        course: {
          select: {
            id: true,
            slug: true,
            instructorId: true,
            instructor: { select: { id: true, fullName: true } },
            publishedVersion: { select: { titleAr: true } },
          },
        },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
        diploma: { select: { id: true, slug: true, titleAr: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        certificate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewCompetencyRequest(adminId: string, requestId: string, rawInput: unknown) {
    const parsed = competencyRequestReviewSchema.parse(rawInput);

    const req = await this.prisma.competencyCertificateRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        course: { include: { publishedVersion: { select: { titleAr: true } } } },
        learningPath: true,
        diploma: true,
      },
    });
    if (!req) {
      throw new NotFoundException('طلب شهادة الكفاءة غير موجود');
    }

    if (parsed.decision === 'REJECT') {
      const rejected = await this.prisma.competencyCertificateRequest.update({
        where: { id: req.id },
        data: {
          status: 'REJECTED',
          reviewedById: adminId,
          reviewedByRole: 'ADMIN',
          reviewedAt: new Date(),
          reviewNotesAr: parsed.reviewNotesAr ?? null,
        },
      });

      await this.audit.log({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'COMPETENCY_CERTIFICATE_REJECTED',
        entityType: 'CompetencyCertificateRequest',
        entityId: req.id,
        metadata: { reviewNotesAr: parsed.reviewNotesAr },
      });

      return rejected;
    }

    const programTitle =
      req.course?.publishedVersion?.titleAr ||
      req.learningPath?.titleAr ||
      req.diploma?.titleAr ||
      'البرنامج التدريبي';

    const code = `BOSLA-COMP-${new Date().getFullYear()}-${randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cert = await tx.certificate.create({
        data: {
          userId: req.userId,
          certificateCode: code,
          kind: 'COMPETENCY',
          targetType: req.targetType,
          courseId: req.courseId,
          learningPathId: req.learningPathId,
          diplomaId: req.diplomaId,
          recipientNameAr: req.user.fullName,
          titleAr: `شهادة الكفاءة المهنية: ${programTitle}`,
          approvedById: adminId,
        },
      });

      return tx.competencyCertificateRequest.update({
        where: { id: req.id },
        data: {
          status: 'APPROVED',
          reviewedById: adminId,
          reviewedByRole: 'ADMIN',
          reviewedAt: new Date(),
          reviewNotesAr: parsed.reviewNotesAr ?? 'تم اعتماد شهادة الكفاءة المهنية من الإدارة',
          certificateId: cert.id,
        },
        include: { certificate: true },
      });
    });

    await this.prisma.notification
      .create({
        data: {
          userId: req.userId,
          type: 'COMPETENCY_CERTIFICATE_REVIEWED',
          titleAr: 'تم اعتماد وإصدار شهادة الكفاءة المهنية!',
          bodyAr: `تهانينا! اعتمدت إدارة أكاديمية بوصلة شهادة الكفاءة المهنية الخاصة بك في "${programTitle}".`,
          actionUrl: `/certificates/${code}`,
          dedupKey: `comp_admin_app_${req.id}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'COMPETENCY_CERTIFICATE_APPROVED',
      entityType: 'CompetencyCertificateRequest',
      entityId: req.id,
      metadata: {
        certificateCode: code,
        userId: req.userId,
        targetType: req.targetType,
        courseId: req.courseId,
      },
    });

    return updated;
  }
}
