'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  MessageCircle,
  MessageSquarePlus,
  Search,
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
import type {
  CommunityAccessDecision,
  CommunityCoursePostsResponse,
  CommunityPostSummary,
  CommunitySettingsSummary,
} from './types';

export interface CommunityLessonOption {
  id: string;
  titleAr: string;
  type: string;
  durationSeconds: number;
}

export function CourseCommunityPanel({
  courseSlug,
  lessons = [],
  initialQuestionId,
  onNavigateToLessonTimestamp,
  onEnrolled,
}: {
  courseSlug: string;
  lessons?: CommunityLessonOption[];
  initialQuestionId?: string | null;
  onNavigateToLessonTimestamp?: (lessonId: string, seconds: number | null, postId: string) => void;
  onEnrolled?: () => void;
}) {
  const router = useRouter();
  const { pushToast } = useAuth();

  const [courseMeta, setCourseMeta] = useState<{
    id: string;
    slug: string;
    titleAr: string;
  } | null>(null);
  const [settings, setSettings] = useState<CommunitySettingsSummary | null>(null);
  const [access, setAccess] = useState<CommunityAccessDecision | null>(null);
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filter, setFilter] = useState<
    'all' | 'questions' | 'lesson_questions' | 'unanswered' | 'answered' | 'announcements'
  >('all');
  const [sort, setSort] = useState<'latest' | 'relevant'>('latest');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [postType, setPostType] = useState<'DISCUSSION' | 'QUESTION' | 'ANNOUNCEMENT'>('QUESTION');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const [activePostId, setActivePostId] = useState<string | null>(initialQuestionId ?? null);

  useEffect(() => {
    if (initialQuestionId) setActivePostId(initialQuestionId);
  }, [initialQuestionId]);

  const loadFeed = useCallback(
    async (cursor?: string) => {
      if (!cursor) setLoading(true);
      try {
        const accessRes = await apiFetch<{
          course: { id: string; slug: string; titleAr: string };
          settings: CommunitySettingsSummary;
          access: CommunityAccessDecision;
        }>(`/community/courses/${encodeURIComponent(courseSlug)}/access`);

        setCourseMeta(accessRes.course);
        setSettings(accessRes.settings);
        setAccess(accessRes.access);

        if (!accessRes.access.allowed) {
          setPosts([]);
          setNextCursor(null);
          return;
        }

        const params = new URLSearchParams({
          filter,
          sort,
          limit: '20',
        });
        if (search.trim()) params.set('search', search.trim());
        if (cursor) params.set('cursor', cursor);

        const feed = await apiFetch<CommunityCoursePostsResponse>(
          `/community/courses/${encodeURIComponent(courseSlug)}/posts?${params.toString()}`,
        );
        setPosts((prev) => (cursor ? [...prev, ...feed.items] : feed.items));
        setNextCursor(feed.nextCursor);
      } catch (err: any) {
        pushToast(err?.message || 'تعذر تحميل مجتمع الكورس', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [courseSlug, filter, sort, search, pushToast],
  );

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleEnroll = async () => {
    if (!courseMeta) return;
    setEnrolling(true);
    try {
      await apiFetch(`/learning/courses/${courseMeta.id}/enroll`, { method: 'POST' });
      pushToast('تم تسجيلك في الكورس وفتح الوصول إلى مجتمع الكورس', 'success');
      onEnrolled?.();
      await loadFeed();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التسجيل في الكورس', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseMeta || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/community/courses/${courseMeta.id}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          type: postType,
          lessonId: selectedLessonId || undefined,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      setTitle('');
      setBody('');
      setSelectedLessonId('');
      setCreateOpen(false);
      pushToast('تم نشر المشاركة في مجتمع الكورس', 'success');
      await loadFeed();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نشر المشاركة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/community/posts/${postId}/like`,
        { method: 'POST' },
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, viewerHasLiked: res.liked, likeCount: res.likeCount }
            : p,
        ),
      );
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الإعجاب', 'error');
    }
  };

  const handleJumpTimestamp = async (post: CommunityPostSummary) => {
    try {
      const target = await apiFetch<{
        lessonId: string;
        seekSeconds: number;
        postId: string;
        playerPath: string;
      }>(`/community/posts/${post.id}/timestamp-target`);
      if (onNavigateToLessonTimestamp) {
        onNavigateToLessonTimestamp(
          target.lessonId,
          post.videoTimestampSeconds !== null ? target.seekSeconds : null,
          target.postId,
        );
      } else {
        router.push(target.playerPath);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الانتقال إلى الدرس المرتبط', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="info">مجتمع تعليمي خاص بالكورس</Badge>
            <h2 className="mt-2 text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#8CA2FF]" />
              مجتمع الكورس {courseMeta ? `— ${courseMeta.titleAr}` : ''}
            </h2>
            <p className="text-xs text-bosla-muted mt-1">
              مجتمع موحد يضم جميع الطلاب المشتركين عبر العضوية الشهرية أو السنوية أو المسارات والدبلومات، إلى جانب مدرب الكورس.
            </p>
          </div>

          {access?.allowed && access.canPost && (
            <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              مشاركة أو سؤال جديد
            </Button>
          )}
        </div>

        {!loading && access && !access.allowed && (
          <AlertBanner
            tone={access.reason === 'MEMBERSHIP_EXPIRED' ? 'warning' : 'info'}
            title="الوصول إلى المجتمع الخاص مقيد حاليًا"
          >
            <div className="space-y-3">
              <p>{access.messageAr}</p>
              <div className="flex flex-wrap gap-2">
                {access.reason === 'NOT_AUTHENTICATED' && (
                  <Link href={`/login?next=/courses/${courseSlug}/community`}>
                    <Button type="button" size="sm" variant="primary">
                      تسجيل الدخول
                    </Button>
                  </Link>
                )}
                {access.reason === 'NOT_ENROLLED' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={enrolling}
                    onClick={() => void handleEnroll()}
                  >
                    {enrolling ? 'جاري التسجيل...' : 'سجّل وابدأ الكورس للدخول إلى المجتمع'}
                  </Button>
                )}
                {(access.reason === 'MEMBERSHIP_EXPIRED' ||
                  access.reason === 'NO_ACTIVE_MEMBERSHIP') && (
                  <Link href="/pricing">
                    <Button type="button" size="sm" variant="gold">
                      {access.reason === 'MEMBERSHIP_EXPIRED'
                        ? 'تجديد الاشتراك لاستعادة الوصول'
                        : 'استعراض باقات الاشتراك'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </AlertBanner>
        )}

        {access?.allowed && settings && !settings.allowStudentDiscussions && !access.canModerate && (
          <AlertBanner tone="warning">
            تم اقتصار المناقشات العامة حاليًا من قِبل مدرب الكورس؛ لا تزال قراءة الأسئلة والإعلانات متاحة.
          </AlertBanner>
        )}
      </Card>

      {access?.allowed && (
        <Card className="p-6 space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: 'جميع المناقشات' },
                  { id: 'questions', label: 'الأسئلة' },
                  { id: 'lesson_questions', label: 'أسئلة الدروس' },
                  { id: 'unanswered', label: 'بدون إجابة' },
                  { id: 'answered', label: 'تمت الإجابة' },
                  { id: 'announcements', label: 'إعلانات المدرب' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[#7C95FF] text-[#070D2B] shadow-sm'
                      : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF] hover:border-[#8CA2FF]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-[#A9B1E0] absolute top-3.5 start-3 pointer-events-none" />
                <input
                  type="search"
                  aria-label="بحث في مناقشات الكورس"
                  placeholder="ابحث في مجتمع الكورس..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
                />
              </div>
              <select
                aria-label="ترتيب المناقشات"
                value={sort}
                onChange={(e) => setSort(e.target.value as 'latest' | 'relevant')}
                className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-sm font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
              >
                <option value="latest">الأحدث</option>
                <option value="relevant">الأكثر تفاعلاً</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs font-bold text-bosla-muted">
              جاري تحميل المناقشات...
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title="لا توجد مناقشات مطابقة لبحثك"
              description="ابدأ أول سؤال أو مناقشة مع زملائك ومدرب الكورس."
              action={
                access.canPost ? (
                  <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                    مشاركة جديدة
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`rounded-2xl border p-5 space-y-3 ${
                    post.isPinned
                      ? 'border-[#F5B94A]/50 bg-[#F5B94A]/10'
                      : post.type === 'ANNOUNCEMENT'
                        ? 'border-[#C4B5FD]/40 bg-[#C4B5FD]/10'
                        : 'border-[#22307A] bg-[#0B1440]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.isPinned && <Badge tone="warning">مثبت</Badge>}
                      <Badge
                        tone={
                          post.type === 'ANNOUNCEMENT'
                            ? 'purple'
                            : post.type === 'QUESTION'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {post.type === 'ANNOUNCEMENT'
                          ? 'إعلان المدرب'
                          : post.type === 'QUESTION'
                            ? 'سؤال'
                            : 'مناقشة'}
                      </Badge>
                      {post.type === 'QUESTION' && (
                        <Badge tone={post.isAnswered ? 'success' : 'warning'}>
                          {post.isAnswered ? 'تمت الإجابة' : 'بانتظار الإجابة'}
                        </Badge>
                      )}
                      {post.instructorParticipated && (
                        <Badge tone="info">
                          <Award className="h-3 w-3" />
                          إجابة المدرب
                        </Badge>
                      )}
                      {post.lessonTitleAr && (
                        <Badge tone="neutral">
                          <BookOpen className="h-3 w-3" />
                          {post.lessonTitleAr}
                        </Badge>
                      )}
                    </div>

                    <span className="text-[11px] text-bosla-muted">
                      {post.author.fullName} • {new Date(post.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setActivePostId(post.id)}
                      className="text-start text-base font-extrabold text-[#EEF0FF] hover:text-[#8CA2FF] cursor-pointer transition-colors"
                    >
                      {post.title}
                    </button>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#A9B1E0] line-clamp-3">
                      {post.body}
                    </p>
                  </div>

                  {post.acceptedComment && (
                    <div className="rounded-xl border border-[#77E2B5]/35 bg-[#77E2B5]/10 p-3 text-xs space-y-1">
                      <p className="font-extrabold text-[#77E2B5] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        الإجابة المعتمدة:
                      </p>
                      <p className="text-[#EEF0FF] line-clamp-2">{post.acceptedComment.body}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#22307A] text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleLike(post.id)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold ${
                          post.viewerHasLiked
                            ? 'border-[#FF9CAA]/50 bg-[#FF9CAA]/15 text-[#FF9CAA]'
                            : 'border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${post.viewerHasLiked ? 'fill-current' : ''}`} />
                        {post.likeCount}
                      </button>
                      <span className="inline-flex items-center gap-1 text-[#A9B1E0] font-bold">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {post.commentCount} ردود
                      </span>
                      {post.lessonId && (
                        <button
                          type="button"
                          onClick={() => void handleJumpTimestamp(post)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#8CA2FF]/40 bg-[#7C95FF]/15 px-2.5 py-1 font-bold text-[#8CA2FF] hover:bg-[#7C95FF]/25 cursor-pointer transition-colors"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {post.videoTimestampLabel
                            ? `مشاهدة الدقيقة المرتبطة بالسؤال — ${post.videoTimestampLabel}`
                            : 'الانتقال إلى الدرس'}
                        </button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActivePostId(post.id)}
                    >
                      عرض المناقشة والإجابات
                    </Button>
                  </div>
                </div>
              ))}

              {nextCursor && (
                <div className="text-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => {
                      setLoadingMore(true);
                      void loadFeed(nextCursor);
                    }}
                  >
                    {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Create Post Modal */}
      <NativeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء مشاركة في مجتمع الكورس"
      >
        <form onSubmit={handleCreatePost} className="space-y-4">
          <Field id="cc-type" label="نوع المشاركة">
            <select
              id="cc-type"
              className={inputClassName}
              value={postType}
              onChange={(e) =>
                setPostType(e.target.value as 'DISCUSSION' | 'QUESTION' | 'ANNOUNCEMENT')
              }
            >
              <option value="QUESTION">سؤال تعليمي</option>
              <option value="DISCUSSION">مناقشة عامة حول الكورس</option>
              {access?.canModerate && <option value="ANNOUNCEMENT">إعلان من المدرب</option>}
            </select>
          </Field>

          {lessons.length > 0 && postType !== 'ANNOUNCEMENT' && (
            <Field id="cc-lesson" label="ربط بدرس محدد (اختياري)">
              <select
                id="cc-lesson"
                className={inputClassName}
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
              >
                <option value="">مشاركة عامة على مستوى الكورس</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titleAr}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field id="cc-title" label="العنوان" required>
            <input
              id="cc-title"
              className={inputClassName}
              placeholder="اكتب عنوانًا واضحًا للمناقشة أو السؤال"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={4}
              maxLength={180}
            />
          </Field>

          <Field id="cc-body" label="المحتوى" required>
            <textarea
              id="cc-body"
              rows={4}
              className={inputClassName}
              placeholder="شارك استفسارك أو تجربتك العملية مع زملائك..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={8}
              maxLength={5000}
            />
          </Field>

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'جاري النشر...' : 'نشر في مجتمع الكورس'}
          </Button>
        </form>
      </NativeModal>

      <CommunityThreadModal
        postId={activePostId}
        open={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
        onJumpToLessonTimestamp={(lessonId, seconds, postId) => {
          if (onNavigateToLessonTimestamp) {
            onNavigateToLessonTimestamp(lessonId, seconds, postId);
          } else {
            router.push(
              `/learn/${courseSlug}?lesson=${encodeURIComponent(lessonId)}${
                seconds !== null ? `&t=${seconds}` : ''
              }&question=${encodeURIComponent(postId)}`,
            );
          }
        }}
        onMutated={() => void loadFeed()}
      />
    </div>
  );
}
