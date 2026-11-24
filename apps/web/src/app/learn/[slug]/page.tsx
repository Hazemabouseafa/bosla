'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileDown,
  FileQuestion,
  Lock,
  PlayCircle,
  Send,
  Star,
  Users,
} from 'lucide-react';
import { apiFetch, formatEgp, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CourseCommunityPanel } from '@/components/community/CourseCommunityPanel';
import { LessonQaSection } from '@/components/community/LessonQaSection';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { BoslaHlsPlayer } from '@/components/player/BoslaHlsPlayer';
import { ProgressRingSvg } from '@/components/svg/ProgressRingSvg';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  SkeletonDashboardGrid,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

export default function CoursePlayerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { user, isLoading: authLoading, pushToast } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Community & Video Timestamp Integration state
  const [activeTab, setActiveTab] = useState<'lesson' | 'community'>('lesson');
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);
  const [seekTriggerKey, setSeekTriggerKey] = useState<number>(0);
  const [deepLinkQuestionId, setDeepLinkQuestionId] = useState<string | null>(null);
  const livePlaybackSecondsRef = useRef<number>(0);
  const livePlaybackDurationRef = useRef<number>(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const autoEnrolledCourseRef = useRef<string | null>(null);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  // Competency Request + Direct Purchase + Dual Program/Instructor Review state
  const [compNotes, setCompNotes] = useState('');
  const [compEvidenceUrl, setCompEvidenceUrl] = useState('');
  const [compBusy, setCompBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);

  const [revCourseRating, setRevCourseRating] = useState(5);
  const [revInstructorRating, setRevInstructorRating] = useState(5);
  const [revInstructorId, setRevInstructorId] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revBusy, setRevBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const lessonParam = sp.get('lesson');
    const tParam = sp.get('t');
    const questionParam = sp.get('question');
    const tabParam = sp.get('tab');

    if (tabParam === 'community') {
      setActiveTab('community');
    }
    if (lessonParam) {
      setSelectedLessonId(lessonParam);
      setActiveTab('lesson');
    }
    if (tParam !== null && !Number.isNaN(Number(tParam))) {
      setSeekToSeconds(Math.max(0, Math.floor(Number(tParam))));
      setSeekTriggerKey((k) => k + 1);
    }
    if (questionParam) {
      setDeepLinkQuestionId(questionParam);
    }
  }, []);

  const loadPlayer = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!slug) return;
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await apiFetch<any>(
          `/learning/courses/${encodeURIComponent(slug)}/player`,
        );
        if (
          user &&
          res?.access?.allowed &&
          !res?.hasStartedCourse &&
          user.role === 'STUDENT' &&
          autoEnrolledCourseRef.current !== res.course?.id
        ) {
          autoEnrolledCourseRef.current = res.course.id;
          try {
            await apiFetch(`/learning/courses/${res.course.id}/enroll`, {
              method: 'POST',
            });
          } catch {
            // Non-fatal fallback: community UI still offers manual enroll button
          }
        }
        setData(res);
        if (res?.course?.instructor?.id) {
          setRevInstructorId((prev) => prev || res.course.instructor.id);
        }
        if (res?.myReview) {
          setRevCourseRating(res.myReview.rating ?? 5);
          setRevInstructorRating(res.myReview.instructorRating ?? res.myReview.rating ?? 5);
          if (res.myReview.instructorId) setRevInstructorId(res.myReview.instructorId);
          setRevComment(res.myReview.commentAr || '');
        }
        setSelectedLessonId((prev) => {
          if (prev) return prev;
          const all = (res.sections ?? []).flatMap((s: any) => s.lessons ?? []);
          const firstAccessible = all.find((l: any) => l.hasAccess);
          return firstAccessible?.id ?? all[0]?.id ?? null;
        });
      } catch (err: any) {
        setError(err?.message || 'تعذر تحميل بيانات مشغل الكورس.');
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [slug, user],
  );

  useEffect(() => {
    if (!authLoading) {
      void loadPlayer();
    }
  }, [user, authLoading, loadPlayer]);

  const progressMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of data?.progress ?? []) {
      map.set(p.lessonStableKey, p);
    }
    return map;
  }, [data?.progress]);

  const allLessons: any[] = useMemo(
    () => (data?.sections ?? []).flatMap((s: any) => s.lessons ?? []),
    [data?.sections],
  );

  const currentLesson = useMemo(
    () => allLessons.find((l) => l.id === selectedLessonId) ?? allLessons[0] ?? null,
    [allLessons, selectedLessonId],
  );

  const currentProgress = currentLesson
    ? progressMap.get(currentLesson.stableKey)
    : null;

  const completedCount = allLessons.filter(
    (l) => progressMap.get(l.stableKey)?.isCompleted,
  ).length;
  const courseProgressPercent =
    allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;
  const currentLessonIndex = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1;
  const prevLesson =
    currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex + 1 < allLessons.length
      ? allLessons[currentLessonIndex + 1]
      : null;

  const jumpToLessonAndSeek = (
    targetLessonId: string,
    seconds: number | null,
  ) => {
    setActiveTab('lesson');
    setSelectedLessonId(targetLessonId);
    setQuizResult(null);
    setAnswers({});
    setDeepLinkQuestionId(null);
    if (seconds !== null && Number.isFinite(seconds)) {
      setSeekToSeconds(Math.max(0, Math.floor(seconds)));
      setSeekTriggerKey((k) => k + 1);
    }
    playerContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const markArticleCompleted = async () => {
    if (!currentLesson) return;
    try {
      const res = await apiFetch<any>(`/learning/lessons/${currentLesson.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          watchedSeconds: Math.max(currentLesson.durationSeconds || 60, 1),
          durationSeconds: Math.max(currentLesson.durationSeconds || 60, 1),
          isCompleted: true,
        }),
      });
      pushToast('تم تسجيل إتمام الدرس بنجاح', 'success');
      if (res?.issuedCertificate) {
        pushToast(
          `تهانينا! صدرت شهادتك برمز ${res.issuedCertificate.certificateCode}`,
          'success',
        );
      }
      await loadPlayer({ silent: true });
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التقدم', 'error');
    }
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLesson?.quiz) return;
    setQuizBusy(true);
    try {
      const idemKey = `qz-${currentLesson.quiz.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await apiFetch<any>(
        `/learning/quizzes/${currentLesson.quiz.id}/attempts`,
        {
          method: 'POST',
          body: JSON.stringify({ answers, idempotencyKey: idemKey }),
        },
      );
      setQuizResult(res);
      pushToast(
        res.passed
          ? `أحسنت! اجتزت الاختبار بنسبة ${res.scorePercent}%`
          : `حصلت على ${res.scorePercent}% — حاول مرة أخرى`,
        res.passed ? 'success' : 'info',
      );
      await loadPlayer({ silent: true });
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال إجابات الاختبار', 'error');
    } finally {
      setQuizBusy(false);
    }
  };

  const handleDirectCoursePurchase = async () => {
    if (!data?.course?.id) return;
    setBuyBusy(true);
    try {
      const res = await apiFetch<{ checkoutUrl: string }>('/memberships/checkout-item', {
        method: 'POST',
        body: JSON.stringify({ targetType: 'COURSE', targetId: data.course.id }),
      });
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر بدء عملية الدفع الإلكتروني', 'error');
    } finally {
      setBuyBusy(false);
    }
  };

  const handleRequestCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.course?.id) return;
    setCompBusy(true);
    try {
      await apiFetch('/learning/competency-requests', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'COURSE',
          courseId: data.course.id,
          studentNotesAr: compNotes.trim() || undefined,
          evidenceUrl: compEvidenceUrl.trim() || undefined,
        }),
      });
      pushToast('تم إرسال طلب شهادة الكفاءة المهنية إلى الإدارة والمدرب بنجاح', 'success');
      await loadPlayer({ silent: true });
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال طلب شهادة الكفاءة', 'error');
    } finally {
      setCompBusy(false);
    }
  };

  const handleSubmitDualReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.course?.id) return;
    setRevBusy(true);
    try {
      await apiFetch('/learning/reviews', {
        method: 'POST',
        body: JSON.stringify({
          courseId: data.course.id,
          instructorId: revInstructorId || data.course.instructor?.id,
          rating: Number(revCourseRating),
          instructorRating: Number(revInstructorRating),
          commentAr: revComment.trim() || undefined,
        }),
      });
      pushToast('تم حفظ تقييمك للدورة والمدرب بنجاح', 'success');
      await loadPlayer({ silent: true });
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التقييم', 'error');
    } finally {
      setRevBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-6">
          <SkeletonDashboardGrid />
        </div>
      </PublicPageLayout>
    );
  }

  if (error || !data) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-2xl px-4 py-16 space-y-4 text-center">
          <AlertBanner tone="danger">{error || 'تعذر فتح الكورس'}</AlertBanner>
          {!user && (
            <Link href={`/login?next=${encodeURIComponent(`/learn/${slug}`)}`}>
              <Button variant="primary">تسجيل الدخول</Button>
            </Link>
          )}
        </section>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout>
      {/* Masterclass Theatre Top Navigation & Progress Header */}
      <section className="relative overflow-hidden bg-[#050A24] text-[#EEF0FF] border-b border-[#8CA2FF]/16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <Link
                href={`/courses/${data.course.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8CA2FF] hover:underline"
              >
                ← العودة إلى صفحة الكورس
              </Link>
              <h1 className="text-2xl font-extrabold sm:text-3xl text-[#EEF0FF]">
                {data.course.titleAr}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-[#8CA2FF]/22 bg-[#0B1440]/90 px-3.5 py-2 text-xs tabular-nums">
                <span className="text-[#A9B1E0]">نسبة الإنجاز: </span>
                <strong className="text-[#8CA2FF] font-extrabold">
                  {formatNumber(courseProgressPercent)}% ({formatNumber(completedCount)}/{formatNumber(allLessons.length)})
                </strong>
              </div>
              <Badge tone={data.access.allowed ? 'success' : 'warning'}>
                {data.access.allowed ? 'العضوية / الصلاحية مفعّلة' : 'وضع المعاينة المجانية فقط'}
              </Badge>
            </div>
          </div>

          {/* Learning / Course Community Switcher */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[#8CA2FF]/14 pt-4">
            <Button
              type="button"
              variant={activeTab === 'lesson' ? 'primary' : 'glass'}
              size="sm"
              onClick={() => setActiveTab('lesson')}
            >
              <BookOpen className="h-4 w-4" />
              الدرس ومحتوى التعلم
            </Button>
            <Button
              type="button"
              variant={activeTab === 'community' ? 'primary' : 'glass'}
              size="sm"
              onClick={() => setActiveTab('community')}
            >
              <Users className="h-4 w-4" />
              مجتمع الكورس والمناقشات
            </Button>
            <Link href={`/courses/${data.course.slug}/community`} className="ms-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF]"
              >
                فتح صفحة المجتمع الكاملة ↗
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {activeTab === 'community' ? (
          <CourseCommunityPanel
            courseSlug={data.course.slug}
            lessons={allLessons.map((l) => ({
              id: l.id,
              titleAr: l.titleAr,
              type: l.type,
              durationSeconds: l.durationSeconds ?? 0,
            }))}
            initialQuestionId={deepLinkQuestionId}
            onNavigateToLessonTimestamp={(lessonId, seconds) =>
              jumpToLessonAndSeek(lessonId, seconds)
            }
            onEnrolled={() => void loadPlayer({ silent: true })}
          />
        ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Active Lesson Stage */}
          <div ref={playerContainerRef} className="order-1 lg:order-2 lg:col-span-8 space-y-6">
            {!currentLesson ? (
              <AlertBanner tone="info">لا توجد دروس منشورة في هذا الكورس بعد.</AlertBanner>
            ) : !currentLesson.hasAccess ? (
              <Card className="p-8 text-center space-y-4">
                <Lock className="mx-auto h-10 w-10 text-[#F5B94A]" />
                <h2 className="text-xl font-extrabold text-[#EEF0FF]">
                  هذا الدرس متاح للمشتركين فقط
                </h2>
                <p className="text-sm text-[#A9B1E0] max-w-md mx-auto">
                  {data.course.includedInMembership === false
                    ? 'هذا الكورس غير مشمول في العضوية الشهرية/السنوية، ويمكنك شراؤه بشكل مستقل لفتح كافة الدروس والاختبارات والشهادات.'
                    : 'يمكنك شراء هذا الكورس بمفرده دون التزام باشتراك شهري، أو الاشتراك في العضوية الشهرية أو السنوية لفتح الباقات المشمولة.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {data.course.allowIndividualPurchase !== false &&
                    Number(data.course.priceCents) > 0 && (
                      <Button
                        type="button"
                        variant="gold"
                        size="lg"
                        disabled={buyBusy}
                        onClick={() => void handleDirectCoursePurchase()}
                      >
                        <CreditCard className="h-4 w-4" />
                        {buyBusy
                          ? 'جاري تجهيز الدفع...'
                          : `شراء هذا الكورس منفرداً (${formatEgp(data.course.priceCents)})`}
                      </Button>
                    )}
                  {data.course.includedInMembership !== false && (
                    <Link href="/pricing">
                      <Button variant="primary" size="lg">
                        عرض خطط العضوية الشهرية والسنوية
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ) : (
              <>
                <Card className="overflow-hidden border-[#8CA2FF]/20">
                  {/* Theatre Video Player Stage */}
                  {currentLesson.videoAssetId && (
                    <div className="bosla-image-frame bg-[#050A24]">
                      <BoslaHlsPlayer
                        lessonId={currentLesson.id}
                        videoAssetId={currentLesson.videoAssetId}
                        initialVideoStatus={currentLesson.videoAsset?.status}
                        canRetranscode={Boolean(
                          user &&
                            (user.role === 'INSTRUCTOR' ||
                              user.role === 'ADMIN' ||
                              user.role === 'SUPER_ADMIN'),
                        )}
                        initialWatchedSeconds={currentProgress?.watchedSeconds ?? 0}
                        durationSeconds={currentLesson.durationSeconds ?? 0}
                        seekToSeconds={seekToSeconds}
                        seekTriggerKey={seekTriggerKey}
                        onTimeChange={(secs, dur) => {
                          livePlaybackSecondsRef.current = secs;
                          livePlaybackDurationRef.current = dur;
                        }}
                        onProgressSaved={(res) => {
                          if (res?.issuedCertificate) {
                            pushToast(
                              `مبروك! صدرت شهادتك برمز ${res.issuedCertificate.certificateCode}`,
                              'success',
                            );
                          }
                          void loadPlayer({ silent: true });
                        }}
                      />
                    </div>
                  )}

                  <div className="p-5 sm:p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">
                            {currentLesson.type === 'VIDEO'
                              ? 'درس فيديو تطبيقي'
                              : currentLesson.type === 'QUIZ'
                              ? 'اختبار تفاعلي'
                              : 'درس مقروء'}
                          </Badge>
                          <span className="text-xs font-semibold text-[#A9B1E0] tabular-nums">
                            الدرس {formatNumber(currentLessonIndex + 1)} من {formatNumber(allLessons.length)}
                          </span>
                          {currentProgress?.isCompleted && (
                            <Badge tone="success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              مكتمل
                            </Badge>
                          )}
                        </div>
                        <h2 className="mt-2 text-xl font-extrabold text-[#EEF0FF]">
                          {currentLesson.titleAr}
                        </h2>
                      </div>
                    </div>

                    {/* Quick Jump Anchor Toolbar directly below player */}
                    <div className="flex flex-wrap items-center gap-2 border-y border-[#22307A] py-3 text-xs">
                      <a
                        href="#lesson-qa"
                        className="rounded-xl border border-[#C084FC]/40 bg-[#6B21A8]/18 px-3.5 py-2 font-bold text-[#E9D5FF] hover:bg-[#6B21A8]/28 transition-colors"
                      >
                        أسئلة هذا الدرس ↓
                      </a>
                      {currentLesson.attachments?.length > 0 && (
                        <a
                          href="#lesson-attachments"
                          className="rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2 font-bold text-[#EEF0FF] hover:border-[#8CA2FF] transition-colors"
                        >
                          المرفقات ({currentLesson.attachments.length}) ↓
                        </a>
                      )}
                      {currentLesson.quiz && (
                        <a
                          href="#lesson-quiz"
                          className="rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2 font-bold text-[#EEF0FF] hover:border-[#8CA2FF] transition-colors"
                        >
                          اختبار الدرس ↓
                        </a>
                      )}
                    </div>

                  {/* Article / Written Content */}
                  {currentLesson.articleContentAr && (
                    <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-5 text-sm leading-relaxed text-[#EEF0FF] whitespace-pre-line">
                      {currentLesson.articleContentAr}
                    </div>
                  )}

                  {currentLesson.descriptionAr && (
                    <p className="text-sm text-[#A9B1E0] leading-relaxed">
                      {currentLesson.descriptionAr}
                    </p>
                  )}

                  {/* Interactive Quiz */}
                  {currentLesson.quiz && (
                    <div
                      id="lesson-quiz"
                      className="space-y-4 rounded-2xl border border-[#8CA2FF]/35 bg-[#18266E] p-5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                          <FileQuestion className="h-5 w-5 text-[#8CA2FF]" />
                          {currentLesson.quiz.titleAr}
                        </h3>
                        <Badge tone="info">
                          درجة النجاح: {currentLesson.quiz.passingScorePercent}%
                        </Badge>
                      </div>

                      {quizResult && (
                        <AlertBanner
                          tone={quizResult.passed ? 'success' : 'warning'}
                          title={
                            quizResult.passed
                              ? `نجحت بنسبة ${quizResult.scorePercent}%`
                              : `حصلت على ${quizResult.scorePercent}% (المطلوب ${quizResult.passingScorePercent}%)`
                          }
                        >
                          {quizResult.maxAttempts ? (
                            <p className="text-xs mt-1">
                              المحاولات المستهلكة: {quizResult.attemptsUsed ?? 1} من {quizResult.maxAttempts}
                            </p>
                          ) : null}
                          {quizResult.answersDisclosed === false && !quizResult.passed && (
                            <p className="text-xs mt-1 text-[#A9B1E0]">
                              يتم إظهار الإجابات النموذجية والشروحات بعد اجتياز الاختبار أو استنفاد المحاولات المتاحة.
                            </p>
                          )}
                          {quizResult.answersDisclosed && Array.isArray(quizResult.feedback) && (
                            <div className="mt-3 space-y-1.5 text-xs border-t border-white/15 pt-2">
                              {quizResult.feedback.map((fb: any, idx: number) => (
                                <div key={fb.questionId || idx} className="text-[#EEF0FF]">
                                  <span>السؤال {idx + 1}: </span>
                                  <strong className={fb.isCorrect ? 'text-[#77E2B5]' : 'text-[#FF9CAA]'}>
                                    {fb.isCorrect ? 'إجابة صحيحة' : 'إجابة غير صحيحة'}
                                  </strong>
                                  {fb.explanationAr ? ` — ${fb.explanationAr}` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          {quizResult.issuedCertificate && (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <span className="font-extrabold">
                                تم إصدار شهادتك الرسمية برمز:{' '}
                                <code dir="ltr">{quizResult.issuedCertificate.certificateCode}</code>
                              </span>
                              <Link
                                href={`/certificates/${encodeURIComponent(
                                  quizResult.issuedCertificate.certificateCode,
                                )}`}
                              >
                                <Button variant="gold" size="sm">
                                  <Award className="h-4 w-4" />
                                  عرض الشهادة
                                </Button>
                              </Link>
                            </div>
                          )}
                        </AlertBanner>
                      )}

                      <form onSubmit={handleQuizSubmit} className="space-y-5">
                        {currentLesson.quiz.questions.map((q: any, qIdx: number) => (
                          <fieldset
                            key={q.id}
                            className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3"
                          >
                            <legend className="px-1 text-sm font-extrabold text-[#EEF0FF]">
                              {qIdx + 1}. {q.questionTextAr}
                            </legend>
                            <div className="space-y-2">
                              {(q.options ?? []).map((opt: any) => (
                                <label
                                  key={opt.id}
                                  className="flex items-center gap-2.5 rounded-xl border border-[#22307A] bg-[#0F1A4A] p-3 text-sm text-[#EEF0FF] cursor-pointer hover:border-[#8CA2FF] transition-colors"
                                >
                                  <input
                                    type="radio"
                                    name={`q-${q.id}`}
                                    value={opt.id}
                                    checked={answers[q.id] === opt.id}
                                    onChange={() =>
                                      setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                                    }
                                    className="h-4 w-4 accent-bosla-primary"
                                    required
                                  />
                                  <span>{opt.textAr}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ))}
                        <Button type="submit" variant="primary" disabled={quizBusy}>
                          {quizBusy ? 'جاري التصحيح...' : 'إرسال إجابات الاختبار'}
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Mark completed & Prev/Next Lesson Navigation */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bosla-line pt-4">
                    <div className="flex items-center gap-2">
                      {prevLesson && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => jumpToLessonAndSeek(prevLesson.id, 0)}
                        >
                          → الدرس السابق
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!currentLesson.quiz && !currentProgress?.isCompleted && (
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          onClick={markArticleCompleted}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          تحديد هذا الدرس كمكتمل
                        </Button>
                      )}
                      {nextLesson && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => jumpToLessonAndSeek(nextLesson.id, 0)}
                        >
                          الدرس التالي ←
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Attachments */}
                  {currentLesson.attachments?.length > 0 && (
                    <div id="lesson-attachments" className="border-t border-[#22307A] pt-4 space-y-2">
                      <h3 className="text-sm font-extrabold text-[#EEF0FF]">
                        المرفقات والملفات التشغيلية
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {currentLesson.attachments.map((att: any) => (
                          <a
                            key={att.id}
                            href={`/api/v1/learning/attachments/${att.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-xl border border-[#22307A] bg-[#0B1440] px-4 py-2.5 text-xs font-bold text-[#EEF0FF] hover:border-[#8CA2FF] transition-colors"
                          >
                            <span className="inline-flex items-center gap-2 truncate">
                              <FileDown className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                              {att.titleAr}
                            </span>
                            <span className="text-[#A9B1E0] shrink-0">
                              {Math.max(1, Math.round((att.sizeBytes ?? 0) / 1024))} KB
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </Card>

                <div id="lesson-qa">
                  <LessonQaSection
                    courseId={data.course.id}
                    courseSlug={data.course.slug}
                    lessonId={currentLesson.id}
                    lessonTitleAr={currentLesson.titleAr}
                    lessonType={currentLesson.type}
                    lessonDurationSeconds={
                      livePlaybackDurationRef.current || currentLesson.durationSeconds || 0
                    }
                    getCurrentPlaybackSeconds={() =>
                      livePlaybackSecondsRef.current || currentProgress?.watchedSeconds || 0
                    }
                    onSeekTimestamp={(seconds) => {
                      setSeekToSeconds(seconds);
                      setSeekTriggerKey((k) => k + 1);
                      playerContainerRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                    initialQuestionId={deepLinkQuestionId}
                    onEnrolled={() => void loadPlayer({ silent: true })}
                  />
                </div>

                {/* Attendance Completion & Competency Certificate Request Section */}
                {data.access.allowed && (
                  <Card id="course-certificates-box" className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#22307A] pb-3">
                      <h3 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                        <Award className="h-5 w-5 text-[#F5B94A]" />
                        شهادات الدورة (شهادة الحضور وشهادة الكفاءة المهنية)
                      </h3>
                      <Badge tone={courseProgressPercent === 100 ? 'success' : 'info'}>
                        التقدم: {courseProgressPercent}%
                      </Badge>
                    </div>

                    {(() => {
                      const attendanceCert = (data.certificates ?? []).find(
                        (c: any) => c.kind === 'ATTENDANCE_COMPLETION' || !c.kind,
                      );
                      const competencyCert = (data.certificates ?? []).find(
                        (c: any) => c.kind === 'COMPETENCY',
                      );
                      const latestCompReq = (data.competencyRequests ?? [])[0];
                      return (
                        <div className="space-y-4">
                          {/* 1. Attendance / Completion Certificate */}
                          <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-extrabold text-[#EEF0FF]">
                                1. شهادة إتمام الدورة (شهادة حضور)
                              </p>
                              <p className="text-xs text-[#A9B1E0] mt-0.5">
                                تصدر تلقائياً فور إتمام جميع دروس الدورة بنسبة 100%.
                              </p>
                            </div>
                            {attendanceCert ? (
                              <Link href={`/certificates/${encodeURIComponent(attendanceCert.certificateCode)}`}>
                                <Button variant="success" size="sm">
                                  <Award className="h-4 w-4" />
                                  عرض شهادة الحضور ({attendanceCert.certificateCode})
                                </Button>
                              </Link>
                            ) : (
                              <Badge tone="neutral">
                                {courseProgressPercent === 100
                                  ? 'أكمل آخر درس لتأكيد الإصدار'
                                  : `متبقي ${100 - courseProgressPercent}% لإصدار شهادة الحضور`}
                              </Badge>
                            )}
                          </div>

                          {/* 2. Competency Certificate Request */}
                          <div className="rounded-xl border border-[#8CA2FF]/35 bg-[#18266E]/60 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-extrabold text-[#EEF0FF]">
                                  2. شهادة الكفاءة المهنية (طلب اعتماد من الإدارة والمدرب)
                                </p>
                                <p className="text-xs text-[#A9B1E0] mt-0.5">
                                  بعد إنهاء الدورة بنسبة 100% يمكنك تقديم طلب للحصول على شهادة الكفاءة، ويتم توجيهه مباشرة للإدارة ومدرب الدورة المعيّن.
                                </p>
                              </div>
                              {competencyCert && (
                                <Link href={`/certificates/${encodeURIComponent(competencyCert.certificateCode)}`}>
                                  <Button variant="gold" size="sm">
                                    <Award className="h-4 w-4" />
                                    عرض شهادة الكفاءة
                                  </Button>
                                </Link>
                              )}
                            </div>

                            {latestCompReq ? (
                              <div className="rounded-lg border border-[#22307A] bg-[#0B1440] p-3 text-xs space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-[#EEF0FF]">حالة طلب شهادة الكفاءة:</span>
                                  <Badge
                                    tone={
                                      latestCompReq.status === 'APPROVED'
                                        ? 'success'
                                        : latestCompReq.status === 'REJECTED'
                                          ? 'danger'
                                          : 'warning'
                                    }
                                  >
                                    {latestCompReq.status === 'APPROVED'
                                      ? 'تم الاعتماد وإصدار الشهادة'
                                      : latestCompReq.status === 'REJECTED'
                                        ? 'مُعاد بملاحظات'
                                        : 'قيد المراجعة لدى الإدارة والمدرب'}
                                  </Badge>
                                </div>
                                {latestCompReq.reviewNotesAr && (
                                  <p className="text-[#A9B1E0]">
                                    ملاحظة المراجع: {latestCompReq.reviewNotesAr}
                                  </p>
                                )}
                              </div>
                            ) : null}

                            {courseProgressPercent === 100 &&
                              (!latestCompReq || latestCompReq.status === 'REJECTED') && (
                                <form onSubmit={handleRequestCompetency} className="space-y-3 pt-1">
                                  <Field id="comp-notes" label="ملخص التطبيق العملي أو ملاحظات الطلب (اختياري)">
                                    <textarea
                                      id="comp-notes"
                                      rows={2}
                                      className={textareaClassName}
                                      value={compNotes}
                                      onChange={(e) => setCompNotes(e.target.value)}
                                      placeholder="اذكر ما طبقته عملياً من هذه الدورة ليراجعه المدرب والإدارة..."
                                    />
                                  </Field>
                                  <Field id="comp-evidence" label="رابط ملف أو شاهد تطبيقي (اختياري)">
                                    <input
                                      id="comp-evidence"
                                      dir="ltr"
                                      className={inputClassName}
                                      value={compEvidenceUrl}
                                      onChange={(e) => setCompEvidenceUrl(e.target.value)}
                                      placeholder="https://..."
                                    />
                                  </Field>
                                  <Button
                                    id="submit-competency-request-btn"
                                    type="submit"
                                    variant="gold"
                                    size="sm"
                                    disabled={compBusy}
                                  >
                                    <Send className="h-4 w-4" />
                                    {compBusy
                                      ? 'جاري إرسال الطلب...'
                                      : 'طلب شهادة الكفاءة المهنية الآن'}
                                  </Button>
                                </form>
                              )}
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                )}

                {/* Program + Instructor Dual Review Form */}
                {data.access.allowed && (
                  <Card id="course-review-box" className="p-6 space-y-4">
                    <h3 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                      <Star className="h-5 w-5 text-[#F5B94A]" />
                      تقييم الدورة والمدرب
                    </h3>
                    <form onSubmit={handleSubmitDualReview} className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field id="rev-inst" label="المدرب المقيّم">
                          <select
                            id="rev-inst"
                            className={inputClassName}
                            value={revInstructorId}
                            onChange={(e) => setRevInstructorId(e.target.value)}
                          >
                            {data.course.instructor && (
                              <option value={data.course.instructor.id}>
                                {data.course.instructor.fullName} (المدرب الرئيسي)
                              </option>
                            )}
                            {(data.course.instructorAssignments ?? [])
                              .filter((a: any) => a.instructor?.id !== data.course.instructor?.id)
                              .map((a: any) => (
                                <option key={a.id} value={a.instructor.id}>
                                  {a.instructor.fullName} ({a.roleTitleAr})
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field id="rev-course-stars" label="تقييم البرنامج / الدورة (1-5)">
                          <select
                            id="rev-course-stars"
                            className={inputClassName}
                            value={revCourseRating}
                            onChange={(e) => setRevCourseRating(Number(e.target.value))}
                          >
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n} نجوم ★
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field id="rev-inst-stars" label="تقييم أداء المدرب (1-5)">
                          <select
                            id="rev-inst-stars"
                            className={inputClassName}
                            value={revInstructorRating}
                            onChange={(e) => setRevInstructorRating(Number(e.target.value))}
                          >
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n} نجوم ★
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field id="rev-comment" label="رأيك وتجربتك في البرنامج وأسلوب المدرب">
                        <textarea
                          id="rev-comment"
                          rows={2}
                          className={inputClassName}
                          value={revComment}
                          onChange={(e) => setRevComment(e.target.value)}
                          placeholder="شاركنا تقييمك للمحتوى العملي وللشرح..."
                        />
                      </Field>
                      <Button type="submit" variant="primary" size="sm" disabled={revBusy}>
                        <Star className="h-4 w-4" />
                        {revBusy ? 'جاري الحفظ...' : 'إرسال التقييم المرتبط بالمدرب والبرنامج'}
                      </Button>
                    </form>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Right RTL Sticky Syllabus Sidebar */}
          <aside className="order-2 lg:order-1 lg:col-span-4 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card spotlight className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-[#8CA2FF]/16 pb-3.5">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#8CA2FF]" />
                    محتوى الكورس
                  </h2>
                  <p className="text-xs text-[#A9B1E0] tabular-nums">
                    مكتمل {formatNumber(completedCount)} من {formatNumber(allLessons.length)} دروس
                  </p>
                </div>
                <ProgressRingSvg
                  percent={courseProgressPercent}
                  size={62}
                  strokeWidth={6}
                  tone={courseProgressPercent === 100 ? 'emerald' : 'accent'}
                />
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pe-1">
                {(data.sections ?? []).map((sec: any, sIdx: number) => (
                  <details
                    key={sec.id}
                    open
                    className="rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 overflow-hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-extrabold text-[#EEF0FF] hover:bg-[#18266E]/45">
                      <span className="flex items-center gap-1.5 min-w-0 truncate tabular-nums">
                        <ChevronDown className="bosla-chevron h-3.5 w-3.5 text-[#8CA2FF] shrink-0" />
                        <span className="truncate">{formatNumber(sIdx + 1)}. {sec.titleAr}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-[#A9B1E0] tabular-nums">
                        {formatNumber(sec.lessons?.length ?? 0)}
                      </span>
                    </summary>
                    <div className="space-y-1 p-1.5 border-t border-[#8CA2FF]/12 bg-[#070D2B]/40">
                      {sec.lessons.map((lesson: any) => {
                        const isDone = Boolean(
                          progressMap.get(lesson.stableKey)?.isCompleted,
                        );
                        const isActive = currentLesson?.id === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => {
                              setSelectedLessonId(lesson.id);
                              setQuizResult(null);
                              setAnswers({});
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? 'border-[#8CA2FF]/65 bg-[#18266E] text-[#EEF0FF]'
                                : 'border-transparent hover:bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0" />
                              ) : lesson.hasAccess ? (
                                <PlayCircle
                                  className={`h-4 w-4 shrink-0 ${
                                    isActive ? 'text-[#8CA2FF]' : 'text-[#A9B1E0]'
                                  }`}
                                />
                              ) : (
                                <Lock className="h-4 w-4 text-[#A9B1E0] shrink-0" />
                              )}
                              <span className="truncate">{lesson.titleAr}</span>
                            </span>
                            {lesson.isFreePreview && !data.access.allowed && (
                              <span className="shrink-0 text-[10px] font-bold text-[#77E2B5]">
                                مجاني
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>

              {nextLesson && (
                <div className="border-t border-[#8CA2FF]/16 pt-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedLessonId(nextLesson.id);
                      setQuizResult(null);
                      setAnswers({});
                    }}
                  >
                    <PlayCircle className="h-4 w-4" />
                    الدرس التالي
                  </Button>
                </div>
              )}
            </Card>
          </aside>
        </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
