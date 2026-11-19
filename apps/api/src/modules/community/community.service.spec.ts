import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommunityAccessService } from './community-access.service';
import { CommunityService } from './community.service';

describe('CommunityAccessService & CommunityService (Unit)', () => {
  it('enforces per-user rate limit and returns HTTP 429 when exceeded', async () => {
    const prisma = {} as any;
    const membership = {} as any;
    const redis = {
      incrementRateLimit: vi
        .fn()
        .mockResolvedValueOnce({ count: 1, ttlSeconds: 600 })
        .mockResolvedValueOnce({ count: 99, ttlSeconds: 420 }),
    } as any;

    const access = new CommunityAccessService(prisma, membership, redis);

    await expect(access.enforceRateLimit('user-1', 'post')).resolves.toBeUndefined();
    await expect(access.enforceRateLimit('user-1', 'post')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    await expect(
      access.enforceRateLimit('user-1', 'post').catch((err) => {
        expect(err).toBeInstanceOf(HttpException);
        throw err;
      }),
    ).rejects.toBeDefined();
  });

  it('serializes author strictly without PII and marks course instructor badge accurately', () => {
    const access = new CommunityAccessService({} as any, {} as any, {} as any);

    const studentView = access.serializeAuthor(
      {
        id: 'stu-1',
        fullName: 'طالب مجتهد',
        avatarUrl: null,
        headlineAr: 'رقم هاتف خاص لا يجب ظهوره',
        role: 'STUDENT',
      },
      'inst-owner',
    );
    expect(studentView).toEqual({
      id: 'stu-1',
      fullName: 'طالب مجتهد',
      avatarUrl: null,
      headlineAr: null,
      isCourseInstructor: false,
      isAdminModerator: false,
    });

    const ownerInstructorView = access.serializeAuthor(
      {
        id: 'inst-owner',
        fullName: 'د/ الحسيني داود',
        avatarUrl: '/images/brand/instructor-1.webp',
        headlineAr: 'خبير إدارة مزارع الدواجن',
        role: 'INSTRUCTOR',
      },
      'inst-owner',
    );
    expect(ownerInstructorView.isCourseInstructor).toBe(true);
    expect(ownerInstructorView.isAdminModerator).toBe(false);
    expect(ownerInstructorView.headlineAr).toBe('خبير إدارة مزارع الدواجن');
  });

  it('prevents an instructor from re-enabling a community locked by adminDisabled or editing another instructor course', async () => {
    const prisma = {
      course: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'course-1',
            instructorId: 'inst-a',
            communitySettings: { adminDisabled: true, isEnabled: false },
          })
          .mockResolvedValueOnce({
            id: 'course-2',
            instructorId: 'inst-b',
            communitySettings: { adminDisabled: false, isEnabled: true },
          }),
      },
    } as any;

    const service = new CommunityService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      { log: vi.fn() } as any,
    );

    await expect(
      service.updateCourseSettingsByInstructor('inst-a', 'course-1', { isEnabled: true }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.updateCourseSettingsByInstructor('inst-a', 'course-2', { isEnabled: false }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects negative or out-of-bounds video timestamps on lesson-linked questions', async () => {
    const access = {
      requireCourseCommunityAccess: vi.fn().mockResolvedValue({
        course: {
          id: 'course-1',
          slug: 'poultry',
          status: 'PUBLISHED',
          isFree: false,
          instructorId: 'inst-1',
          publishedVersionId: 'ver-1',
          titleAr: 'كورس دواجن',
        },
        settings: { isEnabled: true, adminDisabled: false, allowStudentDiscussions: true },
        decision: {
          allowed: true,
          reason: 'ALLOWED',
          messageAr: 'ok',
          canModerate: false,
          canPost: true,
          canAcceptAnswer: false,
          isInstructorOwner: false,
          isAdmin: false,
        },
      }),
      enforceRateLimit: vi.fn().mockResolvedValue(undefined),
    } as any;

    const prisma = {
      lesson: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'lesson-1',
          stableKey: 'l-1',
          titleAr: 'درس 1',
          type: 'VIDEO',
          videoAssetId: 'vid-1',
          durationSeconds: 120,
          videoAsset: { id: 'vid-1', durationSeconds: 120, status: 'READY' },
          section: { courseVersionId: 'ver-1', courseVersion: { id: 'ver-1', courseId: 'course-1', status: 'PUBLISHED' } },
        }),
      },
    } as any;

    const service = new CommunityService(
      prisma,
      access,
      {} as any,
      { dispatchCommunityNotifications: vi.fn() } as any,
      { log: vi.fn() } as any,
    );

    await expect(
      service.createPost(
        'course-1',
        { id: 'stu-1', role: 'STUDENT', fullName: 'طالب' },
        {
          lessonId: 'lesson-1',
          type: 'QUESTION',
          title: 'سؤال عن التهوية في الدقيقة الثالثة',
          body: 'هل سرعة الهواء مناسبة في الدقيقة 180؟',
          videoTimestampSeconds: 200,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
