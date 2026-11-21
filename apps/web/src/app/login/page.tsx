'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import {
  AlertBanner,
  Button,
  Field,
  PasswordInput,
  SkeletonBlock,
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
      <section className="relative overflow-hidden bg-[#070D2B] py-12 sm:py-16 lg:py-20 text-[#EEF0FF]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-40"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 start-1/4 h-[420px] w-[420px] rounded-full bg-[#4A67F0]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 end-1/4 h-[340px] w-[340px] rounded-full bg-[#6A3FE0]/12 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            {/* Editorial Sovereign Orientation Rail */}
            <div className="lg:col-span-5 space-y-7 text-center lg:text-start">
              <div className="hero-seq-1 inline-flex items-center gap-2 rounded-full border border-[#8CA2FF]/25 bg-[#0B1440]/85 px-3.5 py-1.5 text-xs font-semibold text-[#8CA2FF]">
                <Sparkles className="h-3.5 w-3.5 text-[#F5B94A]" strokeWidth={1.75} />
                <span>بوابة المتدربين والخبراء</span>
              </div>

              <div className="space-y-3">
                <h1 className="hero-seq-2 text-3xl font-extrabold leading-[1.35] text-[#EEF0FF] sm:text-4xl lg:text-[42px]">
                  تسجيل الدخول إلى{' '}
                  <span className="text-[#8CA2FF]">أكاديمية بوصلة</span>
                </h1>
                <p className="hero-seq-3 text-sm sm:text-base leading-[1.8] text-[#A9B1E0]">
                  سجّل دخولك لمتابعة كورساتك، المسارات المهنية، والشهادات المعتمدة داخل بيئة تعلم عالية التركيز.
                </p>
              </div>

              <div className="hero-seq-3 hidden lg:flex items-center gap-6 rounded-2xl border border-[#8CA2FF]/15 bg-[#0B1440]/65 p-5">
                <BoslaCompassSvg
                  variant="seal"
                  bearingDeg={18}
                  className="h-28 w-28 shrink-0"
                />
                <div className="space-y-3 text-xs leading-relaxed text-[#A9B1E0]">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#0F1A4A] text-[#77E2B5]">
                      <Fingerprint className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </span>
                    <div>
                      <p className="font-semibold text-[#EEF0FF]">بوابة دخول موحدة</p>
                      <p>وصول فوري عبر رقم الموبايل، كلمة المرور، أو مفتاح الجهاز الحيوي.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#0F1A4A] text-[#F5B94A]">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </span>
                    <div>
                      <p className="font-semibold text-[#EEF0FF]">حفظ تلقائي للتقدم</p>
                      <p>تواصل مشاهدة دروسك من الثانية التي توقفت عندها على أي جهاز.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Luxury Liquid Glass Portal Card */}
            <div className="hero-seq-4 lg:col-span-7">
              <div
                data-sc-spotlight=""
                className="bosla-liquid-glass-portal rounded-3xl p-6 sm:p-9 space-y-6"
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#8CA2FF]/15 pb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#EEF0FF]">
                      بيانات الدخول المعتمدة
                    </h2>
                    <p className="text-xs text-[#A9B1E0] mt-0.5">
                      أدخل رقم الموبايل المسجل أو استخدم مفتاح أمان الجهاز
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/25 bg-[#0B1440] text-[#8CA2FF]">
                    <Lock className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                </div>

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
                      <span className="h-px w-full bg-[#8CA2FF]/20" />
                      <span className="bg-[#0E1947] px-3 text-xs sm:text-sm font-semibold text-[#A9B1E0] shrink-0">
                        أو باستخدام رقم الموبايل
                      </span>
                      <span className="h-px w-full bg-[#8CA2FF]/20" />
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
                      className="font-semibold text-[#8CA2FF] hover:text-[#EEF0FF] hover:underline transition-colors"
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

                <div className="rounded-xl border border-[#8CA2FF]/15 bg-[#0B1440]/85 p-3.5 text-center text-xs sm:text-sm text-[#A9B1E0] flex flex-wrap items-center justify-center gap-2">
                  <span>مستخدم جديد؟</span>
                  <Link href="/register" className="font-bold text-[#8CA2FF] hover:underline">
                    إنشاء حساب طالب جديد
                  </Link>
                  <span aria-hidden="true">/</span>
                  <Link
                    href="/recovery"
                    className="font-semibold text-[#EEF0FF] hover:underline inline-flex items-center gap-1"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-[#8CA2FF]" />
                    مساعدة استرداد الحساب
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PublicPageLayout>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-12">
              <SkeletonBlock className="h-72 lg:col-span-5" />
              <SkeletonBlock className="h-96 lg:col-span-7" />
            </div>
          </div>
        </PublicPageLayout>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
