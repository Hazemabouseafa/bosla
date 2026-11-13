'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  BookCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  HardDrive,
  Layers,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiFetch, editorialStatusLabelAr, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  PasswordInput,
  inputClassName,
} from '@/components/ui/primitives';

type AdminTab =
  | 'overview'
  | 'editorial'
  | 'users'
  | 'paths_diplomas'
  | 'memberships'
  | 'security_certs'
  | 'cms_leads';

export default function AdminControlCenterPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<any | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [diplomas, setDiplomas] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<any[]>([]);
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Editorial review state
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});

  // Create instructor modal
  const [instModalOpen, setInstModalOpen] = useState(false);
  const [instName, setInstName] = useState('');
  const [instPhone, setInstPhone] = useState('');
  const [instEmail, setInstEmail] = useState('');
  const [instPassword, setInstPassword] = useState('');
  const [instHeadline, setInstHeadline] = useState('');

  // New Category form
  const [catSlug, setCatSlug] = useState('');
  const [catName, setCatName] = useState('');

  // New Learning Path form
  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [pathTitle, setPathTitle] = useState('');
  const [pathSlug, setPathSlug] = useState('');
  const [pathDesc, setPathDesc] = useState('');
  const [pathCourseIds, setPathCourseIds] = useState<string[]>([]);

  // New Diploma form
  const [dipModalOpen, setDipModalOpen] = useState(false);
  const [dipTitle, setDipTitle] = useState('');
  const [dipSlug, setDipSlug] = useState('');
  const [dipDesc, setDipDesc] = useState('');
  const [dipHours, setDipHours] = useState(140);
  const [dipCourseIds, setDipCourseIds] = useState<string[]>([]);

  // Plan edit modal
  const [planEdit, setPlanEdit] = useState<any | null>(null);
  const [planPriceEgp, setPlanPriceEgp] = useState(0);
  const [planCourseIds, setPlanCourseIds] = useState<string[]>([]);
  const [planPathIds, setPlanPathIds] = useState<string[]>([]);
  const [planDiplomaIds, setPlanDiplomaIds] = useState<string[]>([]);

  const loadEverything = useCallback(async () => {
    setLoading(true);
    try {
      const [
        ov,
        q,
        coursesRes,
        usersRes,
        cats,
        pathsRes,
        diplomasRes,
        subsRes,
        plansRes,
        payRes,
        certsRes,
        recRes,
        cmsRes,
        leadsRes,
        auditRes,
      ] = await Promise.all([
        apiFetch<any>('/admin/overview'),
        apiFetch<any[]>('/admin/editorial/queue'),
        apiFetch<any[]>('/admin/courses'),
        apiFetch<any[]>('/admin/users'),
        apiFetch<any[]>('/admin/categories'),
        apiFetch<any[]>('/admin/learning-paths'),
        apiFetch<any[]>('/admin/diplomas'),
        apiFetch<any[]>('/admin/diplomas/submissions'),
        apiFetch<any[]>('/admin/membership-plans'),
        apiFetch<any>('/admin/payments'),
        apiFetch<any[]>('/admin/certificates'),
        apiFetch<any[]>('/admin/support-recovery'),
        apiFetch<any[]>('/admin/cms/pages'),
        apiFetch<any[]>('/admin/leads'),
        apiFetch<any[]>('/admin/audit-logs?limit=40'),
      ]);
      setOverview(ov);
      setQueue(q);
      setAllCourses(coursesRes);
      setUsers(usersRes);
      setCategories(cats);
      setPaths(pathsRes);
      setDiplomas(diplomasRes);
      setSubmissions(subsRes);
      setPlans(plansRes);
      setPaymentsData(payRes);
      setCertificates(certsRes);
      setRecoveryRequests(recRes);
      setCmsPages(cmsRes);
      setLeads(leadsRes);
      setAuditLogs(auditRes);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل لوحة التحكم الإدارية', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/admin');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace(user.role === 'INSTRUCTOR' ? '/instructor' : '/student');
      return;
    }
    void loadEverything();
  }, [authLoading, user, router, loadEverything]);

  const handleReview = async (
    versionId: string,
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT',
  ) => {
    const comment =
      reviewComments[versionId]?.trim() ||
      (decision === 'APPROVE' ? 'معتمد للنشر وفق معايير بوصلة' : 'يرجى استكمال المراجعة');
    try {
      await apiFetch(`/admin/editorial/versions/${versionId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      });
      pushToast('تم تسجيل قرار المراجعة الإدارية', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ القرار', 'error');
    }
  };

  const handlePublish = async (versionId: string) => {
    try {
      await apiFetch(`/admin/editorial/versions/${versionId}/publish`, {
        method: 'POST',
      });
      pushToast('تم نشر الكورس للطلاب بنجاح!', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر النشر (تأكد من اعتماده أولاً)', 'error');
    }
  };

  const handleUnpublish = async (courseId: string) => {
    try {
      await apiFetch(`/admin/editorial/courses/${courseId}/unpublish`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'إلغاء نشر من لوحة الإدارة' }),
      });
      pushToast('تم إلغاء نشر الكورس', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إلغاء النشر', 'error');
    }
  };

  const handleSchedule = async (courseId: string) => {
    const dt = scheduleTimes[courseId];
    if (!dt) {
      pushToast('اختر تاريخاً ووقتاً مستقبلياً أولاً', 'error');
      return;
    }
    try {
      await apiFetch(`/admin/editorial/courses/${courseId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledPublishAt: new Date(dt).toISOString() }),
      });
      pushToast('تم جدولة النشر بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الجدولة', 'error');
    }
  };

  const handleUserRoleChange = async (
    targetUserId: string,
    role: string,
    status: string,
  ) => {
    try {
      await apiFetch(`/admin/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, status }),
      });
      pushToast('تم تحديث صلاحيات وحالة المستخدم', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التحديث', 'error');
    }
  };

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/instructors', {
        method: 'POST',
        body: JSON.stringify({
          fullName: instName,
          phoneNumber: instPhone,
          countryCode: '+20',
          email: instEmail.trim() || undefined,
          password: instPassword,
          headlineAr: instHeadline,
          activateImmediately: true,
        }),
      });
      pushToast('تم إنشاء حساب المدرب وتفعيله بنجاح', 'success');
      setInstModalOpen(false);
      setInstName('');
      setInstPhone('');
      setInstEmail('');
      setInstPassword('');
      setInstHeadline('');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء المدرب', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ slug: catSlug, nameAr: catName }),
      });
      setCatSlug('');
      setCatName('');
      pushToast('تم حفظ القسم بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الحفظ', 'error');
    }
  };

  const handleCreatePath = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/learning-paths', {
        method: 'POST',
        body: JSON.stringify({
          slug: pathSlug,
          titleAr: pathTitle,
          descriptionAr: pathDesc,
          courseLinks: pathCourseIds.map((courseId, idx) => ({
            courseId,
            sortOrder: idx,
            isRequired: true,
          })),
        }),
      });
      setPathModalOpen(false);
      setPathTitle('');
      setPathSlug('');
      setPathDesc('');
      setPathCourseIds([]);
      pushToast('تم إنشاء المسار التعليمي من الكورسات المختارة', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء المسار', 'error');
    }
  };

  const handleCreateDiploma = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/diplomas', {
        method: 'POST',
        body: JSON.stringify({
          slug: dipSlug,
          titleAr: dipTitle,
          descriptionAr: dipDesc,
          totalHours: Number(dipHours),
          courseLinks: dipCourseIds.map((courseId, idx) => ({
            courseId,
            sortOrder: idx,
            isRequired: true,
          })),
        }),
      });
      setDipModalOpen(false);
      setDipTitle('');
      setDipSlug('');
      setDipDesc('');
      setDipCourseIds([]);
      pushToast('تم إنشاء الدبلومة بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الدبلومة', 'error');
    }
  };

  const openPlanEditor = (plan: any) => {
    const rev = plan.revisions?.[0];
    setPlanEdit(plan);
    setPlanPriceEgp(Math.round((plan.priceCents || 0) / 100));
    setPlanCourseIds((rev?.courses ?? []).map((c: any) => c.courseId));
    setPlanPathIds((rev?.learningPaths ?? []).map((p: any) => p.learningPathId));
    setPlanDiplomaIds((rev?.diplomas ?? []).map((d: any) => d.diplomaId));
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planEdit) return;
    try {
      await apiFetch(`/admin/membership-plans/${planEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          slug: planEdit.slug,
          interval: planEdit.interval,
          nameAr: planEdit.nameAr,
          descriptionAr: planEdit.descriptionAr,
          priceCents: Number(planPriceEgp) * 100,
          isActive: planEdit.isActive,
          isVisible: planEdit.isVisible,
          sortOrder: planEdit.sortOrder,
          courseIds: planCourseIds,
          learningPathIds: planPathIds,
          diplomaIds: planDiplomaIds,
          notesAr: 'تحديث من لوحة الإدارة',
        }),
      });
      pushToast('تم تحديث سعر ومحتوى العضوية بنسخة جديدة', 'success');
      setPlanEdit(null);
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الخطة', 'error');
    }
  };

  const handleResolveRecovery = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await apiFetch<any>(`/admin/support-recovery/${requestId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          resolutionNotes: status === 'APPROVED' ? 'تم التحقق وإصدار رمز تعيين' : 'بيانات غير كافية',
        }),
      });
      if (res.supportResetToken) {
        await navigator.clipboard?.writeText(res.supportResetToken).catch(() => {});
        pushToast(`تمت الموافقة! رمز الاسترداد: ${res.supportResetToken}`, 'success');
      } else {
        pushToast('تم تحديث حالة طلب الاسترداد', 'info');
      }
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر المعالجة', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل لوحة التحكم الإدارية...
        </div>
      </PublicPageLayout>
    );
  }

  const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'نظرة عامة والبنية', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'editorial', label: `مراجعة الكورسات (${queue.length})`, icon: <BookCheck className="h-4 w-4" /> },
    { id: 'users', label: `المستخدمون (${users.length})`, icon: <Users className="h-4 w-4" /> },
    { id: 'paths_diplomas', label: 'المسارات والدبلومات', icon: <Layers className="h-4 w-4" /> },
    { id: 'memberships', label: 'العضويات وPaymob', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'security_certs', label: 'الشهادات والاسترداد', icon: <Award className="h-4 w-4" /> },
    { id: 'cms_leads', label: 'المحتوى والعملاء والسجل', icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="warning">لوحة الإدارة والتحكم الشامل</Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              مركز إدارة أكاديمية بوصلة
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadEverything()}>
            <RefreshCw className="h-4 w-4" />
            تحديث جميع البيانات
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-bosla-line pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-bosla-navy text-white'
                  : 'border border-bosla-line bg-white text-bosla-ink hover:border-bosla-primary'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: OVERVIEW */}
        {tab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <p className="text-xs font-bold text-bosla-muted">الإيرادات المؤكدة (Paymob)</p>
                <p className="mt-2 text-2xl font-extrabold text-bosla-success">
                  {formatEgp(overview.revenue?.totalPaidCents ?? 0)}
                </p>
                <p className="text-xs text-bosla-muted mt-1">
                  {overview.revenue?.paidCount ?? 0} عملية مدفوعة • {overview.activeSubscriptions} اشتراك نشط
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-bold text-bosla-muted">قائمة الانتظار التحريرية</p>
                <p className="mt-2 text-2xl font-extrabold text-bosla-amber">
                  {overview.queues?.pendingEditorialReviews ?? 0}
                </p>
                <p className="text-xs text-bosla-muted mt-1">
                  كورسات بانتظار المراجعة والنشر
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-bold text-bosla-muted">المستخدمون والمدربون</p>
                <p className="mt-2 text-2xl font-extrabold text-bosla-navy">
                  {(overview.usersByRole?.STUDENT ?? 0) +
                    (overview.usersByRole?.INSTRUCTOR ?? 0) +
                    (overview.usersByRole?.ADMIN ?? 0)}
                </p>
                <p className="text-xs text-bosla-muted mt-1">
                  طلاب: {overview.usersByRole?.STUDENT ?? 0} • مدربون:{' '}
                  {overview.usersByRole?.INSTRUCTOR ?? 0}
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-bold text-bosla-muted">الشهادات وخدمة العملاء</p>
                <p className="mt-2 text-2xl font-extrabold text-bosla-primary">
                  {overview.certificatesIssued ?? 0} شهادة
                </p>
                <p className="text-xs text-bosla-muted mt-1">
                  طلبات استرداد معلقة: {overview.queues?.pendingSupportRecoveries ?? 0} • عملاء جدد:{' '}
                  {overview.queues?.newLeads ?? 0}
                </p>
              </Card>
            </div>

            {overview.infrastructure && (
              <Card className="p-6 space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
                  <HardDrive className="h-5 w-5 text-bosla-primary" />
                  صحة تخزين الفيديو المحلي وطابور التحويل FFmpeg HLS
                </h2>
                <div className="grid gap-4 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-bosla-line p-3">
                    <p className="text-bosla-muted">حالة الفيديوهات</p>
                    <p className="mt-1 font-extrabold text-bosla-navy">
                      {JSON.stringify(overview.infrastructure.videoStatusCounts ?? {})}
                    </p>
                  </div>
                  <div className="rounded-xl border border-bosla-line p-3">
                    <p className="text-bosla-muted">المساحة الحرة على القرص</p>
                    <p className="mt-1 font-extrabold text-bosla-success">
                      {overview.infrastructure.disk?.freeBytes
                        ? `${(overview.infrastructure.disk.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`
                        : 'متاحة'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-bosla-line p-3">
                    <p className="text-bosla-muted">إجمالي البث المقدم</p>
                    <p className="mt-1 font-extrabold text-bosla-ink">
                      {Math.round((overview.infrastructure.totalBytesServed ?? 0) / 1024)} KB
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB: EDITORIAL & PUBLISHING */}
        {tab === 'editorial' && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold text-bosla-ink">
              طابور المراجعة والنشر التحريري ({queue.length})
            </h2>
            {queue.length === 0 ? (
              <AlertBanner tone="info">لا توجد مراجعات معلقة حالياً في الطابور.</AlertBanner>
            ) : (
              <div className="space-y-4">
                {queue.map((ver) => {
                  const st = editorialStatusLabelAr(ver.status);
                  return (
                    <Card key={ver.id} className="p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge tone={st.tone}>{st.label}</Badge>
                            <span className="text-xs font-bold text-bosla-muted">
                              النسخة v{ver.versionNumber} • المدرب: {ver.course?.instructor?.fullName}
                            </span>
                          </div>
                          <h3 className="mt-1 text-lg font-extrabold text-bosla-ink">
                            {ver.titleAr}
                          </h3>
                        </div>
                        <span dir="ltr" className="font-mono text-xs text-bosla-muted">
                          /{ver.course?.slug}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className={inputClassName}
                          placeholder="تعليق المراجعة الإدارية (مطلوب عند طلب التعديلات/الرفض)"
                          value={reviewComments[ver.id] || ''}
                          onChange={(e) =>
                            setReviewComments((prev) => ({
                              ...prev,
                              [ver.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleReview(ver.id, 'APPROVE')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            اعتماد (Approve)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(ver.id, 'REQUEST_CHANGES')}
                          >
                            طلب تعديلات
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReview(ver.id, 'REJECT')}
                          >
                            رفض
                          </Button>
                          {ver.status === 'APPROVED' && (
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={() => handlePublish(ver.id)}
                            >
                              نشر فوري للطلاب
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <h2 className="text-xl font-extrabold text-bosla-ink pt-4">
              جميع الكورسات وجدولة / إلغاء النشر ({allCourses.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {allCourses.map((c) => (
                <Card key={c.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-bosla-ink">
                      {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                    </h3>
                    <Badge tone={editorialStatusLabelAr(c.status).tone}>
                      {editorialStatusLabelAr(c.status).label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      className={`${inputClassName} w-52 text-xs`}
                      value={scheduleTimes[c.id] || ''}
                      onChange={(e) =>
                        setScheduleTimes((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSchedule(c.id)}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      جدولة النشر
                    </Button>
                    {c.status === 'PUBLISHED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnpublish(c.id)}
                      >
                        إيقاف النشر
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB: USERS & INSTRUCTORS */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-bosla-ink">
                إدارة الحسابات والأدوار
              </h2>
              <Button variant="primary" size="sm" onClick={() => setInstModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                إضافة مدرب جديد
              </Button>
            </div>
            <Card className="overflow-x-auto p-4">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-bosla-line text-bosla-muted">
                    <th className="py-2 px-3">الاسم</th>
                    <th className="py-2 px-3">الموبايل / البريد</th>
                    <th className="py-2 px-3">الدور</th>
                    <th className="py-2 px-3">الحالة</th>
                    <th className="py-2 px-3">تعديل سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bosla-line">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-3 font-bold text-bosla-ink">{u.fullName}</td>
                      <td className="py-3 px-3" dir="ltr">
                        {u.phoneE164 || u.email || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge tone="info">{u.role}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge tone={u.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 flex flex-wrap gap-1.5">
                        {u.role !== 'INSTRUCTOR' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserRoleChange(u.id, 'INSTRUCTOR', 'ACTIVE')}
                          >
                            ترقية لمدرب
                          </Button>
                        )}
                        {u.status !== 'SUSPENDED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUserRoleChange(u.id, u.role, 'SUSPENDED')}
                          >
                            تعليق
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserRoleChange(u.id, u.role, 'ACTIVE')}
                          >
                            تنشيط
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* TAB: LEARNING PATHS, DIPLOMAS, CATEGORIES & GRADING */}
        {tab === 'paths_diplomas' && (
          <div className="space-y-8">
            {/* Categories */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">الأقسام والتخصصات</h2>
              <form onSubmit={handleCreateCategory} className="flex flex-wrap gap-3">
                <input
                  className={`${inputClassName} w-52`}
                  placeholder="الاسم بالعربية"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
                <input
                  dir="ltr"
                  className={`${inputClassName} w-44`}
                  placeholder="slug-in-english"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" size="sm">
                  إضافة قسم
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat.id} tone="info">
                    {cat.nameAr} ({cat._count?.courses ?? 0})
                  </Badge>
                ))}
              </div>
            </Card>

            {/* Learning Paths */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-bosla-ink">
                  المسارات التعليمية (إعادة استخدام الكورسات)
                </h2>
                <Button variant="primary" size="sm" onClick={() => setPathModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  إنشاء مسار تعلم
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {paths.map((p) => (
                  <Card key={p.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-bosla-ink">{p.titleAr}</h3>
                      <Badge tone={editorialStatusLabelAr(p.status).tone}>{p.status}</Badge>
                    </div>
                    <p className="text-xs text-bosla-muted">
                      يضم {p.courses?.length ?? 0} كورسات
                    </p>
                    <div className="flex gap-2">
                      {p.status !== 'PUBLISHED' && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() =>
                            apiFetch(`/admin/learning-paths/${p.id}/status`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'PUBLISHED' }),
                            }).then(loadEverything)
                          }
                        >
                          نشر المسار
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Diplomas & Submissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-bosla-ink flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-bosla-amber" />
                  الدبلومات التطبيقية وتقييم المشاريع
                </h2>
                <Button variant="gold" size="sm" onClick={() => setDipModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  إنشاء دبلومة جديدة
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {diplomas.map((d) => (
                  <Card key={d.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-bosla-ink">
                        {d.titleAr} ({d.totalHours} س)
                      </h3>
                      <Badge tone={editorialStatusLabelAr(d.status).tone}>{d.status}</Badge>
                    </div>
                    {d.status !== 'PUBLISHED' && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() =>
                          apiFetch(`/admin/diplomas/${d.id}/status`, {
                            method: 'POST',
                            body: JSON.stringify({ status: 'PUBLISHED' }),
                          }).then(loadEverything)
                        }
                      >
                        نشر الدبلومة
                      </Button>
                    )}
                  </Card>
                ))}
              </div>

              {submissions.length > 0 && (
                <Card className="p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-bosla-ink">
                    تسليمات مشاريع الدبلومات ({submissions.length})
                  </h3>
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 text-xs"
                    >
                      <div>
                        <p className="font-extrabold">
                          {sub.user?.fullName} — {sub.assessment?.diploma?.titleAr}
                        </p>
                        <p className="text-bosla-muted mt-1">{sub.submissionText}</p>
                      </div>
                      {sub.scorePercent !== null ? (
                        <Badge tone={sub.passed ? 'success' : 'danger'}>
                          النتيجة: {sub.scorePercent}%
                        </Badge>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            apiFetch(`/admin/diplomas/submissions/${sub.id}/grade`, {
                              method: 'POST',
                              body: JSON.stringify({
                                scorePercent: 90,
                                feedbackAr: 'عمل ممتاز واجتياز ناجح',
                              }),
                            }).then(loadEverything)
                          }
                        >
                          تقييم واعتماد (90%)
                        </Button>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB: MEMBERSHIPS & PAYMOB */}
        {tab === 'memberships' && (
          <div className="space-y-6">
            <h2 className="text-xl font-extrabold text-bosla-ink">
              خطط العضوية والمحتوى المشمول
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((p) => (
                <Card key={p.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-bosla-ink">{p.nameAr}</h3>
                    <Badge tone="info">{p.interval}</Badge>
                  </div>
                  <p className="text-2xl font-extrabold text-bosla-navy">
                    {formatEgp(p.priceCents)}
                  </p>
                  <p className="text-xs text-bosla-muted">
                    المشتركون: {p._count?.subscriptions ?? 0}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => openPlanEditor(p)}>
                    تعديل السعر والمحتوى المشمول
                  </Button>
                </Card>
              ))}
            </div>

            {paymentsData && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-extrabold text-bosla-ink">
                  أحدث المعاملات وسجل Webhooks من Paymob
                </h3>
                <div className="space-y-2 text-xs">
                  {(paymentsData.payments ?? []).slice(0, 10).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between rounded-xl border border-bosla-line p-3"
                    >
                      <span>
                        <strong>{tx.user?.fullName}</strong> — {tx.plan?.nameAr} (
                        <code dir="ltr">{tx.merchantOrderId}</code>)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatEgp(tx.amountCents)}</span>
                        <Badge tone={tx.status === 'PAID' ? 'success' : 'warning'}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB: CERTIFICATES & SUPPORT RECOVERY */}
        {tab === 'security_certs' && (
          <div className="space-y-8">
            <Card className="p-6 space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                طلبات مساعدة استرداد الحساب (بدون OTP) ({recoveryRequests.length})
              </h2>
              {recoveryRequests.length === 0 ? (
                <p className="text-xs text-bosla-muted">لا توجد طلبات استرداد معلقة.</p>
              ) : (
                <div className="space-y-3">
                  {recoveryRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-4 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-bosla-ink">
                          {req.fullName} — <span dir="ltr">{req.phoneE164}</span>
                        </p>
                        <p className="text-bosla-muted mt-1">{req.notes}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={req.status === 'PENDING' ? 'warning' : 'success'}>
                          {req.status}
                        </Badge>
                        {req.status === 'PENDING' && (
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleResolveRecovery(req.id, 'APPROVED')}
                            >
                              اعتماد وإصدار رمز تعيين
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleResolveRecovery(req.id, 'REJECTED')}
                            >
                              رفض
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                الشهادات الصادرة ({certificates.length})
              </h2>
              <div className="space-y-2 text-xs">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex flex-wrap items-center justify-between rounded-xl border border-bosla-line p-3"
                  >
                    <div>
                      <p className="font-extrabold">{cert.recipientNameAr}</p>
                      <p className="text-bosla-muted">
                        {cert.titleAr} • <code dir="ltr">{cert.certificateCode}</code>
                      </p>
                    </div>
                    {cert.revokedAt ? (
                      <Badge tone="danger">ملغاة</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          apiFetch(`/admin/certificates/${cert.id}/revoke`, {
                            method: 'POST',
                          }).then(loadEverything)
                        }
                      >
                        إلغاء الشهادة
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: CMS, LEADS & AUDIT LOGS */}
        {tab === 'cms_leads' && (
          <div className="space-y-8">
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                صفحات إدارة المحتوى CMS ({cmsPages.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                {cmsPages.map((pg) => (
                  <div key={pg.id} className="rounded-xl border border-bosla-line p-3">
                    <p className="font-extrabold text-bosla-ink">{pg.titleAr}</p>
                    <p dir="ltr" className="font-mono text-bosla-muted mt-1">
                      /{pg.slug}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                طلبات الشركات B2B والاستشارات ({leads.length})
              </h2>
              <div className="space-y-2 text-xs">
                {leads.map((ld) => (
                  <div
                    key={ld.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bosla-line p-3"
                  >
                    <div>
                      <p className="font-extrabold text-bosla-ink">
                        {ld.fullName} {ld.companyName ? `(${ld.companyName})` : ''}
                      </p>
                      <p className="text-bosla-muted">
                        <span dir="ltr">{ld.phoneE164}</span> • النوع: {ld.type} • النقاط:{' '}
                        {ld.leadScore ?? '—'}
                      </p>
                    </div>
                    <Badge tone={ld.status === 'NEW' ? 'warning' : 'success'}>
                      {ld.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                سجل التدقيق والأحداث الأمنية ({auditLogs.length})
              </h2>
              <div className="space-y-1.5 max-h-96 overflow-y-auto text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between border-b border-bosla-line py-2"
                  >
                    <span>
                      <code className="font-bold text-bosla-primary">{log.action}</code> •{' '}
                      {log.actor?.fullName || 'النظام'} ({log.entityType})
                    </span>
                    <span className="text-bosla-muted">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Create Instructor Modal */}
        <NativeModal
          open={instModalOpen}
          onClose={() => setInstModalOpen(false)}
          title="إنشاء حساب مدرب جديد"
        >
          <form onSubmit={handleCreateInstructor} className="space-y-4">
            <Field id="ai-name" label="الاسم الكامل" required>
              <input
                id="ai-name"
                className={inputClassName}
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ai-phone" label="الموبايل (مصر)" required>
                <input
                  id="ai-phone"
                  dir="ltr"
                  className={inputClassName}
                  value={instPhone}
                  onChange={(e) => setInstPhone(e.target.value)}
                  placeholder="01012345678"
                  required
                />
              </Field>
              <Field id="ai-email" label="البريد الإلكتروني">
                <input
                  id="ai-email"
                  type="email"
                  dir="ltr"
                  className={inputClassName}
                  value={instEmail}
                  onChange={(e) => setInstEmail(e.target.value)}
                />
              </Field>
            </div>
            <Field id="ai-head" label="التخصص / المسمى الوظيفي">
              <input
                id="ai-head"
                className={inputClassName}
                value={instHeadline}
                onChange={(e) => setInstHeadline(e.target.value)}
              />
            </Field>
            <Field id="ai-pass" label="كلمة المرور المؤقتة" required>
              <PasswordInput
                id="ai-pass"
                value={instPassword}
                onChange={(e) => setInstPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              إنشاء حساب المدرب
            </Button>
          </form>
        </NativeModal>

        {/* Create Path Modal */}
        <NativeModal
          open={pathModalOpen}
          onClose={() => setPathModalOpen(false)}
          title="إنشاء مسار تعليمي من كورسات الأكاديمية"
        >
          <form onSubmit={handleCreatePath} className="space-y-4">
            <Field id="ap-title" label="اسم المسار" required>
              <input
                id="ap-title"
                className={inputClassName}
                value={pathTitle}
                onChange={(e) => setPathTitle(e.target.value)}
                required
              />
            </Field>
            <Field id="ap-slug" label="Slug (إنجليزي)" required>
              <input
                id="ap-slug"
                dir="ltr"
                className={inputClassName}
                value={pathSlug}
                onChange={(e) => setPathSlug(e.target.value)}
                required
              />
            </Field>
            <Field id="ap-desc" label="الوصف" required>
              <textarea
                id="ap-desc"
                rows={2}
                className={inputClassName}
                value={pathDesc}
                onChange={(e) => setPathDesc(e.target.value)}
                required
              />
            </Field>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-bosla-line rounded-xl p-3 text-xs">
              <p className="font-bold text-bosla-ink">اختر الكورسات المكونة للمسار:</p>
              {allCourses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pathCourseIds.includes(c.id)}
                    onChange={(e) =>
                      setPathCourseIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span>{c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}</span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="primary" className="w-full">
              حفظ المسار التعليمي
            </Button>
          </form>
        </NativeModal>

        {/* Create Diploma Modal */}
        <NativeModal
          open={dipModalOpen}
          onClose={() => setDipModalOpen(false)}
          title="إنشاء دبلومة تطبيقية جديدة"
        >
          <form onSubmit={handleCreateDiploma} className="space-y-4">
            <Field id="ad-title" label="عنوان الدبلومة" required>
              <input
                id="ad-title"
                className={inputClassName}
                value={dipTitle}
                onChange={(e) => setDipTitle(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ad-slug" label="Slug" required>
                <input
                  id="ad-slug"
                  dir="ltr"
                  className={inputClassName}
                  value={dipSlug}
                  onChange={(e) => setDipSlug(e.target.value)}
                  required
                />
              </Field>
              <Field id="ad-hrs" label="عدد الساعات">
                <input
                  id="ad-hrs"
                  type="number"
                  className={inputClassName}
                  value={dipHours}
                  onChange={(e) => setDipHours(Number(e.target.value))}
                />
              </Field>
            </div>
            <Field id="ad-desc" label="الوصف" required>
              <textarea
                id="ad-desc"
                rows={2}
                className={inputClassName}
                value={dipDesc}
                onChange={(e) => setDipDesc(e.target.value)}
                required
              />
            </Field>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-bosla-line rounded-xl p-3 text-xs">
              <p className="font-bold text-bosla-ink">الكورسات المكونة للدبلومة:</p>
              {allCourses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dipCourseIds.includes(c.id)}
                    onChange={(e) =>
                      setDipCourseIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span>{c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}</span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="gold" className="w-full">
              حفظ الدبلومة
            </Button>
          </form>
        </NativeModal>

        {/* Edit Membership Plan Modal */}
        <NativeModal
          open={Boolean(planEdit)}
          onClose={() => setPlanEdit(null)}
          title={planEdit ? `تعديل خطة: ${planEdit.nameAr}` : 'تعديل الخطة'}
        >
          {planEdit && (
            <form onSubmit={handleSavePlan} className="space-y-4">
              <Field id="pl-price" label="السعر بالجنيه المصري (EGP)" required>
                <input
                  id="pl-price"
                  type="number"
                  className={inputClassName}
                  value={planPriceEgp}
                  onChange={(e) => setPlanPriceEgp(Number(e.target.value))}
                  required
                />
              </Field>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-bosla-line rounded-xl p-3 text-xs">
                <p className="font-bold">الكورسات المشمولة في الخطة:</p>
                {allCourses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planCourseIds.includes(c.id)}
                      onChange={(e) =>
                        setPlanCourseIds((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span>{c.publishedVersion?.titleAr || c.slug}</span>
                  </label>
                ))}
              </div>
              <Button type="submit" variant="primary" className="w-full">
                حفظ التغييرات وإصدار نسخة خطة جديدة
              </Button>
            </form>
          )}
        </NativeModal>
      </section>
    </PublicPageLayout>
  );
}
