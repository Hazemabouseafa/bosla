'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  FilePlus2,
  Plus,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { apiFetch, editorialStatusLabelAr } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { VideoChunkUploader } from '@/components/instructor/VideoChunkUploader';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

export default function InstructorCourseEditorPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();

  const [course, setCourse] = useState<any | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable draft fields
  const [titleAr, setTitleAr] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER',
  );
  const [isFree, setIsFree] = useState(false);
  const [sections, setSections] = useState<any[]>([]);

  // Modals
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizTitleAr, setQuizTitleAr] = useState('');
  const [quizPassPct, setQuizPassPct] = useState(70);
  const [quizQText, setQuizQText] = useState('');
  const [quizOptA, setQuizOptA] = useState('');
  const [quizOptB, setQuizOptB] = useState('');
  const [quizCorrect, setQuizCorrect] = useState<'a' | 'b'>('a');

  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const [detail, vidList, quizList] = await Promise.all([
        apiFetch<any>(`/instructor/courses/${courseId}`),
        apiFetch<any[]>('/instructor/videos'),
        apiFetch<any[]>('/instructor/quizzes'),
      ]);
      setCourse(detail);
      setVideos(vidList);
      setQuizzes(quizList);

      const dv = detail.draftVersion;
      if (dv) {
        setTitleAr(dv.titleAr || '');
        setSubtitleAr(dv.subtitleAr || '');
        setDescriptionAr(dv.descriptionAr || '');
        setDifficulty(detail.difficulty || 'BEGINNER');
        setIsFree(Boolean(detail.isFree));
        setSections(
          (dv.sections ?? []).map((sec: any, sIdx: number) => ({
            id: sec.id,
            titleAr: sec.titleAr,
            sortOrder: sIdx,
            lessons: (sec.lessons ?? []).map((les: any, lIdx: number) => ({
              id: les.id,
              stableKey: les.stableKey,
              titleAr: les.titleAr,
              type: les.type,
              isFreePreview: Boolean(les.isFreePreview),
              durationSeconds: les.durationSeconds || 0,
              sortOrder: lIdx,
              videoAssetId: les.videoAssetId || '',
              articleContentAr: les.articleContentAr || '',
              quizId: les.quizId || '',
              attachments: les.attachments ?? [],
            })),
          })),
        );
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل بيانات الكورس', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, pushToast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
      router.replace('/student');
      return;
    }
    void loadAll();
  }, [authLoading, user, router, loadAll]);

  const handleSaveDraft = async () => {
    if (!courseId) return;
    setSaving(true);
    try {
      const payload = {
        titleAr,
        subtitleAr: subtitleAr.trim() || null,
        descriptionAr,
        difficulty,
        isFree,
        sections: sections.map((s, sIdx) => ({
          titleAr: s.titleAr,
          sortOrder: sIdx,
          lessons: s.lessons.map((l: any, lIdx: number) => ({
            ...(l.stableKey ? { stableKey: l.stableKey } : {}),
            titleAr: l.titleAr,
            type: l.type,
            isFreePreview: Boolean(l.isFreePreview),
            durationSeconds: Number(l.durationSeconds || 0),
            sortOrder: lIdx,
            videoAssetId: l.videoAssetId || null,
            articleContentAr: l.articleContentAr || null,
            quizId: l.quizId || null,
          })),
        })),
      };
      await apiFetch(`/instructor/courses/${courseId}/draft`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      pushToast('تم حفظ المسودة بنجاح (دون التأثير على النسخة المنشورة)', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التعديلات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!courseId) return;
    try {
      await apiFetch(`/instructor/courses/${courseId}/submit`, { method: 'POST' });
      pushToast('تم إرسال الكورس للإدارة للمراجعة والاعتماد', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الكورس', 'error');
    }
  };

  const handleWithdraw = async () => {
    if (!courseId) return;
    try {
      await apiFetch(`/instructor/courses/${courseId}/withdraw`, { method: 'POST' });
      pushToast('تم سحب الكورس من قائمة المراجعة للعودة إلى المسودة', 'info');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر السحب', 'error');
    }
  };

  const handleOpenAnalytics = async () => {
    if (!courseId) return;
    try {
      const res = await apiFetch<any>(`/instructor/courses/${courseId}/analytics`);
      setAnalytics(res);
      setAnalyticsOpen(true);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل التحليلات', 'error');
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiFetch<any>('/instructor/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: quizTitleAr,
          passingScorePercent: Number(quizPassPct),
          questions: [
            {
              questionTextAr: quizQText,
              options: [
                { id: 'a', textAr: quizOptA },
                { id: 'b', textAr: quizOptB },
              ],
              correctOptionId: quizCorrect,
              points: 10,
              sortOrder: 0,
            },
          ],
        }),
      });
      setQuizzes((prev) => [created, ...prev]);
      setQuizModalOpen(false);
      setQuizTitleAr('');
      setQuizQText('');
      setQuizOptA('');
      setQuizOptB('');
      pushToast('تم إنشاء الاختبار بنجاح ويمكنك ربطه بأي درس الآن', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الاختبار', 'error');
    }
  };

  const handleAttachmentUpload = async (lessonId: string, file: File) => {
    if (!lessonId) {
      pushToast('احفظ المسودة أولاً لتوليد معرف الدرس ثم ارفع المرفق', 'error');
      return;
    }
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    try {
      await apiFetch(`/instructor/lessons/${lessonId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: file.name,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        }),
      });
      pushToast(`تم رفع المرفق ${file.name} بنجاح`, 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع المرفق', 'error');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await apiFetch(`/instructor/attachments/${attachmentId}`, { method: 'DELETE' });
      pushToast('تم حذف المرفق', 'info');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف المرفق', 'error');
    }
  };

  if (loading || !course) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل محرر الكورس...
        </div>
      </PublicPageLayout>
    );
  }

  const draftStatus = editorialStatusLabelAr(course.draftVersion?.status);

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/instructor"
              className="text-xs font-extrabold text-bosla-primary hover:underline"
            >
              ← العودة إلى بوابة المدرب
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-bosla-ink">
              محرر الكورس: {course.draftVersion?.titleAr || course.slug}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={draftStatus.tone}>
                حالة المسودة v{course.draftVersion?.versionNumber}: {draftStatus.label}
              </Badge>
              {course.publishedVersion && (
                <Badge tone="success">
                  منشور للطلاب: v{course.publishedVersion.versionNumber}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenAnalytics}>
              <BarChart3 className="h-4 w-4" />
              التحليلات
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUploaderOpen(true)}>
              <Upload className="h-4 w-4" />
              رفع فيديو
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuizModalOpen(true)}>
              <FilePlus2 className="h-4 w-4" />
              اختبار جديد
            </Button>
            <Button variant="primary" size="sm" disabled={saving} onClick={handleSaveDraft}>
              <Save className="h-4 w-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ المسودة'}
            </Button>
            {course.draftVersion?.status === 'SUBMITTED_FOR_REVIEW' ? (
              <Button variant="outline" size="sm" onClick={handleWithdraw}>
                <Undo2 className="h-4 w-4" />
                سحب من المراجعة
              </Button>
            ) : (
              <Button variant="gold" size="sm" onClick={handleSubmitReview}>
                <Send className="h-4 w-4" />
                إرسال للمراجعة الإدارية
              </Button>
            )}
          </div>
        </div>

        {course.publishedVersion && (
          <AlertBanner tone="info">
            تعمل التعديلات هنا على نسخة مسودة جديدة دون أي انقطاع أو حذف للنسخة المنشورة حالياً أمام الطلاب حتى يعتمدها المشرفون.
          </AlertBanner>
        )}

        {/* Course Metadata */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-bosla-ink">البيانات الأساسية للكورس</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ed-title" label="عنوان الكورس">
              <input
                id="ed-title"
                className={inputClassName}
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />
            </Field>
            <Field id="ed-sub" label="العنوان الفرعي">
              <input
                id="ed-sub"
                className={inputClassName}
                value={subtitleAr}
                onChange={(e) => setSubtitleAr(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ed-diff" label="المستوى">
              <select
                id="ed-diff"
                className={inputClassName}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
              >
                <option value="BEGINNER">مبتدئ</option>
                <option value="INTERMEDIATE">متوسط</option>
                <option value="ADVANCED">متقدم</option>
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs font-extrabold text-bosla-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="h-4 w-4 accent-bosla-primary"
                />
                إتاحة الكورس مجاناً لجميع الطلاب المسجلين
              </label>
            </div>
          </div>
          <Field id="ed-desc" label="الوصف الكامل">
            <textarea
              id="ed-desc"
              rows={3}
              className={inputClassName}
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
            />
          </Field>
        </Card>

        {/* Sections & Lessons */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-bosla-ink">
              الأقسام والدروس ({sections.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSections((prev) => [
                  ...prev,
                  {
                    titleAr: `القسم ${prev.length + 1}`,
                    sortOrder: prev.length,
                    lessons: [],
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              إضافة قسم
            </Button>
          </div>

          <div className="space-y-5">
            {sections.map((sec, sIdx) => (
              <div
                key={sIdx}
                className="rounded-2xl border border-bosla-line bg-bosla-bg/40 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputClassName} flex-1 font-extrabold`}
                    value={sec.titleAr}
                    onChange={(e) => {
                      const next = [...sections];
                      next[sIdx].titleAr = e.target.value;
                      setSections(next);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = [...sections];
                      next[sIdx].lessons.push({
                        titleAr: `درس جديد ${next[sIdx].lessons.length + 1}`,
                        type: 'VIDEO',
                        isFreePreview: false,
                        durationSeconds: 300,
                        videoAssetId: '',
                        articleContentAr: '',
                        quizId: '',
                        attachments: [],
                      });
                      setSections(next);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة درس
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSections(sections.filter((_, idx) => idx !== sIdx))}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {sec.lessons.map((les: any, lIdx: number) => (
                    <div
                      key={lIdx}
                      className="rounded-xl border border-bosla-line bg-white p-4 space-y-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-4">
                        <input
                          className={`${inputClassName} sm:col-span-2`}
                          value={les.titleAr}
                          onChange={(e) => {
                            const next = [...sections];
                            next[sIdx].lessons[lIdx].titleAr = e.target.value;
                            setSections(next);
                          }}
                          placeholder="عنوان الدرس"
                        />
                        <select
                          className={inputClassName}
                          value={les.type}
                          onChange={(e) => {
                            const next = [...sections];
                            next[sIdx].lessons[lIdx].type = e.target.value;
                            setSections(next);
                          }}
                        >
                          <option value="VIDEO">فيديو HLS</option>
                          <option value="ARTICLE">مقالة نصية</option>
                          <option value="QUIZ">اختبار</option>
                        </select>
                        <label className="flex items-center gap-2 text-xs font-bold text-bosla-ink">
                          <input
                            type="checkbox"
                            checked={les.isFreePreview}
                            onChange={(e) => {
                              const next = [...sections];
                              next[sIdx].lessons[lIdx].isFreePreview = e.target.checked;
                              setSections(next);
                            }}
                          />
                          معاينة مجانية
                        </label>
                      </div>

                      {les.type === 'VIDEO' && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <select
                            className={inputClassName}
                            value={les.videoAssetId || ''}
                            onChange={(e) => {
                              const next = [...sections];
                              next[sIdx].lessons[lIdx].videoAssetId = e.target.value;
                              setSections(next);
                            }}
                          >
                            <option value="">— اختر فيديو من مكتبتك —</option>
                            {videos.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.titleAr} ({v.status})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className={inputClassName}
                            value={les.durationSeconds}
                            onChange={(e) => {
                              const next = [...sections];
                              next[sIdx].lessons[lIdx].durationSeconds = Number(
                                e.target.value,
                              );
                              setSections(next);
                            }}
                            placeholder="المدة بالثواني"
                          />
                        </div>
                      )}

                      {les.type === 'ARTICLE' && (
                        <textarea
                          rows={2}
                          className={inputClassName}
                          value={les.articleContentAr || ''}
                          onChange={(e) => {
                            const next = [...sections];
                            next[sIdx].lessons[lIdx].articleContentAr = e.target.value;
                            setSections(next);
                          }}
                          placeholder="محتوى الدرس المقروء..."
                        />
                      )}

                      {les.type === 'QUIZ' && (
                        <select
                          className={inputClassName}
                          value={les.quizId || ''}
                          onChange={(e) => {
                            const next = [...sections];
                            next[sIdx].lessons[lIdx].quizId = e.target.value;
                            setSections(next);
                          }}
                        >
                          <option value="">— اختر اختباراً من اختباراتك —</option>
                          {quizzes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.titleAr} (نجاح {q.passingScorePercent}%)
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Attachments */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bosla-line pt-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {(les.attachments ?? []).map((att: any) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-bold"
                            >
                              {att.titleAr}
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="text-rose-600 hover:underline ms-1 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {les.id && (
                            <label className="cursor-pointer rounded-lg border border-bosla-line px-2.5 py-1 font-bold text-bosla-primary hover:bg-indigo-50">
                              + إرفاق ملف (PDF/Excel)
                              <input
                                type="file"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleAttachmentUpload(les.id, f);
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...sections];
                            next[sIdx].lessons = next[sIdx].lessons.filter(
                              (_: any, idx: number) => idx !== lIdx,
                            );
                            setSections(next);
                          }}
                          className="text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          حذف الدرس
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Modals */}
        <NativeModal
          open={uploaderOpen}
          onClose={() => setUploaderOpen(false)}
          title="رفع فيديو جديد للكورس"
        >
          <VideoChunkUploader
            courseId={courseId}
            onUploaded={(asset) => {
              setVideos((prev) => [asset, ...prev]);
              setUploaderOpen(false);
            }}
          />
        </NativeModal>

        <NativeModal
          open={quizModalOpen}
          onClose={() => setQuizModalOpen(false)}
          title="إنشاء اختبار تقييمي جديد"
        >
          <form onSubmit={handleCreateQuiz} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="qz-t" label="عنوان الاختبار" required>
                <input
                  id="qz-t"
                  className={inputClassName}
                  value={quizTitleAr}
                  onChange={(e) => setQuizTitleAr(e.target.value)}
                  required
                />
              </Field>
              <Field id="qz-pct" label="نسبة النجاح (%)" required>
                <input
                  id="qz-pct"
                  type="number"
                  min={1}
                  max={100}
                  className={inputClassName}
                  value={quizPassPct}
                  onChange={(e) => setQuizPassPct(Number(e.target.value))}
                  required
                />
              </Field>
            </div>
            <Field id="qz-q" label="نص السؤال الأول" required>
              <input
                id="qz-q"
                className={inputClassName}
                value={quizQText}
                onChange={(e) => setQuizQText(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="qz-a" label="الخيار أ" required>
                <input
                  id="qz-a"
                  className={inputClassName}
                  value={quizOptA}
                  onChange={(e) => setQuizOptA(e.target.value)}
                  required
                />
              </Field>
              <Field id="qz-b" label="الخيار ب" required>
                <input
                  id="qz-b"
                  className={inputClassName}
                  value={quizOptB}
                  onChange={(e) => setQuizOptB(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field id="qz-cor" label="الإجابة الصحيحة">
              <select
                id="qz-cor"
                className={inputClassName}
                value={quizCorrect}
                onChange={(e) => setQuizCorrect(e.target.value as 'a' | 'b')}
              >
                <option value="a">الخيار أ</option>
                <option value="b">الخيار ب</option>
              </select>
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              حفظ الاختبار
            </Button>
          </form>
        </NativeModal>

        <NativeModal
          open={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          title="إحصائيات وتحليلات الكورس"
        >
          {analytics && (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <Card className="p-4">
                <p className="text-xs text-bosla-muted">الطلاب المسجلون التفاعليون</p>
                <p className="text-2xl font-extrabold text-bosla-navy mt-1">
                  {analytics.uniqueLearners ?? 0}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-bosla-muted">نسبة الإكمال المتوسطة</p>
                <p className="text-2xl font-extrabold text-bosla-success mt-1">
                  {analytics.averageProgressPercent ?? 0}%
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-bosla-muted">محاولات الاختبارات</p>
                <p className="text-2xl font-extrabold text-bosla-primary mt-1">
                  {analytics.quizAttemptsCount ?? 0}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-bosla-muted">الشهادات المصدرة</p>
                <p className="text-2xl font-extrabold text-bosla-amber mt-1">
                  {analytics.certificatesCount ?? 0}
                </p>
              </Card>
            </div>
          )}
        </NativeModal>
      </section>
    </PublicPageLayout>
  );
}
