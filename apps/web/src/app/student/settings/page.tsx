'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import {
  Bell,
  BookOpen,
  Compass,
  Copy,
  Fingerprint,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
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

export default function StudentSettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, refreshSession, pushToast } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [headlineAr, setHeadlineAr] = useState('');
  const [bioAr, setBioAr] = useState('');

  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<{
    notifyOnNewStudentQuestion: boolean;
    notifyOnInstructorReply: boolean;
    notifyOnDiscussionReply: boolean;
    notifyOnAcceptedAnswer: boolean;
  } | null>(null);

  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPass, setReauthPass] = useState('');
  const [recentlyReauthed, setRecentlyReauthed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSecurityData = async () => {
    try {
      const [pks, prefs] = await Promise.all([
        apiFetch<any[]>('/auth/passkeys'),
        apiFetch<any>('/notifications/preferences').catch(() => null),
      ]);
      setPasskeys(pks);
      if (prefs) setNotifPrefs(prefs);
    } catch {
      setPasskeys([]);
    }
  };

  const handleTogglePref = async (
    key:
      | 'notifyOnNewStudentQuestion'
      | 'notifyOnInstructorReply'
      | 'notifyOnDiscussionReply'
      | 'notifyOnAcceptedAnswer',
    val: boolean,
  ) => {
    try {
      const updated = await apiFetch<any>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: val }),
      });
      setNotifPrefs(updated);
      pushToast('تم تحديث تفضيلات الإشعارات', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ تفضيلات الإشعارات', 'error');
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/student/settings');
      return;
    }
    setFullName(user.fullName || '');
    setEmail(user.email || '');
    setHeadlineAr(user.headlineAr || '');
    setBioAr(user.bioAr || '');
    void loadSecurityData();
  }, [authLoading, user, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          email: email.trim() ? email.trim() : null,
          headlineAr: headlineAr.trim() ? headlineAr.trim() : null,
          bioAr: bioAr.trim() ? bioAr.trim() : null,
        }),
      });
      await refreshSession();
      pushToast('تم حفظ بيانات الملف الشخصي بنجاح', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ التعديلات');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const options = await apiFetch<any>('/auth/passkeys/register/options', {
        method: 'POST',
      });
      const attestation = await startRegistration({ optionsJSON: options });
      await apiFetch('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          response: attestation,
          friendlyName: newPasskeyName.trim() || 'جهاز إضافي',
        }),
      });
      setNewPasskeyName('');
      await Promise.all([loadSecurityData(), refreshSession()]);
      pushToast('تمت إضافة الجهاز الموثق بنجاح', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة الجهاز الجديد');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    setError(null);
    try {
      await apiFetch(`/auth/passkeys/${passkeyId}`, { method: 'DELETE' });
      await Promise.all([loadSecurityData(), refreshSession()]);
      pushToast('تمت إزالة الجهاز من الحساب', 'info');
    } catch (err: any) {
      if (err?.status === 403 || String(err?.message).includes('إعادة')) {
        setReauthOpen(true);
      } else {
        setError(err?.message || 'تعذر إزالة الجهاز');
      }
    }
  };

  const handleReauthWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/reauth/password', {
        method: 'POST',
        body: JSON.stringify({ password: reauthPass }),
      });
      setRecentlyReauthed(true);
      setReauthOpen(false);
      setReauthPass('');
      pushToast('تم تأكيد الهوية لمدة 10 دقائق للإجراءات الحساسة', 'success');
    } catch (err: any) {
      setError(err?.message || 'كلمة المرور غير صحيحة');
    } finally {
      setBusy(false);
    }
  };

  const handleReauthWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const options = await apiFetch<any>('/auth/reauth/passkey/options', {
        method: 'POST',
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      await apiFetch('/auth/reauth/passkey/verify', {
        method: 'POST',
        body: JSON.stringify({ response: assertion }),
      });
      setRecentlyReauthed(true);
      setReauthOpen(false);
      pushToast('تم تأكيد الهوية بنجاح لمدة 10 دقائق', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر التحقق من بصمة أو قفل الجهاز');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateCodes = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ recoveryCodes: string[] }>(
        '/auth/recovery-codes/regenerate',
        { method: 'POST' },
      );
      setNewRecoveryCodes(res.recoveryCodes);
      await refreshSession();
      pushToast('تم إصدار 10 أكواد استرداد جديدة وإبطال القديمة', 'success');
    } catch (err: any) {
      if (err?.status === 403 || String(err?.message).includes('إعادة')) {
        setReauthOpen(true);
      } else {
        setError(err?.message || 'تعذر تجديد أكواد الاسترداد');
      }
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل إعدادات الحساب...
        </div>
      </PublicPageLayout>
    );
  }

  const navItems: DashboardNavItem[] = [
    { id: 'home', label: 'لوحة التعلم', icon: <Compass className="h-4 w-4" />, href: '/student' },
    { id: 'courses', label: 'تصفح الكورسات', icon: <BookOpen className="h-4 w-4" />, href: '/courses' },
    {
      id: 'settings',
      label: 'إعدادات الحساب والأمان',
      icon: <ShieldCheck className="h-4 w-4" />,
      href: '/student/settings',
      active: true,
    },
    { id: 'notifications', label: 'الإشعارات', icon: <Bell className="h-4 w-4" />, href: '/notifications' },
  ];

  return (
    <DashboardShell
      portalBadge="بوابة الطالب"
      portalTitle="الملف الشخصي وأمان الحساب"
      portalSubtitle="إدارة بياناتك المهنية والأجهزة الموثقة للدخول السريع"
      navItems={navItems}
      headerActions={
        <Button
          variant={recentlyReauthed ? 'success' : 'outline'}
          size="sm"
          onClick={() => setReauthOpen(true)}
        >
          <ShieldCheck className="h-4 w-4" />
          {recentlyReauthed
            ? 'الهوية مؤكدة للإجراءات الحساسة'
            : 'تأكيد الهوية (للحذف أو التجديد)'}
        </Button>
      }
    >
      <div className="space-y-6">
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        {/* Profile Form */}
        <Card className="p-6 sm:p-8 space-y-5">
          <h2 className="text-lg font-extrabold text-bosla-ink">البيانات الأساسية</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="set-name" label="الاسم الكامل" required>
                <input
                  id="set-name"
                  className={inputClassName}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <Field id="set-email" label="البريد الإلكتروني (اختياري)">
                <input
                  id="set-email"
                  type="email"
                  dir="ltr"
                  className={inputClassName}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
            </div>
            <Field id="set-headline" label="المسمى المهني / التخصص">
              <input
                id="set-headline"
                className={inputClassName}
                value={headlineAr}
                onChange={(e) => setHeadlineAr(e.target.value)}
                placeholder="طبيب بيطري — إشراف مزارع دواجن"
              />
            </Field>
            <Field id="set-bio" label="نبذة تعريفية">
              <textarea
                id="set-bio"
                rows={3}
                className={inputClassName}
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={busy}>
              حفظ التغييرات
            </Button>
          </form>
        </Card>

        {/* Trusted Devices Management */}
        <Card className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
                <Fingerprint className="h-5 w-5 text-[#8CA2FF]" />
                الأجهزة الموثقة للدخول السريع ({passkeys.length})
              </h2>
              <p className="text-xs text-bosla-muted mt-1">
                يمكنك إضافة أكثر من جهاز، ولا يُسمح بإزالة أي جهاز موثق إلا بعد إعادة تأكيد الهوية.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {passkeys.length === 0 ? (
              <p className="text-xs text-bosla-muted">
                لا توجد أجهزة موثقة مسجلة حالياً (يمكن لحسابات Google إضافة جهاز للتحقق اختيارياً).
              </p>
            ) : (
              passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-bosla-line p-4"
                >
                  <div>
                    <p className="text-sm font-extrabold text-bosla-ink">
                      {pk.friendlyName || 'جهاز موثق'}
                    </p>
                    <p className="text-xs text-bosla-muted mt-0.5 tabular-nums">
                      {pk.deviceType === 'multiDevice' ? 'متزامن عبر أجهزتك' : 'مربوط بهذا الجهاز'} • أضيف في{' '}
                      {formatDate(pk.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePasskey(pk.id)}
                  >
                    <Trash2 className="h-4 w-4 text-[#FF9CAA]" />
                    إزالة
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row border-t border-bosla-line pt-4">
            <input
              className={inputClassName}
              value={newPasskeyName}
              onChange={(e) => setNewPasskeyName(e.target.value)}
              placeholder="اسم الجهاز الجديد (مثال: هاتفي الشخصي)"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleAddPasskey}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              إضافة جهاز موثق جديد
            </Button>
          </div>
        </Card>

        {/* Recovery Codes + Google Linking */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
              <KeyRound className="h-5 w-5 text-[#F5B94A]" />
              أكواد الاسترداد الاحتياطية
            </h2>
            <p className="text-xs text-[#A9B1E0]">
              لديك <strong>{user.unusedRecoveryCodesCount ?? 0}</strong> أكواد استرداد غير مستخدمة. يُنصح بتجديدها وحفظها إذا نفدت أو استبدلت جهازك.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleRegenerateCodes}
            >
              <RefreshCw className="h-4 w-4" />
              إصدار 10 أكواد جديدة (يلغي القديمة)
            </Button>
            {newRecoveryCodes && (
              <div className="space-y-3 rounded-xl border border-[#77E2B5]/35 bg-[#0B1440] p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {newRecoveryCodes.map((c) => (
                    <code
                      key={c}
                      dir="ltr"
                      className="rounded border border-[#22307A] bg-[#0F1A4A] px-2 py-1 text-center font-mono text-xs font-bold text-[#77E2B5]"
                    >
                      {c}
                    </code>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
                    pushToast('تم نسخ الأكواد الجديدة', 'success');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  نسخ الأكواد
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-bosla-ink">
              ربط حساب Google
            </h2>
            <p className="text-xs text-bosla-muted">
              {user.hasGoogleLinked
                ? 'حسابك مرتبط بالفعل بحساب Google للدخول السريع.'
                : 'اربط حساب Google بحسابك الحالي لتتمكن من الدخول به مستقبلاً (يتطلب تأكيد الهوية أولاً).'}
            </p>
            {user.hasGoogleLinked ? (
              <Badge tone="success">مرتبط بحساب Google</Badge>
            ) : (
              <GoogleSignInButton
                endpoint="/auth/google/link"
                mode="link"
                onSuccess={() => void refreshSession()}
              />
            )}
          </Card>
        </div>

        {/* Notification Preferences */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#8CA2FF]" />
                تفضيلات إشعارات المجتمع وأسئلة الدروس
              </h2>
              <p className="text-xs text-bosla-muted mt-1">
                تحكم في التنبيهات التي تصلك داخل جرس الإشعارات عند الرد على أسئلتك أو اعتماد الإجابات.
              </p>
            </div>
          </div>
          {notifPrefs && (
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 cursor-pointer">
                <span className="font-bold text-bosla-ink">
                  إشعار عند إجابة المدرب على سؤالي
                </span>
                <input
                  type="checkbox"
                  checked={notifPrefs.notifyOnInstructorReply}
                  onChange={(e) =>
                    void handleTogglePref('notifyOnInstructorReply', e.target.checked)
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 cursor-pointer">
                <span className="font-bold text-bosla-ink">
                  إشعار عند الرد على مناقشاتي وتعليقاتي
                </span>
                <input
                  type="checkbox"
                  checked={notifPrefs.notifyOnDiscussionReply}
                  onChange={(e) =>
                    void handleTogglePref('notifyOnDiscussionReply', e.target.checked)
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 cursor-pointer">
                <span className="font-bold text-bosla-ink">
                  إشعار عند اعتماد إجابة لسؤالي
                </span>
                <input
                  type="checkbox"
                  checked={notifPrefs.notifyOnAcceptedAnswer}
                  onChange={(e) =>
                    void handleTogglePref('notifyOnAcceptedAnswer', e.target.checked)
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-bosla-line p-3 cursor-pointer">
                <span className="font-bold text-bosla-ink">
                  إشعارات أسئلة الطلاب الجديدة (للمدربين)
                </span>
                <input
                  type="checkbox"
                  checked={notifPrefs.notifyOnNewStudentQuestion}
                  onChange={(e) =>
                    void handleTogglePref('notifyOnNewStudentQuestion', e.target.checked)
                  }
                />
              </label>
            </div>
          )}
        </Card>

        {/* Reauthentication Modal */}
        <NativeModal
          open={reauthOpen}
          onClose={() => setReauthOpen(false)}
          title="تأكيد الهوية قبل الإجراءات الحساسة"
        >
          <div className="space-y-5">
            <p className="text-xs text-bosla-muted">
              لحماية حسابك عند إزالة جهاز موثق أو تجديد أكواد الاسترداد أو ربط حساب Google، أكّد هويتك ببصمة الجهاز أو كلمة المرور.
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={handleReauthWithPasskey}
            >
              <Fingerprint className="h-5 w-5" />
              التأكيد ببصمة أو قفل الجهاز
            </Button>
            {user.authProvider === 'PHONE_PASSWORD' && (
              <form onSubmit={handleReauthWithPassword} className="space-y-3 border-t border-bosla-line pt-4">
                <Field id="reauth-pwd" label="أو أدخل كلمة المرور الحالية">
                  <PasswordInput
                    id="reauth-pwd"
                    value={reauthPass}
                    onChange={(e) => setReauthPass(e.target.value)}
                    required
                  />
                </Field>
                <Button type="submit" variant="outline" className="w-full" disabled={busy}>
                  <Lock className="h-4 w-4" />
                  تأكيد بكلمة المرور
                </Button>
              </form>
            )}
          </div>
        </NativeModal>
      </div>
    </DashboardShell>
  );
}
