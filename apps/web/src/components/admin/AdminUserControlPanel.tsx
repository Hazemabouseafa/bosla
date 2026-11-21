'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CreditCard,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, formatDate, formatEgp } from '@/lib/api';
import {
  ALL_ASSIGNABLE_ROLES,
  getDefaultDashboardForUser,
  getIntervalLabel,
  getRoleBadgeTone,
  getRoleLabel,
  getUserStatusMeta,
} from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
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

export function AdminCreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('STUDENT');
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<'ACTIVE' | 'ENROLLMENT_PENDING'>('ACTIVE');
  const [headlineAr, setHeadlineAr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleCreateExtraRole = (rc: string) => {
    setExtraRoles((prev) =>
      prev.includes(rc) ? prev.filter((x) => x !== rc) : [...prev, rc],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          countryCode: '+20',
          email: email.trim() || undefined,
          password,
          role,
          extraRoles: extraRoles.filter((r) => r !== role),
          status,
          headlineAr: headlineAr.trim() || undefined,
        }),
      });
      pushToast('تم إنشاء الحساب وتعيين الأدوار ولوحة التحكم بنجاح', 'success');
      setFullName('');
      setPhoneNumber('');
      setEmail('');
      setPassword('');
      setExtraRoles([]);
      setHeadlineAr('');
      onClose();
      await onCreated();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الحساب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRoleMeta = ALL_ASSIGNABLE_ROLES.find((r) => r.code === role);

  return (
    <NativeModal open={open} onClose={onClose} title="إنشاء حساب مستخدم جديد وتخصيص الأدوار (RBAC)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="cu-name" label="الاسم الكامل" required>
            <input
              id="cu-name"
              className={inputClassName}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </Field>
          <Field id="cu-phone" label="رقم الهاتف المحمول" required>
            <input
              id="cu-phone"
              dir="ltr"
              className={inputClassName}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="01012345678"
              required
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="cu-role" label="الدور الأساسي (Primary Role)">
            <select
              id="cu-role"
              className={inputClassName}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ALL_ASSIGNABLE_ROLES.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cu-status" label="حالة الحساب">
            <select
              id="cu-status"
              className={inputClassName}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ACTIVE">مفعّل فوري</option>
              <option value="ENROLLMENT_PENDING">بانتظار التفعيل</option>
            </select>
          </Field>
          <Field id="cu-email" label="البريد (اختياري)">
            <input
              id="cu-email"
              type="email"
              dir="ltr"
              className={inputClassName}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        {selectedRoleMeta && (
          <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs space-y-1">
            <p className="font-extrabold text-[#8CA2FF]">
              لوحة التحكم المخصصة للدور: {selectedRoleMeta.portalLabel} ({selectedRoleMeta.portalHref})
            </p>
            <p className="text-[#A9B1E0]">{selectedRoleMeta.descriptionAr}</p>
          </div>
        )}

        <Field id="cu-extra-roles" label="أدوار إضافية متوافقة (Multi-Role RBAC — اختياري)">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-2.5">
            {ALL_ASSIGNABLE_ROLES.filter((r) => r.code !== role).map((r) => {
              const active = extraRoles.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => toggleCreateExtraRole(r.code)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? 'bg-[#7C95FF] text-[#070D2B] font-extrabold'
                      : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                  }`}
                >
                  {active ? '✓ ' : '+ '}{r.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field id="cu-head" label="التخصص أو المسمى الوظيفي">
          <input
            id="cu-head"
            className={inputClassName}
            value={headlineAr}
            onChange={(e) => setHeadlineAr(e.target.value)}
            placeholder="مثال: طبيب بيطري — مزارع التسمين"
          />
        </Field>

        <Field id="cu-pass" label="كلمة المرور (8 أحرف على الأقل)" required>
          <PasswordInput
            id="cu-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          <UserPlus className="h-4 w-4" />
          {submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
        </Button>
      </form>
    </NativeModal>
  );
}

/**
 * Full 360-degree Inline User Management Panel (No Popups):
 * Edit identity/role/status, reset password, revoke active sessions,
 * grant/extend/cancel subscriptions, grant direct course enrollment, and issue certificates.
 */
export function AdminUserDetailPanel({
  userId,
  currentAdminId,
  plans,
  courses,
  paths,
  diplomas,
  onClose,
  onGlobalRefresh,
}: {
  userId: string;
  currentAdminId?: string;
  plans: any[];
  courses: any[];
  paths: any[];
  diplomas: any[];
  onClose: () => void;
  onGlobalRefresh: () => Promise<void> | void;
}) {
  const { pushToast } = useAuth();
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable Profile State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<string>('STUDENT');
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<'ENROLLMENT_PENDING' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED'>('ACTIVE');
  const [headlineAr, setHeadlineAr] = useState('');
  const [bioAr, setBioAr] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Quick Overrides State
  const [grantPlanId, setGrantPlanId] = useState('');
  const [grantDays, setGrantDays] = useState('30');
  const [grantCourseId, setGrantCourseId] = useState('');
  const [certTargetType, setCertTargetType] = useState<'COURSE' | 'LEARNING_PATH' | 'DIPLOMA'>('COURSE');
  const [certTargetId, setCertTargetId] = useState('');

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/admin/users/${userId}/details`);
      setDetails(res);
      setFullName(res.fullName || '');
      setEmail(res.email || '');
      setPhoneNumber(res.phoneE164 || '');
      setRole(res.role || 'STUDENT');
      const assigned = Array.isArray(res.assignedUserRoles)
        ? res.assignedUserRoles.map((a: any) => a.role?.code).filter((c: any) => c && c !== res.role)
        : [];
      setExtraRoles(assigned);
      setStatus(res.status || 'ACTIVE');
      setHeadlineAr(res.headlineAr || '');
      setBioAr(res.bioAr || '');
      setNewPassword('');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل ملف المستخدم', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, pushToast]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (!grantPlanId && plans.length > 0) setGrantPlanId(plans[0].id);
    if (!grantCourseId && courses.length > 0) setGrantCourseId(courses[0].id);
  }, [plans, courses, grantPlanId, grantCourseId]);

  useEffect(() => {
    if (certTargetType === 'COURSE' && courses.length > 0) setCertTargetId(courses[0].id);
    else if (certTargetType === 'LEARNING_PATH' && paths.length > 0) setCertTargetId(paths[0].id);
    else if (certTargetType === 'DIPLOMA' && diplomas.length > 0) setCertTargetId(diplomas[0].id);
    else setCertTargetId('');
  }, [certTargetType, courses, paths, diplomas]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch(`/admin/users/${userId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          phoneNumber: phoneNumber.trim() || undefined,
          countryCode: '+20',
          role,
          extraRoles: extraRoles.filter((r) => r !== role),
          status,
          headlineAr: headlineAr.trim() || null,
          bioAr: bioAr.trim() || null,
          ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {}),
        }),
      });
      pushToast(
        newPassword.trim()
          ? 'تم تحديث البيانات وتعيين كلمة المرور الجديدة بنجاح'
          : 'تم تحديث بيانات الحساب بنجاح',
        'success',
      );
      await Promise.all([loadDetails(), onGlobalRefresh()]);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التعديلات', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRevokeSessions = async () => {
    try {
      const res = await apiFetch<{ revokedCount: number }>(
        `/admin/users/${userId}/revoke-sessions`,
        { method: 'POST' },
      );
      pushToast(`تم إنهاء ${res.revokedCount} جلسة نشطة بنجاح`, 'success');
      await loadDetails();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنهاء الجلسات', 'error');
    }
  };

  const handleGrantSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantPlanId) return;
    try {
      await apiFetch('/admin/subscriptions/grant', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          planId: grantPlanId,
          durationDays: Number(grantDays) || 30,
        }),
      });
      pushToast('تم منح الاشتراك وتفعيله للطالب فوراً', 'success');
      await Promise.all([loadDetails(), onGlobalRefresh()]);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر منح الاشتراك', 'error');
    }
  };

  const handleSubAction = async (
    subId: string,
    nextStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED',
    extendDays?: number,
  ) => {
    try {
      await apiFetch(`/admin/subscriptions/${subId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus, ...(extendDays ? { extendDays } : {}) }),
      });
      pushToast('تم تحديث حالة الاشتراك', 'success');
      await Promise.all([loadDetails(), onGlobalRefresh()]);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الاشتراك', 'error');
    }
  };

  const handleGrantEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantCourseId) return;
    try {
      await apiFetch('/admin/enrollments/grant', {
        method: 'POST',
        body: JSON.stringify({ userId, courseId: grantCourseId }),
      });
      pushToast('تم منح حق الوصول المباشر للكورس', 'success');
      await loadDetails();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر منح التسجيل', 'error');
    }
  };

  const handleRevokeEnrollment = async (courseId: string) => {
    try {
      await apiFetch(`/admin/enrollments/${userId}/${courseId}`, { method: 'DELETE' });
      pushToast('تم سحب التسجيل المباشر من الكورس', 'info');
      await loadDetails();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر السحب', 'error');
    }
  };

  const handleIssueCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certTargetId) return;
    try {
      await apiFetch('/admin/certificates/issue', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          targetType: certTargetType,
          courseId: certTargetType === 'COURSE' ? certTargetId : undefined,
          learningPathId: certTargetType === 'LEARNING_PATH' ? certTargetId : undefined,
          diplomaId: certTargetType === 'DIPLOMA' ? certTargetId : undefined,
        }),
      });
      pushToast('تم إصدار الشهادة وإضافتها لحساب المستخدم بنجاح', 'success');
      await Promise.all([loadDetails(), onGlobalRefresh()]);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إصدار الشهادة', 'error');
    }
  };

  if (loading || !details) {
    return (
      <Card className="p-8 text-center text-sm font-bold text-[#A9B1E0]">
        جاري تحميل ملف التحكم الشامل للحساب...
      </Card>
    );
  }

  const uMeta = getUserStatusMeta(details.status);
  const activeSessionsCount = (details.sessions || []).filter((s: any) => !s.revokedAt).length;

  return (
    <section aria-label="إدارة شاملة لحساب المستخدم" className="space-y-6">
      <Card className="p-5 border-[#8CA2FF]/40 bg-[#0F1A4A]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <ArrowRight className="h-4 w-4" />
              العودة لقائمة المستخدمين
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#EEF0FF]">{details.fullName}</h2>
                <Badge tone={getRoleBadgeTone(details.role)}>{getRoleLabel(details.role)}</Badge>
                {(details.assignedUserRoles || [])
                  .map((a: any) => a.role?.code)
                  .filter((c: any) => c && c !== details.role)
                  .map((c: string) => (
                    <Badge key={c} tone="info">+ {getRoleLabel(c)}</Badge>
                  ))}
                <Badge tone={uMeta.tone}>{uMeta.label}</Badge>
              </div>
              <p className="text-xs text-[#A9B1E0] mt-0.5">
                <span dir="ltr">{details.phoneE164 || details.email}</span> • الجلسات النشطة:{' '}
                {activeSessionsCount} • الدروس المنجزة: {details._count?.lessonProgress ?? 0} • الاختبارات:{' '}
                {details._count?.quizAttempts ?? 0}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => void loadDetails()}>
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
            {userId !== currentAdminId && (
              <Button variant="danger" size="sm" onClick={handleRevokeSessions}>
                <LogOut className="h-4 w-4" />
                تسجيل خروج قسري لكل الأجهزة ({activeSessionsCount})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {details.failedLoginAttempts > 0 && (
        <AlertBanner tone="warning">
          تم تسجيل {details.failedLoginAttempts} محاولات دخول فاشلة لهذا الحساب. يمكنك إعادة ضبطه بتفعيل الحالة أو تعيين كلمة مرور جديدة.
        </AlertBanner>
      )}

      <div className="grid gap-6 xl:grid-cols-12 items-start">
        {/* Column 1: Profile & Security Credentials */}
        <Card className="p-6 xl:col-span-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF] border-b border-[#22307A] pb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#8CA2FF]" />
            الهوية والأمان وكلمة المرور
          </h3>
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <Field id="ud-name" label="الاسم الكامل" required>
              <input
                id="ud-name"
                className={inputClassName}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ud-phone" label="رقم الهاتف">
                <input
                  id="ud-phone"
                  dir="ltr"
                  className={inputClassName}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </Field>
              <Field id="ud-email" label="البريد الإلكتروني">
                <input
                  id="ud-email"
                  type="email"
                  dir="ltr"
                  className={inputClassName}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ud-role" label="الدور الأساسي ولوحة التحكم">
                <select
                  id="ud-role"
                  className={inputClassName}
                  value={role}
                  disabled={userId === currentAdminId}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ALL_ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="ud-status" label="حالة الحساب">
                <select
                  id="ud-status"
                  className={inputClassName}
                  value={status}
                  disabled={userId === currentAdminId}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="ACTIVE">نشط</option>
                  <option value="ENROLLMENT_PENDING">بانتظار التفعيل</option>
                  <option value="LOCKED">مقفل مؤقتاً</option>
                  <option value="SUSPENDED">موقوف</option>
                </select>
              </Field>
            </div>

            {(() => {
              const dashInfo = getDefaultDashboardForUser({ role, roles: extraRoles });
              const roleMeta = ALL_ASSIGNABLE_ROLES.find((r) => r.code === role);
              return (
                <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs space-y-1">
                  <p className="font-extrabold text-[#8CA2FF]">
                    لوحة التحكم المعتمدة لهذا المستخدم: {dashInfo.label} ({dashInfo.href})
                  </p>
                  <p className="text-[#A9B1E0]">{roleMeta?.descriptionAr || dashInfo.portalSubtitleAr}</p>
                  {details.sellerAccount?.codes?.length > 0 && (
                    <p className="text-emerald-300 font-bold">
                      كود البائع الفعّال: {details.sellerAccount.codes.map((c: any) => c.code).join('، ')}
                    </p>
                  )}
                </div>
              );
            })()}

            <Field id="ud-extra-roles" label="الأدوار الإضافية المتوافقة (Multi-Role RBAC)">
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-2.5">
                {ALL_ASSIGNABLE_ROLES.filter((r) => r.code !== role).map((r) => {
                  const active = extraRoles.includes(r.code);
                  return (
                    <button
                      key={r.code}
                      type="button"
                      disabled={userId === currentAdminId}
                      onClick={() =>
                        setExtraRoles((prev) =>
                          prev.includes(r.code) ? prev.filter((x) => x !== r.code) : [...prev, r.code],
                        )
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-[#7C95FF] text-[#070D2B] font-extrabold'
                          : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:text-[#EEF0FF]'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{r.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field id="ud-head" label="المسمى الوظيفي / التخصص">
              <input
                id="ud-head"
                className={inputClassName}
                value={headlineAr}
                onChange={(e) => setHeadlineAr(e.target.value)}
              />
            </Field>
            <Field id="ud-bio" label="النبذة التعريفية">
              <textarea
                id="ud-bio"
                rows={2}
                className={inputClassName}
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
              />
            </Field>
            <Field
              id="ud-newpass"
              label="تعيين كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)"
            >
              <PasswordInput
                id="ud-newpass"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 أحرف على الأقل عند التغيير"
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={savingProfile}>
              <Save className="h-4 w-4" />
              {savingProfile ? 'جاري الحفظ...' : 'حفظ تعديلات الحساب والأمان'}
            </Button>
          </form>
        </Card>

        {/* Column 2: Subscriptions, Course Access & Certificates */}
        <div className="space-y-6 xl:col-span-6">
          {/* Subscriptions Control */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#8CA2FF]" />
              الاشتراكات والباقات ({details.subscriptions?.length ?? 0})
            </h3>

            <form onSubmit={handleGrantSubscription} className="grid gap-2.5 sm:grid-cols-12 items-end">
              <div className="sm:col-span-6">
                <Field id="gs-plan" label="منح اشتراك مجاني / يدوي">
                  <select
                    id="gs-plan"
                    className={inputClassName}
                    value={grantPlanId}
                    onChange={(e) => setGrantPlanId(e.target.value)}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr} ({getIntervalLabel(p.interval)} — {formatEgp(p.priceCents)})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field id="gs-days" label="المدة (أيام)">
                  <input
                    id="gs-days"
                    type="number"
                    min={1}
                    max={1825}
                    dir="ltr"
                    className={inputClassName}
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" variant="primary" size="sm" className="w-full">
                  <Plus className="h-4 w-4" />
                  منح الآن
                </Button>
              </div>
            </form>

            {(details.subscriptions || []).length > 0 && (
              <div className="space-y-2 text-xs">
                {details.subscriptions.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3"
                  >
                    <div>
                      <p className="font-extrabold text-[#EEF0FF]">{sub.plan?.nameAr}</p>
                      <p className="text-[#A9B1E0] tabular-nums">
                        ينتهي: {formatDate(sub.currentPeriodEnd)} •{' '}
                        <span className="font-bold">{sub.status}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSubAction(sub.id, 'ACTIVE', 30)}
                      >
                        تمديد +30 يوم
                      </Button>
                      {sub.status !== 'CANCELLED' && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => void handleSubAction(sub.id, 'CANCELLED')}
                        >
                          إلغاء
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Direct Course Enrollments */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#8CA2FF]" />
              الوصول المباشر للكورسات ({details.courseEnrollments?.length ?? 0})
            </h3>
            <form onSubmit={handleGrantEnrollment} className="flex flex-wrap gap-2">
              <select
                aria-label="اختيار كورس لمنح الوصول"
                className={`${inputClassName} flex-1 min-w-[200px]`}
                value={grantCourseId}
                onChange={(e) => setGrantCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                فتح الكورس للمستخدم
              </Button>
            </form>

            {(details.courseEnrollments || []).length > 0 && (
              <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                {details.courseEnrollments.map((enr: any) => (
                  <div
                    key={enr.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 py-2"
                  >
                    <div>
                      <p className="font-bold text-[#EEF0FF]">
                        {enr.course?.publishedVersion?.titleAr ||
                          enr.course?.draftVersion?.titleAr ||
                          enr.course?.slug}
                      </p>
                      <p className="text-[#A9B1E0]">المصدر: {enr.source}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevokeEnrollment(enr.courseId)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                      سحب
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Direct Certificate Issuance & Sessions */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <Award className="h-4 w-4 text-[#F5B94A]" />
              إصدار شهادة إتمام مباشرة ({details.certificates?.length ?? 0})
            </h3>
            <form onSubmit={handleIssueCert} className="grid gap-2 sm:grid-cols-12">
              <select
                aria-label="نوع الشهادة"
                className={`${inputClassName} sm:col-span-4`}
                value={certTargetType}
                onChange={(e) => setCertTargetType(e.target.value as any)}
              >
                <option value="COURSE">شهادة كورس</option>
                <option value="LEARNING_PATH">شهادة مسار</option>
                <option value="DIPLOMA">شهادة دبلومة</option>
              </select>
              <select
                aria-label="الجهة التعليمية للشهادة"
                className={`${inputClassName} sm:col-span-5`}
                value={certTargetId}
                onChange={(e) => setCertTargetId(e.target.value)}
              >
                {certTargetType === 'COURSE' &&
                  courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                    </option>
                  ))}
                {certTargetType === 'LEARNING_PATH' &&
                  paths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.titleAr}
                    </option>
                  ))}
                {certTargetType === 'DIPLOMA' &&
                  diplomas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.titleAr}
                    </option>
                  ))}
              </select>
              <Button type="submit" variant="gold" size="sm" className="sm:col-span-3">
                إصدار الشهادة
              </Button>
            </form>

            {(details.sessions || []).length > 0 && (
              <div className="pt-2 border-t border-[#22307A] space-y-2 text-xs">
                <p className="font-bold text-[#A9B1E0] flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#8CA2FF]" />
                  أحدث الجلسات ({details.sessions.length})
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {details.sessions.slice(0, 6).map((s: any) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#22307A] bg-[#0B1440] px-3 py-1.5"
                    >
                      <span dir="ltr" className="truncate max-w-[260px] text-[#A9B1E0]">
                        {s.ipAddress || 'IP غير مسجل'} •{' '}
                        {(s.userAgent || '').slice(0, 36)}
                      </span>
                      <Badge tone={s.revokedAt ? 'danger' : 'success'}>
                        {s.revokedAt ? 'منتهية' : 'نشطة'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
