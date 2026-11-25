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

  const defaultAttendanceTpl = await prisma.certificateTemplate.findFirst({
    where: { kind: 'ATTENDANCE_COMPLETION', isDefault: true },
    select: { id: true },
  });

  for (const lp of paths) {
    if (existingPathSet.has(lp.id)) continue;
    const required = lp.courses.filter((c) => c.isRequired);
    if (required.length === 0) continue;

    const allDone = required.every((c) => hasCompletedCourse(c.course, c.courseId));
    if (!allDone) continue;

    const result = await prisma.$transaction(async (tx) => {
      const lockKey = `${userId}:LP:${lp.id}:ATTENDANCE_COMPLETION`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const already = await tx.certificate.findFirst({
        where: {
          userId,
          targetType: 'LEARNING_PATH',
          learningPathId: lp.id,
          revokedAt: null,
        },
      });
      if (already) return { cert: already, newlyCreated: false };

      const code = `BOSLA-LP-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const cert = await tx.certificate.create({
        data: {
          userId,
          certificateCode: code,
          kind: 'ATTENDANCE_COMPLETION',
          targetType: 'LEARNING_PATH',
          learningPathId: lp.id,
          templateId: defaultAttendanceTpl?.id ?? null,
          recipientNameAr: user.fullName,
          titleAr: `شهادة إتمام المسار المهني (شهادة حضور): ${lp.titleAr}`,
        },
      });
      return { cert, newlyCreated: true };
    });

    if (result.newlyCreated) {
      await audit.log({
        actorId: userId,
        action: 'CERTIFICATE_ISSUED',
        entityType: 'Certificate',
        entityId: result.cert.id,
        metadata: {
          certificateCode: result.cert.certificateCode,
          kind: 'ATTENDANCE_COMPLETION',
          targetType: 'LEARNING_PATH',
          learningPathId: lp.id,
        },
      });
      issued.push(result.cert);
    }
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
