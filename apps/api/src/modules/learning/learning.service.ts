import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as fsSync from 'node:fs';
import type { UserRole } from '@bosla/db';
import {
  competencyRequestCreateSchema,
  courseInstructorReviewSchema,
  hasAnyRole,
  isAdminRole,
  submitDiplomaProjectSchema,
  type SystemRoleCode,
} from '@bosla/shared';
import { PrismaService } from '../../core/prisma.service';
import { AuditService } from '../../core/audit.service';
import { MembershipService } from '../membership/membership.service';
import { MediaStorageService } from '../video/media-storage.service';
import { tryIssuePathAndDiplomaCertificates } from './certificate.helper';

@Injectable()
export class LearningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  async getStudentDashboard(userId: string) {
    const [progressRows, membershipSummary, certificates, quizAttempts, paths, diplomas, enrollments, diplomaSubmissions] =
      await Promise.all([
        this.prisma.lessonProgress.findMany({
          where: { userId },
          orderBy: { lastWatchedAt: 'desc' },
          include: {
            course: {
              include: {
                publishedVersion: {
                  include: {
                    sections: {
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        lessons: {
                          orderBy: { sortOrder: 'asc' },
                          select: {
                            id: true,
                            stableKey: true,
                            titleAr: true,
                            durationSeconds: true,
                            type: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.membership.getMyMembershipSummary(userId),
        this.prisma.certificate.findMany({
          where: { userId, revokedAt: null },
          orderBy: { issuedAt: 'desc' },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId },
          include: { quiz: { select: { id: true, titleAr: true, passingScorePercent: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 20,
        }),
        this.prisma.learningPath.findMany({
          where: { status: 'PUBLISHED' },
          include: {
            courses: {
              orderBy: { sortOrder: 'asc' },
              include: {
                course: {
                  include: {
                    publishedVersion: {
                      include: {
                        sections: {
                          include: { lessons: { select: { stableKey: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.diploma.findMany({
          where: { status: 'PUBLISHED' },
          include: {
            courses: {
              orderBy: { sortOrder: 'asc' },
              include: {
                course: {
                  include: {
                    publishedVersion: {
                      include: {
                        sections: {
                          include: { lessons: { select: { stableKey: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
            assessments: true,
          },
        }),
        this.prisma.courseEnrollment.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
          select: { courseId: true },
        }),
        this.prisma.diplomaProjectSubmission.findMany({
          where: { userId },
          include: {
            assessment: {
              select: {
                id: true,
                titleAr: true,
                passingScorePercent: true,
                diploma: { select: { id: true, slug: true, titleAr: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

    // Group progress by courseId globally (reused across paths and diplomas!)
    const progressByCourse = new Map<
      string,
      {
        courseId: string;
        slug: string;
        titleAr: string;
        thumbnailUrl: string | null;
        completedLessons: number;
        totalLessons: number;
        progressPercent: number;
        lastLessonStableKey: string;
        lastWatchedAt: Date;
        watchedSeconds: number;
      }
    >();

    for (const row of progressRows) {
      const version = row.course.publishedVersion;
      if (!version) continue;
      const allLessons = version.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;
      const existing = progressByCourse.get(row.courseId);
      if (!existing) {
        const courseRows = progressRows.filter((p) => p.courseId === row.courseId);
        const completedCount = courseRows.filter((p) => p.isCompleted).length;
        progressByCourse.set(row.courseId, {
          courseId: row.courseId,
          slug: row.course.slug,
          titleAr: version.titleAr,
          thumbnailUrl: version.thumbnailUrl,
          completedLessons: completedCount,
          totalLessons,
          progressPercent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
          lastLessonStableKey: row.lessonStableKey,
          lastWatchedAt: row.lastWatchedAt,
          watchedSeconds: row.watchedSeconds,
        });
      }
    }

    const completedSetByCourse = new Map<string, Set<string>>();
    for (const row of progressRows) {
      if (row.isCompleted) {
        if (!completedSetByCourse.has(row.courseId)) {
          completedSetByCourse.set(row.courseId, new Set());
        }
        completedSetByCourse.get(row.courseId)!.add(row.lessonStableKey);
      }
    }

    const pathProgress = paths.map((p) => {
      const requiredCourses = p.courses.filter((c) => c.isRequired);
      const completedCourses = requiredCourses.filter((c) => {
        const lessons =
          c.course.publishedVersion?.sections.flatMap((s) => s.lessons.map((l) => l.stableKey)) ?? [];
        if (lessons.length === 0) return false;
        const done = completedSetByCourse.get(c.courseId);
        return lessons.every((k) => done?.has(k));
      });
      return {
        id: p.id,
        slug: p.slug,
        titleAr: p.titleAr,
        totalRequiredCourses: requiredCourses.length,
        completedRequiredCourses: completedCourses.length,
        progressPercent:
          requiredCourses.length > 0
            ? Math.round((completedCourses.length / requiredCourses.length) * 100)
            : 0,
      };
    });

    const diplomaProgress = diplomas.map((d) => {
      const requiredCourses = d.courses.filter((c) => c.isRequired);
      const completedCourses = requiredCourses.filter((c) => {
        const lessons =
          c.course.publishedVersion?.sections.flatMap((s) => s.lessons.map((l) => l.stableKey)) ?? [];
        if (lessons.length === 0) return false;
        const done = completedSetByCourse.get(c.courseId);
        return lessons.every((k) => done?.has(k));
      });
      return {
        id: d.id,
        slug: d.slug,
        titleAr: d.titleAr,
        totalRequiredCourses: requiredCourses.length,
        completedRequiredCourses: completedCourses.length,
        progressPercent:
          requiredCourses.length > 0
            ? Math.round((completedCourses.length / requiredCourses.length) * 100)
            : 0,
      };
    });

    // Also load enrolled or active-membership-entitled courses even before first progress tick
    const myCourseIdSet = new Set<string>([
      ...enrollments.map((e) => e.courseId),
      ...(membershipSummary?.entitledCourseIds ?? []),
    ]);
    const myCourseIds = Array.from(myCourseIdSet);
    const catalogEnrolledCourses = myCourseIds.length
      ? await this.prisma.course.findMany({
          where: { id: { in: myCourseIds }, status: 'PUBLISHED' },
          include: {
            category: { select: { nameAr: true } },
            instructor: { select: { fullName: true } },
            publishedVersion: {
              include: {
                sections: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    lessons: {
                      orderBy: { sortOrder: 'asc' },
                      select: { stableKey: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    const enrolledCourses = catalogEnrolledCourses.map((c) => {
      const existingProgress = progressByCourse.get(c.id);
      const totalLessons =
        c.publishedVersion?.sections.reduce((acc, s) => acc + s.lessons.length, 0) ?? 0;
      const firstLessonKey = c.publishedVersion?.sections[0]?.lessons[0]?.stableKey ?? null;
      return {
        courseId: c.id,
        slug: c.slug,
        titleAr: c.publishedVersion?.titleAr || c.slug,
        thumbnailUrl: c.publishedVersion?.thumbnailUrl ?? null,
        categoryName: c.category?.nameAr ?? null,
        instructorName: c.instructor?.fullName ?? null,
        isFree: c.isFree,
        completedLessons: existingProgress?.completedLessons ?? 0,
        totalLessons,
        progressPercent: existingProgress?.progressPercent ?? 0,
        lastLessonStableKey: existingProgress?.lastLessonStableKey ?? firstLessonKey,
      };
    });

    const [eventRegistrations, competencyRequests] = await Promise.all([
      this.prisma.offlineEventRegistration.findMany({
        where: { userId },
        include: {
          event: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              thumbnailUrl: true,
              categoryLabelAr: true,
              cityAr: true,
              venueNameAr: true,
              venueAddressAr: true,
              startsAt: true,
              endsAt: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.listMyCompetencyRequests(userId),
    ]);

    return {
      continueWatching: Array.from(progressByCourse.values()).slice(0, 6),
      enrolledCourses,
      membership: membershipSummary,
      certificates,
      competencyRequests,
      quizAttempts,
      pathProgress,
      diplomaProgress,
      diplomaSubmissions,
      eventRegistrations,
    };
  }

  async getCoursePlayerData(
    slug: string,
    userId: string,
    userRole: UserRole,
    userRoles?: readonly SystemRoleCode[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
        instructorAssignments: {
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        publishedVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    videoAsset: {
                      select: {
                        id: true,
                        status: true,
                        durationSeconds: true,
                        qualities: true,
                      },
                    },
                    attachments: {
                      select: { id: true, titleAr: true, mimeType: true, sizeBytes: true },
                    },
                    quiz: {
                      include: {
                        questions: {
                          orderBy: { sortOrder: 'asc' },
                          select: {
                            id: true,
                            questionTextAr: true,
                            options: true,
                            points: true,
                            sortOrder: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('الكورس غير موجود');

    const access = await this.membership.checkCourseAccessForUser({
      userId,
      userRole,
      userRoles,
      courseId: course.id,
    });

    const [progress, enrollment, certificates, competencyRequests, myReview] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId, courseId: course.id },
      }),
      this.prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: { id: true, startedAt: true },
      }),
      this.prisma.certificate.findMany({
        where: { userId, courseId: course.id, revokedAt: null },
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.competencyCertificateRequest.findMany({
        where: { userId, courseId: course.id },
        include: { certificate: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.courseReview.findUnique({
        where: { courseId_userId: { courseId: course.id, userId } },
      }),
    ]);

    const hasStartedCourse = Boolean(enrollment) || progress.length > 0;

    const version = course.publishedVersion;
    if (!version && !isAdminRole(userRole, userRoles) && course.instructorId !== userId) {
      throw new ForbiddenException('هذا الكورس غير منشور حاليًا');
    }

    // Filter full lesson payloads if user doesn't have course entitlement (except free previews)
    const sanitizedSections = (version?.sections ?? []).map((sec) => ({
      ...sec,
      lessons: sec.lessons.map((lesson) => {
        const hasLessonAccess = access.allowed || lesson.isFreePreview;
        return {
          ...lesson,
          hasAccess: hasLessonAccess,
          articleContentAr: hasLessonAccess ? lesson.articleContentAr : null,
          quiz: hasLessonAccess ? lesson.quiz : null,
          attachments: hasLessonAccess
            ? lesson.attachments.map((att) => ({
                ...att,
                sizeBytes: Number(att.sizeBytes),
              }))
            : [],
        };
      }),
    }));

    return {
      course: {
        id: course.id,
        slug: course.slug,
        status: course.status,
        isFree: course.isFree,
        priceCents: course.priceCents,
        compareAtPriceCents: course.compareAtPriceCents,
        currency: course.currency,
        includedInMembership: course.includedInMembership,
        allowIndividualPurchase: course.allowIndividualPurchase,
        difficulty: course.difficulty,
        category: course.category,
        instructor: course.instructor,
        instructorAssignments: course.instructorAssignments,
        titleAr: version?.titleAr ?? '',
        descriptionAr: version?.descriptionAr ?? '',
        thumbnailUrl: version?.thumbnailUrl ?? null,
      },
      access,
      hasStartedCourse,
      sections: sanitizedSections,
      progress,
      certificates,
      competencyRequests,
      myReview,
    };
  }

  async ensureCourseEnrollment(userId: string, courseId: string, source = 'PLAYER') {
    return this.prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: {
        userId,
        courseId,
        source,
      },
    });
  }

  async enrollInCourse(params: {
    userId: string;
    userRole: UserRole;
    courseId: string;
    source?: string;
  }) {
    const access = await this.membership.checkCourseAccessForUser({
      userId: params.userId,
      userRole: params.userRole,
      courseId: params.courseId,
      isLessonFreePreview: false,
    });

    if (!access.allowed) {
      throw new ForbiddenException({
        code: access.reason,
        message: 'يلزم اشتراك نشط يشمل هذا الكورس قبل التسجيل فيه',
      });
    }

    const enrollment = await this.ensureCourseEnrollment(
      params.userId,
      params.courseId,
      params.source ?? 'EXPLICIT_ENROLL',
    );
    return { enrolled: true, enrollment };
  }

  async saveLessonProgress(params: {
    userId: string;
    userRole: UserRole;
    lessonId: string;
    watchedSeconds: number;
    durationSeconds: number;
    isCompleted?: boolean;
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        section: { include: { courseVersion: { include: { course: true } } } },
      },
    });
    if (!lesson) throw new NotFoundException('الدرس غير موجود');

    const course = lesson.section.courseVersion.course;
    const access = await this.membership.checkCourseAccessForUser({
      userId: params.userId,
      userRole: params.userRole,
      courseId: course.id,
      isLessonFreePreview: lesson.isFreePreview,
    });

    if (!access.allowed) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذا الدرس');
    }

    const duration = Math.max(params.durationSeconds, lesson.durationSeconds, 1);
    const clampedWatched = Math.min(params.watchedSeconds, duration);
    const pct = Math.min(100, Math.round((clampedWatched / duration) * 100));
    const completed = Boolean(params.isCompleted) || pct >= 90;

    const record = await this.prisma.lessonProgress.upsert({
      where: {
        userId_courseId_lessonStableKey: {
          userId: params.userId,
          courseId: course.id,
          lessonStableKey: lesson.stableKey,
        },
      },
      update: {
        watchedSeconds: clampedWatched,
        durationSeconds: duration,
        progressPercent: completed ? 100 : pct,
        isCompleted: completed ? true : undefined,
        completedAt: completed ? new Date() : undefined,
        lastWatchedAt: new Date(),
      },
      create: {
        userId: params.userId,
        courseId: course.id,
        lessonStableKey: lesson.stableKey,
        watchedSeconds: clampedWatched,
        durationSeconds: duration,
        progressPercent: completed ? 100 : pct,
        isCompleted: completed,
        completedAt: completed ? new Date() : null,
        lastWatchedAt: new Date(),
      },
    });

    await this.ensureCourseEnrollment(params.userId, course.id, 'LESSON_PROGRESS');

    // Auto-check course, path & diploma certificate eligibility upon completion
    let issuedCertificate = null;
    if (completed) {
      issuedCertificate = await this.tryIssueCourseCertificate(params.userId, course.id);
      await tryIssuePathAndDiplomaCertificates({
        prisma: this.prisma,
        audit: this.audit,
        userId: params.userId,
      });
    }

    return { progress: record, issuedCertificate };
  }

  async submitQuizAttempt(params: {
    userId: string;
    userRole: UserRole;
    quizId: string;
    answers: Record<string, string>;
  }) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: params.quizId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        lessons: {
          include: {
            section: { include: { courseVersion: { include: { course: true } } } },
          },
        },
      },
    });
    if (!quiz) throw new NotFoundException('الاختبار غير موجود');

    // Enforce entitlement on linked lesson's course
    const linkedLesson = quiz.lessons[0];
    if (linkedLesson) {
      const course = linkedLesson.section.courseVersion.course;
      const access = await this.membership.checkCourseAccessForUser({
        userId: params.userId,
        userRole: params.userRole,
        courseId: course.id,
        isLessonFreePreview: linkedLesson.isFreePreview,
      });
      if (!access.allowed) {
        throw new ForbiddenException('لا تملك صلاحية أداء هذا الاختبار');
      }
    }

    if (quiz.maxAttempts) {
      const count = await this.prisma.quizAttempt.count({
        where: { quizId: quiz.id, userId: params.userId },
      });
      if (count >= quiz.maxAttempts) {
        throw new BadRequestException('تم الوصول إلى الحد الأقصى لمحاولات هذا الاختبار');
      }
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    const questionFeedback = quiz.questions.map((q) => {
      totalPoints += q.points;
      const chosen = params.answers[q.id];
      const isCorrect = chosen === q.correctOptionId;
      if (isCorrect) earnedPoints += q.points;
      return {
        questionId: q.id,
        chosenOptionId: chosen ?? null,
        correctOptionId: q.correctOptionId,
        isCorrect,
        explanationAr: q.explanationAr,
      };
    });

    const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = scorePercent >= quiz.passingScorePercent;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: params.userId,
        answers: params.answers,
        scorePercent,
        passed,
        submittedAt: new Date(),
      },
    });

    let issuedCertificate: any = null;
    if (passed && linkedLesson) {
      const progressRes = await this.saveLessonProgress({
        userId: params.userId,
        userRole: params.userRole,
        lessonId: linkedLesson.id,
        watchedSeconds: linkedLesson.durationSeconds || 60,
        durationSeconds: linkedLesson.durationSeconds || 60,
        isCompleted: true,
      });
      issuedCertificate = progressRes.issuedCertificate ?? null;
    }

    return {
      attempt,
      scorePercent,
      passed,
      passingScorePercent: quiz.passingScorePercent,
      feedback: questionFeedback,
      issuedCertificate,
    };
  }

  async tryIssueCourseCertificate(userId: string, courseId: string) {
    const existing = await this.prisma.certificate.findFirst({
      where: {
        userId,
        targetType: 'COURSE',
        courseId,
        kind: 'ATTENDANCE_COMPLETION',
        revokedAt: null,
      },
    });
    if (existing) return existing;

    const [course, user, progress] = await Promise.all([
      this.prisma.course.findUnique({
        where: { id: courseId },
        include: {
          publishedVersion: {
            include: {
              sections: { include: { lessons: true } },
            },
          },
        },
      }),
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.lessonProgress.findMany({ where: { userId, courseId, isCompleted: true } }),
    ]);

    if (!course?.publishedVersion || !user) return null;
    const lessons = course.publishedVersion.sections.flatMap((s) => s.lessons);
    if (lessons.length === 0) return null;

    const completedSet = new Set(progress.map((p) => p.lessonStableKey));
    const allCompleted = lessons.every((l) => completedSet.has(l.stableKey));
    if (!allCompleted) return null;

    const code = `BOSLA-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cert = await this.prisma.certificate.create({
      data: {
        userId,
        certificateCode: code,
        kind: 'ATTENDANCE_COMPLETION',
        targetType: 'COURSE',
        courseId,
        recipientNameAr: user.fullName,
        titleAr: `شهادة إتمام الدورة (شهادة حضور): ${course.publishedVersion.titleAr}`,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: {
        certificateCode: code,
        kind: 'ATTENDANCE_COMPLETION',
        targetType: 'COURSE',
        courseId,
      },
    });

    return cert;
  }

  async getMyDiplomaStatus(
    slug: string,
    userId: string,
    userRole: UserRole,
    userRoles?: readonly SystemRoleCode[],
  ) {
    const diploma = await this.prisma.diploma.findUnique({
      where: { slug },
      include: {
        courses: {
          include: {
            course: {
              select: {
                id: true,
                isFree: true,
                publishedVersion: {
                  include: {
                    sections: { include: { lessons: { select: { stableKey: true } } } },
                  },
                },
              },
            },
          },
        },
        assessments: {
          include: {
            submissions: {
              where: { userId },
            },
          },
        },
      },
    });
    if (!diploma) throw new NotFoundException('الدبلومة غير موجودة');

    const [membershipSummary, completedRows, certificate] = await Promise.all([
      this.membership.getMyMembershipSummary(userId),
      this.prisma.lessonProgress.findMany({
        where: { userId, isCompleted: true },
        select: { courseId: true, lessonStableKey: true },
      }),
      this.prisma.certificate.findFirst({
        where: { userId, targetType: 'DIPLOMA', diplomaId: diploma.id, revokedAt: null },
      }),
    ]);

    const completedSetByCourse = new Map<string, Set<string>>();
    for (const row of completedRows) {
      if (!completedSetByCourse.has(row.courseId)) {
        completedSetByCourse.set(row.courseId, new Set());
      }
      completedSetByCourse.get(row.courseId)!.add(row.lessonStableKey);
    }

    const requiredCourses = diploma.courses.filter((c) => c.isRequired);
    const completedCoursesCount = requiredCourses.filter((c) => {
      const keys =
        c.course.publishedVersion?.sections.flatMap((s) => s.lessons.map((l) => l.stableKey)) ?? [];
      if (keys.length === 0) return false;
      const done = completedSetByCourse.get(c.courseId);
      return Boolean(done && keys.every((k) => done.has(k)));
    }).length;

    const allCoursesFree =
      diploma.courses.length > 0 && diploma.courses.every((c) => c.course.isFree);
    const hasEntitlement =
      isAdminRole(userRole, userRoles) ||
      hasAnyRole(['INSTRUCTOR'], userRole, userRoles) ||
      allCoursesFree ||
      membershipSummary.entitledDiplomaIds.includes(diploma.id) ||
      (diploma.courses.length > 0 &&
        diploma.courses.every((c) => c.course.isFree || membershipSummary.entitledCourseIds.includes(c.courseId)));

    const submissions = diploma.assessments.flatMap((a) =>
      a.submissions.map((s) => ({
        ...s,
        assessmentTitleAr: a.titleAr,
        passingScorePercent: a.passingScorePercent,
      })),
    );

    return {
      diplomaId: diploma.id,
      hasEntitlement,
      completedRequiredCourses: completedCoursesCount,
      totalRequiredCourses: requiredCourses.length,
      submissions,
      certificate,
    };
  }

  async submitDiplomaProject(
    userId: string,
    userRole: UserRole,
    assessmentId: string,
    rawSubmissionText: string,
    userRoles?: readonly SystemRoleCode[],
  ) {
    const parsed = submitDiplomaProjectSchema.parse({ submissionText: rawSubmissionText });
    const assessment = await this.prisma.diplomaAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        diploma: {
          include: {
            courses: {
              include: { course: { select: { id: true, isFree: true } } },
            },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('التقييم غير موجود');

    if (!isAdminRole(userRole, userRoles) && !hasAnyRole(['INSTRUCTOR'], userRole, userRoles)) {
      const membershipSummary = await this.membership.getMyMembershipSummary(userId);
      const courses = assessment.diploma.courses;
      const allFree = courses.length > 0 && courses.every((c) => c.course.isFree);
      const covered =
        allFree ||
        membershipSummary.entitledDiplomaIds.includes(assessment.diplomaId) ||
        (courses.length > 0 &&
          courses.every((c) => c.course.isFree || membershipSummary.entitledCourseIds.includes(c.courseId)));
      if (!covered) {
        throw new ForbiddenException('يلزم وجود عضوية سارية تشمل هذه الدبلومة لتسليم المشروع التطبيقي');
      }
    }

    return this.prisma.diplomaProjectSubmission.upsert({
      where: {
        diplomaAssessmentId_userId: { diplomaAssessmentId: assessmentId, userId },
      },
      update: {
        submissionText: parsed.submissionText,
        scorePercent: null,
        passed: null,
        feedbackAr: null,
        reviewedById: null,
        reviewedAt: null,
      },
      create: {
        diplomaAssessmentId: assessmentId,
        userId,
        submissionText: parsed.submissionText,
      },
    });
  }

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId, revokedAt: null },
      include: {
        course: { select: { slug: true } },
        learningPath: { select: { slug: true, titleAr: true } },
        diploma: { select: { slug: true, titleAr: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async verifyCertificateByCode(code: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateCode: code },
      include: {
        course: { select: { slug: true, publishedVersion: { select: { titleAr: true } } } },
        learningPath: { select: { slug: true, titleAr: true } },
        diploma: { select: { slug: true, titleAr: true } },
      },
    });
    if (!cert || cert.revokedAt) {
      throw new NotFoundException('الشهادة غير صالحة أو ملغاة');
    }
    return cert;
  }

  async resolveAttachmentDownload(params: {
    attachmentId: string;
    userId: string;
    userRole: UserRole;
    userRoles?: readonly SystemRoleCode[];
  }) {
    const attachment = await this.prisma.lessonAttachment.findUnique({
      where: { id: params.attachmentId },
      include: {
        lesson: {
          include: {
            section: {
              include: {
                courseVersion: {
                  include: { course: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('المرفق غير موجود');
    }

    const course = attachment.lesson.section.courseVersion.course;
    const isOwnerOrAdmin =
      isAdminRole(params.userRole, params.userRoles) ||
      (hasAnyRole(['INSTRUCTOR'], params.userRole, params.userRoles) &&
        course.instructorId === params.userId);

    if (!isOwnerOrAdmin) {
      const access = await this.membership.checkCourseAccessForUser({
        userId: params.userId,
        userRole: params.userRole,
        userRoles: params.userRoles,
        courseId: course.id,
        isLessonFreePreview: attachment.lesson.isFreePreview,
      });
      if (!access.allowed) {
        throw new ForbiddenException('يجب أن تكون عضويتك سارية للوصول إلى مرفقات هذا الدرس');
      }
    }

    const normalizedKey = attachment.storageKey.replace(/^attachments\//, '');
    const filePath = this.storage.resolveSafeSubpath(
      this.storage.attachmentsDir,
      normalizedKey,
    );
    if (!fsSync.existsSync(filePath)) {
      throw new NotFoundException('ملف المرفق غير موجود على الخادم');
    }

    return {
      attachment,
      normalizedKey,
      filePath,
    };
  }

  async listMyCompetencyRequests(userId: string) {
    return this.prisma.competencyCertificateRequest.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
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

  async requestCompetencyCertificate(userId: string, rawInput: unknown) {
    const parsed = competencyRequestCreateSchema.parse(rawInput);

    if (parsed.targetType === 'COURSE') {
      if (!parsed.courseId) {
        throw new BadRequestException('معرف الكورس مطلوب لطلب شهادة الكفاءة');
      }
      const course = await this.prisma.course.findUnique({
        where: { id: parsed.courseId },
        include: {
          publishedVersion: {
            include: { sections: { include: { lessons: true } } },
          },
          instructorAssignments: { select: { instructorId: true } },
        },
      });
      if (!course || !course.publishedVersion) {
        throw new NotFoundException('الكورس غير موجود أو غير منشور');
      }

      // Verify 100% completion of the course
      const lessons = course.publishedVersion.sections.flatMap((s) => s.lessons);
      const completedRows = await this.prisma.lessonProgress.findMany({
        where: { userId, courseId: course.id, isCompleted: true },
        select: { lessonStableKey: true },
      });
      const completedSet = new Set(completedRows.map((r) => r.lessonStableKey));
      if (lessons.length === 0 || !lessons.every((l) => completedSet.has(l.stableKey))) {
        throw new BadRequestException(
          'يجب إتمام الكورس بنسبة 100% والحصول على شهادة الحضور قبل طلب شهادة الكفاءة المهنية',
        );
      }

      // Ensure attendance certificate is issued
      await this.tryIssueCourseCertificate(userId, course.id);

      const existing = await this.prisma.competencyCertificateRequest.findFirst({
        where: {
          userId,
          targetType: 'COURSE',
          courseId: course.id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (existing) {
        return existing;
      }

      const student = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      const created = await this.prisma.competencyCertificateRequest.create({
        data: {
          userId,
          targetType: 'COURSE',
          courseId: course.id,
          status: 'PENDING',
          studentNotesAr: parsed.studentNotesAr ?? null,
          evidenceUrl: parsed.evidenceUrl ?? null,
        },
      });

      // Notify Admin(s) AND all Assigned Instructor(s) for this course
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      const recipientIds = new Set<string>([
        course.instructorId,
        ...course.instructorAssignments.map((a) => a.instructorId),
        ...admins.map((a) => a.id),
      ]);

      for (const recipientId of recipientIds) {
        await this.prisma.notification
          .create({
            data: {
              userId: recipientId,
              type: 'COMPETENCY_CERTIFICATE_REQUESTED',
              titleAr: 'طلب شهادة كفاءة مهنية جديد',
              bodyAr: `طلب المتدرب ${student?.fullName || ''} شهادة الكفاءة المهنية لدورة "${course.publishedVersion.titleAr}" بعد إتمامها 100%.`,
              actionUrl: recipientId === course.instructorId ? '/instructor' : '/admin',
              dedupKey: `comp_req_${created.id}_${recipientId}`,
              courseId: course.id,
            },
          })
          .catch(() => {});
      }

      await this.audit.log({
        actorId: userId,
        action: 'COMPETENCY_CERTIFICATE_REQUESTED',
        entityType: 'CompetencyCertificateRequest',
        entityId: created.id,
        metadata: { targetType: 'COURSE', courseId: course.id },
      });

      return created;
    }

    // LEARNING_PATH or DIPLOMA competency request
    const created = await this.prisma.competencyCertificateRequest.create({
      data: {
        userId,
        targetType: parsed.targetType,
        learningPathId: parsed.learningPathId ?? null,
        diplomaId: parsed.diplomaId ?? null,
        status: 'PENDING',
        studentNotesAr: parsed.studentNotesAr ?? null,
        evidenceUrl: parsed.evidenceUrl ?? null,
      },
    });

    // Notify Admin(s) AND Assigned Instructor(s) for this Learning Path / Diploma
    const [admins, programAssignments] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.programInstructorAssignment.findMany({
        where: parsed.learningPathId
          ? { learningPathId: parsed.learningPathId }
          : parsed.diplomaId
            ? { diplomaId: parsed.diplomaId }
            : { id: '__none__' },
        select: { instructorId: true },
      }),
    ]);

    const programRecipients = new Set<string>([
      ...admins.map((a) => a.id),
      ...programAssignments.map((p) => p.instructorId),
    ]);
    for (const recipientId of programRecipients) {
      const isAdminRec = admins.some((a) => a.id === recipientId);
      await this.prisma.notification
        .create({
          data: {
            userId: recipientId,
            type: 'COMPETENCY_CERTIFICATE_REQUESTED',
            titleAr: 'طلب شهادة كفاءة مهنية جديد لبرنامج تدريبي',
            bodyAr: 'تقدم أحد المتدربين بطلب للحصول على شهادة الكفاءة المهنية لبرنامج تدريبي.',
            actionUrl: isAdminRec ? '/admin' : '/instructor',
            dedupKey: `comp_req_prog_${created.id}_${recipientId}`,
          },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: userId,
      action: 'COMPETENCY_CERTIFICATE_REQUESTED',
      entityType: 'CompetencyCertificateRequest',
      entityId: created.id,
      metadata: {
        targetType: parsed.targetType,
        learningPathId: parsed.learningPathId,
        diplomaId: parsed.diplomaId,
      },
    });

    return created;
  }

  /**
   * Rule 6: Every review is linked to both the Instructor and the Program/Course.
   */
  async submitProgramInstructorReview(userId: string, rawInput: unknown) {
    const parsed = courseInstructorReviewSchema.parse(rawInput);

    const course = await this.prisma.course.findUnique({
      where: { id: parsed.courseId },
      select: { id: true, instructorId: true },
    });
    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }

    const targetInstructorId = parsed.instructorId || course.instructorId;
    const targetInstructorRating = parsed.instructorRating ?? parsed.rating;

    const saved = await this.prisma.courseReview.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId,
        },
      },
      update: {
        instructorId: targetInstructorId,
        learningPathId: parsed.learningPathId ?? null,
        diplomaId: parsed.diplomaId ?? null,
        rating: parsed.rating,
        instructorRating: targetInstructorRating,
        commentAr: parsed.commentAr ?? null,
        isPublished: true,
      },
      create: {
        courseId: course.id,
        instructorId: targetInstructorId,
        learningPathId: parsed.learningPathId ?? null,
        diplomaId: parsed.diplomaId ?? null,
        userId,
        rating: parsed.rating,
        instructorRating: targetInstructorRating,
        commentAr: parsed.commentAr ?? null,
        isPublished: true,
      },
      include: {
        instructor: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'PROGRAM_INSTRUCTOR_REVIEW_SUBMITTED',
      entityType: 'CourseReview',
      entityId: saved.id,
      metadata: {
        courseId: course.id,
        instructorId: targetInstructorId,
        rating: parsed.rating,
        instructorRating: targetInstructorRating,
      },
    });

    return saved;
  }
}
