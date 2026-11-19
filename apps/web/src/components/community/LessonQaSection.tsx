'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  CheckCircle2,
  Clock,
  Heart,
  HelpCircle,
  MessageCircle,
  MessageSquarePlus,
  Search,
} from 'lucide-react';
import { formatVideoTimestamp } from '@bosla/shared';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  inputClassName,
} from '../ui/primitives';
import { CommunityThreadModal } from './CommunityThreadModal';
import type {
  CommunityAccessDecision,
  CommunityCoursePostsResponse,
  CommunityPostSummary,
} from './types';

export function LessonQaSection({
  courseId,
  courseSlug,
  lessonId,
  lessonTitleAr,
  lessonType,
  lessonDurationSeconds,
  getCurrentPlaybackSeconds,
  onSeekTimestamp,
  initialQuestionId,
  onEnrolled,
}: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  lessonTitleAr: string;
  lessonType: string;
  lessonDurationSeconds: number;
  getCurrentPlaybackSeconds: () => number;
  onSeekTimestamp: (seconds: number) => void;
  initialQuestionId?: string | null;
  onEnrolled?: () => void;
}) {
  const { pushToast } = useAuth();
  const [access, setAccess] = useState<CommunityAccessDecision | null>(null);
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [sort, setSort] = useState<'latest' | 'relevant'>('latest');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachTimestamp, setAttachTimestamp] = useState(false);
  const [capturedSeconds, setCapturedSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const [activePostId, setActivePostId] = useState<string | null>(initialQuestionId ?? null);

  useEffect(() => {
    if (initialQuestionId) {
      setActivePostId(initialQuestionId);
    }
  }, [initialQuestionId]);

  const loadQuestions = useCallback(
    async (cursor?: string) => {
      if (!cursor) setLoading(true);
      try {
        const accessRes = await apiFetch<{
          access: CommunityAccessDecision;
        }>(`/community/courses/${encodeURIComponent(courseSlug)}/access`);
        setAccess(accessRes.access);

        if (!accessRes.access.allowed) {
          setPosts([]);
          setNextCursor(null);
          return;
        }

        const params = new URLSearchParams({
          lessonId,
          filter,
          sort,
          limit: '15',
        });
        if (search.trim()) params.set('search', search.trim());
        if (cursor) params.set('cursor', cursor);

        const feedRes = await apiFetch<CommunityCoursePostsResponse>(
          `/community/courses/${encodeURIComponent(courseSlug)}/posts?${params.toString()}`,
        );

        setPosts((prev) => (cursor ? [...prev, ...feedRes.items] : feedRes.items));
        setNextCursor(feedRes.nextCursor);
      } catch (err: any) {
        pushToast(err?.message || 'تعذر تحميل أسئلة الدرس', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [courseSlug, lessonId, filter, sort, search, pushToast],
  );

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleOpenComposer = () => {
    const secs = Math.max(0, Math.floor(getCurrentPlaybackSeconds()));
    const capped =
      lessonDurationSeconds > 0 ? Math.min(secs, Math.floor(lessonDurationSeconds)) : secs;
    setCapturedSeconds(capped);
    setAttachTimestamp(lessonType === 'VIDEO' && lessonDurationSeconds > 0);
    setComposerOpen((prev) => !prev);
  };

  const handleToggleAttachTimestamp = (checked: boolean) => {
    setAttachTimestamp(checked);
    if (checked) {
      const secs = Math.max(0, Math.floor(getCurrentPlaybackSeconds()));
      const capped =
        lessonDurationSeconds > 0 ? Math.min(secs, Math.floor(lessonDurationSeconds)) : secs;
      setCapturedSeconds(capped);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiFetch(`/community/courses/${courseId}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          lessonId,
          type: 'QUESTION',
          title: title.trim(),
          body: body.trim(),
          videoTimestampSeconds:
            attachTimestamp && lessonType === 'VIDEO' ? capturedSeconds : undefined,
        }),
      });
      setTitle('');
      setBody('');
      setComposerOpen(false);
      pushToast('تم نشر سؤالك على هذا الدرس وربطه بمجتمع الكورس', 'success');
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نشر السؤال', 'error');
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

  const handleEnrollAndUnlock = async () => {
    setEnrolling(true);
    try {
      await apiFetch(`/learning/courses/${courseId}/enroll`, { method: 'POST' });
      pushToast('تم تسجيلك في الكورس وفتح أسئلة الدرس والمجتمع', 'success');
      onEnrolled?.();
      await loadQuestions();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التسجيل في الكورس', 'error');
    } finally {
      setEnrolling(false);
    }
  };

  const timestampLabel = formatVideoTimestamp(capturedSeconds) || '00:00';

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22307A] pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[#8CA2FF]" />
            أسئلة هذا الدرس
          </h2>
          <p className="text-xs text-bosla-muted mt-1">
            اسأل عن أي نقطة داخل &laquo;{lessonTitleAr}&raquo; وسيظهر سؤالك هنا وداخل مجتمع الكورس الموحد.
          </p>
        </div>

        {access?.allowed && access.canPost && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenComposer}
          >
            <MessageSquarePlus className="h-4 w-4" />
            اسأل عن هذا الدرس
          </Button>
        )}
      </div>

      {!loading && access && !access.allowed && (
        <AlertBanner
          tone={access.reason === 'MEMBERSHIP_EXPIRED' ? 'warning' : 'info'}
          title="الوصول إلى أسئلة هذا الدرس"
        >
          <div className="space-y-3">
            <p>{access.messageAr}</p>
            <div className="flex flex-wrap gap-2">
              {access.reason === 'NOT_ENROLLED' && (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={enrolling}
                  onClick={() => void handleEnrollAndUnlock()}
                >
                  {enrolling ? 'جاري التفعيل...' : 'بدء الكورس وفتح الأسئلة'}
                </Button>
              )}
              {(access.reason === 'NO_ACTIVE_MEMBERSHIP' ||
                access.reason === 'MEMBERSHIP_EXPIRED') && (
                <Link href="/pricing">
                  <Button type="button" size="sm" variant="gold">
                    {access.reason === 'MEMBERSHIP_EXPIRED'
                      ? 'تجديد العضوية'
                      : 'استعراض باقات العضوية'}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </AlertBanner>
      )}

      {access?.allowed && composerOpen && (
        <form
          onSubmit={handleSubmitQuestion}
          className="rounded-2xl border border-[#8CA2FF]/35 bg-[#18266E] p-4 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[#EEF0FF]">عندك سؤال عن الدرس؟</h3>
            {lessonType === 'VIDEO' && lessonDurationSeconds > 0 && (
              <label className="inline-flex items-center gap-2 text-xs font-bold text-bosla-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachTimestamp}
                  onChange={(e) => handleToggleAttachTimestamp(e.target.checked)}
                />
                <span>ربط السؤال بالوقت الحالي من الفيديو</span>
                {attachTimestamp && (
                  <Badge tone="info">
                    <Clock className="h-3 w-3" />
                    <span dir="ltr">{timestampLabel}</span>
                  </Badge>
                )}
              </label>
            )}
          </div>

          <Field id="lesson-q-title" label="عنوان السؤال" required>
            <input
              id="lesson-q-title"
              className={inputClassName}
              placeholder="مثال: ما هي درجة الحرارة المثالية للتهوية في الأسبوع الأول؟"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={4}
              maxLength={180}
            />
          </Field>

          <Field id="lesson-q-body" label="تفاصيل سؤالك" required>
            <textarea
              id="lesson-q-body"
              rows={3}
              className={inputClassName}
              placeholder="اكتب استفسارك بوضوح ليساعدك المدرب وزملاؤك..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={8}
              maxLength={5000}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'جاري النشر...' : 'نشر السؤال'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setComposerOpen(false)}
            >
              إلغاء
            </Button>
          </div>
        </form>
      )}

      {access?.allowed && (
        <>
          {/* Filter / Sort / Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: 'جميع الأسئلة' },
                  { id: 'unanswered', label: 'بدون إجابة' },
                  { id: 'answered', label: 'تمت الإجابة' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                    filter === item.id
                      ? 'bg-[#7C95FF] text-[#070D2B] shadow-sm'
                      : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF] hover:border-[#8CA2FF]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-[#A9B1E0] absolute top-3.5 start-3 pointer-events-none" />
                <input
                  type="search"
                  aria-label="ابحث في أسئلة هذا الدرس"
                  placeholder="ابحث في أسئلة الدرس..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
                />
              </div>
              <select
                aria-label="ترتيب الأسئلة"
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
            <div className="py-8 text-center text-xs font-bold text-[#A9B1E0]">
              جاري تحميل أسئلة الدرس...
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title="لا توجد أسئلة لهذا الدرس حتى الآن"
              description="لا توجد أسئلة لهذا الدرس حتى الآن. كن أول من يسأل!"
              action={
                access.canPost ? (
                  <Button type="button" variant="primary" size="sm" onClick={handleOpenComposer}>
                    اسأل عن هذا الدرس
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {posts.map((q) => (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                    q.isPinned
                      ? 'border-[#F5B94A]/50 bg-[#F5B94A]/10'
                      : 'border-[#22307A] bg-[#0B1440] hover:border-[#8CA2FF]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {q.isPinned && <Badge tone="warning">مثبت</Badge>}
                      <Badge tone={q.isAnswered ? 'success' : 'warning'}>
                        {q.isAnswered ? 'تمت الإجابة' : 'بانتظار الإجابة'}
                      </Badge>
                      {q.instructorParticipated && (
                        <Badge tone="info">
                          <Award className="h-3 w-3" />
                          إجابة المدرب
                        </Badge>
                      )}
                      {q.videoTimestampSeconds !== null && q.videoTimestampLabel && (
                        <button
                          type="button"
                          onClick={() => onSeekTimestamp(q.videoTimestampSeconds!)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/15 px-3 py-1 text-xs font-extrabold text-[#8CA2FF] hover:bg-[#7C95FF]/25 cursor-pointer transition-colors"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>شاهد الجزء المرتبط بالسؤال — {q.videoTimestampLabel}</span>
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-[#A9B1E0]">
                      {q.author.fullName} • {new Date(q.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setActivePostId(q.id)}
                      className="text-start text-sm font-extrabold text-[#EEF0FF] hover:text-[#8CA2FF] cursor-pointer transition-colors"
                    >
                      {q.title}
                    </button>
                    <p className="mt-1 text-xs leading-relaxed text-[#A9B1E0] line-clamp-2">
                      {q.body}
                    </p>
                  </div>

                  {q.acceptedComment && (
                    <div className="rounded-xl border border-[#77E2B5]/35 bg-[#77E2B5]/10 p-3 text-xs space-y-1">
                      <p className="font-extrabold text-[#77E2B5] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        الإجابة المعتمدة ({q.acceptedComment.author.fullName}):
                      </p>
                      <p className="text-[#EEF0FF] line-clamp-2">{q.acceptedComment.body}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleLike(q.id)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold ${
                          q.viewerHasLiked
                            ? 'border-[#FF9CAA]/50 bg-[#FF9CAA]/15 text-[#FF9CAA]'
                            : 'border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${q.viewerHasLiked ? 'fill-current' : ''}`} />
                        {q.likeCount}
                      </button>
                      <span className="inline-flex items-center gap-1 text-bosla-muted font-bold">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {q.commentCount} ردود
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActivePostId(q.id)}
                    >
                      عرض الإجابات والمناقشة
                    </Button>
                  </div>
                </div>
              ))}

              {nextCursor && (
                <div className="pt-2 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => {
                      setLoadingMore(true);
                      void loadQuestions(nextCursor);
                    }}
                  >
                    {loadingMore ? 'جاري التحميل...' : 'عرض المزيد من الأسئلة'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CommunityThreadModal
        postId={activePostId}
        open={Boolean(activePostId)}
        onClose={() => setActivePostId(null)}
        onJumpToLessonTimestamp={(_targetLessonId, seconds) => {
          if (seconds !== null) {
            onSeekTimestamp(seconds);
          }
        }}
        onMutated={() => void loadQuestions()}
      />
    </Card>
  );
}
