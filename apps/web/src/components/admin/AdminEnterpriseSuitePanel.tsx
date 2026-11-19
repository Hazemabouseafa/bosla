'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSearch,
  LifeBuoy,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ALL_ASSIGNABLE_ROLES,
  getCommissionStatusMeta,
  getOrderStatusMeta,
  getPayoutStatusMeta,
  getRoleBadgeTone,
  getRoleLabel,
  getSellerStatusMeta,
} from '@/lib/labels';
import { BentoKpiCard } from '@/components/dashboard/DashboardWidgets';
import { AdminCrmProfessionalPanel } from '@/components/admin/AdminCrmProfessionalPanel';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export type EnterpriseSubTab =
  | 'rbac'
  | 'sellers'
  | 'finance'
  | 'crm'
  | 'b2b'
  | 'lms'
  | 'support'
  | 'analytics'
  | 'audit';

const TICKET_STATUS_LABELS: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' | 'purple' }> = {
  OPEN: { label: 'مفتوحة — بانتظار الرد', tone: 'warning' },
  IN_PROGRESS: { label: 'قيد المعالجة', tone: 'info' },
  WAITING_USER: { label: 'بانتظار رد العميل', tone: 'purple' },
  RESOLVED: { label: 'تم الحل', tone: 'success' },
  CLOSED: { label: 'مغلقة نهائياً', tone: 'neutral' },
};

const TICKET_PRIORITY_LABELS: Record<string, { label: string; tone: 'neutral' | 'info' | 'warning' | 'danger' }> = {
  LOW: { label: 'عادية', tone: 'neutral' },
  MEDIUM: { label: 'متوسطة', tone: 'info' },
  HIGH: { label: 'مرتفعة', tone: 'warning' },
  URGENT: { label: 'عاجلة', tone: 'danger' },
};

const TICKET_CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'دعم تقني وتشغيل الفيديو',
  BILLING: 'المدفوعات والفواتير',
  CONTENT: 'المحتوى والاختبارات',
  CERTIFICATES: 'الشهادات والتحقق',
  OTHER: 'استفسار عام',
};

export function AdminEnterpriseSuitePanel({
  initialSection = 'sellers',
  forcedSection,
  hideTopSubNav = false,
  courses = [],
}: {
  initialSection?: EnterpriseSubTab;
  forcedSection?: EnterpriseSubTab;
  hideTopSubNav?: boolean;
  courses?: any[];
}) {
  const { user, pushToast } = useAuth();
  const [section, setSection] = useState<EnterpriseSubTab>(forcedSection || initialSection);
  const [busy, setBusy] = useState(false);

  // RBAC & Audit
  const [matrix, setMatrix] = useState<any>(null);
  const [rbacUsers, setRbacUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditQuery, setAuditQuery] = useState('');

  // Sellers & Commissions
  const [sellers, setSellers] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [ruleForm, setRuleForm] = useState({ courseId: '', sellerId: '', fixedAmountEgp: '100', capPercent: '50' });
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});

  // Finance, Orders, Settlements, Reconciliation, Expenses
  const [orders, setOrders] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [financeDash, setFinanceDash] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [settleForm, setSettleForm] = useState({
    sellerId: '',
    periodYear: String(new Date().getFullYear()),
    periodMonth: String(new Date().getMonth() + 1),
    minPayoutEgp: '500',
  });
  const [expenseForm, setExpenseForm] = useState({
    categoryAr: 'تسويق وإعلانات داخلية',
    descriptionAr: '',
    amountEgp: '',
    incurredAt: new Date().toISOString().slice(0, 10),
  });

  // B2B
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgForm, setOrgForm] = useState({ nameAr: '', type: 'COMPANY', contactNameAr: '', contactPhone: '', seatCapacity: '25' });

  // LMS Advanced
  const [sessions, setSessions] = useState<any[]>([]);
  const [questionBank, setQuestionBank] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [sessionForm, setSessionForm] = useState({ courseId: '', titleAr: '', sessionType: 'ONLINE_LIVE', startsAt: '', endsAt: '', manualMeetingUrl: '' });
  const [qbForm, setQbForm] = useState({ courseId: '', questionType: 'MCQ', promptAr: '', correctAnswer: 'a' });

  // Support & Analytics
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});
  const [ticketInternalNote, setTicketInternalNote] = useState<Record<string, boolean>>({});
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('ALL');
  const [analytics, setAnalytics] = useState<any>(null);

  const perms = new Set(user?.permissions || []);
  const isSuper = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || (user?.roles || []).includes('SUPER_ADMIN');
  const can = (p: string) => isSuper || perms.has(p);

  const loadSection = useCallback(async (sec: EnterpriseSubTab) => {
    try {
      if (sec === 'rbac' && can('rbac.manage')) {
        const [m, u, a] = await Promise.all([
          apiFetch('/rbac/matrix'),
          apiFetch('/rbac/users'),
          apiFetch('/rbac/audit-logs?limit=50'),
        ]);
        setMatrix(m);
        setRbacUsers(Array.isArray(u) ? u : []);
        setAuditLogs(Array.isArray(a) ? a : []);
      } else if (sec === 'audit' && can('audit.read')) {
        const a = await apiFetch('/rbac/audit-logs?limit=80');
        setAuditLogs(Array.isArray(a) ? a : []);
      } else if (sec === 'sellers') {
        const [s, r, c] = await Promise.all([
          can('sellers.manage')
            ? apiFetch('/sellers/admin/list')
            : can('finance.dashboard.read')
              ? apiFetch('/finance/sellers-directory')
              : Promise.resolve([]),
          can('commissions.rules.manage') ? apiFetch('/finance/commission-rules') : Promise.resolve([]),
          can('finance.dashboard.read') ? apiFetch('/finance/commissions') : Promise.resolve([]),
        ]);
        setSellers(Array.isArray(s) ? s : []);
        setRules(Array.isArray(r) ? r : []);
        setCommissions(Array.isArray(c) ? c : []);
      } else if (sec === 'finance') {
        const [o, st, d, rec, exp, s] = await Promise.all([
          can('orders.read') ? apiFetch('/commerce/admin/orders') : Promise.resolve([]),
          can('finance.dashboard.read') ? apiFetch('/finance/settlements') : Promise.resolve([]),
          can('finance.dashboard.read') ? apiFetch('/finance/dashboard') : Promise.resolve(null),
          can('finance.reconcile') ? apiFetch('/finance/reconciliation') : Promise.resolve(null),
          can('finance.dashboard.read') ? apiFetch('/finance/expenses') : Promise.resolve([]),
          can('sellers.manage')
            ? apiFetch('/sellers/admin/list')
            : can('finance.dashboard.read')
              ? apiFetch('/finance/sellers-directory')
              : Promise.resolve([]),
        ]);
        setOrders(Array.isArray(o) ? o : []);
        setSettlements(Array.isArray(st) ? st : []);
        setFinanceDash(d);
        setReconciliation(rec);
        setExpenses(Array.isArray(exp) ? exp : []);
        setSellers(Array.isArray(s) ? s : []);
      } else if (sec === 'crm') {
        // Handled natively by AdminCrmProfessionalPanel
      } else if (sec === 'b2b') {
        const list = await apiFetch('/organizations');
        setOrgs(Array.isArray(list) ? list : []);
      } else if (sec === 'lms') {
        const [ses, qb, asg] = await Promise.all([
          apiFetch('/lms/sessions'),
          can('lms.grade') ? apiFetch('/lms/question-bank') : Promise.resolve(null),
          apiFetch('/lms/assignments'),
        ]);
        setSessions(Array.isArray(ses) ? ses : []);
        setQuestionBank(qb);
        setAssignments(Array.isArray(asg) ? asg : []);
      } else if (sec === 'support') {
        const t = await apiFetch('/support/tickets');
        setTickets(Array.isArray(t) ? t : []);
      } else if (sec === 'analytics' && can('audit.read')) {
        const a = await apiFetch('/support/analytics/executive');
        setAnalytics(a);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل بيانات القسم', 'error');
    }
  }, [pushToast, user]);

  useEffect(() => {
    setSection(forcedSection || initialSection);
  }, [forcedSection, initialSection]);

  useEffect(() => {
    void loadSection(section);
  }, [section, loadSection]);

  const tabs: Array<{ id: EnterpriseSubTab; label: string; icon: React.ReactNode; show: boolean }> = [
    { id: 'rbac', label: 'الأدوار والصلاحيات والتدقيق', icon: <ShieldCheck className="h-4 w-4" />, show: can('rbac.manage') },
    { id: 'sellers', label: 'البائعون والعمولات', icon: <UserCheck className="h-4 w-4" />, show: can('sellers.manage') || can('commissions.rules.manage') || can('commissions.approve') },
    { id: 'finance', label: 'الطلبات والتسويات والمطابقة', icon: <Wallet className="h-4 w-4" />, show: can('finance.dashboard.read') || can('orders.read') },
    { id: 'crm', label: 'CRM والحملات', icon: <TrendingUp className="h-4 w-4" />, show: can('crm.manage') },
    { id: 'b2b', label: 'المؤسسات B2B', icon: <Building2 className="h-4 w-4" />, show: can('b2b.manage') || can('b2b.org_admin') },
    { id: 'lms', label: 'التدريب والبنوك والواجبات', icon: <BookOpen className="h-4 w-4" />, show: can('training.coordinate') || can('lms.grade') },
    { id: 'support', label: 'تذاكر الدعم الفني', icon: <LifeBuoy className="h-4 w-4" />, show: can('support.manage') },
    { id: 'analytics', label: 'التحليلات التنفيذية', icon: <BarChart3 className="h-4 w-4" />, show: can('audit.read') },
    { id: 'audit', label: 'سجل التدقيق', icon: <FileSearch className="h-4 w-4" />, show: can('audit.read') && !can('rbac.manage') },
  ];

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
      if (ticketPriorityFilter !== 'ALL' && t.priority !== ticketPriorityFilter) return false;
      if (ticketSearch.trim()) {
        const q = ticketSearch.trim().toLowerCase();
        const hay = `${t.ticketNumber || ''} ${t.subjectAr || ''} ${t.descriptionAr || ''} ${t.user?.fullName || ''} ${t.user?.phoneE164 || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, ticketStatusFilter, ticketPriorityFilter, ticketSearch]);

  const ticketKpis = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'OPEN').length;
    const active = tickets.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'WAITING_USER').length;
    const closed = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const rated = tickets.filter((t) => typeof t.satisfactionRating === 'number');
    const avgCsat = rated.length > 0
      ? (rated.reduce((sum, t) => sum + Number(t.satisfactionRating || 0), 0) / rated.length).toFixed(1)
      : '—';
    return { open, active, closed, avgCsat };
  }, [tickets]);

  const handleMarkFailedSettlement = async (payoutId: string) => {
    const reason = window.prompt('اذكر سبب فشل التحويل البنكي / المحفظة:', 'بيانات الحساب البنكي تحتاج مراجعة');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/finance/settlements/${encodeURIComponent(payoutId)}/fail`, {
        method: 'POST',
        body: JSON.stringify({ failureReasonAr: reason.trim() }),
      });
      pushToast('تم تسجيل فشل التحويل وإعادة إتاحة العمولات لإعادة المحاولة', 'info');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تسجيل فشل التحويل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const label = TICKET_STATUS_LABELS[status]?.label || status;
      pushToast(`تم تحديث حالة التذكرة إلى: ${label}`, 'success');
      await loadSection('support');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة التذكرة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    const bodyAr = (ticketReply[ticketId] || '').trim();
    if (!bodyAr) return;
    const isInternalNote = Boolean(ticketInternalNote[ticketId]);
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${encodeURIComponent(ticketId)}/replies`, {
        method: 'POST',
        body: JSON.stringify({ bodyAr, isInternalNote }),
      });
      setTicketReply((p) => ({ ...p, [ticketId]: '' }));
      setTicketInternalNote((p) => ({ ...p, [ticketId]: false }));
      pushToast(isInternalNote ? 'تم حفظ الملاحظة الداخلية للفريق' : 'تم إرسال الرد للعميل بنجاح', 'success');
      await loadSection('support');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الرد', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRolePermission = async (roleCode: string, currentPerms: string[], permCode: string) => {
    setBusy(true);
    try {
      const next = currentPerms.includes(permCode)
        ? currentPerms.filter((p) => p !== permCode)
        : [...currentPerms, permCode];
      await apiFetch(`/rbac/roles/${encodeURIComponent(roleCode)}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: next }),
      });
      pushToast(`تم تحديث صلاحيات ${getRoleLabel(roleCode)}`, 'success');
      await loadSection('rbac');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تعديل الصلاحية', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReviewSeller = async (sellerId: string, decision: 'APPROVE' | 'REJECT' | 'CHANGES_REQUESTED') => {
    setBusy(true);
    try {
      await apiFetch(`/sellers/admin/${encodeURIComponent(sellerId)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          initialCode: decision === 'APPROVE' ? codeInputs[sellerId] || undefined : undefined,
          verifyKycAndPayout: decision === 'APPROVE',
        }),
      });
      pushToast('تم تحديث حالة البائع بنجاح', 'success');
      await loadSection('sellers');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة البائع', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.courseId) return;
    setBusy(true);
    try {
      await apiFetch('/finance/commission-rules', {
        method: 'POST',
        body: JSON.stringify({
          courseId: ruleForm.courseId,
          sellerId: ruleForm.sellerId || null,
          fixedAmountEgp: Number(ruleForm.fixedAmountEgp),
          capPercent: Number(ruleForm.capPercent),
          effectiveFrom: new Date().toISOString(),
          isActive: true,
        }),
      });
      pushToast('تم حفظ قاعدة العمولة الثابتة بنجاح', 'success');
      await loadSection('sellers');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء قاعدة العمولة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRunMaturation = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<any>('/finance/jobs/mature-commissions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      pushToast(`تم فحص ${res.checkedCount} عمولة وتحويل ${res.transitionedCount} إلى مؤهلة (ELIGIBLE)`, 'success');
      await loadSection('sellers');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تشغيل استحقاق العمولات', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveCommission = async (commId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/finance/commissions/${encodeURIComponent(commId)}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVE', reasonAr: 'اعتماد مالي عبر لوحة التحكم' }),
      });
      pushToast('تم اعتماد العمولة بنجاح', 'success');
      await loadSection('sellers');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر اعتماد العمولة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleForm.sellerId) return;
    setBusy(true);
    try {
      const res = await apiFetch<any>('/finance/settlements', {
        method: 'POST',
        body: JSON.stringify({
          sellerId: settleForm.sellerId,
          periodYear: Number(settleForm.periodYear),
          periodMonth: Number(settleForm.periodMonth),
          minPayoutEgp: Number(settleForm.minPayoutEgp),
        }),
      });
      pushToast(`تم إنشاء التسوية ${res.settlementNumber} (${res.status})`, 'success');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء التسوية', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSettlement = async (payoutId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/finance/settlements/${encodeURIComponent(payoutId)}/approve`, {
        method: 'POST',
      });
      pushToast('تم اعتماد التسوية وفق مبدأ Maker-Checker', 'success');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الاعتماد (تأكد من اختلاف المراجع عن المنشئ)', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaidSettlement = async (payoutId: string) => {
    const ref = window.prompt('أدخل رقم مرجع التحويل البنكي / المحفظة:');
    if (!ref?.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/finance/settlements/${encodeURIComponent(payoutId)}/pay`, {
        method: 'POST',
        body: JSON.stringify({ transferReference: ref.trim() }),
      });
      pushToast('تم توثيق التحويل وإغلاق الصرف بنجاح', 'success');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر توثيق الصرف', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRecordManualPayment = async (orderId: string, remainingEgp: number) => {
    const amtStr = window.prompt(`أدخل قيمة الدفعة بالجنيه (المتبقي ${remainingEgp} ج.م):`, String(remainingEgp));
    if (!amtStr) return;
    const ref = window.prompt('رقم مرجع الإيصال / التحويل البنكي:', `BANK-${Date.now().toString().slice(-6)}`);
    if (!ref?.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/commerce/admin/orders/${encodeURIComponent(orderId)}/payments/manual`, {
        method: 'POST',
        body: JSON.stringify({
          amountEgp: Number(amtStr),
          paymentMethod: 'BANK_TRANSFER',
          receiptReference: ref.trim(),
        }),
      });
      pushToast('تم توثيق الدفعة وتوزيعها تلقائياً على بنود الطلب', 'success');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تسجيل الدفعة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRefundOrder = async (orderId: string, maxRefundEgp: number) => {
    const amtStr = window.prompt(`أدخل مبلغ الاسترداد (الحد الأقصى ${maxRefundEgp} ج.م):`, String(maxRefundEgp));
    if (!amtStr) return;
    const reasonAr = window.prompt('سبب الاسترداد:', 'طلب استرداد معتمد من العميل');
    if (!reasonAr?.trim()) return;
    setBusy(true);
    try {
      const amt = Number(amtStr);
      await apiFetch('/finance/refunds', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          refundAmountEgp: amt,
          refundType: amt >= maxRefundEgp ? 'FULL' : 'PARTIAL',
          revokeAccess: amt >= maxRefundEgp,
          reasonAr: reasonAr.trim(),
        }),
      });
      pushToast('تم تنفيذ الاسترداد وعكس العمولة بنجاح', 'success');
      await loadSection('finance');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ الاسترداد', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hideTopSubNav && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.filter((t) => t.show).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  section === t.id
                    ? 'bg-[#EEF0FF] text-[#0B1440]'
                    : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadSection(section)}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
        </div>
      )}

      {/* 1. RBAC MATRIX & AUDIT LOG */}
      {section === 'rbac' && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">مصفوفة الأدوار والصلاحيات الدقيقة (RBAC v1.2)</h3>
            {matrix?.roles && (
              <div className="space-y-4">
                {matrix.roles.map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <p className="font-extrabold text-[#EEF0FF]">{r.nameAr}</p>
                        <p className="text-xs text-[#A9B1E0]">{r.descriptionAr}</p>
                      </div>
                      <Badge tone="purple">{r.permissions.length} صلاحية</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(matrix.permissions || []).map((p: any) => {
                        const granted = r.permissions.includes(p.code);
                        return (
                          <button
                            key={p.code}
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleRolePermission(r.code, r.permissions, p.code)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                              granted
                                ? 'bg-[#7C95FF]/25 text-[#EEF0FF] border border-[#8CA2FF]'
                                : 'bg-[#0F1A4A] text-[#7D88BD] border border-[#22307A]'
                            }`}
                          >
                            {granted ? '✓ ' : '+ '}{p.code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">المستخدمون وتعدد الأدوار ({rbacUsers.length})</h3>
            <p className="text-xs text-[#A9B1E0]">
              يمكن للمدير الأعلى تعيين الدور الأساسي وإضافة أدوار إضافية لأي مستخدم (مثل: خدمة العملاء، المسؤول المالي، البائع المعتمد، مدير الأكاديمية، منسق التدريب).
            </p>
            <table className="w-full text-sm text-right">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">الاسم</th>
                  <th className="py-2 px-3">الهاتف</th>
                  <th className="py-2 px-3">الدور الأساسي</th>
                  <th className="py-2 px-3">الأدوار الإضافية (تعدد الأدوار)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {rbacUsers.slice(0, 30).map((u) => {
                  const currentExtras = (u.roles || []).filter((rc: string) => rc !== u.primaryRole);
                  return (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-bold text-[#EEF0FF]">{u.fullName}</td>
                      <td dir="ltr" className="py-2.5 px-3 font-mono text-xs text-[#A9B1E0]">{u.phoneE164 || '—'}</td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <select
                          aria-label={`الدور الأساسي للمستخدم ${u.fullName}`}
                          className={inputClassName}
                          value={u.primaryRole}
                          disabled={busy || u.id === user?.id}
                          onChange={async (e) => {
                            const nextRole = e.target.value;
                            setBusy(true);
                            try {
                              await apiFetch(`/rbac/users/${encodeURIComponent(u.id)}/roles`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                  primaryRole: nextRole,
                                  extraRoles: currentExtras.filter((rc: string) => rc !== nextRole),
                                }),
                              });
                              pushToast(`تم تحديث الدور الأساسي إلى ${getRoleLabel(nextRole)}`, 'success');
                              await loadSection('rbac');
                            } catch (err: any) {
                              pushToast(err?.message || 'تعذر تعديل الدور', 'error');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {ALL_ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_ASSIGNABLE_ROLES.filter((r) => r.code !== u.primaryRole && r.code !== 'STUDENT').map((r) => {
                            const active = currentExtras.includes(r.code);
                            return (
                              <button
                                key={r.code}
                                type="button"
                                disabled={busy || u.id === user?.id}
                                onClick={async () => {
                                  const nextExtras = active
                                    ? currentExtras.filter((rc: string) => rc !== r.code)
                                    : [...currentExtras, r.code];
                                  setBusy(true);
                                  try {
                                    await apiFetch(`/rbac/users/${encodeURIComponent(u.id)}/roles`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ primaryRole: u.primaryRole, extraRoles: nextExtras }),
                                    });
                                    pushToast(`تم ${active ? 'إزالة' : 'إضافة'} دور ${r.label} للمستخدم ${u.fullName}`, 'success');
                                    await loadSection('rbac');
                                  } catch (err: any) {
                                    pushToast(err?.message || 'تعذر تحديث الأدوار الإضافية', 'error');
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                                  active
                                    ? 'border border-[#8CA2FF] bg-[#7C95FF]/25 text-[#EEF0FF]'
                                    : 'border border-[#22307A] bg-[#0B1440] text-[#7D88BD] hover:text-[#EEF0FF]'
                                }`}
                              >
                                {active ? '✓ ' : '+ '}{r.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(u.roles || []).map((rc: string) => (
                            <Badge key={rc} tone={getRoleBadgeTone(rc)}>{getRoleLabel(rc)}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card className="p-5 space-y-3 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">سجل التدقيق غير القابل للتعديل (Audit Log)</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex flex-wrap justify-between items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                  <div>
                    <span dir="ltr" className="font-mono font-bold text-[#8CA2FF]">{log.action}</span>
                    <span className="mx-2 text-[#A9B1E0]">• {log.actor?.fullName || 'النظام'}</span>
                    {log.entityType && <span className="text-[#A9B1E0]">({log.entityType})</span>}
                  </div>
                  <span className="text-[#A9B1E0]">{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 2. SELLERS, CODES & COMMISSIONS */}
      {section === 'sellers' && (
        <div className="space-y-6">
          {can('sellers.manage') && (
          <Card className="p-5 space-y-4 overflow-x-auto">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">البائعون الأفراد وطلبات الانضمام ({sellers.length})</h3>
              <Link href="/seller"><Button size="sm" variant="outline">معاينة بوابة البائع</Button></Link>
            </div>
            <table className="w-full text-sm text-right">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">البائع</th>
                  <th className="py-2 px-3">الأكواد</th>
                  <th className="py-2 px-3">التحقق</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {sellers.map((s) => {
                  const meta = getSellerStatusMeta(s.status);
                  return (
                    <tr key={s.id}>
                      <td className="py-3 px-3">
                        <p className="font-bold text-[#EEF0FF]">{s.fullName}</p>
                        <p dir="ltr" className="text-xs text-[#A9B1E0]">{s.phoneE164}</p>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.codes || []).map((c: any) => (
                            <Badge key={c.id} tone={c.isActive ? 'info' : 'neutral'}>{c.code}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {s.kycVerified && s.payoutVerified ? 'KYC + صرف موثّق ✓' : 'غير مكتمل'}
                      </td>
                      <td className="py-3 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {s.status !== 'APPROVED' && (
                            <>
                              <input
                                dir="ltr"
                                placeholder="كود مبدئي (مثل ALI2026)"
                                className="rounded-lg border border-[#22307A] bg-[#0B1440] px-2 py-1 text-xs w-32"
                                value={codeInputs[s.id] || ''}
                                onChange={(e) => setCodeInputs((p) => ({ ...p, [s.id]: e.target.value }))}
                              />
                              <Button size="sm" variant="primary" disabled={busy} onClick={() => handleReviewSeller(s.id, 'APPROVE')}>اعتماد</Button>
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReviewSeller(s.id, 'REJECT')}>رفض</Button>
                            </>
                          )}
                          {s.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={async () => {
                                await apiFetch(`/sellers/admin/${encodeURIComponent(s.id)}/status`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'SUSPENDED', reasonAr: 'إيقاف إداري مؤقت للمراجعة' }),
                                });
                                pushToast('تم إيقاف البائع وتجميد الصرف', 'success');
                                await loadSection('sellers');
                              }}
                            >
                              إيقاف مؤقت
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          )}

          {can('commissions.rules.manage') && (
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">قواعد العمولات الثابتة (لكل كورس / بائع+كورس — بدون قاعدة عامة)</h3>
            <form onSubmit={handleCreateRule} className="grid gap-3 sm:grid-cols-5 items-end">
              <Field label="الكورس">
                <select className={inputClassName} required value={ruleForm.courseId} onChange={(e) => setRuleForm({ ...ruleForm, courseId: e.target.value })}>
                  <option value="">اختر الكورس...</option>
                  {courses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.titleAr || c.publishedVersion?.titleAr || c.slug}</option>
                  ))}
                </select>
              </Field>
              <Field label="بائع محدد (اتركه فارغاً للافتراضي)">
                <select className={inputClassName} value={ruleForm.sellerId} onChange={(e) => setRuleForm({ ...ruleForm, sellerId: e.target.value })}>
                  <option value="">القاعدة الافتراضية للكورس</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
              </Field>
              <Field label="المبلغ الثابت (ج.م)">
                <input type="number" step="0.01" min="0" className={inputClassName} required value={ruleForm.fixedAmountEgp} onChange={(e) => setRuleForm({ ...ruleForm, fixedAmountEgp: e.target.value })} />
              </Field>
              <Field label="سقف العمولة (%)">
                <input type="number" min="1" max="100" className={inputClassName} required value={ruleForm.capPercent} onChange={(e) => setRuleForm({ ...ruleForm, capPercent: e.target.value })} />
              </Field>
              <Button type="submit" variant="primary" disabled={busy}>إضافة القاعدة</Button>
            </form>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {rules.map((r) => (
                <div key={r.id} className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-[#EEF0FF]">{r.course?.publishedVersion?.titleAr || r.course?.slug}</span>
                    <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'نشطة' : 'متوقفة'}</Badge>
                  </div>
                  <p className="text-[#8CA2FF]">
                    {r.seller ? `مخصصة للبائع: ${r.seller.fullName}` : 'افتراضية للكورس'} — {Number(r.fixedAmount)} ج.م (سقف {Number(r.capPercent)}%)
                  </p>
                </div>
              ))}
            </div>
          </Card>
          )}

          {can('finance.dashboard.read') && (
          <Card className="p-5 space-y-4 overflow-x-auto">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">إدارة واعتماد العمولات ({commissions.length})</h3>
              {can('commissions.approve') && (
                <Button size="sm" variant="primary" disabled={busy} onClick={handleRunMaturation}>
                  تشغيل فحص استحقاق الـ 14 يوماً (القاهرة)
                </Button>
              )}
            </div>
            <table className="w-full text-sm text-right">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">البائع</th>
                  <th className="py-2 px-3">الصافي</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {commissions.map((c) => {
                  const meta = getCommissionStatusMeta(c.status);
                  return (
                    <tr key={c.id}>
                      <td dir="ltr" className="py-2.5 px-3 font-mono text-xs text-[#8CA2FF]">{c.order?.orderNumber}</td>
                      <td className="py-2.5 px-3">{c.seller?.fullName}</td>
                      <td className="py-2.5 px-3 font-extrabold text-emerald-300">{Number(c.netAmount).toLocaleString('ar-EG')} ج.م</td>
                      <td className="py-2.5 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="py-2.5 px-3">
                        {c.status === 'ELIGIBLE' && can('commissions.approve') && (
                          <Button size="sm" variant="primary" disabled={busy} onClick={() => handleApproveCommission(c.id)}>
                            اعتماد للصرف
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          )}
        </div>
      )}

      {/* 3. FINANCE, ORDERS, MAKER-CHECKER SETTLEMENTS & RECONCILIATION */}
      {section === 'finance' && (
        <div className="space-y-6">
          {financeDash?.summary && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <BentoKpiCard value={`${financeDash.summary.totalCashCollectedEgp.toLocaleString('ar-EG')} ج.م`} label="التحصيل النقدي الفعلي" delta={`الإيراد المعترف به: ${financeDash.summary.recognizedRevenueEgp.toLocaleString('ar-EG')} ج.م`} icon={<Wallet className="h-5 w-5" />} />
              <BentoKpiCard value={`${financeDash.summary.operatingNetProfitEgp.toLocaleString('ar-EG')} ج.م`} label="صافي الربح التشغيلي (P&L)" delta={`التدفق النقدي: ${financeDash.summary.netCashFlowEgp.toLocaleString('ar-EG')} ج.م`} deltaTone="info" icon={<BadgeDollarSign className="h-5 w-5" />} />
              <BentoKpiCard value={`${financeDash.summary.totalActiveCommissionsEgp.toLocaleString('ar-EG')} ج.م`} label="التزامات عمولات البائعين" delta={`مصروف: ${financeDash.commissionsByStatusEgp?.PAID ?? 0} ج.م`} deltaTone="warning" icon={<UserCheck className="h-5 w-5" />} />
              <BentoKpiCard value={`${financeDash.summary.totalRefundsEgp.toLocaleString('ar-EG')} ج.م`} label="إجمالي الاستردادات والمصروفات" delta={`المصروفات: ${financeDash.summary.totalExpensesEgp.toLocaleString('ar-EG')} ج.م`} deltaTone="danger" icon={<FileCheck2 className="h-5 w-5" />} />
            </div>
          )}

          {/* Automated Reconciliation Checks + CSV Exports */}
          {reconciliation && (
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-5 w-5 ${reconciliation.allChecksPassed ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <h3 className="text-base font-extrabold text-[#EEF0FF]">
                    تقرير المطابقة المالية الآلي ({reconciliation.allChecksPassed ? 'مطابق 100%' : 'توجد فروقات'})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['orders', 'commissions', 'payouts', 'reconciliation'] as const).map((ds) => (
                    <a
                      key={ds}
                      href={`/api/v1/finance/export/${ds}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#22307A] bg-[#0B1440] px-3 py-1.5 text-xs font-bold text-[#8CA2FF] hover:text-[#EEF0FF]"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV: {ds}
                    </a>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(reconciliation.checks || []).map((chk: any) => (
                  <div key={chk.code} className="flex items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                    <div>
                      <span dir="ltr" className="font-mono font-bold text-[#8CA2FF]">{chk.code}</span>
                      <p className="text-[#EEF0FF]">{chk.nameAr}</p>
                    </div>
                    <Badge tone={chk.passed ? 'success' : 'danger'}>{chk.passed ? 'PASS' : 'FAIL'}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Maker-Checker Settlements */}
          {can('finance.dashboard.read') && (
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-[#EEF0FF]">التسويات الشهرية للبائعين — رقابة مزدوجة (Maker-Checker)</h3>
                <p className="text-xs text-[#A9B1E0] mt-0.5">
                  المسؤول المالي الذي يُنشئ مسودة التسوية (Maker) لا يمكنه اعتمادها لنفسه — يجب اعتمادها من مراجع مالي مختلف (Checker) قبل تنفيذ التحويل.
                </p>
              </div>
            </div>
            {can('settlements.create') && (
              <form onSubmit={handleCreateSettlement} className="grid gap-3 sm:grid-cols-5 items-end">
                <Field label="البائع">
                  <select className={inputClassName} required value={settleForm.sellerId} onChange={(e) => setSettleForm({ ...settleForm, sellerId: e.target.value })}>
                    <option value="">اختر البائع...</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="السنة">
                  <input type="number" className={inputClassName} value={settleForm.periodYear} onChange={(e) => setSettleForm({ ...settleForm, periodYear: e.target.value })} />
                </Field>
                <Field label="الشهر">
                  <input type="number" min="1" max="12" className={inputClassName} value={settleForm.periodMonth} onChange={(e) => setSettleForm({ ...settleForm, periodMonth: e.target.value })} />
                </Field>
                <Field label="الحد الأدنى (ج.م)">
                  <input type="number" className={inputClassName} value={settleForm.minPayoutEgp} onChange={(e) => setSettleForm({ ...settleForm, minPayoutEgp: e.target.value })} />
                </Field>
                <Button type="submit" variant="primary" disabled={busy}>إنشاء تسوية (Maker)</Button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                  <tr>
                    <th className="py-2 px-3">رقم التسوية</th>
                    <th className="py-2 px-3">البائع</th>
                    <th className="py-2 px-3">صافي الصرف</th>
                    <th className="py-2 px-3">الحالة</th>
                    <th className="py-2 px-3">المنشئ (Maker) / المراجع (Checker)</th>
                    <th className="py-2 px-3">إجراءات الاعتماد والصرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22307A]/60">
                  {settlements.map((st) => {
                    const meta = getPayoutStatusMeta(st.status);
                    const isSelfMaker = st.createdById === user?.id;
                    return (
                      <tr key={st.id}>
                        <td dir="ltr" className="py-2.5 px-3 font-mono text-xs text-[#8CA2FF]">{st.settlementNumber}</td>
                        <td className="py-2.5 px-3">{st.seller?.fullName}</td>
                        <td className="py-2.5 px-3 font-extrabold text-emerald-300">{Number(st.netPayableAmount).toLocaleString('ar-EG')} ج.م</td>
                        <td className="py-2.5 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                        <td className="py-2.5 px-3 text-xs text-[#A9B1E0]">
                          <div>Maker: <span className="text-[#EEF0FF] font-bold">{st.createdBy?.fullName || '—'}</span></div>
                          <div>Checker: <span className="text-[#8CA2FF] font-bold">{st.approvedBy?.fullName || 'بانتظار مراجع مالي'}</span></div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {st.status === 'DRAFT' && can('settlements.approve') && (
                              isSelfMaker ? (
                                <Badge tone="warning">
                                  <Lock className="h-3 w-3 inline me-1" />
                                  أنت المنشئ (Maker) — بانتظار المراجع المالي (Checker)
                                </Badge>
                              ) : (
                                <Button size="sm" variant="primary" disabled={busy} onClick={() => handleApproveSettlement(st.id)}>
                                  اعتماد التسوية (Checker)
                                </Button>
                              )
                            )}
                            {st.status === 'APPROVED' && can('settlements.payout') && (
                              <>
                                <Button size="sm" variant="primary" disabled={busy} onClick={() => handleMarkPaidSettlement(st.id)}>
                                  توثيق التحويل (PAID)
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleMarkFailedSettlement(st.id)}>
                                  تسجيل فشل التحويل
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          )}

          {/* Orders Table with Manual Payment & Refund Actions */}
          <Card className="p-5 space-y-4 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">طلبات المتجر والمدفوعات اليدوية والاسترداد ({orders.length})</h3>
            <table className="w-full text-sm text-right">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">رقم الطلب</th>
                  <th className="py-2 px-3">العميل</th>
                  <th className="py-2 px-3">الإجمالي / المدفوع</th>
                  <th className="py-2 px-3">كود البائع</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">إجراءات مالية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {orders.slice(0, 30).map((ord) => {
                  const meta = getOrderStatusMeta(ord.status);
                  const remaining = Math.max(0, Number(ord.totalAmount) - Number(ord.paidAmount));
                  const refundable = Math.max(0, Number(ord.paidAmount) - Number(ord.refundedAmount));
                  return (
                    <tr key={ord.id}>
                      <td dir="ltr" className="py-2.5 px-3 font-mono text-xs text-[#8CA2FF]">{ord.orderNumber}</td>
                      <td className="py-2.5 px-3">{ord.user?.fullName}</td>
                      <td className="py-2.5 px-3 text-xs">
                        {Number(ord.totalAmount)} / <span className="text-emerald-300 font-bold">{Number(ord.paidAmount)} ج.م</span>
                      </td>
                      <td dir="ltr" className="py-2.5 px-3 font-mono text-xs">{ord.sellerCodeSnapshot || '—'}</td>
                      <td className="py-2.5 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {remaining > 0 && can('orders.manual_payment') && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRecordManualPayment(ord.id, remaining)}>
                              تسجيل دفعة
                            </Button>
                          )}
                          {refundable > 0 && can('orders.refund') && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRefundOrder(ord.id, refundable)}>
                              استرداد
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Expenses */}
          {can('finance.expenses.manage') && (
            <Card className="p-5 space-y-4">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">المصروفات التشغيلية ({expenses.length})</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await apiFetch('/finance/expenses', {
                      method: 'POST',
                      body: JSON.stringify({ ...expenseForm, amountEgp: Number(expenseForm.amountEgp) }),
                    });
                    pushToast('تم تسجيل المصروف بنجاح', 'success');
                    setExpenseForm({ ...expenseForm, descriptionAr: '', amountEgp: '' });
                    await loadSection('finance');
                  } catch (err: any) {
                    pushToast(err?.message || 'تعذر تسجيل المصروف', 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="grid gap-3 sm:grid-cols-4 items-end"
              >
                <Field label="البند"><input className={inputClassName} required value={expenseForm.categoryAr} onChange={(e) => setExpenseForm({ ...expenseForm, categoryAr: e.target.value })} /></Field>
                <Field label="الوصف"><input className={inputClassName} required value={expenseForm.descriptionAr} onChange={(e) => setExpenseForm({ ...expenseForm, descriptionAr: e.target.value })} /></Field>
                <Field label="المبلغ (ج.م)"><input type="number" step="0.01" className={inputClassName} required value={expenseForm.amountEgp} onChange={(e) => setExpenseForm({ ...expenseForm, amountEgp: e.target.value })} /></Field>
                <Button type="submit" variant="primary" disabled={busy}>حفظ المصروف</Button>
              </form>
              {expenses.length > 0 && (
                <div className="space-y-2 pt-2">
                  {expenses.slice(0, 12).map((ex) => (
                    <div key={ex.id} className="flex flex-wrap justify-between items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                      <div>
                        <span className="font-bold text-[#EEF0FF]">{ex.categoryAr}</span>
                        <span className="mx-2 text-[#A9B1E0]">• {ex.descriptionAr}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-rose-300">{Number(ex.amount).toLocaleString('ar-EG')} ج.م</span>
                        <span className="text-[#A9B1E0]">{new Date(ex.incurredAt || ex.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* 4. PROFESSIONAL CRM & CAMPAIGNS */}
      {section === 'crm' && <AdminCrmProfessionalPanel courses={courses} />}

      {/* 5. B2B ORGANIZATIONS */}
      {section === 'b2b' && (
        <Card className="p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">الشركات والجامعات والمؤسسات (B2B)</h3>
            <Link href="/org"><Button size="sm" variant="outline">فتح بوابة المؤسسات (/org)</Button></Link>
          </div>
          {can('b2b.manage') && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await apiFetch('/organizations', {
                    method: 'POST',
                    body: JSON.stringify({ ...orgForm, seatCapacity: Number(orgForm.seatCapacity) }),
                  });
                  pushToast('تم تسجيل المؤسسة بنجاح', 'success');
                  setOrgForm({ nameAr: '', type: 'COMPANY', contactNameAr: '', contactPhone: '', seatCapacity: '25' });
                  await loadSection('b2b');
                } catch (err: any) {
                  pushToast(err?.message || 'تعذر تسجيل المؤسسة', 'error');
                } finally {
                  setBusy(false);
                }
              }}
              className="grid gap-3 sm:grid-cols-5 items-end"
            >
              <Field label="اسم المؤسسة"><input className={inputClassName} required value={orgForm.nameAr} onChange={(e) => setOrgForm({ ...orgForm, nameAr: e.target.value })} /></Field>
              <Field label="النوع">
                <select className={inputClassName} value={orgForm.type} onChange={(e) => setOrgForm({ ...orgForm, type: e.target.value })}>
                  <option value="COMPANY">شركة</option>
                  <option value="UNIVERSITY">جامعة / جهة أكاديمية</option>
                </select>
              </Field>
              <Field label="مسؤول التواصل"><input className={inputClassName} required value={orgForm.contactNameAr} onChange={(e) => setOrgForm({ ...orgForm, contactNameAr: e.target.value })} /></Field>
              <Field label="الهاتف"><input dir="ltr" className={inputClassName} required value={orgForm.contactPhone} onChange={(e) => setOrgForm({ ...orgForm, contactPhone: e.target.value })} /></Field>
              <Button type="submit" variant="primary" disabled={busy}>إضافة مؤسسة</Button>
            </form>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {orgs.map((o) => (
              <div key={o.id} className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <p className="font-extrabold text-[#EEF0FF]">{o.nameAr}</p>
                  <Badge tone="info">{o.type}</Badge>
                </div>
                <p className="text-[#A9B1E0]">المقاعد: {o._count?.members ?? 0} / {o.seatCapacity} | العقود: {o._count?.contracts ?? 0} | الدفعات: {o._count?.cohorts ?? 0}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. ADVANCED LMS */}
      {section === 'lms' && (
        <div className="space-y-6">
          <AlertBanner tone="info" title="ملاحظة نطاق التكاملات (القسم 15)">
            روابط الاجتماعات المباشرة تُدخل يدوياً في الجلسات (تكاملات Zoom API و Google Meet API خارج نطاق هذا الإصدار).
          </AlertBanner>
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">جدولة الجلسات التدريبية (أونلاين / حضوري / هجين) ({sessions.length})</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await apiFetch('/lms/sessions', { method: 'POST', body: JSON.stringify(sessionForm) });
                  pushToast('تمت جدولة الجلسة التدريبية', 'success');
                  await loadSection('lms');
                } catch (err: any) {
                  pushToast(err?.message || 'تعذر جدولة الجلسة', 'error');
                } finally {
                  setBusy(false);
                }
              }}
              className="grid gap-3 sm:grid-cols-5 items-end"
            >
              <Field label="الكورس">
                <select className={inputClassName} required value={sessionForm.courseId} onChange={(e) => setSessionForm({ ...sessionForm, courseId: e.target.value })}>
                  <option value="">اختر الكورس...</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.titleAr || c.publishedVersion?.titleAr || c.slug}</option>)}
                </select>
              </Field>
              <Field label="عنوان الجلسة"><input className={inputClassName} required value={sessionForm.titleAr} onChange={(e) => setSessionForm({ ...sessionForm, titleAr: e.target.value })} /></Field>
              <Field label="البداية"><input type="datetime-local" className={inputClassName} required value={sessionForm.startsAt} onChange={(e) => setSessionForm({ ...sessionForm, startsAt: e.target.value })} /></Field>
              <Field label="النهاية"><input type="datetime-local" className={inputClassName} required value={sessionForm.endsAt} onChange={(e) => setSessionForm({ ...sessionForm, endsAt: e.target.value })} /></Field>
              <Button type="submit" variant="primary" disabled={busy}>جدولة الجلسة</Button>
            </form>
            <div className="space-y-2">
              {sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex flex-wrap justify-between items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                  <div>
                    <p className="font-bold text-[#EEF0FF]">{s.titleAr}</p>
                    <p className="text-[#A9B1E0]">{new Date(s.startsAt).toLocaleString('ar-EG')} — {s.venueAr || s.manualMeetingUrl || 'أونلاين'}</p>
                  </div>
                  <Badge tone="info">{s.sessionType}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">بنك الأسئلة ({questionBank?.items?.length ?? 0}) والواجبات والمشاريع ({assignments.length})</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await apiFetch('/lms/question-bank/items', { method: 'POST', body: JSON.stringify(qbForm) });
                  pushToast('تمت إضافة السؤال إلى بنك الأسئلة', 'success');
                  setQbForm({ ...qbForm, promptAr: '' });
                  await loadSection('lms');
                } catch (err: any) {
                  pushToast(err?.message || 'تعذر إضافة السؤال', 'error');
                } finally {
                  setBusy(false);
                }
              }}
              className="grid gap-3 sm:grid-cols-4 items-end"
            >
              <Field label="النوع">
                <select className={inputClassName} value={qbForm.questionType} onChange={(e) => setQbForm({ ...qbForm, questionType: e.target.value })}>
                  <option value="MCQ">اختيار من متعدد</option>
                  <option value="TRUE_FALSE">صح / خطأ</option>
                  <option value="WRITTEN">سؤال مقالي (تصحيح يدوي)</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="نص السؤال"><input className={inputClassName} required value={qbForm.promptAr} onChange={(e) => setQbForm({ ...qbForm, promptAr: e.target.value })} /></Field>
              </div>
              <Button type="submit" variant="primary" disabled={busy}>إضافة للبنك</Button>
            </form>
          </Card>
        </div>
      )}

      {/* 7. SUPPORT TICKETS DESK (DEDICATED CUSTOMER SUPPORT AGENT WORKSPACE) */}
      {section === 'support' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BentoKpiCard
              value={String(ticketKpis.open)}
              label="تذاكر مفتوحة بانتظار الرد"
              delta={`إجمالي التذاكر: ${tickets.length}`}
              deltaTone={ticketKpis.open > 0 ? 'warning' : 'success'}
              icon={<LifeBuoy className="h-5 w-5" />}
            />
            <BentoKpiCard
              value={String(ticketKpis.active)}
              label="قيد المعالجة والمتابعة"
              delta="تذاكر نشطة مع الفريق"
              deltaTone="info"
              icon={<MessageSquare className="h-5 w-5" />}
            />
            <BentoKpiCard
              value={String(ticketKpis.closed)}
              label="تذاكر محلولة ومغلقة"
              delta="مكتملة بنجاح"
              deltaTone="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <BentoKpiCard
              value={`${ticketKpis.avgCsat} / 5`}
              label="متوسط رضا العملاء (CSAT)"
              delta="تقييمات المتدربين"
              deltaTone="info"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#EEF0FF]">مكتب تذاكر الدعم الفني وخدمة العملاء ({filteredTickets.length})</h3>
                <p className="text-xs text-[#A9B1E0]">
                  يمكنك استعراض جميع التذاكر، إرسال رد عام للعميل أو ملاحظة داخلية للفريق، وتغيير حالة التذكرة أو إغلاقها بعد الحل.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadSection('support')}>
                <RefreshCw className="h-3.5 w-3.5" /> تحديث التذاكر
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="h-4 w-4 text-[#A9B1E0] absolute top-3.5 start-3 pointer-events-none" />
                <input
                  type="search"
                  aria-label="بحث في تذاكر الدعم"
                  placeholder="ابحث برقم التذكرة أو اسم العميل أو الموضوع..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className={`${inputClassName} ps-9`}
                />
              </div>
              <select
                aria-label="تصفية التذاكر حسب الحالة"
                className={inputClassName}
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
              >
                <option value="ALL">جميع الحالات ({tickets.length})</option>
                <option value="OPEN">مفتوحة (OPEN)</option>
                <option value="IN_PROGRESS">قيد المعالجة (IN_PROGRESS)</option>
                <option value="WAITING_USER">بانتظار العميل (WAITING_USER)</option>
                <option value="RESOLVED">تم الحل (RESOLVED)</option>
                <option value="CLOSED">مغلقة نهائياً (CLOSED)</option>
              </select>
              <select
                aria-label="تصفية التذاكر حسب الأولوية"
                className={inputClassName}
                value={ticketPriorityFilter}
                onChange={(e) => setTicketPriorityFilter(e.target.value)}
              >
                <option value="ALL">جميع الأولويات</option>
                <option value="URGENT">عاجلة (URGENT)</option>
                <option value="HIGH">مرتفعة (HIGH)</option>
                <option value="MEDIUM">متوسطة (MEDIUM)</option>
                <option value="LOW">عادية (LOW)</option>
              </select>
            </div>

            {filteredTickets.length === 0 ? (
              <AlertBanner tone="info" title="لا توجد تذاكر مطابقة للتصفية الحالية">
                ستظهر هنا أي تذاكر جديدة يفتحها المتدربون أو العملاء فور إرسالها.
              </AlertBanner>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((t) => {
                  const stMeta = TICKET_STATUS_LABELS[t.status] || { label: t.status, tone: 'info' as const };
                  const prMeta = TICKET_PRIORITY_LABELS[t.priority] || { label: t.priority, tone: 'neutral' as const };
                  const isClosed = t.status === 'RESOLVED' || t.status === 'CLOSED';
                  return (
                    <div key={t.id} className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 space-y-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span dir="ltr" className="text-xs font-mono font-bold text-[#8CA2FF]">{t.ticketNumber}</span>
                            <Badge tone="neutral">{TICKET_CATEGORY_LABELS[t.category] || t.category}</Badge>
                            <Badge tone={prMeta.tone}>{prMeta.label}</Badge>
                            <Badge tone={stMeta.tone}>{stMeta.label}</Badge>
                          </div>
                          <h4 className="font-extrabold text-[#EEF0FF] text-base">{t.subjectAr}</h4>
                          <p className="text-xs text-[#A9B1E0]">
                            العميل: <span className="text-[#EEF0FF] font-bold">{t.user?.fullName || 'عميل'}</span>
                            {t.user?.phoneE164 && <span dir="ltr" className="mx-2 font-mono">{t.user.phoneE164}</span>}
                            <span>• {new Date(t.createdAt).toLocaleString('ar-EG')}</span>
                            {t.satisfactionRating && <span className="ms-2 text-amber-300 font-bold">★ تقييم {t.satisfactionRating}/5</span>}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`تغيير حالة التذكرة ${t.ticketNumber}`}
                            className="min-h-[38px] rounded-xl border border-[#22307A] bg-[#0F1A4A] px-2.5 text-xs font-bold text-[#EEF0FF]"
                            value={t.status}
                            disabled={busy}
                            onChange={(e) => void handleUpdateTicketStatus(t.id, e.target.value)}
                          >
                            <option value="OPEN">مفتوحة</option>
                            <option value="IN_PROGRESS">قيد المعالجة</option>
                            <option value="WAITING_USER">بانتظار العميل</option>
                            <option value="RESOLVED">تم الحل</option>
                            <option value="CLOSED">مغلقة نهائياً</option>
                          </select>
                          {!isClosed ? (
                            <>
                              {t.status === 'OPEN' && (
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleUpdateTicketStatus(t.id, 'IN_PROGRESS')}>
                                  بدء المعالجة
                                </Button>
                              )}
                              <Button size="sm" variant="success" disabled={busy} onClick={() => void handleUpdateTicketStatus(t.id, 'RESOLVED')}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> حل التذكرة
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleUpdateTicketStatus(t.id, 'CLOSED')}>
                                إغلاق التذكرة
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleUpdateTicketStatus(t.id, 'OPEN')}>
                              إعادة فتح
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#22307A]/70 bg-[#0F1A4A]/70 p-3 text-xs text-[#DCE2FF] leading-relaxed">
                        {t.descriptionAr}
                      </div>

                      {(t.replies || []).length > 0 && (
                        <div className="space-y-2 border-t border-[#22307A] pt-3">
                          <p className="text-[11px] font-bold text-[#A9B1E0]">سجل المحادثة والردود ({t.replies.length})</p>
                          {t.replies.map((r: any) => (
                            <div
                              key={r.id}
                              className={`rounded-xl border p-3 text-xs ${
                                r.isInternalNote
                                  ? 'border-amber-500/40 bg-amber-500/10'
                                  : 'border-[#22307A] bg-[#0F1A4A]'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#EEF0FF]">{r.author?.fullName || 'عضو الفريق'}</span>
                                  {r.isInternalNote ? (
                                    <Badge tone="warning">ملاحظة داخلية للفريق</Badge>
                                  ) : (
                                    <Badge tone="info">رد للعميل</Badge>
                                  )}
                                </div>
                                <span className="text-[#A9B1E0]">{new Date(r.createdAt).toLocaleString('ar-EG')}</span>
                              </div>
                              <p className="text-[#EEF0FF] leading-relaxed">{r.bodyAr}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 border-t border-[#22307A] pt-3">
                        <div className="flex flex-wrap gap-2">
                          <input
                            className={`${inputClassName} flex-1 min-w-[240px]`}
                            placeholder={ticketInternalNote[t.id] ? 'اكتب ملاحظة داخلية لفريق العمل فقط...' : 'اكتب ردك الرسمي للعميل...'}
                            value={ticketReply[t.id] || ''}
                            onChange={(e) => setTicketReply((p) => ({ ...p, [t.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant={ticketInternalNote[t.id] ? 'outline' : 'primary'}
                            disabled={busy || !(ticketReply[t.id] || '').trim()}
                            onClick={() => void handleReplyTicket(t.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {ticketInternalNote[t.id] ? 'حفظ ملاحظة داخلية' : 'إرسال الرد للعميل'}
                          </Button>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-[#A9B1E0] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(ticketInternalNote[t.id])}
                            onChange={(e) => setTicketInternalNote((p) => ({ ...p, [t.id]: e.target.checked }))}
                            className="rounded border-[#22307A] bg-[#0F1A4A]"
                          />
                          ملاحظة داخلية للفريق فقط (لن تظهر للمتدرب)
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 8. EXECUTIVE ANALYTICS */}
      {section === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BentoKpiCard value={`${analytics.salesEgp.daily.toLocaleString('ar-EG')} ج.م`} label="مبيعات اليوم" delta={`الشهر: ${analytics.salesEgp.monthly.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp className="h-5 w-5" />} />
            <BentoKpiCard value={`${analytics.salesEgp.annual.toLocaleString('ar-EG')} ج.م`} label="المبيعات السنوية" delta={`${analytics.learningKpis.newUsersThisMonth} مستخدم جديد هذا الشهر`} deltaTone="info" icon={<BarChart3 className="h-5 w-5" />} />
            <BentoKpiCard value={`${analytics.learningKpis.lessonCompletionRatePercent}%`} label="معدل إتمام الدروس" delta={`تسجيلات نشطة: ${analytics.learningKpis.activeEnrollments}`} icon={<BookOpen className="h-5 w-5" />} />
            <BentoKpiCard value={`${analytics.b2bKpis.utilizationPercent}%`} label="استهلاك مقاعد B2B" delta={`CSAT الدعم: ${analytics.supportKpis.averageCsat ?? '—'} / 5`} deltaTone="warning" icon={<Building2 className="h-5 w-5" />} />
          </div>

          <Card className="p-5 space-y-3">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">أفضل البائعين أداءً</h3>
            {(analytics.topSellers || []).map((s: any) => (
              <div key={s.id} className="flex justify-between items-center rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-sm">
                <span className="font-bold text-[#EEF0FF]">{s.fullName}</span>
                <span className="text-xs text-[#8CA2FF]">{s.ordersCount} طلبات — صافي عمولات {s.totalNetCommissionsEgp.toLocaleString('ar-EG')} ج.م</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* 9. DEDICATED AUDIT LOG (FOR FINANCE OFFICERS & AUDIT READERS) */}
      {section === 'audit' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#EEF0FF]">سجل التدقيق المالي والإداري ({auditLogs.length})</h3>
              <p className="text-xs text-[#A9B1E0]">سجل غير قابل للتعديل لكافة عمليات الاعتماد والتسويات والاسترداد وتغيير الصلاحيات.</p>
            </div>
            <input
              type="search"
              placeholder="ابحث بالعملية أو اسم المنفذ..."
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              className={`${inputClassName} w-64`}
            />
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {auditLogs
              .filter((log) => {
                if (!auditQuery.trim()) return true;
                const q = auditQuery.trim().toLowerCase();
                return `${log.action || ''} ${log.entityType || ''} ${log.actor?.fullName || ''}`.toLowerCase().includes(q);
              })
              .map((log) => (
                <div key={log.id} className="flex flex-wrap justify-between items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                  <div>
                    <span dir="ltr" className="font-mono font-bold text-[#8CA2FF]">{log.action}</span>
                    <span className="mx-2 text-[#A9B1E0]">• {log.actor?.fullName || 'النظام'}</span>
                    {log.entityType && <span className="text-[#A9B1E0]">({log.entityType})</span>}
                  </div>
                  <span className="text-[#A9B1E0]">{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
