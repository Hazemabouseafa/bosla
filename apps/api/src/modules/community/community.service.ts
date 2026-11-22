import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  acceptCommunityAnswerSchema,
  COMMUNITY_REPORT_STATUSES,
  type CommunityModerationAction,
  type CommunityPostFilter,
  type CommunityPostSort,
  createCommunityCommentSchema,
  createCommunityPostSchema,
  createCommunityReportSchema,
  formatVideoTimestamp,
  hasAnyRole,
  isAdminRole,
  moderateCommunityPostSchema,
  resolveCommunityReportSchema,
  subscriberAnswerCreateSchema,
  subscriberQuestionCreateSchema,
  updateCommunitySettingsSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import type { CommunityNotificationJobPayload } from '../../core/redis.service';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CommunityAccessService,
  PUBLIC_COMMUNITY_AUTHOR_SELECT,
} from './community-access.service';

@Injectable()
export class CommunityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunityAccessService) private readonly access: CommunityAccessService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async resolveValidatedLesson(params: {
    courseId: string;
    publishedVersionId: string | null;
    lessonId: string;
    allowDraftVersion: boolean;
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        section: {
          include: {
            courseVersion: { select: { id: true, courseId: true, status: true } },
          },
        },
        videoAsset: { select: { id: true, durationSeconds: true, status: true } },
      },
    });

    if (!lesson || lesson.section.courseVersion.courseId !== params.courseId) {
      throw new BadRequestException('الدرس المحدد لا ينتمي إلى هذا الكورس');
    }

    if (
      !params.allowDraftVersion &&
      params.publishedVersionId &&
      lesson.section.courseVersionId !== params.publishedVersionId
    ) {
      throw new BadRequestException('الدرس المحدد غير منشور ضمن النسخة الحالية من الكورس');
    }

    return lesson;
  }

  private validateTimestampForLesson(
    lesson: {
      type: string;
      videoAssetId: string | null;
      durationSeconds: number;
      videoAsset: { durationSeconds: number | null } | null;
    },
    timestampSeconds: number | null | undefined,
  ): number | null {
    if (timestampSeconds === null || timestampSeconds === undefined) {
      return null;
    }
    if (!Number.isFinite(timestampSeconds) || !Number.isInteger(timestampSeconds) || timestampSeconds < 0) {
      throw new BadRequestException('الوقت المحدد من الفيديو غير صالح');
    }
    if (lesson.type !== 'VIDEO' && !lesson.videoAssetId) {
      throw new BadRequestException('لا يمكن ربط وقت فيديو لدرس غير مرئي');
    }

    const actualDuration =
      lesson.videoAsset?.durationSeconds && lesson.videoAsset.durationSeconds > 0
        ? lesson.videoAsset.durationSeconds
        : lesson.durationSeconds;

    if (!actualDuration || actualDuration <= 0) {
      throw new BadRequestException('مدة فيديو الدرس غير متاحة للتحقق من الوقت المحدد');
    }
    if (timestampSeconds > actualDuration) {
      throw new BadRequestException(
        `الوقت المحدد (${timestampSeconds} ث) يتجاوز مدة الفيديو الفعلية (${actualDuration} ث)`,
      );
    }

    return timestampSeconds;
  }

  private async resolveCurrentLessonMap(publishedVersionId: string | null) {
    if (!publishedVersionId) return new Map<string, { id: string; titleAr: string }>();
    const sections = await this.prisma.courseSection.findMany({
      where: { courseVersionId: publishedVersionId },
      include: { lessons: { select: { id: true, stableKey: true, titleAr: true } } },
    });
    const map = new Map<string, { id: string; titleAr: string }>();
    for (const sec of sections) {
      for (const les of sec.lessons) {
        map.set(les.stableKey, { id: les.id, titleAr: les.titleAr });
      }
    }
    return map;
  }

  private formatPostSummary(
    post: any,
    course: { id: string; slug: string; instructorId: string },
    likedPostIds: Set<string>,
    instructorRepliedPostIds: Set<string>,
    currentLessonsByStableKey: Map<string, { id: string; titleAr: string }>,
  ) {
    const resolvedLesson =
      post.lessonStableKey && currentLessonsByStableKey.has(post.lessonStableKey)
        ? currentLessonsByStableKey.get(post.lessonStableKey)!
        : post.lesson
          ? { id: post.lesson.id, titleAr: post.lesson.titleAr }
          : post.lessonId
            ? { id: post.lessonId, titleAr: post.lessonTitleSnapshot || 'الدرس المرتبط' }
            : null;

    return {
      id: post.id,
      courseId: post.courseId,
      courseSlug: course.slug,
      lessonId: resolvedLesson?.id ?? post.lessonId,
      lessonStableKey: post.lessonStableKey,
      lessonTitleAr: resolvedLesson?.titleAr ?? post.lessonTitleSnapshot,
      type: post.type,
      title: post.title,
      body: post.body,
      videoTimestampSeconds: post.videoTimestampSeconds,
      videoTimestampLabel: formatVideoTimestamp(post.videoTimestampSeconds),
      status: post.status,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      isAnswered: post.isAnswered,
      acceptedCommentId: post.acceptedCommentId,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewerHasLiked: likedPostIds.has(post.id),
      instructorParticipated: instructorRepliedPostIds.has(post.id),
      author: this.access.serializeAuthor(post.author, course.instructorId),
      acceptedComment: post.acceptedComment
        ? {
            id: post.acceptedComment.id,
            body: post.acceptedComment.body,
            createdAt: post.acceptedComment.createdAt,
            author: this.access.serializeAuthor(
              post.acceptedComment.author,
              course.instructorId,
            ),
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async getCourseAccessInfo(
    courseIdOrSlug: string,
    user?: Pick<AuthenticatedContextUser, 'id' | 'role'> | null,
  ) {
    const ctx = await this.access.resolveCourseAccess(courseIdOrSlug, user);
    return {
      course: ctx.course,
      settings: ctx.settings,
      access: ctx.decision,
    };
  }

  async listCoursePosts(
    courseIdOrSlug: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
    query: {
      lessonId?: string;
      filter?: CommunityPostFilter;
      sort?: CommunityPostSort;
      search?: string;
      cursor?: string;
      limit?: number;
      includeHidden?: boolean;
    },
  ) {
    const ctx = await this.access.requireCourseCommunityAccess(courseIdOrSlug, user);

    let lessonFilter: Record<string, unknown> = {};
    if (query.lessonId) {
      const lesson = await this.resolveValidatedLesson({
        courseId: ctx.course.id,
        publishedVersionId: ctx.course.publishedVersionId,
        lessonId: query.lessonId,
        allowDraftVersion: ctx.decision.canModerate,
      });
      lessonFilter = {
        OR: [{ lessonId: lesson.id }, { lessonStableKey: lesson.stableKey }],
      };
    }

    const filter = query.filter ?? 'all';
    const typeAndAnswerWhere: Record<string, unknown> = {};
    if (filter === 'questions') {
      typeAndAnswerWhere.type = 'QUESTION';
    } else if (filter === 'lesson_questions') {
      typeAndAnswerWhere.type = 'QUESTION';
      typeAndAnswerWhere.lessonId = { not: null };
    } else if (filter === 'unanswered') {
      typeAndAnswerWhere.type = 'QUESTION';
      typeAndAnswerWhere.isAnswered = false;
    } else if (filter === 'answered') {
      typeAndAnswerWhere.type = 'QUESTION';
      typeAndAnswerWhere.isAnswered = true;
    } else if (filter === 'announcements') {
      typeAndAnswerWhere.type = 'ANNOUNCEMENT';
    }

    const cleanSearch = query.search?.trim();
    const searchWhere: Record<string, unknown> = cleanSearch
      ? {
          OR: [
            { title: { contains: cleanSearch, mode: 'insensitive' } },
            { body: { contains: cleanSearch, mode: 'insensitive' } },
          ],
        }
      : {};

    const showHidden = Boolean(query.includeHidden && ctx.decision.canModerate);
    const where: Record<string, unknown> = {
      courseId: ctx.course.id,
      deletedAt: null,
      status: showHidden ? { in: ['ACTIVE', 'HIDDEN'] } : 'ACTIVE',
      AND: [lessonFilter, typeAndAnswerWhere, searchWhere].filter(
        (obj) => Object.keys(obj).length > 0,
      ),
    };

    const take = Math.min(Math.max(query.limit ?? 20, 1), 30);
    const orderBy =
      query.sort === 'relevant'
        ? [
            { isPinned: 'desc' as const },
            { likeCount: 'desc' as const },
            { commentCount: 'desc' as const },
            { createdAt: 'desc' as const },
          ]
        : [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'desc' as const }];

    const rows = await this.prisma.communityPost.findMany({
      where,
      orderBy,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        lesson: { select: { id: true, titleAr: true, stableKey: true } },
        acceptedComment: {
          include: {
            author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
          },
        },
      },
    });

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const postIds = sliced.map((r) => r.id);

    const [likedRows, instructorComments, currentLessonMap] = await Promise.all([
      postIds.length
        ? this.prisma.communityReaction.findMany({
            where: {
              userId: user.id,
              targetType: 'POST',
              postId: { in: postIds },
            },
            select: { postId: true },
          })
        : [],
      postIds.length
        ? this.prisma.communityComment.findMany({
            where: {
              postId: { in: postIds },
              authorId: ctx.course.instructorId,
              deletedAt: null,
            },
            distinct: ['postId'],
            select: { postId: true },
          })
        : [],
      this.resolveCurrentLessonMap(ctx.course.publishedVersionId),
    ]);

    const likedSet = new Set(likedRows.map((r) => r.postId).filter((v): v is string => Boolean(v)));
    const instructorRepliedSet = new Set(instructorComments.map((c) => c.postId));

    return {
      course: ctx.course,
      settings: ctx.settings,
      access: ctx.decision,
      items: sliced.map((p) =>
        this.formatPostSummary(p, ctx.course, likedSet, instructorRepliedSet, currentLessonMap),
      ),
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }

  async createPost(
    courseIdOrSlug: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role' | 'fullName'>,
    rawInput: unknown,
    ip?: string,
  ) {
    const ctx = await this.access.requireCourseCommunityAccess(courseIdOrSlug, user, {
      requireCanPost: true,
    });
    await this.access.enforceRateLimit(user.id, 'post');

    const parsed = createCommunityPostSchema.parse(rawInput);

    if (parsed.type === 'ANNOUNCEMENT' && !ctx.decision.canModerate) {
      throw new ForbiddenException('نشر إعلانات المدرب متاح لمدرب الكورس أو الإدارة فقط');
    }
    if (
      parsed.type === 'DISCUSSION' &&
      !ctx.settings.allowStudentDiscussions &&
      user.role === 'STUDENT'
    ) {
      throw new ForbiddenException(
        'المناقشات المفتوحة معطلة في هذا الكورس حاليًا؛ يمكنك طرح الأسئلة فقط',
      );
    }

    let resolvedLesson: Awaited<ReturnType<CommunityService['resolveValidatedLesson']>> | null =
      null;
    let validTimestamp: number | null = null;

    if (parsed.lessonId) {
      resolvedLesson = await this.resolveValidatedLesson({
        courseId: ctx.course.id,
        publishedVersionId: ctx.course.publishedVersionId,
        lessonId: parsed.lessonId,
        allowDraftVersion: ctx.decision.canModerate,
      });
      validTimestamp = this.validateTimestampForLesson(
        resolvedLesson,
        parsed.videoTimestampSeconds,
      );
    } else if (
      parsed.videoTimestampSeconds !== null &&
      parsed.videoTimestampSeconds !== undefined
    ) {
      throw new BadRequestException('لا يمكن ربط وقت من الفيديو دون تحديد الدرس');
    }

    const created = await this.prisma.communityPost.create({
      data: {
        courseId: ctx.course.id,
        lessonId: resolvedLesson?.id ?? null,
        lessonStableKey: resolvedLesson?.stableKey ?? null,
        lessonTitleSnapshot: resolvedLesson?.titleAr ?? null,
        authorId: user.id,
        type: parsed.type,
        title: parsed.title,
        body: parsed.body,
        videoTimestampSeconds: validTimestamp,
      },
      include: {
        author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        lesson: { select: { id: true, titleAr: true, stableKey: true } },
      },
    });

    if (
      parsed.type === 'QUESTION' &&
      user.id !== ctx.course.instructorId
    ) {
      const deepLink = resolvedLesson
        ? `/learn/${ctx.course.slug}?lesson=${encodeURIComponent(resolvedLesson.id)}${
            validTimestamp !== null ? `&t=${validTimestamp}` : ''
          }&question=${encodeURIComponent(created.id)}`
        : `/learn/${ctx.course.slug}?tab=community&question=${encodeURIComponent(created.id)}`;

      await this.notifications.dispatchCommunityNotifications([
        {
          userId: ctx.course.instructorId,
          type: resolvedLesson
            ? 'COMMUNITY_NEW_LESSON_QUESTION'
            : 'COMMUNITY_NEW_COURSE_QUESTION',
          titleAr: resolvedLesson
            ? `سؤال جديد على درس "${resolvedLesson.titleAr}"`
            : `سؤال جديد في كورس "${ctx.course.titleAr}"`,
          bodyAr: `${user.fullName}: ${created.title}`,
          actionUrl: deepLink,
          dedupKey: `new_q_${created.id}_${ctx.course.instructorId}`,
          courseId: ctx.course.id,
          postId: created.id,
          lessonId: resolvedLesson?.id ?? null,
        },
      ]);
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'COMMUNITY_POST_CREATED',
      entityType: 'CommunityPost',
      entityId: created.id,
      metadata: {
        courseId: ctx.course.id,
        lessonId: created.lessonId,
        type: created.type,
        videoTimestampSeconds: created.videoTimestampSeconds,
      },
      ipAddress: ip,
    });

    const currentLessonMap = await this.resolveCurrentLessonMap(
      ctx.course.publishedVersionId,
    );
    return this.formatPostSummary(
      created,
      ctx.course,
      new Set(),
      new Set(),
      currentLessonMap,
    );
  }

  async getPostDetail(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        lesson: { select: { id: true, titleAr: true, stableKey: true } },
        acceptedComment: {
          include: { author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT } },
        },
      },
    });

    if (!post || post.deletedAt || post.status === 'REMOVED') {
      throw new NotFoundException('المشاركة أو السؤال غير موجود');
    }

    const ctx = await this.access.requireCourseCommunityAccess(post.courseId, user);
    if (post.status === 'HIDDEN' && !ctx.decision.canModerate) {
      throw new NotFoundException('المشاركة غير متاحة حاليًا');
    }

    const [comments, postLiked, currentLessonMap] = await Promise.all([
      this.prisma.communityComment.findMany({
        where: { postId: post.id, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 150,
        include: {
          author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        },
      }),
      this.prisma.communityReaction.findFirst({
        where: { userId: user.id, targetType: 'POST', postId: post.id },
        select: { id: true },
      }),
      this.resolveCurrentLessonMap(ctx.course.publishedVersionId),
    ]);

    const commentIds = comments.map((c) => c.id);
    const likedCommentRows = commentIds.length
      ? await this.prisma.communityReaction.findMany({
          where: { userId: user.id, targetType: 'COMMENT', commentId: { in: commentIds } },
          select: { commentId: true },
        })
      : [];
    const likedCommentSet = new Set(
      likedCommentRows.map((r) => r.commentId).filter((v): v is string => Boolean(v)),
    );

    const hasInstructorReply = comments.some(
      (c) => c.authorId === ctx.course.instructorId,
    );

    const serializeComment = (c: (typeof comments)[number]) => ({
      id: c.id,
      postId: c.postId,
      parentCommentId: c.parentCommentId,
      body: c.body,
      likeCount: c.likeCount,
      viewerHasLiked: likedCommentSet.has(c.id),
      isAcceptedAnswer: post.acceptedCommentId === c.id,
      author: this.access.serializeAuthor(c.author, ctx.course.instructorId),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      replies: [] as any[],
    });

    const topLevel: ReturnType<typeof serializeComment>[] = [];
    const topById = new Map<string, ReturnType<typeof serializeComment>>();

    for (const c of comments) {
      if (!c.parentCommentId) {
        const node = serializeComment(c);
        topLevel.push(node);
        topById.set(c.id, node);
      }
    }

    for (const c of comments) {
      if (c.parentCommentId) {
        const node = serializeComment(c);
        const parent = topById.get(c.parentCommentId);
        if (parent) {
          parent.replies.push(node);
        } else {
          topLevel.push(node);
        }
      }
    }

    const summary = this.formatPostSummary(
      post,
      ctx.course,
      new Set(postLiked ? [post.id] : []),
      new Set(hasInstructorReply ? [post.id] : []),
      currentLessonMap,
    );

    return {
      post: summary,
      comments: topLevel,
      permissions: ctx.decision,
    };
  }

  async addComment(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role' | 'fullName'> &
      Partial<Pick<AuthenticatedContextUser, 'roles'>>,
    rawInput: unknown,
    ip?: string,
  ) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: { lesson: { select: { id: true, titleAr: true } } },
    });
    if (!post || post.deletedAt || post.status !== 'ACTIVE') {
      throw new NotFoundException('المشاركة غير موجودة أو تم إزالتها');
    }

    const ctx = await this.access.requireCourseCommunityAccess(post.courseId, user, {
      requireCanPost: true,
    });
    if (post.isLocked && !ctx.decision.canModerate) {
      throw new ForbiddenException('هذه المناقشة مغلقة ولا يمكن إضافة ردود جديدة عليها');
    }

    await this.access.enforceRateLimit(user.id, 'comment');
    const parsed = createCommunityCommentSchema.parse(rawInput);

    let resolvedParentId: string | null = null;
    let parentAuthorId: string | null = null;
    if (parsed.parentCommentId) {
      const parent = await this.prisma.communityComment.findUnique({
        where: { id: parsed.parentCommentId },
      });
      if (!parent || parent.postId !== post.id || parent.deletedAt) {
        throw new BadRequestException('التعليق المراد الرد عليه غير موجود');
      }
      // Bounded comment nesting: max 1 reply level under top-level comment
      resolvedParentId = parent.parentCommentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }

    const isInstructorOrAdmin =
      user.id === ctx.course.instructorId || isAdminRole(user.role, user.roles);

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.communityComment.create({
        data: {
          postId: post.id,
          parentCommentId: resolvedParentId,
          authorId: user.id,
          body: parsed.body,
        },
        include: {
          author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        },
      });

      await tx.communityPost.update({
        where: { id: post.id },
        data: {
          commentCount: { increment: 1 },
          ...(isInstructorOrAdmin && !post.firstInstructorReplyAt
            ? { firstInstructorReplyAt: new Date() }
            : {}),
        },
      });

      return comment;
    });

    const deepLink = post.lessonId
      ? `/learn/${ctx.course.slug}?lesson=${encodeURIComponent(post.lessonId)}${
          post.videoTimestampSeconds !== null ? `&t=${post.videoTimestampSeconds}` : ''
        }&question=${encodeURIComponent(post.id)}`
      : `/learn/${ctx.course.slug}?tab=community&question=${encodeURIComponent(post.id)}`;

    const notificationsToSend: CommunityNotificationJobPayload[] = [];
    const notifiedUsers = new Set<string>();

    if (isInstructorOrAdmin && post.authorId !== user.id) {
      notifiedUsers.add(post.authorId);
      notificationsToSend.push({
        userId: post.authorId,
        type: 'COMMUNITY_INSTRUCTOR_REPLY',
        titleAr: 'أجاب المدرب على سؤالك',
        bodyAr: `${user.fullName}: ${parsed.body.slice(0, 120)}`,
        actionUrl: deepLink,
        dedupKey: `inst_reply_${created.id}_${post.authorId}`,
        courseId: ctx.course.id,
        postId: post.id,
        commentId: created.id,
        lessonId: post.lessonId,
      });
    }

    if (parentAuthorId && parentAuthorId !== user.id && !notifiedUsers.has(parentAuthorId)) {
      notifiedUsers.add(parentAuthorId);
      notificationsToSend.push({
        userId: parentAuthorId,
        type: 'COMMUNITY_COMMENT_REPLY',
        titleAr: 'رد جديد على تعليقك',
        bodyAr: `${user.fullName}: ${parsed.body.slice(0, 120)}`,
        actionUrl: deepLink,
        dedupKey: `reply_${created.id}_${parentAuthorId}`,
        courseId: ctx.course.id,
        postId: post.id,
        commentId: created.id,
        lessonId: post.lessonId,
      });
    }

    if (post.authorId !== user.id && !notifiedUsers.has(post.authorId)) {
      notifiedUsers.add(post.authorId);
      notificationsToSend.push({
        userId: post.authorId,
        type: 'COMMUNITY_COMMENT_REPLY',
        titleAr: 'رد جديد على مشاركتك في الكورس',
        bodyAr: `${user.fullName}: ${parsed.body.slice(0, 120)}`,
        actionUrl: deepLink,
        dedupKey: `post_reply_${created.id}_${post.authorId}`,
        courseId: ctx.course.id,
        postId: post.id,
        commentId: created.id,
        lessonId: post.lessonId,
      });
    }

    if (notificationsToSend.length > 0) {
      await this.notifications.dispatchCommunityNotifications(notificationsToSend);
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'COMMUNITY_COMMENT_CREATED',
      entityType: 'CommunityComment',
      entityId: created.id,
      metadata: { postId: post.id, courseId: ctx.course.id },
      ipAddress: ip,
    });

    return {
      id: created.id,
      postId: created.postId,
      parentCommentId: created.parentCommentId,
      body: created.body,
      likeCount: created.likeCount,
      viewerHasLiked: false,
      isAcceptedAnswer: false,
      author: this.access.serializeAuthor(created.author, ctx.course.instructorId),
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      replies: [],
    };
  }

  async togglePostLike(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt || post.status !== 'ACTIVE') {
      throw new NotFoundException('المشاركة غير موجودة');
    }
    await this.access.requireCourseCommunityAccess(post.courseId, user);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityReaction.findFirst({
        where: { userId: user.id, targetType: 'POST', postId: post.id, type: 'LIKE' },
      });

      if (existing) {
        await tx.communityReaction.delete({ where: { id: existing.id } });
        const updated = await tx.communityPost.update({
          where: { id: post.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        const count = Math.max(0, updated.likeCount);
        if (updated.likeCount < 0) {
          await tx.communityPost.update({ where: { id: post.id }, data: { likeCount: 0 } });
        }
        return { liked: false, likeCount: count };
      }

      await tx.communityReaction.create({
        data: { userId: user.id, targetType: 'POST', postId: post.id, type: 'LIKE' },
      });
      const updated = await tx.communityPost.update({
        where: { id: post.id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });
  }

  async toggleCommentLike(
    commentId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment || comment.deletedAt || comment.post.deletedAt || comment.post.status !== 'ACTIVE') {
      throw new NotFoundException('التعليق غير موجود');
    }
    await this.access.requireCourseCommunityAccess(comment.post.courseId, user);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityReaction.findFirst({
        where: { userId: user.id, targetType: 'COMMENT', commentId: comment.id, type: 'LIKE' },
      });

      if (existing) {
        await tx.communityReaction.delete({ where: { id: existing.id } });
        const updated = await tx.communityComment.update({
          where: { id: comment.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        const count = Math.max(0, updated.likeCount);
        if (updated.likeCount < 0) {
          await tx.communityComment.update({ where: { id: comment.id }, data: { likeCount: 0 } });
        }
        return { liked: false, likeCount: count };
      }

      await tx.communityReaction.create({
        data: { userId: user.id, targetType: 'COMMENT', commentId: comment.id, type: 'LIKE' },
      });
      const updated = await tx.communityComment.update({
        where: { id: comment.id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });
  }

  async acceptAnswer(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role' | 'fullName'> &
      Partial<Pick<AuthenticatedContextUser, 'roles'>>,
    rawInput: unknown,
    ip?: string,
  ) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('السؤال غير موجود');
    }

    const ctx = await this.access.requireCourseCommunityAccess(post.courseId, user, {
      requireCanModerate: true,
    });

    const parsed = acceptCommunityAnswerSchema.parse(rawInput);
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: parsed.commentId },
    });
    if (!comment || comment.postId !== post.id || comment.deletedAt) {
      throw new BadRequestException('التعليق المحدد لا ينتمي إلى هذا السؤال');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.communityPost.update({
        where: { id: post.id },
        data: {
          acceptedCommentId: comment.id,
          isAnswered: true,
        },
      });
      await tx.communityModerationLog.create({
        data: {
          courseId: post.courseId,
          postId: post.id,
          commentId: comment.id,
          actorId: user.id,
          actorRole: user.role as any,
          action: 'ACCEPT_ANSWER',
        },
      });
      return p;
    });

    if (post.authorId !== user.id) {
      const deepLink = post.lessonId
        ? `/learn/${ctx.course.slug}?lesson=${encodeURIComponent(post.lessonId)}&question=${encodeURIComponent(post.id)}`
        : `/learn/${ctx.course.slug}?tab=community&question=${encodeURIComponent(post.id)}`;

      await this.notifications.dispatchCommunityNotifications([
        {
          userId: post.authorId,
          type: 'COMMUNITY_ACCEPTED_ANSWER',
          titleAr: 'تم اعتماد إجابة لسؤالك',
          bodyAr: `تم اعتماد إجابة في سؤال: ${post.title}`,
          actionUrl: deepLink,
          dedupKey: `accepted_${post.id}_${comment.id}_${post.authorId}`,
          courseId: ctx.course.id,
          postId: post.id,
          commentId: comment.id,
          lessonId: post.lessonId,
        },
      ]);
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'COMMUNITY_ANSWER_ACCEPTED',
      entityType: 'CommunityPost',
      entityId: post.id,
      metadata: { commentId: comment.id },
      ipAddress: ip,
    });

    return updated;
  }

  async moderatePost(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
    rawInput: unknown,
    ip?: string,
  ) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('المشاركة غير موجودة');

    const ctx = await this.access.requireCourseCommunityAccess(post.courseId, user, {
      requireCanModerate: true,
    });
    const parsed = moderateCommunityPostSchema.parse(rawInput);
    const data = this.buildPostModerationUpdate(parsed.action);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.communityPost.update({
        where: { id: post.id },
        data,
      });
      await tx.communityModerationLog.create({
        data: {
          courseId: post.courseId,
          postId: post.id,
          actorId: user.id,
          actorRole: user.role as any,
          action: parsed.action,
          reason: parsed.reason ?? null,
        },
      });
      return next;
    });

    if (
      (parsed.action === 'HIDE' || parsed.action === 'REMOVE') &&
      post.authorId !== user.id
    ) {
      await this.notifications.dispatchCommunityNotifications([
        {
          userId: post.authorId,
          type: 'COMMUNITY_POST_MODERATED',
          titleAr: 'إشعار إشرافي على مشاركة',
          bodyAr: parsed.reason
            ? `تم تعديل حالة مشاركتك في "${ctx.course.titleAr}": ${parsed.reason}`
            : `تم إخفاء أو إزالة مشاركتك "${post.title}" لمراجعة الإشراف.`,
          actionUrl: `/learn/${ctx.course.slug}?tab=community`,
          dedupKey: `mod_${parsed.action}_${post.id}_${updated.updatedAt.getTime()}`,
          courseId: ctx.course.id,
          postId: post.id,
        },
      ]);
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: `COMMUNITY_POST_${parsed.action}`,
      entityType: 'CommunityPost',
      entityId: post.id,
      metadata: { courseId: post.courseId, reason: parsed.reason },
      ipAddress: ip,
    });

    return updated;
  }

  private buildPostModerationUpdate(action: CommunityModerationAction) {
    switch (action) {
      case 'PIN':
        return { isPinned: true };
      case 'UNPIN':
        return { isPinned: false };
      case 'LOCK':
        return { isLocked: true };
      case 'UNLOCK':
        return { isLocked: false };
      case 'HIDE':
        return { status: 'HIDDEN' as const };
      case 'REMOVE':
        return { status: 'REMOVED' as const, deletedAt: new Date() };
      case 'RESTORE':
        return { status: 'ACTIVE' as const, deletedAt: null };
      case 'MARK_ANSWERED':
        return { isAnswered: true };
      case 'MARK_UNANSWERED':
        return { isAnswered: false, acceptedCommentId: null };
    }
  }

  async deleteComment(
    commentId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
    ip?: string,
  ) {
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('التعليق غير موجود');
    }

    const ctx = await this.access.requireCourseCommunityAccess(comment.post.courseId, user);
    const isAuthor = comment.authorId === user.id;
    if (!isAuthor && !ctx.decision.canModerate) {
      throw new ForbiddenException('لا يمكنك حذف تعليقات الآخرين');
    }
    if (isAuthor && comment.post.isLocked && !ctx.decision.canModerate) {
      throw new ForbiddenException('لا يمكن حذف التعليق بعد إغلاق المناقشة');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.communityComment.update({
        where: { id: comment.id },
        data: { deletedAt: new Date() },
      });
      await tx.communityPost.update({
        where: { id: comment.postId },
        data: {
          commentCount: { decrement: 1 },
          ...(comment.post.acceptedCommentId === comment.id
            ? { acceptedCommentId: null, isAnswered: false }
            : {}),
        },
      });
      if (ctx.decision.canModerate && !isAuthor) {
        await tx.communityModerationLog.create({
          data: {
            courseId: comment.post.courseId,
            postId: comment.postId,
            commentId: comment.id,
            actorId: user.id,
            actorRole: user.role as any,
            action: 'REMOVE_COMMENT',
          },
        });
      }
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'COMMUNITY_COMMENT_DELETED',
      entityType: 'CommunityComment',
      entityId: comment.id,
      metadata: { postId: comment.postId, courseId: comment.post.courseId },
      ipAddress: ip,
    });

    return { deleted: true };
  }

  async createReport(
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = createCommunityReportSchema.parse(rawInput);
    await this.access.enforceRateLimit(user.id, 'report');

    let courseId = '';
    let postId: string | null = null;
    let commentId: string | null = null;

    if (parsed.targetType === 'POST') {
      const post = await this.prisma.communityPost.findUnique({
        where: { id: parsed.targetId },
      });
      if (!post || post.deletedAt) throw new NotFoundException('المشاركة غير موجودة');
      courseId = post.courseId;
      postId = post.id;
    } else {
      const comment = await this.prisma.communityComment.findUnique({
        where: { id: parsed.targetId },
        include: { post: true },
      });
      if (!comment || comment.deletedAt) throw new NotFoundException('التعليق غير موجود');
      courseId = comment.post.courseId;
      commentId = comment.id;
    }

    await this.access.requireCourseCommunityAccess(courseId, user);

    const existing = await this.prisma.communityReport.findFirst({
      where: {
        reporterId: user.id,
        ...(postId ? { postId } : { commentId }),
      },
    });
    if (existing) {
      throw new ConflictException('تم إرسال بلاغك عن هذا المحتوى مسبقًا');
    }

    const report = await this.prisma.communityReport.create({
      data: {
        reporterId: user.id,
        courseId,
        targetType: parsed.targetType,
        postId,
        commentId,
        reason: parsed.reason,
        details: parsed.details ?? null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'COMMUNITY_REPORT_SUBMITTED',
      entityType: 'CommunityReport',
      entityId: report.id,
      metadata: { courseId, targetType: parsed.targetType, reason: parsed.reason },
      ipAddress: ip,
    });

    return report;
  }

  /**
   * Validates community + course/lesson media access and returns safe internal navigation parameters.
   * Never returns raw video file URLs or HLS playback tokens.
   */
  async resolveTimestampNavigation(
    postId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: { lesson: true },
    });
    if (!post || post.deletedAt || post.status === 'REMOVED') {
      throw new NotFoundException('السؤال غير موجود');
    }

    const ctx = await this.access.requireCourseCommunityAccess(post.courseId, user);
    const currentLessonMap = await this.resolveCurrentLessonMap(
      ctx.course.publishedVersionId,
    );

    const mappedLesson =
      post.lessonStableKey && currentLessonMap.has(post.lessonStableKey)
        ? currentLessonMap.get(post.lessonStableKey)!
        : post.lesson
          ? { id: post.lesson.id, titleAr: post.lesson.titleAr }
          : null;

    if (!mappedLesson) {
      throw new NotFoundException('الدرس المرتبط بهذا السؤال لم يعد متاحًا في النسخة المنشورة');
    }

    const lesson = await this.resolveValidatedLesson({
      courseId: ctx.course.id,
      publishedVersionId: ctx.course.publishedVersionId,
      lessonId: mappedLesson.id,
      allowDraftVersion: ctx.decision.canModerate,
    });

    const mediaAccess = await this.membership.checkCourseAccessForUser({
      userId: user.id,
      userRole: user.role as any,
      courseId: ctx.course.id,
      isLessonFreePreview: lesson.isFreePreview,
    });

    if (!mediaAccess.allowed) {
      throw new ForbiddenException('لا تملك صلاحية مشاهدة فيديو هذا الدرس');
    }

    const seekSeconds = post.videoTimestampSeconds ?? 0;
    return {
      courseId: ctx.course.id,
      courseSlug: ctx.course.slug,
      lessonId: lesson.id,
      seekSeconds,
      postId: post.id,
      playerPath: `/learn/${ctx.course.slug}?lesson=${encodeURIComponent(lesson.id)}${
        post.videoTimestampSeconds !== null ? `&t=${seekSeconds}` : ''
      }&question=${encodeURIComponent(post.id)}`,
    };
  }

  // ============================================================
  // INSTRUCTOR COMMUNITY MANAGEMENT ("مجتمعات كورساتي")
  // ============================================================

  async getInstructorCommunitiesDashboard(
    instructorId: string,
    courseIdFilter?: string,
    filter: string = 'all',
  ) {
    const courses = await this.prisma.course.findMany({
      where: { instructorId },
      include: {
        publishedVersion: { select: { titleAr: true } },
        draftVersion: { select: { titleAr: true } },
        communitySettings: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const ownedIds = courses.map((c) => c.id);
    if (courseIdFilter && !ownedIds.includes(courseIdFilter)) {
      throw new ForbiddenException('لا يمكنك الوصول إلى مجتمعات كورسات مدربين آخرين');
    }

    const targetCourseIds = courseIdFilter ? [courseIdFilter] : ownedIds;

    const allOwnedPosts =
      ownedIds.length > 0
        ? await this.prisma.communityPost.findMany({
            where: {
              courseId: { in: ownedIds },
              deletedAt: null,
              status: { in: ['ACTIVE', 'HIDDEN'] },
            },
            select: {
              id: true,
              courseId: true,
              lessonId: true,
              type: true,
              isAnswered: true,
              videoTimestampSeconds: true,
            },
          })
        : [];

    const stats = {
      totalCommunities: courses.length,
      totalPosts: allOwnedPosts.length,
      unansweredQuestions: allOwnedPosts.filter(
        (p) => p.type === 'QUESTION' && !p.isAnswered,
      ).length,
      lessonQuestions: allOwnedPosts.filter(
        (p) => p.type === 'QUESTION' && p.lessonId !== null,
      ).length,
      timestampedQuestions: allOwnedPosts.filter(
        (p) => p.type === 'QUESTION' && p.videoTimestampSeconds !== null,
      ).length,
      answeredQuestions: allOwnedPosts.filter(
        (p) => p.type === 'QUESTION' && p.isAnswered,
      ).length,
      announcements: allOwnedPosts.filter((p) => p.type === 'ANNOUNCEMENT').length,
    };

    const postWhere: Record<string, unknown> = {
      courseId: { in: targetCourseIds },
      deletedAt: null,
      status: { in: ['ACTIVE', 'HIDDEN'] },
    };
    if (filter === 'unanswered') {
      postWhere.type = 'QUESTION';
      postWhere.isAnswered = false;
    } else if (filter === 'answered') {
      postWhere.type = 'QUESTION';
      postWhere.isAnswered = true;
    } else if (filter === 'lesson_questions') {
      postWhere.type = 'QUESTION';
      postWhere.lessonId = { not: null };
    } else if (filter === 'timestamped') {
      postWhere.type = 'QUESTION';
      postWhere.videoTimestampSeconds = { not: null };
    } else if (filter === 'announcements') {
      postWhere.type = 'ANNOUNCEMENT';
    }

    const posts =
      targetCourseIds.length > 0
        ? await this.prisma.communityPost.findMany({
            where: postWhere,
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
            take: 50,
            include: {
              author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
              lesson: { select: { id: true, titleAr: true, stableKey: true } },
              course: {
                select: {
                  id: true,
                  slug: true,
                  publishedVersion: { select: { titleAr: true } },
                  draftVersion: { select: { titleAr: true } },
                },
              },
            },
          })
        : [];

    return {
      stats,
      courses: courses.map((c) => {
        const coursePosts = allOwnedPosts.filter((p) => p.courseId === c.id);
        return {
          id: c.id,
          slug: c.slug,
          status: c.status,
          titleAr: c.publishedVersion?.titleAr ?? c.draftVersion?.titleAr ?? c.slug,
          settings: {
            isEnabled: c.communitySettings?.isEnabled ?? true,
            adminDisabled: c.communitySettings?.adminDisabled ?? false,
            allowStudentDiscussions:
              c.communitySettings?.allowStudentDiscussions ?? true,
          },
          counts: {
            total: coursePosts.length,
            unanswered: coursePosts.filter((p) => p.type === 'QUESTION' && !p.isAnswered)
              .length,
            lessonQuestions: coursePosts.filter(
              (p) => p.type === 'QUESTION' && p.lessonId !== null,
            ).length,
          },
        };
      }),
      posts: posts.map((p) => ({
        id: p.id,
        courseId: p.courseId,
        courseSlug: p.course.slug,
        courseTitleAr:
          p.course.publishedVersion?.titleAr ??
          p.course.draftVersion?.titleAr ??
          p.course.slug,
        lessonId: p.lessonId,
        lessonTitleAr: p.lesson?.titleAr ?? p.lessonTitleSnapshot,
        type: p.type,
        title: p.title,
        body: p.body,
        videoTimestampSeconds: p.videoTimestampSeconds,
        videoTimestampLabel: formatVideoTimestamp(p.videoTimestampSeconds),
        status: p.status,
        isPinned: p.isPinned,
        isLocked: p.isLocked,
        isAnswered: p.isAnswered,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        author: this.access.serializeAuthor(p.author, instructorId),
        createdAt: p.createdAt,
      })),
    };
  }

  async updateCourseSettingsByInstructor(
    instructorId: string,
    courseId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { communitySettings: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('لا يمكنك تعديل إعدادات مجتمع كورس مدرب آخر');
    }

    const parsed = updateCommunitySettingsSchema.parse(rawInput);
    if (course.communitySettings?.adminDisabled && parsed.isEnabled === true) {
      throw new ForbiddenException(
        'تم تعطيل مجتمع هذا الكورس من قبل الإدارة ولا يمكن للمدرب إعادة تفعيله',
      );
    }

    const updated = await this.prisma.courseCommunitySettings.upsert({
      where: { courseId: course.id },
      update: {
        ...(parsed.isEnabled !== undefined ? { isEnabled: parsed.isEnabled } : {}),
        ...(parsed.allowStudentDiscussions !== undefined
          ? { allowStudentDiscussions: parsed.allowStudentDiscussions }
          : {}),
        updatedById: instructorId,
      },
      create: {
        courseId: course.id,
        isEnabled: parsed.isEnabled ?? true,
        adminDisabled: false,
        allowStudentDiscussions: parsed.allowStudentDiscussions ?? true,
        updatedById: instructorId,
      },
    });

    await this.prisma.communityModerationLog.create({
      data: {
        courseId: course.id,
        actorId: instructorId,
        actorRole: 'INSTRUCTOR',
        action: 'INSTRUCTOR_UPDATE_SETTINGS',
        metadata: parsed as any,
      },
    });

    await this.audit.log({
      actorId: instructorId,
      actorRole: 'INSTRUCTOR',
      action: 'COMMUNITY_SETTINGS_UPDATED',
      entityType: 'CourseCommunitySettings',
      entityId: updated.id,
      metadata: { courseId: course.id, ...parsed },
      ipAddress: ip,
    });

    return updated;
  }

  // ============================================================
  // ADMIN COMMUNITY GOVERNANCE ("إدارة المجتمعات")
  // ============================================================

  async getAdminCommunitiesOverview() {
    const [courses, posts, instructorCommentsCount, pendingReportsCount, logs] =
      await Promise.all([
        this.prisma.course.findMany({
          include: {
            instructor: { select: { id: true, fullName: true } },
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
            communitySettings: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.communityPost.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            courseId: true,
            lessonId: true,
            type: true,
            status: true,
            isAnswered: true,
            createdAt: true,
            firstInstructorReplyAt: true,
            commentCount: true,
          },
        }),
        this.prisma.communityComment.count({
          where: {
            deletedAt: null,
            author: { role: { in: ['INSTRUCTOR', 'ADMIN'] } },
          },
        }),
        this.prisma.communityReport.count({ where: { status: 'PENDING' } }),
        this.prisma.communityModerationLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            actor: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
            course: {
              select: {
                id: true,
                slug: true,
                publishedVersion: { select: { titleAr: true } },
              },
            },
          },
        }),
      ]);

    const responseTimesMinutes: number[] = [];
    const postCountByCourse = new Map<
      string,
      { total: number; lessonQuestions: number; unanswered: number }
    >();

    for (const p of posts) {
      const bucket = postCountByCourse.get(p.courseId) ?? {
        total: 0,
        lessonQuestions: 0,
        unanswered: 0,
      };
      bucket.total += 1;
      if (p.type === 'QUESTION' && p.lessonId) bucket.lessonQuestions += 1;
      if (p.type === 'QUESTION' && !p.isAnswered) bucket.unanswered += 1;
      postCountByCourse.set(p.courseId, bucket);

      if (p.firstInstructorReplyAt) {
        const diffMin = Math.max(
          0,
          Math.round(
            (p.firstInstructorReplyAt.getTime() - p.createdAt.getTime()) / 60000,
          ),
        );
        responseTimesMinutes.push(diffMin);
      }
    }

    const averageResponseTimeMinutes =
      responseTimesMinutes.length > 0
        ? Math.round(
            responseTimesMinutes.reduce((a, b) => a + b, 0) /
              responseTimesMinutes.length,
          )
        : 0;

    const courseRows = courses.map((c) => {
      const counts = postCountByCourse.get(c.id) ?? {
        total: 0,
        lessonQuestions: 0,
        unanswered: 0,
      };
      return {
        courseId: c.id,
        slug: c.slug,
        titleAr: c.publishedVersion?.titleAr ?? c.draftVersion?.titleAr ?? c.slug,
        status: c.status,
        instructorName: c.instructor.fullName,
        isEnabled: c.communitySettings?.isEnabled ?? true,
        adminDisabled: c.communitySettings?.adminDisabled ?? false,
        allowStudentDiscussions:
          c.communitySettings?.allowStudentDiscussions ?? true,
        counts,
      };
    });

    const mostActiveCourses = [...courseRows]
      .sort((a, b) => b.counts.total - a.counts.total)
      .slice(0, 5);

    return {
      stats: {
        totalPosts: posts.length,
        totalLessonQuestions: posts.filter(
          (p) => p.type === 'QUESTION' && p.lessonId !== null,
        ).length,
        unansweredQuestions: posts.filter(
          (p) => p.type === 'QUESTION' && !p.isAnswered,
        ).length,
        answeredQuestions: posts.filter(
          (p) => p.type === 'QUESTION' && p.isAnswered,
        ).length,
        instructorResponseCount: instructorCommentsCount,
        averageResponseTimeMinutes,
        pendingReportsCount,
      },
      mostActiveCourses,
      courses: courseRows,
      moderationLogs: logs,
    };
  }

  async listAdminPosts(query: {
    courseId?: string;
    filter?: string;
    search?: string;
  }) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.courseId) where.courseId = query.courseId;
    if (query.filter === 'lesson_questions') {
      where.type = 'QUESTION';
      where.lessonId = { not: null };
    } else if (query.filter === 'unanswered') {
      where.type = 'QUESTION';
      where.isAnswered = false;
    } else if (query.filter === 'answered') {
      where.type = 'QUESTION';
      where.isAnswered = true;
    } else if (query.filter === 'announcements') {
      where.type = 'ANNOUNCEMENT';
    } else if (query.filter === 'hidden') {
      where.status = 'HIDDEN';
    }
    if (query.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { body: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 80,
      include: {
        author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        lesson: { select: { id: true, titleAr: true } },
        course: {
          select: {
            id: true,
            slug: true,
            instructorId: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      courseId: p.courseId,
      courseSlug: p.course.slug,
      courseTitleAr:
        p.course.publishedVersion?.titleAr ?? p.course.draftVersion?.titleAr ?? p.course.slug,
      lessonId: p.lessonId,
      lessonTitleAr: p.lesson?.titleAr ?? p.lessonTitleSnapshot,
      type: p.type,
      title: p.title,
      body: p.body,
      videoTimestampSeconds: p.videoTimestampSeconds,
      videoTimestampLabel: formatVideoTimestamp(p.videoTimestampSeconds),
      status: p.status,
      isPinned: p.isPinned,
      isLocked: p.isLocked,
      isAnswered: p.isAnswered,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      author: this.access.serializeAuthor(p.author, p.course.instructorId),
      createdAt: p.createdAt,
    }));
  }

  async updateCourseSettingsByAdmin(
    adminId: string,
    courseId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const parsed = updateCommunitySettingsSchema.parse(rawInput);
    const nextAdminDisabled =
      parsed.adminDisabled !== undefined
        ? parsed.adminDisabled
        : parsed.isEnabled === false
          ? true
          : parsed.isEnabled === true
            ? false
            : undefined;

    const nextEnabled =
      nextAdminDisabled === true
        ? false
        : parsed.isEnabled !== undefined
          ? parsed.isEnabled
          : nextAdminDisabled === false
            ? true
            : undefined;

    const updated = await this.prisma.courseCommunitySettings.upsert({
      where: { courseId: course.id },
      update: {
        ...(nextEnabled !== undefined ? { isEnabled: nextEnabled } : {}),
        ...(nextAdminDisabled !== undefined ? { adminDisabled: nextAdminDisabled } : {}),
        ...(parsed.allowStudentDiscussions !== undefined
          ? { allowStudentDiscussions: parsed.allowStudentDiscussions }
          : {}),
        updatedById: adminId,
      },
      create: {
        courseId: course.id,
        isEnabled: nextEnabled ?? true,
        adminDisabled: nextAdminDisabled ?? false,
        allowStudentDiscussions: parsed.allowStudentDiscussions ?? true,
        updatedById: adminId,
      },
    });

    await this.prisma.communityModerationLog.create({
      data: {
        courseId: course.id,
        actorId: adminId,
        actorRole: 'ADMIN',
        action: updated.isEnabled ? 'ADMIN_ENABLE_COMMUNITY' : 'ADMIN_DISABLE_COMMUNITY',
        metadata: {
          isEnabled: updated.isEnabled,
          adminDisabled: updated.adminDisabled,
          allowStudentDiscussions: updated.allowStudentDiscussions,
        },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COMMUNITY_SETTINGS_UPDATED',
      entityType: 'CourseCommunitySettings',
      entityId: updated.id,
      metadata: {
        courseId: course.id,
        isEnabled: updated.isEnabled,
        adminDisabled: updated.adminDisabled,
      },
      ipAddress: ip,
    });

    return updated;
  }

  async listReports(statusFilter?: string) {
    const validStatus =
      statusFilter && (COMMUNITY_REPORT_STATUSES as readonly string[]).includes(statusFilter)
        ? statusFilter
        : undefined;
    return this.prisma.communityReport.findMany({
      where: validStatus ? { status: validStatus as any } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
      include: {
        reporter: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        reviewedBy: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        course: {
          select: {
            id: true,
            slug: true,
            publishedVersion: { select: { titleAr: true } },
          },
        },
        post: { select: { id: true, title: true, body: true, status: true, deletedAt: true } },
        comment: { select: { id: true, body: true, postId: true, deletedAt: true } },
      },
    });
  }

  async resolveReport(
    adminId: string,
    reportId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const report = await this.prisma.communityReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('البلاغ غير موجود');

    const parsed = resolveCommunityReportSchema.parse(rawInput);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (parsed.removeTarget) {
        if (report.targetType === 'POST' && report.postId) {
          await tx.communityPost.update({
            where: { id: report.postId },
            data: { status: 'REMOVED', deletedAt: new Date() },
          });
        } else if (report.targetType === 'COMMENT' && report.commentId) {
          const comment = await tx.communityComment.findUnique({
            where: { id: report.commentId },
            select: { id: true, postId: true, deletedAt: true },
          });
          if (comment && !comment.deletedAt) {
            await tx.communityComment.update({
              where: { id: comment.id },
              data: { deletedAt: new Date() },
            });
            await tx.communityPost.update({
              where: { id: comment.postId },
              data: { commentCount: { decrement: 1 } },
            });
          }
        }
      }

      const nextReport = await tx.communityReport.update({
        where: { id: report.id },
        data: {
          status: parsed.status as any,
          reviewedById: adminId,
          reviewedAt: new Date(),
          resolutionNotes: parsed.resolutionNotes ?? null,
        },
      });

      await tx.communityModerationLog.create({
        data: {
          courseId: report.courseId,
          postId: report.postId,
          commentId: report.commentId,
          actorId: adminId,
          actorRole: 'ADMIN',
          action: parsed.removeTarget ? 'RESOLVE_REPORT_REMOVE_TARGET' : `RESOLVE_REPORT_${parsed.status}`,
          reason: parsed.resolutionNotes ?? report.reason,
        },
      });

      return nextReport;
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'COMMUNITY_REPORT_RESOLVED',
      entityType: 'CommunityReport',
      entityId: report.id,
      metadata: {
        status: parsed.status,
        removeTarget: parsed.removeTarget,
        courseId: report.courseId,
      },
      ipAddress: ip,
    });

    return updated;
  }

  // ============================================================
  // SUBSCRIBERS QUORA-STYLE Q&A COMMUNITY (/community)
  // ============================================================

  async resolveSubscriberCommunityAccess(
    user?:
      | (Pick<AuthenticatedContextUser, 'id' | 'role'> &
          Partial<Pick<AuthenticatedContextUser, 'roles'>>)
      | null,
  ) {
    if (!user) {
      return {
        canParticipate: false,
        reasonAr: 'سجّل الدخول بحساب مشترك لطرح الأسئلة والإجابة والتصويت',
      };
    }
    if (isAdminRole(user.role, user.roles) || hasAnyRole(['INSTRUCTOR'], user.role, user.roles)) {
      return {
        canParticipate: true,
        reasonAr: 'حسابك يملك صلاحية المشاركة والإجابة المعتمدة في مجتمع المشتركين',
      };
    }

    const [activeSubs, directPurchases] = await Promise.all([
      this.membership.getUserActiveSubscriptionsWithEntitlements(user.id),
      this.membership.getUserDirectPurchasedEntitlements(user.id),
    ]);

    const hasAccess = activeSubs.length > 0 || directPurchases.purchases.length > 0;
    return {
      canParticipate: hasAccess,
      reasonAr: hasAccess
        ? 'عضويتك نشطة — يمكنك طرح الأسئلة والرد على الزملاء والمدربين'
        : 'مجتمع الأسئلة والأجوبة مخصص للمشتركين في الباقات الشهرية/السنوية أو المشتركين في دورة/برنامج مستقل',
    };
  }

  private async requireSubscriberParticipation(
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    const access = await this.resolveSubscriberCommunityAccess(user);
    if (!access.canParticipate) {
      throw new ForbiddenException(access.reasonAr);
    }
    return access;
  }

  async listSubscriberQuestions(
    user: Pick<AuthenticatedContextUser, 'id' | 'role'> | null,
    params: { topic?: string; filter?: string; search?: string } = {},
  ) {
    const access = await this.resolveSubscriberCommunityAccess(user);
    const where: any = { deletedAt: null };

    if (params.topic && params.topic !== 'all') {
      where.topicAr = params.topic;
    }
    if (params.filter === 'resolved') {
      where.isResolved = true;
    } else if (params.filter === 'unanswered') {
      where.answerCount = 0;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { titleAr: { contains: q, mode: 'insensitive' } },
        { bodyAr: { contains: q, mode: 'insensitive' } },
        { topicAr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      params.filter === 'top'
        ? [{ upvoteCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const [questions, myVotes] = await Promise.all([
      this.prisma.subscriberQuestion.findMany({
        where,
        include: {
          author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
          course: {
            select: {
              id: true,
              slug: true,
              publishedVersion: { select: { titleAr: true } },
            },
          },
          acceptedAnswer: {
            include: {
              author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
            },
          },
          answers: {
            where: { deletedAt: null },
            orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'asc' }],
            take: 3,
            include: {
              author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
            },
          },
        },
        orderBy,
        take: 40,
      }),
      user
        ? this.prisma.subscriberVote.findMany({
            where: { userId: user.id },
            select: { questionId: true, answerId: true },
          })
        : Promise.resolve([]),
    ]);

    const votedQuestionSet = new Set(myVotes.filter((v) => v.questionId).map((v) => v.questionId!));
    const votedAnswerSet = new Set(myVotes.filter((v) => v.answerId).map((v) => v.answerId!));

    return {
      access,
      topics: [
        'عام',
        'إدارة مزارع الدواجن',
        'التغذية وصياغة العلائق',
        'الأمان الحيوي والأمراض',
        'التسويق والمبيعات البيطرية',
        'إنتاج الماشية والألبان',
      ],
      items: questions.map((q) => ({
        ...q,
        courseTitleAr: q.course?.publishedVersion?.titleAr ?? null,
        viewerHasUpvoted: votedQuestionSet.has(q.id),
        answers: q.answers.map((a) => ({
          ...a,
          viewerHasUpvoted: votedAnswerSet.has(a.id),
        })),
      })),
    };
  }

  async getSubscriberQuestionDetail(
    questionId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'> | null,
  ) {
    const [access, q, myVotes] = await Promise.all([
      this.resolveSubscriberCommunityAccess(user),
      this.prisma.subscriberQuestion.findUnique({
        where: { id: questionId },
        include: {
          author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
          course: {
            select: {
              id: true,
              slug: true,
              publishedVersion: { select: { titleAr: true } },
            },
          },
          answers: {
            where: { deletedAt: null },
            orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'asc' }],
            include: {
              author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
            },
          },
        },
      }),
      user
        ? this.prisma.subscriberVote.findMany({
            where: { userId: user.id },
            select: { questionId: true, answerId: true },
          })
        : Promise.resolve([]),
    ]);

    if (!q || q.deletedAt) {
      throw new NotFoundException('السؤال غير موجود');
    }

    const votedQuestionSet = new Set(myVotes.filter((v) => v.questionId).map((v) => v.questionId!));
    const votedAnswerSet = new Set(myVotes.filter((v) => v.answerId).map((v) => v.answerId!));

    return {
      access,
      question: {
        ...q,
        courseTitleAr: q.course?.publishedVersion?.titleAr ?? null,
        viewerHasUpvoted: votedQuestionSet.has(q.id),
        answers: q.answers.map((a) => ({
          ...a,
          viewerHasUpvoted: votedAnswerSet.has(a.id),
        })),
      },
    };
  }

  async createSubscriberQuestion(
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
    rawInput: unknown,
    ip?: string,
  ) {
    await this.requireSubscriberParticipation(user);
    const parsed = subscriberQuestionCreateSchema.parse(rawInput);

    const created = await this.prisma.subscriberQuestion.create({
      data: {
        authorId: user.id,
        topicAr: parsed.topicAr || 'عام',
        titleAr: parsed.titleAr,
        bodyAr: parsed.bodyAr,
        courseId: parsed.courseId || null,
      },
      include: {
        author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'SUBSCRIBER_QUESTION_CREATED',
      entityType: 'SubscriberQuestion',
      entityId: created.id,
      metadata: { topicAr: created.topicAr, titleAr: created.titleAr },
      ipAddress: ip,
    });

    return created;
  }

  async createSubscriberAnswer(
    questionId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'> &
      Partial<Pick<AuthenticatedContextUser, 'roles'>>,
    rawInput: unknown,
    ip?: string,
  ) {
    await this.requireSubscriberParticipation(user);
    const parsed = subscriberAnswerCreateSchema.parse(rawInput);

    const q = await this.prisma.subscriberQuestion.findUnique({
      where: { id: questionId },
    });
    if (!q || q.deletedAt) {
      throw new NotFoundException('السؤال غير موجود');
    }

    const answer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscriberAnswer.create({
        data: {
          questionId: q.id,
          authorId: user.id,
          bodyAr: parsed.bodyAr,
        },
        include: {
          author: { select: PUBLIC_COMMUNITY_AUTHOR_SELECT },
        },
      });

      await tx.subscriberQuestion.update({
        where: { id: q.id },
        data: {
          answerCount: { increment: 1 },
          ...(hasAnyRole(['INSTRUCTOR'], user.role, user.roles) || isAdminRole(user.role, user.roles)
            ? { isResolved: true, acceptedAnswerId: q.acceptedAnswerId ?? created.id }
            : {}),
        },
      });

      return created;
    });

    if (q.authorId !== user.id) {
      await this.prisma.notification
        .create({
          data: {
            userId: q.authorId,
            type: 'SUBSCRIBER_QUESTION_ANSWERED',
            titleAr: 'إجابة جديدة على سؤالك في مجتمع المشتركين',
            bodyAr: `أضاف ${answer.author.fullName} إجابة على سؤالك: "${q.titleAr}"`,
            actionUrl: `/community?question=${q.id}`,
            dedupKey: `sub_ans_${answer.id}`,
          },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role as any,
      action: 'SUBSCRIBER_ANSWER_CREATED',
      entityType: 'SubscriberAnswer',
      entityId: answer.id,
      metadata: { questionId: q.id },
      ipAddress: ip,
    });

    return answer;
  }

  async toggleSubscriberQuestionUpvote(
    questionId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    await this.requireSubscriberParticipation(user);
    const q = await this.prisma.subscriberQuestion.findUnique({ where: { id: questionId } });
    if (!q || q.deletedAt) throw new NotFoundException('السؤال غير موجود');

    const existing = await this.prisma.subscriberVote.findUnique({
      where: { userId_questionId: { userId: user.id, questionId } },
    });

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.subscriberVote.delete({ where: { id: existing.id } }),
        this.prisma.subscriberQuestion.update({
          where: { id: questionId },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);
      return { upvoted: false, upvoteCount: Math.max(0, updated.upvoteCount) };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.subscriberVote.create({
        data: { userId: user.id, questionId },
      }),
      this.prisma.subscriberQuestion.update({
        where: { id: questionId },
        data: { upvoteCount: { increment: 1 } },
      }),
    ]);
    return { upvoted: true, upvoteCount: updated.upvoteCount };
  }

  async toggleSubscriberAnswerUpvote(
    answerId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'>,
  ) {
    await this.requireSubscriberParticipation(user);
    const ans = await this.prisma.subscriberAnswer.findUnique({ where: { id: answerId } });
    if (!ans || ans.deletedAt) throw new NotFoundException('الإجابة غير موجودة');

    const existing = await this.prisma.subscriberVote.findUnique({
      where: { userId_answerId: { userId: user.id, answerId } },
    });

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.subscriberVote.delete({ where: { id: existing.id } }),
        this.prisma.subscriberAnswer.update({
          where: { id: answerId },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);
      return { upvoted: false, upvoteCount: Math.max(0, updated.upvoteCount) };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.subscriberVote.create({
        data: { userId: user.id, answerId },
      }),
      this.prisma.subscriberAnswer.update({
        where: { id: answerId },
        data: { upvoteCount: { increment: 1 } },
      }),
    ]);
    return { upvoted: true, upvoteCount: updated.upvoteCount };
  }

  async acceptSubscriberAnswer(
    questionId: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'> &
      Partial<Pick<AuthenticatedContextUser, 'roles'>>,
    answerId: string | null,
  ) {
    const q = await this.prisma.subscriberQuestion.findUnique({ where: { id: questionId } });
    if (!q || q.deletedAt) throw new NotFoundException('السؤال غير موجود');

    if (
      q.authorId !== user.id &&
      !isAdminRole(user.role, user.roles) &&
      !hasAnyRole(['INSTRUCTOR'], user.role, user.roles)
    ) {
      throw new ForbiddenException('اعتماد الإجابة متاح لصاحب السؤال أو المدربين أو الإدارة');
    }

    const updated = await this.prisma.subscriberQuestion.update({
      where: { id: questionId },
      data: {
        acceptedAnswerId: answerId,
        isResolved: Boolean(answerId),
      },
    });
    return updated;
  }
}
