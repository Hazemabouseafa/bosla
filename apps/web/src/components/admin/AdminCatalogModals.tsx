'use client';

import React, { useEffect, useState } from 'react';
import { Award, Check } from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch } from '@/lib/api';
import { COVER_IMAGE_PRESETS } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Field, NativeModal, inputClassName } from '@/components/ui/primitives';
import { ImageUploadField } from '@/components/media/ImageUploadField';

export function AdminPathFormModal({
  open,
  editingPath,
  onClose,
  allCourses,
  onSaved,
}: {
  open: boolean;
  editingPath: any | null;
  onClose: () => void;
  allCourses: any[];
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [priceEgp, setPriceEgp] = useState('950');
  const [includedInMembership, setIncludedInMembership] = useState(true);
  const [allowIndividualPurchase, setAllowIndividualPurchase] = useState(true);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingPath) {
      setTitleAr(editingPath.titleAr || '');
      setSlug(editingPath.slug || '');
      setSlugManual(true);
      setSubtitleAr(editingPath.subtitleAr || '');
      setDescriptionAr(editingPath.descriptionAr || '');
      setThumbnailUrl(editingPath.thumbnailUrl || '');
      setPriceEgp(String(Math.round(Number(editingPath.priceCents ?? 95000) / 100)));
      setIncludedInMembership(editingPath.includedInMembership !== false);
      setAllowIndividualPurchase(editingPath.allowIndividualPurchase !== false);
      setCourseIds((editingPath.courses ?? []).map((c: any) => c.courseId));
    } else {
      setTitleAr('');
      setSlug('');
      setSlugManual(false);
      setSubtitleAr('');
      setDescriptionAr('');
      setThumbnailUrl(COVER_IMAGE_PRESETS[4]?.url || '');
      setPriceEgp('950');
      setIncludedInMembership(true);
      setAllowIndividualPurchase(true);
      setCourseIds([]);
    }
  }, [open, editingPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (descriptionAr.trim().length < 10) {
      pushToast('أدخل وصفاً للمسار لا يقل عن 10 أحرف', 'error');
      return;
    }
    setSubmitting(true);
    const finalSlug = (slug.trim() || slugifyTitle(titleAr, 'path')).toLowerCase();
    try {
      const payload = {
        slug: finalSlug,
        titleAr: titleAr.trim(),
        subtitleAr: subtitleAr.trim() || undefined,
        descriptionAr: descriptionAr.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        priceCents: Math.max(0, Math.round((Number(priceEgp) || 0) * 100)),
        includedInMembership,
        allowIndividualPurchase,
        courseLinks: courseIds.map((courseId, idx) => ({
          courseId,
          sortOrder: idx,
          isRequired: true,
        })),
      };
      if (editingPath) {
        await apiFetch(`/admin/learning-paths/${editingPath.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث المسار التعليمي بنجاح', 'success');
      } else {
        await apiFetch('/admin/learning-paths', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('تم إنشاء المسار التعليمي من الكورسات المختارة', 'success');
      }
      onClose();
      await onSaved();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ المسار التعليمي', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={editingPath ? `تعديل المسار: ${editingPath.titleAr}` : 'إنشاء مسار تعليمي جديد'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="ap-title" label="اسم المسار التعليمي" required>
          <input
            id="ap-title"
            className={inputClassName}
            value={titleAr}
            onChange={(e) => {
              const v = e.target.value;
              setTitleAr(v);
              if (!slugManual) setSlug(slugifyTitle(v, 'path'));
            }}
            placeholder="مثال: مسار مهندس إدارة المزارع الحديثة"
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ap-slug" label="الرابط المختصر (يتولد تلقائياً)" required>
            <input
              id="ap-slug"
              dir="ltr"
              className={inputClassName}
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }}
              required
            />
          </Field>
          <Field id="ap-sub" label="وصف مختصر (اختياري)">
            <input
              id="ap-sub"
              className={inputClassName}
              value={subtitleAr}
              onChange={(e) => setSubtitleAr(e.target.value)}
            />
          </Field>
        </div>

        <Field id="ap-desc" label="وصف المسار وأهدافه" required>
          <textarea
            id="ap-desc"
            rows={2}
            className={inputClassName}
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            required
          />
        </Field>

        <ImageUploadField
          inputId="ap-image-file"
          urlInputId="ap-thumb"
          label="صورة غلاف المسار التعليمي"
          value={thumbnailUrl}
          onChange={setThumbnailUrl}
          presets={COVER_IMAGE_PRESETS.slice(4, 10)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ap-price" label="السعر المنفرد للمسار (ج.م)">
            <input
              id="ap-price"
              type="number"
              min={0}
              dir="ltr"
              className={inputClassName}
              value={priceEgp}
              onChange={(e) => setPriceEgp(e.target.value)}
            />
          </Field>
          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 py-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={includedInMembership}
                onChange={(e) => setIncludedInMembership(e.target.checked)}
                className="h-4 w-4 accent-[#7C95FF]"
              />
              شامل ضمن الاشتراك الشهري والسنوي
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 py-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={allowIndividualPurchase}
                onChange={(e) => setAllowIndividualPurchase(e.target.checked)}
                className="h-4 w-4 accent-[#7C95FF]"
              />
              متاح للشراء الفردي دون عضوية
            </label>
          </div>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto border border-[#8CA2FF]/20 rounded-xl p-3.5 text-xs bg-[#080F33]">
          <p className="font-bold text-bosla-ink">اختر الكورسات المكونة للمسار ({courseIds.length}):</p>
          {allCourses.map((c) => {
            const idx = courseIds.indexOf(c.id);
            const checked = idx !== -1;
            return (
              <label key={c.id} className="flex items-center justify-between gap-2 py-1 cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setCourseIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                    className="h-4 w-4 accent-bosla-primary"
                  />
                  <span className="font-semibold">
                    {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                  </span>
                </span>
                {checked && <Badge tone="info">#{idx + 1}</Badge>}
              </label>
            );
          })}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'جاري الحفظ...' : editingPath ? 'حفظ تعديلات المسار' : 'حفظ المسار التعليمي'}
        </Button>
      </form>
    </NativeModal>
  );
}

export function AdminDiplomaFormModal({
  open,
  editingDiploma,
  onClose,
  allCourses,
  onSaved,
}: {
  open: boolean;
  editingDiploma: any | null;
  onClose: () => void;
  allCourses: any[];
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [totalHours, setTotalHours] = useState(140);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [priceEgp, setPriceEgp] = useState('0');
  const [includedInMembership, setIncludedInMembership] = useState(true);
  const [allowIndividualPurchase, setAllowIndividualPurchase] = useState(true);
  const [hasOptionalFinalProject, setHasOptionalFinalProject] = useState(true);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingDiploma) {
      setTitleAr(editingDiploma.titleAr || '');
      setSlug(editingDiploma.slug || '');
      setSlugManual(true);
      setSubtitleAr(editingDiploma.subtitleAr || '');
      setDescriptionAr(editingDiploma.descriptionAr || '');
      setTotalHours(Number(editingDiploma.totalHours ?? 140));
      setThumbnailUrl(editingDiploma.thumbnailUrl || '');
      setPriceEgp(String(Math.round((Number(editingDiploma.priceCents ?? 0)) / 100)));
      setIncludedInMembership(Boolean(editingDiploma.includedInMembership ?? true));
      setAllowIndividualPurchase(Boolean(editingDiploma.allowIndividualPurchase ?? true));
      setHasOptionalFinalProject(Boolean(editingDiploma.hasOptionalFinalProject ?? true));
      setCertificateEnabled(Boolean(editingDiploma.certificateEnabled ?? true));
      setCourseIds((editingDiploma.courses ?? []).map((c: any) => c.courseId));
    } else {
      setTitleAr('');
      setSlug('');
      setSlugManual(false);
      setSubtitleAr('');
      setDescriptionAr('');
      setTotalHours(140);
      setThumbnailUrl(COVER_IMAGE_PRESETS[0]?.url || '');
      setPriceEgp('1990');
      setIncludedInMembership(true);
      setAllowIndividualPurchase(true);
      setHasOptionalFinalProject(true);
      setCertificateEnabled(true);
      setCourseIds([]);
    }
  }, [open, editingDiploma]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (descriptionAr.trim().length < 10) {
      pushToast('أدخل وصفاً للدبلومة لا يقل عن 10 أحرف', 'error');
      return;
    }
    setSubmitting(true);
    const finalSlug = (slug.trim() || slugifyTitle(titleAr, 'diploma')).toLowerCase();
    try {
      const payload = {
        slug: finalSlug,
        titleAr: titleAr.trim(),
        subtitleAr: subtitleAr.trim() || undefined,
        descriptionAr: descriptionAr.trim(),
        totalHours: Number(totalHours) || 0,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        priceCents: Math.max(0, Math.round((Number(priceEgp) || 0) * 100)),
        includedInMembership,
        allowIndividualPurchase,
        hasOptionalFinalProject,
        certificateEnabled,
        courseLinks: courseIds.map((courseId, idx) => ({
          courseId,
          sortOrder: idx,
          isRequired: true,
        })),
      };
      if (editingDiploma) {
        await apiFetch(`/admin/diplomas/${editingDiploma.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث بيانات الدبلومة بنجاح', 'success');
      } else {
        await apiFetch('/admin/diplomas', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('تم إنشاء الدبلومة بنجاح', 'success');
      }
      onClose();
      await onSaved();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ الدبلومة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={editingDiploma ? `تعديل الدبلومة: ${editingDiploma.titleAr}` : 'إنشاء دبلومة تطبيقية جديدة'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="ad-title" label="عنوان الدبلومة التطبيقية" required>
          <input
            id="ad-title"
            className={inputClassName}
            value={titleAr}
            onChange={(e) => {
              const v = e.target.value;
              setTitleAr(v);
              if (!slugManual) setSlug(slugifyTitle(v, 'diploma'));
            }}
            placeholder="مثال: دبلومة مدير مزرعة الدواجن المحترف"
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ad-slug" label="الرابط المختصر (يتولد تلقائياً)" required>
            <input
              id="ad-slug"
              dir="ltr"
              className={inputClassName}
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }}
              required
            />
          </Field>
          <Field id="ad-hrs" label="إجمالي الساعات التدريبية">
            <input
              id="ad-hrs"
              type="number"
              min={0}
              className={inputClassName}
              value={totalHours}
              onChange={(e) => setTotalHours(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field id="ad-sub" label="العنوان الفرعي (اختياري)">
          <input
            id="ad-sub"
            className={inputClassName}
            value={subtitleAr}
            onChange={(e) => setSubtitleAr(e.target.value)}
          />
        </Field>

        <Field id="ad-desc" label="الوصف التفصيلي" required>
          <textarea
            id="ad-desc"
            rows={2}
            className={inputClassName}
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            required
          />
        </Field>

        <ImageUploadField
          inputId="ad-image-file"
          urlInputId="ad-thumb"
          label="صورة غلاف الدبلومة"
          value={thumbnailUrl}
          onChange={setThumbnailUrl}
          presets={COVER_IMAGE_PRESETS.slice(0, 6)}
        />

        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <Field id="dp-price" label="سعر الدبلومة المنفرد (ج.م)">
            <input
              id="dp-price"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              className={inputClassName}
              value={priceEgp}
              onChange={(e) => setPriceEgp(e.target.value)}
            />
          </Field>
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-bosla-line p-2.5 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={includedInMembership}
              onChange={(e) => setIncludedInMembership(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            مشمولة في الاشتراك الشهري/السنوي
          </label>
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-bosla-line p-2.5 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={allowIndividualPurchase}
              onChange={(e) => setAllowIndividualPurchase(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            متاحة للشراء الفردي المباشر
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <label className="flex items-center gap-2 rounded-xl border border-bosla-line p-2.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={hasOptionalFinalProject}
              onChange={(e) => setHasOptionalFinalProject(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            تتضمن مشروع تخرج تطبيقي
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-bosla-line p-2.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={certificateEnabled}
              onChange={(e) => setCertificateEnabled(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            إصدار شهادة دبلومة موثقة
          </label>
        </div>

        <div className="space-y-2 max-h-44 overflow-y-auto border border-bosla-line rounded-xl p-3 text-xs bg-bosla-bg/40">
          <p className="font-bold text-bosla-ink">الكورسات المكونة للدبلومة ({courseIds.length}):</p>
          {allCourses.map((c) => {
            const checked = courseIds.includes(c.id);
            return (
              <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setCourseIds((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
                  }
                  className="h-4 w-4 accent-bosla-primary"
                />
                <span className="font-semibold">
                  {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                </span>
              </label>
            );
          })}
        </div>

        <Button type="submit" variant="gold" className="w-full" disabled={submitting}>
          {submitting ? 'جاري الحفظ...' : editingDiploma ? 'حفظ تعديلات الدبلومة' : 'حفظ الدبلومة'}
        </Button>
      </form>
    </NativeModal>
  );
}

export function AdminGradeSubmissionModal({
  submission,
  onClose,
  onGraded,
}: {
  submission: any | null;
  onClose: () => void;
  onGraded: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [scorePercent, setScorePercent] = useState(90);
  const [feedbackAr, setFeedbackAr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!submission) return;
    setScorePercent(submission.scorePercent ?? 90);
    setFeedbackAr(submission.feedbackAr || 'عمل تطبيقي ممتاز واستيفاء واضح لمتطلبات الدبلومة.');
  }, [submission]);

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<any>(`/admin/diplomas/submissions/${submission.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          scorePercent: Number(scorePercent),
          feedbackAr: feedbackAr.trim() || undefined,
        }),
      });
      const issuedCount = res?.issuedCertificates?.length ?? 0;
      pushToast(
        issuedCount > 0
          ? 'تم اعتماد التقييم وإصدار شهادة الدبلومة تلقائياً للمتدرب!'
          : 'تم تسجيل نتيجة وتقييم المشروع بنجاح.',
        'success',
      );
      onClose();
      await onGraded();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التقييم', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal
      open={Boolean(submission)}
      onClose={onClose}
      title="مراجعة وتقييم مشروع الدبلومة"
    >
      {submission && (
        <form onSubmit={handleGrade} className="space-y-4">
          <div className="rounded-2xl border border-bosla-line bg-bosla-bg/60 p-4 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-bosla-ink">{submission.user?.fullName}</p>
              <Badge tone="info">{submission.assessment?.diploma?.titleAr}</Badge>
            </div>
            <p className="text-bosla-muted leading-relaxed whitespace-pre-wrap">
              {submission.submissionText}
            </p>
            {submission.assessment?.passingScorePercent !== undefined && (
              <p className="text-[11px] font-bold text-bosla-tealText">
                درجة النجاح المطلوبة: {submission.assessment.passingScorePercent}%
              </p>
            )}
          </div>

          <Field id="grade-pct" label="الدرجة المئوية (0 إلى 100)" required>
            <input
              id="grade-pct"
              type="number"
              min={0}
              max={100}
              dir="ltr"
              className={inputClassName}
              value={scorePercent}
              onChange={(e) => setScorePercent(Number(e.target.value))}
              required
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {[
              { label: '95% امتياز', val: 95 },
              { label: '85% جيد جداً', val: 85 },
              { label: '75% مقبول', val: 75 },
              { label: '55% يتطلب تحسين', val: 55 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setScorePercent(p.val)}
                className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer ${
                  scorePercent === p.val
                    ? 'border-[#8CA2FF] bg-[#7C95FF]/20 text-[#8CA2FF]'
                    : 'border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
                }`}
              >
                {scorePercent === p.val && <Check className="inline h-3 w-3 me-1" />}
                {p.label}
              </button>
            ))}
          </div>

          <Field id="grade-fb" label="ملاحظات وتوجيهات المقيم">
            <textarea
              id="grade-fb"
              rows={3}
              className={inputClassName}
              value={feedbackAr}
              onChange={(e) => setFeedbackAr(e.target.value)}
              placeholder="اكتب تقييماً عملياً بناءً للمتدرب..."
            />
          </Field>

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            <Award className="h-4 w-4" />
            {submitting ? 'جاري اعتماد التقييم...' : 'حفظ التقييم واعتماد النتيجة'}
          </Button>
        </form>
      )}
    </NativeModal>
  );
}
