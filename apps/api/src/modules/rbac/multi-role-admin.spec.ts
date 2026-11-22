import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from '../admin/admin.service';
import { CommunityAccessService } from '../community/community-access.service';
import { InstructorService } from '../instructor/instructor.service';
import { MembershipService } from '../membership/membership.service';
import { VideoService } from '../video/video.service';

describe('F-06: Multi-role ADMIN & SUPER_ADMIN privilege resolution (TDD)', () => {
  it('MembershipService.checkCourseAccessForUser grants access to SUPER_ADMIN and secondary-role ADMIN', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-paid',
          status: 'PUBLISHED',
          isFree: false,
          includedInMembership: false,
          instructorId: 'inst-1',
          publishedVersionId: 'ver-1',
        }),
      },
      subscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      directPurchase: { findMany: vi.fn().mockResolvedValue([]) },
      learningPathCourse: { findMany: vi.fn().mockResolvedValue([]) },
      diplomaCourse: { findMany: vi.fn().mockResolvedValue([]) },
      courseInstructorAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    const membership = new MembershipService(prisma, {} as any, {} as any);

    const superAdminAccess = await membership.checkCourseAccessForUser({
      userId: 'sa-1',
      userRole: 'SUPER_ADMIN',
      courseId: 'course-paid',
    });
    expect(superAdminAccess.allowed).toBe(true);

    const secondaryAdminAccess = await membership.checkCourseAccessForUser({
      userId: 'sec-admin-1',
      userRole: 'STUDENT',
      userRoles: ['STUDENT', 'ADMIN'],
      courseId: 'course-paid',
    } as any);
    expect(secondaryAdminAccess.allowed).toBe(true);
  });

  it('InstructorService.getCourseDetail allows SUPER_ADMIN and secondary-role ADMIN on another instructor course', async () => {
    const courseRecord = {
      id: 'course-1',
      instructorId: 'inst-other',
      category: null,
      instructor: { id: 'inst-other', fullName: 'مدرب آخر', headlineAr: null },
      draftVersion: null,
      publishedVersion: null,
      editorialReviews: [],
    };
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(courseRecord),
      },
    } as any;
    const svc = new InstructorService(prisma, { log: vi.fn() } as any, {} as any);

    await expect(
      svc.getCourseDetail('sa-1', 'course-1', 'SUPER_ADMIN'),
    ).resolves.toMatchObject({ id: 'course-1' });

    await expect(
      (svc.getCourseDetail as any)('sec-admin-1', 'course-1', 'STUDENT', ['STUDENT', 'ADMIN']),
    ).resolves.toMatchObject({ id: 'course-1' });
  });

  it('VideoService.initiateUpload allows SUPER_ADMIN and secondary-role ADMIN on another instructor course', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-video-test-'));
    const tempFile = path.join(tmpDir, 'vs-1.part');
    const createSession = vi.fn().mockResolvedValue({
      id: 'vs-1',
      totalChunks: 1,
      chunkSizeBytes: 1024,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const prisma = {
      videoAsset: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { sourceSizeBytes: 0n, hlsTotalBytes: 0n } }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({ id: 'course-1', instructorId: 'inst-other' }),
      },
      videoUploadSession: { create: createSession },
    } as any;
    const storage = {
      ensureDirectories: vi.fn().mockResolvedValue(undefined),
      resolveSafeSubpath: vi.fn().mockReturnValue(tempFile),
    } as any;

    const video = new VideoService(prisma, {} as any, storage, {} as any, { log: vi.fn() } as any);

    try {
      await expect(
        video.initiateUpload({
          instructorId: 'sa-1',
          userRole: 'SUPER_ADMIN',
          courseId: 'course-1',
          titleAr: 'فيديو تجريبي',
          filename: 'lesson.mp4',
          mimeType: 'video/mp4',
          totalBytes: 1024,
        }),
      ).resolves.toMatchObject({ sessionId: 'vs-1' });

      await expect(
        video.initiateUpload({
          instructorId: 'sec-admin-1',
          userRole: 'STUDENT',
          userRoles: ['STUDENT', 'ADMIN'],
          courseId: 'course-1',
          titleAr: 'فيديو تجريبي 2',
          filename: 'lesson2.mp4',
          mimeType: 'video/mp4',
          totalBytes: 1024,
        }),
      ).resolves.toMatchObject({ sessionId: 'vs-1' });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('AdminService.createCourse accepts SUPER_ADMIN or secondary-role INSTRUCTOR as course owner', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'c-new', slug: 'super-course' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sa-owner',
          role: 'SUPER_ADMIN',
        }),
      },
      userRoleAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      courseVersion: { create: vi.fn().mockResolvedValue({ id: 'v-new' }) },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          course: {
            create: vi.fn().mockResolvedValue({ id: 'c-new', slug: 'super-course' }),
            update: vi.fn().mockResolvedValue({ id: 'c-new', slug: 'super-course', draftVersionId: 'v-new' }),
          },
          programFinancialAccount: { create: vi.fn().mockResolvedValue({ id: 'pfa-1' }) },
          courseVersion: { create: vi.fn().mockResolvedValue({ id: 'v-new' }) },
        }),
      ),
    } as any;

    const admin = new AdminService(prisma, { log: vi.fn() } as any, {} as any);

    await expect(
      admin.createCourse('sa-owner', {
        slug: 'super-course',
        titleAr: 'دورة تربية الدواجن',
        descriptionAr: 'دورة تدريبية شاملة في إدارة مزارع الدواجن',
        instructorId: 'sa-owner',
      }),
    ).resolves.toMatchObject({ id: 'c-new' });
  });

  it('CommunityAccessService.serializeAuthor marks SUPER_ADMIN as admin moderator', () => {
    const access = new CommunityAccessService({} as any, {} as any, {} as any);
    const serialized = access.serializeAuthor(
      {
        id: 'sa-1',
        fullName: 'المدير العام',
        avatarUrl: null,
        headlineAr: 'مدير المنصة',
        role: 'SUPER_ADMIN',
      },
      'inst-1',
    );
    expect(serialized.isAdminModerator).toBe(true);
    expect(serialized.headlineAr).toBe('مدير المنصة');
  });
});
