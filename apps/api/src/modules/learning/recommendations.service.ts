import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  recommendationApproveSchema,
  recommendationInstructorUpdateSchema,
  recommendationRejectSchema,
  recommendationRequestCreateSchema,
  recommendationRevokeSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import { IntegrationsMailService } from '../integrations-mail/integrations-mail.service';
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional()
    @Inject(IntegrationsMailService)
    private readonly mailIntegrations?: IntegrationsMailService,
  ) {}

  private generateVerificationCode(): string {
    return `BOSLA-REC-${new Date().getFullYear()}-${randomBytes(6)
      .toString('hex')
      .toUpperCase()}`;
  }

  async requestRecommendation(userId: string, rawBody: unknown, ipAddress?: string) {
    const parsed = recommendationRequestCreateSchema.parse(rawBody ?? {});

    if (parsed.targetType === 'COURSE' && !parsed.courseId) {
      throw new BadRequestException('يرجى اختيار الكورس المطلوب التوصية بشأنه');
    }
    if (parsed.targetType === 'LEARNING_PATH' && !parsed.learningPathId) {
      throw new BadRequestException('يرجى اختيار المسار التعليمي المطلوب التوصية بشأنه');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true },
    });
    if (!student) throw new NotFoundException('حساب المتدرب غير موجود');

    let instructorId: string | null = null;
    let targetTitleAr = '';

    if (parsed.targetType === 'COURSE' && parsed.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: parsed.courseId },
        include: {
          publishedVersion: { select: { titleAr: true } },
          draftVersion: { select: { titleAr: true } },
          instructorAssignments: {
            orderBy: { isPrimary: 'desc' },
            select: { instructorId: true },
          },
        },
      });
      if (!course || course.status !== 'PUBLISHED') {
        throw new NotFoundException('الكورس غير موجود أو غير منشور');
      }

      const access = await this.membership.checkCourseAccessForUser({
        userId,
        userRole: student.role,
        courseId: course.id,
      });
      if (!access.allowed) {
        throw new ForbiddenException('يجب أن تكون مسجلاً أو مشتركاً في الكورس لطلب خطاب توصية من مدربه');
      }

      instructorId =
        course.instructorAssignments[0]?.instructorId || course.instructorId;
      targetTitleAr = course.publishedVersion?.titleAr || course.draftVersion?.titleAr || course.slug;
    } else if (parsed.targetType === 'LEARNING_PATH' && parsed.learningPathId) {
      const lp = await this.prisma.learningPath.findUnique({
        where: { id: parsed.learningPathId },
        include: {
          instructorAssignments: {
            orderBy: { isPrimary: 'desc' },
            select: { instructorId: true },
          },
          courses: {
            orderBy: { sortOrder: 'asc' },
            include: {
              course: { select: { id: true, instructorId: true } },
            },
          },
        },
      });
      if (!lp || lp.status !== 'PUBLISHED') {
        throw new NotFoundException('المسار التعليمي غير موجود أو غير منشور');
      }

      const [membershipSummary, directEnt, enrolledInPath] = await Promise.all([
        this.membership.getMyMembershipSummary(userId),
        this.membership.getUserDirectPurchasedEntitlements(userId),
        this.prisma.courseEnrollment.count({
          where: {
            userId,
            courseId: { in: lp.courses.map((c) => c.courseId) },
          },
        }),
      ]);

      const hasPathAccess =
        membershipSummary.entitledPathIds.includes(lp.id) ||
        directEnt.pathIds.includes(lp.id) ||
        enrolledInPath > 0;
      if (!hasPathAccess) {
        throw new ForbiddenException('يجب أن تكون مسجلاً أو مشتركاً في المسار لطلب خطاب توصية بشأنه');
      }

      instructorId =
        lp.instructorAssignments[0]?.instructorId ||
        lp.courses[0]?.course?.instructorId ||
        null;
      targetTitleAr = lp.titleAr;
    }

    if (!instructorId) {
      throw new BadRequestException('لا يوجد مدرب معين لهذا المحتوى حالياً لاستقبال طلب التوصية');
    }

    const existingActive = await this.prisma.recommendationRequest.findFirst({
      where: {
        studentId: userId,
        targetType: parsed.targetType,
        ...(parsed.targetType === 'COURSE'
          ? { courseId: parsed.courseId! }
          : { learningPathId: parsed.learningPathId! }),
        status: { in: ['PENDING', 'DRAFT_INSTRUCTOR', 'APPROVED'] },
      },
    });
    if (existingActive) {
      throw new ConflictException(
        existingActive.status === 'APPROVED'
          ? 'لديك خطاب توصية معتمد بالفعل لهذا المحتوى'
          : 'يوجد طلب توصية قيد المراجعة بالفعل لهذا المحتوى',
      );
    }

    const instructor = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, fullName: true, email: true },
    });
    if (!instructor) {
      throw new NotFoundException('حساب المدرب غير موجود');
    }

    const created = await this.prisma.recommendationRequest.create({
      data: {
        verificationCode: this.generateVerificationCode(),
        studentId: userId,
        instructorId,
        targetType: parsed.targetType,
        courseId: parsed.targetType === 'COURSE' ? parsed.courseId! : null,
        learningPathId: parsed.targetType === 'LEARNING_PATH' ? parsed.learningPathId! : null,
        status: 'PENDING',
        studentGoalAr: parsed.studentGoalAr,
        purposeAr: parsed.purposeAr ?? null,
      },
      include: {
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
    });

    await this.prisma.notification
      .create({
        data: {
          userId: instructor.id,
          type: 'COMPETENCY_CERTIFICATE_REQUESTED',
          titleAr: `طلب خطاب توصية جديد من المتدرب ${student.fullName}`,
          bodyAr: `المحتوى: ${targetTitleAr} — يمكنك مراجعة الطلب وصياغة الخطاب واعتماده من لوحة المدرب.`,
          actionUrl: '/instructor?tab=recommendations',
          dedupKey: `rec_req_${created.id}`,
        },
      })
      .catch(() => {});

    if (this.mailIntegrations && instructor.email) {
      const webOrigin = (process.env.WEB_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await this.mailIntegrations
        .dispatchEmail({
          dedupeKey: `rec_req_mail_${created.id}`,
          category: 'RECOMMENDATION_REQUESTED',
          recipientEmail: instructor.email,
          recipientName: instructor.fullName,
          subjectAr: `طلب خطاب توصية جديد — ${targetTitleAr}`,
          textAr: `تقدم المتدرب ${student.fullName} بطلب خطاب توصية بخصوص "${targetTitleAr}". يمكنك المراجعة والاعتماد عبر لوحة المدرب: ${webOrigin}/instructor?tab=recommendations`,
          htmlAr: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;"><h2>طلب خطاب توصية جديد</h2><p>المتدرب: <strong>${student.fullName}</strong></p><p>المحتوى: <strong>${targetTitleAr}</strong></p><p><a href="${webOrigin}/instructor?tab=recommendations">مراجعة الطلب في لوحة المدرب</a></p></div>`,
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: userId,
      action: 'RECOMMENDATION_REQUESTED',
      entityType: 'RecommendationRequest',
      entityId: created.id,
      ipAddress,
      metadata: {
        targetType: parsed.targetType,
        courseId: created.courseId,
        learningPathId: created.learningPathId,
        instructorId,
      },
    });

    return created;
  }

  async listMyRecommendations(studentId: string) {
    const rows = await this.prisma.recommendationRequest.findMany({
      where: { studentId },
      include: {
        instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return rows.map((r) => {
      const isApprovedOrRevoked = r.status === 'APPROVED' || r.status === 'REVOKED';
      return {
        id: r.id,
        verificationCode: r.verificationCode,
        targetType: r.targetType,
        courseId: r.courseId,
        learningPathId: r.learningPathId,
        status: r.status,
        studentGoalAr: r.studentGoalAr,
        purposeAr: r.purposeAr,
        instructor: r.instructor,
        courseTitleAr: r.course?.publishedVersion?.titleAr || null,
        learningPathTitleAr: r.learningPath?.titleAr || null,
        letterTitleAr: r.status === 'APPROVED' ? r.letterTitleAr : null,
        letterBodyAr: r.status === 'APPROVED' ? r.letterBodyAr : null,
        approvedSnapshot: isApprovedOrRevoked ? r.approvedSnapshot : null,
        rejectionReasonAr: r.status === 'REJECTED' ? r.rejectionReasonAr : null,
        revokeReasonAr: r.status === 'REVOKED' ? r.revokeReasonAr : null,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt,
        revokedAt: r.revokedAt,
        versionNumber: r.versionNumber,
      };
    });
  }

  async getStudentRecommendationPrintData(studentId: string, requestId: string) {
    const row = await this.prisma.recommendationRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, fullName: true } },
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
    });
    if (!row) throw new NotFoundException('طلب التوصية غير موجود');
    if (row.studentId !== studentId) {
      throw new ForbiddenException('لا تملك صلاحية عرض خطاب التوصية هذا');
    }
    if (row.status !== 'APPROVED' || row.revokedAt) {
      throw new BadRequestException('خطاب التوصية غير معتمد حالياً أو تم إبطاله');
    }
    return row;
  }

  async listForInstructor(instructorId: string) {
    return this.prisma.recommendationRequest.findMany({
      where: { instructorId },
      include: {
        student: { select: { id: true, fullName: true, headlineAr: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async saveInstructorDraft(
    instructorId: string,
    requestId: string,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = recommendationInstructorUpdateSchema.parse(rawBody ?? {});
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) throw new NotFoundException('طلب التوصية غير موجود');
    if (existing.instructorId !== instructorId) {
      throw new ForbiddenException('فقط المدرب المعني بهذا الطلب يمكنه تحرير مسودة التوصية');
    }
    if (existing.status === 'APPROVED' || existing.status === 'REVOKED') {
      throw new BadRequestException('لا يمكن تعديل مسودة خطاب معتمد أو مبطل');
    }

    const updated = await this.prisma.recommendationRequest.update({
      where: { id: requestId },
      data: {
        status: 'DRAFT_INSTRUCTOR',
        letterTitleAr: parsed.letterTitleAr ?? existing.letterTitleAr ?? 'خطاب توصية أكاديمي ومهني',
        letterBodyAr: parsed.letterBodyAr,
        instructorNoteAr: parsed.instructorNoteAr ?? existing.instructorNoteAr,
      },
    });

    await this.audit.log({
      actorId: instructorId,
      action: 'RECOMMENDATION_DRAFT_SAVED',
      entityType: 'RecommendationRequest',
      entityId: updated.id,
      ipAddress,
    });

    return updated;
  }

  async approveByInstructor(
    instructorId: string,
    requestId: string,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = recommendationApproveSchema.parse(rawBody ?? {});
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
    });
    if (!existing) throw new NotFoundException('طلب التوصية غير موجود');
    if (existing.instructorId !== instructorId) {
      throw new ForbiddenException('لا يمكن اعتماد خطاب التوصية إلا بواسطة المدرب المعني نفسه بعد مراجعته');
    }
    if (existing.status === 'REVOKED') {
      throw new BadRequestException('تم إبطال هذا الطلب ولا يمكن اعتماده');
    }

    const now = new Date();
    const targetTitleAr =
      existing.course?.publishedVersion?.titleAr ||
      existing.learningPath?.titleAr ||
      'البرنامج التدريبي';
    const nextVersion =
      existing.status === 'APPROVED' ? existing.versionNumber + 1 : existing.versionNumber;
    const finalTitle = parsed.letterTitleAr?.trim() || existing.letterTitleAr || `خطاب توصية: ${targetTitleAr}`;

    const approvedSnapshot = {
      verificationCode: existing.verificationCode,
      versionNumber: nextVersion,
      approvedAt: now.toISOString(),
      studentNameAr: existing.student.fullName,
      instructorNameAr: existing.instructor.fullName,
      instructorHeadlineAr: existing.instructor.headlineAr ?? null,
      targetType: existing.targetType,
      targetTitleAr,
      targetSlug: existing.course?.slug || existing.learningPath?.slug || null,
      letterTitleAr: finalTitle,
      letterBodyAr: parsed.letterBodyAr,
    };

    const updated = await this.prisma.recommendationRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        letterTitleAr: finalTitle,
        letterBodyAr: parsed.letterBodyAr,
        instructorNoteAr: parsed.instructorNoteAr ?? existing.instructorNoteAr,
        approvedSnapshot: approvedSnapshot as any,
        versionNumber: nextVersion,
        approvedAt: now,
        rejectedAt: null,
        rejectionReasonAr: null,
      },
      include: {
        student: { select: { id: true, fullName: true } },
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
    });

    await this.prisma.notification
      .create({
        data: {
          userId: existing.studentId,
          type: 'COMPETENCY_CERTIFICATE_REVIEWED',
          titleAr: 'تم اعتماد خطاب التوصية الخاص بك!',
          bodyAr: `اعتمد المدرب ${existing.instructor.fullName} خطاب التوصية لـ "${targetTitleAr}" (رمز التحقق: ${existing.verificationCode}).`,
          actionUrl: '/student?tab=credentials',
          dedupKey: `rec_app_${existing.id}_v${nextVersion}`,
        },
      })
      .catch(() => {});

    if (this.mailIntegrations && existing.student.email) {
      const webOrigin = (process.env.WEB_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await this.mailIntegrations
        .dispatchEmail({
          dedupeKey: `rec_app_mail_${existing.id}_v${nextVersion}`,
          category: 'RECOMMENDATION_APPROVED',
          recipientEmail: existing.student.email,
          recipientName: existing.student.fullName,
          subjectAr: `تم اعتماد خطاب التوصية الخاص بك — ${targetTitleAr}`,
          textAr: `تهانينا ${existing.student.fullName}، اعتمد المدرب ${existing.instructor.fullName} خطاب التوصية الخاص بك. رمز التحقق: ${existing.verificationCode}. يمكنك طباعته من: ${webOrigin}/student?tab=credentials`,
          htmlAr: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;"><h2>تم اعتماد خطاب التوصية</h2><p>تهانينا <strong>${existing.student.fullName}</strong>،</p><p>اعتمد المدرب <strong>${existing.instructor.fullName}</strong> خطاب التوصية الخاص بك في "${targetTitleAr}".</p><p>رمز التحقق الفريد: <strong>${existing.verificationCode}</strong></p></div>`,
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: instructorId,
      action: 'RECOMMENDATION_APPROVED',
      entityType: 'RecommendationRequest',
      entityId: updated.id,
      ipAddress,
      metadata: {
        verificationCode: existing.verificationCode,
        studentId: existing.studentId,
        versionNumber: nextVersion,
      },
    });

    return updated;
  }

  async rejectByInstructor(
    instructorId: string,
    requestId: string,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = recommendationRejectSchema.parse(rawBody ?? {});
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) throw new NotFoundException('طلب التوصية غير موجود');
    if (existing.instructorId !== instructorId) {
      throw new ForbiddenException('فقط المدرب المعني يمكنه رفض هذا الطلب');
    }
    if (existing.status === 'APPROVED' || existing.status === 'REVOKED') {
      throw new BadRequestException('لا يمكن رفض خطاب معتمد أو مبطل بالفعل');
    }

    const updated = await this.prisma.recommendationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReasonAr: parsed.rejectionReasonAr,
        rejectedAt: new Date(),
      },
    });

    await this.prisma.notification
      .create({
        data: {
          userId: existing.studentId,
          type: 'COMPETENCY_CERTIFICATE_REVIEWED',
          titleAr: 'تحديث على طلب خطاب التوصية',
          bodyAr: `سبب الملاحظة: ${parsed.rejectionReasonAr}`,
          actionUrl: '/student?tab=credentials',
          dedupKey: `rec_rej_${existing.id}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId: instructorId,
      action: 'RECOMMENDATION_REJECTED',
      entityType: 'RecommendationRequest',
      entityId: updated.id,
      ipAddress,
      metadata: { reason: parsed.rejectionReasonAr },
    });

    return updated;
  }

  async listForAdmin() {
    return this.prisma.recommendationRequest.findMany({
      include: {
        student: { select: { id: true, fullName: true } },
        instructor: { select: { id: true, fullName: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { id: true, slug: true, titleAr: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 150,
    });
  }

  async revokeByAdmin(
    actor: AuthenticatedContextUser,
    requestId: string,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = recommendationRevokeSchema.parse(rawBody ?? {});
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) throw new NotFoundException('طلب التوصية غير موجود');

    const updated = await this.prisma.recommendationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: actor.id,
        revokeReasonAr: parsed.revokeReasonAr,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'RECOMMENDATION_REVOKED',
      entityType: 'RecommendationRequest',
      entityId: updated.id,
      ipAddress,
      metadata: {
        verificationCode: existing.verificationCode,
        revokeReasonAr: parsed.revokeReasonAr,
      },
    });

    return updated;
  }

  /**
   * Unified public credential verification endpoint.
   * Accepts both Certificates and Recommendation Letters by verification code.
   * Strictly omits PII (email, phone, studentGoalAr, instructorNoteAr, letterBodyAr).
   */
  async verifyPublicCredentialByCode(rawCode: string) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || code.length < 6) {
      throw new NotFoundException('أدخل رمز تحقق صحيحاً');
    }

    const cert = await this.prisma.certificate.findUnique({
      where: { certificateCode: code },
      include: {
        course: {
          select: {
            slug: true,
            instructor: { select: { fullName: true } },
            publishedVersion: { select: { titleAr: true } },
          },
        },
        learningPath: { select: { slug: true, titleAr: true } },
        diploma: { select: { slug: true, titleAr: true } },
      },
    });

    if (cert) {
      const isValid = !cert.revokedAt;
      const credentialLabelAr =
        cert.kind === 'ACCREDITED_PROGRAM'
          ? 'شهادة برنامج تدريبي معتمد'
          : cert.kind === 'COMPETENCY'
            ? 'شهادة الكفاءة والتدريب المهني'
            : cert.targetType === 'LEARNING_PATH'
              ? 'شهادة حضور وإتمام مسار تعليمي'
              : 'شهادة حضور وإتمام كورس';

      const contentTitleAr =
        cert.course?.publishedVersion?.titleAr ||
        cert.learningPath?.titleAr ||
        cert.diploma?.titleAr ||
        cert.titleAr;

      return {
        credentialType: 'CERTIFICATE' as const,
        code: cert.certificateCode,
        status: isValid ? ('APPROVED' as const) : ('REVOKED' as const),
        isValid,
        holderNameAr: cert.recipientNameAr,
        credentialLabelAr,
        contentTitleAr,
        targetType: cert.targetType,
        instructorNameAr: cert.course?.instructor?.fullName ?? null,
        issuedAt: cert.issuedAt,
        revokedAt: cert.revokedAt,
        revokeReasonAr: null,
        accreditation:
          cert.kind === 'ACCREDITED_PROGRAM' && cert.accreditingBodyNameAr
            ? {
                bodyNameAr: cert.accreditingBodyNameAr,
                bodyCode: cert.accreditingBodyCode,
                authorizationRef: cert.authorizationRef,
              }
            : null,
      };
    }

    const rec = await this.prisma.recommendationRequest.findUnique({
      where: { verificationCode: code },
      include: {
        student: { select: { fullName: true } },
        instructor: { select: { fullName: true } },
        course: { select: { publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { titleAr: true } },
      },
    });

    if (rec && (rec.status === 'APPROVED' || rec.status === 'REVOKED')) {
      const snap = (rec.approvedSnapshot as Record<string, unknown> | null) ?? {};
      const isValid = rec.status === 'APPROVED' && !rec.revokedAt;
      const contentTitleAr =
        typeof snap.targetTitleAr === 'string' && snap.targetTitleAr
          ? snap.targetTitleAr
          : rec.course?.publishedVersion?.titleAr || rec.learningPath?.titleAr || 'محتوى تدريبي';

      return {
        credentialType: 'RECOMMENDATION' as const,
        code: rec.verificationCode,
        status: isValid ? ('APPROVED' as const) : ('REVOKED' as const),
        isValid,
        holderNameAr:
          typeof snap.studentNameAr === 'string' && snap.studentNameAr
            ? snap.studentNameAr
            : rec.student.fullName,
        credentialLabelAr: 'خطاب توصية معتمد من المدرب',
        contentTitleAr,
        targetType: rec.targetType,
        instructorNameAr:
          typeof snap.instructorNameAr === 'string' && snap.instructorNameAr
            ? snap.instructorNameAr
            : rec.instructor.fullName,
        issuedAt: rec.approvedAt,
        revokedAt: rec.revokedAt,
        revokeReasonAr: rec.revokeReasonAr ?? null,
        versionNumber:
          typeof snap.versionNumber === 'number' ? snap.versionNumber : rec.versionNumber,
        accreditation: null,
      };
    }

    throw new NotFoundException('لم يتم العثور على شهادة أو خطاب توصية معتمد بهذا الرمز');
  }
}
