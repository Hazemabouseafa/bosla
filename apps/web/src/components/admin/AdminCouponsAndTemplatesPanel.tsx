'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Plus, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { apiFetch, formatDate, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

interface AdminCouponsAndTemplatesPanelProps {
  courses: any[];
  paths: any[];
  diplomas: any[];
  plans: any[];
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
  const [savingTemplate, setSavingTemplate] = useState(false);

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

      {/* Certificate Templates & Accredited Program Governance (Section 5) */}
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
    </div>
  );
}
