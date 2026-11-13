'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileDown,
  FileQuestion,
  Lock,
  PlayCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { BoslaHlsPlayer } from '@/components/player/BoslaHlsPlayer';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export default function CoursePlayerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { user, isLoading: authLoading, pushToast } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  const loadPlayer = useCallback(async () => {
    if (!slug || !user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>(
        `/learning/courses/${encodeURIComponent(slug)}/player`,
      );
      setData(res);
      setSelectedLessonId((prev) => {
        if (prev) return prev;
        const firstSection = res.sections?.[0];
        return firstSection?.lessons?.[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل بيانات مشغل الكورس.');
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    if (user) void loadPlayer();
    else if (!authLoading) setLoading(false);
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
      await loadPlayer();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التقدم', 'error');
    }
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLesson?.quiz) return;
    setQuizBusy(true);
    try {
      const res = await apiFetch<any>(
        `/learning/quizzes/${currentLesson.quiz.id}/attempts`,
        {
          method: 'POST',
          body: JSON.stringify({ answers }),
        },
      );
      setQuizResult(res);
      pushToast(
        res.passed
          ? `أحسنت! اجتزت الاختبار بنسبة ${res.scorePercent}%`
          : `حصلت على ${res.scorePercent}% — حاول مرة أخرى`,
        res.passed ? 'success' : 'info',
      );
      await loadPlayer();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال إجابات الاختبار', 'error');
    } finally {
      setQuizBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل مشغل الكورس...
        </div>
      </PublicPageLayout>
    );
  }

  if (!user) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <AlertBanner tone="warning" title="سجّل الدخول لبدء التعلم">
            <p className="mb-4">
              للوصول إلى مشغل الدروس المحمي وحفظ تقدمك والشهادات، يرجى تسجيل الدخول أولاً.
            </p>
            <Link href={`/login?next=${encodeURIComponent(`/learn/${slug}`)}`}>
              <Button variant="primary">تسجيل الدخول</Button>
            </Link>
          </AlertBanner>
        </section>
      </PublicPageLayout>
    );
  }

  if (error || !data) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-2xl px-4 py-16">
          <AlertBanner tone="danger">{error || 'تعذر فتح الكورس'}</AlertBanner>
        </section>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/courses/${data.course.slug}`}
              className="text-xs font-extrabold text-bosla-primary hover:underline"
            >
              ← العودة إلى صفحة الكورس
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-bosla-ink">
              {data.course.titleAr}
            </h1>
          </div>
          <Badge tone={data.access.allowed ? 'success' : 'warning'}>
            {data.access.allowed ? 'العضوية / الصلاحية مفعّلة' : 'وضع المعاينة المجانية فقط'}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Active Lesson Stage */}
          <div className="lg:col-span-8 space-y-6">
            {!currentLesson ? (
              <AlertBanner tone="info">لا توجد دروس منشورة في هذا الكورس بعد.</AlertBanner>
            ) : !currentLesson.hasAccess ? (
              <Card className="p-8 text-center space-y-4">
                <Lock className="mx-auto h-10 w-10 text-bosla-amber" />
                <h2 className="text-xl font-extrabold text-bosla-ink">
                  هذا الدرس متاح للمشتركين فقط
                </h2>
                <p className="text-sm text-bosla-muted max-w-md mx-auto">
                  يمكنك مشاهدة الدروس المعلّمة بـ «معاينة مجانية» أو الاشتراك في العضوية الشهرية أو السنوية لفتح جميع الدروس والاختبارات والشهادات.
                </p>
                <Link href="/pricing">
                  <Button variant="gold" size="lg">
                    عرض خطط العضوية والاشتراك
                  </Button>
                </Link>
              </Card>
            ) : (
              <>
                <Card className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Badge tone="info">
                        {currentLesson.type === 'VIDEO'
                          ? 'درس فيديو تطبيقي'
                          : currentLesson.type === 'QUIZ'
                          ? 'اختبار تفاعلي'
                          : 'درس مقروء'}
                      </Badge>
                      <h2 className="mt-2 text-xl font-extrabold text-bosla-ink">
                        {currentLesson.titleAr}
                      </h2>
                    </div>
                    {currentProgress?.isCompleted && (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        مكتمل
                      </Badge>
                    )}
                  </div>

                  {/* Video Player */}
                  {currentLesson.videoAssetId && (
                    currentLesson.videoAsset?.status === 'READY' ? (
                      <BoslaHlsPlayer
                        lessonId={currentLesson.id}
                        initialWatchedSeconds={currentProgress?.watchedSeconds ?? 0}
                        durationSeconds={currentLesson.durationSeconds ?? 0}
                        onProgressSaved={(res) => {
                          if (res?.issuedCertificate) {
                            pushToast(
                              `مبروك! صدرت شهادتك برمز ${res.issuedCertificate.certificateCode}`,
                              'success',
                            );
                          }
                          void loadPlayer();
                        }}
                      />
                    ) : (
                      <AlertBanner tone="warning">
                        جاري معالجة وتحويل الفيديو بجودات متعددة (FFmpeg HLS). أعد التحقق بعد لحظات.
                      </AlertBanner>
                    )
                  )}

                  {/* Article / Written Content */}
                  {currentLesson.articleContentAr && (
                    <div className="rounded-2xl border border-bosla-line bg-bosla-bg/40 p-5 text-sm leading-relaxed text-bosla-ink whitespace-pre-line">
                      {currentLesson.articleContentAr}
                    </div>
                  )}

                  {currentLesson.descriptionAr && (
                    <p className="text-sm text-bosla-muted leading-relaxed">
                      {currentLesson.descriptionAr}
                    </p>
                  )}

                  {/* Interactive Quiz */}
                  {currentLesson.quiz && (
                    <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-extrabold text-bosla-navy flex items-center gap-2">
                          <FileQuestion className="h-5 w-5 text-bosla-primary" />
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
                              ? `نجحت بنسبة ${quizResult.scorePercent}%!`
                              : `حصلت على ${quizResult.scorePercent}% (المطلوب ${quizResult.passingScorePercent}%)`
                          }
                        >
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
                            className="rounded-xl border border-bosla-line bg-white p-4 space-y-3"
                          >
                            <legend className="px-1 text-sm font-extrabold text-bosla-ink">
                              {qIdx + 1}. {q.questionTextAr}
                            </legend>
                            <div className="space-y-2">
                              {(q.options ?? []).map((opt: any) => (
                                <label
                                  key={opt.id}
                                  className="flex items-center gap-2.5 rounded-xl border border-bosla-line p-3 text-sm cursor-pointer hover:bg-indigo-50/40"
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

                  {/* Mark completed button for articles / fallback */}
                  {!currentLesson.quiz && !currentProgress?.isCompleted && (
                    <div className="flex justify-end">
                      <Button variant="success" size="sm" onClick={markArticleCompleted}>
                        <CheckCircle2 className="h-4 w-4" />
                        تحديد هذا الدرس كمكتمل
                      </Button>
                    </div>
                  )}

                  {/* Attachments */}
                  {currentLesson.attachments?.length > 0 && (
                    <div className="border-t border-bosla-line pt-4 space-y-2">
                      <h3 className="text-sm font-extrabold text-bosla-ink">
                        المرفقات والملفات التشغيلية
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {currentLesson.attachments.map((att: any) => (
                          <a
                            key={att.id}
                            href={`/api/v1/learning/attachments/${att.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-xl border border-bosla-line bg-bosla-bg/60 px-4 py-2.5 text-xs font-bold text-bosla-ink hover:border-bosla-primary"
                          >
                            <span className="inline-flex items-center gap-2 truncate">
                              <FileDown className="h-4 w-4 text-bosla-primary shrink-0" />
                              {att.titleAr}
                            </span>
                            <span className="text-bosla-muted shrink-0">
                              {Math.max(1, Math.round((att.sizeBytes ?? 0) / 1024))} KB
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>

          {/* Curriculum Sidebar */}
          <aside className="lg:col-span-4 space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-bosla-ink flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-bosla-primary" />
                  محتوى الكورس
                </h2>
                <span className="text-xs font-bold text-bosla-muted">
                  {allLessons.filter((l) => progressMap.get(l.stableKey)?.isCompleted).length} /{' '}
                  {allLessons.length}
                </span>
              </div>

              <div className="space-y-3">
                {(data.sections ?? []).map((sec: any, sIdx: number) => (
                  <div key={sec.id} className="space-y-1.5">
                    <p className="text-xs font-extrabold text-bosla-navy bg-bosla-bg rounded-lg px-3 py-1.5">
                      {sIdx + 1}. {sec.titleAr}
                    </p>
                    <div className="space-y-1">
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
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition-colors cursor-pointer ${
                              isActive
                                ? 'border-bosla-primary bg-indigo-50 text-bosla-primary'
                                : 'border-transparent hover:bg-slate-50 text-bosla-ink'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-bosla-success shrink-0" />
                              ) : lesson.hasAccess ? (
                                <PlayCircle className="h-4 w-4 text-bosla-primary shrink-0" />
                              ) : (
                                <Lock className="h-4 w-4 text-bosla-muted shrink-0" />
                              )}
                              <span className="truncate">{lesson.titleAr}</span>
                            </span>
                            {lesson.isFreePreview && !data.access.allowed && (
                              <span className="shrink-0 text-[10px] text-bosla-success">
                                مجاني
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </section>
    </PublicPageLayout>
  );
}
