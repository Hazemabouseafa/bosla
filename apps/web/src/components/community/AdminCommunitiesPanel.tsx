'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  EyeOff,
  Flag,
  Lock,
  MessageSquare,
  Power,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { apiFetch, formatDateTime } from '../../lib/api';
import { getRoleLabel } from '../../lib/labels';
import { useAuth } from '../../lib/auth-context';
import { Badge, Button, Card } from '../ui/primitives';
import { CommunityThreadModal } from './CommunityThreadModal';

export function AdminCommunitiesPanel() {
  const { pushToast } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [postFilter, setPostFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const loadAdminCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseFilter) params.set('courseId', courseFilter);
      if (postFilter) params.set('filter', postFilter);
      if (search.trim()) params.set('search', search.trim());

      const [ov, reps, feed] = await Promise.all([
        apiFetch<any>('/admin/communities/overview'),
        apiFetch<any[]>('/admin/communities/reports?status=PENDING'),
        apiFetch<any[]>(`/admin/communities/posts?${params.toString()}`),
      ]);
      setOverview(ov);
      setReports(reps);
      setPosts(feed);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إدارة المجتمعات', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, postFilter, search, pushToast]);

  useEffect(() => {
    void loadAdminCommunities();
  }, [loadAdminCommunities]);

  const handleToggleAdminCommunity = async (
    courseId: string,
    enable: boolean,
  ) => {
    try {
      await apiFetch(`/admin/communities/courses/${courseId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          isEnabled: enable,
          adminDisabled: !enable,
        }),
      });
      pushToast(
        enable
          ? 'تم تفعيل مجتمع الكورس بنجاح'
          : 'تم تعطيل مجتمع الكورس إداريًا',
        'info',
      );
      await loadAdminCommunities();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة المجتمع', 'error');
    }
  };

  const handleResolveReport = async (
    reportId: string,
    removeTarget: boolean,
  ) => {
    try {
      await apiFetch(`/admin/communities/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status: removeTarget ? 'ACTION_TAKEN' : 'DISMISSED',
          removeTarget,
          resolutionNotes: removeTarget
            ? 'تمت إزالة المحتوى المخالف بواسطة الإدارة'
            : 'تمت مراجعة البلاغ وحفظ المحتوى',
        }),
      });
      pushToast('تم البت في البلاغ وتوثيق السجل', 'success');
      await loadAdminCommunities();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حل البلاغ', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">الأسئلة والمناقشات</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#EEF0FF]">
            {overview?.stats?.totalPosts ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">ردود المدربين</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#8CA2FF]">
            {overview?.stats?.instructorResponseCount ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">أسئلة بدون إجابة</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#F5B94A]">
            {overview?.stats?.unansweredQuestions ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">بلاغات مفتوحة</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#FF9CAA]">
            {overview?.stats?.pendingReportsCount ?? reports.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">متوسط استجابة المدرب</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#77E2B5]">
            {overview?.stats?.averageResponseTimeMinutes ?? 0} د
          </p>
        </Card>
      </div>

      {/* Reports Queue */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
          <Flag className="h-5 w-5 text-[#FF9CAA]" />
          البلاغات والمراجعة الإدارية ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-[#A9B1E0]">
            لا توجد بلاغات مفتوحة حاليًا.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FF9CAA]/40 bg-[#FF9CAA]/10 p-4 text-sm"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">
                      {rep.targetType === 'POST' ? 'مشاركة' : 'تعليق'}
                    </Badge>
                    <span className="font-extrabold text-[#EEF0FF]">
                      المُبلّغ: {rep.reporter?.fullName}
                    </span>
                    <span className="text-[#A9B1E0]">
                      ({rep.course?.slug})
                    </span>
                  </div>
                  <p className="font-bold text-[#FF9CAA]">السبب: {rep.reason}</p>
                  {rep.details && <p className="text-bosla-muted">{rep.details}</p>}
                  {rep.post?.title && (
                    <p className="text-bosla-ink font-semibold">
                      المشاركة: {rep.post.title}
                    </p>
                  )}
                  {rep.comment?.body && (
                    <p className="text-bosla-ink font-semibold">
                      التعليق: {rep.comment.body}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void handleResolveReport(rep.id, true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    إزالة المحتوى وحل البلاغ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleResolveReport(rep.id, false)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    إغلاق البلاغ مع الإبقاء
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Course Communities Governance & Most Active Courses */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#8CA2FF]" />
            تفعيل وتعطيل مجتمعات الكورسات ({overview?.courses?.length ?? 0})
          </h2>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pe-1">
            {(overview?.courses ?? []).map((course: any) => {
              const adminDisabled = Boolean(course.adminDisabled);
              const isEnabled = course.isEnabled ?? true;
              return (
                <div
                  key={course.courseId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 text-xs"
                >
                  <div>
                    <p className="font-extrabold text-bosla-ink">
                      {course.titleAr}
                    </p>
                    <p className="text-bosla-muted">
                      المدرب: {course.instructorName} • المنشورات:{' '}
                      {course.counts?.total ?? 0} • بدون إجابة:{' '}
                      {course.counts?.unanswered ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {adminDisabled ? (
                      <Badge tone="danger">
                        <Lock className="h-3 w-3" />
                        معطّل إداريًا
                      </Badge>
                    ) : isEnabled ? (
                      <Badge tone="success">مفعّل</Badge>
                    ) : (
                      <Badge tone="warning">معطّل من المدرب</Badge>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant={adminDisabled || !isEnabled ? 'primary' : 'danger'}
                      onClick={() =>
                        void handleToggleAdminCommunity(
                          course.courseId,
                          adminDisabled || !isEnabled,
                        )
                      }
                    >
                      <Power className="h-3.5 w-3.5" />
                      {adminDisabled || !isEnabled ? 'إعادة التفعيل' : 'تعطيل المجتمع'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-4 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#F5B94A]" />
            أكثر الكورسات تفاعلاً
          </h2>
          <div className="space-y-2.5">
            {(overview?.mostActiveCourses ?? []).map((item: any) => (
              <div
                key={item.courseId}
                className="flex items-center justify-between rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs sm:text-sm"
              >
                <span className="font-extrabold text-[#EEF0FF] truncate">
                  {item.titleAr}
                </span>
                <Badge tone="info">{item.counts?.total ?? 0} مشاركة</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Cross-Course Moderation Explorer */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#8CA2FF]" />
            مستكشف المشاركات والأسئلة عبر المنصة ({posts.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-[#A9B1E0] absolute top-3.5 start-3 pointer-events-none" />
              <input
                type="search"
                aria-label="بحث في منشورات المجتمعات"
                placeholder="بحث بالعنوان أو المحتوى..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoCorrect="off"
                spellCheck={false}
                className="min-h-[44px] rounded-[10px] border border-[#22307A] bg-[#0B1440] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
              />
            </div>

            <select
              aria-label="تصفية الكورس"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="min-h-[44px] rounded-[10px] border border-[#22307A] bg-[#0B1440] px-3 text-sm font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
            >
              <option value="">كل الكورسات</option>
              {(overview?.courses ?? []).map((c: any) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.titleAr}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية الحالة"
              value={postFilter}
              onChange={(e) => setPostFilter(e.target.value)}
              className="min-h-[44px] rounded-[10px] border border-[#22307A] bg-[#0B1440] px-3 text-sm font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
            >
              <option value="all">الكل</option>
              <option value="unanswered">أسئلة بدون إجابة</option>
              <option value="hidden">المخفية</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs font-bold text-bosla-muted">
            جاري تحميل المشاركات...
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pe-1">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 text-xs"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{post.courseTitleAr || post.courseSlug}</Badge>
                    {post.status === 'HIDDEN' && (
                      <Badge tone="warning">
                        <EyeOff className="h-3 w-3" />
                        مخفي
                      </Badge>
                    )}
                    {post.type === 'QUESTION' && (
                      <Badge tone={post.isAnswered ? 'success' : 'warning'}>
                        {post.isAnswered ? 'تمت الإجابة' : 'بدون إجابة'}
                      </Badge>
                    )}
                  </div>
                  <p className="font-extrabold text-bosla-ink">{post.title}</p>
                  <p className="text-bosla-muted line-clamp-1">
                    {post.author?.fullName} • {post.body}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setActivePostId(post.id)}
                >
                  مراجعة وإشراف
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Moderation Audit Log */}
      {overview?.moderationLogs?.length > 0 && (
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-extrabold text-bosla-ink">
            سجل إشراف المجتمعات الأخير
          </h2>
          <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
            {overview.moderationLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between border-b border-bosla-line py-2"
              >
                <span>
                  <code className="font-bold text-bosla-tealText">{log.action}</code> —{' '}
                  {log.actor?.fullName} ({getRoleLabel(log.actorRole)})
                </span>
                <span className="text-bosla-muted tabular-nums">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CommunityThreadModal
        postId={activePostId}
        open={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
        onMutated={() => void loadAdminCommunities()}
      />
    </div>
  );
}
