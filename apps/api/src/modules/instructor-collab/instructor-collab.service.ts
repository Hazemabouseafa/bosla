import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  InstructorTaskPriority,
  InstructorTaskStatus,
  UserRole,
} from '@bosla/db';
import { z } from 'zod';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { IntegrationsMailService } from '../integrations-mail/integrations-mail.service';

const PRIORITY_LABELS_AR: Record<InstructorTaskPriority, string> = {
  LOW: 'منخفضة',
  MEDIUM: 'متوسطة',
  HIGH: 'مرتفعة',
  URGENT: 'عاجلة جداً',
};

const STATUS_LABELS_AR: Record<InstructorTaskStatus, string> = {
  TODO: 'بانتظار البدء',
  IN_PROGRESS: 'قيد التنفيذ',
  IN_REVIEW: 'جاهزة للمراجعة',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};

const createTaskSchema = z.object({
  titleAr: z.string().trim().min(2, 'عنوان المهمة مطلوب (حرفان على الأقل)').max(240),
  descriptionAr: z.string().trim().min(2, 'تفاصيل المهمة مطلوبة').max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueAt: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  courseId: z.string().trim().optional().nullable(),
  adminNotesAr: z.string().trim().max(4000).optional().nullable(),
  postToChat: z.boolean().optional().default(true),
});

const updateTaskByAdminSchema = z.object({
  titleAr: z.string().trim().min(2).max(240).optional(),
  descriptionAr: z.string().trim().min(2).max(4000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']).optional(),
  dueAt: z.string().optional().nullable(),
  courseId: z.string().trim().optional().nullable(),
  adminNotesAr: z.string().trim().max(4000).optional().nullable(),
});

const updateTaskByInstructorSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']),
  instructorNotesAr: z.string().trim().max(4000).optional().nullable(),
});

const sendChatMessageSchema = z.object({
  bodyAr: z.string().trim().min(1, 'نص الرسالة مطلوب').max(4000),
  taskId: z.string().trim().optional().nullable(),
  attachmentUrl: z.string().trim().max(1000).optional().nullable(),
});

function parseOptionalDate(val?: string | null): Date | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val.trim() === '') return null;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('تاريخ التسليم غير صالح');
  }
  return parsed;
}

@Injectable()
export class InstructorCollabService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional()
    @Inject(IntegrationsMailService)
    private readonly mailIntegrations?: IntegrationsMailService,
  ) {}

  private async dispatchCollabEmail(params: {
    dedupeKey: string;
    category: string;
    recipientEmail?: string | null;
    recipientName?: string | null;
    subjectAr: string;
    headlineAr: string;
    summaryAr: string;
    actionPath: string;
  }) {
    const email = (params.recipientEmail || '').trim();
    if (!email) {
      return {
        attempted: false,
        ok: false,
        status: 'SKIPPED_NO_EMAIL',
        warningAr: 'تم الحفظ في المنصة، لكن المستلم لا يمتلك بريداً إلكترونياً مسجلاً لاستلام تنبيه البريد.',
      };
    }

    if (!this.mailIntegrations) {
      return {
        attempted: false,
        ok: false,
        status: 'SKIPPED_NO_MAILER',
        warningAr: 'لم تُفعّل خدمة البريد في هذا السياق بعد.',
      };
    }

    const webOrigin = (process.env.WEB_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const actionUrl = `${webOrigin}${params.actionPath}`;

    const res = await this.mailIntegrations.dispatchEmail({
      dedupeKey: params.dedupeKey,
      category: params.category,
      recipientEmail: email,
      recipientName: params.recipientName ?? null,
      subjectAr: params.subjectAr,
      textAr: `${params.headlineAr}\n${params.summaryAr}\nرابط المتابعة: ${actionUrl}`,
      htmlAr: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0F172A; padding: 20px;">
          <h2 style="color: #1536B5;">${params.headlineAr}</h2>
          <p>${params.summaryAr}</p>
          <p style="margin: 18px 0;">
            <a href="${actionUrl}" style="background:#1536B5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
              فتح لوحة المتابعة
            </a>
          </p>
        </div>
      `,
    });

    return {
      attempted: true,
      ok: res.ok,
      status: res.status,
      warningAr: res.warningAr ?? null,
    };
  }

  private async ensureInstructorExists(instructorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        avatarUrl: true,
        headlineAr: true,
        bioAr: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('حساب المدرب غير موجود');
    }
    return user;
  }

  private formatCourseItem(c: {
    id: string;
    slug: string;
    status: string;
    publishedVersion?: { titleAr: string } | null;
    draftVersion?: { titleAr: string } | null;
  }) {
    return {
      id: c.id,
      slug: c.slug,
      status: c.status,
      titleAr:
        c.publishedVersion?.titleAr ||
        c.draftVersion?.titleAr ||
        c.slug,
    };
  }

  async getAdminOverview() {
    const instructors = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: 'INSTRUCTOR' },
          { assignedUserRoles: { some: { role: { code: 'INSTRUCTOR' } } } },
          { instructedCourses: { some: {} } },
          { programInstructorAssignments: { some: {} } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        avatarUrl: true,
        headlineAr: true,
        bioAr: true,
        createdAt: true,
        instructedCourses: {
          select: {
            id: true,
            slug: true,
            status: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
        programInstructorAssignments: {
          where: { courseId: { not: null } },
          select: {
            course: {
              select: {
                id: true,
                slug: true,
                status: true,
                publishedVersion: { select: { titleAr: true } },
                draftVersion: { select: { titleAr: true } },
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const instructorIds = instructors.map((i) => i.id);

    const [allTasks, allMessages] = await Promise.all([
      this.prisma.instructorTask.findMany({
        where: instructorIds.length > 0 ? { instructorId: { in: instructorIds } } : {},
        include: {
          instructor: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
          assignedBy: {
            select: { id: true, fullName: true, role: true },
          },
          course: {
            select: {
              id: true,
              slug: true,
              status: true,
              publishedVersion: { select: { titleAr: true } },
              draftVersion: { select: { titleAr: true } },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.instructorChatMessage.findMany({
        where: instructorIds.length > 0 ? { instructorId: { in: instructorIds } } : {},
        include: {
          sender: {
            select: { id: true, fullName: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const tasksByInstructor = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const list = tasksByInstructor.get(t.instructorId) ?? [];
      list.push(t);
      tasksByInstructor.set(t.instructorId, list);
    }

    const messagesByInstructor = new Map<string, typeof allMessages>();
    for (const m of allMessages) {
      const list = messagesByInstructor.get(m.instructorId) ?? [];
      list.push(m);
      messagesByInstructor.set(m.instructorId, list);
    }

    let totalUnreadMessages = 0;
    const instructorRoster = instructors.map((inst) => {
      const courseMap = new Map<
        string,
        { id: string; slug: string; status: string; titleAr: string }
      >();
      for (const c of inst.instructedCourses) {
        courseMap.set(c.id, this.formatCourseItem(c));
      }
      for (const a of inst.programInstructorAssignments) {
        if (a.course) {
          courseMap.set(a.course.id, this.formatCourseItem(a.course));
        }
      }

      const instTasks = tasksByInstructor.get(inst.id) ?? [];
      const instMsgs = messagesByInstructor.get(inst.id) ?? [];

      const unreadCount = instMsgs.filter(
        (m) => m.senderId === inst.id && m.readByAdminAt === null,
      ).length;
      totalUnreadMessages += unreadCount;

      const taskStats = {
        total: instTasks.length,
        todo: instTasks.filter((t) => t.status === 'TODO').length,
        inProgress: instTasks.filter((t) => t.status === 'IN_PROGRESS').length,
        inReview: instTasks.filter((t) => t.status === 'IN_REVIEW').length,
        completed: instTasks.filter((t) => t.status === 'COMPLETED').length,
        cancelled: instTasks.filter((t) => t.status === 'CANCELLED').length,
        urgentOpen: instTasks.filter(
          (t) =>
            t.priority === 'URGENT' &&
            t.status !== 'COMPLETED' &&
            t.status !== 'CANCELLED',
        ).length,
      };

      const latestMsg = instMsgs[0] ?? null;

      return {
        id: inst.id,
        fullName: inst.fullName,
        email: inst.email,
        phoneE164: inst.phoneE164,
        role: inst.role,
        status: inst.status,
        avatarUrl: inst.avatarUrl,
        headlineAr: inst.headlineAr,
        bioAr: inst.bioAr,
        createdAt: inst.createdAt,
        courses: Array.from(courseMap.values()),
        taskStats,
        unreadMessagesFromInstructor: unreadCount,
        lastMessage: latestMsg
          ? {
              id: latestMsg.id,
              bodyAr: latestMsg.bodyAr,
              senderId: latestMsg.senderId,
              isSystemTaskEvent: latestMsg.isSystemTaskEvent,
              createdAt: latestMsg.createdAt,
              sender: latestMsg.sender,
            }
          : null,
      };
    });

    const formattedTasks = allTasks.map((t) => ({
      ...t,
      course: t.course ? this.formatCourseItem(t.course) : null,
    }));

    const summary = {
      totalInstructors: instructorRoster.length,
      totalTasks: allTasks.length,
      openTasks: allTasks.filter(
        (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS',
      ).length,
      inReviewTasks: allTasks.filter((t) => t.status === 'IN_REVIEW').length,
      completedTasks: allTasks.filter((t) => t.status === 'COMPLETED').length,
      urgentOpenTasks: allTasks.filter(
        (t) =>
          t.priority === 'URGENT' &&
          t.status !== 'COMPLETED' &&
          t.status !== 'CANCELLED',
      ).length,
      totalUnreadMessages,
    };

    return {
      summary,
      instructors: instructorRoster,
      allTasks: formattedTasks,
    };
  }

  async getInstructorThreadForAdmin(instructorId: string) {
    const instructor = await this.ensureInstructorExists(instructorId);

    await this.prisma.instructorChatMessage.updateMany({
      where: {
        instructorId,
        senderId: instructorId,
        readByAdminAt: null,
      },
      data: {
        readByAdminAt: new Date(),
      },
    });

    const [coursesRaw, tasksRaw, messages] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          OR: [
            { instructorId },
            { instructorAssignments: { some: { instructorId } } },
          ],
        },
        select: {
          id: true,
          slug: true,
          status: true,
          publishedVersion: { select: { titleAr: true } },
          draftVersion: { select: { titleAr: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.instructorTask.findMany({
        where: { instructorId },
        include: {
          instructor: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
          assignedBy: {
            select: { id: true, fullName: true, role: true },
          },
          course: {
            select: {
              id: true,
              slug: true,
              status: true,
              publishedVersion: { select: { titleAr: true } },
              draftVersion: { select: { titleAr: true } },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.instructorChatMessage.findMany({
        where: { instructorId },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
          task: {
            select: {
              id: true,
              titleAr: true,
              status: true,
              priority: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      instructor,
      courses: coursesRaw.map((c) => this.formatCourseItem(c)),
      tasks: tasksRaw.map((t) => ({
        ...t,
        course: t.course ? this.formatCourseItem(t.course) : null,
      })),
      messages,
    };
  }

  async sendAdminMessage(
    adminUserId: string,
    adminRole: UserRole,
    instructorId: string,
    payload: unknown,
  ) {
    const parsed = sendChatMessageSchema.parse(payload);
    await this.ensureInstructorExists(instructorId);

    if (parsed.taskId) {
      const task = await this.prisma.instructorTask.findUnique({
        where: { id: parsed.taskId },
      });
      if (!task || task.instructorId !== instructorId) {
        throw new BadRequestException('المهمة المرفقة غير مرتبطة بهذا المدرب');
      }
    }

    const instructorProfile = await this.ensureInstructorExists(instructorId);

    const message = await this.prisma.instructorChatMessage.create({
      data: {
        instructorId,
        senderId: adminUserId,
        taskId: parsed.taskId || null,
        bodyAr: parsed.bodyAr,
        attachmentUrl: parsed.attachmentUrl || null,
        isSystemTaskEvent: false,
        readByAdminAt: new Date(),
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, avatarUrl: true },
        },
        task: {
          select: {
            id: true,
            titleAr: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    await this.prisma.notification
      .create({
        data: {
          userId: instructorId,
          type: 'INSTRUCTOR_CHAT_MESSAGE',
          titleAr: 'رسالة جديدة من الإدارة العليا',
          bodyAr: parsed.bodyAr.slice(0, 180),
          actionUrl: '/instructor?tab=collab',
          dedupKey: `inst_chat_admin_${message.id}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId: adminUserId,
      actorRole: adminRole,
      action: 'ADMIN_INSTRUCTOR_CHAT_MESSAGE_SENT',
      entityType: 'InstructorChatMessage',
      entityId: message.id,
      metadata: {
        instructorId,
        taskId: parsed.taskId || null,
      },
    });

    const emailDelivery = await this.dispatchCollabEmail({
      dedupeKey: `inst_chat_admin_mail_${message.id}`,
      category: 'INSTRUCTOR_CHAT_MESSAGE',
      recipientEmail: instructorProfile.email,
      recipientName: instructorProfile.fullName,
      subjectAr: 'رسالة جديدة من إدارة أكاديمية بوصلة',
      headlineAr: 'رسالة جديدة من الإدارة',
      summaryAr: parsed.bodyAr.slice(0, 400),
      actionPath: '/instructor?tab=collab',
    });

    return { ...message, emailDelivery };
  }

  async createTaskForInstructor(
    adminUserId: string,
    adminRole: UserRole,
    instructorId: string,
    payload: unknown,
  ) {
    const parsed = createTaskSchema.parse(payload);
    await this.ensureInstructorExists(instructorId);

    if (parsed.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: parsed.courseId },
        select: { id: true },
      });
      if (!course) {
        throw new BadRequestException('الدورة التدريبية المحددة غير موجودة');
      }
    }

    const dueAt = parseOptionalDate(parsed.dueAt) ?? null;

    const task = await this.prisma.instructorTask.create({
      data: {
        instructorId,
        assignedById: adminUserId,
        courseId: parsed.courseId || null,
        titleAr: parsed.titleAr,
        descriptionAr: parsed.descriptionAr,
        priority: parsed.priority,
        status: 'TODO',
        dueAt,
        adminNotesAr: parsed.adminNotesAr || null,
      },
      include: {
        instructor: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        assignedBy: {
          select: { id: true, fullName: true, role: true },
        },
        course: {
          select: {
            id: true,
            slug: true,
            status: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (parsed.postToChat !== false) {
      const dueStr = dueAt
        ? ` • الموعد النهائي: ${dueAt.toISOString().slice(0, 10)}`
        : '';
      await this.prisma.instructorChatMessage.create({
        data: {
          instructorId,
          senderId: adminUserId,
          taskId: task.id,
          bodyAr: `تم إسناد مهمة جديدة: "${task.titleAr}" — الأولوية: ${PRIORITY_LABELS_AR[task.priority]}${dueStr}`,
          isSystemTaskEvent: true,
          readByAdminAt: new Date(),
        },
      });
    }

    await this.prisma.notification
      .create({
        data: {
          userId: instructorId,
          type: 'INSTRUCTOR_TASK_ASSIGNED',
          titleAr: 'مهمة جديدة مسندة إليك من الإدارة العليا',
          bodyAr: `${task.titleAr} (الأولوية: ${PRIORITY_LABELS_AR[task.priority]})`,
          actionUrl: '/instructor?tab=collab',
          dedupKey: `inst_task_assigned_${task.id}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId: adminUserId,
      actorRole: adminRole,
      action: 'INSTRUCTOR_TASK_CREATED',
      entityType: 'InstructorTask',
      entityId: task.id,
      metadata: {
        instructorId,
        titleAr: task.titleAr,
        priority: task.priority,
        courseId: task.courseId,
      },
    });

    const emailDelivery = await this.dispatchCollabEmail({
      dedupeKey: `inst_task_assigned_mail_${task.id}`,
      category: 'INSTRUCTOR_TASK_ASSIGNED',
      recipientEmail: task.instructor.email,
      recipientName: task.instructor.fullName,
      subjectAr: `مهمة جديدة مسندة إليك: ${task.titleAr}`,
      headlineAr: `مهمة جديدة (${PRIORITY_LABELS_AR[task.priority]})`,
      summaryAr: `${task.titleAr} — ${task.descriptionAr.slice(0, 350)}`,
      actionPath: '/instructor?tab=collab',
    });

    return {
      ...task,
      course: task.course ? this.formatCourseItem(task.course) : null,
      emailDelivery,
    };
  }

  async updateTaskByAdmin(
    adminUserId: string,
    adminRole: UserRole,
    taskId: string,
    payload: unknown,
  ) {
    const parsed = updateTaskByAdminSchema.parse(payload);
    const existing = await this.prisma.instructorTask.findUnique({
      where: { id: taskId },
    });
    if (!existing) {
      throw new NotFoundException('المهمة غير موجودة');
    }

    const dueAt = parseOptionalDate(parsed.dueAt);
    const nextStatus = parsed.status ?? existing.status;
    const completedAt =
      nextStatus === 'COMPLETED'
        ? existing.completedAt ?? new Date()
        : nextStatus !== existing.status
          ? null
          : existing.completedAt;

    const updated = await this.prisma.instructorTask.update({
      where: { id: taskId },
      data: {
        ...(parsed.titleAr !== undefined ? { titleAr: parsed.titleAr } : {}),
        ...(parsed.descriptionAr !== undefined
          ? { descriptionAr: parsed.descriptionAr }
          : {}),
        ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
        ...(parsed.courseId !== undefined
          ? { courseId: parsed.courseId || null }
          : {}),
        ...(parsed.adminNotesAr !== undefined
          ? { adminNotesAr: parsed.adminNotesAr || null }
          : {}),
        completedAt,
      },
      include: {
        instructor: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        assignedBy: {
          select: { id: true, fullName: true, role: true },
        },
        course: {
          select: {
            id: true,
            slug: true,
            status: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (
      (parsed.status && parsed.status !== existing.status) ||
      (parsed.priority && parsed.priority !== existing.priority)
    ) {
      await this.prisma.instructorChatMessage.create({
        data: {
          instructorId: existing.instructorId,
          senderId: adminUserId,
          taskId: updated.id,
          bodyAr: `تحديث إداري للمهمة "${updated.titleAr}": الحالة (${STATUS_LABELS_AR[updated.status]}) • الأولوية (${PRIORITY_LABELS_AR[updated.priority]})`,
          isSystemTaskEvent: true,
          readByAdminAt: new Date(),
        },
      });

      await this.prisma.notification
        .create({
          data: {
            userId: existing.instructorId,
            type: 'INSTRUCTOR_TASK_UPDATED',
            titleAr: 'تحديث على مهمة مسندة إليك',
            bodyAr: `تم تحديث حالة المهمة "${updated.titleAr}" إلى: ${STATUS_LABELS_AR[updated.status]}`,
            actionUrl: '/instructor?tab=collab',
            dedupKey: `inst_task_admin_upd_${updated.id}_${Date.now()}`,
          },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: adminUserId,
      actorRole: adminRole,
      action: 'INSTRUCTOR_TASK_UPDATED_BY_ADMIN',
      entityType: 'InstructorTask',
      entityId: updated.id,
      metadata: {
        instructorId: updated.instructorId,
        status: updated.status,
        priority: updated.priority,
      },
    });

    const statusOrPriorityChanged =
      (parsed.status && parsed.status !== existing.status) ||
      (parsed.priority && parsed.priority !== existing.priority);

    const emailDelivery = statusOrPriorityChanged
      ? await this.dispatchCollabEmail({
          dedupeKey: `inst_task_admin_upd_mail_${updated.id}_${updated.updatedAt.getTime()}`,
          category: 'INSTRUCTOR_TASK_UPDATED',
          recipientEmail: updated.instructor.email,
          recipientName: updated.instructor.fullName,
          subjectAr: `تحديث على المهمة: ${updated.titleAr}`,
          headlineAr: `تحديث إداري للحالة: ${STATUS_LABELS_AR[updated.status]}`,
          summaryAr: `المهمة "${updated.titleAr}" — الحالة الحالية: ${STATUS_LABELS_AR[updated.status]} • الأولوية: ${PRIORITY_LABELS_AR[updated.priority]}`,
          actionPath: '/instructor?tab=collab',
        })
      : null;

    return {
      ...updated,
      course: updated.course ? this.formatCourseItem(updated.course) : null,
      ...(emailDelivery ? { emailDelivery } : {}),
    };
  }

  async deleteTaskByAdmin(
    adminUserId: string,
    adminRole: UserRole,
    taskId: string,
  ) {
    const existing = await this.prisma.instructorTask.findUnique({
      where: { id: taskId },
    });
    if (!existing) {
      throw new NotFoundException('المهمة غير موجودة');
    }

    await this.prisma.instructorTask.delete({
      where: { id: taskId },
    });

    await this.audit.log({
      actorId: adminUserId,
      actorRole: adminRole,
      action: 'INSTRUCTOR_TASK_DELETED_BY_ADMIN',
      entityType: 'InstructorTask',
      entityId: taskId,
      metadata: {
        instructorId: existing.instructorId,
        titleAr: existing.titleAr,
      },
    });

    return { deleted: true, id: taskId };
  }

  async getInstructorWorkspace(instructorId: string) {
    const [tasksRaw, messages, unreadMessages] = await Promise.all([
      this.prisma.instructorTask.findMany({
        where: { instructorId },
        include: {
          assignedBy: {
            select: { id: true, fullName: true, role: true },
          },
          course: {
            select: {
              id: true,
              slug: true,
              status: true,
              publishedVersion: { select: { titleAr: true } },
              draftVersion: { select: { titleAr: true } },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.instructorChatMessage.findMany({
        where: { instructorId },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, avatarUrl: true },
          },
          task: {
            select: {
              id: true,
              titleAr: true,
              status: true,
              priority: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.instructorChatMessage.count({
        where: {
          instructorId,
          senderId: { not: instructorId },
          readByInstructorAt: null,
        },
      }),
    ]);

    const tasks = tasksRaw.map((t) => ({
      ...t,
      course: t.course ? this.formatCourseItem(t.course) : null,
    }));

    const stats = {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === 'TODO').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      inReview: tasks.filter((t) => t.status === 'IN_REVIEW').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
      urgentOpen: tasks.filter(
        (t) =>
          t.priority === 'URGENT' &&
          t.status !== 'COMPLETED' &&
          t.status !== 'CANCELLED',
      ).length,
      unreadMessages,
    };

    return {
      stats,
      tasks,
      messages,
    };
  }

  async markMessagesReadByInstructor(instructorId: string) {
    const res = await this.prisma.instructorChatMessage.updateMany({
      where: {
        instructorId,
        senderId: { not: instructorId },
        readByInstructorAt: null,
      },
      data: {
        readByInstructorAt: new Date(),
      },
    });
    return { markedReadCount: res.count };
  }

  async sendInstructorMessage(
    instructorId: string,
    instructorRole: UserRole,
    payload: unknown,
  ) {
    const parsed = sendChatMessageSchema.parse(payload);
    const instructor = await this.ensureInstructorExists(instructorId);

    if (parsed.taskId) {
      const task = await this.prisma.instructorTask.findUnique({
        where: { id: parsed.taskId },
      });
      if (!task || task.instructorId !== instructorId) {
        throw new BadRequestException('المهمة المرفقة غير مرتبطة بحسابك');
      }
    }

    const message = await this.prisma.instructorChatMessage.create({
      data: {
        instructorId,
        senderId: instructorId,
        taskId: parsed.taskId || null,
        bodyAr: parsed.bodyAr,
        attachmentUrl: parsed.attachmentUrl || null,
        isSystemTaskEvent: false,
        readByInstructorAt: new Date(),
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, avatarUrl: true },
        },
        task: {
          select: {
            id: true,
            titleAr: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'ACADEMY_MANAGER'] },
      },
      select: { id: true },
      take: 15,
    });

    for (const adm of admins) {
      await this.prisma.notification
        .create({
          data: {
            userId: adm.id,
            type: 'INSTRUCTOR_CHAT_MESSAGE',
            titleAr: `رسالة جديدة من المدرب ${instructor.fullName}`,
            bodyAr: parsed.bodyAr.slice(0, 180),
            actionUrl: `/admin?tab=instructor_collab&instructorId=${instructorId}`,
            dedupKey: `inst_chat_to_adm_${message.id}_${adm.id}`,
          },
        })
        .catch(() => {});
    }

    await this.audit.log({
      actorId: instructorId,
      actorRole: instructorRole,
      action: 'INSTRUCTOR_CHAT_MESSAGE_SENT',
      entityType: 'InstructorChatMessage',
      entityId: message.id,
      metadata: {
        instructorId,
        taskId: parsed.taskId || null,
      },
    });

    const adminEmails = await this.prisma.user.findMany({
      where: {
        id: { in: admins.map((a) => a.id) },
        email: { not: null },
      },
      select: { email: true, fullName: true },
      take: 5,
    });
    for (const adm of adminEmails) {
      await this.dispatchCollabEmail({
        dedupeKey: `inst_chat_to_adm_mail_${message.id}_${adm.email}`,
        category: 'INSTRUCTOR_CHAT_MESSAGE',
        recipientEmail: adm.email,
        recipientName: adm.fullName,
        subjectAr: `رسالة جديدة من المدرب ${instructor.fullName}`,
        headlineAr: `رسالة جديدة من المدرب ${instructor.fullName}`,
        summaryAr: parsed.bodyAr.slice(0, 350),
        actionPath: `/admin/instructors/tasks?instructorId=${instructorId}`,
      });
    }

    return message;
  }

  async updateTaskStatusByInstructor(
    instructorId: string,
    instructorRole: UserRole,
    taskId: string,
    payload: unknown,
  ) {
    const parsed = updateTaskByInstructorSchema.parse(payload);
    const existing = await this.prisma.instructorTask.findUnique({
      where: { id: taskId },
      include: {
        instructor: { select: { id: true, fullName: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('المهمة غير موجودة');
    }

    const isAdminActor =
      instructorRole === 'ADMIN' ||
      instructorRole === 'SUPER_ADMIN' ||
      instructorRole === 'ACADEMY_MANAGER';

    if (existing.instructorId !== instructorId && !isAdminActor) {
      throw new ForbiddenException('لا تملك صلاحية تعديل هذه المهمة');
    }

    const completedAt =
      parsed.status === 'COMPLETED'
        ? existing.completedAt ?? new Date()
        : null;

    const updated = await this.prisma.instructorTask.update({
      where: { id: taskId },
      data: {
        status: parsed.status,
        ...(parsed.instructorNotesAr !== undefined
          ? { instructorNotesAr: parsed.instructorNotesAr || null }
          : {}),
        completedAt,
      },
      include: {
        assignedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        course: {
          select: {
            id: true,
            slug: true,
            status: true,
            publishedVersion: { select: { titleAr: true } },
            draftVersion: { select: { titleAr: true } },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const noteSuffix = parsed.instructorNotesAr
      ? ` — ملاحظات المدرب: ${parsed.instructorNotesAr}`
      : '';

    await this.prisma.instructorChatMessage.create({
      data: {
        instructorId: existing.instructorId,
        senderId: instructorId,
        taskId: updated.id,
        bodyAr: `قام المدرب بتحديث حالة المهمة "${updated.titleAr}" إلى (${STATUS_LABELS_AR[updated.status]})${noteSuffix}`,
        isSystemTaskEvent: true,
        readByInstructorAt: new Date(),
      },
    });

    await this.prisma.notification
      .create({
        data: {
          userId: existing.assignedById,
          type: 'INSTRUCTOR_TASK_UPDATED',
          titleAr: `تحديث مهمة من المدرب ${existing.instructor.fullName}`,
          bodyAr: `المهمة "${updated.titleAr}" أصبحت الآن: ${STATUS_LABELS_AR[updated.status]}`,
          actionUrl: `/admin?tab=instructor_collab&instructorId=${existing.instructorId}`,
          dedupKey: `inst_task_inst_upd_${updated.id}_${Date.now()}`,
        },
      })
      .catch(() => {});

    await this.audit.log({
      actorId: instructorId,
      actorRole: instructorRole,
      action: 'INSTRUCTOR_TASK_STATUS_UPDATED',
      entityType: 'InstructorTask',
      entityId: updated.id,
      metadata: {
        instructorId: existing.instructorId,
        status: updated.status,
        instructorNotesAr: parsed.instructorNotesAr ?? null,
      },
    });

    const emailDelivery = await this.dispatchCollabEmail({
      dedupeKey: `inst_task_status_mail_${updated.id}_${updated.updatedAt.getTime()}`,
      category: 'INSTRUCTOR_TASK_STATUS',
      recipientEmail: updated.assignedBy.email,
      recipientName: updated.assignedBy.fullName,
      subjectAr: `تحديث مهمة من المدرب ${existing.instructor.fullName}`,
      headlineAr: `تم تحديث حالة المهمة "${updated.titleAr}"`,
      summaryAr: `الحالة الجديدة: ${STATUS_LABELS_AR[updated.status]}${noteSuffix}`,
      actionPath: `/admin/instructors/tasks?instructorId=${existing.instructorId}`,
    });

    return {
      ...updated,
      course: updated.course ? this.formatCourseItem(updated.course) : null,
      emailDelivery,
    };
  }
}
