'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';
import { apiFetch } from '../../lib/api';

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="border-b border-[#8CA2FF]/15 pb-3">
        <h3 className="text-base font-black text-[#EEF0FF]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-[#A9B1E0]">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </Card>
  );
}

type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';

interface CourseRef {
  id: string;
  slug: string;
  status: string;
  titleAr: string;
}

interface InstructorTaskItem {
  id: string;
  instructorId: string;
  assignedById: string;
  courseId: string | null;
  titleAr: string;
  descriptionAr: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  adminNotesAr: string | null;
  instructorNotesAr: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  instructor?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  };
  assignedBy?: {
    id: string;
    fullName: string;
    role: string;
  };
  course?: CourseRef | null;
  _count?: {
    messages: number;
  };
}

interface ChatMessageItem {
  id: string;
  instructorId: string;
  senderId: string;
  taskId: string | null;
  bodyAr: string;
  attachmentUrl: string | null;
  isSystemTaskEvent: boolean;
  readByInstructorAt: string | null;
  readByAdminAt: string | null;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl?: string | null;
  };
  task?: {
    id: string;
    titleAr: string;
    status: TaskStatus;
    priority: TaskPriority;
  } | null;
}

interface InstructorRosterItem {
  id: string;
  fullName: string;
  email: string;
  phoneE164: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  headlineAr: string | null;
  bioAr: string | null;
  createdAt: string;
  courses: CourseRef[];
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    completed: number;
    cancelled: number;
    urgentOpen: number;
  };
  unreadMessagesFromInstructor: number;
  lastMessage: {
    id: string;
    bodyAr: string;
    senderId: string;
    isSystemTaskEvent: boolean;
    createdAt: string;
    sender: {
      id: string;
      fullName: string;
      role: string;
    };
  } | null;
}

interface OverviewPayload {
  summary: {
    totalInstructors: number;
    totalTasks: number;
    openTasks: number;
    inReviewTasks: number;
    completedTasks: number;
    urgentOpenTasks: number;
    totalUnreadMessages: number;
  };
  instructors: InstructorRosterItem[];
  allTasks: InstructorTaskItem[];
}

interface ThreadPayload {
  instructor: {
    id: string;
    fullName: string;
    email: string;
    phoneE164: string | null;
    role: string;
    status: string;
    headlineAr: string | null;
    bioAr: string | null;
  };
  courses: CourseRef[];
  tasks: InstructorTaskItem[];
  messages: ChatMessageItem[];
}

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'danger' }
> = {
  LOW: { label: 'منخفضة', tone: 'neutral' },
  MEDIUM: { label: 'متوسطة', tone: 'info' },
  HIGH: { label: 'مرتفعة', tone: 'warning' },
  URGENT: { label: 'عاجلة جداً', tone: 'danger' },
};

const STATUS_META: Record<
  TaskStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'purple' }
> = {
  TODO: { label: 'بانتظار البدء', tone: 'neutral' },
  IN_PROGRESS: { label: 'قيد التنفيذ', tone: 'info' },
  IN_REVIEW: { label: 'جاهزة للمراجعة', tone: 'warning' },
  COMPLETED: { label: 'مكتملة', tone: 'success' },
  CANCELLED: { label: 'ملغاة', tone: 'danger' },
};

const QUICK_ADMIN_REPLIES = [
  'يرجى مراجعة المهمة المسندة وتحديث حالتها عند البدء.',
  'تمت مراجعة المخرجات واعتماد المهمة بنجاح، شكراً لجهودك.',
  'يرجى رفع ملفات المحاضرة والواجبات قبل الموعد النهائي المحدد.',
  'هل تحتاج إلى أي دعم تقني أو تنسيقي لإنجاز هذه المهمة؟',
];

export function AdminInstructorCollabPanel({
  allCourses = [],
  pushToast,
  initialInstructorId,
}: {
  allCourses?: any[];
  pushToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
  initialInstructorId?: string | null;
}) {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(
    initialInstructorId || null,
  );
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  const [viewMode, setViewMode] = useState<'workspace' | 'all_tasks'>('workspace');
  const [instructorSearch, setInstructorSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'UNREAD' | 'ACTIVE_TASKS'>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');

  // Chat composer state
  const [chatBody, setChatBody] = useState('');
  const [chatTaskId, setChatTaskId] = useState<string>('');
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Task creation / editing modal state
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InstructorTaskItem | null>(null);
  const [taskTitleAr, setTaskTitleAr] = useState('');
  const [taskDescriptionAr, setTaskDescriptionAr] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('TODO');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskCourseId, setTaskCourseId] = useState('');
  const [taskAdminNotesAr, setTaskAdminNotesAr] = useState('');
  const [taskPostToChat, setTaskPostToChat] = useState(true);
  const [savingTask, setSavingTask] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingOverview(true);
      try {
        const res = await apiFetch<OverviewPayload>('/admin/instructor-collab/overview');
        setOverview(res);
        setSelectedInstructorId((prev) => {
          if (prev && res.instructors.some((i) => i.id === prev)) return prev;
          return res.instructors[0]?.id ?? null;
        });
      } catch (err: any) {
        if (!silent) {
          pushToast(err?.message || 'تعذر تحميل بيانات التواصل ومهام المدربين', 'error');
        }
      } finally {
        if (!silent) setLoadingOverview(false);
      }
    },
    [pushToast],
  );

  const loadThread = useCallback(
    async (instructorId: string, silent = false) => {
      if (!silent) setLoadingThread(true);
      try {
        const res = await apiFetch<ThreadPayload>(
          `/admin/instructor-collab/instructors/${instructorId}/thread`,
        );
        setThread(res);
        setOverview((prev) => {
          if (!prev) return prev;
          const target = prev.instructors.find((i) => i.id === instructorId);
          const clearedCount = target?.unreadMessagesFromInstructor ?? 0;
          if (clearedCount === 0) return prev;
          return {
            ...prev,
            summary: {
              ...prev.summary,
              totalUnreadMessages: Math.max(
                0,
                prev.summary.totalUnreadMessages - clearedCount,
              ),
            },
            instructors: prev.instructors.map((i) =>
              i.id === instructorId
                ? { ...i, unreadMessagesFromInstructor: 0 }
                : i,
            ),
          };
        });
      } catch (err: any) {
        if (!silent) {
          pushToast(err?.message || 'تعذر تحميل محادثة ومهام المدرب', 'error');
        }
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [pushToast],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedInstructorId) {
      void loadThread(selectedInstructorId);
    } else {
      setThread(null);
    }
  }, [selectedInstructorId, loadThread]);

  // Poll every 12 seconds for live chat & task updates
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOverview(true);
      if (selectedInstructorId) {
        void loadThread(selectedInstructorId, true);
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [loadOverview, loadThread, selectedInstructorId]);

  const filteredInstructors = useMemo(() => {
    if (!overview) return [];
    const q = instructorSearch.trim().toLowerCase();
    return overview.instructors.filter((inst) => {
      if (rosterFilter === 'UNREAD' && inst.unreadMessagesFromInstructor === 0) {
        return false;
      }
      if (
        rosterFilter === 'ACTIVE_TASKS' &&
        inst.taskStats.todo + inst.taskStats.inProgress + inst.taskStats.inReview === 0
      ) {
        return false;
      }
      if (!q) return true;
      return (
        inst.fullName.toLowerCase().includes(q) ||
        inst.email.toLowerCase().includes(q) ||
        (inst.headlineAr || '').toLowerCase().includes(q) ||
        inst.courses.some((c) => c.titleAr.toLowerCase().includes(q))
      );
    });
  }, [overview, instructorSearch, rosterFilter]);

  const selectedInstructorRoster = useMemo(() => {
    if (!overview || !selectedInstructorId) return null;
    return overview.instructors.find((i) => i.id === selectedInstructorId) ?? null;
  }, [overview, selectedInstructorId]);

  const filteredTasks = useMemo(() => {
    const source =
      viewMode === 'all_tasks' ? overview?.allTasks ?? [] : thread?.tasks ?? [];
    if (taskStatusFilter === 'ALL') return source;
    return source.filter((t) => t.status === taskStatusFilter);
  }, [viewMode, overview, thread, taskStatusFilter]);

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTaskTitleAr('');
    setTaskDescriptionAr('');
    setTaskPriority('MEDIUM');
    setTaskStatus('TODO');
    setTaskDueAt('');
    setTaskCourseId('');
    setTaskAdminNotesAr('');
    setTaskPostToChat(true);
    setTaskFormOpen(true);
  };

  const openEditTaskModal = (task: InstructorTaskItem) => {
    setEditingTask(task);
    setTaskTitleAr(task.titleAr);
    setTaskDescriptionAr(task.descriptionAr);
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    setTaskDueAt(task.dueAt ? task.dueAt.slice(0, 10) : '');
    setTaskCourseId(task.courseId || '');
    setTaskAdminNotesAr(task.adminNotesAr || '');
    setTaskPostToChat(false);
    setTaskFormOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstructorId && !editingTask) {
      pushToast('يرجى اختيار مدرب أولاً', 'error');
      return;
    }
    if (!taskTitleAr.trim() || !taskDescriptionAr.trim()) {
      pushToast('يرجى إدخال عنوان وتفاصيل المهمة', 'error');
      return;
    }
    setSavingTask(true);
    try {
      if (editingTask) {
        const res = await apiFetch<any>(`/admin/instructor-collab/tasks/${editingTask.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            titleAr: taskTitleAr.trim(),
            descriptionAr: taskDescriptionAr.trim(),
            priority: taskPriority,
            status: taskStatus,
            dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
            courseId: taskCourseId || null,
            adminNotesAr: taskAdminNotesAr.trim() || null,
          }),
        });
        if (res?.emailDelivery && !res.emailDelivery.ok) {
          pushToast(
            `تم تحديث المهمة بالمنصة، لكن ${res.emailDelivery.warningAr || 'تعذر إرسال البريد الإلكتروني'}`,
            'info',
          );
        } else {
          pushToast('تم تحديث المهمة وإشعار المدرب بنجاح', 'success');
        }
      } else {
        const res = await apiFetch<any>(
          `/admin/instructor-collab/instructors/${selectedInstructorId}/tasks`,
          {
            method: 'POST',
            body: JSON.stringify({
              titleAr: taskTitleAr.trim(),
              descriptionAr: taskDescriptionAr.trim(),
              priority: taskPriority,
              dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
              courseId: taskCourseId || null,
              adminNotesAr: taskAdminNotesAr.trim() || null,
              postToChat: taskPostToChat,
            }),
          },
        );
        if (res?.emailDelivery && !res.emailDelivery.ok) {
          pushToast(
            `تم حفظ المهمة بالمنصة، لكن ${res.emailDelivery.warningAr || 'لم يُرسل إشعار البريد الإلكتروني'}`,
            'info',
          );
        } else {
          pushToast('تم إسناد المهمة وإرسال تنبيه البريد للمدرب بنجاح', 'success');
        }
      }
      setTaskFormOpen(false);
      await loadOverview(true);
      if (selectedInstructorId) {
        await loadThread(selectedInstructorId, true);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ المهمة', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleQuickTaskStatusChange = async (
    task: InstructorTaskItem,
    nextStatus: TaskStatus,
  ) => {
    try {
      await apiFetch(`/admin/instructor-collab/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushToast(
        `تم تحديث حالة المهمة إلى: ${STATUS_META[nextStatus].label}`,
        'success',
      );
      await loadOverview(true);
      if (selectedInstructorId) {
        await loadThread(selectedInstructorId, true);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة المهمة', 'error');
    }
  };

  const handleDeleteTask = async (task: InstructorTaskItem) => {
    try {
      await apiFetch(`/admin/instructor-collab/tasks/${task.id}`, {
        method: 'DELETE',
      });
      pushToast('تم حذف المهمة', 'info');
      await loadOverview(true);
      if (selectedInstructorId) {
        await loadThread(selectedInstructorId, true);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف المهمة', 'error');
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstructorId) return;
    if (!chatBody.trim()) {
      pushToast('يرجى كتابة نص الرسالة', 'error');
      return;
    }
    setSendingChat(true);
    try {
      const res = await apiFetch<any>(
        `/admin/instructor-collab/instructors/${selectedInstructorId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            bodyAr: chatBody.trim(),
            taskId: chatTaskId || null,
            attachmentUrl: chatAttachmentUrl.trim() || null,
          }),
        },
      );
      if (res?.emailDelivery && !res.emailDelivery.ok) {
        pushToast(
          `تم إرسال الرسالة في المحادثة، لكن ${res.emailDelivery.warningAr || 'لم يُرسل إشعار البريد الإلكتروني'}`,
          'info',
        );
      }
      setChatBody('');
      setChatAttachmentUrl('');
      await loadThread(selectedInstructorId, true);
      await loadOverview(true);
      window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 80);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الرسالة', 'error');
    } finally {
      setSendingChat(false);
    }
  };

  const availableCourseOptions = useMemo(() => {
    const map = new Map<string, { id: string; titleAr: string }>();
    for (const c of thread?.courses ?? []) {
      map.set(c.id, { id: c.id, titleAr: c.titleAr });
    }
    for (const c of allCourses) {
      const title =
        c.publishedVersion?.titleAr ||
        c.draftVersion?.titleAr ||
        c.titleAr ||
        c.slug;
      if (c.id && title && !map.has(c.id)) {
        map.set(c.id, { id: c.id, titleAr: title });
      }
    }
    return Array.from(map.values());
  }, [thread?.courses, allCourses]);

  if (loadingOverview && !overview) {
    return (
      <SectionCard title="مركز تواصل الإدارة العليا ومهام المدربين">
        <div className="py-12 text-center text-sm text-slate-300">
          جاري تحميل قائمة المدربين والمحادثات والمهام...
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-instructor-collab-panel">
      {/* Top Executive Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-400">إجمالي المدربين</p>
          <p className="mt-1 text-2xl font-black text-white">
            {overview?.summary.totalInstructors ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-400">مهام قيد التنفيذ / البدء</p>
          <p className="mt-1 text-2xl font-black text-sky-400">
            {overview?.summary.openTasks ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold text-amber-300">جاهزة للمراجعة</p>
          <p className="mt-1 text-2xl font-black text-amber-300">
            {overview?.summary.inReviewTasks ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <p className="text-xs font-semibold text-emerald-300">مهام مكتملة</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">
            {overview?.summary.completedTasks ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
          <p className="text-xs font-semibold text-rose-300">مهام عاجلة مفتوحة</p>
          <p className="mt-1 text-2xl font-black text-rose-300">
            {overview?.summary.urgentOpenTasks ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4">
          <p className="text-xs font-semibold text-indigo-300">رسائل غير مقروءة</p>
          <p className="mt-1 text-2xl font-black text-indigo-300">
            {overview?.summary.totalUnreadMessages ?? 0}
          </p>
        </div>
      </div>

      {/* Mode Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div>
          <h2 className="text-lg font-black text-white">
            غرفة القيادة: التواصل المباشر وإدارة مهام المدربين
          </h2>
          <p className="text-xs text-slate-400">
            تواصل فوري عبر الشات المباشر بين المدير الأعلى والمدربين مع إسناد ومتابعة المهام الأكاديمية والتشغيلية
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('workspace')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              viewMode === 'workspace'
                ? 'bg-sky-600 text-white shadow'
                : 'border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            مساحة الشات والمهام للمدرب
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_tasks')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              viewMode === 'all_tasks'
                ? 'bg-sky-600 text-white shadow'
                : 'border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            سجل جميع المهام ({overview?.summary.totalTasks ?? 0})
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void loadOverview();
              if (selectedInstructorId) void loadThread(selectedInstructorId);
            }}
          >
            تحديث فوري
          </Button>
        </div>
      </div>

      {viewMode === 'all_tasks' ? (
        <SectionCard
          title="السجل الشامل لمهام جميع المدربين"
          subtitle="متابعة موحدة لكافة المهام المسندة للمدربين مع إمكانية الفلترة والانتقال الفوري لمحادثة كل مدرب"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTaskStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    taskStatusFilter === st
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st === 'ALL' ? 'كل الحالات' : STATUS_META[st].label}
                </button>
              ),
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="لا توجد مهام مطابقة للفلتر الحالي"
              description="يمكنك اختيار مدرب من القائمة وإسناد مهام جديدة له في أي وقت."
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={PRIORITY_META[task.priority].tone}>
                        الأولوية: {PRIORITY_META[task.priority].label}
                      </Badge>
                      <Badge tone={STATUS_META[task.status].tone}>
                        {STATUS_META[task.status].label}
                      </Badge>
                      {task.instructor && (
                        <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                          المدرب: {task.instructor.fullName}
                        </span>
                      )}
                      {task.course && (
                        <span className="rounded bg-indigo-950/60 px-2.5 py-0.5 text-xs text-indigo-300">
                          الكورس: {task.course.titleAr}
                        </span>
                      )}
                      {task.dueAt && (
                        <span className="text-xs text-amber-300">
                          موعد التسليم: {new Date(task.dueAt).toLocaleDateString('ar-EG')}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white">{task.titleAr}</h4>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {task.descriptionAr}
                    </p>
                    {task.instructorNotesAr && (
                      <p className="rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-1.5 text-xs text-sky-200">
                        <strong>ملاحظة المدرب:</strong> {task.instructorNotesAr}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="تغيير حالة المهمة"
                      value={task.status}
                      onChange={(e) =>
                        void handleQuickTaskStatusChange(
                          task,
                          e.target.value as TaskStatus,
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {Object.entries(STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedInstructorId(task.instructorId);
                        setViewMode('workspace');
                      }}
                    >
                      فتح شات المدرب
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
        /* Split-Pane Workspace: Instructor Roster Sidebar + Active Instructor Chat & Tasks */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Instructor Roster Sidebar (4 cols on desktop) */}
          <div className="space-y-4 lg:col-span-4">
            <SectionCard
              title="قائمة المدربين"
              subtitle="اختر مدرباً لفتح المحادثة المباشرة وإدارة مهامه"
            >
              <div className="space-y-3">
                <input
                  type="search"
                  value={instructorSearch}
                  onChange={(e) => setInstructorSearch(e.target.value)}
                  placeholder="ابحث باسم المدرب أو البريد أو الكورس..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'الكل' },
                      { id: 'UNREAD', label: 'غير مقروء' },
                      { id: 'ACTIVE_TASKS', label: 'مهام نشطة' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRosterFilter(f.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        rosterFilter === f.id
                          ? 'bg-sky-600 text-white'
                          : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredInstructors.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
                    لا يوجد مدربون مطابقون للبحث الحالي
                  </div>
                ) : (
                  <div className="max-h-[640px] space-y-2.5 overflow-y-auto pl-1">
                    {filteredInstructors.map((inst) => {
                      const isSelected = inst.id === selectedInstructorId;
                      const activeTasksCount =
                        inst.taskStats.todo +
                        inst.taskStats.inProgress +
                        inst.taskStats.inReview;
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          data-testid={`instructor-roster-item-${inst.id}`}
                          onClick={() => setSelectedInstructorId(inst.id)}
                          className={`w-full rounded-xl border p-3.5 text-right transition ${
                            isSelected
                              ? 'border-sky-500 bg-sky-950/40 shadow-md'
                              : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-white">
                                {inst.fullName}
                              </p>
                              <p className="text-xs text-slate-400">{inst.email}</p>
                            </div>
                            {inst.unreadMessagesFromInstructor > 0 && (
                              <span className="inline-flex items-center rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-black text-white">
                                {inst.unreadMessagesFromInstructor} جديد
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                              الكورسات: {inst.courses.length}
                            </span>
                            <span className="rounded bg-sky-950/70 px-2 py-0.5 text-sky-300">
                              مهام نشطة: {activeTasksCount}
                            </span>
                            <span className="rounded bg-emerald-950/60 px-2 py-0.5 text-emerald-300">
                              مكتملة: {inst.taskStats.completed}
                            </span>
                            {inst.taskStats.inReview > 0 && (
                              <span className="rounded bg-amber-950/80 px-2 py-0.5 font-bold text-amber-300">
                                للمراجعة: {inst.taskStats.inReview}
                              </span>
                            )}
                          </div>

                          {inst.lastMessage && (
                            <p className="mt-2 line-clamp-1 border-t border-slate-800/80 pt-2 text-xs text-slate-400">
                              {inst.lastMessage.isSystemTaskEvent ? '📋 ' : '💬 '}
                              {inst.lastMessage.bodyAr}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Active Instructor Workspace (8 cols on desktop) */}
          <div className="space-y-6 lg:col-span-8">
            {!selectedInstructorId || !selectedInstructorRoster ? (
              <SectionCard title="اختر مدرباً للبدء">
                <EmptyState
                  title="لم يتم اختيار مدرب"
                  description="يرجى اختيار أحد المدربين من القائمة الجانبية لعرض المحادثة المباشرة وإسناد المهام."
                />
              </SectionCard>
            ) : (
              <>
                {/* Selected Instructor Banner */}
                <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/95 p-5 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">
                        {selectedInstructorRoster.fullName}
                      </h3>
                      <Badge tone="info">مدرب معتمد</Badge>
                      {selectedInstructorRoster.taskStats.urgentOpen > 0 && (
                        <Badge tone="danger">
                          {selectedInstructorRoster.taskStats.urgentOpen} مهام عاجلة
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {selectedInstructorRoster.email}
                      {selectedInstructorRoster.phoneE164
                        ? ` • ${selectedInstructorRoster.phoneE164}`
                        : ''}
                    </p>
                    {selectedInstructorRoster.courses.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {selectedInstructorRoster.courses.map((c) => (
                          <span
                            key={c.id}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300"
                          >
                            {c.titleAr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid="open-assign-task-modal-btn"
                      onClick={openNewTaskModal}
                    >
                      + إسناد مهمة جديدة للمدرب
                    </Button>
                  </div>
                </div>

                {/* Inline Task Create / Edit Drawer */}
                {taskFormOpen && (
                  <SectionCard
                    title={
                      editingTask
                        ? `تعديل المهمة: ${editingTask.titleAr}`
                        : `إسناد مهمة جديدة للمدرب ${selectedInstructorRoster.fullName}`
                    }
                    subtitle="يتم إرسال إشعار فوري للمدرب مع إمكانية إدراج بطاقة المهمة تلقائياً في شات المدرب"
                  >
                    <form
                      onSubmit={handleSaveTask}
                      className="space-y-4"
                      data-testid="admin-instructor-task-form"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-200">
                            عنوان المهمة *
                          </label>
                          <input
                            type="text"
                            required
                            data-testid="task-title-input"
                            value={taskTitleAr}
                            onChange={(e) => setTaskTitleAr(e.target.value)}
                            placeholder="مثال: تجهيز ورفع محاضرات الوحدة الثالثة + بنك الأسئلة"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-200">
                              الأولوية
                            </label>
                            <select
                              data-testid="task-priority-select"
                              value={taskPriority}
                              onChange={(e) =>
                                setTaskPriority(e.target.value as TaskPriority)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                            >
                              {Object.entries(PRIORITY_META).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-200">
                              تاريخ التسليم المستهدف
                            </label>
                            <input
                              type="date"
                              data-testid="task-due-input"
                              value={taskDueAt}
                              onChange={(e) => setTaskDueAt(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-200">
                            ربط بكورس تدريبي (اختياري)
                          </label>
                          <select
                            value={taskCourseId}
                            onChange={(e) => setTaskCourseId(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          >
                            <option value="">— مهمة عامة غير مرتبطة بكورس محدد —</option>
                            {availableCourseOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.titleAr}
                              </option>
                            ))}
                          </select>
                        </div>

                        {editingTask && (
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-200">
                              حالة المهمة
                            </label>
                            <select
                              value={taskStatus}
                              onChange={(e) =>
                                setTaskStatus(e.target.value as TaskStatus)
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                            >
                              {Object.entries(STATUS_META).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-200">
                          وصف وتفاصيل المهمة المطلوبة *
                        </label>
                        <textarea
                          rows={3}
                          required
                          data-testid="task-desc-input"
                          value={taskDescriptionAr}
                          onChange={(e) => setTaskDescriptionAr(e.target.value)}
                          placeholder="اكتب المتطلبات التفصيلية للمهمة ومعايير التسليم..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-200">
                          ملاحظات وتوجيهات الإدارة العليا (اختياري)
                        </label>
                        <input
                          type="text"
                          data-testid="task-admin-notes-input"
                          value={taskAdminNotesAr}
                          onChange={(e) => setTaskAdminNotesAr(e.target.value)}
                          placeholder="توجيهات إضافية أو روابط مرجعية للمدرب..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      {!editingTask && (
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={taskPostToChat}
                            onChange={(e) => setTaskPostToChat(e.target.checked)}
                          />
                          إدراج بطاقة المهمة تلقائياً في شات المدرب المباشر
                        </label>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTaskFormOpen(false)}
                        >
                          إلغاء
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={savingTask}
                          data-testid="submit-task-btn"
                        >
                          {editingTask ? 'حفظ التعديلات' : 'إسناد المهمة الآن'}
                        </Button>
                      </div>
                    </form>
                  </SectionCard>
                )}

                {/* Direct Chat Thread Card */}
                <SectionCard
                  title={`المحادثة المباشرة مع ${selectedInstructorRoster.fullName}`}
                  subtitle="سجل مراسلات فوري وموثق بين القيادة العليا والمدرب مع ربط الرسائل بالمهام"
                >
                  <div className="space-y-4">
                    <div
                      className="max-h-[420px] min-h-[260px] space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/90 p-4"
                      data-testid="admin-instructor-chat-messages"
                    >
                      {loadingThread && !thread ? (
                        <p className="py-10 text-center text-xs text-slate-400">
                          جاري تحميل سجل المحادثة...
                        </p>
                      ) : (thread?.messages.length ?? 0) === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400">
                          لا توجد رسائل سابقة مع هذا المدرب. ابدأ المحادثة الآن أو أسند مهمة جديدة.
                        </div>
                      ) : (
                        thread!.messages.map((msg) => {
                          const isFromInstructor =
                            msg.senderId === selectedInstructorId;
                          if (msg.isSystemTaskEvent) {
                            return (
                              <div
                                key={msg.id}
                                className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold">
                                    📋 تحديث مهام النظام • {msg.sender.fullName}
                                  </span>
                                  <span className="text-[11px] text-amber-300/80">
                                    {new Date(msg.createdAt).toLocaleString('ar-EG')}
                                  </span>
                                </div>
                                <p className="mt-1 leading-relaxed">{msg.bodyAr}</p>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col rounded-xl border p-3.5 ${
                                isFromInstructor
                                  ? 'mr-auto max-w-[88%] border-slate-700 bg-slate-900 text-slate-100'
                                  : 'ml-auto max-w-[88%] border-sky-500/40 bg-sky-950/40 text-white'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span className="font-black text-sky-300">
                                  {msg.sender.fullName}{' '}
                                  <span className="font-normal text-slate-400">
                                    ({isFromInstructor ? 'المدرب' : 'الإدارة العليا'})
                                  </span>
                                </span>
                                <span className="text-slate-400">
                                  {new Date(msg.createdAt).toLocaleString('ar-EG')}
                                </span>
                              </div>

                              {msg.task && (
                                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-slate-950/80 px-2.5 py-1 text-[11px] text-amber-300">
                                  <span>مرتبطة بمهمة:</span>
                                  <strong>{msg.task.titleAr}</strong>
                                  <span>({STATUS_META[msg.task.status].label})</span>
                                </div>
                              )}

                              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                                {msg.bodyAr}
                              </p>

                              {msg.attachmentUrl && (
                                <a
                                  href={msg.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-block text-xs font-bold text-sky-400 underline"
                                >
                                  فتح الرابط / المرفق المرجعي
                                </a>
                              )}
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick reply chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">
                        ردود سريعة:
                      </span>
                      {QUICK_ADMIN_REPLIES.map((tpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setChatBody(tpl)}
                          className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-sky-500 hover:text-white"
                        >
                          {tpl.slice(0, 42)}...
                        </button>
                      ))}
                    </div>

                    {/* Message Composer */}
                    <form
                      onSubmit={handleSendChatMessage}
                      className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5"
                    >
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <select
                          aria-label="ربط الرسالة بمهمة"
                          value={chatTaskId}
                          onChange={(e) => setChatTaskId(e.target.value)}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                        >
                          <option value="">
                            — ربط الرسالة بمهمة محددة (اختياري) —
                          </option>
                          {(thread?.tasks ?? []).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.titleAr} ({STATUS_META[t.status].label})
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={chatAttachmentUrl}
                          onChange={(e) => setChatAttachmentUrl(e.target.value)}
                          placeholder="رابط مرفق أو ملف مرجعي (اختياري) https://..."
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <textarea
                          rows={2}
                          data-testid="admin-chat-input"
                          value={chatBody}
                          onChange={(e) => setChatBody(e.target.value)}
                          placeholder={`اكتب رسالتك المباشرة إلى المدرب ${selectedInstructorRoster.fullName}...`}
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={sendingChat}
                          data-testid="admin-chat-send-btn"
                        >
                          إرسال الرسالة
                        </Button>
                      </div>
                    </form>
                  </div>
                </SectionCard>

                {/* Selected Instructor's Tasks Card */}
                <SectionCard
                  title={`مهام المدرب ${selectedInstructorRoster.fullName} (${thread?.tasks.length ?? 0})`}
                  subtitle="متابعة حالة إنجاز المهام المسندة وملاحظات المدرب وتحديث الأولويات"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          'ALL',
                          'TODO',
                          'IN_PROGRESS',
                          'IN_REVIEW',
                          'COMPLETED',
                          'CANCELLED',
                        ] as const
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setTaskStatusFilter(st)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            taskStatusFilter === st
                              ? 'bg-sky-600 text-white'
                              : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {st === 'ALL' ? 'الكل' : STATUS_META[st].label}
                        </button>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openNewTaskModal}
                    >
                      + مهمة جديدة
                    </Button>
                  </div>

                  {filteredTasks.length === 0 ? (
                    <EmptyState
                      title="لا توجد مهام مسندة لهذا المدرب"
                      description="اضغط على (+ إسناد مهمة جديدة للمدرب) لإضافة أول مهمة."
                    />
                  ) : (
                    <div className="space-y-3" data-testid="admin-instructor-tasks-list">
                      {filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          data-testid={`admin-task-card-${task.id}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/80 p-4"
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={PRIORITY_META[task.priority].tone}>
                                  الأولوية: {PRIORITY_META[task.priority].label}
                                </Badge>
                                <Badge tone={STATUS_META[task.status].tone}>
                                  {STATUS_META[task.status].label}
                                </Badge>
                                {task.course && (
                                  <span className="rounded bg-indigo-950/70 px-2 py-0.5 text-xs text-indigo-300">
                                    الكورس: {task.course.titleAr}
                                  </span>
                                )}
                                {task.dueAt && (
                                  <span className="text-xs text-amber-300">
                                    موعد التسليم:{' '}
                                    {new Date(task.dueAt).toLocaleDateString('ar-EG')}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-black text-white">
                                {task.titleAr}
                              </h4>
                              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                                {task.descriptionAr}
                              </p>

                              {task.adminNotesAr && (
                                <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-xs text-amber-200">
                                  <strong>توجيهات الإدارة:</strong> {task.adminNotesAr}
                                </p>
                              )}

                              {task.instructorNotesAr && (
                                <p className="rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-1.5 text-xs text-sky-200">
                                  <strong>ملاحظات المدرب:</strong>{' '}
                                  {task.instructorNotesAr}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                aria-label="تحديث حالة المهمة"
                                value={task.status}
                                onChange={(e) =>
                                  void handleQuickTaskStatusChange(
                                    task,
                                    e.target.value as TaskStatus,
                                  )
                                }
                                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                {Object.entries(STATUS_META).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setChatTaskId(task.id);
                                  setChatBody(
                                    `بخصوص المهمة "${task.titleAr}": `,
                                  );
                                }}
                              >
                                مناقشة في الشات
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditTaskModal(task)}
                              >
                                تعديل
                              </Button>

                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => void handleDeleteTask(task)}
                              >
                                حذف
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
