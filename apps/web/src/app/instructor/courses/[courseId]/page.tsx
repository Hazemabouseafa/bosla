'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Compass,
  FilePlus2,
  Plus,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
  Video,
} from 'lucide-react';
import { apiFetch, editorialStatusLabelAr } from '@/lib/api';
import { COVER_IMAGE_PRESETS } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { VideoChunkUploader } from '@/components/instructor/VideoChunkUploader';
import { ImageUploadField } from '@/components/media/ImageUploadField';
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
  const [categories, setCategories] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attBusyKey, setAttBusyKey] = useState<string | null>(null);

  // Editable draft fields
  const [titleAr, setTitleAr] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER',
  );
  const [isFree, setIsFree] = useState(false);
  const [sections, setSections] = useState<any[]>([]);

  // Modals (multi-question quiz builder)
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizTitleAr, setQuizTitleAr] = useState('');
  const [quizPassPct, setQuizPassPct] = useState(70);
  const [quizQuestions, setQuizQuestions] = useState<
    Array<{ questionTextAr: string; optA: string; optB: string; correctOptionId: 'a' | 'b' }>
  >([{ questionTextAr: '', optA: '', optB: '', correctOptionId: 'a' }]);

  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const loadAll = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const [detail, vidList, quizList, homeData] = await Promise.all([
        apiFetch<any>(`/instructor/courses/${courseId}`),
        apiFetch<any[]>('/instructor/videos'),
        apiFetch<any[]>('/instructor/quizzes'),
        apiFetch<any>('/catalog/home').catch(() => ({ categories: [] })),
      ]);
      setCourse(detail);
      setVideos(vidList);
      setQuizzes(quizList);
      setCategories(homeData?.categories ?? []);

      const dv = detail.draftVersion;
      if (dv) {
        setTitleAr(dv.titleAr || '');
        setSubtitleAr(dv.subtitleAr || '');
        setDescriptionAr(dv.descriptionAr || '');
        setCategoryId(detail.categoryId || '');
        setThumbnailUrl(dv.thumbnailUrl || '');
        setObjectivesText(
          Array.isArray(dv.learningObjectives) ? dv.learningObjectives.join('\n') : '',
        );
        setRequirementsText(
          Array.isArray(dv.requirements) ? dv.requirements.join('\n') : '',
        );
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

  const buildDraftPayload = () => ({
    titleAr,
    subtitleAr: subtitleAr.trim() || null,
    descriptionAr,
    categoryId: categoryId || null,
    thumbnailUrl: thumbnailUrl.trim() || null,
    learningObjectives: objectivesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    requirements: requirementsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
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
  });

  const handleSaveDraft = async () => {
    if (!courseId) return;
    setSaving(true);
    try {
      await apiFetch(`/instructor/courses/${courseId}/draft`, {
        method: 'PATCH',
        body: JSON.stringify(buildDraftPayload()),
      });
      pushToast('تم حفظ المسودة بنجاح (دون التأثير على النسخة المنشورة)', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التعديلات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdminPublishNow = async () => {
    if (!courseId) return;
    setSaving(true);
    try {
      await apiFetch(`/instructor/courses/${courseId}/draft`, {
        method: 'PATCH',
        body: JSON.stringify(buildDraftPayload()),
      });
      await apiFetch(`/admin/courses/${courseId}/publish`, { method: 'POST' });
      pushToast('تم حفظ المنهج ونشره مباشرة للطلاب بنجاح!', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ ونشر التعديلات', 'error');
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
          questions: quizQuestions.map((q, idx) => ({
            questionTextAr: q.questionTextAr,
            options: [
              { id: 'a', textAr: q.optA },
              { id: 'b', textAr: q.optB },
            ],
            correctOptionId: q.correctOptionId,
            points: 10,
            sortOrder: idx,
          })),
        }),
      });
      setQuizzes((prev) => [created, ...prev]);
      setQuizModalOpen(false);
      setQuizTitleAr('');
      setQuizQuestions([{ questionTextAr: '', optA: '', optB: '', correctOptionId: 'a' }]);
      pushToast('تم إنشاء الاختبار بنجاح ويمكنك ربطه بأي درس الآن', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الاختبار', 'error');
    }
  };

  const handleAttachmentUpload = async (
    sIdx: number,
    lIdx: number,
    lessonId: string | undefined,
    file: File,
  ) => {
    const busyKey = `${sIdx}-${lIdx}`;
    setAttBusyKey(busyKey);
    try {
      let targetLessonId = lessonId;
      if (!targetLessonId && courseId) {
        const saved = await apiFetch<any>(`/instructor/courses/${courseId}/draft`, {
          method: 'PATCH',
          body: JSON.stringify(buildDraftPayload()),
        });
        targetLessonId =
          saved?.draftVersion?.sections?.[sIdx]?.lessons?.[lIdx]?.id ?? undefined;
      }
      if (!targetLessonId) {
        pushToast('احفظ المسودة أولاً ثم أعد رفع المرفق', 'error');
        return;
      }
      const buf = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      await apiFetch(`/instructor/lessons/${targetLessonId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: file.name,
          filename: file.name,
          mimeType: file.type || 'application/pdf',
          base64Data,
        }),
      });
      pushToast('تم إرفاق الملف بالدرس بنجاح', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع المرفق', 'error');
    } finally {
      setAttBusyKey(null);
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

  const navItems: DashboardNavItem[] = [
    { id: 'overview', label: 'كورساتي والمجتمعات', icon: <Compass className="h-4 w-4" />, href: '/instructor' },
    {
      id: 'editor',
      label: 'محرر المنهج والاختبارات',
      icon: <BookOpen className="h-4 w-4" />,
      href: `/instructor/courses/${courseId}`,
      active: true,
    },
    { id: 'videos', label: 'مكتبة الفيديوهات', icon: <Video className="h-4 w-4" />, href: '/instructor/videos' },
  ];

  return (
    <DashboardShell
      portalBadge="بوابة المدرب"
      portalTitle={`محرر الكورس: ${course.draftVersion?.titleAr || course.slug}`}
      portalSubtitle={`حالة المسودة v${course.draftVersion?.versionNumber}: ${draftStatus.label}`}
      navItems={navItems}
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Link href="/instructor">
            <Button variant="outline" size="sm">
              ← بوابة المدرب
            </Button>
          </Link>
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                لوحة الإدارة
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handleOpenAnalytics}>
            <BarChart3 className="h-4 w-4" />
            التحليلات
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              document
                .getElementById('course-media-studio')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <Upload className="h-4 w-4" />
            رفع فيديو وصور
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuizModalOpen(true)}>
            <FilePlus2 className="h-4 w-4" />
            اختبار جديد
          </Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleSaveDraft}>
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ المسودة'}
          </Button>
          {user?.role === 'ADMIN' ? (
            <Button variant="success" size="sm" disabled={saving} onClick={handleAdminPublishNow}>
              <CheckCircle2 className="h-4 w-4" />
              حفظ ونشر فوراً
            </Button>
          ) : course.draftVersion?.status === 'SUBMITTED_FOR_REVIEW' ? (
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
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone={draftStatus.tone}>
            حالة المسودة v{course.draftVersion?.versionNumber}: {draftStatus.label}
          </Badge>
          {course.publishedVersion && (
            <Badge tone="success">
              منشور للطلاب: v{course.publishedVersion.versionNumber}
            </Badge>
          )}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ed-cat" label="التخصص / القسم">
              <select
                id="ed-cat"
                className={inputClassName}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— بدون قسم محدد —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameAr}
                  </option>
                ))}
              </select>
            </Field>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ed-thumb-preset" label="صورة الغلاف (اختيار سريع)">
              <select
                id="ed-thumb-preset"
                className={inputClassName}
                value={COVER_IMAGE_PRESETS.some((p) => p.url === thumbnailUrl) ? thumbnailUrl : ''}
                onChange={(e) => {
                  if (e.target.value) setThumbnailUrl(e.target.value);
                }}
              >
                <option value="">— اختر من الصور المعتمدة —</option>
                {COVER_IMAGE_PRESETS.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ed-thumb-url" label="رابط صورة الغلاف المخصص (اختياري)">
              <input
                id="ed-thumb-url"
                dir="ltr"
                className={inputClassName}
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="/images/brand/course-biosecurity.webp"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] px-4 py-3 text-xs">
            <span className="font-bold text-[#A9B1E0]">
              لرفع صورة غلاف أو فيديو جديد من جهازك مباشرة دون نوافذ منبثقة:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="ed-image-file"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C95FF] px-3 py-1.5 font-extrabold text-[#070D2B] cursor-pointer hover:opacity-95"
              >
                <Upload className="h-3.5 w-3.5" />
                رفع صورة من جهازك
              </label>
              <a
                href="#course-media-studio"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#22307A] bg-[#0F1A4A] px-3 py-1.5 font-bold text-[#8CA2FF] hover:border-[#8CA2FF]"
              >
                <Video className="h-3.5 w-3.5" />
                قسم رفع الصور والفيديو ↓
              </a>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ed-obj" label="ماذا سيتعلم الطالب؟ (سطر لكل هدف)">
              <textarea
                id="ed-obj"
                rows={3}
                className={inputClassName}
                value={objectivesText}
                onChange={(e) => setObjectivesText(e.target.value)}
                placeholder={'حساب معدلات التهوية الفعلية\nتطبيق الأمن الحيوي في المزارع'}
              />
            </Field>
            <Field id="ed-req" label="المتطلبات المسبقة (سطر لكل متطلب)">
              <textarea
                id="ed-req"
                rows={3}
                className={inputClassName}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                placeholder={'خلفية أساسية في الطب البيطري أو الزراعة'}
              />
            </Field>
          </div>
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
                    <Trash2 className="h-4 w-4 text-[#FF9CAA]" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {sec.lessons.map((les: any, lIdx: number) => (
                    <div
                      key={lIdx}
                      className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3"
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
                          <option value="VIDEO">فيديو تعليمي</option>
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
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#22307A] pt-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {(les.attachments ?? []).map((att: any) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#22307A] bg-[#0F1A4A] px-2.5 py-1 font-bold text-[#EEF0FF]"
                            >
                              {att.titleAr}
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="text-[#FF9CAA] hover:underline ms-1 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <label className="cursor-pointer rounded-lg border border-[#22307A] bg-[#0F1A4A] px-2.5 py-1 font-bold text-[#8CA2FF] hover:border-[#8CA2FF] transition-colors">
                            {attBusyKey === `${sIdx}-${lIdx}`
                              ? 'جاري الرفع...'
                              : '+ إرفاق ملف (PDF/Excel)'}
                            <input
                              type="file"
                              className="sr-only"
                              disabled={attBusyKey === `${sIdx}-${lIdx}`}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleAttachmentUpload(sIdx, lIdx, les.id, f);
                              }}
                            />
                          </label>
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
                          className="text-[#FF9CAA] font-bold hover:underline cursor-pointer"
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

        {/* Inline Course Media Studio (Images + Video Upload without Popup) */}
        <div id="course-media-studio">
          <Card className="p-6 space-y-6">
          <div className="border-b border-[#22307A] pb-3">
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">
              رفع صور وفيديوهات الكورس من جهازك
            </h2>
            <p className="text-xs text-[#A9B1E0] mt-0.5">
              يمكنك رفع صورة الغلاف أو فيديوهات الدروس مباشرة من جهازك داخل الصفحة ثم حفظ المسودة
            </p>
          </div>
          <div className="grid gap-6 xl:grid-cols-2 items-start">
            <div className="rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-5">
              <ImageUploadField
                inputId="ed-image-file"
                urlInputId="ed-thumb-url-inline"
                label="صورة غلاف الكورس (رفع من جهازك)"
                value={thumbnailUrl}
                onChange={setThumbnailUrl}
                presets={COVER_IMAGE_PRESETS}
              />
            </div>
            <div>
              <VideoChunkUploader
                courseId={courseId}
                onUploaded={(asset) => {
                  setVideos((prev) => [asset, ...prev]);
                }}
              />
            </div>
          </div>
        </Card>
        </div>

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
            <div className="space-y-4">
              {quizQuestions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="space-y-3 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-[#EEF0FF]">
                      السؤال {qIdx + 1}
                    </p>
                    {quizQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuizQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                        }
                        className="text-xs font-bold text-[#FF9CAA] hover:underline cursor-pointer"
                      >
                        حذف السؤال
                      </button>
                    )}
                  </div>
                  <Field
                    id={qIdx === 0 ? 'qz-q' : `qz-q-${qIdx}`}
                    label={qIdx === 0 ? 'نص السؤال الأول' : `نص السؤال ${qIdx + 1}`}
                    required
                  >
                    <input
                      id={qIdx === 0 ? 'qz-q' : `qz-q-${qIdx}`}
                      className={inputClassName}
                      value={q.questionTextAr}
                      onChange={(e) =>
                        setQuizQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qIdx ? { ...item, questionTextAr: e.target.value } : item,
                          ),
                        )
                      }
                      required
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={qIdx === 0 ? 'qz-a' : `qz-a-${qIdx}`} label="الخيار أ" required>
                      <input
                        id={qIdx === 0 ? 'qz-a' : `qz-a-${qIdx}`}
                        className={inputClassName}
                        value={q.optA}
                        onChange={(e) =>
                          setQuizQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, optA: e.target.value } : item,
                            ),
                          )
                        }
                        required
                      />
                    </Field>
                    <Field id={qIdx === 0 ? 'qz-b' : `qz-b-${qIdx}`} label="الخيار ب" required>
                      <input
                        id={qIdx === 0 ? 'qz-b' : `qz-b-${qIdx}`}
                        className={inputClassName}
                        value={q.optB}
                        onChange={(e) =>
                          setQuizQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, optB: e.target.value } : item,
                            ),
                          )
                        }
                        required
                      />
                    </Field>
                  </div>
                  <Field id={qIdx === 0 ? 'qz-cor' : `qz-cor-${qIdx}`} label="الإجابة الصحيحة">
                    <select
                      id={qIdx === 0 ? 'qz-cor' : `qz-cor-${qIdx}`}
                      className={inputClassName}
                      value={q.correctOptionId}
                      onChange={(e) =>
                        setQuizQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qIdx
                              ? { ...item, correctOptionId: e.target.value as 'a' | 'b' }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="a">الخيار أ</option>
                      <option value="b">الخيار ب</option>
                    </select>
                  </Field>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                setQuizQuestions((prev) => [
                  ...prev,
                  { questionTextAr: '', optA: '', optB: '', correctOptionId: 'a' },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              إضافة سؤال آخر للاختبار
            </Button>
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
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Card className="p-4">
                  <p className="text-xs text-[#A9B1E0]">الطلاب المتفاعلون</p>
                  <p className="text-2xl font-extrabold text-[#EEF0FF] mt-1">
                    {analytics.uniqueLearners ?? 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[#A9B1E0]">إجمالي الدروس المكتملة</p>
                  <p className="text-2xl font-extrabold text-[#77E2B5] mt-1">
                    {analytics.completedLessonsTotal ?? 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[#A9B1E0]">محاولات الاختبارات (متوسط الدرجات)</p>
                  <p className="text-2xl font-extrabold text-[#8CA2FF] mt-1">
                    {analytics.quizStats?.totalAttempts ?? 0} محاولة •{' '}
                    {analytics.quizStats?.avgScorePercent ?? 0}%
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-[#A9B1E0]">الشهادات المصدرة / مرات التشغيل</p>
                  <p className="text-2xl font-extrabold text-[#F5B94A] mt-1">
                    {analytics.certificatesIssued ?? 0} شهادة • {analytics.videoPlaybacks ?? 0} مشاهدة
                  </p>
                </Card>
              </div>
              {analytics.reviews?.length > 0 && (
                <div className="space-y-2 border-t border-[#22307A] pt-3">
                  <p className="text-xs font-extrabold text-[#EEF0FF]">
                    أحدث تقييمات المتدربين ({analytics.reviews.length})
                  </p>
                  {analytics.reviews.slice(0, 3).map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                      <span className="font-extrabold text-[#EEF0FF]">{r.user?.fullName}</span> — ⭐ {r.rating}/5
                      {r.commentAr && <p className="text-[#A9B1E0] mt-1">{r.commentAr}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </NativeModal>
      </div>
    </DashboardShell>
  );
}
