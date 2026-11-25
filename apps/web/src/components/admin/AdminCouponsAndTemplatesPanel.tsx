'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Plus, RefreshCw, ShieldCheck, Ticket, Upload } from 'lucide-react';
import { API_BASE_URL, apiFetch, ensureCsrfToken, formatDate, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

interface AdminCouponsAndTemplatesPanelProps {
  courses: any[];
  paths: any[];
  diplomas: any[];
  plans: any[];
  mode?: 'all' | 'coupons' | 'templates';
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  ALL: 'جميع المنتجات والعضويات',
  COURSE: 'كورس محدد',
  LEARNING_PATH: 'مسار تعليمي محدد',
  DIPLOMA: 'دبلومة محددة',
  MEMBERSHIP_PLAN: 'باقة عضوية محددة',
};

const CERT_KIND_LABELS: Record<string, string> = {
  ATTENDANCE_COMPLETION: 'شهادة إتمام وحضور (Completion)',
  COMPETENCY: 'شهادة تدريب مهني وكفاءة (Professional Training)',
  ACCREDITED_PROGRAM: 'شهادة برنامج معتمد (Accredited Program)',
};

export function AdminCouponsAndTemplatesPanel({
  courses,
  paths,
  diplomas,
  plans,
  mode = 'all',
}: AdminCouponsAndTemplatesPanelProps) {
  const { pushToast } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Coupon creation state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('20');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [applicableTargetType, setApplicableTargetType] = useState<
    'ALL' | 'COURSE' | 'LEARNING_PATH' | 'DIPLOMA' | 'MEMBERSHIP_PLAN'
  >('ALL');
  const [applicableTargetId, setApplicableTargetId] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [allowSellerStacking, setAllowSellerStacking] = useState(true);
  const [validTo, setValidTo] = useState('');
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Template / Accreditation configuration state
  const [tplNameAr, setTplNameAr] = useState('قالب شهادة البرنامج المعتمد الرسمي');
  const [tplKind, setTplKind] = useState<
    'ATTENDANCE_COMPLETION' | 'COMPETENCY' | 'ACCREDITED_PROGRAM'
  >('ACCREDITED_PROGRAM');
  const [tplIssuerNameAr, setTplIssuerNameAr] = useState('أكاديمية بوصلة للتدريب التطبيقي');
  const [tplIssuerTitleAr, setTplIssuerTitleAr] = useState('الإدارة الأكاديمية واعتماد البرامج');
  const [tplAccreditationEnabled, setTplAccreditationEnabled] = useState(false);
  const [tplAccreditingBodyNameAr, setTplAccreditingBodyNameAr] = useState('');
  const [tplAccreditingBodyCode, setTplAccreditingBodyCode] = useState('');
  const [tplAuthorizationRef, setTplAuthorizationRef] = useState('');
  const [tplIsDefault, setTplIsDefault] = useState(true);
  const [tplPrimaryColor, setTplPrimaryColor] = useState('#1536B5');
  const [tplAccentColor, setTplAccentColor] = useState('#4A1FB0');
  const [tplImageUrl, setTplImageUrl] = useState('');
  const [uploadingTplImage, setUploadingTplImage] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState({
    recipientName: { xPercent: 50, yPercent: 45, fontSizePx: 28, color: '#0A2A8A', visible: true, align: 'center' as const },
    programTitle: { xPercent: 50, yPercent: 57, fontSizePx: 18, color: '#1E293B', visible: true, align: 'center' as const },
    issueDate: { xPercent: 25, yPercent: 78, fontSizePx: 14, color: '#334155', visible: true, align: 'center' as const },
    verificationCode: { xPercent: 75, yPercent: 78, fontSizePx: 13, color: '#334155', visible: true, align: 'center' as const },
    instructorName: { xPercent: 50, yPercent: 78, fontSizePx: 15, color: '#1E293B', visible: true, align: 'center' as const },
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleUploadTemplateBg = async (file: File) => {
    setUploadingTplImage(true);
    try {
      const csrf = await ensureCsrfToken();
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        `${API_BASE_URL}/instructor/media/images?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
          body: formData,
        },
      );
      if (!res.ok) throw new Error('تعذر رفع صورة قالب الشهادة');
      const json = await res.json();
      const uploadedUrl = json?.data?.url ?? json?.url ?? '';
      if (!uploadedUrl) throw new Error('لم يرد رابط الصورة');
      setTplImageUrl(uploadedUrl);
      pushToast('تم رفع صورة قالب الشهادة الرسمية بنجاح', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع صورة القالب', 'error');
    } finally {
      setUploadingTplImage(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponsRes, templatesRes] = await Promise.all([
        apiFetch<any[]>('/commerce/admin/coupons').catch(() => []),
        apiFetch<any[]>('/lms/certificates/templates').catch(() => []),
      ]);
      setCoupons(Array.isArray(couponsRes) ? couponsRes : []);
      setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      pushToast('أدخل كود الكوبون أولاً.', 'error');
      return;
    }
    if (applicableTargetType !== 'ALL' && !applicableTargetId) {
      pushToast('اختر العنصر المستهدف للكوبون.', 'error');
      return;
    }

    setSavingCoupon(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: Number(minOrderAmount || 0),
        applicableTargetType,
        allowSellerStacking,
        perUserLimit: Number(perUserLimit || 1),
      };
      if (maxDiscountAmount.trim()) {
        payload.maxDiscountAmount = Number(maxDiscountAmount);
      }
      if (usageLimit.trim()) {
        payload.usageLimit = Number(usageLimit);
      }
      if (validTo) {
        payload.validTo = new Date(validTo).toISOString();
      }
      if (applicableTargetType === 'COURSE') {
        payload.applicableCourseId = applicableTargetId;
      } else if (applicableTargetType !== 'ALL') {
        payload.applicableTargetId = applicableTargetId;
      }

      await apiFetch('/commerce/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      pushToast('تم إنشاء كوبون الخصم بنجاح.', 'success');
      setCode('');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الكوبون.', 'error');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleToggleCoupon = async (coupon: any) => {
    try {
      await apiFetch(`/commerce/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      pushToast(coupon.isActive ? 'تم إيقاف الكوبون.' : 'تم تفعيل الكوبون.', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة الكوبون.', 'error');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      tplKind === 'ACCREDITED_PROGRAM' &&
      tplAccreditationEnabled &&
      (!tplAccreditingBodyNameAr.trim() || !tplAuthorizationRef.trim())
    ) {
      pushToast(
        'لتفعيل شهادة البرنامج المعتمد يجب إدخال اسم الجهة المعتمدة ورقم/مرجع الاعتماد الحقيقي.',
        'error',
      );
      return;
    }

    setSavingTemplate(true);
    try {
      await apiFetch('/lms/certificates/templates', {
        method: 'POST',
        body: JSON.stringify({
          key: `tpl-${tplKind.toLowerCase()}-default`,
          nameAr: tplNameAr.trim(),
          headlineAr: CERT_KIND_LABELS[tplKind] || tplNameAr.trim(),
          bodyTemplateAr:
            'تشهد أكاديمية بوصلة بأن المتدرب قد استوفى متطلبات البرنامج التدريبي والتقييم المعتمد بنجاح.',
          kind: tplKind,
          primaryColor: tplPrimaryColor,
          accentColor: tplAccentColor,
          templateImageUrl: tplImageUrl.trim() || null,
          layoutConfig,
          issuerNameAr: tplIssuerNameAr.trim(),
          signatureNameAr: tplIssuerTitleAr.trim(),
          accreditationEnabled: tplKind === 'ACCREDITED_PROGRAM' ? tplAccreditationEnabled : false,
          accreditingBodyNameAr:
            tplKind === 'ACCREDITED_PROGRAM' && tplAccreditingBodyNameAr.trim()
              ? tplAccreditingBodyNameAr.trim()
              : undefined,
          accreditingBodyCode:
            tplKind === 'ACCREDITED_PROGRAM' && tplAccreditingBodyCode.trim()
              ? tplAccreditingBodyCode.trim()
              : undefined,
          authorizationRef:
            tplKind === 'ACCREDITED_PROGRAM' && tplAuthorizationRef.trim()
              ? tplAuthorizationRef.trim()
              : undefined,
          isDefault: tplIsDefault,
        }),
      });
      pushToast('تم حفظ قالب الشهادة وإعدادات الاعتماد بنجاح.', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ قالب الشهادة.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const targetOptions =
    applicableTargetType === 'COURSE'
      ? courses.map((c) => ({ id: c.id, label: c.titleAr }))
      : applicableTargetType === 'LEARNING_PATH'
        ? paths.map((p) => ({ id: p.id, label: p.titleAr }))
        : applicableTargetType === 'DIPLOMA'
          ? diplomas.map((d) => ({ id: d.id, label: d.titleAr }))
          : applicableTargetType === 'MEMBERSHIP_PLAN'
            ? plans.map((pl) => ({ id: pl.id, label: pl.nameAr }))
            : [];

  return (
    <div className="space-y-6" data-testid="admin-coupons-templates-panel">
      {/* Discount Coupons Management (4.C) */}
      {(mode === 'all' || mode === 'coupons') && (
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-bosla-ink flex items-center gap-2">
              <Ticket className="h-5 w-5 text-bosla-gold" />
              إدارة كوبونات الخصم والعروض الترويجية ({coupons.length})
            </h2>
            <p className="text-xs text-bosla-muted mt-1">
              إنشاء وإدارة أكواد الخصم للكورسات الفردية، المسارات، الدبلومات، وباقات العضوية مع ضبط حدود الاستخدام وقواعد الدمج.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
        </div>

        <form
          onSubmit={handleCreateCoupon}
          className="grid gap-3 rounded-xl border border-bosla-line bg-bosla-surfaceAlt/40 p-4 md:grid-cols-4"
        >
          <Field label="كود الكوبون">
            <input
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BOSLA25"
              className={inputClassName}
              required
            />
          </Field>

          <Field label="نوع الخصم">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
              className={inputClassName}
            >
              <option value="PERCENT">نسبة مئوية (%)</option>
              <option value="FIXED">مبلغ ثابت (ج.م)</option>
            </select>
          </Field>

          <Field label={discountType === 'PERCENT' ? 'نسبة الخصم (%)' : 'قيمة الخصم (ج.م)'}>
            <input
              type="number"
              min={1}
              max={discountType === 'PERCENT' ? 100 : 100000}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="الحد الأقصى للخصم (ج.م - اختياري)">
            <input
              type="number"
              min={1}
              value={maxDiscountAmount}
              onChange={(e) => setMaxDiscountAmount(e.target.value)}
              placeholder="بدون سقف"
              className={inputClassName}
            />
          </Field>

          <Field label="نطاق تطبيق الكوبون">
            <select
              value={applicableTargetType}
              onChange={(e) => {
                setApplicableTargetType(e.target.value as any);
                setApplicableTargetId('');
              }}
              className={inputClassName}
            >
              <option value="ALL">جميع المنتجات والعضويات</option>
              <option value="COURSE">كورس محدد</option>
              <option value="LEARNING_PATH">مسار تعليمي محدد</option>
              <option value="DIPLOMA">دبلومة محددة</option>
              <option value="MEMBERSHIP_PLAN">باقة عضوية محددة</option>
            </select>
          </Field>

          {applicableTargetType !== 'ALL' && (
            <Field label="العنصر المستهدف">
              <select
                value={applicableTargetId}
                onChange={(e) => setApplicableTargetId(e.target.value)}
                className={inputClassName}
                required
              >
                <option value="">-- اختر العنصر --</option>
                {targetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="الحد الأدنى للطلب (ج.م)">
            <input
              type="number"
              min={0}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="إجمالي مرات الاستخدام (اختياري)">
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="غير محدود"
              className={inputClassName}
            />
          </Field>

          <Field label="حد الاستخدام لكل متعلم">
            <input
              type="number"
              min={1}
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="تاريخ انتهاء الصلاحية (اختياري)">
            <input
              type="datetime-local"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs font-bold text-bosla-ink cursor-pointer">
              <input
                type="checkbox"
                checked={allowSellerStacking}
                onChange={(e) => setAllowSellerStacking(e.target.checked)}
              />
              السماح بالدمج مع سعر العرض (Sale Price)
            </label>
          </div>

          <div className="flex items-end">
            <Button type="submit" variant="gold" size="sm" disabled={savingCoupon}>
              <Plus className="h-4 w-4" />
              {savingCoupon ? 'جاري الإنشاء...' : 'إنشاء الكوبون'}
            </Button>
          </div>
        </form>

        <div className="space-y-2 text-xs">
          {coupons.length === 0 ? (
            <p className="text-bosla-muted">لا توجد كوبونات خصم مسجلة حالياً.</p>
          ) : (
            coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code dir="ltr" className="font-extrabold text-sm text-bosla-ink">
                      {coupon.code}
                    </code>
                    <Badge tone={coupon.isActive ? 'success' : 'danger'}>
                      {coupon.isActive ? 'نشط' : 'موقوف'}
                    </Badge>
                    <Badge tone="purple">
                      {coupon.discountType === 'PERCENT'
                        ? `خصم ${Number(coupon.discountValue)}%`
                        : `خصم ${formatEgp(Number(coupon.discountValue))}`}
                    </Badge>
                    <Badge tone="neutral">
                      {TARGET_TYPE_LABELS[coupon.applicableTargetType || 'ALL'] ||
                        coupon.applicableTargetType}
                    </Badge>
                  </div>
                  <p className="text-bosla-muted">
                    الاستخدام: {coupon.usedCount} / {coupon.usageLimit ?? '∞'} • لكل متعلم:{' '}
                    {coupon.perUserLimit ?? 1} • الدمج مع العروض:{' '}
                    {coupon.allowSellerStacking ? 'مسموح' : 'غير مسموح'}
                    {coupon.validTo ? ` • ينتهي: ${formatDate(coupon.validTo)}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleToggleCoupon(coupon)}
                >
                  {coupon.isActive ? 'إيقاف الكوبون' : 'تفعيل الكوبون'}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
      )}

      {/* Certificate Templates & Accredited Program Governance (Section 5) */}
      {(mode === 'all' || mode === 'templates') && (
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-extrabold text-bosla-ink flex items-center gap-2">
            <Award className="h-5 w-5 text-bosla-gold" />
            قوالب الشهادات الثلاث وحوكمة البرامج المعتمدة ({templates.length})
          </h2>
          <p className="text-xs text-bosla-muted mt-1">
            تدعم المنصة 3 أنواع من الشهادات: شهادة إتمام وحضور، شهادة تدريب مهني وكفاءة، وشهادة برنامج معتمد.
            يُحظر إصدار شهادة برنامج معتمد إلا عند تفعيل الاعتماد وإدخال اسم الجهة المانحة ورقم التفويض الرسمي الحقيقي.
          </p>
        </div>

        <form
          onSubmit={handleCreateTemplate}
          className="grid gap-3 rounded-xl border border-bosla-line bg-bosla-surfaceAlt/40 p-4 md:grid-cols-3"
        >
          <Field label="اسم القالب (عربي)">
            <input
              value={tplNameAr}
              onChange={(e) => setTplNameAr(e.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="نوع الشهادة">
            <select
              value={tplKind}
              onChange={(e) => setTplKind(e.target.value as any)}
              className={inputClassName}
            >
              <option value="ATTENDANCE_COMPLETION">
                شهادة إتمام وحضور (Completion Certificate)
              </option>
              <option value="COMPETENCY">
                شهادة تدريب مهني وكفاءة (Professional Training)
              </option>
              <option value="ACCREDITED_PROGRAM">
                شهادة برنامج معتمد (Accredited Program)
              </option>
            </select>
          </Field>

          <Field label="الجهة المُصدِرة (عربي)">
            <input
              value={tplIssuerNameAr}
              onChange={(e) => setTplIssuerNameAr(e.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          <Field label="المسمى الوظيفي للمُوقِّع">
            <input
              value={tplIssuerTitleAr}
              onChange={(e) => setTplIssuerTitleAr(e.target.value)}
              className={inputClassName}
              required
            />
          </Field>

          {tplKind === 'ACCREDITED_PROGRAM' && (
            <>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-bold text-bosla-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplAccreditationEnabled}
                    onChange={(e) => setTplAccreditationEnabled(e.target.checked)}
                  />
                  تفعيل إصدار هذا البرنامج المعتمد رسمياً
                </label>
              </div>

              <Field label="اسم الجهة المعتمدة الرسمية (إلزامي عند التفعيل)">
                <input
                  value={tplAccreditingBodyNameAr}
                  onChange={(e) => setTplAccreditingBodyNameAr(e.target.value)}
                  placeholder="مثال: النقابة العامة للأطباء البيطريين / جهة الاعتماد"
                  className={inputClassName}
                />
              </Field>

              <Field label="كود الجهة المعتمدة (اختياري)">
                <input
                  dir="ltr"
                  value={tplAccreditingBodyCode}
                  onChange={(e) => setTplAccreditingBodyCode(e.target.value)}
                  placeholder="ACC-BODY-CODE"
                  className={inputClassName}
                />
              </Field>

              <Field label="رقم/مرجع التفويض والاعتماد الرسمي (إلزامي عند التفعيل)">
                <input
                  dir="ltr"
                  value={tplAuthorizationRef}
                  onChange={(e) => setTplAuthorizationRef(e.target.value)}
                  placeholder="AUTH-REF-2026"
                  className={inputClassName}
                />
              </Field>
            </>
          )}

          <Field label="اللون الأساسي والتمييزي">
            <div className="flex items-center gap-2">
              <input type="color" value={tplPrimaryColor} onChange={(e) => setTplPrimaryColor(e.target.value)} className="h-10 w-12 rounded-lg border border-bosla-line bg-transparent p-1 cursor-pointer" />
              <input type="color" value={tplAccentColor} onChange={(e) => setTplAccentColor(e.target.value)} className="h-10 w-12 rounded-lg border border-bosla-line bg-transparent p-1 cursor-pointer" />
            </div>
          </Field>

          <Field label="صورة القالب الرسمية (PNG/JPG/WEBP)">
            <div className="flex flex-wrap items-center gap-2">
              <input
                dir="ltr"
                value={tplImageUrl}
                onChange={(e) => setTplImageUrl(e.target.value)}
                placeholder="/api/v1/media/images/..."
                className={`${inputClassName} flex-1`}
              />
              <label className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#8CA2FF]/30 bg-[#0B1440] px-3 text-xs font-bold text-[#EEF0FF] hover:border-[#8CA2FF] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                {uploadingTplImage ? 'جاري الرفع...' : 'رفع صورة'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadTemplateBg(f);
                  }}
                />
              </label>
            </div>
          </Field>

          <div className="md:col-span-3 rounded-xl border border-[#8CA2FF]/20 bg-[#070D2B]/70 p-4 space-y-3">
            <p className="text-xs font-bold text-[#EEF0FF]">مواضع الحقول ودرجة الخط (X% / Y% / Size)</p>
            <div className="grid gap-3 md:grid-cols-5 text-xs">
              {(
                [
                  ['recipientName', 'اسم المتدرب'],
                  ['programTitle', 'اسم الكورس / المسار'],
                  ['issueDate', 'تاريخ الإصدار'],
                  ['verificationCode', 'كود التحقق'],
                  ['instructorName', 'اسم المدرب / التوقيع'],
                ] as const
              ).map(([fieldKey, label]) => {
                const cfg = layoutConfig[fieldKey];
                return (
                  <div key={fieldKey} className="rounded-lg border border-[#8CA2FF]/15 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 font-bold text-[#EEF0FF]">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={cfg.visible}
                        onChange={(e) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            [fieldKey]: { ...prev[fieldKey], visible: e.target.checked },
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        title="X%"
                        value={cfg.xPercent}
                        onChange={(e) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            [fieldKey]: { ...prev[fieldKey], xPercent: Number(e.target.value || 0) },
                          }))
                        }
                        className="rounded border border-[#8CA2FF]/20 bg-[#050A24] px-1.5 py-1 text-[11px]"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        title="Y%"
                        value={cfg.yPercent}
                        onChange={(e) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            [fieldKey]: { ...prev[fieldKey], yPercent: Number(e.target.value || 0) },
                          }))
                        }
                        className="rounded border border-[#8CA2FF]/20 bg-[#050A24] px-1.5 py-1 text-[11px]"
                      />
                      <input
                        type="number"
                        min={10}
                        max={64}
                        title="px"
                        value={cfg.fontSizePx}
                        onChange={(e) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            [fieldKey]: { ...prev[fieldKey], fontSizePx: Number(e.target.value || 14) },
                          }))
                        }
                        className="rounded border border-[#8CA2FF]/20 bg-[#050A24] px-1.5 py-1 text-[11px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Preview Canvas */}
            <div
              className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#8CA2FF]/30 bg-white text-[#0F172A] shadow-lg"
              style={{ aspectRatio: '1.414 / 1' }}
            >
              {tplImageUrl ? (
                <img src={tplImageUrl} alt="قالب الشهادة" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="h-full w-full p-6 flex flex-col justify-between"
                  style={{
                    border: `8px solid ${tplPrimaryColor}`,
                    background: `linear-gradient(135deg, #ffffff 0%, #f4f7fc 100%)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold" style={{ color: tplPrimaryColor }}>أكاديمية بوصلة</span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      معاينة استرشادية (ارفع الصورة الرسمية النهائية)
                    </span>
                  </div>
                </div>
              )}

              {layoutConfig.recipientName.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${layoutConfig.recipientName.xPercent}%`,
                    top: `${layoutConfig.recipientName.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${Math.max(12, Math.round(layoutConfig.recipientName.fontSizePx * 0.72))}px`,
                    color: layoutConfig.recipientName.color,
                    fontWeight: 800,
                  }}
                >
                  د. أحمد محمد العتيبي
                </div>
              )}
              {layoutConfig.programTitle.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${layoutConfig.programTitle.xPercent}%`,
                    top: `${layoutConfig.programTitle.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${Math.max(10, Math.round(layoutConfig.programTitle.fontSizePx * 0.72))}px`,
                    color: layoutConfig.programTitle.color,
                    fontWeight: 700,
                  }}
                >
                  {CERT_KIND_LABELS[tplKind] || tplNameAr}
                </div>
              )}
              {layoutConfig.issueDate.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${layoutConfig.issueDate.xPercent}%`,
                    top: `${layoutConfig.issueDate.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${Math.max(9, Math.round(layoutConfig.issueDate.fontSizePx * 0.72))}px`,
                    color: layoutConfig.issueDate.color,
                    fontWeight: 600,
                  }}
                >
                  2026-11-25
                </div>
              )}
              {layoutConfig.instructorName.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${layoutConfig.instructorName.xPercent}%`,
                    top: `${layoutConfig.instructorName.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${Math.max(9, Math.round(layoutConfig.instructorName.fontSizePx * 0.72))}px`,
                    color: layoutConfig.instructorName.color,
                    fontWeight: 600,
                  }}
                >
                  {tplIssuerTitleAr}
                </div>
              )}
              {layoutConfig.verificationCode.visible && (
                <div
                  dir="ltr"
                  style={{
                    position: 'absolute',
                    left: `${layoutConfig.verificationCode.xPercent}%`,
                    top: `${layoutConfig.verificationCode.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${Math.max(9, Math.round(layoutConfig.verificationCode.fontSizePx * 0.72))}px`,
                    color: layoutConfig.verificationCode.color,
                    fontWeight: 700,
                  }}
                >
                  BOSLA-2026-PREVIEW
                </div>
              )}
            </div>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs font-bold text-bosla-ink cursor-pointer">
              <input
                type="checkbox"
                checked={tplIsDefault}
                onChange={(e) => setTplIsDefault(e.target.checked)}
              />
              تعيين كقالب افتراضي لهذا النوع
            </label>
          </div>

          <div className="flex items-end">
            <Button type="submit" variant="gold" size="sm" disabled={savingTemplate}>
              <ShieldCheck className="h-4 w-4" />
              {savingTemplate ? 'جاري الحفظ...' : 'حفظ قالب الشهادة'}
            </Button>
          </div>
        </form>

        <div className="space-y-2 text-xs">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-bosla-ink">{tpl.nameAr}</span>
                  <Badge
                    tone={
                      tpl.kind === 'ACCREDITED_PROGRAM'
                        ? 'success'
                        : tpl.kind === 'COMPETENCY'
                          ? 'purple'
                          : 'neutral'
                    }
                  >
                    {CERT_KIND_LABELS[tpl.kind] || tpl.kind}
                  </Badge>
                  {tpl.isDefault && <Badge tone="success">افتراضي</Badge>}
                  {tpl.kind === 'ACCREDITED_PROGRAM' && (
                    <Badge tone={tpl.accreditationEnabled ? 'success' : 'warning'}>
                      {tpl.accreditationEnabled ? 'الاعتماد مفعّل' : 'الاعتماد معطّل افتراضياً'}
                    </Badge>
                  )}
                </div>
                <p className="text-bosla-muted">
                  الجهة المصدرة: {tpl.issuerNameAr} ({tpl.issuerTitleAr})
                  {tpl.accreditingBodyNameAr
                    ? ` • جهة الاعتماد: ${tpl.accreditingBodyNameAr} (${tpl.authorizationRef || 'بدون مرجع'})`
                    : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}
    </div>
  );
}
