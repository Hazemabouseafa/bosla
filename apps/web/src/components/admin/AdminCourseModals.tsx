'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookPlus,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Save,
  Video,
} from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch, formatDurationSeconds } from '@/lib/api';
import { COVER_IMAGE_PRESETS, getCourseStatusMeta, getVideoStatusMeta } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { ImageUploadField } from '@/components/media/ImageUploadField';
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

interface AdminCourseModalsProps {
  categories: any[];
  users: any[];
}

export function AdminCreateCourseModal({
  open,
  onClose,
  categories,
  users,
  onCreated,
}: AdminCourseModalsProps & {
  open: boolean;
  onClose: () => void;
  onCreated: (created: any, openEditorAfter?: boolean) => Promise<void> | void;
}) {
  const { user, pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [isFree, setIsFree] = useState(false);
  const [priceEgp, setPriceEgp] = useState('450');
  const [includedInMembership, setIncludedInMembership] = useState(true);
  const [allowIndividualPurchase, setAllowIndividualPurchase] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState(COVER_IMAGE_PRESETS[0]?.url || '');
  const [submitting, setSubmitting] = useState(false);

  const eligibleInstructors = users.filter(
    (u) => u.role === 'INSTRUCTOR' || u.role === 'ADMIN',
  );

  useEffect(() => {
    if (open) {
      if (!instructorId) {
        const defaultInst =
          eligibleInstructors.find((u) => u.role === 'INSTRUCTOR') ||
          eligibleInstructors.find((u) => u.id === user?.id);
        if (defaultInst) setInstructorId(defaultInst.id);
      }
      if (!categoryId && categories.length > 0) {
        setCategoryId(categories[0].id);
      }
    }
  }, [open, categories, eligibleInstructors, instructorId, categoryId, user?.id]);

  const resetForm = () => {
    setTitleAr('');
    setSlug('');
    setSlugManual(false);
    setSubtitleAr('');
    setDescriptionAr('');
    setDifficulty('BEGINNER');
    setIsFree(false);
    setThumbnailUrl(COVER_IMAGE_PRESETS[0]?.url || '');
  };

  const handleSubmit = async (publishImmediately: boolean, openEditorAfter: boolean) => {
    const cleanTitle = titleAr.trim();
    const cleanDesc = descriptionAr.trim();
    if (cleanTitle.length < 3) {
      pushToast('أدخل عنواناً واضحاً للكورس (3 أحرف على الأقل)', 'error');
      return;
    }
    if (cleanDesc.length < 10) {
      pushToast('أدخل وصفاً تفصيلياً للكورس (10 أحرف على الأقل)', 'error');
      return;
    }

    const finalSlug = (slug.trim() || slugifyTitle(cleanTitle, 'course')).toLowerCase();
    setSubmitting(true);
    try {
      const created = await apiFetch<any>('/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: cleanTitle,
          slug: finalSlug,
          subtitleAr: subtitleAr.trim() || undefined,
          descriptionAr: cleanDesc,
          categoryId: categoryId || null,
          instructorId: instructorId || undefined,
          difficulty,
          isFree,
          priceCents: isFree ? 0 : Math.max(0, Math.round((Number(priceEgp) || 0) * 100)),
          includedInMembership,
          allowIndividualPurchase,
          thumbnailUrl: thumbnailUrl.trim() || null,
          publishImmediately,
        }),
      });
      pushToast(
        publishImmediately
          ? 'تم إنشاء الكورس ونشره للطلاب بنجاح!'
          : 'تم إنشاء الكورس كمسودة بنجاح!',
        'success',
      );
      resetForm();
      onClose();
      await onCreated(created, openEditorAfter);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الكورس', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal open={open} onClose={onClose} title="إضافة كورس جديد إلى المنصة">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(false, true);
        }}
        className="space-y-4"
      >
        <div className="rounded-xl border border-[#8CA2FF]/35 bg-[#0B1440] p-3.5 text-xs sm:text-sm text-[#EEF0FF] font-semibold">
          يمكنك إضافة بيانات الكورس وتحديد المدرب ثم فتح محرر الدروس مباشرة لإضافة الأقسام والفيديو والملفات، أو نشره فوراً للطلاب.
        </div>

        <Field id="ac-title" label="عنوان الكورس" required>
          <input
            id="ac-title"
            className={inputClassName}
            value={titleAr}
            onChange={(e) => {
              const v = e.target.value;
              setTitleAr(v);
              if (!slugManual) {
                setSlug(slugifyTitle(v, 'course'));
              }
            }}
            placeholder="مثال: الإدارة المتكاملة لمزارع الدواجن البياضة"
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="ac-slug"
            label="الرابط المختصر للكورس (يتولد تلقائياً)"
            hint="يمكنك تركه كما هو أو تعديله بحروف إنجليزية صغيرة وشرطة فقط"
            required
          >
            <input
              id="ac-slug"
              dir="ltr"
              className={inputClassName}
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }}
              placeholder="poultry-layer-management"
              required
            />
          </Field>

          <Field id="ac-instructor" label="المدرب المسؤول">
            <select
              id="ac-instructor"
              className={inputClassName}
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
            >
              {eligibleInstructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.fullName} {inst.role === 'ADMIN' ? '(إدارة المنصة)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ac-cat" label="التخصص العلمي">
            <select
              id="ac-cat"
              className={inputClassName}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">بدون تخصص محدد</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <Field id="ac-diff" label="مستوى الكورس">
            <select
              id="ac-diff"
              className={inputClassName}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <option value="BEGINNER">مبتدئ (تأسيسي)</option>
              <option value="INTERMEDIATE">متوسط (تطبيقي)</option>
              <option value="ADVANCED">متقدم (تخصصي)</option>
            </select>
          </Field>
        </div>

        <Field id="ac-sub" label="وصف مختصر يظهر أسفل العنوان (اختياري)">
          <input
            id="ac-sub"
            className={inputClassName}
            value={subtitleAr}
            onChange={(e) => setSubtitleAr(e.target.value)}
            placeholder="دليل عملي لرفع الإنتاجية وتقليل الفاقد داخل العنبر"
          />
        </Field>

        <Field
          id="ac-desc"
          label="الوصف التفصيلي للكورس"
          hint={`${descriptionAr.trim().length} / 10 أحرف على الأقل`}
          required
        >
          <textarea
            id="ac-desc"
            rows={3}
            className={inputClassName}
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            placeholder="اشرح محاور الكورس والفئة المستهدفة والنتائج العملية التي سيحققها المتدرب..."
            required
          />
        </Field>

        <ImageUploadField
          inputId="ac-image-file"
          urlInputId="ac-thumb"
          label="صورة غلاف الكورس (رفع من جهازك أو اختيار سريع)"
          value={thumbnailUrl}
          onChange={setThumbnailUrl}
          presets={COVER_IMAGE_PRESETS}
          compact
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ac-price" label="السعر المنفرد (ج.م)" hint="يُدفع عند الاشتراك في الكورس بدون عضوية">
            <input
              id="ac-price"
              type="number"
              min={0}
              dir="ltr"
              className={inputClassName}
              value={isFree ? '0' : priceEgp}
              disabled={isFree}
              onChange={(e) => setPriceEgp(e.target.value)}
            />
          </Field>
          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 py-2 font-bold text-[#EEF0FF] cursor-pointer">
              <input
                type="checkbox"
                checked={includedInMembership}
                onChange={(e) => setIncludedInMembership(e.target.checked)}
                className="h-4 w-4 accent-[#7C95FF]"
              />
              شامل ضمن الاشتراك الشهري والسنوي
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 py-2 font-bold text-[#EEF0FF] cursor-pointer">
              <input
                type="checkbox"
                checked={allowIndividualPurchase}
                onChange={(e) => setAllowIndividualPurchase(e.target.checked)}
                className="h-4 w-4 accent-[#7C95FF]"
              />
              متاح للشراء الفردي دون اشتراك عضوية
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-bosla-line bg-bosla-bg/40 px-3.5 py-2.5 text-sm font-bold text-bosla-ink cursor-pointer">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="h-4 w-4 accent-bosla-primary"
          />
          إتاحة هذا الكورس مجاناً لجميع الطلاب بدون اشتراك مدفوع
        </label>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={submitting}
          >
            <BookPlus className="h-4 w-4" />
            {submitting ? 'جاري الإنشاء...' : 'إنشاء وفتح محرر الدروس'}
          </Button>
          <Button
            type="button"
            variant="gold"
            className="flex-1"
            disabled={submitting}
            onClick={() => void handleSubmit(true, false)}
          >
            <CheckCircle2 className="h-4 w-4" />
            إنشاء ونشر فوراً للطلاب
          </Button>
        </div>
      </form>
    </NativeModal>
  );
}

export function AdminEditCoursePanel({
  course,
  onClose,
  categories,
  users,
  onUpdated,
  onPublish,
  onUnpublish,
}: AdminCourseModalsProps & {
  course: any;
  onClose: () => void;
  onUpdated: (updatedCourse?: any) => Promise<void> | void;
  onPublish?: (courseId: string) => Promise<void> | void;
  onUnpublish?: (courseId: string) => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [isFree, setIsFree] = useState(false);
  const [priceEgp, setPriceEgp] = useState('0');
  const [includedInMembership, setIncludedInMembership] = useState(true);
  const [allowIndividualPurchase, setAllowIndividualPurchase] = useState(true);
  const [featuredOrder, setFeaturedOrder] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [courseVideos, setCourseVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [showAllLibraryVideos, setShowAllLibraryVideos] = useState(false);

  const eligibleInstructors = users.filter(
    (u) => u.role === 'INSTRUCTOR' || u.role === 'ADMIN',
  );

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const list = await apiFetch<any[]>('/instructor/videos');
      setCourseVideos(Array.isArray(list) ? list : []);
    } catch {
      setCourseVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!course) return;
    const ver = course.draftVersion || course.publishedVersion;
    setTitleAr(ver?.titleAr || '');
    setSubtitleAr(ver?.subtitleAr || '');
    setDescriptionAr(ver?.descriptionAr || '');
    setSlug(course.slug || '');
    setCategoryId(course.categoryId || '');
    setInstructorId(course.instructorId || course.instructor?.id || '');
    setDifficulty(course.difficulty || 'BEGINNER');
    setIsFree(Boolean(course.isFree));
    setPriceEgp(String(Math.round((Number(course.priceCents ?? 0)) / 100)));
    setIncludedInMembership(Boolean(course.includedInMembership ?? true));
    setAllowIndividualPurchase(Boolean(course.allowIndividualPurchase ?? true));
    setFeaturedOrder(Number(course.featuredOrder ?? 0));
    setThumbnailUrl(ver?.thumbnailUrl || '');
    setSavedNotice(false);
    void loadVideos();
  }, [course, loadVideos]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setSubmitting(true);
    setSavedNotice(false);
    try {
      const updatedCourse = await apiFetch<any>(`/admin/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: titleAr.trim(),
          subtitleAr: subtitleAr.trim() || null,
          descriptionAr: descriptionAr.trim(),
          slug: slug.trim(),
          categoryId: categoryId || null,
          instructorId: instructorId || undefined,
          difficulty,
          isFree,
          priceCents: isFree ? 0 : Math.max(0, Math.round((Number(priceEgp) || 0) * 100)),
          includedInMembership,
          allowIndividualPurchase,
          featuredOrder: Number.isFinite(featuredOrder) ? Math.max(0, Math.round(featuredOrder)) : 0,
          thumbnailUrl: thumbnailUrl.trim() || null,
        }),
      });
      setSavedNotice(true);
      pushToast('تم تحديث بيانات وصورة الكورس بنجاح', 'success');
      await onUpdated(updatedCourse);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ تعديلات الكورس', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!course) return null;

  const statusMeta = getCourseStatusMeta(course.status);
  const matchingCourseVideos = courseVideos.filter((v) => v.courseId === course.id);
  const displayedVideos = showAllLibraryVideos ? courseVideos : matchingCourseVideos;

  return (
    <section aria-label="تعديل الكورس" className="space-y-6">
      {/* Top Inline Editor Navigation & Quick Actions */}
      <Card className="p-5 border-[#22307A] bg-[#0F1A4A]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <ArrowRight className="h-4 w-4" />
              العودة إلى الكورسات
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#EEF0FF] truncate">
                  تعديل الكورس: {titleAr || course.slug}
                </h2>
                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
              </div>
              <p className="text-xs text-[#A9B1E0] mt-0.5" dir="ltr">
                /{course.slug}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              form="ec-edit-form"
              variant="primary"
              size="sm"
              disabled={submitting}
            >
              <Save className="h-4 w-4" />
              {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
            {course.status !== 'PUBLISHED' && onPublish ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={() => void onPublish(course.id)}
              >
                <CheckCircle2 className="h-4 w-4" />
                نشر للطلاب
              </Button>
            ) : (
              onUnpublish && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onUnpublish(course.id)}
                >
                  إيقاف النشر
                </Button>
              )
            )}
            <Link href={`/instructor/courses/${course.id}`}>
              <Button type="button" variant="navy" size="sm">
                <ExternalLink className="h-4 w-4" />
                إدارة الدروس والاختبارات
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {savedNotice && (
        <AlertBanner tone="success">
          <span className="inline-flex items-center gap-2 font-extrabold">
            <CheckCircle2 className="h-4 w-4" />
            تم حفظ تعديلات بيانات وصورة الكورس بنجاح.
          </span>
        </AlertBanner>
      )}

      {/* Two-Column Inline Workspace: Basic Info + Local Image & Video Upload */}
      <div className="grid gap-6 xl:grid-cols-12 items-start">
        {/* Left/Start Column: Course Metadata Form */}
        <Card className="p-6 xl:col-span-6">
          <form id="ec-edit-form" onSubmit={handleSave} className="space-y-4">
            <div className="border-b border-[#22307A] pb-3">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">
                البيانات الأساسية للكورس
              </h3>
              <p className="text-xs text-[#A9B1E0] mt-0.5">
                عدّل اسم الكورس والمدرب والتخصص والوصف مباشرة من الصفحة
              </p>
            </div>

            <Field id="ec-title" label="عنوان الكورس" required>
              <input
                id="ec-title"
                className={inputClassName}
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ec-slug" label="الرابط المختصر" required>
                <input
                  id="ec-slug"
                  dir="ltr"
                  className={inputClassName}
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                  }
                  required
                />
              </Field>
              <Field id="ec-inst" label="المدرب المسؤول">
                <select
                  id="ec-inst"
                  className={inputClassName}
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                >
                  {eligibleInstructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.fullName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ec-cat" label="التخصص">
                <select
                  id="ec-cat"
                  className={inputClassName}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">بدون تخصص</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="ec-diff" label="المستوى">
                <select
                  id="ec-diff"
                  className={inputClassName}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                >
                  <option value="BEGINNER">مبتدئ</option>
                  <option value="INTERMEDIATE">متوسط</option>
                  <option value="ADVANCED">متقدم</option>
                </select>
              </Field>
            </div>

            <Field id="ec-sub" label="العنوان الفرعي">
              <input
                id="ec-sub"
                className={inputClassName}
                value={subtitleAr}
                onChange={(e) => setSubtitleAr(e.target.value)}
              />
            </Field>

            <Field id="ec-desc" label="الوصف التفصيلي" required>
              <textarea
                id="ec-desc"
                rows={4}
                className={inputClassName}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <Field id="ec-order" label="أولوية الظهور في الكتالوج (0 = الأعلى)">
                <input
                  id="ec-order"
                  type="number"
                  min={0}
                  max={9999}
                  dir="ltr"
                  className={inputClassName}
                  value={featuredOrder}
                  onChange={(e) => setFeaturedOrder(Number(e.target.value || 0))}
                />
              </Field>
              <Field id="ec-price" label="سعر الشراء المنفرد (ج.م)">
                <input
                  id="ec-price"
                  type="number"
                  min={0}
                  step="1"
                  dir="ltr"
                  disabled={isFree}
                  className={inputClassName}
                  value={isFree ? '0' : priceEgp}
                  onChange={(e) => setPriceEgp(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2.5 text-sm font-bold text-[#EEF0FF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="h-4 w-4 accent-[#7C95FF]"
                />
                كورس مجاني بالكامل
              </label>
              <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2.5 text-sm font-bold text-[#EEF0FF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includedInMembership}
                  onChange={(e) => setIncludedInMembership(e.target.checked)}
                  className="h-4 w-4 accent-[#7C95FF]"
                />
                مشمول في الاشتراك الشهري/السنوي
              </label>
              <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2.5 text-sm font-bold text-[#EEF0FF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowIndividualPurchase}
                  onChange={(e) => setAllowIndividualPurchase(e.target.checked)}
                  className="h-4 w-4 accent-[#7C95FF]"
                />
                متاح للشراء الفردي
              </label>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
                <Save className="h-4 w-4" />
                {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء والعودة
              </Button>
            </div>
          </form>
        </Card>

        {/* Right/End Column: Direct Image & Video Uploads from Device (Non-Popup) */}
        <div className="space-y-6 xl:col-span-6">
          {/* Course Images Upload Card */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#22307A] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-[#8CA2FF]" />
                  صور الكورس (رفع مباشر من جهازك)
                </h3>
                <p className="text-xs text-[#A9B1E0] mt-0.5">
                  ارفع صورة الغلاف من جهازك أو اختر من مكتبة الصور ثم احفظ التعديلات
                </p>
              </div>
              <Button
                type="submit"
                form="ec-edit-form"
                variant="outline"
                size="sm"
                disabled={submitting}
              >
                <Save className="h-3.5 w-3.5" />
                حفظ الصورة والبيانات
              </Button>
            </div>

            <ImageUploadField
              inputId="ec-image-file"
              urlInputId="ec-thumb"
              label="صورة غلاف الكورس"
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
              presets={COVER_IMAGE_PRESETS}
            />
          </Card>

          {/* Inline Course Videos Upload Card */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#22307A] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <Video className="h-5 w-5 text-[#8CA2FF]" />
                  فيديوهات الكورس (رفع من جهازك مباشرة)
                </h3>
                <p className="text-xs text-[#A9B1E0] mt-0.5">
                  ارفع فيديوهات الكورس من جهازك مجزأة وبأمان ثم اربطها بالدروس من محرر المنهج
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={videosLoading}
                onClick={() => void loadVideos()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${videosLoading ? 'animate-spin' : ''}`} />
                تحديث القائمة
              </Button>
            </div>

            <VideoChunkUploader
              courseId={course.id}
              compact
              onUploaded={(asset) => {
                setCourseVideos((prev) => [asset, ...prev.filter((item) => item.id !== asset.id)]);
              }}
            />

            <div className="space-y-2.5 pt-2 border-t border-[#22307A]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-[#EEF0FF]">
                  {showAllLibraryVideos
                    ? `جميع فيديوهات المكتبة (${courseVideos.length})`
                    : `فيديوهات هذا الكورس (${matchingCourseVideos.length})`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAllLibraryVideos((prev) => !prev)}
                  className="text-xs font-bold text-[#8CA2FF] hover:underline cursor-pointer"
                >
                  {showAllLibraryVideos
                    ? `عرض فيديوهات الكورس فقط (${matchingCourseVideos.length})`
                    : `عرض كل فيديوهات المكتبة (${courseVideos.length})`}
                </button>
              </div>

              {displayedVideos.length === 0 ? (
                <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-center text-xs text-[#A9B1E0]">
                  لا توجد فيديوهات مرفوعة لهذا الكورس بعد. استخدم أداة الرفع أعلاه لرفع فيديو من جهازك.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
                  {displayedVideos.map((vid) => {
                    const vm = getVideoStatusMeta(vid.status);
                    return (
                      <div
                        key={vid.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold text-[#EEF0FF] truncate">{vid.titleAr}</p>
                          <p className="text-[#A9B1E0] mt-0.5">
                            {vid.durationSeconds ? formatDurationSeconds(vid.durationSeconds) : 'جاري قراءة المدة'}
                            {vid.courseId === course.id ? ' • مرتبط بهذا الكورس' : ''}
                          </p>
                        </div>
                        <Badge tone={vm.tone}>{vm.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-1">
                <Link href={`/instructor/courses/${course.id}`}>
                  <Button type="button" variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4" />
                    ربط الفيديوهات بأقسام ودروس الكورس داخل محرر المنهج
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
