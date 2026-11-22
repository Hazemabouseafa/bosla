import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorCollabService } from './instructor-collab.service';

describe('InstructorCollabService (Super Admin <-> Instructor Chat & Tasks)', () => {
  let service: InstructorCollabService;
  let prismaMock: any;
  let auditMock: any;

  const mockInstructor = {
    id: 'inst-1',
    fullName: 'د. أحمد المنياوي',
    email: 'instructor@bosla.academy',
    phoneE164: '+201011112222',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    avatarUrl: null,
    headlineAr: 'استشاري تغذية الدواجن',
    bioAr: 'خبرة 15 عاماً',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    instructedCourses: [
      {
        id: 'course-1',
        slug: 'poultry-nutrition',
        status: 'PUBLISHED',
        publishedVersion: { titleAr: 'تغذية الدواجن المتقدمة' },
        draftVersion: null,
      },
    ],
    programInstructorAssignments: [],
  };

  const mockSuperAdmin = {
    id: 'admin-1',
    fullName: 'المدير الأعلى لبوصلة',
    role: 'SUPER_ADMIN' as const,
  };

  beforeEach(() => {
    const tasksStore: any[] = [];
    const messagesStore: any[] = [];
    const notificationsStore: any[] = [];

    prismaMock = {
      _stores: { tasksStore, messagesStore, notificationsStore },
      user: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === mockInstructor.id) return mockInstructor;
          if (where.id === mockSuperAdmin.id) return mockSuperAdmin;
          return null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          if (where?.role?.in) {
            return [{ id: mockSuperAdmin.id }];
          }
          return [mockInstructor];
        }),
      },
      course: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === 'course-1') {
            return {
              id: 'course-1',
              slug: 'poultry-nutrition',
              status: 'PUBLISHED',
              publishedVersion: { titleAr: 'تغذية الدواجن المتقدمة' },
              draftVersion: null,
            };
          }
          return null;
        }),
        findMany: vi.fn(async () => mockInstructor.instructedCourses),
      },
      instructorTask: {
        findMany: vi.fn(async ({ where }: any) => {
          if (where?.instructorId && typeof where.instructorId === 'string') {
            return tasksStore.filter((t) => t.instructorId === where.instructorId);
          }
          return [...tasksStore];
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return tasksStore.find((t) => t.id === where.id) ?? null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `task-${tasksStore.length + 1}`,
            ...data,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            instructor: {
              id: mockInstructor.id,
              fullName: mockInstructor.fullName,
              email: mockInstructor.email,
              avatarUrl: null,
            },
            assignedBy: {
              id: mockSuperAdmin.id,
              fullName: mockSuperAdmin.fullName,
              role: mockSuperAdmin.role,
            },
            course:
              data.courseId === 'course-1'
                ? mockInstructor.instructedCourses[0]
                : null,
            _count: { messages: 0 },
          };
          tasksStore.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = tasksStore.findIndex((t) => t.id === where.id);
          if (idx === -1) throw new Error('Not found');
          tasksStore[idx] = {
            ...tasksStore[idx],
            ...data,
            updatedAt: new Date(),
          };
          return tasksStore[idx];
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = tasksStore.findIndex((t) => t.id === where.id);
          if (idx !== -1) tasksStore.splice(idx, 1);
          return { id: where.id };
        }),
      },
      instructorChatMessage: {
        findMany: vi.fn(async ({ where }: any) => {
          if (where?.instructorId && typeof where.instructorId === 'string') {
            return messagesStore.filter((m) => m.instructorId === where.instructorId);
          }
          return [...messagesStore];
        }),
        count: vi.fn(async ({ where }: any) => {
          return messagesStore.filter(
            (m) =>
              m.instructorId === where.instructorId &&
              m.senderId !== where.senderId.not &&
              m.readByInstructorAt === null,
          ).length;
        }),
        create: vi.fn(async ({ data }: any) => {
          const sender =
            data.senderId === mockSuperAdmin.id
              ? mockSuperAdmin
              : {
                  id: mockInstructor.id,
                  fullName: mockInstructor.fullName,
                  role: mockInstructor.role,
                };
          const task = data.taskId
            ? tasksStore.find((t) => t.id === data.taskId) ?? null
            : null;
          const msg = {
            id: `msg-${messagesStore.length + 1}`,
            instructorId: data.instructorId,
            senderId: data.senderId,
            taskId: data.taskId ?? null,
            bodyAr: data.bodyAr,
            attachmentUrl: data.attachmentUrl ?? null,
            isSystemTaskEvent: Boolean(data.isSystemTaskEvent),
            readByInstructorAt: data.readByInstructorAt ?? null,
            readByAdminAt: data.readByAdminAt ?? null,
            createdAt: new Date(),
            sender,
            task: task
              ? {
                  id: task.id,
                  titleAr: task.titleAr,
                  status: task.status,
                  priority: task.priority,
                }
              : null,
          };
          messagesStore.push(msg);
          return msg;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const m of messagesStore) {
            if (m.instructorId !== where.instructorId) continue;
            if (where.readByAdminAt === null && m.readByAdminAt === null && m.senderId === where.senderId) {
              m.readByAdminAt = data.readByAdminAt;
              count++;
            }
            if (
              where.readByInstructorAt === null &&
              m.readByInstructorAt === null &&
              where.senderId?.not &&
              m.senderId !== where.senderId.not
            ) {
              m.readByInstructorAt = data.readByInstructorAt;
              count++;
            }
          }
          return { count };
        }),
      },
      notification: {
        create: vi.fn(async ({ data }: any) => {
          notificationsStore.push(data);
          return data;
        }),
      },
    };

    auditMock = {
      log: vi.fn(async () => undefined),
    };

    service = new InstructorCollabService(prismaMock, auditMock);
  });

  it('allows Super Admin to assign a task, post to chat, and notify instructor', async () => {
    const task = await service.createTaskForInstructor(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      mockInstructor.id,
      {
        titleAr: 'رفع محاضرات الوحدة الرابعة وبنك الأسئلة',
        descriptionAr: 'يرجى الانتهاء من تسجيل ورفع محاضرات التغذية العلاجية مع 20 سؤال اختيار من متعدد.',
        priority: 'URGENT',
        courseId: 'course-1',
        adminNotesAr: 'موعد إطلاق الدفعة الجديدة يوم الأحد القادم',
        postToChat: true,
      },
    );

    expect(task.id).toBe('task-1');
    expect(task.priority).toBe('URGENT');
    expect(task.status).toBe('TODO');
    expect(task.course?.titleAr).toBe('تغذية الدواجن المتقدمة');

    // System chat event posted automatically
    expect(prismaMock._stores.messagesStore).toHaveLength(1);
    expect(prismaMock._stores.messagesStore[0].isSystemTaskEvent).toBe(true);
    expect(prismaMock._stores.messagesStore[0].taskId).toBe(task.id);

    // Notification sent to instructor
    expect(prismaMock._stores.notificationsStore).toHaveLength(1);
    expect(prismaMock._stores.notificationsStore[0].userId).toBe(mockInstructor.id);
    expect(prismaMock._stores.notificationsStore[0].type).toBe('INSTRUCTOR_TASK_ASSIGNED');

    // Audit logged
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: mockSuperAdmin.id,
        action: 'INSTRUCTOR_TASK_CREATED',
      }),
    );
  });

  it('supports two-way chat, unread counters, and instructor task status progression', async () => {
    // 1. Super Admin creates a task and sends a direct message
    const task = await service.createTaskForInstructor(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      mockInstructor.id,
      {
        titleAr: 'تحديث المادة العلمية للمحاضرة الأولى',
        descriptionAr: 'إضافة جداول الاحتياجات الغذائية المحدثة',
        priority: 'HIGH',
        postToChat: true,
      },
    );

    await service.sendAdminMessage(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      mockInstructor.id,
      {
        bodyAr: 'مرحباً دكتور أحمد، يرجى مراجعة المهمة الجديدة وإبلاغي عند البدء.',
        taskId: task.id,
      },
    );

    // 2. Instructor opens workspace -> sees 2 unread messages (system task event + direct message)
    const workspaceBeforeRead = await service.getInstructorWorkspace(mockInstructor.id);
    expect(workspaceBeforeRead.stats.total).toBe(1);
    expect(workspaceBeforeRead.stats.todo).toBe(1);
    expect(workspaceBeforeRead.stats.unreadMessages).toBe(2);

    // 3. Instructor marks messages as read
    const readRes = await service.markMessagesReadByInstructor(mockInstructor.id);
    expect(readRes.markedReadCount).toBe(2);

    const workspaceAfterRead = await service.getInstructorWorkspace(mockInstructor.id);
    expect(workspaceAfterRead.stats.unreadMessages).toBe(0);

    // 4. Instructor updates task status to IN_PROGRESS and then COMPLETED with notes
    await service.updateTaskStatusByInstructor(
      mockInstructor.id,
      'INSTRUCTOR',
      task.id,
      {
        status: 'IN_PROGRESS',
        instructorNotesAr: 'بدأت في تجهيز الجداول المحدثة',
      },
    );

    const completedTask = await service.updateTaskStatusByInstructor(
      mockInstructor.id,
      'INSTRUCTOR',
      task.id,
      {
        status: 'COMPLETED',
        instructorNotesAr: 'تم رفع الجداول المحدثة وربطها بالمحاضرة بنجاح',
      },
    );

    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.completedAt).toBeInstanceOf(Date);
    expect(completedTask.instructorNotesAr).toContain('تم رفع الجداول');

    // 5. Instructor sends a direct reply to Super Admin
    await service.sendInstructorMessage(mockInstructor.id, 'INSTRUCTOR', {
      bodyAr: 'تم إنجاز المهمة بالكامل ورفع الملفات يا فندم.',
      taskId: task.id,
    });

    // 6. Super Admin checks overview -> sees unread messages from instructor & completed task
    const adminOverview = await service.getAdminOverview();
    expect(adminOverview.summary.totalInstructors).toBe(1);
    expect(adminOverview.summary.completedTasks).toBe(1);
    expect(adminOverview.summary.totalUnreadMessages).toBe(3); // 2 status updates + 1 chat message

    // 7. Super Admin opens thread -> marks instructor messages as read by admin
    const thread = await service.getInstructorThreadForAdmin(mockInstructor.id);
    expect(thread.messages).toHaveLength(5);
    expect(thread.tasks[0].status).toBe('COMPLETED');

    const adminOverviewAfterRead = await service.getAdminOverview();
    expect(adminOverviewAfterRead.summary.totalUnreadMessages).toBe(0);
  });

  it('prevents an instructor from updating another instructor task', async () => {
    const task = await service.createTaskForInstructor(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      mockInstructor.id,
      {
        titleAr: 'مهمة خاصة',
        descriptionAr: 'وصف المهمة',
        priority: 'MEDIUM',
      },
    );

    await expect(
      service.updateTaskStatusByInstructor(
        'other-instructor-id',
        'INSTRUCTOR',
        task.id,
        { status: 'COMPLETED' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows Super Admin to edit and delete tasks', async () => {
    const task = await service.createTaskForInstructor(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      mockInstructor.id,
      {
        titleAr: 'مهمة تجريبية',
        descriptionAr: 'تفاصيل أولية',
        priority: 'LOW',
      },
    );

    const updated = await service.updateTaskByAdmin(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      task.id,
      {
        titleAr: 'مهمة تجريبية معدلة',
        priority: 'HIGH',
        status: 'IN_REVIEW',
      },
    );

    expect(updated.titleAr).toBe('مهمة تجريبية معدلة');
    expect(updated.priority).toBe('HIGH');
    expect(updated.status).toBe('IN_REVIEW');

    const del = await service.deleteTaskByAdmin(
      mockSuperAdmin.id,
      mockSuperAdmin.role,
      task.id,
    );
    expect(del).toEqual({ deleted: true, id: task.id });

    await expect(
      service.deleteTaskByAdmin(mockSuperAdmin.id, mockSuperAdmin.role, task.id),
    ).rejects.toThrow(NotFoundException);
  });
});
