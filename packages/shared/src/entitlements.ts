import type { EditorialStatus, SubscriptionStatus, UserRole, VideoQualityProfile } from './enums';

export interface CourseAccessInput {
  isCoursePublished: boolean;
  isCourseFree: boolean;
  isLessonFreePreview: boolean;
  isAdmin: boolean;
  isCourseOwnerInstructor: boolean;
  isCoInstructor?: boolean;
  directPurchasedCourseIds?: string[];
  activeSubscriptions: Array<{
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    entitledCourseIds: string[];
  }>;
  courseId: string;
  now?: Date;
}

export interface CourseAccessDecision {
  allowed: boolean;
  reason:
    | 'ADMIN'
    | 'OWNER_INSTRUCTOR'
    | 'FREE_COURSE'
    | 'FREE_PREVIEW'
    | 'DIRECT_PURCHASE'
    | 'ACTIVE_MEMBERSHIP'
    | 'UNPUBLISHED'
    | 'SUBSCRIPTION_REQUIRED';
}

/**
 * Pure reusable entitlement decision engine.
 * Separates publication visibility, free access, instructor ownership, direct purchase, and active membership entitlement.
 */
export function evaluateCourseAccess(input: CourseAccessInput): CourseAccessDecision {
  if (input.isAdmin) {
    return { allowed: true, reason: 'ADMIN' };
  }
  if (input.isCourseOwnerInstructor || input.isCoInstructor) {
    return { allowed: true, reason: 'OWNER_INSTRUCTOR' };
  }
  if (!input.isCoursePublished) {
    return { allowed: false, reason: 'UNPUBLISHED' };
  }
  if (input.isCourseFree) {
    return { allowed: true, reason: 'FREE_COURSE' };
  }
  if (input.isLessonFreePreview) {
    return { allowed: true, reason: 'FREE_PREVIEW' };
  }
  if (input.directPurchasedCourseIds?.includes(input.courseId)) {
    return { allowed: true, reason: 'DIRECT_PURCHASE' };
  }

  const now = input.now ?? new Date();
  const hasEntitlement = input.activeSubscriptions.some(
    (sub) =>
      sub.status === 'ACTIVE' &&
      sub.currentPeriodEnd.getTime() > now.getTime() &&
      sub.entitledCourseIds.includes(input.courseId),
  );

  if (hasEntitlement) {
    return { allowed: true, reason: 'ACTIVE_MEMBERSHIP' };
  }

  return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED' };
}

/**
 * Computes deduplicated course IDs covered by a membership plan revision:
 * union of direct courses + courses linked through included learning paths + courses linked through included diplomas.
 */
export function resolvePlanCourseIds(params: {
  directCourseIds: string[];
  learningPathCourses: Array<{ learningPathId: string; courseId: string }>;
  includedPathIds: string[];
  diplomaCourses: Array<{ diplomaId: string; courseId: string }>;
  includedDiplomaIds: string[];
}): string[] {
  const set = new Set<string>(params.directCourseIds);
  const pathSet = new Set(params.includedPathIds);
  const diplomaSet = new Set(params.includedDiplomaIds);

  for (const link of params.learningPathCourses) {
    if (pathSet.has(link.learningPathId)) {
      set.add(link.courseId);
    }
  }
  for (const link of params.diplomaCourses) {
    if (diplomaSet.has(link.diplomaId)) {
      set.add(link.courseId);
    }
  }

  return Array.from(set);
}

/**
 * Never upscale low-resolution source videos unnecessarily.
 * Selects HLS variants <= sourceHeight from configured allowed qualities, always ensuring at least one playable variant.
 */
export function selectTranscodeQualities(
  sourceHeight: number,
  configuredQualities: VideoQualityProfile[] = ['480p', '720p', '1080p'],
): Array<{ name: VideoQualityProfile; height: number; videoBitrateKbps: number; audioBitrateKbps: number }> {
  const catalog: Record<
    VideoQualityProfile,
    { name: VideoQualityProfile; height: number; videoBitrateKbps: number; audioBitrateKbps: number }
  > = {
    '480p': { name: '480p', height: 480, videoBitrateKbps: 1000, audioBitrateKbps: 128 },
    '720p': { name: '720p', height: 720, videoBitrateKbps: 2400, audioBitrateKbps: 128 },
    '1080p': { name: '1080p', height: 1080, videoBitrateKbps: 4500, audioBitrateKbps: 192 },
  };

  const selected = configuredQualities
    .map((q) => catalog[q])
    .filter((profile) => profile && profile.height <= sourceHeight)
    .sort((a, b) => a.height - b.height);

  if (selected.length > 0) {
    return selected;
  }

  // If source video is smaller than 480p (e.g. 360p), preserve source height without upscaling.
  return [
    {
      name: '480p',
      height: Math.max(240, Math.min(480, sourceHeight)),
      videoBitrateKbps: 750,
      audioBitrateKbps: 96,
    },
  ];
}

export function isPubliclyVisibleStatus(status: EditorialStatus): boolean {
  return status === 'PUBLISHED';
}

export interface CommunityAccessInput {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  isCourseOwnerInstructor: boolean;
  isCoInstructor?: boolean;
  directPurchasedCourseIds?: string[];
  isCoursePublished: boolean;
  isCourseFree: boolean;
  isCommunityEnabled: boolean;
  isAdminDisabled: boolean;
  activeSubscriptions: Array<{
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    entitledCourseIds: string[];
  }>;
  hasAnyExpiredMembership: boolean;
  hasStartedCourse: boolean;
  courseId: string;
  now?: Date;
}

export type CommunityAccessDeniedReason =
  | 'NOT_AUTHENTICATED'
  | 'COURSE_UNPUBLISHED'
  | 'COMMUNITY_DISABLED'
  | 'UNASSIGNED_INSTRUCTOR'
  | 'MEMBERSHIP_EXPIRED'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'COURSE_NOT_ENTITLED'
  | 'NOT_ENROLLED';

export type CommunityAccessReason =
  | 'ADMIN'
  | 'OWNER_INSTRUCTOR'
  | 'ACTIVE_MEMBERSHIP_ENROLLED'
  | CommunityAccessDeniedReason;

export interface CommunityAccessDecision {
  allowed: boolean;
  canPost: boolean;
  canModerate: boolean;
  reason: CommunityAccessReason;
  messageAr: string;
}

/**
 * Unified server-shared course community entitlement policy.
 * Reuses evaluateCourseAccess and enforces all 6 student conditions plus instructor/admin RBAC.
 */
export function evaluateCommunityAccess(input: CommunityAccessInput): CommunityAccessDecision {
  if (!input.isAuthenticated || !input.userRole) {
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'NOT_AUTHENTICATED',
      messageAr: 'يلزم تسجيل الدخول للوصول إلى مجتمع الكورس وأسئلة الدروس',
    };
  }

  const communityEnabled = input.isCommunityEnabled && !input.isAdminDisabled;

  if (input.userRole === 'ADMIN' || (input.userRole as string) === 'SUPER_ADMIN') {
    return {
      allowed: true,
      canPost: communityEnabled,
      canModerate: true,
      reason: 'ADMIN',
      messageAr: communityEnabled
        ? 'صلاحية الإدارة الكاملة مفعّلة للمجتمع'
        : 'تم تعطيل هذا المجتمع حاليًا (وضع القراءة والإدارة متاح للأدمن)',
    };
  }

  if (input.userRole === 'INSTRUCTOR') {
    if (!input.isCourseOwnerInstructor && !input.isCoInstructor) {
      return {
        allowed: false,
        canPost: false,
        canModerate: false,
        reason: 'UNASSIGNED_INSTRUCTOR',
        messageAr: 'لا يمكنك الوصول إلى مجتمعات كورسات مدربين آخرين',
      };
    }

    return {
      allowed: true,
      canPost: communityEnabled,
      canModerate: true,
      reason: communityEnabled ? 'OWNER_INSTRUCTOR' : 'COMMUNITY_DISABLED',
      messageAr: communityEnabled
        ? 'صلاحية مدرب الكورس مفعّلة للمجتمع'
        : input.isAdminDisabled
          ? 'تم تعطيل مجتمع هذا الكورس من قبل الإدارة'
          : 'مجتمع هذا الكورس معطّل حاليًا',
    };
  }

  // Strictly enforce all 6 student requirements:
  // 1. Authenticated (above)
  // 5. Course is published
  if (!input.isCoursePublished) {
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'COURSE_UNPUBLISHED',
      messageAr: 'الكورس غير منشور حاليًا',
    };
  }

  // 6. Course community is enabled
  if (!communityEnabled) {
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'COMMUNITY_DISABLED',
      messageAr: 'مجتمع هذا الكورس معطّل حاليًا',
    };
  }

  // 2 & 3. Active academy membership OR direct purchase + entitlement to the course (never unlocked by free preview alone)
  const now = input.now ?? new Date();
  const hasDirectPurchase = Boolean(input.directPurchasedCourseIds?.includes(input.courseId));
  const liveActiveSubs = input.activeSubscriptions.filter(
    (sub) => sub.status === 'ACTIVE' && sub.currentPeriodEnd.getTime() > now.getTime(),
  );

  if (liveActiveSubs.length === 0 && !hasDirectPurchase) {
    if (input.hasAnyExpiredMembership) {
      return {
        allowed: false,
        canPost: false,
        canModerate: false,
        reason: 'MEMBERSHIP_EXPIRED',
        messageAr: 'انتهت صلاحية اشتراكك — جدد العضوية لاستعادة الوصول إلى مجتمع الكورس',
      };
    }
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'NO_ACTIVE_MEMBERSHIP',
      messageAr: 'يلزم اشتراك نشط في عضوية الأكاديمية أو شراء الكورس للوصول إلى مجتمع الكورس',
    };
  }

  const courseAccess = evaluateCourseAccess({
    isCoursePublished: input.isCoursePublished,
    isCourseFree: input.isCourseFree,
    isLessonFreePreview: false,
    isAdmin: false,
    isCourseOwnerInstructor: false,
    directPurchasedCourseIds: input.directPurchasedCourseIds,
    activeSubscriptions: liveActiveSubs,
    courseId: input.courseId,
    now,
  });

  if (!courseAccess.allowed) {
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'COURSE_NOT_ENTITLED',
      messageAr: 'خطتك الحالية لا تشمل الوصول إلى هذا الكورس ومجتمعه',
    };
  }

  // 4. Has enrolled in or started the course
  if (!input.hasStartedCourse) {
    return {
      allowed: false,
      canPost: false,
      canModerate: false,
      reason: 'NOT_ENROLLED',
      messageAr: 'يلزم التسجيل في الكورس أو بدء دراسته أولاً للوصول إلى مجتمع الكورس',
    };
  }

  return {
    allowed: true,
    canPost: true,
    canModerate: false,
    reason: 'ACTIVE_MEMBERSHIP_ENROLLED',
    messageAr: 'الوصول إلى مجتمع الكورس مفعّل',
  };
}
