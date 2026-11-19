'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Power,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  NativeModal,
  inputClassName,
} from '../ui/primitives';
import { CommunityThreadModal } from './CommunityThreadModal';
import type { CommunityPostSummary } from './types';

export function InstructorCommunitiesPanel() {
  const { pushToast } = useAuth();
  const [data, setData] = useState<{
    stats: {
      totalCommunities: number;
      totalPosts: number;
      unansweredQuestions: number;
      lessonQuestions: number;
      timestampedQuestions: number;
      answeredQuestions: number;
      announcements: number;
    };
    courses: Array<{
      id: string;
      slug: string;
      titleAr: string;
      status: string;
      settings: {
        isEnabled: boolean;
        adminDisabled: boolean;
        allowStudentDiscussions: boolean;
      };
      counts: {
        total: number;
        unanswered: number;
        lessonQuestions: number;
      };
    }>;
    posts: Array<CommunityPostSummary & { courseTitleAr?: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const [announceCourseId, setAnnounceCourseId] = useState<string | null>(null);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseFilter) params.set('courseId', courseFilter);
      if (statusFilter) params.set('filter', statusFilter);
      const res = await apiFetch<any>(`/instructor/communities?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل مجتمعات الكورسات', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, statusFilter, pushToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleToggleSetting = async (
    courseId: string,
    payload: { isEnabled?: boolean; allowStudentDiscussions?: boolean },
  ) => {
    try {
      await apiFetch(`/instructor/communities/courses/${courseId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      pushToast('تم تحديث إعدادات مجتمع الكورس', 'success');
      await loadDashboard();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث إعدادات المجتمع', 'error');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceCourseId || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/community/courses/${announceCourseId}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'ANNOUNCEMENT',
          title: announceTitle.trim(),
          body: announceBody.trim(),
        }),
      });
      setAnnounceCourseId(null);
      setAnnounceTitle('');
      setAnnounceBody('');
      pushToast('تم نشر إعلان المدرب داخل مجتمع الكورس', 'success');
      await loadDashboard();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نشر الإعلان', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="info">التفاعل مع الطلاب</Badge>
          <h2 className="mt-2 text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#8CA2FF]" />
            مجتمعات كورساتي
          </h2>
          <p className="text-xs text-[#A9B1E0] mt-1">
            متابعة أسئلة الدروس والمناقشات، الرد بوسم إجابة المدرب، واعتماد أفضل الإجابات في الكورسات المسندة إليك.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4">
          <p className="text-xs font-bold text-[#A9B1E0]">إجمالي المشاركات والأسئلة</p>
          <p className="mt-1 text-2xl font-extrabold text-[#EEF0FF]">
            {data?.stats.totalPosts ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[#F5B94A]/35 bg-[#F5B94A]/10 p-4">
          <p className="text-xs font-bold text-[#F5B94A]">أسئلة بانتظار الإجابة</p>
          <p className="mt-1 text-2xl font-extrabold text-[#F5B94A]">
            {data?.stats.unansweredQuestions ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[#8CA2FF]/35 bg-[#18266E] p-4">
          <p className="text-xs font-bold text-[#EEF0FF]">أسئلة مرتبطة بالدروس</p>
          <p className="mt-1 text-2xl font-extrabold text-[#8CA2FF]">
            {data?.stats.lessonQuestions ?? 0}
          </p>
        </div>
      </div>

      {/* Assigned Course Community Settings */}
      {data?.courses && data.courses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-[#EEF0FF]">
            إعدادات المجتمعات للكورسات المسندة إليك
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.courses.map((course) => {
              const adminDisabled = Boolean(course.settings?.adminDisabled);
              const isEnabled = course.settings?.isEnabled ?? true;
              const allowStudentDiscussions =
                course.settings?.allowStudentDiscussions ?? true;

              return (
                <div
                  key={course.id}
                  className="rounded-2xl border border-[#22307A] p-4 space-y-3 bg-[#0B1440]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-bosla-ink">
                        {course.titleAr}
                      </p>
                      <p className="text-xs text-bosla-muted">
                        إجمالي المنشورات: {course.counts?.total ?? 0} • بانتظار الإجابة:{' '}
                        {course.counts?.unanswered ?? 0}
                      </p>
                    </div>
                    {adminDisabled ? (
                      <Badge tone="danger">
                        <Lock className="h-3 w-3" />
                        معطّل من الإدارة
                      </Badge>
                    ) : (
                      <Badge tone={isEnabled ? 'success' : 'warning'}>
                        {isEnabled ? 'المجتمع مفعّل' : 'مغلق مؤقتًا'}
                      </Badge>
                    )}
                  </div>

                  {adminDisabled && (
                    <AlertBanner tone="warning">
                      تم تعطيل هذا المجتمع من قِبل الإدارة ولا يمكن إعادة تفعيله من بوابة المدرب.
                    </AlertBanner>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!adminDisabled && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isEnabled ? 'outline' : 'primary'}
                        onClick={() =>
                          void handleToggleSetting(course.id, { isEnabled: !isEnabled })
                        }
                      >
                        <Power className="h-3.5 w-3.5" />
                        {isEnabled ? 'إيقاف المجتمع' : 'تفعيل المجتمع'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={adminDisabled || !isEnabled}
                      onClick={() =>
                        void handleToggleSetting(course.id, {
                          allowStudentDiscussions: !allowStudentDiscussions,
                        })
                      }
                    >
                      {allowStudentDiscussions ? 'إيقاف النقاشات العامة' : 'السماح بالنقاشات'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={adminDisabled || !isEnabled}
                      onClick={() => setAnnounceCourseId(course.id)}
                    >
                      <Megaphone className="h-3.5 w-3.5" />
                      نشر إعلان
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bosla-line pt-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'unanswered', label: 'أسئلة بدون إجابة' },
              { id: 'lesson_questions', label: 'أسئلة الدروس' },
              { id: 'timestamped', label: 'مرتبطة بوقت الفيديو' },
              { id: 'answered', label: 'تمت الإجابة' },
              { id: 'announcements', label: 'الإعلانات' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#7C95FF] text-[#070D2B] shadow-sm'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF] hover:border-[#8CA2FF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          aria-label="تصفية حسب الكورس"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-sm font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
        >
          <option value="">جميع كورساتي</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.titleAr}
            </option>
          ))}
        </select>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="py-8 text-center text-xs font-bold text-[#A9B1E0]">
          جاري تحميل الأسئلة والمناقشات...
        </div>
      ) : !data?.posts?.length ? (
        <EmptyState
          title="لا توجد أسئلة أو مناقشات ضمن هذه التصفية"
          description="ستظهر هنا جميع أسئلة الطلاب حول الدروس والمناقشات العامة لمجتمعات كورساتك."
        />
      ) : (
        <div className="space-y-3">
          {data.posts.map((post) => (
            <div
              key={post.id}
              className="rounded-2xl border border-[#22307A] p-4 space-y-2.5 bg-[#0B1440]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{post.courseTitleAr || post.courseSlug}</Badge>
                  {post.type === 'QUESTION' && (
                    <Badge tone={post.isAnswered ? 'success' : 'warning'}>
                      {post.isAnswered ? 'تمت الإجابة' : 'بانتظار الإجابة'}
                    </Badge>
                  )}
                  {post.lessonTitleAr && (
                    <Badge tone="info">
                      <BookOpen className="h-3 w-3" />
                      {post.lessonTitleAr}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-[#A9B1E0]">
                  {post.author.fullName} • {new Date(post.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActivePostId(post.id)}
                className="text-start text-sm font-extrabold text-[#EEF0FF] hover:text-[#8CA2FF] cursor-pointer transition-colors"
              >
                {post.title}
              </button>
              <p className="text-xs text-bosla-muted line-clamp-2">{post.body}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-bosla-line text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-bold text-bosla-muted">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {post.commentCount} ردود
                  </span>
                  {post.lessonId && (
                    <Link
                      href={`/learn/${post.courseSlug}?lesson=${encodeURIComponent(post.lessonId)}${
                        post.videoTimestampSeconds !== null
                          ? `&t=${post.videoTimestampSeconds}`
                          : ''
                      }&question=${encodeURIComponent(post.id)}`}
                    >
                      <Button type="button" size="sm" variant="outline">
                        <Clock className="h-3.5 w-3.5" />
                        {post.videoTimestampLabel
                          ? `مشاهدة الدقيقة المرتبطة — ${post.videoTimestampLabel}`
                          : 'الانتقال إلى الدرس'}
                      </Button>
                    </Link>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => setActivePostId(post.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  فتح والرد / اعتماد الإجابة
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcement Modal */}
      <NativeModal
        open={Boolean(announceCourseId)}
        onClose={() => setAnnounceCourseId(null)}
        title="نشر إعلان من المدرب في مجتمع الكورس"
      >
        <form onSubmit={handlePublishAnnouncement} className="space-y-4">
          <Field id="inst-ann-title" label="عنوان الإعلان" required>
            <input
              id="inst-ann-title"
              className={inputClassName}
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="تحديث هام أو موعد لقاء مراجعة مباشر"
              required
              minLength={4}
              maxLength={180}
            />
          </Field>
          <Field id="inst-ann-body" label="نص الإعلان" required>
            <textarea
              id="inst-ann-body"
              rows={4}
              className={inputClassName}
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              required
              minLength={8}
              maxLength={5000}
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'جاري النشر...' : 'نشر الإعلان وتثبيته'}
          </Button>
        </form>
      </NativeModal>

      <CommunityThreadModal
        postId={activePostId}
        open={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
        onMutated={() => void loadDashboard()}
      />
    </Card>
  );
}
