import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@bosla/db';
import {
  adminBroadcastNotificationSchema,
  adminBulkCoursesActionSchema,
  adminCreateUserSchema,
  adminGrantEnrollmentSchema,
  adminGrantSubscriptionSchema,
  adminIssueCertificateSchema,
  adminUpdateSubscriptionStatusSchema,
  adminUpdateUserProfileSchema,
  normalizePhoneToE164,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import {
  ensureActiveCourseDirectPurchase,
  revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant,
} from '../../core/course-entitlement.helper';
import { PrismaService } from '../../core/prisma.service';
import { syncUserRoleAssignmentsAndProvision } from '../../core/rbac-resolver';

@Injectable()
export class AdminOperationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ============================================================
  // 1. FULL USER 360 CONTROL (CREATE, INSPECT, EDIT, SESSIONS)
  // ============================================================

  async createUserAccount(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminCreateUserSchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(parsed.phoneNumber, parsed.countryCode || '+20');
    if (!phoneE164) {
      throw new BadRequestException('أدخل رقم موبايل صحيحاً');
    }

    const dupPhone = await this.prisma.user.findUnique({ where: { phoneE164 } });
    if (dupPhone) {
      throw new ConflictException('رقم الموبايل مسجل مسبقاً');
    }

    const cleanEmail = parsed.email?.trim() || null;
    if (cleanEmail) {
      const dupEmail = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
      if (dupEmail) {
        throw new ConflictException('البريد الإلكتروني مسجل مسبقاً');
      }
    }

    const passwordHash = await argon2.hash(parsed.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const created = await this.prisma.user.create({
      data: {
        fullName: parsed.fullName,
        phoneE164,
        email: cleanEmail,
        passwordHash,
        role: parsed.role,
        status: parsed.status,
        authProvider: 'PHONE_PASSWORD',
        headlineAr: parsed.headlineAr?.trim() || null,
        bioAr: parsed.bioAr?.trim() || null,
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
        createdAt: true,
      },
    });

    await syncUserRoleAssignmentsAndProvision(this.prisma, {
      userId: created.id,
      primaryRole: created.role,
      extraRoles: parsed.extraRoles,
      assignedById: adminId,
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_USER_CREATED',
      entityType: 'User',
      entityId: created.id,
      metadata: { role: created.role, extraRoles: parsed.extraRoles ?? [], status: created.status, phoneE164 },
      ipAddress: ip,
    });

    return created;
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        authProvider: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        headlineAr: true,
        bioAr: true,
        createdAt: true,
        updatedAt: true,
        assignedUserRoles: {
          include: { role: { select: { code: true, nameAr: true } } },
        },
        sellerAccount: {
          select: { id: true, status: true, codes: { select: { id: true, code: true, isActive: true } } },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            lastRecentAuthAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            plan: { select: { id: true, nameAr: true, interval: true, priceCents: true } },
          },
        },
        courseEnrollments: {
          orderBy: { startedAt: 'desc' },
          take: 50,
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                status: true,
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
              },
            },
          },
        },
        certificates: {
          orderBy: { issuedAt: 'desc' },
          take: 30,
          include: {
            course: { select: { slug: true, publishedVersion: { select: { titleAr: true } } } },
            learningPath: { select: { slug: true, titleAr: true } },
            diploma: { select: { slug: true, titleAr: true } },
          },
        },
        _count: {
          select: {
            passkeys: true,
            instructedCourses: true,
            lessonProgress: true,
            quizAttempts: true,
            communityPosts: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async updateUserProfile(
    adminId: string,
    targetUserId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = adminUpdateUserProfileSchema.parse(rawInput);
    const existing = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) throw new NotFoundException('المستخدم غير موجود');

    const updateData: Prisma.UserUpdateInput = {};

    if (parsed.fullName !== undefined) {
      updateData.fullName = parsed.fullName;
    }

    if (parsed.email !== undefined) {
      const cleanEmail = parsed.email ? parsed.email.trim() : null;
      if (cleanEmail && cleanEmail !== existing.email) {
        const dupEmail = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
        if (dupEmail && dupEmail.id !== targetUserId) {
          throw new ConflictException('البريد الإلكتروني مستخدم لحساب آخر');
        }
      }
      updateData.email = cleanEmail;
    }

    if (parsed.phoneNumber !== undefined) {
      const phoneE164 = normalizePhoneToE164(parsed.phoneNumber, parsed.countryCode || '+20');
      if (!phoneE164) throw new BadRequestException('أدخل رقم موبايل صحيحاً');
      if (phoneE164 !== existing.phoneE164) {
        const dupPhone = await this.prisma.user.findUnique({ where: { phoneE164 } });
        if (dupPhone && dupPhone.id !== targetUserId) {
          throw new ConflictException('رقم الموبايل مستخدم لحساب آخر');
        }
      }
      updateData.phoneE164 = phoneE164;
    }

    if (parsed.role !== undefined) {
      updateData.role = parsed.role;
    }

    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === 'ACTIVE') {
        updateData.failedLoginAttempts = 0;
        updateData.lockedUntil = null;
      }
    }

    if (parsed.headlineAr !== undefined) {
      updateData.headlineAr = parsed.headlineAr?.trim() || null;
    }

    if (parsed.bioAr !== undefined) {
      updateData.bioAr = parsed.bioAr?.trim() || null;
    }

    const passwordReset = Boolean(parsed.newPassword && parsed.newPassword.length >= 8);
    if (passwordReset && parsed.newPassword) {
      updateData.passwordHash = await argon2.hash(parsed.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
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

    if (parsed.role !== undefined || parsed.extraRoles !== undefined) {
      await syncUserRoleAssignmentsAndProvision(this.prisma, {
        userId: targetUserId,
        primaryRole: updated.role,
        extraRoles: parsed.extraRoles,
        assignedById: adminId,
      });
    }

    if (parsed.status === 'SUSPENDED' || passwordReset) {
      await this.prisma.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: passwordReset ? 'ADMIN_USER_PROFILE_AND_PASSWORD_UPDATED' : 'ADMIN_USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { updatedFields: Object.keys(parsed).filter((k) => k !== 'newPassword') },
      ipAddress: ip,
    });

    return updated;
  }

  async revokeUserSessions(adminId: string, targetUserId: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const res = await this.prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_USER_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { revokedCount: res.count },
      ipAddress: ip,
    });

    return { revokedCount: res.count };
  }

  // ============================================================
  // 2. SUBSCRIPTIONS, ENROLLMENTS & CERTIFICATES OVERRIDES
  // ============================================================

  async grantSubscription(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminGrantSubscriptionSchema.parse(rawInput);

    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true } }),
      this.prisma.membershipPlan.findUnique({
        where: { id: parsed.planId },
        include: { revisions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      }),
    ]);

    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (!plan) throw new NotFoundException('باقة العضوية غير موجودة');

    const revisionId = plan.currentRevisionId || plan.revisions[0]?.id;
    if (!revisionId) {
      throw new BadRequestException('الباقة المحددة لا تحتوي على إصدار صالح');
    }

    const days = parsed.durationDays ?? (plan.interval === 'ANNUAL' ? 365 : 30);
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: parsed.userId,
        planId: plan.id,
        planRevisionId: revisionId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: end,
        autoRenewSupported: false,
      },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
        plan: { select: { id: true, nameAr: true, interval: true } },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_SUBSCRIPTION_GRANTED',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { userId: parsed.userId, planId: plan.id, durationDays: days },
      ipAddress: ip,
    });

    return subscription;
  }

  async updateSubscriptionStatus(
    adminId: string,
    subscriptionId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = adminUpdateSubscriptionStatusSchema.parse(rawInput);
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('الاشتراك غير موجود');

    const now = new Date();
    const baseEnd = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const nextEnd = parsed.extendDays
      ? new Date(baseEnd.getTime() + parsed.extendDays * 24 * 60 * 60 * 1000)
      : sub.currentPeriodEnd;

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: parsed.status,
        currentPeriodEnd: nextEnd,
        cancelledAt: parsed.status === 'CANCELLED' ? now : null,
        expiredAt: parsed.status === 'EXPIRED' ? now : null,
      },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
        plan: { select: { id: true, nameAr: true, interval: true } },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_SUBSCRIPTION_UPDATED',
      entityType: 'Subscription',
      entityId: subscriptionId,
      metadata: { status: parsed.status, extendDays: parsed.extendDays ?? 0 },
      ipAddress: ip,
    });

    return updated;
  }

  async grantCourseEnrollment(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminGrantEnrollmentSchema.parse(rawInput);
    const [user, course] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true } }),
      this.prisma.course.findUnique({ where: { id: parsed.courseId }, select: { id: true } }),
    ]);
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const now = new Date();
    const enrollment = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.courseEnrollment.upsert({
        where: { userId_courseId: { userId: parsed.userId, courseId: parsed.courseId } },
        update: { source: parsed.source },
        create: {
          userId: parsed.userId,
          courseId: parsed.courseId,
          source: parsed.source,
        },
        include: {
          course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        },
      });

      await ensureActiveCourseDirectPurchase(tx, {
        userId: parsed.userId,
        courseId: parsed.courseId,
        amountCents: 0,
        purchasedAt: now,
      });

      return upserted;
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_ENROLLMENT_GRANTED',
      entityType: 'CourseEnrollment',
      entityId: enrollment.id,
      metadata: { userId: parsed.userId, courseId: parsed.courseId },
      ipAddress: ip,
    });

    return enrollment;
  }

  async revokeCourseEnrollment(
    adminId: string,
    userId: string,
    courseId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!existing) throw new NotFoundException('التسجيل غير موجود');

    await this.prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.delete({ where: { id: existing.id } });
      await revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant(tx, {
        userId,
        courseId,
        now: new Date(),
      });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_ENROLLMENT_REVOKED',
      entityType: 'CourseEnrollment',
      entityId: existing.id,
      metadata: { userId, courseId },
      ipAddress: ip,
    });

    return { deleted: true };
  }

  async issueCertificate(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminIssueCertificateSchema.parse(rawInput);
    const user = await this.prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, fullName: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    let titleAr = '';
    if (parsed.targetType === 'COURSE') {
      if (!parsed.courseId) throw new BadRequestException('اختر الكورس أولاً');
      const course = await this.prisma.course.findUnique({
        where: { id: parsed.courseId },
        include: { publishedVersion: true, draftVersion: true },
      });
      if (!course) throw new NotFoundException('الكورس غير موجود');
      titleAr = course.publishedVersion?.titleAr || course.draftVersion?.titleAr || course.slug;
    } else if (parsed.targetType === 'LEARNING_PATH') {
      if (!parsed.learningPathId) throw new BadRequestException('اختر المسار التعليمي أولاً');
      const lp = await this.prisma.learningPath.findUnique({
        where: { id: parsed.learningPathId },
      });
      if (!lp) throw new NotFoundException('المسار التعليمي غير موجود');
      titleAr = lp.titleAr;
    } else {
      if (!parsed.diplomaId) throw new BadRequestException('اختر الدبلومة أولاً');
      const dip = await this.prisma.diploma.findUnique({ where: { id: parsed.diplomaId } });
      if (!dip) throw new NotFoundException('الدبلومة غير موجودة');
      titleAr = dip.titleAr;
    }

    const kind = parsed.kind ?? 'ATTENDANCE_COMPLETION';
    let resolvedTemplateId: string | null = parsed.templateId?.trim() || null;
    let accreditingBodyNameAr: string | null = null;
    let accreditingBodyCode: string | null = null;
    let authorizationRef: string | null = null;

    if (kind === 'ACCREDITED_PROGRAM') {
      const tpl = resolvedTemplateId
        ? await this.prisma.certificateTemplate.findUnique({ where: { id: resolvedTemplateId } })
        : (await this.prisma.certificateTemplate.findFirst({
            where: {
              kind: 'ACCREDITED_PROGRAM',
              accreditationEnabled: true,
              isDefault: true,
            },
          })) ??
          (await this.prisma.certificateTemplate.findFirst({
            where: {
              kind: 'ACCREDITED_PROGRAM',
              accreditationEnabled: true,
            },
          }));

      if (
        !tpl ||
        tpl.kind !== 'ACCREDITED_PROGRAM' ||
        !tpl.accreditationEnabled ||
        !tpl.accreditingBodyNameAr?.trim() ||
        !tpl.authorizationRef?.trim()
      ) {
        throw new BadRequestException(
          'إصدار شهادة البرنامج المعتمد معطّل افتراضياً حتى يتم إعداد وتفعيل بيانات الجهة المانحة ورقم التفويض الرسمي',
        );
      }

      resolvedTemplateId = tpl.id;
      accreditingBodyNameAr = tpl.accreditingBodyNameAr.trim();
      accreditingBodyCode = tpl.accreditingBodyCode?.trim() || null;
      authorizationRef = tpl.authorizationRef.trim();
    }

    const existingActive = this.prisma.certificate?.findFirst
      ? await this.prisma.certificate.findFirst({
          where: {
            userId: user.id,
            targetType: parsed.targetType,
            kind,
            courseId: parsed.targetType === 'COURSE' ? parsed.courseId! : null,
            learningPathId: parsed.targetType === 'LEARNING_PATH' ? parsed.learningPathId! : null,
            diplomaId: parsed.targetType === 'DIPLOMA' ? parsed.diplomaId! : null,
            revokedAt: null,
          },
          include: {
            user: { select: { id: true, fullName: true, phoneE164: true } },
          },
        })
      : null;
    if (existingActive) {
      return existingActive;
    }

    const code = `BOSLA-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cert = await this.prisma.certificate.create({
      data: {
        userId: user.id,
        certificateCode: code,
        kind,
        targetType: parsed.targetType,
        courseId: parsed.targetType === 'COURSE' ? parsed.courseId! : null,
        learningPathId: parsed.targetType === 'LEARNING_PATH' ? parsed.learningPathId! : null,
        diplomaId: parsed.targetType === 'DIPLOMA' ? parsed.diplomaId! : null,
        templateId: resolvedTemplateId,
        accreditingBodyNameAr,
        accreditingBodyCode,
        authorizationRef,
        recipientNameAr: parsed.recipientNameAr?.trim() || user.fullName,
        titleAr,
      },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_CERTIFICATE_ISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: code, targetType: parsed.targetType, userId: user.id },
      ipAddress: ip,
    });

    return cert;
  }

  // ============================================================
  // 3. COURSE CLONING, BULK ACTIONS, REVIEWS & BROADCASTS
  // ============================================================

  async duplicateCourse(adminId: string, courseId: string, ip?: string) {
    const source = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        draftVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        publishedVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('الكورس غير موجود');

    const baseVer = source.draftVersion ?? source.publishedVersion;
    if (!baseVer) throw new BadRequestException('لا يوجد محتوى لنسخه في هذا الكورس');

    const suffix = randomBytes(2).toString('hex');
    const newSlug = `${source.slug.slice(0, 90)}-copy-${suffix}`;

    const cloned = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          slug: newSlug,
          instructorId: source.instructorId,
          categoryId: source.categoryId,
          status: 'DRAFT',
          isFree: source.isFree,
          difficulty: source.difficulty,
          featuredOrder: source.featuredOrder,
        },
      });

      const version = await tx.courseVersion.create({
        data: {
          courseId: course.id,
          versionNumber: 1,
          status: 'DRAFT',
          titleAr: `${baseVer.titleAr} (نسخة)`,
          subtitleAr: baseVer.subtitleAr,
          descriptionAr: baseVer.descriptionAr,
          thumbnailUrl: baseVer.thumbnailUrl,
          introVideoId: baseVer.introVideoId,
          learningObjectives: baseVer.learningObjectives,
          requirements: baseVer.requirements,
          durationMinutes: baseVer.durationMinutes,
        },
      });

      for (const sec of baseVer.sections) {
        const createdSec = await tx.courseSection.create({
          data: {
            courseVersionId: version.id,
            titleAr: sec.titleAr,
            descriptionAr: sec.descriptionAr,
            sortOrder: sec.sortOrder,
          },
        });
        for (const les of sec.lessons) {
          await tx.lesson.create({
            data: {
              sectionId: createdSec.id,
              stableKey: `${les.stableKey}-${suffix}`,
              titleAr: les.titleAr,
              descriptionAr: les.descriptionAr,
              type: les.type,
              isFreePreview: les.isFreePreview,
              durationSeconds: les.durationSeconds,
              sortOrder: les.sortOrder,
              videoAssetId: les.videoAssetId,
              articleContentAr: les.articleContentAr,
              quizId: les.quizId,
            },
          });
        }
      }

      return tx.course.update({
        where: { id: course.id },
        data: { draftVersionId: version.id },
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
      action: 'ADMIN_COURSE_DUPLICATED',
      entityType: 'Course',
      entityId: cloned.id,
      metadata: { sourceCourseId: courseId, newSlug },
      ipAddress: ip,
    });

    return cloned;
  }

  async bulkCourseAction(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminBulkCoursesActionSchema.parse(rawInput);
    const now = new Date();
    let processedCount = 0;

    if (parsed.action === 'PUBLISH') {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: parsed.courseIds } },
        select: { id: true, draftVersionId: true, publishedVersionId: true },
      });

      await this.prisma.$transaction(async (tx) => {
        for (const c of courses) {
          const targetVerId = c.draftVersionId ?? c.publishedVersionId;
          if (!targetVerId) continue;
          await tx.courseVersion.update({
            where: { id: targetVerId },
            data: {
              status: 'PUBLISHED',
              reviewedById: adminId,
              reviewedAt: now,
              publishedById: adminId,
              publishedAt: now,
            },
          });
          await tx.course.update({
            where: { id: c.id },
            data: {
              status: 'PUBLISHED',
              publishedVersionId: targetVerId,
              publishedAt: now,
              unpublishedAt: null,
              scheduledPublishAt: null,
            },
          });
          processedCount++;
        }
      });
    } else {
      const nextStatus = parsed.action === 'ARCHIVE' ? 'ARCHIVED' : 'UNPUBLISHED';
      const res = await this.prisma.course.updateMany({
        where: { id: { in: parsed.courseIds } },
        data: {
          status: nextStatus,
          ...(nextStatus === 'UNPUBLISHED' ? { unpublishedAt: now } : {}),
        },
      });
      processedCount = res.count;
    }

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COURSES_BULK_ACTION',
      entityType: 'Course',
      entityId: parsed.courseIds.join(','),
      metadata: { action: parsed.action, processedCount },
      ipAddress: ip,
    });

    return { processedCount, action: parsed.action };
  }

  listCourseReviews() {
    return this.prisma.courseReview.findMany({
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true } },
        instructor: { select: { id: true, fullName: true } },
        learningPath: { select: { id: true, titleAr: true } },
        diploma: { select: { id: true, titleAr: true } },
        course: {
          select: {
            id: true,
            slug: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async setCourseReviewPublished(
    adminId: string,
    reviewId: string,
    isPublished: boolean,
    ip?: string,
  ) {
    const updated = await this.prisma.courseReview.update({
      where: { id: reviewId },
      data: { isPublished },
    });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_REVIEW_VISIBILITY_CHANGED',
      entityType: 'CourseReview',
      entityId: reviewId,
      metadata: { isPublished },
      ipAddress: ip,
    });
    return updated;
  }

  async deleteCourseReview(adminId: string, reviewId: string, ip?: string) {
    await this.prisma.courseReview.delete({ where: { id: reviewId } });
    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_REVIEW_DELETED',
      entityType: 'CourseReview',
      entityId: reviewId,
      ipAddress: ip,
    });
    return { deleted: true, id: reviewId };
  }

  async broadcastNotification(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = adminBroadcastNotificationSchema.parse(rawInput);

    let recipientIds: string[] = [];
    if (parsed.audience === 'COURSE_ENROLLED') {
      if (!parsed.courseId) {
        throw new BadRequestException('اختر الكورس المستهدف لإرسال الإشعار');
      }
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { courseId: parsed.courseId },
        select: { userId: true },
      });
      recipientIds = Array.from(new Set(enrollments.map((e) => e.userId)));
    } else {
      const roleFilter =
        parsed.audience === 'STUDENTS'
          ? ('STUDENT' as const)
          : parsed.audience === 'INSTRUCTORS'
            ? ('INSTRUCTOR' as const)
            : undefined;
      const users = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          ...(roleFilter ? { role: roleFilter } : {}),
        },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    }

    if (recipientIds.length === 0) {
      throw new BadRequestException('لا يوجد مستخدمون مطابقون للفئة المحددة');
    }

    const batchId = randomUUID();
    const safeActionUrl = parsed.actionUrl.startsWith('/') ? parsed.actionUrl : `/${parsed.actionUrl}`;

    await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: 'COMMUNITY_POST_MODERATED',
        titleAr: parsed.titleAr,
        bodyAr: parsed.bodyAr,
        actionUrl: safeActionUrl,
        dedupKey: `admin-broadcast-${batchId}-${userId}`,
        courseId: parsed.courseId || null,
      })),
      skipDuplicates: true,
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_BROADCAST_NOTIFICATION',
      entityType: 'Notification',
      entityId: batchId,
      metadata: { audience: parsed.audience, recipientsCount: recipientIds.length },
      ipAddress: ip,
    });

    return { recipientsCount: recipientIds.length, batchId };
  }
}
