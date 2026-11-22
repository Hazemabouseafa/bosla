import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@bosla/db';
import {
  competencyRequestReviewSchema,
  createCourseSchema,
  createQuizSchema,
  isAdminRole,
  updateCourseVersionSchema,
  type SystemRoleCode,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { MediaStorageService } from '../video/media-storage.service';

@Injectable()
export class InstructorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  async getDashboard(
    instructorId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const isAdmin = isAdminRole(userRole, userRoles);
    const courseWhere = isAdmin
      ? {}
      : {
          OR: [
            { instructorId },
            { instructorAssignments: { some: { instructorId } } },
          ],
        };
    const [courses, videoAssets, recentFeedback, reviewsAgg, financialStatement, competencyRequests, reviews] =
      await Promise.all([
        this.prisma.course.findMany({
          where: courseWhere,
          include: {
            instructor: { select: { id: true, fullName: true } },
            instructorAssignments: {
              include: {
                instructor: { select: { id: true, fullName: true } },
              },
            },
            draftVersion: {
              select: {
                id: true,
                versionNumber: true,
                status: true,
                titleAr: true,
                reviewNotes: true,
                updatedAt: true,
              },
            },
            publishedVersion: {
              select: {
                id: true,
                versionNumber: true,
                status: true,
                publishedAt: true,
              },
            },
            _count: {
              select: {
                lessonProgress: true,
                reviews: true,
                certificates: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.videoAsset.findMany({
          where: isAdmin ? {} : { instructorId },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        this.prisma.editorialReviewLog.findMany({
          where: isAdmin ? {} : { course: { instructorId } },
          include: {
            course: { select: { id: true, slug: true } },
            actor: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        this.prisma.courseReview.aggregate({
          where: isAdmin
            ? { isPublished: true }
            : {
                isPublished: true,
                OR: [{ instructorId }, { course: { instructorId } }],
              },
          _avg: { rating: true, instructorRating: true },
          _count: { id: true },
        }),
        this.getFinancialStatement(instructorId),
        this.listCompetencyRequests(instructorId, userRole),
        this.prisma.courseReview.findMany({
          where: isAdmin
            ? { isPublished: true }
            : {
                isPublished: true,
                OR: [{ instructorId }, { course: { instructorId } }],
              },
          include: {
            user: { select: { id: true, fullName: true } },
            instructor: { select: { id: true, fullName: true } },
            course: {
              select: {
                id: true,
                slug: true,
                publishedVersion: { select: { titleAr: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    const distinctLearners = await this.prisma.lessonProgress.findMany({
      where: isAdmin ? {} : { course: courseWhere },
      distinct: ['userId'],
      select: { userId: true },
    });

    const statusCounts = courses.reduce<Record<string, number>>((acc, course) => {
      const effectiveStatus = course.draftVersion?.status ?? course.status;
      acc[effectiveStatus] = (acc[effectiveStatus] ?? 0) + 1;
      return acc;
    }, {});

    return {
      stats: {
        totalCourses: courses.length,
        publishedCourses: courses.filter((c) => c.status === 'PUBLISHED').length,
        totalVideos: videoAssets.length,
        readyVideos: videoAssets.filter((v) => v.status === 'READY').length,
        uniqueLearners: distinctLearners.length,
        averageRating: Number((reviewsAgg._avg.rating ?? 0).toFixed(2)),
        averageInstructorRating: Number((reviewsAgg._avg.instructorRating ?? reviewsAgg._avg.rating ?? 0).toFixed(2)),
        totalReviews: reviewsAgg._count.id,
        statusCounts,
      },
      courses,
      recentVideos: videoAssets.map((v) => ({
        ...v,
        sourceSizeBytes: Number(v.sourceSizeBytes),
        hlsTotalBytes: Number(v.hlsTotalBytes),
      })),
      recentFeedback,
      financialStatement,
      competencyRequests,
      reviews,
    };
  }

  async listCourses(
    instructorId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    return this.prisma.course.findMany({
      where: isAdminRole(userRole, userRoles) ? {} : { instructorId },
      include: {
        category: true,
        instructor: { select: { id: true, fullName: true } },
        draftVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            titleAr: true,
            status: true,
            publishedAt: true,
          },
        },
        editorialLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { actor: { select: { id: true, fullName: true, role: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getCourseDetail(
    instructorId: string,
    courseId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        draftVersion: {
          include: {
            introVideo: true,
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    videoAsset: true,
                    attachments: true,
                    quiz: {
                      include: {
                        questions: { orderBy: { sortOrder: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            titleAr: true,
            publishedAt: true,
          },
        },
        editorialLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }
    if (!isAdminRole(userRole, userRoles) && course.instructorId !== instructorId) {
      throw new ForbiddenException('غير مصرح لك بالوصول إلى محتوى مدرب آخر');
    }

    return this.serializeCourseBigInts(course);
  }

  async createCourse(
    instructorId: string,
    rawInput: unknown,
    ip?: string,
    actorRole: UserRole = 'INSTRUCTOR',
  ) {
    const parsed = createCourseSchema.parse(rawInput);

    const existingSlug = await this.prisma.course.findUnique({
      where: { slug: parsed.slug },
    });
    if (existingSlug) {
      throw new BadRequestException('الرابط المختصر مستخدم بالفعل لكورس آخر');
    }

    if (parsed.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!cat) {
        throw new BadRequestException('التخصص المحدد غير موجود');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          slug: parsed.slug,
          instructorId,
          categoryId: parsed.categoryId ?? null,
          status: 'DRAFT',
          isFree: parsed.isFree,
          difficulty: parsed.difficulty,
        },
      });

      const version = await tx.courseVersion.create({
        data: {
          courseId: course.id,
          versionNumber: 1,
          status: 'DRAFT',
          titleAr: parsed.titleAr,
          subtitleAr: parsed.subtitleAr ?? null,
          descriptionAr: parsed.descriptionAr,
          thumbnailUrl: parsed.thumbnailUrl ?? null,
          learningObjectives: parsed.learningObjectives,
          requirements: parsed.requirements,
        },
      });

      return tx.course.update({
        where: { id: course.id },
        data: { draftVersionId: version.id },
        include: { draftVersion: true, category: true },
      });
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole,
      action: 'COURSE_CREATED_DRAFT',
      entityType: 'Course',
      entityId: created.id,
      metadata: { slug: created.slug },
      ipAddress: ip,
    });

    return created;
  }

  async updateCourseDraft(
    instructorId: string,
    courseId: string,
    rawInput: unknown,
    ip?: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const parsed = updateCourseVersionSchema.parse(rawInput);
    const isAdmin = isAdminRole(userRole, userRoles);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        draftVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  include: { attachments: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }
    if (!isAdmin && course.instructorId !== instructorId) {
      throw new ForbiddenException('لا يمكنك تعديل كورسات مدربين آخرين');
    }

    // Ensure draftVersion exists and is safe to mutate (clone if draftVersion === publishedVersion)
    let workingVersion = course.draftVersion;
    if (!workingVersion || course.publishedVersionId === workingVersion.id) {
      workingVersion = await this.cloneNewDraftVersion(course.id, instructorId);
    }

    if (workingVersion.status === 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException(
        'النسخة الحالية قيد المراجعة الإدارية. انتظر نتيجة المراجعة أو اسحب الطلب أولاً.',
      );
    }

    if (parsed.slug && parsed.slug !== course.slug) {
      if (course.publishedVersionId) {
        throw new BadRequestException('لا يمكن تغيير الرابط المختصر بعد النشر');
      }
      const slugTaken = await this.prisma.course.findUnique({ where: { slug: parsed.slug } });
      if (slugTaken) {
        throw new BadRequestException('الرابط المختصر مستخدم بالفعل');
      }
    }

    if (parsed.introVideoId) {
      const video = await this.prisma.videoAsset.findUnique({
        where: { id: parsed.introVideoId },
      });
      if (!video || (!isAdmin && video.instructorId !== instructorId)) {
        throw new ForbiddenException('الفيديو التعريفي المحدد غير مملوك لك');
      }
    }

    if (parsed.sections) {
      const videoIds = parsed.sections
        .flatMap((s) => s.lessons)
        .map((l) => l.videoAssetId)
        .filter((id): id is string => Boolean(id));
      if (videoIds.length > 0) {
        const ownedVideos = await this.prisma.videoAsset.findMany({
          where: isAdmin ? { id: { in: videoIds } } : { id: { in: videoIds }, instructorId },
          select: { id: true },
        });
        const ownedSet = new Set(ownedVideos.map((v) => v.id));
        for (const vid of videoIds) {
          if (!ownedSet.has(vid)) {
            throw new ForbiddenException('أحد الفيديوهات المحددة غير مملوك لحسابك');
          }
        }
      }

      const quizIds = parsed.sections
        .flatMap((s) => s.lessons)
        .map((l) => l.quizId)
        .filter((id): id is string => Boolean(id));
      if (quizIds.length > 0) {
        const ownedQuizzes = await this.prisma.quiz.findMany({
          where: isAdmin
            ? { id: { in: quizIds } }
            : { id: { in: quizIds }, createdById: instructorId },
          select: { id: true },
        });
        const ownedQuizSet = new Set(ownedQuizzes.map((q) => q.id));
        for (const qid of quizIds) {
          if (!ownedQuizSet.has(qid)) {
            throw new ForbiddenException('أحد الاختبارات المحددة غير مملوك لحسابك');
          }
        }
      }
    }

    const existingLessonsByStableKey = new Map<
      string,
      {
        attachments: Array<{
          titleAr: string;
          storageKey: string;
          mimeType: string;
          sizeBytes: bigint;
        }>;
      }
    >();
    for (const sec of workingVersion.sections) {
      for (const les of sec.lessons) {
        existingLessonsByStableKey.set(les.stableKey, { attachments: les.attachments });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: course.id },
        data: {
          ...(parsed.slug && !course.publishedVersionId ? { slug: parsed.slug } : {}),
          ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
          ...(parsed.isFree !== undefined ? { isFree: parsed.isFree } : {}),
          ...(parsed.difficulty ? { difficulty: parsed.difficulty } : {}),
          ...(course.status !== 'PUBLISHED' ? { status: 'DRAFT' } : {}),
        },
      });

      let computedDurationMinutes = workingVersion!.durationMinutes;
      if (parsed.sections) {
        const totalSeconds = parsed.sections
          .flatMap((s) => s.lessons)
          .reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
        computedDurationMinutes = Math.max(1, Math.round(totalSeconds / 60));

        await tx.courseSection.deleteMany({
          where: { courseVersionId: workingVersion!.id },
        });

        for (const sec of parsed.sections) {
          const createdSection = await tx.courseSection.create({
            data: {
              courseVersionId: workingVersion!.id,
              titleAr: sec.titleAr,
              descriptionAr: sec.descriptionAr ?? null,
              sortOrder: sec.sortOrder,
            },
          });

          for (const les of sec.lessons) {
            const stableKey =
              les.stableKey ?? `lesson_${crypto.randomBytes(6).toString('hex')}`;
            const createdLesson = await tx.lesson.create({
              data: {
                sectionId: createdSection.id,
                stableKey,
                titleAr: les.titleAr,
                descriptionAr: les.descriptionAr ?? null,
                type: les.type,
                isFreePreview: les.isFreePreview,
                durationSeconds: les.durationSeconds,
                sortOrder: les.sortOrder,
                videoAssetId: les.videoAssetId ?? null,
                articleContentAr: les.articleContentAr ?? null,
                quizId: les.quizId ?? null,
              },
            });

            const preserved = existingLessonsByStableKey.get(stableKey);
            if (preserved?.attachments.length) {
              await tx.lessonAttachment.createMany({
                data: preserved.attachments.map((att) => ({
                  lessonId: createdLesson.id,
                  titleAr: att.titleAr,
                  storageKey: att.storageKey,
                  mimeType: att.mimeType,
                  sizeBytes: att.sizeBytes,
                })),
              });
            }
          }
        }
      }

      await tx.courseVersion.update({
        where: { id: workingVersion!.id },
        data: {
          status: 'DRAFT',
          ...(parsed.titleAr !== undefined ? { titleAr: parsed.titleAr } : {}),
          ...(parsed.subtitleAr !== undefined ? { subtitleAr: parsed.subtitleAr } : {}),
          ...(parsed.descriptionAr !== undefined
            ? { descriptionAr: parsed.descriptionAr }
            : {}),
          ...(parsed.thumbnailUrl !== undefined
            ? { thumbnailUrl: parsed.thumbnailUrl }
            : {}),
          ...(parsed.introVideoId !== undefined
            ? { introVideoId: parsed.introVideoId }
            : {}),
          ...(parsed.learningObjectives !== undefined
            ? { learningObjectives: parsed.learningObjectives }
            : {}),
          ...(parsed.requirements !== undefined
            ? { requirements: parsed.requirements }
            : {}),
          durationMinutes: computedDurationMinutes,
        },
      });
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole: userRole,
      action: 'COURSE_DRAFT_UPDATED',
      entityType: 'CourseVersion',
      entityId: workingVersion.id,
      metadata: { courseId: course.id },
      ipAddress: ip,
    });

    return this.getCourseDetail(instructorId, courseId, userRole, userRoles);
  }

  async submitCourseForReview(
    instructorId: string,
    courseId: string,
    ip?: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        draftVersion: {
          include: {
            sections: {
              include: {
                lessons: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }
    if (!isAdminRole(userRole, userRoles) && course.instructorId !== instructorId) {
      throw new ForbiddenException('لا يمكنك تقديم كورس مدرب آخر للمراجعة');
    }
    if (!course.draftVersion) {
      throw new BadRequestException('لا توجد نسخة مسودة جاهزة للمراجعة');
    }
    if (course.draftVersion.status === 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException('الكورس مقدم للمراجعة بالفعل');
    }

    const totalLessons = course.draftVersion.sections.reduce(
      (sum, s) => sum + s.lessons.length,
      0,
    );
    if (course.draftVersion.sections.length === 0 || totalLessons === 0) {
      throw new BadRequestException(
        'يجب إضافة قسم واحد ودرس واحد على الأقل قبل إرسال الكورس للمراجعة',
      );
    }

    const prevStatus = course.draftVersion.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.courseVersion.update({
        where: { id: course.draftVersion!.id },
        data: {
          status: 'SUBMITTED_FOR_REVIEW',
          submittedAt: new Date(),
        },
      });

      if (course.status !== 'PUBLISHED') {
        await tx.course.update({
          where: { id: course.id },
          data: { status: 'SUBMITTED_FOR_REVIEW' },
        });
      }

      await tx.editorialReviewLog.create({
        data: {
          courseId: course.id,
          courseVersionId: course.draftVersion!.id,
          fromStatus: prevStatus,
          toStatus: 'SUBMITTED_FOR_REVIEW',
          actorId: instructorId,
          comment: 'تم إرسال الكورس من المدرب للمراجعة الإدارية والاعتماد.',
        },
      });
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole: userRole,
      action: 'COURSE_SUBMITTED_FOR_REVIEW',
      entityType: 'CourseVersion',
      entityId: course.draftVersion.id,
      metadata: { courseId: course.id },
      ipAddress: ip,
    });

    return this.getCourseDetail(instructorId, courseId, userRole, userRoles);
  }

  async withdrawCourseSubmission(
    instructorId: string,
    courseId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { draftVersion: true },
    });
    if (!course || (!isAdminRole(userRole, userRoles) && course.instructorId !== instructorId)) {
      throw new ForbiddenException('غير مصرح لك بهذا الإجراء');
    }
    if (!course.draftVersion || course.draftVersion.status !== 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException('الكورس ليس في حالة انتظار المراجعة حالياً');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseVersion.update({
        where: { id: course.draftVersion!.id },
        data: { status: 'DRAFT' },
      });
      if (course.status !== 'PUBLISHED') {
        await tx.course.update({
          where: { id: course.id },
          data: { status: 'DRAFT' },
        });
      }
      await tx.editorialReviewLog.create({
        data: {
          courseId: course.id,
          courseVersionId: course.draftVersion!.id,
          fromStatus: 'SUBMITTED_FOR_REVIEW',
          toStatus: 'DRAFT',
          actorId: instructorId,
          comment: 'سحب المدرب طلب المراجعة لاستكمال التعديلات.',
        },
      });
    });

    return this.getCourseDetail(instructorId, courseId, userRole, userRoles);
  }

  async listQuizzes(
    instructorId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    return this.prisma.quiz.findMany({
      where: isAdminRole(userRole, userRoles) ? {} : { createdById: instructorId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { attempts: true, lessons: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createQuiz(
    instructorId: string,
    rawInput: unknown,
    ip?: string,
    actorRole: UserRole = 'INSTRUCTOR',
  ) {
    const parsed = createQuizSchema.parse(rawInput);

    for (const q of parsed.questions) {
      const optionIds = new Set(q.options.map((o) => o.id));
      if (!optionIds.has(q.correctOptionId)) {
        throw new BadRequestException(
          `الإجابة الصحيحة غير مطابقة لأحد الخيارات في السؤال: ${q.questionTextAr}`,
        );
      }
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        titleAr: parsed.titleAr,
        descriptionAr: parsed.descriptionAr ?? null,
        passingScorePercent: parsed.passingScorePercent,
        maxAttempts: parsed.maxAttempts ?? null,
        timeLimitMinutes: parsed.timeLimitMinutes ?? null,
        createdById: instructorId,
        questions: {
          create: parsed.questions.map((q) => ({
            questionTextAr: q.questionTextAr,
            options: q.options,
            correctOptionId: q.correctOptionId,
            explanationAr: q.explanationAr ?? null,
            points: q.points,
            sortOrder: q.sortOrder,
          })),
        },
      },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole,
      action: 'QUIZ_CREATED',
      entityType: 'Quiz',
      entityId: quiz.id,
      ipAddress: ip,
    });

    return quiz;
  }

  async updateQuiz(
    instructorId: string,
    quizId: string,
    rawInput: unknown,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const existing = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      throw new NotFoundException('الاختبار غير موجود');
    }
    if (!isAdminRole(userRole, userRoles) && existing.createdById !== instructorId) {
      throw new ForbiddenException('لا يمكنك تعديل اختبار مدرب آخر');
    }

    const parsed = createQuizSchema.parse(rawInput);
    for (const q of parsed.questions) {
      const optionIds = new Set(q.options.map((o) => o.id));
      if (!optionIds.has(q.correctOptionId)) {
        throw new BadRequestException('الإجابة الصحيحة يجب أن تكون ضمن الخيارات');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { quizId } });
      return tx.quiz.update({
        where: { id: quizId },
        data: {
          titleAr: parsed.titleAr,
          descriptionAr: parsed.descriptionAr ?? null,
          passingScorePercent: parsed.passingScorePercent,
          maxAttempts: parsed.maxAttempts ?? null,
          timeLimitMinutes: parsed.timeLimitMinutes ?? null,
          questions: {
            create: parsed.questions.map((q) => ({
              questionTextAr: q.questionTextAr,
              options: q.options,
              correctOptionId: q.correctOptionId,
              explanationAr: q.explanationAr ?? null,
              points: q.points,
              sortOrder: q.sortOrder,
            })),
          },
        },
        include: { questions: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async uploadLessonAttachment(params: {
    instructorId: string;
    userRole?: UserRole;
    userRoles?: readonly SystemRoleCode[];
    lessonId: string;
    titleAr: string;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        section: {
          include: {
            courseVersion: {
              include: { course: true },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException('الدرس غير موجود');
    }
    const course = lesson.section.courseVersion.course;
    if (
      !isAdminRole(params.userRole, params.userRoles) &&
      course.instructorId !== params.instructorId
    ) {
      throw new ForbiddenException('لا يمكنك رفع مرفقات على درس مدرب آخر');
    }
    if (lesson.section.courseVersion.id === course.publishedVersionId) {
      throw new BadRequestException(
        'قم بإنشاء/حفظ مسودة تعديل جديدة أولاً قبل تعديل مرفقات نسخة منشورة',
      );
    }

    const safeExt = path.extname(params.originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
    const storageKey = path.posix.join(
      course.id,
      `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`,
    );
    const absPath = this.storage.resolveSafeSubpath(this.storage.attachmentsDir, storageKey);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, params.buffer);

    const attachment = await this.prisma.lessonAttachment.create({
      data: {
        lessonId: lesson.id,
        titleAr: params.titleAr.trim() || params.originalName,
        storageKey,
        mimeType: params.mimeType || 'application/octet-stream',
        sizeBytes: BigInt(params.buffer.byteLength),
      },
    });

    return {
      ...attachment,
      sizeBytes: Number(attachment.sizeBytes),
    };
  }

  async deleteLessonAttachment(
    instructorId: string,
    attachmentId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const attachment = await this.prisma.lessonAttachment.findUnique({
      where: { id: attachmentId },
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
    if (!isAdminRole(userRole, userRoles) && course.instructorId !== instructorId) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا المرفق');
    }

    await this.prisma.lessonAttachment.delete({ where: { id: attachmentId } });
    try {
      const normalizedKey = attachment.storageKey.replace(/^attachments\//, '');
      const absPath = this.storage.resolveSafeSubpath(
        this.storage.attachmentsDir,
        normalizedKey,
      );
      await fs.unlink(absPath);
    } catch {
      // File may already be missing; DB record cleaned up cleanly.
    }

    return { deleted: true, id: attachmentId };
  }

  async listVideoAssets(
    instructorId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const assets = await this.prisma.videoAsset.findMany({
      where: isAdminRole(userRole, userRoles) ? {} : { instructorId },
      orderBy: { createdAt: 'desc' },
    });
    return assets.map((a) => ({
      ...a,
      sourceSizeBytes: Number(a.sourceSizeBytes),
      hlsTotalBytes: Number(a.hlsTotalBytes),
    }));
  }

  async getCourseAnalytics(
    instructorId: string,
    courseId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        publishedVersion: {
          include: {
            sections: {
              include: { lessons: true },
            },
          },
        },
        reviews: {
          where: { isPublished: true },
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }
    if (!isAdminRole(userRole, userRoles) && course.instructorId !== instructorId) {
      throw new ForbiddenException('لا يمكنك الاطلاع على تحليلات مدرب آخر');
    }

    const progressRows = await this.prisma.lessonProgress.findMany({
      where: { courseId },
    });

    const userMap = new Map<string, { completed: number; totalProgress: number; count: number }>();
    for (const row of progressRows) {
      const entry = userMap.get(row.userId) ?? { completed: 0, totalProgress: 0, count: 0 };
      entry.completed += row.isCompleted ? 1 : 0;
      entry.totalProgress += row.progressPercent;
      entry.count += 1;
      userMap.set(row.userId, entry);
    }

    const quizIds =
      course.publishedVersion?.sections
        .flatMap((s) => s.lessons)
        .map((l) => l.quizId)
        .filter((id): id is string => Boolean(id)) ?? [];

    const quizAttempts = quizIds.length
      ? await this.prisma.quizAttempt.findMany({
          where: { quizId: { in: quizIds } },
        })
      : [];

    const videoIds =
      course.publishedVersion?.sections
        .flatMap((s) => s.lessons)
        .map((l) => l.videoAssetId)
        .filter((id): id is string => Boolean(id)) ?? [];

    const playbackCount = videoIds.length
      ? await this.prisma.videoPlaybackLog.count({
          where: { videoAssetId: { in: videoIds } },
        })
      : 0;

    const certsCount = await this.prisma.certificate.count({
      where: { courseId, revokedAt: null },
    });

    return {
      courseId: course.id,
      slug: course.slug,
      uniqueLearners: userMap.size,
      completedLessonsTotal: progressRows.filter((p) => p.isCompleted).length,
      videoPlaybacks: playbackCount,
      certificatesIssued: certsCount,
      quizStats: {
        totalAttempts: quizAttempts.length,
        passedAttempts: quizAttempts.filter((a) => a.passed).length,
        avgScorePercent: quizAttempts.length
          ? Math.round(
              quizAttempts.reduce((s, a) => s + a.scorePercent, 0) / quizAttempts.length,
            )
          : 0,
      },
      reviews: course.reviews,
    };
  }

  private async cloneNewDraftVersion(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  include: { attachments: true },
                },
              },
            },
          },
        },
      },
    });

    const source = course.versions[0];
    const nextVersionNumber = (source?.versionNumber ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const version = await tx.courseVersion.create({
        data: {
          courseId,
          versionNumber: nextVersionNumber,
          status: 'DRAFT',
          titleAr: source?.titleAr ?? 'مسودة جديدة',
          subtitleAr: source?.subtitleAr ?? null,
          descriptionAr: source?.descriptionAr ?? 'وصف الكورس',
          thumbnailUrl: source?.thumbnailUrl ?? null,
          introVideoId: source?.introVideoId ?? null,
          durationMinutes: source?.durationMinutes ?? 0,
          learningObjectives: source?.learningObjectives ?? [],
          requirements: source?.requirements ?? [],
        },
      });

      if (source) {
        for (const sec of source.sections) {
          const newSec = await tx.courseSection.create({
            data: {
              courseVersionId: version.id,
              titleAr: sec.titleAr,
              descriptionAr: sec.descriptionAr,
              sortOrder: sec.sortOrder,
            },
          });
          for (const les of sec.lessons) {
            const newLes = await tx.lesson.create({
              data: {
                sectionId: newSec.id,
                stableKey: les.stableKey,
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
            if (les.attachments.length > 0) {
              await tx.lessonAttachment.createMany({
                data: les.attachments.map((att) => ({
                  lessonId: newLes.id,
                  titleAr: att.titleAr,
                  storageKey: att.storageKey,
                  mimeType: att.mimeType,
                  sizeBytes: att.sizeBytes,
                })),
              });
            }
          }
        }
      }

      await tx.course.update({
        where: { id: courseId },
        data: { draftVersionId: version.id },
      });

      return tx.courseVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: {
          sections: {
            orderBy: { sortOrder: 'asc' },
            include: {
              lessons: {
                orderBy: { sortOrder: 'asc' },
                include: { attachments: true },
              },
            },
          },
        },
      });
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole: 'INSTRUCTOR',
      action: 'COURSE_VERSION_CLONED',
      entityType: 'CourseVersion',
      entityId: created.id,
      metadata: { courseId, versionNumber: nextVersionNumber },
    });

    return created;
  }

  private serializeCourseBigInts<T extends { draftVersion?: any }>(course: T) {
    if (!course.draftVersion) return course;
    return {
      ...course,
      draftVersion: {
        ...course.draftVersion,
        introVideo: course.draftVersion.introVideo
          ? {
              ...course.draftVersion.introVideo,
              sourceSizeBytes: Number(course.draftVersion.introVideo.sourceSizeBytes),
              hlsTotalBytes: Number(course.draftVersion.introVideo.hlsTotalBytes),
            }
          : null,
        sections: (course.draftVersion.sections ?? []).map((s: any) => ({
          ...s,
          lessons: (s.lessons ?? []).map((l: any) => ({
            ...l,
            videoAsset: l.videoAsset
              ? {
                  ...l.videoAsset,
                  sourceSizeBytes: Number(l.videoAsset.sourceSizeBytes),
                  hlsTotalBytes: Number(l.videoAsset.hlsTotalBytes),
                }
              : null,
            attachments: (l.attachments ?? []).map((att: any) => ({
              ...att,
              sizeBytes: Number(att.sizeBytes),
            })),
          })),
        })),
      },
    };
  }

  /**
   * Rule 4: Every instructor has an independent financial account statement.
   */
  async getFinancialStatement(instructorId: string) {
    let account = await this.prisma.instructorFinancialAccount.findUnique({
      where: { instructorId },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            paymentRecord: true,
          },
        },
      },
    });

    if (!account) {
      account = await this.prisma.instructorFinancialAccount.create({
        data: {
          accountCode: `INS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          instructorId,
          currency: 'EGP',
        },
        include: {
          entries: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { paymentRecord: true },
          },
        },
      });
    }

    const [programAssignments, payouts] = await Promise.all([
      this.prisma.programInstructorAssignment.findMany({
        where: { instructorId },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              priceCents: true,
              publishedVersion: { select: { titleAr: true } },
            },
          },
          learningPath: { select: { id: true, slug: true, titleAr: true, priceCents: true } },
          diploma: { select: { id: true, slug: true, titleAr: true, priceCents: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financialPaymentRecord.findMany({
        where: { payeeInstructorId: instructorId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return {
      account: {
        id: account.id,
        accountCode: account.accountCode,
        totalEarnedCents: account.totalEarnedCents,
        totalPaidOutCents: account.totalPaidOutCents,
        pendingBalanceCents: account.pendingBalanceCents,
        currency: account.currency,
      },
      entries: account.entries,
      payouts,
      programAssignments,
    };
  }

  async listCompetencyRequests(
    instructorId: string,
    userRole: UserRole = 'INSTRUCTOR',
    userRoles?: readonly SystemRoleCode[],
  ) {
    const isAdmin = isAdminRole(userRole, userRoles);
    return this.prisma.competencyCertificateRequest.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { course: { instructorId } },
              { course: { instructorAssignments: { some: { instructorId } } } },
              { learningPath: { instructorAssignments: { some: { instructorId } } } },
              { diploma: { instructorAssignments: { some: { instructorId } } } },
            ],
          },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
        course: {
          select: {
            id: true,
            slug: true,
            instructorId: true,
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

  async reviewCompetencyRequest(
    actorId: string,
    actorRole: UserRole,
    requestId: string,
    rawInput: unknown,
    actorRoles?: readonly SystemRoleCode[],
  ) {
    const parsed = competencyRequestReviewSchema.parse(rawInput);

    const req = await this.prisma.competencyCertificateRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        course: {
          include: {
            publishedVersion: { select: { titleAr: true } },
            instructorAssignments: { select: { instructorId: true } },
          },
        },
        learningPath: {
          include: { instructorAssignments: { select: { instructorId: true } } },
        },
        diploma: {
          include: { instructorAssignments: { select: { instructorId: true } } },
        },
      },
    });
    if (!req) {
      throw new NotFoundException('طلب شهادة الكفاءة غير موجود');
    }

    if (!isAdminRole(actorRole, actorRoles)) {
      const assignedIds = new Set<string>([
        ...(req.course ? [req.course.instructorId, ...req.course.instructorAssignments.map((a) => a.instructorId)] : []),
        ...(req.learningPath ? req.learningPath.instructorAssignments.map((a) => a.instructorId) : []),
        ...(req.diploma ? req.diploma.instructorAssignments.map((a) => a.instructorId) : []),
      ]);
      if (!assignedIds.has(actorId)) {
        throw new ForbiddenException('هذا الطلب مخصص لمدرب البرنامج المعين أو الإدارة فقط');
      }
    }

    if (parsed.decision === 'REJECT') {
      const rejected = await this.prisma.competencyCertificateRequest.update({
        where: { id: req.id },
        data: {
          status: 'REJECTED',
          reviewedById: actorId,
          reviewedByRole: actorRole,
          reviewedAt: new Date(),
          reviewNotesAr: parsed.reviewNotesAr ?? null,
        },
      });

      await this.prisma.notification
        .create({
          data: {
            userId: req.userId,
            type: 'COMPETENCY_CERTIFICATE_REVIEWED',
            titleAr: 'ملاحظات على طلب شهادة الكفاءة',
            bodyAr: parsed.reviewNotesAr || 'يرجى مراجعة ملاحظات المدرب وإعادة تقديم طلب شهادة الكفاءة.',
            actionUrl: '/student',
            dedupKey: `comp_rev_rej_${req.id}_${Date.now()}`,
          },
        })
        .catch(() => {});

      await this.audit.log({
        actorId,
        actorRole,
        action: 'COMPETENCY_CERTIFICATE_REJECTED',
        entityType: 'CompetencyCertificateRequest',
        entityId: req.id,
        metadata: { reviewNotesAr: parsed.reviewNotesAr },
      });

      return rejected;
    }

    // APPROVE -> Issue official Competency Certificate
    const programTitle =
      req.course?.publishedVersion?.titleAr ||
      req.learningPath?.titleAr ||
      req.diploma?.titleAr ||
      'البرنامج التدريبي';

    const code = `BOSLA-COMP-${new Date().getFullYear()}-${crypto
      .randomBytes(4)
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
          approvedById: actorId,
        },
      });

      return tx.competencyCertificateRequest.update({
        where: { id: req.id },
        data: {
          status: 'APPROVED',
          reviewedById: actorId,
          reviewedByRole: actorRole,
          reviewedAt: new Date(),
          reviewNotesAr: parsed.reviewNotesAr ?? 'تم اعتماد الكفاءة المهنية وإصدار الشهادة',
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
          bodyAr: `تهانينا! اعتمدت الإدارة والمدرب شهادة الكفاءة المهنية الخاصة بك في "${programTitle}".`,
          actionUrl: `/certificates/${code}`,
          dedupKey: `comp_rev_app_${req.id}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId,
      actorRole,
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
