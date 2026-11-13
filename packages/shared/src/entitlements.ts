import type { EditorialStatus, SubscriptionStatus, VideoQualityProfile } from './enums';

export interface CourseAccessInput {
  isCoursePublished: boolean;
  isCourseFree: boolean;
  isLessonFreePreview: boolean;
  isAdmin: boolean;
  isCourseOwnerInstructor: boolean;
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
    | 'ACTIVE_MEMBERSHIP'
    | 'UNPUBLISHED'
    | 'SUBSCRIPTION_REQUIRED';
}

/**
 * Pure reusable entitlement decision engine.
 * Separates publication visibility, free access, instructor ownership, and active membership entitlement.
 */
export function evaluateCourseAccess(input: CourseAccessInput): CourseAccessDecision {
  if (input.isAdmin) {
    return { allowed: true, reason: 'ADMIN' };
  }
  if (input.isCourseOwnerInstructor) {
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
