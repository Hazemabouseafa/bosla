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
  assignedBy?: {
    id: string;
    fullName: string;
    role: string;
  };
  course?: CourseRef | null;
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

interface InstructorWorkspacePayload {
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    completed: number;
    cancelled: number;
    urgentOpen: number;
    unreadMessages: number;
  };
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

export function InstructorCollabPanel({
  currentUserId,
  pushToast,
  onSummaryChange,
}: {
  currentUserId: string;
  pushToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
  onSummaryChange?: (stats: InstructorWorkspacePayload['stats']) => void;
}) {
  const [workspace, setWorkspace] = useState<InstructorWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Task note editing state
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Chat composer state
  const [chatBody, setChatBody] = useState('');
  const [chatTaskId, setChatTaskId] = useState('');
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadWorkspace = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await apiFetch<InstructorWorkspacePayload>(
          '/instructor/collab/workspace',
        );
        setWorkspace(res);
        setTaskNotes((prev) => {
          const next = { ...prev };
          for (const t of res.tasks) {
            if (next[t.id] === undefined) {
              next[t.id] = t.instructorNotesAr || '';
            }
          }
          return next;
        });
        if (res.stats.unreadMessages > 0) {
          await apiFetch('/instructor/collab/messages/read', {
            method: 'POST',
            body: JSON.stringify({}),
          }).catch(() => {});
          const updatedStats = { ...res.stats, unreadMessages: 0 };
          onSummaryChange?.(updatedStats);
        } else {
          onSummaryChange?.(res.stats);
        }
      } catch (err: any) {
        if (!silent) {
          pushToast(err?.message || 'تعذر تحميل مهام ومحادثة الإدارة العليا', 'error');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [pushToast, onSummaryChange],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadWorkspace(true);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace]);

  const filteredTasks = useMemo(() => {
    const list = workspace?.tasks ?? [];
    if (statusFilter === 'ALL') return list;
    return list.filter((t) => t.status === statusFilter);
  }, [workspace, statusFilter]);

  const handleUpdateTaskStatus = async (
    task: InstructorTaskItem,
    nextStatus: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED',
  ) => {
    setUpdatingTaskId(task.id);
    try {
      const note = taskNotes[task.id]?.trim();
      await apiFetch(`/instructor/collab/tasks/${task.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          instructorNotesAr: note !== undefined ? note : task.instructorNotesAr,
        }),
      });
      pushToast(
        `تم تحديث حالة المهمة إلى: ${STATUS_META[nextStatus].label}`,
        'success',
      );
      await loadWorkspace(true);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة المهمة', 'error');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatBody.trim()) {
      pushToast('يرجى كتابة نص الرسالة', 'error');
      return;
    }
    setSendingChat(true);
    try {
      await apiFetch('/instructor/collab/messages', {
        method: 'POST',
        body: JSON.stringify({
          bodyAr: chatBody.trim(),
          taskId: chatTaskId || null,
          attachmentUrl: chatAttachmentUrl.trim() || null,
        }),
      });
      setChatBody('');
      setChatAttachmentUrl('');
      await loadWorkspace(true);
      window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 80);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الرسالة', 'error');
    } finally {
      setSendingChat(false);
    }
  };

  if (loading && !workspace) {
    return (
      <SectionCard title="التواصل المباشر والمهام المسندة من الإدارة العليا">
        <div className="py-12 text-center text-sm text-slate-300">
          جاري تحميل المهام وسجل المحادثة مع الإدارة...
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="instructor-collab-panel">
      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-400">إجمالي مهامي</p>
          <p className="mt-1 text-2xl font-black text-white">
            {workspace?.stats.total ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-400">بانتظار البدء</p>
          <p className="mt-1 text-2xl font-black text-slate-200">
            {workspace?.stats.todo ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
          <p className="text-xs font-semibold text-sky-300">قيد التنفيذ</p>
          <p className="mt-1 text-2xl font-black text-sky-300">
            {workspace?.stats.inProgress ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold text-amber-300">قيد مراجعة الإدارة</p>
          <p className="mt-1 text-2xl font-black text-amber-300">
            {workspace?.stats.inReview ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <p className="text-xs font-semibold text-emerald-300">مهام مكتملة</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">
            {workspace?.stats.completed ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Tasks Column (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <SectionCard
            title="مهامي المسندة من الإدارة العليا"
            subtitle="حدّث حالة إنجاز كل مهمة وأضف ملاحظاتك أو روابط التسليم ليصل إشعار فوري للمدير الأعلى"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  ['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      statusFilter === st
                        ? 'bg-sky-600 text-white'
                        : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st === 'ALL' ? 'كل المهام' : STATUS_META[st].label}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadWorkspace()}
              >
                تحديث
              </Button>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState
                title="لا توجد مهام مسندة حالياً"
                description="عندما يقوم المدير الأعلى بإسناد مهمة جديدة لك ستظهر هنا فوراً مع إشعار."
              />
            ) : (
              <div className="space-y-4" data-testid="instructor-tasks-list">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    data-testid={`instructor-task-card-${task.id}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/85 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                      </div>
                      {task.dueAt && (
                        <span className="text-xs font-bold text-amber-300">
                          موعد التسليم:{' '}
                          {new Date(task.dueAt).toLocaleDateString('ar-EG')}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-white">
                        {task.titleAr}
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                        {task.descriptionAr}
                      </p>
                    </div>

                    {task.adminNotesAr && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                        <strong>توجيهات الإدارة العليا:</strong> {task.adminNotesAr}
                      </div>
                    )}

                    <div className="space-y-2 border-t border-slate-800 pt-3">
                      <label className="block text-xs font-bold text-slate-300">
                        ملاحظات التنفيذ / ملخص الإنجاز للإدارة:
                      </label>
                      <input
                        type="text"
                        data-testid={`instructor-task-note-${task.id}`}
                        value={taskNotes[task.id] ?? ''}
                        onChange={(e) =>
                          setTaskNotes((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        placeholder="اكتب ملاحظاتك حول التقدم أو التسليم..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={
                              task.status === 'IN_PROGRESS' ? 'primary' : 'outline'
                            }
                            disabled={updatingTaskId === task.id}
                            data-testid={`task-btn-in-progress-${task.id}`}
                            onClick={() =>
                              void handleUpdateTaskStatus(task, 'IN_PROGRESS')
                            }
                          >
                            بدء التنفيذ
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              task.status === 'IN_REVIEW' ? 'primary' : 'outline'
                            }
                            disabled={updatingTaskId === task.id}
                            data-testid={`task-btn-in-review-${task.id}`}
                            onClick={() =>
                              void handleUpdateTaskStatus(task, 'IN_REVIEW')
                            }
                          >
                            إرسال للمراجعة
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              task.status === 'COMPLETED' ? 'primary' : 'outline'
                            }
                            disabled={updatingTaskId === task.id}
                            data-testid={`task-btn-completed-${task.id}`}
                            onClick={() =>
                              void handleUpdateTaskStatus(task, 'COMPLETED')
                            }
                          >
                            تم الإنجاز بالكامل
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setChatTaskId(task.id);
                            setChatBody(`استفسار/تحديث بخصوص المهمة "${task.titleAr}": `);
                          }}
                        >
                          مناقشة في الشات
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Direct Chat with Super Admin Column (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <SectionCard
            title="شات الإدارة العليا المباشر"
            subtitle="تواصل مباشر مع المدير الأعلى وإدارة الأكاديمية للاستفسارات والتنسيق ومتابعة المهام"
          >
            <div className="space-y-4">
              <div
                className="max-h-[460px] min-h-[300px] space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/90 p-3.5"
                data-testid="instructor-chat-messages"
              >
                {(workspace?.messages.length ?? 0) === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    لا توجد رسائل بعد. يمكنك إرسال رسالة مباشرة للإدارة العليا في أي وقت.
                  </div>
                ) : (
                  workspace!.messages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;
                    if (msg.isSystemTaskEvent) {
                      return (
                        <div
                          key={msg.id}
                          className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold">📋 إشعار مهام</span>
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
                        className={`flex flex-col rounded-xl border p-3 ${
                          isMine
                            ? 'ml-auto max-w-[90%] border-sky-500/40 bg-sky-950/40 text-white'
                            : 'mr-auto max-w-[90%] border-slate-700 bg-slate-900 text-slate-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-black text-sky-300">
                            {msg.sender.fullName}{' '}
                            <span className="font-normal text-slate-400">
                              ({isMine ? 'أنت' : 'الإدارة العليا'})
                            </span>
                          </span>
                          <span className="text-slate-400">
                            {new Date(msg.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>

                        {msg.task && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-950/80 px-2 py-0.5 text-[11px] text-amber-300">
                            <span>مرتبطة بمهمة:</span>
                            <strong>{msg.task.titleAr}</strong>
                          </div>
                        )}

                        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                          {msg.bodyAr}
                        </p>

                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 inline-block text-xs font-bold text-sky-400 underline"
                          >
                            فتح الرابط المرفق
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendChat}
                className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/70 p-3"
              >
                <select
                  aria-label="ربط الرسالة بمهمة"
                  value={chatTaskId}
                  onChange={(e) => setChatTaskId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">— ربط الرسالة بمهمة محددة (اختياري) —</option>
                  {(workspace?.tasks ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titleAr} ({STATUS_META[t.status].label})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={chatAttachmentUrl}
                  onChange={(e) => setChatAttachmentUrl(e.target.value)}
                  placeholder="رابط ملف أو مرجع (اختياري) https://..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                />

                <textarea
                  rows={2}
                  data-testid="instructor-chat-input"
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="اكتب رسالتك للإدارة العليا..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sendingChat}
                  data-testid="instructor-chat-send-btn"
                  className="w-full"
                >
                  إرسال الرسالة للإدارة العليا
                </Button>
              </form>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
