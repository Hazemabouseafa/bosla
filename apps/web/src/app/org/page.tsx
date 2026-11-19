'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { BentoKpiCard } from '@/components/dashboard/DashboardWidgets';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export default function OrganizationPortalPage() {
  const { user, isLoading: loading, pushToast } = useAuth();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'members' | 'cohorts' | 'contracts'>('overview');
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkCohortId, setBulkCohortId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberDept, setNewMemberDept] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrgs = useCallback(async () => {
    if (!user) return;
    try {
      const [orgList, cat] = await Promise.all([
        apiFetch<any[]>('/organizations'),
        apiFetch<any>('/catalog/courses?limit=30'),
      ]);
      const list = Array.isArray(orgList) ? orgList : [];
      setOrgs(list);
      if (list.length > 0 && !selectedOrgId) {
        setSelectedOrgId(list[0].id);
      }
      setCourses(Array.isArray(cat?.items) ? cat.items : Array.isArray(cat) ? cat : []);
    } catch {
      setOrgs([]);
    }
  }, [user, selectedOrgId]);

  const loadDashboard = useCallback(async (orgId: string) => {
    if (!orgId) return;
    try {
      const res = await apiFetch<any>(`/organizations/${encodeURIComponent(orgId)}/dashboard`);
      setDashboard(res);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل لوحة المؤسسة', 'error');
    }
  }, [pushToast]);

  useEffect(() => {
    if (!loading && user) void loadOrgs();
  }, [loading, user, loadOrgs]);

  useEffect(() => {
    if (selectedOrgId) void loadDashboard(selectedOrgId);
  }, [selectedOrgId, loadDashboard]);

  const handleBulkEnroll = async () => {
    if (!selectedOrgId || !bulkCourseId || selectedMemberIds.length === 0) return;
    setBusy(true);
    try {
      const res = await apiFetch<any>(`/organizations/${encodeURIComponent(selectedOrgId)}/bulk-enroll`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: bulkCourseId,
          cohortId: bulkCohortId || null,
          userIds: selectedMemberIds,
        }),
      });
      pushToast(`تم تسجيل ${res.enrolledCount} متدرباً بنجاح`, 'success');
      setSelectedMemberIds([]);
      await loadDashboard(selectedOrgId);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التسجيل الجماعي', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newMemberUserId.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/organizations/${encodeURIComponent(selectedOrgId)}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: newMemberUserId.trim(),
          orgRole: 'LEARNER',
          departmentAr: newMemberDept.trim() || null,
        }),
      });
      pushToast('تمت إضافة المتدرب إلى مقاعد المؤسسة', 'success');
      setNewMemberUserId('');
      setNewMemberDept('');
      await loadDashboard(selectedOrgId);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إضافة العضو', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!loading && (!user || orgs.length === 0)) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-xl px-4 py-16">
          <Card className="p-8 text-center space-y-4">
            <Building2 className="mx-auto h-10 w-10 text-[#8CA2FF]" />
            <h1 className="text-2xl font-extrabold text-[#EEF0FF]">بوابة الشركات والمؤسسات (B2B)</h1>
            <p className="text-sm text-[#A9B1E0]">
              {!user
                ? 'سجّل دخولك بحساب مسؤول المؤسسة لمتابعة المقاعد والدفعات وتقارير أثر التدريب.'
                : 'حسابك غير مرتبط حالياً بدور مسؤول مؤسسة نشطة. تواصل مع إدارة بوصلة لتفعيل بوابة جهتك.'}
            </p>
            <div className="flex justify-center gap-3">
              {!user ? (
                <Link href="/login"><Button variant="primary">تسجيل الدخول</Button></Link>
              ) : (
                <Link href="/contact"><Button variant="primary">طلب اشتراك مؤسسي</Button></Link>
              )}
            </div>
          </Card>
        </section>
      </PublicPageLayout>
    );
  }

  const navItems: DashboardNavItem[] = [
    { id: 'overview', label: 'تقرير الأثر والمقاعد', icon: <LayoutDashboard className="h-4 w-4" />, active: tab === 'overview', onClick: () => setTab('overview') },
    { id: 'members', label: 'المتدربون والتسجيل الجماعي', icon: <Users className="h-4 w-4" />, active: tab === 'members', onClick: () => setTab('members'), badge: dashboard?.organization?.members?.length },
    { id: 'cohorts', label: 'الدفعات التدريبية', icon: <GraduationCap className="h-4 w-4" />, active: tab === 'cohorts', onClick: () => setTab('cohorts'), badge: dashboard?.organization?.cohorts?.length },
    { id: 'contracts', label: 'العقود وعروض الأسعار', icon: <FileText className="h-4 w-4" />, active: tab === 'contracts', onClick: () => setTab('contracts'), badge: dashboard?.organization?.contracts?.length },
  ];

  const impact = dashboard?.impactReport || {};
  const org = dashboard?.organization;

  return (
    <DashboardShell
      portalBadge="بوابة المؤسسات B2B"
      portalTitle={org?.nameAr || 'بوابة المؤسسة'}
      portalSubtitle="إدارة المقاعد والتدريب الجماعي ومتابعة تقدم فرق العمل"
      navItems={navItems}
      sidebarCtaLabel="العودة للأكاديمية"
      sidebarCtaHref="/"
    >
      <div className="space-y-6">
        {orgs.length > 1 && (
          <Card className="p-4 flex items-center gap-3">
            <span className="text-xs font-bold text-[#A9B1E0]">اختر المؤسسة:</span>
            <select
              className={inputClassName}
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.nameAr}</option>
              ))}
            </select>
          </Card>
        )}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <BentoKpiCard value={`${impact.usedSeats ?? 0} / ${impact.seatCapacity ?? 0}`} label="استهلاك المقاعد" delta={`متاح: ${impact.availableSeats ?? 0} مقعد`} icon={<Users className="h-5 w-5" />} />
              <BentoKpiCard value={`${impact.averageLessonProgressPercent ?? 0}%`} label="متوسط تقدم المتدربين" delta={`${impact.completedLessonsCount ?? 0} درس مكتمل`} deltaTone="info" icon={<GraduationCap className="h-5 w-5" />} />
              <BentoKpiCard value={impact.issuedCertificatesCount ?? 0} label="الشهادات الصادرة" delta="موثقة برمز QR" icon={<Award className="h-5 w-5" />} />
              <BentoKpiCard value={impact.attendanceBreakdown?.PRESENT ?? 0} label="سجلات الحضور المؤكدة" deltaTone="warning" icon={<Building2 className="h-5 w-5" />} />
            </div>

            {org && (
              <AlertBanner tone="info" title="بيانات العزل المؤسسي">
                هذه اللوحة مخصصة لبيانات ({org.nameAr}) فقط — لا يمكن الاطلاع على بيانات أي مؤسسة أخرى.
              </AlertBanner>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#8CA2FF]" /> إضافة متدرب إلى مقاعد المؤسسة
              </h3>
              <form onSubmit={handleAssignMember} className="grid gap-3 sm:grid-cols-3">
                <Field label="معرف المستخدم (User ID)">
                  <input dir="ltr" className={inputClassName} required value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)} />
                </Field>
                <Field label="القسم / الإدارة">
                  <input className={inputClassName} value={newMemberDept} onChange={(e) => setNewMemberDept(e.target.value)} placeholder="الإنتاج / الجودة" />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" disabled={busy}>إضافة للمؤسسة</Button>
                </div>
              </form>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3 justify-between">
                <div className="grid gap-3 sm:grid-cols-2 flex-1">
                  <Field label="تسجيل جماعي في كورس">
                    <select className={inputClassName} value={bulkCourseId} onChange={(e) => setBulkCourseId(e.target.value)}>
                      <option value="">اختر الكورس...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.titleAr || c.publishedVersion?.titleAr || c.slug}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ربط بدفعة تدريبية (اختياري)">
                    <select className={inputClassName} value={bulkCohortId} onChange={(e) => setBulkCohortId(e.target.value)}>
                      <option value="">بدون دفعة محددة</option>
                      {(org?.cohorts || []).map((co: any) => (
                        <option key={co.id} value={co.id}>{co.titleAr}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Button
                  variant="primary"
                  disabled={busy || !bulkCourseId || selectedMemberIds.length === 0}
                  onClick={handleBulkEnroll}
                >
                  تسجيل المحددين ({selectedMemberIds.length})
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                    <tr>
                      <th className="py-2 px-3">اختيار</th>
                      <th className="py-2 px-3">الاسم</th>
                      <th className="py-2 px-3">القسم</th>
                      <th className="py-2 px-3">الدور</th>
                      <th className="py-2 px-3">الكورسات</th>
                      <th className="py-2 px-3">الشهادات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#22307A]/60">
                    {(org?.members || []).map((m: any) => {
                      const checked = selectedMemberIds.includes(m.userId);
                      return (
                        <tr key={m.id}>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedMemberIds((prev) =>
                                  e.target.checked ? [...prev, m.userId] : prev.filter((id) => id !== m.userId),
                                );
                              }}
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#EEF0FF]">{m.user?.fullName}</td>
                          <td className="py-2.5 px-3 text-[#A9B1E0]">{m.departmentAr || '—'}</td>
                          <td className="py-2.5 px-3"><Badge tone={m.orgRole === 'ORG_ADMIN' ? 'purple' : 'info'}>{m.orgRole}</Badge></td>
                          <td className="py-2.5 px-3">{m.user?._count?.courseEnrollments ?? 0}</td>
                          <td className="py-2.5 px-3">{m.user?._count?.certificates ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === 'cohorts' && (
          <div className="grid gap-4 md:grid-cols-2">
            {(org?.cohorts || []).map((co: any) => (
              <Card key={co.id} className="p-5 space-y-2">
                <h3 className="font-extrabold text-[#EEF0FF]">{co.titleAr}</h3>
                <p className="text-xs text-[#8CA2FF]">{co.course?.publishedVersion?.titleAr || co.course?.slug}</p>
                <p className="text-xs text-[#A9B1E0]">
                  من {new Date(co.startsAt).toLocaleDateString('ar-EG')} إلى {new Date(co.endsAt).toLocaleDateString('ar-EG')}
                </p>
                <div className="flex gap-2 pt-1">
                  <Badge tone="info">المسجلون: {co._count?.enrollments ?? 0} / {co.maxSeats}</Badge>
                  <Badge tone="purple">الجلسات: {co._count?.sessions ?? 0}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'contracts' && (
          <div className="space-y-3">
            {(org?.contracts || []).map((ct: any) => (
              <Card key={ct.id} className="p-5 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p dir="ltr" className="text-xs font-mono text-[#8CA2FF]">{ct.contractNumber}</p>
                  <h3 className="font-extrabold text-[#EEF0FF]">{ct.titleAr}</h3>
                  <p className="text-xs text-[#A9B1E0]">خصم مؤسسي: {Number(ct.discountPercent)}% — القيمة: {Number(ct.quotationAmount).toLocaleString('ar-EG')} ج.م</p>
                </div>
                <Badge tone="success">{ct.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
