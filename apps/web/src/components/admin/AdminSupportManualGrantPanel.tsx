'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { apiFetch, formatDateTime, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

export function AdminSupportManualGrantPanel({
  onGranted,
}: {
  onGranted?: () => Promise<void> | void;
} = {}) {
  const { user, pushToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [plans, setPlans] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [reasonAr, setReasonAr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(
    async (query = '') => {
      setLoading(true);
      setForbidden(false);
      try {
        const [meta, list] = await Promise.all([
          apiFetch<any>(`/support/membership-grants/meta${query ? `?q=${encodeURIComponent(query)}` : ''}`),
          apiFetch<any[]>('/support/membership-grants?limit=40'),
        ]);
        setPlans(Array.isArray(meta?.plans) ? meta.plans : []);
        setUsers(Array.isArray(meta?.users) ? meta.users : []);
        setGrants(Array.isArray(list) ? list : []);
        if (!selectedPlanId && meta?.plans?.[0]?.id) {
          setSelectedPlanId(meta.plans[0].id);
        }
      } catch (err: any) {
        if (err?.status === 403) {
          setForbidden(true);
        } else {
          pushToast(err?.message || 'تعذر تحميل بيانات منح العضوية اليدوي', 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [pushToast, selectedPlanId],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearchUsers = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData(userSearch);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedPlanId) {
      pushToast('اختر المتدرب وباقة العضوية أولاً', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/support/membership-grants', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId,
          planId: selectedPlanId,
          durationDays: Number(durationDays || 30),
          reasonAr: reasonAr.trim(),
        }),
      });
      pushToast('تم منح العضوية المؤقتة بنجاح وتوثيقها في سجل الدعم دون احتسابها ضمن الإيرادات', 'success');
      setReasonAr('');
      await loadData(userSearch);
      await onGranted?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر منح العضوية اليدوي', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (forbidden) {
    return (
      <AlertBanner tone="warning" title="صلاحية خاصة مطلوبة">
        تتطلب أداة منح العضوية اليدوي صلاحية <strong>membership.grant</strong> التي يحددها مدير النظام.
      </AlertBanner>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#77E2B5]" />
              منح عضوية يدوي مؤقت من فريق الدعم (Manual Membership Grant)
            </h2>
            <p className="text-xs text-[#A9B1E0] mt-1">
              يُمنح المتدرب وصولاً فعلياً لصلاحيات الباقة المختارة خلال المدة المحددة مع تسجيل الموظف المانح والسبب، ولا يُحتسب إطلاقاً ضمن الإيرادات المدفوعة.
            </p>
          </div>
          <Badge tone="info">صلاحية: {user?.role}</Badge>
        </div>

        <form onSubmit={handleSearchUsers} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Field label="بحث عن متدرب (بالاسم، البريد، أو رقم الموبايل)">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-[#A9B1E0]" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="ابحث ثم اضغط بحث..."
                  className={`${inputClassName} ps-9`}
                />
              </div>
            </Field>
          </div>
          <Button type="submit" variant="outline" size="sm">
            بحث
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadData(userSearch)}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </form>

        <form onSubmit={handleSubmit} className="space-y-4 border-t border-[#8CA2FF]/15 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="المتدرب المستهدف *" required>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={inputClassName}
                required
              >
                <option value="">-- اختر متدرباً --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.phoneE164 || u.email || u.id.slice(0, 6)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="باقة العضوية *" required>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className={inputClassName}
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} (سعر الباقة: {formatEgp(p.priceCents)} — يمنح مجاناً)
                  </option>
                ))}
              </select>
            </Field>

            <Field label="مدة التفعيل بالأيام *" required>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={1095}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className={inputClassName}
                  required
                />
                <div className="flex gap-1">
                  {[7, 30, 90].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDurationDays(String(preset))}
                      className="rounded-lg border border-[#8CA2FF]/25 bg-[#0F1A4A] px-2.5 text-xs font-bold text-[#EEF0FF] hover:border-[#8CA2FF] cursor-pointer"
                    >
                      {preset}د
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <Field label="سبب منح العضوية اليدوي (يُحفظ في سجل التدقيق) *" required>
            <textarea
              rows={2}
              value={reasonAr}
              onChange={(e) => setReasonAr(e.target.value)}
              placeholder="مثال: تعويض تفعيل باقة بعد مراجعة تذكرة الدعم رقم TKT-2026-..."
              className={textareaClassName}
              required
            />
          </Field>

          <Button type="submit" variant="success" size="sm" disabled={submitting || loading}>
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'جاري التفعيل...' : 'منح وتفعيل العضوية الآن (بدون احتساب مالي)'}
          </Button>
        </form>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-[#EEF0FF] flex items-center gap-2">
          <Award className="h-4 w-4 text-[#F5B94A]" />
          سجل العضويات الممنوحة من فريق الدعم ({grants.length})
        </h3>
        {grants.length === 0 ? (
          <p className="text-xs text-[#A9B1E0]">لم تُسجل أي منح عضوية يدوية حتى الآن.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#8CA2FF]/15">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#8CA2FF]/15">
                  <th className="p-2.5">المتدرب</th>
                  <th className="p-2.5">الباقة</th>
                  <th className="p-2.5">المدة والانتهاء</th>
                  <th className="p-2.5">المانح</th>
                  <th className="p-2.5">السبب الموثق</th>
                  <th className="p-2.5">الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id} className="border-t border-[#8CA2FF]/10">
                    <td className="p-2.5 font-semibold">{g.user?.fullName}</td>
                    <td className="p-2.5">{g.plan?.nameAr}</td>
                    <td className="p-2.5 text-[#A9B1E0]">
                      <div>{g.grantedDurationDays ?? '—'} يوم</div>
                      <div className="text-[11px]">ينتهي: {formatDateTime(g.currentPeriodEnd)}</div>
                    </td>
                    <td className="p-2.5 text-[#8CA2FF]">{g.grantedBy?.fullName || '—'}</td>
                    <td className="p-2.5">{g.grantReasonAr}</td>
                    <td className="p-2.5">
                      <Badge tone="neutral">منحة مجانية (0 ج.م)</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
