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
  hasAnyRole,
  instructorContractSchema,
  instructorProfileUpdateSchema,
  isAdminRole,
  markAttendanceSchema,
  questionBankItemSchema,
  trainingSessionSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class LmsAdvancedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MembershipService) private readonly membership: MembershipService,
  ) {}

  private async resolveLmsVisibilityScope(user?: AuthenticatedContextUser) {
    if (!user) {
      return {
        unrestricted: false as const,
        allowedCourseIds: [] as string[],
        allowedCohortIds: new Set<string>(),
      };
    }
    const isStaff =
      isAdminRole(user.role, user.roles) ||
      user.permissions.includes('training.coordinate') ||
      hasAnyRole(['ACADEMY_MANAGER', 'TRAINING_COORDINATOR'], user.role, user.roles);
    if (isStaff) {
      return {
        unrestricted: true as const,
        allowedCourseIds: [] as string[],
        allowedCohortIds: new Set<string>(),
      };
    }

    const isInstructor = hasAnyRole(['INSTRUCTOR'], user.role, user.roles);
    const [summary, cohortEnrollments, freePublishedCourses, taughtCourses] = await Promise.all([
      this.membership.getMyMembershipSummary(user.id),
      this.prisma.cohortEnrollment.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { cohortId: true, cohort: { select: { courseId: true } } },
      }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED', isFree: true },
        select: { id: true },
      }),
      isInstructor
        ? this.prisma.course.findMany({
            where: {
              OR: [
                { instructorId: user.id },
                { instructorAssignments: { some: { instructorId: user.id } } },
              ],
            },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const allowedCourseIds = new Set<string>([
      ...summary.entitledCourseIds,
      ...freePublishedCourses.map((c) => c.id),
    ]);
    const allowedCohortIds = new Set<string>();
    for (const ce of cohortEnrollments) {
      allowedCohortIds.add(ce.cohortId);
      allowedCourseIds.add(ce.cohort.courseId);
    }
    for (const tc of taughtCourses) {
      allowedCourseIds.add(tc.id);
    }

    return {
      unrestricted: false as const,
      allowedCourseIds: Array.from(allowedCourseIds),
      allowedCohortIds,
    };
  }

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

  async listSessions(courseId?: string, user?: AuthenticatedContextUser) {
    const scope = await this.resolveLmsVisibilityScope(user);
    if (!scope.unrestricted) {
      const targetIds = courseId
        ? scope.allowedCourseIds.filter((id) => id === courseId)
        : scope.allowedCourseIds;
      if (targetIds.length === 0) return [];
      const sessions = await this.prisma.trainingSession.findMany({
        where: { courseId: { in: targetIds } },
        orderBy: { startsAt: 'asc' },
        include: {
          course: { select: { id: true, slug: true, deliveryMode: true, publishedVersion: { select: { titleAr: true } } } },
          instructor: { select: { id: true, fullName: true } },
          cohort: { select: { id: true, titleAr: true } },
          _count: { select: { attendance: true } },
        },
      });
      return sessions.filter((s) => !s.cohortId || scope.allowedCohortIds.has(s.cohortId));
    }

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

  async listAssignments(courseId?: string, user?: AuthenticatedContextUser) {
    const scope = await this.resolveLmsVisibilityScope(user);
    if (!scope.unrestricted) {
      const targetIds = courseId
        ? scope.allowedCourseIds.filter((id) => id === courseId)
        : scope.allowedCourseIds;
      if (targetIds.length === 0) return [];
      return this.prisma.assignment.findMany({
        where: { courseId: { in: targetIds } },
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
          _count: { select: { submissions: true } },
        },
      });
    }

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

    if (!isAdminRole(user.role, user.roles)) {
      const [access, activeCohort] = await Promise.all([
        this.membership.checkCourseAccessForUser({
          userId: user.id,
          userRole: user.role,
          userRoles: user.roles,
          courseId: assignment.courseId,
        }),
        this.prisma.cohortEnrollment.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            cohort: { courseId: assignment.courseId },
          },
          select: { id: true },
        }),
      ]);
      if (!access.allowed && !activeCohort) {
        throw new ForbiddenException('يجب الاشتراك أو التسجيل في الكورس لتسليم الواجب');
      }
    }

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
    kind: 'ATTENDANCE_COMPLETION' | 'COMPETENCY' | 'ACCREDITED_PROGRAM';
    headlineAr: string;
    bodyTemplateAr: string;
    primaryColor?: string;
    accentColor?: string;
    signatureNameAr?: string;
    accreditationEnabled?: boolean;
    accreditingBodyNameAr?: string | null;
    accreditingBodyCode?: string | null;
    authorizationRef?: string | null;
    issuerNameAr?: string | null;
    isDefault?: boolean;
  }) {
    const rawKey =
      body?.key?.trim() || `tpl-${String(body?.kind || 'cert').toLowerCase()}-default`;
    const key = rawKey.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const headlineAr = (body?.headlineAr || body?.nameAr || '').trim();
    if (!key || !body?.nameAr?.trim() || !headlineAr) {
      throw new BadRequestException('بيانات قالب الشهادة غير مكتملة');
    }
    if (
      !['ATTENDANCE_COMPLETION', 'COMPETENCY', 'ACCREDITED_PROGRAM'].includes(body.kind)
    ) {
      throw new BadRequestException('نوع قالب الشهادة غير صالح');
    }

    const bodyName = body.accreditingBodyNameAr?.trim() || null;
    const bodyCode = body.accreditingBodyCode?.trim() || null;
    const authRef = body.authorizationRef?.trim() || null;
    const issuerName = body.issuerNameAr?.trim() || null;
    const accreditationEnabled = Boolean(body.accreditationEnabled);

    if (body.kind === 'ACCREDITED_PROGRAM' && accreditationEnabled) {
      if (!bodyName || bodyName.length < 3 || !authRef || authRef.length < 2) {
        throw new BadRequestException(
          'لا يمكن تفعيل قالب شهادة برنامج معتمد دون إدخال اسم الجهة المانحة ورقم التفويض الرسمي الحقيقي',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.certificateTemplate.updateMany({
          where: { kind: body.kind },
          data: { isDefault: false },
        });
      }
      return tx.certificateTemplate.upsert({
        where: { key },
        update: {
          nameAr: body.nameAr.trim(),
          kind: body.kind,
          headlineAr: body.headlineAr.trim(),
          bodyTemplateAr: body.bodyTemplateAr.trim(),
          primaryColor: body.primaryColor || '#0F1A4A',
          accentColor: body.accentColor || '#6B21A8',
          signatureNameAr: body.signatureNameAr ?? null,
          accreditationEnabled,
          accreditingBodyNameAr: bodyName,
          accreditingBodyCode: bodyCode,
          authorizationRef: authRef,
          issuerNameAr: issuerName,
          isDefault: Boolean(body.isDefault),
        },
        create: {
          key,
          nameAr: body.nameAr.trim(),
          kind: body.kind,
          headlineAr: body.headlineAr.trim(),
          bodyTemplateAr: body.bodyTemplateAr.trim(),
          primaryColor: body.primaryColor || '#0F1A4A',
          accentColor: body.accentColor || '#6B21A8',
          signatureNameAr: body.signatureNameAr ?? null,
          accreditationEnabled,
          accreditingBodyNameAr: bodyName,
          accreditingBodyCode: bodyCode,
          authorizationRef: authRef,
          issuerNameAr: issuerName,
          isDefault: Boolean(body.isDefault),
        },
      });
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
    const isValid = !cert.revokedAt;
    const qrSvg = isValid
      ? await QRCode.toString(verificationUrl, { type: 'svg', margin: 1, width: 180 })
      : null;

    const kindLabelAr =
      cert.kind === 'ACCREDITED_PROGRAM'
        ? 'شهادة برنامج تدريبي معتمد'
        : cert.kind === 'COMPETENCY'
          ? 'شهادة التدريب المهني والكفاءة التطبيقية'
          : 'شهادة إتمام الدورة (شهادة حضور)';

    const accreditationNoticeAr =
      cert.kind === 'ACCREDITED_PROGRAM' && cert.accreditingBodyNameAr
        ? `برنامج معتمد بالتعاون مع ${cert.accreditingBodyNameAr}${
            cert.authorizationRef ? ` — مرجع التفويض: ${cert.authorizationRef}` : ''
          }`
        : 'شهادة صادرة إلكترونياً من أكاديمية بوصلة للتدريب العملي ويمكن التحقق من صحتها عبر الرمز الفريد أو رمز QR.';

    const { userId: _omitUserId, ...publicSafeCert } = cert;
    void _omitUserId;

    return {
      ...publicSafeCert,
      kindLabelAr,
      isValid,
      status: isValid ? 'VALID' : 'REVOKED',
      verificationUrl,
      qrSvg,
      accreditationNoticeAr,
      downloadSvgUrl: isValid
        ? `/api/v1/lms/certificates/${encodeURIComponent(cert.certificateCode)}/download.svg`
        : null,
    };
  }

  async renderCertificateSvg(certificateCode: string): Promise<string> {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateCode },
      include: {
        template: true,
        course: { select: { publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { titleAr: true } },
        diploma: { select: { titleAr: true } },
      },
    });
    if (!cert) {
      throw new NotFoundException('الشهادة غير موجودة');
    }
    if (cert.revokedAt) {
      const { GoneException } = await import('@nestjs/common');
      throw new GoneException('تم إلغاء هذه الشهادة ولا يمكن تنزيل نسختها الرسمية');
    }

    const esc = (s: string) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const kindHeadline =
      cert.template?.headlineAr ||
      (cert.kind === 'ACCREDITED_PROGRAM'
        ? 'شهادة برنامج تدريبي معتمد'
        : cert.kind === 'COMPETENCY'
          ? 'شهادة التدريب المهني والكفاءة التطبيقية'
          : 'شهادة إتمام وحضور دورة تدريبية');

    const programTitle =
      cert.course?.publishedVersion?.titleAr ||
      cert.learningPath?.titleAr ||
      cert.diploma?.titleAr ||
      cert.titleAr;

    const issueDateStr = cert.issuedAt.toISOString().slice(0, 10);
    const accent = cert.template?.accentColor || '#6B21A8';
    const issuer = cert.template?.issuerNameAr || 'أكاديمية بوصلة للتدريب البيطري والزراعي';
    const sigName = cert.template?.signatureNameAr || 'الإدارة الأكاديمية — بوصلة';

    const accreditationBlock =
      cert.kind === 'ACCREDITED_PROGRAM' && cert.accreditingBodyNameAr
        ? `<text x="560" y="545" text-anchor="middle" fill="#C084FC" font-size="18" font-weight="700">الجهة المانحة للاعتماد: ${esc(cert.accreditingBodyNameAr)}${
            cert.accreditingBodyCode ? ` (${esc(cert.accreditingBodyCode)})` : ''
          } • مرجع التفويض: ${esc(cert.authorizationRef || '')}</text>`
        : '';

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="790" viewBox="0 0 1120 790" direction="rtl">',
      '  <rect width="1120" height="790" fill="#070D2B" />',
      `  <rect x="28" y="28" width="1064" height="734" rx="20" fill="#0B1440" stroke="${esc(accent)}" stroke-width="3" />`,
      '  <rect x="44" y="44" width="1032" height="702" rx="14" fill="none" stroke="#8CA2FF" stroke-opacity="0.35" stroke-width="1.5" />',
      `  <text x="560" y="130" text-anchor="middle" fill="#8CA2FF" font-size="20" font-weight="700">${esc(issuer)}</text>`,
      `  <text x="560" y="195" text-anchor="middle" fill="#EEF0FF" font-size="38" font-weight="800">${esc(kindHeadline)}</text>`,
      '  <text x="560" y="265" text-anchor="middle" fill="#A9B1E0" font-size="20">تشهد الأكاديمية بأن المتدرب / المتدربة</text>',
      `  <text x="560" y="340" text-anchor="middle" fill="#FFFFFF" font-size="42" font-weight="800">${esc(cert.recipientNameAr)}</text>`,
      '  <text x="560" y="410" text-anchor="middle" fill="#A9B1E0" font-size="20">قد أتم بنجاح متطلبات:</text>',
      `  <text x="560" y="475" text-anchor="middle" fill="#C084FC" font-size="28" font-weight="700">${esc(programTitle)}</text>`,
      accreditationBlock ? `  ${accreditationBlock}` : '',
      `  <text x="880" y="660" text-anchor="middle" fill="#EEF0FF" font-size="16" font-weight="700">${esc(sigName)}</text>`,
      `  <text x="560" y="660" text-anchor="middle" fill="#A9B1E0" font-size="15">تاريخ الإصدار: ${esc(issueDateStr)}</text>`,
      `  <text x="240" y="660" text-anchor="middle" fill="#8CA2FF" font-family="monospace" font-size="16" font-weight="700">${esc(cert.certificateCode)}</text>`,
      '</svg>',
    ]
      .filter(Boolean)
      .join('\n');
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
