'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import {
  Copy,
  Fingerprint,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPass, setReauthPass] = useState('');
  const [recentlyReauthed, setRecentlyReauthed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSecurityData = async () => {
    try {
      const pks = await apiFetch<any[]>('/auth/passkeys');
      setPasskeys(pks);
    } catch {
      setPasskeys([]);
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
      pushToast('تمت إضافة مفتاح Passkey جديد بنجاح', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر تسجيل Passkey جديد');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    setError(null);
    try {
      await apiFetch(`/auth/passkeys/${passkeyId}`, { method: 'DELETE' });
      await Promise.all([loadSecurityData(), refreshSession()]);
      pushToast('تم حذف Passkey من الحساب', 'info');
    } catch (err: any) {
      if (err?.status === 403 || String(err?.message).includes('إعادة')) {
        setReauthOpen(true);
      } else {
        setError(err?.message || 'تعذر حذف المفتاح');
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
      pushToast('تم تأكيد الهوية بالـ Passkey لمدة 10 دقائق', 'success');
    } catch (err: any) {
      setError(err?.message || 'تعذر التحقق بالـ Passkey');
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

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="info">إعدادات الحساب والأمان</Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              الملف الشخصي ومفاتيح Passkey FIDO2
            </h1>
          </div>
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
        </div>

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

        {/* Passkeys Management */}
        <Card className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
                <Fingerprint className="h-5 w-5 text-bosla-primary" />
                أجهزة Passkey المسجلة ({passkeys.length})
              </h2>
              <p className="text-xs text-bosla-muted mt-1">
                يمكنك إضافة أكثر من جهاز، ولا يُسمح بحذف أي Passkey إلا بعد إعادة التحقق من الهوية.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {passkeys.length === 0 ? (
              <p className="text-xs text-bosla-muted">
                لا توجد مفاتيح Passkey مسجلة حالياً (يمكن لحسابات Google إضافة Passkey اختيارياً).
              </p>
            ) : (
              passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-bosla-line p-4"
                >
                  <div>
                    <p className="text-sm font-extrabold text-bosla-ink">
                      {pk.friendlyName || 'مفتاح جهاز'}
                    </p>
                    <p className="text-xs text-bosla-muted mt-0.5">
                      النوع: {pk.deviceType} • أضيف في{' '}
                      {new Date(pk.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePasskey(pk.id)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
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
              إضافة Passkey جديد
            </Button>
          </div>
        </Card>

        {/* Recovery Codes + Google Linking */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
              <KeyRound className="h-5 w-5 text-bosla-amber" />
              أكواد الاسترداد الاحتياطية
            </h2>
            <p className="text-xs text-bosla-muted">
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
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {newRecoveryCodes.map((c) => (
                    <code
                      key={c}
                      dir="ltr"
                      className="rounded bg-white px-2 py-1 text-center font-mono text-xs font-bold text-bosla-navy"
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
              ربط حساب Google (OpenID Connect)
            </h2>
            <p className="text-xs text-bosla-muted">
              {user.hasGoogleLinked
                ? 'حسابك مرتبط بالفعل بهوية Google للدخول السريع.'
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

        {/* Reauthentication Modal */}
        <NativeModal
          open={reauthOpen}
          onClose={() => setReauthOpen(false)}
          title="تأكيد الهوية قبل الإجراءات الحساسة"
        >
          <div className="space-y-5">
            <p className="text-xs text-bosla-muted">
              لحماية حسابك عند حذف Passkey أو تجديد أكواد الاسترداد أو ربط حساب Google، أكّد هويتك عبر Passkey أو كلمة المرور.
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={handleReauthWithPasskey}
            >
              <Fingerprint className="h-5 w-5" />
              التأكيد باستخدام Passkey
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
      </section>
    </PublicPageLayout>
  );
}
