'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Kanban,
  Megaphone,
  MessageSquarePlus,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Target,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiFetch, formatDate, formatDateTime, formatNumber } from '@/lib/api';
import { downloadCsv } from '@/lib/csv-export';
import { useAuth } from '@/lib/auth-context';
import { BentoKpiCard } from '@/components/dashboard/DashboardWidgets';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

type CrmViewMode = 'kanban' | 'table' | 'followups' | 'campaigns';

const LEAD_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'فرد / متدرب',
  CORPORATE_B2B: 'شركة / مؤسسة B2B',
  SPONSOR: 'راعي / شريك',
  WAITLIST: 'قائمة انتظار',
};

const PRIORITY_META: Record<string, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  HIGH: { label: 'مرتفعة', tone: 'danger' },
  MEDIUM: { label: 'متوسطة', tone: 'warning' },
  LOW: { label: 'عادية', tone: 'neutral' },
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: 'اتصال هاتفي',
  NOTE: 'ملاحظة متابعة',
  FOLLOW_UP: 'تذكير متابعة مجدول',
  STAGE_CHANGE: 'تحديث مرحلة المسار',
};

export function AdminCrmProfessionalPanel({ courses = [] }: { courses?: any[] }) {
  const { pushToast } = useAuth();
  const [viewMode, setViewMode] = useState<CrmViewMode>('kanban');
  const [busy, setBusy] = useState(false);

  const [crmData, setCrmData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  // Create / Edit Lead Modal
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({
    type: 'INDIVIDUAL',
    fullName: '',
    companyName: '',
    phoneNumber: '',
    email: '',
    roleLabel: '',
    interest: '',
    interestedCourseId: '',
    leadScore: '70',
    priority: 'MEDIUM',
    pipelineStageKey: 'NEW',
    assignedToId: '',
    campaignId: '',
    consentMarketing: true,
    notes: '',
  });

  // 360° Lead Drawer/Modal
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [activityForm, setActivityForm] = useState({
    activityType: 'CALL',
    summaryAr: '',
    dueAt: '',
    pipelineStageKey: '',
  });

  // Campaign Create / Edit Modal
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    nameAr: '',
    channel: 'Facebook & Instagram',
    budgetEgp: '5000',
    spendEgp: '2000',
    couponId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    notesAr: '',
  });

  const loadCrm = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (stageFilter) qs.set('stage', stageFilter);
      if (priorityFilter) qs.set('priority', priorityFilter);
      if (typeFilter) qs.set('type', typeFilter);
      if (courseFilter) qs.set('courseId', courseFilter);
      if (searchTerm.trim()) qs.set('q', searchTerm.trim());

      const [ld, cp] = await Promise.all([
        apiFetch<any>(`/crm/leads?${qs.toString()}`),
        apiFetch<any[]>('/crm/campaigns'),
      ]);
      setCrmData(ld);
      setCampaigns(Array.isArray(cp) ? cp : []);

      // Keep selectedLead refreshed if open
      if (selectedLead) {
        const refreshed = (ld?.leads || []).find((x: any) => x.id === selectedLead.id);
        if (refreshed) setSelectedLead(refreshed);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل منظومة الـ CRM', 'error');
    }
  }, [
    stageFilter,
    priorityFilter,
    typeFilter,
    courseFilter,
    searchTerm,
    selectedLead,
    pushToast,
  ]);

  useEffect(() => {
    void loadCrm();
  }, [loadCrm]);

  const stages: any[] = useMemo(() => crmData?.stages || [], [crmData]);
  const leads: any[] = useMemo(() => crmData?.leads || [], [crmData]);
  const staffMembers: any[] = useMemo(() => crmData?.staffMembers || [], [crmData]);
  const coupons: any[] = useMemo(() => crmData?.coupons || [], [crmData]);
  const kpis = crmData?.kpis || {};

  const stageNameMap = useMemo(() => {
    const m: Record<string, { nameAr: string; colorHex: string }> = {};
    for (const s of stages) {
      m[s.key] = { nameAr: s.nameAr, colorHex: s.colorHex };
    }
    return m;
  }, [stages]);

  const openCreateLeadModal = (defaultStage = 'NEW') => {
    setEditingLeadId(null);
    setDuplicateAlert(null);
    setLeadForm({
      type: 'INDIVIDUAL',
      fullName: '',
      companyName: '',
      phoneNumber: '',
      email: '',
      roleLabel: '',
      interest: '',
      interestedCourseId: '',
      leadScore: '70',
      priority: 'MEDIUM',
      pipelineStageKey: defaultStage,
      assignedToId: '',
      campaignId: '',
      consentMarketing: true,
      notes: '',
    });
    setLeadModalOpen(true);
  };

  const openEditLeadModal = (lead: any) => {
    setEditingLeadId(lead.id);
    setDuplicateAlert(null);
    setLeadForm({
      type: lead.type || 'INDIVIDUAL',
      fullName: lead.fullName || '',
      companyName: lead.companyName || '',
      phoneNumber: lead.phoneE164 || '',
      email: lead.email || '',
      roleLabel: lead.roleLabel || '',
      interest: lead.interest || '',
      interestedCourseId: lead.interestedCourseId || '',
      leadScore: String(lead.leadScore ?? 60),
      priority: lead.priority || 'MEDIUM',
      pipelineStageKey: lead.pipelineStageKey || 'NEW',
      assignedToId: lead.assignedToId || '',
      campaignId: lead.campaignId || '',
      consentMarketing: Boolean(lead.consentMarketing),
      notes: lead.notes || '',
    });
    setLeadModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDuplicateAlert(null);
    try {
      const payload = {
        type: leadForm.type,
        fullName: leadForm.fullName.trim(),
        companyName: leadForm.companyName.trim() || null,
        phoneNumber: leadForm.phoneNumber.trim(),
        email: leadForm.email.trim() || null,
        roleLabel: leadForm.roleLabel.trim() || null,
        interest: leadForm.interest.trim() || null,
        interestedCourseId: leadForm.interestedCourseId || null,
        leadScore: Number(leadForm.leadScore) || 60,
        priority: leadForm.priority,
        pipelineStageKey: leadForm.pipelineStageKey,
        assignedToId: leadForm.assignedToId || null,
        campaignId: leadForm.campaignId || null,
        consentMarketing: Boolean(leadForm.consentMarketing),
        notes: leadForm.notes.trim() || null,
      };

      if (editingLeadId) {
        await apiFetch(`/crm/leads/${encodeURIComponent(editingLeadId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث بيانات العميل المحتمل بنجاح', 'success');
        setLeadModalOpen(false);
      } else {
        const res = await apiFetch<any>('/crm/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.duplicateDetected) {
          setDuplicateAlert(
            `تنبيه: تم حفظ العميل ولكن رقم الهاتف أو البريد مطابق لسجل سابق (${res.existingLeadName || res.existingLeadId})`,
          );
          pushToast('تم التسجيل مع رصد تكرار لرقم الهاتف أو البريد', 'info');
        } else {
          pushToast('تمت إضافة العميل المحتمل إلى مسار المبيعات بنجاح', 'success');
          setLeadModalOpen(false);
        }
      }
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ بيانات العميل المحتمل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickStageChange = async (leadId: string, nextStageKey: string) => {
    setBusy(true);
    try {
      await apiFetch(`/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ pipelineStageKey: nextStageKey }),
      });
      pushToast(`تم نقل العميل إلى مرحلة: ${stageNameMap[nextStageKey]?.nameAr || nextStageKey}`, 'success');
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث المرحلة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLead = async (leadId: string, fullName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف سجل العميل "${fullName}" نهائياً؟`)) return;
    setBusy(true);
    try {
      await apiFetch(`/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
      });
      pushToast('تم حذف سجل العميل المحتمل', 'info');
      if (selectedLead?.id === leadId) setSelectedLead(null);
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف السجل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !activityForm.summaryAr.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/crm/leads/${encodeURIComponent(selectedLead.id)}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          activityType: activityForm.activityType,
          summaryAr: activityForm.summaryAr.trim(),
          dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : null,
          pipelineStageKey: activityForm.pipelineStageKey || undefined,
        }),
      });
      pushToast('تم توثيق النشاط في سجل العميل', 'success');
      setActivityForm({ activityType: 'CALL', summaryAr: '', dueAt: '', pipelineStageKey: '' });
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تسجيل النشاط', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteFollowUp = async (activityId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/crm/activities/${encodeURIComponent(activityId)}/complete`, {
        method: 'PATCH',
      });
      pushToast('تم إغلاق المتابعة كمنجزة ✓', 'success');
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث المتابعة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openCreateCampaignModal = () => {
    setEditingCampaignId(null);
    setCampaignForm({
      nameAr: '',
      channel: 'Facebook & Instagram',
      budgetEgp: '5000',
      spendEgp: '2000',
      couponId: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      notesAr: '',
    });
    setCampaignModalOpen(true);
  };

  const openEditCampaignModal = (cp: any) => {
    setEditingCampaignId(cp.id);
    setCampaignForm({
      nameAr: cp.nameAr || '',
      channel: cp.channel || '',
      budgetEgp: String(cp.budgetEgp ?? 0),
      spendEgp: String(cp.spendEgp ?? 0),
      couponId: cp.couponId || '',
      startDate: cp.startDate ? new Date(cp.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      endDate: cp.endDate ? new Date(cp.endDate).toISOString().slice(0, 10) : '',
      notesAr: cp.notesAr || '',
    });
    setCampaignModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        nameAr: campaignForm.nameAr.trim(),
        channel: campaignForm.channel.trim(),
        budgetEgp: Number(campaignForm.budgetEgp) || 0,
        spendEgp: Number(campaignForm.spendEgp) || 0,
        couponId: campaignForm.couponId || null,
        startDate: new Date(campaignForm.startDate).toISOString(),
        endDate: campaignForm.endDate ? new Date(campaignForm.endDate).toISOString() : null,
        notesAr: campaignForm.notesAr.trim() || null,
      };
      if (editingCampaignId) {
        await apiFetch(`/crm/campaigns/${encodeURIComponent(editingCampaignId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث بيانات الحملة التسويقية', 'success');
      } else {
        await apiFetch('/crm/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('تم إطلاق الحملة التسويقية بنجاح', 'success');
      }
      setCampaignModalOpen(false);
      await loadCrm();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ الحملة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportLeadsCsv = () => {
    downloadCsv(
      'bosla-crm-leads',
      [
        'الاسم',
        'الهاتف',
        'البريد',
        'الشركة',
        'النوع',
        'المرحلة',
        'الأولوية',
        'التقييم',
        'الكورس المهتم به',
        'الحملة',
        'المسؤول',
        'موافقة تسويقية',
        'تاريخ التسجيل',
      ],
      leads.map((l) => [
        l.fullName,
        l.phoneE164,
        l.email || '',
        l.companyName || '',
        LEAD_TYPE_LABELS[l.type] || l.type,
        stageNameMap[l.pipelineStageKey]?.nameAr || l.pipelineStageKey,
        PRIORITY_META[l.priority]?.label || l.priority,
        String(l.leadScore ?? ''),
        l.interestedCourse?.publishedVersion?.titleAr || l.interestedCourse?.slug || l.interest || '',
        l.campaign?.nameAr || '',
        l.assignedTo?.fullName || '',
        l.consentMarketing ? 'نعم' : 'لا',
        formatDate(l.createdAt),
      ]),
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive CRM KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BentoKpiCard
          value={kpis.totalLeads ?? leads.length}
          label="إجمالي العملاء المحتملين (CRM)"
          delta={`موافقة تسويقية: ${kpis.consentedCount ?? 0} • أولوية مرتفعة: ${kpis.highPriorityCount ?? 0}`}
          icon={<Users className="h-5 w-5" />}
        />
        <BentoKpiCard
          value={kpis.qualifiedAndProposalCount ?? 0}
          label="الفرص المؤهلة وعروض الأسعار"
          delta={`عملاء جدد قيد الفرز: ${kpis.newLeadsCount ?? 0}`}
          deltaTone="info"
          icon={<Target className="h-5 w-5" />}
        />
        <BentoKpiCard
          value={`${kpis.wonCount ?? 0} (${kpis.conversionRatePercent ?? 0}%)`}
          label="عملاء تم تسجيلهم (معدل التحويل)"
          delta={`غير مهتم حالياً: ${kpis.lostCount ?? 0}`}
          deltaTone="success"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <BentoKpiCard
          value={kpis.overdueFollowUpsCount ?? 0}
          label="متابعات مستحقة أو متأخرة"
          delta={`متابعات قادمة مجدولة: ${kpis.upcomingFollowUpsCount ?? 0}`}
          deltaTone={(kpis.overdueFollowUpsCount ?? 0) > 0 ? 'danger' : 'success'}
          icon={<CalendarClock className="h-5 w-5" />}
        />
      </div>

      {/* 2. View Switcher + Action Header */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                viewMode === 'kanban'
                  ? 'bg-[#EEF0FF] text-[#0B1440]'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
              }`}
            >
              <Kanban className="h-4 w-4" />
              لوحة المراحل البيعية (Kanban)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                viewMode === 'table'
                  ? 'bg-[#EEF0FF] text-[#0B1440]'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
              }`}
            >
              <Table2 className="h-4 w-4" />
              الجدول التفصيلي ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('followups')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                viewMode === 'followups'
                  ? 'bg-[#EEF0FF] text-[#0B1440]'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
              }`}
            >
              <CalendarClock className="h-4 w-4" />
              المتابعات والتذكيرات ({(crmData?.overdueFollowUps?.length || 0) + (crmData?.upcomingFollowUps?.length || 0)})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('campaigns')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                viewMode === 'campaigns'
                  ? 'bg-[#EEF0FF] text-[#0B1440]'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
              }`}
            >
              <Megaphone className="h-4 w-4" />
              الحملات التسويقية (CAC & ROAS) ({campaigns.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => openCreateLeadModal('NEW')}>
              <Plus className="h-4 w-4" />
              إضافة عميل محتمل جديد
            </Button>
            <Button size="sm" variant="outline" onClick={openCreateCampaignModal}>
              <Megaphone className="h-4 w-4" />
              إطلاق حملة تسويقية
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportLeadsCsv}>
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void loadCrm()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        {viewMode !== 'campaigns' && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6 pt-2 border-t border-[#22307A]">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#A9B1E0]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، البريد، الشركة..."
                className={`${inputClassName} ps-9`}
              />
            </div>

            <select
              className={inputClassName}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              aria-label="تصفية حسب المرحلة"
            >
              <option value="">كل مراحل المسار</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.nameAr} ({kpis.byStage?.[s.key] ?? 0})
                </option>
              ))}
            </select>

            <select
              className={inputClassName}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="تصفية حسب الأولوية"
            >
              <option value="">كل الأولويات</option>
              <option value="HIGH">أولوية مرتفعة</option>
              <option value="MEDIUM">أولوية متوسطة</option>
              <option value="LOW">أولوية عادية</option>
            </select>

            <select
              className={inputClassName}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="تصفية حسب النوع"
            >
              <option value="">كل التصنيفات</option>
              <option value="INDIVIDUAL">فرد / متدرب</option>
              <option value="CORPORATE_B2B">شركة / مؤسسة B2B</option>
              <option value="SPONSOR">راعي / شريك</option>
              <option value="WAITLIST">قائمة انتظار</option>
            </select>

            <select
              className={inputClassName}
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="تصفية حسب الكورس"
            >
              <option value="">كل الكورسات</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.titleAr || c.publishedVersion?.titleAr || c.slug}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {/* 3A. KANBAN PIPELINE VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 items-start">
          {stages.map((st) => {
            const stageLeads = leads.filter((l) => l.pipelineStageKey === st.key);
            return (
              <div
                key={st.key}
                className="rounded-2xl border border-[#22307A] bg-[#0B1440]/90 p-3.5 space-y-3 min-h-[340px]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#22307A] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: st.colorHex || '#6C4DF6' }}
                    />
                    <h4 className="text-xs font-extrabold text-[#EEF0FF]">{st.nameAr}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone="info">{stageLeads.length}</Badge>
                    <button
                      type="button"
                      onClick={() => openCreateLeadModal(st.key)}
                      title={`إضافة عميل في مرحلة ${st.nameAr}`}
                      className="rounded-lg p-1 text-[#8CA2FF] hover:bg-[#18266E]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {stageLeads.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#7D88BD]">لا يوجد عملاء في هذه المرحلة</p>
                ) : (
                  <div className="space-y-2.5">
                    {stageLeads.map((ld) => {
                      const pMeta = PRIORITY_META[ld.priority] || PRIORITY_META.MEDIUM;
                      return (
                        <div
                          key={ld.id}
                          className="rounded-xl border border-[#22307A] bg-[#0F1A4A] p-3 space-y-2.5 transition hover:border-[#8CA2FF]/60"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedLead(ld)}
                                className="text-start font-semibold text-sm text-[#EEF0FF] hover:text-[#8CA2FF]"
                              >
                                {ld.fullName}
                              </button>
                              {ld.companyName && (
                                <p className="text-[11px] font-bold text-[#8CA2FF] flex items-center gap-1">
                                  <Building2 className="h-3 w-3" /> {ld.companyName}
                                </p>
                              )}
                            </div>
                            <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#A9B1E0]">
                            <a
                              href={`tel:${ld.phoneE164}`}
                              dir="ltr"
                              className="font-mono hover:text-[#EEF0FF] underline"
                            >
                              {ld.phoneE164}
                            </a>
                            {ld.leadScore !== null && ld.leadScore !== undefined && (
                              <span className="rounded-md bg-[#18266E] px-1.5 py-0.5 text-[10px] font-extrabold text-[#8CA2FF]">
                                تقييم {ld.leadScore}%
                              </span>
                            )}
                          </div>

                          {(ld.interestedCourse || ld.interest) && (
                            <p className="text-[11px] text-[#EEF0FF] bg-[#0B1440] rounded-lg px-2 py-1 truncate">
                              🎯 {ld.interestedCourse?.publishedVersion?.titleAr || ld.interest}
                            </p>
                          )}

                          {ld.isDuplicatePhone && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                              <AlertTriangle className="h-3 w-3" /> رقم مكرر في السجلات
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#22307A]/70">
                            <select
                              aria-label={`نقل مرحلة ${ld.fullName}`}
                              value={ld.pipelineStageKey}
                              disabled={busy}
                              onChange={(e) => void handleQuickStageChange(ld.id, e.target.value)}
                              className="rounded-lg border border-[#22307A] bg-[#0B1440] px-2 py-1 text-[11px] font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
                            >
                              {stages.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.nameAr}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedLead(ld)}
                                className="rounded-lg border border-[#22307A] bg-[#18266E] px-2 py-1 text-[11px] font-extrabold text-[#EEF0FF] hover:border-[#8CA2FF]"
                              >
                                متابعة ({ld.activities?.length || 0})
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditLeadModal(ld)}
                                title="تعديل بيانات العميل"
                                className="rounded-lg p-1 text-[#A9B1E0] hover:text-[#EEF0FF]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3B. DETAILED TABLE VIEW */}
      {viewMode === 'table' && (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="border-b border-[#22307A] bg-[#0B1440] text-xs font-extrabold text-[#A9B1E0]">
              <tr>
                <th className="py-3 px-4">العميل والشركة</th>
                <th className="py-3 px-4">الهاتف / البريد</th>
                <th className="py-3 px-4">النوع والاهتمام</th>
                <th className="py-3 px-4">المرحلة البيعية</th>
                <th className="py-3 px-4">الأولوية والتقييم</th>
                <th className="py-3 px-4">المسؤول / الحملة</th>
                <th className="py-3 px-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22307A]/60">
              {leads.map((ld) => {
                const pMeta = PRIORITY_META[ld.priority] || PRIORITY_META.MEDIUM;
                return (
                  <tr key={ld.id} className="hover:bg-[#18266E]/35">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(ld)}
                        className="font-semibold text-[#EEF0FF] hover:text-[#8CA2FF] text-start"
                      >
                        {ld.fullName}
                      </button>
                      {ld.companyName && <p className="text-xs text-[#8CA2FF]">{ld.companyName}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs" dir="ltr">
                      <p className="font-mono font-bold text-[#EEF0FF]">{ld.phoneE164}</p>
                      {ld.email && <p className="text-[#A9B1E0]">{ld.email}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <Badge tone="neutral">{LEAD_TYPE_LABELS[ld.type] || ld.type}</Badge>
                      <p className="text-[#A9B1E0] mt-1">
                        {ld.interestedCourse?.publishedVersion?.titleAr || ld.interest || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={ld.pipelineStageKey}
                        disabled={busy}
                        onChange={(e) => void handleQuickStageChange(ld.id, e.target.value)}
                        className="rounded-lg border border-[#22307A] bg-[#0B1440] px-2.5 py-1.5 text-xs font-bold text-[#EEF0FF]"
                      >
                        {stages.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.nameAr}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                        {ld.leadScore !== null && (
                          <span className="text-xs font-extrabold text-[#8CA2FF]">{ld.leadScore}%</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A9B1E0]">
                      <p className="text-[#EEF0FF] font-bold">{ld.assignedTo?.fullName || 'غير مسند'}</p>
                      {ld.campaign && <p className="text-[#8CA2FF]">{ld.campaign.nameAr}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => setSelectedLead(ld)}>
                          متابعة ({ld.activities?.length || 0})
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditLeadModal(ld)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDeleteLead(ld.id, ld.fullName)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* 3C. FOLLOW-UPS & REMINDERS VIEW */}
      {viewMode === 'followups' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4 border-rose-500/40">
            <h3 className="text-base font-extrabold text-rose-300 flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              متابعات مستحقة أو متأخرة ({crmData?.overdueFollowUps?.length || 0})
            </h3>
            {(crmData?.overdueFollowUps || []).length === 0 ? (
              <p className="text-sm text-[#A9B1E0]">لا توجد متابعات متأخرة حالياً، أداء منتظم.</p>
            ) : (
              <div className="space-y-3">
                {crmData.overdueFollowUps.map((act: any) => (
                  <div
                    key={act.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-[#0B1440] p-3.5 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-extrabold text-[#EEF0FF] text-sm">
                        {act.lead?.fullName}{' '}
                        <span dir="ltr" className="font-mono text-[#8CA2FF]">
                          ({act.lead?.phoneE164})
                        </span>
                      </p>
                      <p className="text-[#EEF0FF]">{act.summaryAr}</p>
                      <p className="text-rose-300 font-semibold tabular-nums">
                        موعد الاستحقاق: {act.dueAt ? formatDateTime(act.dueAt) : '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void handleCompleteFollowUp(act.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> تم الإنجاز
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#8CA2FF]" />
              متابعات قادمة مجدولة ({crmData?.upcomingFollowUps?.length || 0})
            </h3>
            {(crmData?.upcomingFollowUps || []).length === 0 ? (
              <p className="text-sm text-[#A9B1E0]">لا توجد متابعات قادمة مجدولة حالياً.</p>
            ) : (
              <div className="space-y-3">
                {crmData.upcomingFollowUps.map((act: any) => (
                  <div
                    key={act.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-extrabold text-[#EEF0FF] text-sm">
                        {act.lead?.fullName}{' '}
                        <span dir="ltr" className="font-mono text-[#8CA2FF]">
                          ({act.lead?.phoneE164})
                        </span>
                      </p>
                      <p className="text-[#EEF0FF]">{act.summaryAr}</p>
                      <p className="text-[#8CA2FF] font-semibold tabular-nums">
                        الموعد: {act.dueAt ? formatDateTime(act.dueAt) : '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleCompleteFollowUp(act.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> إتمام مبكر
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3D. MARKETING CAMPAIGNS & ROI VIEW */}
      {viewMode === 'campaigns' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((cp) => (
              <Card key={cp.id} className="p-5 space-y-4 border border-[#22307A]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge tone="purple">{cp.channel}</Badge>
                    <h4 className="text-base font-extrabold text-[#EEF0FF] mt-1.5">{cp.nameAr}</h4>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEditCampaignModal(cp)}>
                    <Edit3 className="h-3.5 w-3.5" /> تعديل
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                  <div>
                    <p className="text-[#A9B1E0]">الميزانية / الإنفاق</p>
                    <p className="font-semibold tabular-nums text-[#EEF0FF]">
                      {formatNumber(cp.spendEgp)} / {formatNumber(cp.budgetEgp)} ج.م
                    </p>
                  </div>
                  <div>
                    <p className="text-[#A9B1E0]">الإيراد المنسوب</p>
                    <p className="font-semibold tabular-nums text-emerald-300">
                      {formatNumber(cp.attributedRevenueEgp)} ج.م
                    </p>
                  </div>
                  <div>
                    <p className="text-[#A9B1E0]">العملاء / المسجلون (WON)</p>
                    <p className="font-semibold tabular-nums text-[#EEF0FF]">
                      {formatNumber(cp.totalLeads)} عميل / {formatNumber(cp.wonLeads)} مسجل ({formatNumber(cp.conversionRatePercent)}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-[#A9B1E0]">CAC / ROAS</p>
                    <p className="font-semibold tabular-nums text-[#8CA2FF]">
                      <bdi>CAC</bdi>: {cp.cacEgp ? `${formatNumber(cp.cacEgp)} ج.م` : '—'} | <bdi>ROAS</bdi>: {cp.roas ? `${formatNumber(cp.roas)}x` : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-[#A9B1E0]">
                  <span>الكوبون المرتبط: {cp.couponCode ? <bdi>{cp.couponCode}</bdi> : 'بدون كوبون'}</span>
                  <span className="tabular-nums">البداية: {formatDate(cp.startDate)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT LEAD */}
      <NativeModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        title={editingLeadId ? 'تعديل بيانات العميل المحتمل (CRM)' : 'إضافة عميل محتمل جديد إلى المسار البيعي'}
      >
        <form onSubmit={handleSaveLead} className="space-y-4">
          {duplicateAlert && (
            <AlertBanner tone="warning" title="تنبيه كشف التكرار">
              {duplicateAlert}
            </AlertBanner>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم العميل الكامل" required>
              <input
                className={inputClassName}
                required
                value={leadForm.fullName}
                onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })}
                placeholder="مثال: د. محمد عبد الرحمن"
              />
            </Field>
            <Field label="رقم الهاتف المحمول" required>
              <input
                dir="ltr"
                className={inputClassName}
                required
                value={leadForm.phoneNumber}
                onChange={(e) => setLeadForm({ ...leadForm, phoneNumber: e.target.value })}
                placeholder="01012345678"
              />
            </Field>
            <Field label="البريد الإلكتروني (اختياري)">
              <input
                dir="ltr"
                type="email"
                className={inputClassName}
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                placeholder="client@example.com"
              />
            </Field>
            <Field label="اسم الشركة / المزرعة / الجهة (اختياري)">
              <input
                className={inputClassName}
                value={leadForm.companyName}
                onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })}
                placeholder="شركة الوادي للدواجن"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="تصنيف العميل">
              <select
                className={inputClassName}
                value={leadForm.type}
                onChange={(e) => setLeadForm({ ...leadForm, type: e.target.value })}
              >
                <option value="INDIVIDUAL">فرد / متدرب</option>
                <option value="CORPORATE_B2B">شركة / مؤسسة B2B</option>
                <option value="SPONSOR">راعي / شريك</option>
                <option value="WAITLIST">قائمة انتظار</option>
              </select>
            </Field>
            <Field label="المرحلة في المسار">
              <select
                className={inputClassName}
                value={leadForm.pipelineStageKey}
                onChange={(e) => setLeadForm({ ...leadForm, pipelineStageKey: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الأولوية">
              <select
                className={inputClassName}
                value={leadForm.priority}
                onChange={(e) => setLeadForm({ ...leadForm, priority: e.target.value })}
              >
                <option value="HIGH">مرتفعة</option>
                <option value="MEDIUM">متوسطة</option>
                <option value="LOW">عادية</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="الكورس المهتم به">
              <select
                className={inputClassName}
                value={leadForm.interestedCourseId}
                onChange={(e) => setLeadForm({ ...leadForm, interestedCourseId: e.target.value })}
              >
                <option value="">— اختر كورساً —</option>
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.titleAr || c.publishedVersion?.titleAr || c.slug}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحملة التسويقية">
              <select
                className={inputClassName}
                value={leadForm.campaignId}
                onChange={(e) => setLeadForm({ ...leadForm, campaignId: e.target.value })}
              >
                <option value="">— بدون حملة —</option>
                {campaigns.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="مسؤول المتابعة">
              <select
                className={inputClassName}
                value={leadForm.assignedToId}
                onChange={(e) => setLeadForm({ ...leadForm, assignedToId: e.target.value })}
              >
                <option value="">— تلقائي / غير محدد —</option>
                {staffMembers.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اهتمام إضافي / مسمى وظيفي">
              <input
                className={inputClassName}
                value={leadForm.interest}
                onChange={(e) => setLeadForm({ ...leadForm, interest: e.target.value })}
                placeholder="مثال: دبلومة تغذية الدواجن لمجموعة مهندسين"
              />
            </Field>
            <Field label="درجة التأهيل (Lead Score 0-100)">
              <input
                type="number"
                min="0"
                max="100"
                className={inputClassName}
                value={leadForm.leadScore}
                onChange={(e) => setLeadForm({ ...leadForm, leadScore: e.target.value })}
              />
            </Field>
          </div>

          <Field label="ملاحظات وتفاصيل العميل">
            <textarea
              rows={2}
              className={inputClassName}
              value={leadForm.notes}
              onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              placeholder="أي ملاحظات أولية حول احتياج العميل أو الميزانية..."
            />
          </Field>

          <label className="flex items-center gap-2 text-xs font-bold text-[#EEF0FF] cursor-pointer">
            <input
              type="checkbox"
              checked={leadForm.consentMarketing}
              onChange={(e) => setLeadForm({ ...leadForm, consentMarketing: e.target.checked })}
            />
            موافقة العميل على استلام عروض وإشعارات الأكاديمية التسويقية
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setLeadModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'جاري الحفظ...' : editingLeadId ? 'حفظ التعديلات' : 'إضافة العميل للمسار'}
            </Button>
          </div>
        </form>
      </NativeModal>

      {/* MODAL 2: 360° LEAD PROFILE & ACTIVITY TIMELINE */}
      <NativeModal
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title={selectedLead ? `ملف العميل والأنشطة 360° — ${selectedLead.fullName}` : 'ملف العميل'}
      >
        {selectedLead && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-base text-[#EEF0FF]">{selectedLead.fullName}</span>
                  <Badge tone="info">
                    {stageNameMap[selectedLead.pipelineStageKey]?.nameAr || selectedLead.pipelineStageKey}
                  </Badge>
                  <Badge tone={PRIORITY_META[selectedLead.priority]?.tone || 'warning'}>
                    {PRIORITY_META[selectedLead.priority]?.label || selectedLead.priority}
                  </Badge>
                </div>
                <p className="text-xs text-[#A9B1E0]">
                  الهاتف: <span dir="ltr" className="font-mono text-[#8CA2FF]">{selectedLead.phoneE164}</span>
                  {selectedLead.email ? ` • البريد: ${selectedLead.email}` : ''}
                  {selectedLead.companyName ? ` • الجهة: ${selectedLead.companyName}` : ''}
                </p>
                {selectedLead.notes && <p className="text-xs text-[#EEF0FF] pt-1">📝 {selectedLead.notes}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ld = selectedLead;
                  setSelectedLead(null);
                  openEditLeadModal(ld);
                }}
              >
                <Edit3 className="h-3.5 w-3.5" /> تعديل البيانات
              </Button>
            </div>

            {/* Log new Call / Note / Follow-up Reminder */}
            <form onSubmit={handleAddActivity} className="rounded-xl border border-[#22307A] bg-[#0F1A4A] p-4 space-y-3">
              <h4 className="text-xs font-extrabold text-[#8CA2FF] flex items-center gap-1.5">
                <MessageSquarePlus className="h-4 w-4" />
                تسجيل اتصال هاتفي / ملاحظة / جدولة متابعة
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="نوع النشاط">
                  <select
                    className={inputClassName}
                    value={activityForm.activityType}
                    onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}
                  >
                    <option value="CALL">اتصال هاتفي (CALL)</option>
                    <option value="NOTE">ملاحظة متابعة (NOTE)</option>
                    <option value="FOLLOW_UP">جدولة موعد متابعة (FOLLOW_UP)</option>
                    <option value="STAGE_CHANGE">تحديث مرحلة (STAGE_CHANGE)</option>
                  </select>
                </Field>
                <Field label="تحديث المرحلة (اختياري)">
                  <select
                    className={inputClassName}
                    value={activityForm.pipelineStageKey}
                    onChange={(e) => setActivityForm({ ...activityForm, pipelineStageKey: e.target.value })}
                  >
                    <option value="">— الإبقاء على المرحلة الحالية —</option>
                    {stages.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="موعد المتابعة القادمة (اختياري)">
                  <input
                    type="datetime-local"
                    className={inputClassName}
                    value={activityForm.dueAt}
                    onChange={(e) => setActivityForm({ ...activityForm, dueAt: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="ملخص الاتصال أو الملاحظة" required>
                <textarea
                  rows={2}
                  required
                  className={inputClassName}
                  value={activityForm.summaryAr}
                  onChange={(e) => setActivityForm({ ...activityForm, summaryAr: e.target.value })}
                  placeholder="اكتب نتيجة المكالمة أو تفاصيل العرض المرسل للعميل..."
                />
              </Field>
              <Button type="submit" size="sm" variant="primary" disabled={busy}>
                <PhoneCall className="h-3.5 w-3.5" /> حفظ النشاط في السجل
              </Button>
            </form>

            {/* Chronological Activity History */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              <h4 className="text-xs font-extrabold text-[#EEF0FF]">
                السجل الزمني للأنشطة والمتابعات ({selectedLead.activities?.length || 0})
              </h4>
              {(selectedLead.activities || []).length === 0 ? (
                <p className="text-xs text-[#A9B1E0]">لا توجد أنشطة مسجلة بعد.</p>
              ) : (
                selectedLead.activities.map((act: any) => (
                  <div
                    key={act.id}
                    className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={act.activityType === 'FOLLOW_UP' ? 'warning' : 'info'}>
                          {ACTIVITY_TYPE_LABELS[act.activityType] || act.activityType}
                        </Badge>
                        <span className="font-bold text-[#8CA2FF]">{act.actor?.fullName || 'النظام'}</span>
                      </div>
                      <span className="text-[#A9B1E0] tabular-nums">
                        {formatDateTime(act.createdAt)}
                      </span>
                    </div>
                    <p className="text-[#EEF0FF] pt-1">{act.summaryAr}</p>
                    {act.dueAt && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-amber-300 font-semibold tabular-nums">
                          موعد المتابعة: {formatDateTime(act.dueAt)}
                        </span>
                        {act.completedAt ? (
                          <Badge tone="success">تم الإنجاز ✓</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleCompleteFollowUp(act.id)}
                          >
                            تحديد كمنجز ✓
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </NativeModal>

      {/* MODAL 3: CREATE / EDIT MARKETING CAMPAIGN */}
      <NativeModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        title={editingCampaignId ? 'تعديل الحملة التسويقية والإنفاق' : 'إطلاق حملة تسويقية داخلية جديدة'}
      >
        <form onSubmit={handleSaveCampaign} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الحملة التسويقية" required>
              <input
                className={inputClassName}
                required
                value={campaignForm.nameAr}
                onChange={(e) => setCampaignForm({ ...campaignForm, nameAr: e.target.value })}
                placeholder="مثال: حملة دبلومة الدواجن — الربع الأول"
              />
            </Field>
            <Field label="القناة التسويقية" required>
              <input
                className={inputClassName}
                required
                value={campaignForm.channel}
                onChange={(e) => setCampaignForm({ ...campaignForm, channel: e.target.value })}
                placeholder="Facebook / LinkedIn / المؤتمرات"
              />
            </Field>
            <Field label="الميزانية المرصودة (ج.م)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClassName}
                value={campaignForm.budgetEgp}
                onChange={(e) => setCampaignForm({ ...campaignForm, budgetEgp: e.target.value })}
              />
            </Field>
            <Field label="الإنفاق الفعلي حتى الآن (ج.م)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClassName}
                value={campaignForm.spendEgp}
                onChange={(e) => setCampaignForm({ ...campaignForm, spendEgp: e.target.value })}
              />
            </Field>
            <Field label="ربط بكوبون خصم (لحساب ROAS تلقائياً)">
              <select
                className={inputClassName}
                value={campaignForm.couponId}
                onChange={(e) => setCampaignForm({ ...campaignForm, couponId: e.target.value })}
              >
                <option value="">— بدون كوبون —</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ البداية">
              <input
                type="date"
                className={inputClassName}
                value={campaignForm.startDate}
                onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="ملاحظات الحملة">
            <textarea
              rows={2}
              className={inputClassName}
              value={campaignForm.notesAr}
              onChange={(e) => setCampaignForm({ ...campaignForm, notesAr: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCampaignModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'جاري الحفظ...' : 'حفظ الحملة'}
            </Button>
          </div>
        </form>
      </NativeModal>
    </div>
  );
}
