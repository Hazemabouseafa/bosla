'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, FileEdit } from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Field, NativeModal, inputClassName } from '@/components/ui/primitives';

export function AdminMembershipPlanModal({
  open,
  plan,
  onClose,
  allCourses,
  paths,
  diplomas,
  onSaved,
}: {
  open: boolean;
  plan: any | null;
  onClose: () => void;
  allCourses: any[];
  paths: any[];
  diplomas: any[];
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [nameAr, setNameAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [interval, setInterval] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUAL'>('MONTHLY');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [priceEgp, setPriceEgp] = useState(490);
  const [compareAtPriceEgp, setCompareAtPriceEgp] = useState<string>('');
  const [discountLabelAr, setDiscountLabelAr] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [entitlementMode, setEntitlementMode] = useState<'FOLLOW_LATEST_PLAN' | 'SNAPSHOT_ON_SUBSCRIBE'>('FOLLOW_LATEST_PLAN');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [diplomaIds, setDiplomaIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (plan) {
      const rev = plan.revisions?.[0];
      setNameAr(plan.nameAr || '');
      setSlug(plan.slug || '');
      setSlugManual(true);
      setInterval(plan.interval || 'MONTHLY');
      setDescriptionAr(plan.descriptionAr || '');
      setPriceEgp(Math.round((plan.priceCents || 0) / 100));
      setCompareAtPriceEgp(
        plan.compareAtPriceCents ? String(Math.round(plan.compareAtPriceCents / 100)) : '',
      );
      setDiscountLabelAr(plan.discountLabelAr || '');
      setIsActive(Boolean(plan.isActive ?? true));
      setIsVisible(Boolean(plan.isVisible ?? true));
      setEntitlementMode(rev?.entitlementMode || 'FOLLOW_LATEST_PLAN');
      setCourseIds((rev?.courses ?? []).map((c: any) => c.courseId));
      setPathIds((rev?.learningPaths ?? []).map((p: any) => p.learningPathId));
      setDiplomaIds((rev?.diplomas ?? []).map((d: any) => d.diplomaId));
    } else {
      setNameAr('');
      setSlug('');
      setSlugManual(false);
      setInterval('MONTHLY');
      setDescriptionAr('وصول كامل للمكتبة التدريبية المحددة طوال فترة العضوية.');
      setPriceEgp(490);
      setCompareAtPriceEgp('');
      setDiscountLabelAr('');
      setIsActive(true);
      setIsVisible(true);
      setEntitlementMode('FOLLOW_LATEST_PLAN');
      setCourseIds([]);
      setPathIds([]);
      setDiplomaIds([]);
    }
  }, [open, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (descriptionAr.trim().length < 5) {
      pushToast('أدخل وصفاً واضحاً للباقة', 'error');
      return;
    }
    setSubmitting(true);
    const finalSlug = (slug.trim() || slugifyTitle(nameAr, 'plan')).toLowerCase();
    try {
      const payload = {
        slug: finalSlug,
        interval,
        nameAr: nameAr.trim(),
        descriptionAr: descriptionAr.trim(),
        priceCents: Math.max(0, Math.round(Number(priceEgp) * 100)),
        compareAtPriceCents: compareAtPriceEgp.trim()
          ? Math.max(0, Math.round(Number(compareAtPriceEgp) * 100))
          : null,
        discountLabelAr: discountLabelAr.trim() || null,
        isActive,
        isVisible,
        sortOrder: plan?.sortOrder ?? 0,
        entitlementMode,
        courseIds,
        learningPathIds: pathIds,
        diplomaIds,
        notesAr: plan ? 'تحديث من لوحة الإدارة' : 'إنشاء باقة عضوية جديدة',
      };

      if (plan) {
        await apiFetch(`/admin/membership-plans/${plan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث سعر ومحتوى العضوية بنسخة جديدة', 'success');
      } else {
        await apiFetch('/admin/membership-plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('تم إنشاء باقة العضوية بنجاح', 'success');
      }
      onClose();
      await onSaved();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ باقة العضوية', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={plan ? `تعديل باقة: ${plan.nameAr}` : 'إضافة باقة عضوية جديدة'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pl-name" label="اسم الباقة" required>
            <input
              id="pl-name"
              className={inputClassName}
              value={nameAr}
              onChange={(e) => {
                const v = e.target.value;
                setNameAr(v);
                if (!slugManual) setSlug(slugifyTitle(v, 'plan'));
              }}
              placeholder="مثال: الباقة الذهبية السنوية"
              required
            />
          </Field>
          <Field id="pl-interval" label="دورة الفوترة">
            <select
              id="pl-interval"
              className={inputClassName}
              value={interval}
              onChange={(e) => setInterval(e.target.value as any)}
            >
              <option value="MONTHLY">باقة شهرية</option>
              <option value="QUARTERLY">باقة ربع سنوية</option>
              <option value="ANNUAL">باقة سنوية</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="pl-price" label="السعر بالجنيه المصري" required>
            <input
              id="pl-price"
              type="number"
              min={0}
              className={inputClassName}
              value={priceEgp}
              onChange={(e) => setPriceEgp(Number(e.target.value))}
              required
            />
          </Field>
          <Field id="pl-compare" label="السعر قبل الخصم (اختياري)">
            <input
              id="pl-compare"
              type="number"
              min={0}
              className={inputClassName}
              value={compareAtPriceEgp}
              onChange={(e) => setCompareAtPriceEgp(e.target.value)}
            />
          </Field>
          <Field id="pl-badge" label="شارة تمييز (اختياري)">
            <input
              id="pl-badge"
              className={inputClassName}
              value={discountLabelAr}
              onChange={(e) => setDiscountLabelAr(e.target.value)}
              placeholder="الأكثر توفيراً"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pl-slug" label="الرابط المختصر" required>
            <input
              id="pl-slug"
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
          <Field id="pl-mode" label="تحديث المحتوى للمشتركين الحاليين">
            <select
              id="pl-mode"
              className={inputClassName}
              value={entitlementMode}
              onChange={(e) => setEntitlementMode(e.target.value as any)}
            >
              <option value="FOLLOW_LATEST_PLAN">يحصل المشتركون على الكورسات المضافة حديثاً</option>
              <option value="SNAPSHOT_ON_SUBSCRIBE">يحتفظ كل مشترك بمحتوى وقت الاشتراك فقط</option>
            </select>
          </Field>
        </div>

        <Field id="pl-desc" label="وصف الباقة" required>
          <textarea
            id="pl-desc"
            rows={2}
            className={inputClassName}
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            required
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <label className="flex items-center gap-2 rounded-xl border border-bosla-line p-2.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            باقة متاحة للاشتراك حالياً
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-bosla-line p-2.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            ظاهرة في صفحة الأسعار للجمهور
          </label>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto border border-[#22307A] rounded-xl p-3 text-sm bg-[#0B1440]">
          <div className="space-y-1.5">
            <p className="font-extrabold text-[#8CA2FF]">الكورسات المشمولة ({courseIds.length}):</p>
            {allCourses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseIds.includes(c.id)}
                  onChange={(e) =>
                    setCourseIds((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
                  }
                  className="h-4 w-4 accent-bosla-primary"
                />
                <span>{c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}</span>
              </label>
            ))}
          </div>

          {paths.length > 0 && (
            <div className="space-y-1.5 border-t border-[#22307A] pt-2.5">
              <p className="font-extrabold text-[#8CA2FF]">المسارات التعليمية المشمولة ({pathIds.length}):</p>
              {paths.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pathIds.includes(p.id)}
                    onChange={(e) =>
                      setPathIds((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                      )
                    }
                    className="h-4 w-4 accent-bosla-primary"
                  />
                  <span>{p.titleAr}</span>
                </label>
              ))}
            </div>
          )}

          {diplomas.length > 0 && (
            <div className="space-y-1.5 border-t border-[#22307A] pt-2.5">
              <p className="font-extrabold text-[#8CA2FF]">الدبلومات المشمولة ({diplomaIds.length}):</p>
              {diplomas.map((d) => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={diplomaIds.includes(d.id)}
                    onChange={(e) =>
                      setDiplomaIds((prev) =>
                        e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id),
                      )
                    }
                    className="h-4 w-4 accent-bosla-primary"
                  />
                  <span>{d.titleAr}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          <CreditCard className="h-4 w-4" />
          {submitting
            ? 'جاري الحفظ...'
            : plan
            ? 'حفظ التغييرات وإصدار نسخة خطة جديدة'
            : 'إنشاء باقة العضوية'}
        </Button>
      </form>
    </NativeModal>
  );
}

export function AdminCmsPageModal({
  page,
  onClose,
  onSaved,
}: {
  page: any | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [seoTitleAr, setSeoTitleAr] = useState('');
  const [seoDescriptionAr, setSeoDescriptionAr] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!page) return;
    setTitleAr(page.titleAr || '');
    setSeoTitleAr(page.seoTitleAr || '');
    setSeoDescriptionAr(page.seoDescriptionAr || '');
    setIsPublished(Boolean(page.isPublished ?? true));
  }, [page]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page) return;
    setSubmitting(true);
    try {
      await apiFetch(`/admin/cms/pages/${page.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          titleAr: titleAr.trim(),
          seoTitleAr: seoTitleAr.trim() || null,
          seoDescriptionAr: seoDescriptionAr.trim() || null,
          sections: page.sections ?? [],
          isPublished,
        }),
      });
      pushToast('تم تحديث بيانات الصفحة بنجاح', 'success');
      onClose();
      await onSaved();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ تعديلات الصفحة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModal
      open={Boolean(page)}
      onClose={onClose}
      title={page ? `تعديل الصفحة: ${page.titleAr}` : 'تعديل الصفحة'}
    >
      {page && (
        <form onSubmit={handleSave} className="space-y-4">
          <Field id="pg-title" label="عنوان الصفحة الرئيسي" required>
            <input
              id="pg-title"
              className={inputClassName}
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              required
            />
          </Field>
          <Field id="pg-seo-t" label="عنوان الظهور في محركات البحث">
            <input
              id="pg-seo-t"
              className={inputClassName}
              value={seoTitleAr}
              onChange={(e) => setSeoTitleAr(e.target.value)}
            />
          </Field>
          <Field id="pg-seo-d" label="وصف الصفحة التعريفي">
            <textarea
              id="pg-seo-d"
              rows={3}
              className={inputClassName}
              value={seoDescriptionAr}
              onChange={(e) => setSeoDescriptionAr(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold text-bosla-ink cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-bosla-primary"
            />
            نشر الصفحة وإظهارها للزوار
          </label>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            <FileEdit className="h-4 w-4" />
            {submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </form>
      )}
    </NativeModal>
  );
}
