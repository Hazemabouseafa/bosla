'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Lock } from 'lucide-react';
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
  PasswordInput,
  inputClassName,
} from '@/components/ui/primitives';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const { refreshSession, pushToast } = useAuth();

  const [countryCode, setCountryCode] = useState('+20');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeAfterAuth = (user: any, requiresPasskey?: boolean) => {
    if (requiresPasskey) {
      router.push('/security/passkey-setup');
      return;
    }
    if (nextPath && nextPath.startsWith('/')) {
      router.push(nextPath);
      return;
    }
    if (user?.role === 'ADMIN') router.push('/admin');
    else if (user?.role === 'INSTRUCTOR') router.push('/instructor');
    else router.push('/student');
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{
        user: any;
        requiresPasskeyEnrollment: boolean;
      }>('/auth/login/phone', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({ countryCode, phoneNumber, password }),
      });
      await refreshSession();
      pushToast('تم تسجيل الدخول بنجاح', 'success');
      routeAfterAuth(res.user, res.requiresPasskeyEnrollment);
    } catch (err: any) {
      setError(err?.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyBusy(true);
    try {
      const options = await apiFetch<any>('/auth/passkeys/login/options', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify(
          phoneNumber.trim()
            ? { countryCode, phoneNumber: phoneNumber.trim() }
            : {},
        ),
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      const res = await apiFetch<{ user: any }>('/auth/passkeys/login/verify', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({ response: assertion }),
      });
      await refreshSession();
      pushToast('تم تسجيل الدخول باستخدام Passkey بنجاح', 'success');
      routeAfterAuth(res.user, false);
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر إتمام المصادقة عبر Passkey. تأكد من دعم المتصفح أو استخدم كلمة المرور.',
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6 space-y-6">
        <div className="text-center space-y-2">
          <Badge tone="info">دخول آمن بدون رموز OTP</Badge>
          <h1 className="text-3xl font-extrabold text-bosla-ink">
            تسجيل الدخول إلى أكاديمية بوصلة
          </h1>
          <p className="text-sm text-bosla-muted">
            اختر الدخول بحساب Google، أو برقم الموبايل وكلمة المرور، أو مباشرة بمفتاح Passkey.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {/* Option A: Google */}
          <GoogleSignInButton
            onSuccess={async () => {
              const user = await refreshSession();
              routeAfterAuth(user, false);
            }}
          />

          <div className="relative flex items-center justify-center">
            <span className="h-px w-full bg-bosla-line" />
            <span className="bg-white px-3 text-xs font-bold text-bosla-muted shrink-0">
              أو برقم الموبايل وPasskey
            </span>
            <span className="h-px w-full bg-bosla-line" />
          </div>

          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <Field id="login-phone" label="رقم الموبايل" required>
              <div className="flex gap-2" dir="ltr">
                <select
                  aria-label="مفتاح الدولة"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className={`${inputClassName} w-28 shrink-0`}
                >
                  <option value="+20">🇪🇬 +20</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+962">🇯🇴 +962</option>
                  <option value="+965">🇰🇼 +965</option>
                </select>
                <input
                  id="login-phone"
                  type="tel"
                  autoComplete="username webauthn"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  className={inputClassName}
                  required
                />
              </div>
            </Field>

            <Field id="login-pass" label="كلمة المرور" required>
              <PasswordInput
                id="login-pass"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            <div className="flex items-center justify-between text-xs">
              <Link
                href="/recovery"
                className="font-extrabold text-bosla-primary hover:underline"
              >
                نسيت كلمة المرور؟ (استرداد بـ Passkey أو كود احتياطي)
              </Link>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              <Lock className="h-4 w-4" />
              {busy ? 'جاري التحقق...' : 'دخول برقم الموبايل وكلمة المرور'}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full border-bosla-navy text-bosla-navy"
            disabled={passkeyBusy}
            onClick={handlePasskeyLogin}
          >
            <Fingerprint className="h-5 w-5 text-bosla-primary" />
            {passkeyBusy ? 'بانتظار بصمة أو مفتاح الجهاز...' : 'دخول سريع عبر Passkey'}
          </Button>

          <div className="rounded-xl bg-bosla-bg p-3.5 text-center text-xs text-bosla-muted flex flex-wrap items-center justify-center gap-2">
            <span>مستخدم جديد؟</span>
            <Link href="/register" className="font-extrabold text-bosla-primary hover:underline">
              إنشاء حساب طالب جديد
            </Link>
            <span>•</span>
            <Link href="/recovery" className="font-bold text-bosla-ink hover:underline inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              مساعدة الاسترداد بدون OTP
            </Link>
          </div>
        </Card>
      </section>
    </PublicPageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PublicPageLayout>
          <div className="py-20 text-center text-sm font-bold text-bosla-muted">
            جاري التحميل...
          </div>
        </PublicPageLayout>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
