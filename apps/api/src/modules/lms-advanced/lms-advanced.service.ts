import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import QRCode from 'qrcode';
import {
  assignmentCreateSchema,
  assignmentGradeSchema,
  assignmentSubmitSchema,
  instructorContractSchema,
  instructorProfileUpdateSchema,
  markAttendanceSchema,
  questionBankItemSchema,
  trainingSessionSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class LmsAdvancedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ============================================================
  // 1. COURSE DELIVERY MODES (ONLINE / OFFLINE / HYBRID) & WAITLISTS
  // ============================================================

  async updateCourseDeliverySettings(
    actor: AuthenticatedContextUser,
    courseId: string,
    body: {
      deliveryMode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
      maxCapacity?: number | null;
      waitlistEnabled?: boolean;
      venueNameAr?: string | null;
      venueAddressAr?: string | null;
      availabilityStartAt?: string | null;
      availabilityEndAt?: string | null;
      accessDurationDays?: number | null;
    },
    ipAddress?: string,
  ) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(body.deliveryMode ? { deliveryMode: body.deliveryMode } : {}),
        ...(body.maxCapacity !== undefined ? { maxCapacity: body.maxCapacity } : {}),
        ...(body.waitlistEnabled !== undefined ? { waitlistEnabled: Boolean(body.waitlistEnabled) } : {}),
        ...(body.venueNameAr !== undefined ? { venueNameAr: body.venueNameAr } : {}),
        ...(body.venueAddressAr !== undefined ? { venueAddressAr: body.venueAddressAr } : {}),
        ...(body.availabilityStartAt !== undefined
          ? { availabilityStartAt: body.availabilityStartAt ? new Date(body.availabilityStartAt) : null }
          : {}),
        ...(body.availabilityEndAt !== undefined
          ? { availabilityEndAt: body.availabilityEndAt ? new Date(body.availabilityEndAt) : null }
          : {}),
        ...(body.accessDurationDays !== undefined ? { accessDurationDays: body.accessDurationDays } : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'COURSE_DELIVERY_SETTINGS_UPDATED',
      entityType: 'Course',
      entityId: courseId,
      metadata: body as any,
      ipAddress,
    });

    return updated;
  }

  async joinCourseWaitlist(user: AuthenticatedContextUser, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('الكورس غير موجود');
    if (!course.waitlistEnabled) {
      throw new BadRequestException('قائمة الانتظار غير مفعلة لهذا الكورس حالياً');
    }

    const existing = await this.prisma.courseWaitlist.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
    });
    if (existing) return existing;

    const count = await this.prisma.courseWaitlist.count({ where: { courseId } });
    return this.prisma.courseWaitlist.create({
      data: { courseId, userId: user.id, position: count + 1 },
    });
  }

  async listCourseWaitlist(courseId: string) {
    return this.prisma.courseWaitlist.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
      },
    });
  }

  // ============================================================
  // 2. TRAINING SESSIONS & ATTENDANCE TRACKING
  // ============================================================

  async listSessions(courseId?: string) {
    return this.prisma.trainingSession.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: { startsAt: 'asc' },
      include: {
        course: { select: { id: true, slug: true, deliveryMode: true, publishedVersion: { select: { titleAr: true } } } },
        instructor: { select: { id: true, fullName: true } },
        cohort: { select: { id: true, titleAr: true } },
        _count: { select: { attendance: true } },
      },
    });
  }

  async createSession(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = trainingSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الجلسة التدريبية غير صالحة');
    }

    const d = parsed.data;
    const startsAt = new Date(d.startsAt);
    const endsAt = new Date(d.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('وقت نهاية الجلسة يجب أن يكون بعد وقت البداية');
    }

    const saved = await this.prisma.trainingSession.create({
      data: {
        courseId: d.courseId,
        cohortId: d.cohortId ?? null,
        instructorId: d.instructorId ?? actor.id,
        titleAr: d.titleAr,
        sessionType: d.sessionType,
        startsAt,
        endsAt,
        venueAr: d.venueAr ?? null,
        manualMeetingUrl: d.manualMeetingUrl ?? null,
        recordingUrl: d.recordingUrl ?? null,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'TRAINING_SESSION_CREATED',
      entityType: 'TrainingSession',
      entityId: saved.id,
      metadata: { courseId: d.courseId, sessionType: d.sessionType, startsAt: startsAt.toISOString() },
      ipAddress,
    });

    return saved;
  }

  async markSessionAttendance(
    actor: AuthenticatedContextUser,
    sessionId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = markAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الحضور غير صالحة');
    }

    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('الجلسة التدريبية غير موجودة');

    const now = new Date();
    const results = await this.prisma.$transaction(async (tx) => {
      const saved = [];
      for (const r of parsed.data.records) {
        const rec = await tx.attendanceRecord.upsert({
          where: { sessionId_userId: { sessionId, userId: r.userId } },
          update: {
            status: r.status,
            notesAr: r.notesAr ?? null,
            markedById: actor.id,
            markedAt: now,
          },
          create: {
            sessionId,
            userId: r.userId,
            status: r.status,
            notesAr: r.notesAr ?? null,
            markedById: actor.id,
            markedAt: now,
          },
        });
        saved.push(rec);
      }
      return saved;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SESSION_ATTENDANCE_MARKED',
      entityType: 'TrainingSession',
      entityId: sessionId,
      metadata: { count: results.length },
      ipAddress,
    });

    return { sessionId, markedCount: results.length, records: results };
  }

  async getSessionAttendance(sessionId: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        attendance: {
          include: {
            user: { select: { id: true, fullName: true, phoneE164: true } },
            markedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('الجلسة التدريبية غير موجودة');
    return session;
  }

  // ============================================================
  // 3. QUESTION BANK & MANUAL QUIZ GRADING
  // ============================================================

  async listQuestionBank(params: { courseId?: string; categoryId?: string; questionType?: string }) {
    const [categories, items] = await Promise.all([
      this.prisma.questionBankCategory.findMany({ orderBy: { nameAr: 'asc' } }),
      this.prisma.questionBankItem.findMany({
        where: {
          ...(params.courseId ? { courseId: params.courseId } : {}),
          ...(params.categoryId ? { categoryId: params.categoryId } : {}),
          ...(params.questionType ? { questionType: params.questionType as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, nameAr: true } },
          course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        },
      }),
    ]);
    return { categories, items };
  }

  async createQuestionBankCategory(body: { nameAr: string; descriptionAr?: string }) {
    if (!body?.nameAr?.trim()) throw new BadRequestException('اسم التصنيف مطلوب');
    return this.prisma.questionBankCategory.upsert({
      where: { nameAr: body.nameAr.trim() },
      update: { descriptionAr: body.descriptionAr?.trim() || null },
      create: { nameAr: body.nameAr.trim(), descriptionAr: body.descriptionAr?.trim() || null },
    });
  }

  async createQuestionBankItem(actor: AuthenticatedContextUser, body: unknown) {
    const parsed = questionBankItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات السؤال غير صالحة');
    }

    const d = parsed.data;
    return this.prisma.questionBankItem.create({
      data: {
        categoryId: d.categoryId ?? null,
        courseId: d.courseId ?? null,
        questionType: d.questionType,
        promptAr: d.promptAr,
        options: (d.options ?? []) as any,
        correctAnswer: d.correctAnswer ?? null,
        explanationAr: d.explanationAr ?? null,
        defaultPoints: d.defaultPoints,
        createdById: actor.id,
      },
    });
  }

  async manualGradeQuizAttempt(
    actor: AuthenticatedContextUser,
    attemptId: string,
    body: { scorePercent: number; passed?: boolean; manualScoreNotes?: string },
    ipAddress?: string,
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true },
    });
    if (!attempt) throw new NotFoundException('محاولة الاختبار غير موجودة');

    const score = Math.max(0, Math.min(100, Math.round(Number(body.scorePercent))));
    const passed = body.passed !== undefined ? Boolean(body.passed) : score >= attempt.quiz.passingScorePercent;

    const updated = await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        scorePercent: score,
        passed,
        manualGradingRequired: false,
        manualGradedById: actor.id,
        manualScoreNotes: body.manualScoreNotes?.trim() || null,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'QUIZ_ATTEMPT_MANUALLY_GRADED',
      entityType: 'QuizAttempt',
      entityId: attemptId,
      metadata: { scorePercent: score, passed },
      ipAddress,
    });

    return updated;
  }

  // ============================================================
  // 4. ASSIGNMENTS & PRACTICAL PROJECTS WITH RUBRICS
  // ============================================================

  async listAssignments(courseId?: string) {
    return this.prisma.assignment.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async createAssignment(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = assignmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الواجب غير صالحة');
    }

    const d = parsed.data;
    const saved = await this.prisma.assignment.create({
      data: {
        courseId: d.courseId,
        lessonId: d.lessonId ?? null,
        titleAr: d.titleAr,
        instructionsAr: d.instructionsAr,
        maxScore: d.maxScore,
        passingScore: d.passingScore,
        dueAt: d.dueAt ? new Date(d.dueAt) : null,
        isPracticalProject: d.isPracticalProject,
        rubric: (d.rubric ?? null) as any,
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: saved.id,
      metadata: { courseId: d.courseId, isPracticalProject: d.isPracticalProject },
      ipAddress,
    });

    return saved;
  }

  async submitAssignment(user: AuthenticatedContextUser, assignmentId: string, body: unknown) {
    const parsed = assignmentSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التسليم غير صالحة');
    }

    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('الواجب أو المشروع غير موجود');

    return this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId, userId: user.id } },
      update: {
        submissionTextAr: parsed.data.submissionTextAr,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
      create: {
        assignmentId,
        userId: user.id,
        submissionTextAr: parsed.data.submissionTextAr,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
    });
  }

  async listAssignmentSubmissions(assignmentId: string) {
    return this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneE164: true } },
        gradedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async gradeAssignmentSubmission(
    actor: AuthenticatedContextUser,
    submissionId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = assignmentGradeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التقييم غير صالحة');
    }

    const sub = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!sub) throw new NotFoundException('تسليم الواجب غير موجود');
    if (parsed.data.score > sub.assignment.maxScore) {
      throw new BadRequestException(`الدرجة لا يمكن أن تتجاوز الحد الأقصى (${sub.assignment.maxScore})`);
    }

    const nextStatus = parsed.data.requestResubmit ? 'RESUBMIT_REQUESTED' : 'GRADED';
    const updated = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: parsed.data.score,
        feedbackAr: parsed.data.feedbackAr ?? null,
        rubricScores: (parsed.data.rubricScores ?? null) as any,
        status: nextStatus,
        gradedById: actor.id,
        gradedAt: new Date(),
      },
    });

    await this.prisma.notification.createMany({
      data: [
        {
          userId: sub.userId,
          type: 'ASSIGNMENT_GRADED',
          titleAr: parsed.data.requestResubmit ? 'مطلوب إعادة تسليم الواجب' : 'تم تقييم الواجب/المشروع التطبيقي',
          bodyAr: `حصلت على ${parsed.data.score} من ${sub.assignment.maxScore} في "${sub.assignment.titleAr}".`,
          actionUrl: '/student',
          dedupKey: `assign-grade-${sub.id}-${Date.now()}`,
          courseId: sub.assignment.courseId,
        },
      ],
      skipDuplicates: true,
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ASSIGNMENT_SUBMISSION_GRADED',
      entityType: 'AssignmentSubmission',
      entityId: submissionId,
      metadata: { score: parsed.data.score, status: nextStatus },
      ipAddress,
    });

    return updated;
  }

  // ============================================================
  // 5. INSTRUCTOR PROFILE & CONTRACT EXTENSIONS (PHASE 7)
  // ============================================================

  async listInstructorProfilesAndContracts() {
    const instructors = await this.prisma.user.findMany({
      where: { role: 'INSTRUCTOR' },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        status: true,
        headlineAr: true,
        instructorProfile: true,
        instructorContracts: { orderBy: { endDate: 'desc' } },
        instructorFinancialAccount: true,
        _count: { select: { programInstructorAssignments: true } },
      },
    });
    return instructors;
  }

  async upsertInstructorProfile(
    actor: AuthenticatedContextUser,
    instructorId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = instructorProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات ملف المدرب غير صالحة');
    }

    const canReview =
      actor.permissions.includes('instructor.finance.manage') ||
      actor.roles.includes('ADMIN') ||
      actor.roles.includes('SUPER_ADMIN');
    if (!canReview && actor.id !== instructorId) {
      throw new ForbiddenException('لا يمكنك تعديل ملف مدرب آخر');
    }

    const saved = await this.prisma.instructorProfile.upsert({
      where: { userId: instructorId },
      update: {
        specializations: parsed.data.specializations,
        yearsExperience: parsed.data.yearsExperience,
        cvUrl: parsed.data.cvUrl ?? null,
        ...(canReview && parsed.data.approvalStatus
          ? {
              approvalStatus: parsed.data.approvalStatus,
              reviewNotesAr: parsed.data.reviewNotesAr ?? null,
              reviewedById: actor.id,
              reviewedAt: new Date(),
            }
          : {}),
      },
      create: {
        userId: instructorId,
        specializations: parsed.data.specializations,
        yearsExperience: parsed.data.yearsExperience,
        cvUrl: parsed.data.cvUrl ?? null,
        approvalStatus: canReview && parsed.data.approvalStatus ? parsed.data.approvalStatus : 'NEW',
        reviewNotesAr: parsed.data.reviewNotesAr ?? null,
        reviewedById: canReview ? actor.id : null,
        reviewedAt: canReview ? new Date() : null,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'INSTRUCTOR_PROFILE_UPDATED',
      entityType: 'InstructorProfile',
      entityId: saved.id,
      metadata: { instructorId, approvalStatus: saved.approvalStatus },
      ipAddress,
    });

    return saved;
  }

  async createInstructorContract(
    actor: AuthenticatedContextUser,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = instructorContractSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات عقد المدرب غير صالحة');
    }

    const d = parsed.data;
    const startDate = new Date(d.startDate);
    const endDate = new Date(d.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية');
    }

    const saved = await this.prisma.instructorContract.create({
      data: {
        instructorId: d.instructorId,
        titleAr: d.titleAr,
        startDate,
        endDate,
        defaultSharePercent: d.defaultSharePercent.toFixed(2),
        deductSellerCommission: Boolean(d.deductSellerCommission), // defaults to false per v1.2 §3!
        documentUrl: d.documentUrl ?? null,
        isActive: true,
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'INSTRUCTOR_CONTRACT_CREATED',
      entityType: 'InstructorContract',
      entityId: saved.id,
      metadata: {
        instructorId: d.instructorId,
        defaultSharePercent: d.defaultSharePercent,
        deductSellerCommission: saved.deductSellerCommission,
        endDate: endDate.toISOString(),
      },
      ipAddress,
    });

    return saved;
  }

  // ============================================================
  // 6. CERTIFICATE TEMPLATES, QR VERIFICATION, REISSUE & REVOKE
  // ============================================================

  async listCertificateTemplates() {
    return this.prisma.certificateTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async upsertCertificateTemplate(body: {
    key: string;
    nameAr: string;
    kind: 'ATTENDANCE_COMPLETION' | 'COMPETENCY';
    headlineAr: string;
    bodyTemplateAr: string;
    primaryColor?: string;
    accentColor?: string;
    signatureNameAr?: string;
    isDefault?: boolean;
  }) {
    const key = (body?.key || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!key || !body?.nameAr?.trim() || !body?.headlineAr?.trim()) {
      throw new BadRequestException('بيانات قالب الشهادة غير مكتملة');
    }
    return this.prisma.certificateTemplate.upsert({
      where: { key },
      update: {
        nameAr: body.nameAr.trim(),
        kind: body.kind,
        headlineAr: body.headlineAr.trim(),
        bodyTemplateAr: body.bodyTemplateAr.trim(),
        primaryColor: body.primaryColor || '#0F1A4A',
        accentColor: body.accentColor || '#F5B841',
        signatureNameAr: body.signatureNameAr ?? null,
        isDefault: Boolean(body.isDefault),
      },
      create: {
        key,
        nameAr: body.nameAr.trim(),
        kind: body.kind,
        headlineAr: body.headlineAr.trim(),
        bodyTemplateAr: body.bodyTemplateAr.trim(),
        primaryColor: body.primaryColor || '#0F1A4A',
        accentColor: body.accentColor || '#F5B841',
        signatureNameAr: body.signatureNameAr ?? null,
        isDefault: Boolean(body.isDefault),
      },
    });
  }

  async verifyCertificateWithQr(certificateCode: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateCode },
      include: {
        template: true,
        course: { select: { slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { slug: true, titleAr: true } },
        diploma: { select: { slug: true, titleAr: true } },
        reissueLogs: { orderBy: { reissuedAt: 'desc' }, take: 5 },
      },
    });
    if (!cert) throw new NotFoundException('الشهادة غير موجودة');

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verificationUrl = `${appUrl}/certificates/${encodeURIComponent(cert.certificateCode)}`;
    const qrSvg = await QRCode.toString(verificationUrl, { type: 'svg', margin: 1, width: 180 });

    return {
      ...cert,
      isValid: !cert.revokedAt,
      verificationUrl,
      qrSvg,
      accreditationNoticeAr:
        'شهادة صادرة إلكترونياً من أكاديمية بوصلة للتدريب العملي ويمكن التحقق من صحتها عبر الرمز الفريد أو رمز QR.',
    };
  }

  async reissueCertificate(
    actor: AuthenticatedContextUser,
    certificateId: string,
    reasonAr: string,
    ipAddress?: string,
  ) {
    if (!reasonAr?.trim() || reasonAr.trim().length < 3) {
      throw new BadRequestException('سبب إعادة الإصدار مطلوب');
    }
    const cert = await this.prisma.certificate.findUnique({ where: { id: certificateId } });
    if (!cert) throw new NotFoundException('الشهادة غير موجودة');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.certificateReissueLog.create({
        data: {
          certificateId: cert.id,
          actorId: actor.id,
          reasonAr: reasonAr.trim(),
        },
      });
      return tx.certificate.update({
        where: { id: cert.id },
        data: {
          reissueCount: { increment: 1 },
          revokedAt: null,
        },
      });
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CERTIFICATE_REISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: cert.certificateCode, reasonAr: reasonAr.trim(), reissueCount: updated.reissueCount },
      ipAddress,
    });

    return updated;
  }

  async revokeCertificate(
    actor: AuthenticatedContextUser,
    certificateId: string,
    reasonAr: string,
    ipAddress?: string,
  ) {
    if (!reasonAr?.trim() || reasonAr.trim().length < 3) {
      throw new BadRequestException('سبب سحب/إلغاء الشهادة مطلوب');
    }
    const cert = await this.prisma.certificate.findUnique({ where: { id: certificateId } });
    if (!cert) throw new NotFoundException('الشهادة غير موجودة');

    const updated = await this.prisma.certificate.update({
      where: { id: cert.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'CERTIFICATE_REVOKED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: cert.certificateCode, reasonAr: reasonAr.trim() },
      ipAddress,
    });

    return updated;
  }
}
