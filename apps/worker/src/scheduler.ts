import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PrismaClient } from '@bosla/db';

export async function runScheduledTasks(params: {
  prisma: PrismaClient;
  uploadTmpDir?: string;
}) {
  const now = new Date();
  let publishedCourses = 0;
  let publishedPaths = 0;
  let cleanedUploads = 0;

  // 1. Publish approved courses whose scheduledPublishAt has elapsed
  const dueCourses = await params.prisma.course.findMany({
    where: {
      status: { not: 'PUBLISHED' },
      scheduledPublishAt: { lte: now },
      draftVersion: { status: 'APPROVED' },
    },
    include: { draftVersion: true },
  });

  for (const course of dueCourses) {
    if (!course.draftVersion) continue;
    await params.prisma.$transaction(async (tx) => {
      await tx.courseVersion.update({
        where: { id: course.draftVersion!.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      });
      await tx.course.update({
        where: { id: course.id },
        data: {
          status: 'PUBLISHED',
          publishedVersionId: course.draftVersion!.id,
          publishedAt: course.publishedAt ?? now,
          scheduledPublishAt: null,
        },
      });
    });
    publishedCourses += 1;
  }

  // 2. Publish approved learning paths whose scheduledPublishAt has elapsed
  const duePaths = await params.prisma.learningPath.findMany({
    where: {
      status: 'APPROVED',
      scheduledPublishAt: { lte: now },
    },
  });

  for (const lp of duePaths) {
    await params.prisma.learningPath.update({
      where: { id: lp.id },
      data: { status: 'PUBLISHED', publishedAt: now, scheduledPublishAt: null },
    });
    publishedPaths += 1;
  }

  // 3. Clean abandoned upload sessions older than expiry
  const mediaRoot = path.resolve(
    process.env.MEDIA_ROOT || path.resolve(process.cwd(), '../../storage/media'),
  );
  const uploadTmpDir = path.resolve(
    params.uploadTmpDir ||
      process.env.MEDIA_UPLOAD_TMP_DIR ||
      path.join(mediaRoot, 'uploads-tmp'),
  );

  const expiredUploads = await params.prisma.videoUploadSession.findMany({
    where: {
      status: { in: ['INITIATED', 'UPLOADING'] },
      expiresAt: { lt: now },
    },
    take: 50,
  });

  for (const session of expiredUploads) {
    const cleanRel = session.tempFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanRel.includes('..')) {
      await fs.rm(path.resolve(uploadTmpDir, cleanRel), { force: true }).catch(() => {});
    }
    await params.prisma.videoUploadSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    cleanedUploads += 1;
  }

  return { publishedCourses, publishedPaths, cleanedUploads };
}
