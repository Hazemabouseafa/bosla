import { randomBytes } from 'node:crypto';
import type { AuditService } from '../../core/audit.service';
import type { PrismaService } from '../../core/prisma.service';

export async function tryIssuePathAndDiplomaCertificates(params: {
  prisma: PrismaService;
  audit: AuditService;
  userId: string;
  onlyDiplomaId?: string;
}) {
  const { prisma, audit, userId, onlyDiplomaId } = params;

  const [user, completedRows, existingCerts, paths, diplomas] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.lessonProgress.findMany({
      where: { userId, isCompleted: true },
      select: { courseId: true, lessonStableKey: true },
    }),
    prisma.certificate.findMany({
      where: { userId, revokedAt: null },
      select: { targetType: true, learningPathId: true, diplomaId: true },
    }),
    onlyDiplomaId
      ? Promise.resolve([])
      : prisma.learningPath.findMany({
          where: { status: 'PUBLISHED' },
          include: {
            courses: {
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
    prisma.diploma.findMany({
      where: {
        ...(onlyDiplomaId ? { id: onlyDiplomaId } : { status: 'PUBLISHED' }),
      },
      include: {
        courses: {
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
        assessments: {
          include: {
            submissions: {
              where: { userId, passed: true },
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  if (!user) return [];

  const completedByCourse = new Map<string, Set<string>>();
  for (const row of completedRows) {
    if (!completedByCourse.has(row.courseId)) {
      completedByCourse.set(row.courseId, new Set());
    }
    completedByCourse.get(row.courseId)!.add(row.lessonStableKey);
  }

  const existingPathSet = new Set(
    existingCerts
      .filter((c) => c.targetType === 'LEARNING_PATH' && c.learningPathId)
      .map((c) => c.learningPathId!),
  );
  const existingDiplomaSet = new Set(
    existingCerts
      .filter((c) => c.targetType === 'DIPLOMA' && c.diplomaId)
      .map((c) => c.diplomaId!),
  );

  const hasCompletedCourse = (
    course: { publishedVersion?: { sections: Array<{ lessons: Array<{ stableKey: string }> }> } | null },
    courseId: string,
  ) => {
    const keys = course.publishedVersion?.sections.flatMap((s) => s.lessons.map((l) => l.stableKey)) ?? [];
    if (keys.length === 0) return false;
    const doneSet = completedByCourse.get(courseId);
    return Boolean(doneSet && keys.every((k) => doneSet.has(k)));
  };

  const issued: any[] = [];

  for (const lp of paths) {
    if (existingPathSet.has(lp.id)) continue;
    const required = lp.courses.filter((c) => c.isRequired);
    if (required.length === 0) continue;

    const allDone = required.every((c) => hasCompletedCourse(c.course, c.courseId));
    if (!allDone) continue;

    const code = `BOSLA-LP-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cert = await prisma.certificate.create({
      data: {
        userId,
        certificateCode: code,
        targetType: 'LEARNING_PATH',
        learningPathId: lp.id,
        recipientNameAr: user.fullName,
        titleAr: `شهادة إتمام المسار المهني: ${lp.titleAr}`,
      },
    });
    await audit.log({
      actorId: userId,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: code, targetType: 'LEARNING_PATH', learningPathId: lp.id },
    });
    issued.push(cert);
  }

  for (const dip of diplomas) {
    if (existingDiplomaSet.has(dip.id)) continue;
    const required = dip.courses.filter((c) => c.isRequired);
    if (required.length === 0 && dip.assessments.length === 0) continue;

    const allCoursesDone =
      required.length === 0 || required.every((c) => hasCompletedCourse(c.course, c.courseId));
    const hasPassedProject =
      dip.assessments.length === 0 ||
      dip.assessments.some((a) => a.submissions.length > 0);

    if (!allCoursesDone || !hasPassedProject) continue;

    const code = `BOSLA-DIP-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cert = await prisma.certificate.create({
      data: {
        userId,
        certificateCode: code,
        targetType: 'DIPLOMA',
        diplomaId: dip.id,
        recipientNameAr: user.fullName,
        titleAr: `شهادة إتمام الدبلومة التخصصية: ${dip.titleAr}`,
      },
    });
    await audit.log({
      actorId: userId,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'Certificate',
      entityId: cert.id,
      metadata: { certificateCode: code, targetType: 'DIPLOMA', diplomaId: dip.id },
    });
    issued.push(cert);
  }

  return issued;
}
