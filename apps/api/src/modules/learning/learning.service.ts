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
import { PrismaService } from '../../core/prisma.service';
import { AuditService } from '../../core/audit.service';
import { MembershipService } from '../membership/membership.service';
import { MediaStorageService } from '../video/media-storage.service';

@Injectable()
export class LearningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  async getStudentDashboard(userId: string) {
    const [progressRows, membershipSummary, certificates, quizAttempts, paths, diplomas] =
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

    return {
      continueWatching: Array.from(progressByCourse.values()).slice(0, 6),
      membership: membershipSummary,
      certificates,
      quizAttempts,
      pathProgress,
      diplomaProgress,
    };
  }

  async getCoursePlayerData(slug: string, userId: string, userRole: UserRole) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
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
      courseId: course.id,
    });

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId: course.id },
    });

    const version = course.publishedVersion;
    if (!version && userRole !== 'ADMIN' && course.instructorId !== userId) {
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
        difficulty: course.difficulty,
        category: course.category,
        instructor: course.instructor,
        titleAr: version?.titleAr ?? '',
        descriptionAr: version?.descriptionAr ?? '',
        thumbnailUrl: version?.thumbnailUrl ?? null,
      },
      access,
      sections: sanitizedSections,
      progress,
    };
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

    // Auto-check course certificate eligibility upon completion
    let issuedCertificate = null;
    if (completed) {
      issuedCertificate = await this.tryIssueCourseCertificate(params.userId, course.id);
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
      where: { userId, targetType: 'COURSE', courseId, revokedAt: null },
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
        targetType: 'COURSE',
        courseId,
        recipientNameAr: user.fullName,
        titleAr: `شهادة إتمام كورس: ${course.publishedVersion.titleAr}`,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: code, targetType: 'COURSE', courseId },
    });

    return cert;
  }

  async submitDiplomaProject(
    userId: string,
    assessmentId: string,
    submissionText: string,
  ) {
    const assessment = await this.prisma.diplomaAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) throw new NotFoundException('التقييم غير موجود');

    return this.prisma.diplomaProjectSubmission.upsert({
      where: {
        diplomaAssessmentId_userId: { diplomaAssessmentId: assessmentId, userId },
      },
      update: { submissionText },
      create: {
        diplomaAssessmentId: assessmentId,
        userId,
        submissionText,
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
      params.userRole === 'ADMIN' ||
      (params.userRole === 'INSTRUCTOR' && course.instructorId === params.userId);

    if (!isOwnerOrAdmin) {
      const access = await this.membership.checkCourseAccessForUser({
        userId: params.userId,
        userRole: params.userRole,
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
}
