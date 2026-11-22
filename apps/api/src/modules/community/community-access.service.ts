import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@bosla/db';
import {
  evaluateCommunityAccess,
  hasAnyRole,
  isAdminRole,
  type CommunityAccessDecision,
} from '@bosla/shared';
import { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import { resolveEffectiveRoleForLegacyCheck } from '../../core/rbac-resolver';
import { RedisService } from '../../core/redis.service';
import { MembershipService } from '../membership/membership.service';

export const PUBLIC_COMMUNITY_AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  headlineAr: true,
  role: true,
} as const;

export interface ResolvedCommunityContext {
  course: {
    id: string;
    slug: string;
    status: string;
    isFree: boolean;
    instructorId: string;
    publishedVersionId: string | null;
    titleAr: string;
  };
  settings: {
    isEnabled: boolean;
    adminDisabled: boolean;
    allowStudentDiscussions: boolean;
  };
  decision: CommunityAccessDecision;
}

@Injectable()
export class CommunityAccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async resolveCourseAccess(
    courseIdOrSlug: string,
    user?:
      | (Pick<AuthenticatedContextUser, 'id' | 'role'> &
          Partial<Pick<AuthenticatedContextUser, 'roles'>>)
      | null,
  ): Promise<ResolvedCommunityContext> {
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: courseIdOrSlug }, { slug: courseIdOrSlug }],
      },
      select: {
        id: true,
        slug: true,
        status: true,
        isFree: true,
        instructorId: true,
        publishedVersionId: true,
        publishedVersion: { select: { titleAr: true } },
        draftVersion: { select: { titleAr: true } },
        communitySettings: true,
      },
    });

    if (!course) {
      throw new NotFoundException('الكورس غير موجود');
    }

    const settings = {
      isEnabled: course.communitySettings?.isEnabled ?? true,
      adminDisabled: course.communitySettings?.adminDisabled ?? false,
      allowStudentDiscussions: course.communitySettings?.allowStudentDiscussions ?? true,
    };

    const isCoursePublished =
      course.status === 'PUBLISHED' && Boolean(course.publishedVersionId);
    const isAdmin = Boolean(user) && isAdminRole(user!.role, user!.roles);
    const isInstructor = Boolean(user) && hasAnyRole(['INSTRUCTOR'], user!.role, user!.roles);
    const isCourseOwnerInstructor =
      Boolean(user) && course.instructorId === user!.id;
    const isCoInstructor =
      isInstructor &&
      !isCourseOwnerInstructor
        ? await this.membership.isUserAssignedInstructorForCourse(user!.id, course.id)
        : false;

    let activeSubscriptions: Array<{
      status: any;
      currentPeriodEnd: Date;
      entitledCourseIds: string[];
    }> = [];
    let directPurchasedCourseIds: string[] = [];
    let hasAnyExpiredMembership = false;
    let hasStartedCourse = false;

    if (user && !isAdmin && !isCourseOwnerInstructor && !isCoInstructor) {
      const [activeSubs, directEntitled, expiredSubCount, enrollment, progressCount, playbackCount] =
        await Promise.all([
          this.membership.getUserActiveSubscriptionsWithEntitlements(user.id),
          this.membership.getUserDirectPurchasedEntitlements(user.id),
          this.prisma.subscription.count({
            where: {
              userId: user.id,
              status: { in: ['EXPIRED', 'PAST_DUE', 'CANCELLED'] },
            },
          }),
          this.prisma.courseEnrollment.findUnique({
            where: { userId_courseId: { userId: user.id, courseId: course.id } },
            select: { id: true },
          }),
          this.prisma.lessonProgress.count({
            where: { userId: user.id, courseId: course.id },
          }),
          this.prisma.videoPlaybackLog.count({
            where: {
              userId: user.id,
              lesson: { section: { courseVersion: { courseId: course.id } } },
            },
          }),
        ]);

      activeSubscriptions = activeSubs.map((s) => ({
        status: s.subscription.status as any,
        currentPeriodEnd: s.subscription.currentPeriodEnd,
        entitledCourseIds: s.entitledCourseIds,
      }));
      directPurchasedCourseIds = directEntitled.courseIds;
      hasAnyExpiredMembership = expiredSubCount > 0;
      hasStartedCourse =
        Boolean(enrollment) || progressCount > 0 || playbackCount > 0;
    }

    const effectiveUserRole = user
      ? resolveEffectiveRoleForLegacyCheck({
          role: user.role,
          roles: user.roles ?? [user.role],
        })
      : null;

    const decision = evaluateCommunityAccess({
      isAuthenticated: Boolean(user),
      userRole: effectiveUserRole,
      isCourseOwnerInstructor,
      isCoInstructor,
      directPurchasedCourseIds,
      isCoursePublished,
      isCourseFree: course.isFree,
      isCommunityEnabled: settings.isEnabled,
      isAdminDisabled: settings.adminDisabled,
      activeSubscriptions,
      hasAnyExpiredMembership,
      hasStartedCourse,
      courseId: course.id,
    });

    return {
      course: {
        id: course.id,
        slug: course.slug,
        status: course.status,
        isFree: course.isFree,
        instructorId: course.instructorId,
        publishedVersionId: course.publishedVersionId,
        titleAr:
          course.publishedVersion?.titleAr ??
          course.draftVersion?.titleAr ??
          course.slug,
      },
      settings,
      decision,
    };
  }

  async requireCourseCommunityAccess(
    courseIdOrSlug: string,
    user: Pick<AuthenticatedContextUser, 'id' | 'role'> &
      Partial<Pick<AuthenticatedContextUser, 'roles'>>,
    options: { requireCanPost?: boolean; requireCanModerate?: boolean } = {},
  ): Promise<ResolvedCommunityContext> {
    const ctx = await this.resolveCourseAccess(courseIdOrSlug, user);
    if (!ctx.decision.allowed) {
      throw new ForbiddenException({
        code: ctx.decision.reason,
        message: ctx.decision.messageAr,
      });
    }
    if (options.requireCanPost && !ctx.decision.canPost) {
      throw new ForbiddenException({
        code: 'COMMUNITY_DISABLED',
        message: 'مجتمع هذا الكورس معطّل حاليًا ولا يقبل مشاركات جديدة',
      });
    }
    if (options.requireCanModerate && !ctx.decision.canModerate) {
      throw new ForbiddenException({
        code: 'MODERATION_FORBIDDEN',
        message: 'هذه الصلاحية متاحة لمدرب الكورس أو الإدارة فقط',
      });
    }
    return ctx;
  }

  async enforceRateLimit(
    userId: string,
    kind: 'post' | 'comment' | 'report',
  ): Promise<void> {
    const config =
      kind === 'post'
        ? { window: 600, limit: Number(process.env.COMMUNITY_POST_RATE_LIMIT || 25) }
        : kind === 'comment'
          ? { window: 600, limit: Number(process.env.COMMUNITY_COMMENT_RATE_LIMIT || 60) }
          : { window: 3600, limit: Number(process.env.COMMUNITY_REPORT_RATE_LIMIT || 20) };

    const { count, ttlSeconds } = await this.redis.incrementRateLimit(
      `community:${kind}:${userId}`,
      config.window,
    );

    if (count > config.limit) {
      throw new HttpException(
        {
          code: 'COMMUNITY_RATE_LIMITED',
          message: `تجاوزت الحد المسموح مؤقتًا. يرجى المحاولة بعد ${ttlSeconds} ثانية.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  serializeAuthor(
    author: {
      id: string;
      fullName: string;
      avatarUrl: string | null;
      headlineAr: string | null;
      role: string;
    },
    courseInstructorId: string,
  ) {
    const isCourseInstructor = author.id === courseInstructorId;
    const isAdminModerator = isAdminRole(author.role);
    return {
      id: author.id,
      fullName: author.fullName,
      avatarUrl: author.avatarUrl,
      headlineAr: isCourseInstructor || isAdminModerator ? author.headlineAr : null,
      isCourseInstructor,
      isAdminModerator,
    };
  }
}
