import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EditorialStatus } from '@bosla/db';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class EditorialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getReviewQueue(statusFilter?: EditorialStatus) {
    return this.prisma.courseVersion.findMany({
      where: {
        status: statusFilter ?? { in: ['SUBMITTED_FOR_REVIEW', 'APPROVED', 'CHANGES_REQUESTED'] },
      },
      include: {
        course: {
          include: {
            category: true,
            instructor: { select: { id: true, fullName: true, email: true, phoneE164: true } },
          },
        },
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: {
                videoAsset: { select: { id: true, status: true, durationSeconds: true } },
              },
            },
          },
        },
        editorialLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, fullName: true, role: true } } },
        },
      },
      orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async reviewVersion(params: {
    versionId: string;
    adminId: string;
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
    comment: string;
  }) {
    const version = await this.prisma.courseVersion.findUnique({
      where: { id: params.versionId },
      include: { course: true },
    });
    if (!version) throw new NotFoundException('إصدار الكورس غير موجود');

    if (version.status !== 'SUBMITTED_FOR_REVIEW') {
      throw new BadRequestException('يمكن مراجعة الإصدارات المرسلة للمراجعة فقط');
    }

    const nextVersionStatus: EditorialStatus =
      params.decision === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED';

    await this.prisma.$transaction(async (db) => {
      await db.courseVersion.update({
        where: { id: version.id },
        data: {
          status: nextVersionStatus,
          reviewedById: params.adminId,
          reviewedAt: new Date(),
          reviewNotes: params.comment,
        },
      });

      // Keep Course status as PUBLISHED if an earlier revision is already live, otherwise mirror review decision
      if (!version.course.publishedVersionId) {
        await db.course.update({
          where: { id: version.courseId },
          data: { status: nextVersionStatus },
        });
      }

      await db.editorialReviewLog.create({
        data: {
          courseId: version.courseId,
          courseVersionId: version.id,
          fromStatus: version.status,
          toStatus: nextVersionStatus,
          actorId: params.adminId,
          comment: params.comment,
        },
      });
    });

    await this.audit.log({
      actorId: params.adminId,
      actorRole: 'ADMIN',
      action: `COURSE_VERSION_${params.decision}`,
      entityType: 'CourseVersion',
      entityId: version.id,
      metadata: { courseId: version.courseId, comment: params.comment },
    });

    return this.prisma.courseVersion.findUnique({
      where: { id: version.id },
      include: { course: true },
    });
  }

  /**
   * Explicit ADMIN-only publish operation. Approval and publication are strictly separate.
   */
  async publishVersion(params: { versionId: string; adminId: string }) {
    const version = await this.prisma.courseVersion.findUnique({
      where: { id: params.versionId },
      include: { course: true },
    });
    if (!version) throw new NotFoundException('إصدار الكورس غير موجود');

    if (version.status !== 'APPROVED' && version.status !== 'UNPUBLISHED') {
      throw new BadRequestException(
        'يجب اعتماد الإصدار (APPROVED) من قبل الإدارة قبل إمكانية نشره',
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (db) => {
      await db.courseVersion.update({
        where: { id: version.id },
        data: {
          status: 'PUBLISHED',
          publishedById: params.adminId,
          publishedAt: now,
        },
      });

      await db.course.update({
        where: { id: version.courseId },
        data: {
          status: 'PUBLISHED',
          publishedVersionId: version.id,
          publishedAt: now,
          scheduledPublishAt: null,
        },
      });

      await db.editorialReviewLog.create({
        data: {
          courseId: version.courseId,
          courseVersionId: version.id,
          fromStatus: version.status,
          toStatus: 'PUBLISHED',
          actorId: params.adminId,
          comment: 'تم نشر الكورس للجمهور بواسطة الإدارة',
        },
      });
    });

    await this.audit.log({
      actorId: params.adminId,
      actorRole: 'ADMIN',
      action: 'COURSE_PUBLISHED',
      entityType: 'Course',
      entityId: version.courseId,
      metadata: { versionId: version.id, versionNumber: version.versionNumber },
    });

    return this.prisma.course.findUnique({
      where: { id: version.courseId },
      include: { publishedVersion: true, draftVersion: true },
    });
  }

  async unpublishCourse(courseId: string, adminId: string, reason?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    await this.prisma.$transaction(async (db) => {
      await db.course.update({
        where: { id: courseId },
        data: {
          status: 'UNPUBLISHED',
          unpublishedAt: new Date(),
        },
      });
      if (course.publishedVersionId) {
        await db.courseVersion.update({
          where: { id: course.publishedVersionId },
          data: { status: 'UNPUBLISHED' },
        });
        await db.editorialReviewLog.create({
          data: {
            courseId,
            courseVersionId: course.publishedVersionId,
            fromStatus: course.status,
            toStatus: 'UNPUBLISHED',
            actorId: adminId,
            comment: reason ?? 'تم إيقاف النشر بواسطة الإدارة',
          },
        });
      }
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'COURSE_UNPUBLISHED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { reason },
    });

    return this.prisma.course.findUnique({ where: { id: courseId } });
  }

  async scheduleCoursePublication(courseId: string, adminId: string, scheduledPublishAt: Date) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { draftVersion: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    if (course.draftVersion?.status !== 'APPROVED') {
      throw new BadRequestException('يجب اعتماد الإصدار قبل جدولة النشر');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { scheduledPublishAt },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'COURSE_PUBLISH_SCHEDULED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { scheduledPublishAt: scheduledPublishAt.toISOString() },
    });

    return updated;
  }

  /**
   * Called by worker/scheduler or cron to auto-publish APPROVED courses whose scheduledPublishAt <= now.
   */
  async processDueScheduledPublications() {
    const now = new Date();
    const dueCourses = await this.prisma.course.findMany({
      where: {
        scheduledPublishAt: { lte: now },
        draftVersion: { status: 'APPROVED' },
      },
      include: { draftVersion: true },
    });

    let publishedCount = 0;
    for (const c of dueCourses) {
      if (!c.draftVersion) continue;
      await this.publishVersion({
        versionId: c.draftVersion.id,
        adminId: c.draftVersion.reviewedById ?? c.instructorId,
      });
      publishedCount += 1;
    }

    return { publishedCount };
  }
}
