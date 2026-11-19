'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import {
  AlertBanner,
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

  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleAuth = Boolean(googleClientId) && !googleClientId.includes('placeholder');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
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
    const target = getDefaultDashboardForUser(user);
    router.push(target.href);
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
        body: JSON.stringify({
          countryCode: '+20',
          phoneNumber: phoneNumber.trim(),
          password,
        }),
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

  const handleDeviceLogin = async () => {
    setError(null);
    setDeviceBusy(true);
    try {
      const options = await apiFetch<any>('/auth/passkeys/login/options', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify(
          phoneNumber.trim()
            ? { countryCode: '+20', phoneNumber: phoneNumber.trim() }
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
      pushToast('تم تسجيل الدخول بنجاح', 'success');
      routeAfterAuth(res.user, false);
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر التحقق من الجهاز. تأكد من تفعيل البصمة أو قفل الشاشة، أو استخدم كلمة المرور.',
      );
    } finally {
      setDeviceBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden bg-bosla-navy pb-32 pt-14 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 220"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full opacity-25"
        >
          <path
            d="M0,180 C340,60 820,210 1200,70"
            fill="none"
            stroke="#7C95FF"
            strokeWidth="2.5"
          />
        </svg>
        <div className="relative mx-auto max-w-xl px-4 text-center space-y-3 sm:px-6 hero-seq-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-bosla-primary/40 bg-white/[0.08] px-4 py-1 text-xs font-extrabold text-bosla-primary backdrop-blur-md">
            بوابة المتدربين والخبراء
          </span>
          <h1 className="text-3xl font-extrabold sm:text-4xl hero-seq-2">
            تسجيل الدخول إلى <span className="bosla-text-gradient-teal">أكاديمية بوصلة</span>
          </h1>
          <p className="text-sm text-slate-200/85 hero-seq-3">
            سجّل دخولك لمتابعة كورساتك، المسارات المهنية، والشهادات المعتمدة.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-24 max-w-xl px-4 pb-16 sm:px-6 hero-seq-4">
        <Card className="p-6 sm:p-8 space-y-6 border-[#22307A]">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {hasGoogleAuth && (
            <>
              <GoogleSignInButton
                onSuccess={async () => {
                  const user = await refreshSession();
                  routeAfterAuth(user, false);
                }}
              />

              <div className="relative flex items-center justify-center">
                <span className="h-px w-full bg-[#22307A]" />
                <span className="bg-[#0F1A4A] px-3 text-xs sm:text-sm font-bold text-[#A9B1E0] shrink-0">
                  أو باستخدام رقم الموبايل
                </span>
                <span className="h-px w-full bg-[#22307A]" />
              </div>
            </>
          )}

          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <Field id="login-phone" label="رقم الموبايل" required>
              <input
                id="login-phone"
                type="tel"
                dir="ltr"
                autoComplete="username webauthn"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01012345678"
                className={inputClassName}
                required
              />
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

            <div className="flex items-center justify-between text-xs sm:text-sm">
              <Link
                href="/recovery"
                className="font-extrabold text-[#8CA2FF] hover:underline"
              >
                نسيت كلمة المرور؟
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
            className="w-full"
            disabled={deviceBusy}
            onClick={handleDeviceLogin}
          >
            <Fingerprint className="h-5 w-5 text-[#8CA2FF]" />
            {deviceBusy ? 'بانتظار التأكيد من جهازك...' : 'الدخول السريع ببصمة أو قفل الجهاز'}
          </Button>

          <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-center text-xs sm:text-sm text-[#A9B1E0] flex flex-wrap items-center justify-center gap-2">
            <span>مستخدم جديد؟</span>
            <Link href="/register" className="font-extrabold text-[#8CA2FF] hover:underline">
              إنشاء حساب طالب جديد
            </Link>
            <span>•</span>
            <Link href="/recovery" className="font-bold text-[#EEF0FF] hover:underline inline-flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5 text-[#8CA2FF]" />
              مساعدة استرداد الحساب
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
