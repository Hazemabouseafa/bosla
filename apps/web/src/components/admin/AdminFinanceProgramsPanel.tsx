'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  History,
  Percent,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { apiFetch, formatDateTime, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
} from '@/components/ui/primitives';

interface AssignmentDraft {
  instructorId: string;
  roleTitleAr: string;
  revenueSharePercent: number;
  isPrimary: boolean;
}

export function AdminFinanceProgramsPanel({
  courses,
  paths,
  diplomas,
  users,
  onReload,
}: {
  courses: any[];
  paths: any[];
  diplomas: any[];
  users: any[];
  onReload: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [subTab, setSubTab] = useState<
    'programs_shares' | 'instructor_statements' | 'payment_records' | 'competency' | 'audit'
  >('programs_shares');
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState<any | null>(null);
  const [competencyRequests, setCompetencyRequests] = useState<any[]>([]);

  // Program multi-instructor & percentage editor
  const [targetType, setTargetType] = useState<'COURSE' | 'LEARNING_PATH' | 'DIPLOMA'>('COURSE');
  const [targetId, setTargetId] = useState('');
  const [assignmentRows, setAssignmentRows] = useState<AssignmentDraft[]>([]);
  const [savingShares, setSavingShares] = useState(false);

  // Payout form state
  const [payoutInstructorId, setPayoutInstructorId] = useState('');
  const [payoutAmountEgp, setPayoutAmountEgp] = useState('500');
  const [payoutMethod, setPayoutMethod] = useState('تحويل بنكي');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  const instructors = users.filter((u) => u.role === 'INSTRUCTOR' || u.role === 'ADMIN');

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const [fin, comp] = await Promise.all([
        apiFetch<any>('/admin/finance/overview'),
        apiFetch<any[]>('/admin/competency-requests'),
      ]);
      setFinanceData(fin);
      setCompetencyRequests(Array.isArray(comp) ? comp : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل البيانات المالية وطلبات الكفاءة', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const currentTargets =
    targetType === 'COURSE' ? courses : targetType === 'LEARNING_PATH' ? paths : diplomas;

  useEffect(() => {
    if (!targetId && currentTargets.length > 0) {
      setTargetId(currentTargets[0].id);
    }
  }, [targetType, targetId, currentTargets]);

  useEffect(() => {
    if (!targetId) return;
    const matched = currentTargets.find((t) => t.id === targetId);
    const existing = matched?.instructorAssignments ?? [];
    if (existing.length > 0) {
      setAssignmentRows(
        existing.map((a: any) => ({
          instructorId: a.instructorId,
          roleTitleAr: a.roleTitleAr || 'مدرب مشارك',
          revenueSharePercent: Number(a.revenueSharePercent ?? 0),
          isPrimary: Boolean(a.isPrimary),
        })),
      );
    } else if (targetType === 'COURSE' && matched?.instructorId) {
      setAssignmentRows([
        {
          instructorId: matched.instructorId,
          roleTitleAr: 'مدرب رئيسي',
          revenueSharePercent: 35,
          isPrimary: true,
        },
      ]);
    } else if (instructors[0]) {
      setAssignmentRows([
        {
          instructorId: instructors[0].id,
          roleTitleAr: 'مدرب رئيسي',
          revenueSharePercent: 30,
          isPrimary: true,
        },
      ]);
    } else {
      setAssignmentRows([]);
    }
  }, [targetType, targetId, courses, paths, diplomas]);

  const totalSharePercent = assignmentRows.reduce(
    (s, r) => s + (Number(r.revenueSharePercent) || 0),
    0,
  );

  const handleSaveProgramInstructors = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    if (totalSharePercent > 100) {
      pushToast('مجموع نسب المدربين لا يمكن أن يتجاوز 100%', 'error');
      return;
    }
    setSavingShares(true);
    try {
      await apiFetch(`/admin/programs/${targetType}/${targetId}/instructors`, {
        method: 'PUT',
        body: JSON.stringify({ assignments: assignmentRows }),
      });
      pushToast('تم حفظ توزيع المدربين والنسب المئوية وتسجيله في السجل الإداري', 'success');
      await Promise.all([loadFinance(), Promise.resolve(onReload())]);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ نسب المدربين', 'error');
    } finally {
      setSavingShares(false);
    }
  };

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutInstructorId) return;
    const cents = Math.round((Number(payoutAmountEgp) || 0) * 100);
    if (cents <= 0) {
      pushToast('أدخل مبلغاً أكبر من صفر', 'error');
      return;
    }
    setSavingPayout(true);
    try {
      await apiFetch(`/admin/finance/instructors/${payoutInstructorId}/payout`, {
        method: 'POST',
        body: JSON.stringify({
          amountCents: cents,
          paymentMethodAr: payoutMethod.trim() || 'تحويل بنكي',
          notesAr: payoutNotes.trim() || undefined,
        }),
      });
      pushToast('تم تسجيل صرف مستحقات المدرب وتحديث كشف حسابه المستقل', 'success');
      setPayoutNotes('');
      await loadFinance();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تسجيل الدفعة المالية', 'error');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleReviewCompetency = async (requestId: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await apiFetch(`/admin/competency-requests/${requestId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reviewNotesAr:
            decision === 'APPROVE'
              ? 'تم اعتماد شهادة الكفاءة المهنية من إدارة الأكاديمية'
              : 'يرجى استكمال المتطلبات العملية وإعادة التقديم',
        }),
      });
      pushToast(
        decision === 'APPROVE'
          ? 'تم اعتماد وإصدار شهادة الكفاءة المهنية بنجاح'
          : 'تم تسجيل رفض الطلب مع ملاحظة المراجعة',
        'success',
      );
      await loadFinance();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ المراجعة', 'error');
    }
  };

  const programAccounts: any[] = financeData?.programAccounts ?? [];
  const instructorAccounts: any[] = financeData?.instructorAccounts ?? [];
  const paymentRecords: any[] = financeData?.paymentRecords ?? [];
  const auditLogs: any[] = financeData?.financialAuditLogs ?? [];

  const totalProgramRevenueCents = programAccounts.reduce(
    (s, a) => s + Number(a.totalGrossRevenueCents || 0),
    0,
  );
  const totalInstructorsPendingCents = instructorAccounts.reduce(
    (s, a) => s + Number(a.pendingBalanceCents || 0),
    0,
  );
  const pendingCompetencyCount = competencyRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#8CA2FF]" />
            الإدارة المالية وتوزيع المدربين وشهادات الكفاءة
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B1E0] mt-0.5">
            إدارة اشتراك أكثر من مدرب في كل برنامج بنسبة مئوية محددة، متابعة الحساب المستقل لكل برنامج ولكل مدرب، وسجل الدفعات المنفصلة.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadFinance()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث السجل المالي
        </Button>
      </div>

      {/* Top Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 tabular-nums">
          <p className="text-xs font-bold text-[#A9B1E0]">حسابات البرامج المستقلة</p>
          <p className="mt-1.5 text-2xl font-bold text-[#8CA2FF]">{programAccounts.length}</p>
          <p className="text-xs text-[#77E2B5] mt-1">
            إجمالي الإيرادات: {formatEgp(totalProgramRevenueCents)}
          </p>
        </Card>
        <Card className="p-4 tabular-nums">
          <p className="text-xs font-bold text-[#A9B1E0]">حسابات المدربين المستقلة</p>
          <p className="mt-1.5 text-2xl font-bold text-[#EEF0FF]">{instructorAccounts.length}</p>
          <p className="text-xs text-[#F5B94A] mt-1">
            رصيد معلق للمدربين: {formatEgp(totalInstructorsPendingCents)}
          </p>
        </Card>
        <Card className="p-4 tabular-nums">
          <p className="text-xs font-bold text-[#A9B1E0]">سجلات الدفعات المنفصلة</p>
          <p className="mt-1.5 text-2xl font-bold text-[#77E2B5]">{paymentRecords.length}</p>
          <p className="text-xs text-[#A9B1E0] mt-1">دفعة موثقة مستقلة</p>
        </Card>
        <Card className="p-4 tabular-nums">
          <p className="text-xs font-bold text-[#A9B1E0]">طلبات شهادة الكفاءة</p>
          <p className="mt-1.5 text-2xl font-bold text-[#F5B94A]">{competencyRequests.length}</p>
          <p className="text-xs text-[#A9B1E0] mt-1">قيد الانتظار: {pendingCompetencyCount}</p>
        </Card>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#8CA2FF]/16 pb-3">
        {(
          [
            { id: 'programs_shares', label: 'المدربون والنسب + حساب كل برنامج', icon: <Percent className="h-4 w-4" /> },
            { id: 'instructor_statements', label: 'كشوف حسابات المدربين وصرف المستحقات', icon: <FileSpreadsheet className="h-4 w-4" /> },
            { id: 'payment_records', label: 'سجل الدفعات المالية المنفصلة', icon: <DollarSign className="h-4 w-4" /> },
            { id: 'competency', label: `طلبات شهادات الكفاءة (${pendingCompetencyCount})`, icon: <Award className="h-4 w-4" /> },
            { id: 'audit', label: 'سجل التغييرات الإدارية والمالية', icon: <History className="h-4 w-4" /> },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id)}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
              subTab === item.id
                ? 'border-[#7C95FF]/55 bg-[#121F5E] text-[#EEF0FF]'
                : 'border-[#8CA2FF]/18 bg-[#09123A] text-[#A9B1E0] hover:border-[#8CA2FF]/35 hover:text-[#EEF0FF]'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: MULTI-INSTRUCTOR + % SHARES + PROGRAM FINANCIAL ACCOUNTS */}
      {subTab === 'programs_shares' && (
        <div className="grid gap-6 xl:grid-cols-12 items-start">
          {/* Multi-instructor Percentage Assignment Form */}
          <Card className="p-6 space-y-4 xl:col-span-6">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#8CA2FF]" />
              تعيين المدربين ونسبة كل مدرب في الدورة / البرنامج
            </h3>
            <p className="text-xs text-[#A9B1E0]">
              يمكن للمدرب تقديم عدة برامج، ويمكن للبرنامج أن يشترك فيه أكثر من مدرب مع تحديد النسبة المئوية لكل مدرب.
            </p>

            <form onSubmit={handleSaveProgramInstructors} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="fin-target-type" label="نوع البرنامج">
                  <select
                    id="fin-target-type"
                    className={inputClassName}
                    value={targetType}
                    onChange={(e) => {
                      setTargetType(e.target.value as any);
                      setTargetId('');
                    }}
                  >
                    <option value="COURSE">دورة / كورس تدريبي</option>
                    <option value="LEARNING_PATH">مسار تعليمي</option>
                    <option value="DIPLOMA">دبلومة تطبيقية</option>
                  </select>
                </Field>
                <Field id="fin-target-id" label="اختر البرنامج">
                  <select
                    id="fin-target-id"
                    className={inputClassName}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    {currentTargets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.publishedVersion?.titleAr || item.draftVersion?.titleAr || item.titleAr || item.slug}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-[#EEF0FF]">المدربون المشاركون في البرنامج:</span>
                  <span className={totalSharePercent > 100 ? 'text-[#FF9CAA]' : 'text-[#77E2B5]'}>
                    إجمالي نسب المدربين: {totalSharePercent}% (الأكاديمية: {Math.max(0, 100 - totalSharePercent)}%)
                  </span>
                </div>

                {assignmentRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="space-y-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className={inputClassName}
                        aria-label="المدرب"
                        value={row.instructorId}
                        onChange={(e) =>
                          setAssignmentRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, instructorId: e.target.value } : r)),
                          )
                        }
                      >
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.fullName}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClassName}
                        placeholder="الدور (مدرب مشارك)"
                        value={row.roleTitleAr}
                        onChange={(e) =>
                          setAssignmentRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, roleTitleAr: e.target.value } : r)),
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#A9B1E0]">النسبة %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          dir="ltr"
                          aria-label="النسبة المئوية"
                          className={`${inputClassName} !w-24 text-center`}
                          value={row.revenueSharePercent}
                          onChange={(e) =>
                            setAssignmentRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, revenueSharePercent: Number(e.target.value) } : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 font-bold text-[#EEF0FF] cursor-pointer" title="رئيسي">
                          <input
                            type="checkbox"
                            checked={row.isPrimary}
                            onChange={(e) =>
                              setAssignmentRows((prev) =>
                                prev.map((r, i) => ({
                                  ...r,
                                  isPrimary: i === idx ? e.target.checked : r.isPrimary,
                                })),
                              )
                            }
                          />
                          <span>رئيسي</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setAssignmentRows((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="حذف المدرب"
                          className="p-2 text-[#FF9CAA] hover:bg-[#18266E] rounded-lg cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (instructors[0]) {
                      const nextInstructor =
                        instructors.find((inst) => !assignmentRows.some((r) => r.instructorId === inst.id)) ||
                        instructors[0];
                      setAssignmentRows((prev) => [
                        ...prev,
                        {
                          instructorId: nextInstructor.id,
                          roleTitleAr: 'مدرب مشارك',
                          revenueSharePercent: 15,
                          isPrimary: prev.length === 0,
                        },
                      ]);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  إضافة مدرب آخر للبرنامج
                </Button>
              </div>

              <Button
                id="save-program-instructors-btn"
                type="submit"
                variant="primary"
                className="w-full"
                disabled={savingShares}
              >
                {savingShares ? 'جاري الحفظ...' : 'اعتماد توزيع المدربين والنسب المئوية'}
              </Button>
            </form>
          </Card>

          {/* Independent Program Financial Accounts */}
          <Card className="p-6 space-y-4 xl:col-span-6">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#77E2B5]" />
              الحساب المالي المستقل لكل برنامج ({programAccounts.length})
            </h3>
            <div className="space-y-3 max-h-[540px] overflow-y-auto pe-1">
              {programAccounts.map((acc) => {
                const title =
                  acc.course?.publishedVersion?.titleAr ||
                  acc.course?.draftVersion?.titleAr ||
                  acc.learningPath?.titleAr ||
                  acc.diploma?.titleAr ||
                  acc.accountCode;
                const priceCents =
                  acc.course?.priceCents ??
                  acc.learningPath?.priceCents ??
                  acc.diploma?.priceCents ??
                  0;
                const included =
                  acc.course?.includedInMembership ??
                  acc.learningPath?.includedInMembership ??
                  acc.diploma?.includedInMembership ??
                  true;
                return (
                  <div
                    key={acc.id}
                    className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold text-[#EEF0FF]">{title}</p>
                        <p dir="ltr" className="font-mono text-[11px] text-[#8CA2FF]">
                          {acc.accountCode}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={included ? 'info' : 'warning'}>
                          {included ? 'شامل بالعضوية' : 'مستثنى — بيع مستقل فقط'}
                        </Badge>
                        <Badge tone="neutral">{formatEgp(priceCents)}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#22307A]/70 bg-[#0F1A4A] p-2.5 text-center">
                      <div>
                        <p className="text-[11px] text-[#A9B1E0]">إجمالي المبيعات</p>
                        <p className="font-extrabold text-[#EEF0FF]">
                          {formatEgp(acc.totalGrossRevenueCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#A9B1E0]">حصص المدربين</p>
                        <p className="font-extrabold text-[#F5B94A]">
                          {formatEgp(acc.totalInstructorShareCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#A9B1E0]">صافي حساب البرنامج</p>
                        <p className="font-extrabold text-[#77E2B5]">
                          {formatEgp(acc.netBalanceCents)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB 2: INSTRUCTOR STATEMENTS & PAYOUT */}
      {subTab === 'instructor_statements' && (
        <div className="grid gap-6 xl:grid-cols-12 items-start">
          <Card className="p-6 space-y-4 xl:col-span-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">صرف دفعة من مستحقات مدرب</h3>
            <form onSubmit={handleRecordPayout} className="space-y-3">
              <Field id="po-inst" label="اختر المدرب">
                <select
                  id="po-inst"
                  className={inputClassName}
                  value={payoutInstructorId}
                  onChange={(e) => setPayoutInstructorId(e.target.value)}
                  required
                >
                  <option value="">— اختر مدرباً —</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="po-amt" label="المبلغ بالجنيه المصري (ج.م)" required>
                <input
                  id="po-amt"
                  type="number"
                  min={1}
                  dir="ltr"
                  className={inputClassName}
                  value={payoutAmountEgp}
                  onChange={(e) => setPayoutAmountEgp(e.target.value)}
                  required
                />
              </Field>
              <Field id="po-method" label="وسيلة الصرف">
                <input
                  id="po-method"
                  className={inputClassName}
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                />
              </Field>
              <Field id="po-notes" label="ملاحظات القيد المالي">
                <input
                  id="po-notes"
                  className={inputClassName}
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="مثال: تسوية عوائد الربع الحالي"
                />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={savingPayout}>
                {savingPayout ? 'جاري التسجيل...' : 'تسجيل دفعة الصرف في كشف المدرب'}
              </Button>
            </form>
          </Card>

          <Card className="p-6 space-y-4 xl:col-span-8">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">
              كشوف الحسابات المستقلة لجميع المدربين ({instructorAccounts.length})
            </h3>
            <div className="space-y-4 max-h-[560px] overflow-y-auto pe-1">
              {instructorAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-[#EEF0FF]">
                        {acc.instructor?.fullName}
                      </p>
                      <p dir="ltr" className="font-mono text-[#8CA2FF]">
                        {acc.accountCode} • {acc.instructor?.phoneE164}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="success">مكتسب: {formatEgp(acc.totalEarnedCents)}</Badge>
                      <Badge tone="info">منصرف: {formatEgp(acc.totalPaidOutCents)}</Badge>
                      <Badge tone="warning">معلق: {formatEgp(acc.pendingBalanceCents)}</Badge>
                    </div>
                  </div>
                  {acc.entries?.length > 0 && (
                    <div className="space-y-1.5 border-t border-[#22307A] pt-2.5">
                      {acc.entries.slice(0, 5).map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between text-[#A9B1E0]">
                          <span className="truncate max-w-[70%]">{e.descriptionAr}</span>
                          <strong className={e.netAmountCents >= 0 ? 'text-[#77E2B5]' : 'text-[#F5B94A]'}>
                            {e.netAmountCents >= 0 ? '+' : ''}
                            {formatEgp(e.netAmountCents)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB 3: SEPARATE FINANCIAL PAYMENT RECORDS */}
      {subTab === 'payment_records' && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF]">
            سجل الدفعات المالية المنفصلة ({paymentRecords.length})
          </h3>
          {paymentRecords.length === 0 ? (
            <AlertBanner tone="info">
              لا توجد دفعات برامج مستقلة مسجلة حتى الآن. ستظهر هنا كل دفعة شراء برنامج أو صرف مدرب بسجل منفصل.
            </AlertBanner>
          ) : (
            <div className="space-y-2.5">
              {paymentRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code dir="ltr" className="font-mono font-extrabold text-[#8CA2FF]">
                        {rec.referenceCode}
                      </code>
                      <Badge tone={rec.direction === 'OUTBOUND' ? 'warning' : 'success'}>
                        {rec.direction === 'OUTBOUND' ? 'صرف لمدرب' : 'تحصيل برنامج'}
                      </Badge>
                    </div>
                    <p className="font-bold text-[#EEF0FF]">
                      {rec.programTitleSnapshot || rec.notesAr || rec.paymentMethodAr}
                    </p>
                    <p className="text-[#A9B1E0]">
                      {rec.payer ? `الدافع: ${rec.payer.fullName}` : ''}
                      {rec.payeeInstructor ? `المستفيد: ${rec.payeeInstructor.fullName}` : ''}
                      {' • '}
                      {formatDateTime(rec.createdAt)}
                    </p>
                  </div>
                  <div className="text-end space-y-1">
                    <p className="text-sm font-extrabold text-[#EEF0FF]">
                      {formatEgp(rec.grossAmountCents)}
                    </p>
                    {rec.direction === 'INBOUND' && (
                      <p className="text-[#A9B1E0]">
                        حصة المدربين: {formatEgp(rec.instructorShareCents)} • المنصة:{' '}
                        {formatEgp(rec.platformShareCents)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SUBTAB 4: COMPETENCY CERTIFICATE REQUESTS */}
      {subTab === 'competency' && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF]">
            طلبات شهادات الكفاءة المهنية ({competencyRequests.length})
          </h3>
          {competencyRequests.length === 0 ? (
            <AlertBanner tone="info">
              لا توجد طلبات شهادة كفاءة حالياً. عند إنهاء المتدرب للدورة بنسبة 100% وتقديم الطلب سيظهر هنا ولدى المدرب المعيّن.
            </AlertBanner>
          ) : (
            <div className="space-y-3">
              {competencyRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-xs"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[#EEF0FF]">{req.user?.fullName}</strong>
                      <Badge
                        tone={
                          req.status === 'APPROVED'
                            ? 'success'
                            : req.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {req.status === 'APPROVED'
                          ? 'معتمدة'
                          : req.status === 'REJECTED'
                            ? 'مُعادة بملاحظات'
                            : 'قيد المراجعة'}
                      </Badge>
                    </div>
                    <p className="font-bold text-[#8CA2FF]">
                      {req.course?.publishedVersion?.titleAr ||
                        req.learningPath?.titleAr ||
                        req.diploma?.titleAr ||
                        'برنامج'}
                    </p>
                    {req.studentNotesAr && (
                      <p className="text-[#A9B1E0]">ملاحظة الطالب: {req.studentNotesAr}</p>
                    )}
                    {req.certificate?.certificateCode && (
                      <p dir="ltr" className="font-mono text-[#77E2B5]">
                        {req.certificate.certificateCode}
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        id={`admin-approve-comp-${req.id}`}
                        type="button"
                        variant="success"
                        size="sm"
                        onClick={() => void handleReviewCompetency(req.id, 'APPROVE')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        اعتماد وإصدار الشهادة
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleReviewCompetency(req.id, 'REJECT')}
                      >
                        <XCircle className="h-4 w-4" />
                        إرجاع بملاحظات
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SUBTAB 5: AUDIT TRAIL OF FINANCIAL & ADMIN CHANGES (Rule 7) */}
      {subTab === 'audit' && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#8CA2FF]" />
            سجل التغييرات الإدارية والمالية الهامة ({auditLogs.length})
          </h3>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
              >
                <div>
                  <span className="font-mono font-extrabold text-[#8CA2FF]" dir="ltr">
                    {log.action}
                  </span>
                  <p className="text-[#A9B1E0] mt-0.5">
                    المنفّذ: {log.actor?.fullName || 'النظام'} ({log.actorRole || 'SYSTEM'}) • الكيان:{' '}
                    {log.entityType}
                  </p>
                </div>
                <span className="text-[#A9B1E0] tabular-nums">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
