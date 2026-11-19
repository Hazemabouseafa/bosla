'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

export default function RegisterPage() {
  const router = useRouter();
  const { refreshSession, pushToast } = useAuth();

  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleAuth = Boolean(googleClientId) && !googleClientId.includes('placeholder');

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      setError('يجب الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/auth/register/phone', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          fullName,
          countryCode: '+20',
          phoneNumber: phoneNumber.trim(),
          password,
          confirmPassword,
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      });
      await refreshSession();
      pushToast('تم إنشاء الحساب! الخطوة التالية: تأمين حسابك', 'success');
      router.push('/security/passkey-setup');
    } catch (err: any) {
      setError(err?.message || 'تعذر إتمام التسجيل، تحقق من البيانات المدخلة');
    } finally {
      setBusy(false);
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
            انضم إلى أكاديمية بوصلة
          </span>
          <h1 className="text-3xl font-extrabold sm:text-4xl hero-seq-2">
            إنشاء حساب طالب جديد في <span className="bosla-text-gradient-teal">بوصلة</span>
          </h1>
          <p className="text-sm text-slate-200/85 hero-seq-3">
            أنشئ حسابك الجديد للوصول إلى الدورات التطبيقية والمسارات المهنية والشهادات المعتمدة.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-24 max-w-xl px-4 pb-16 sm:px-6 hero-seq-4">
        <Card className="p-6 sm:p-8 space-y-6 border-[#22307A]">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {hasGoogleAuth && (
            <>
              <div className="space-y-2">
                <GoogleSignInButton
                  mode="signup"
                  onSuccess={() => router.push('/student')}
                />
                <p className="text-center text-xs text-[#A9B1E0]">
                  تسجيل سريع بنقرة واحدة عبر حسابك في Google.
                </p>
              </div>

              <div className="relative flex items-center justify-center">
                <span className="h-px w-full bg-[#22307A]" />
                <span className="bg-[#0F1A4A] px-3 text-xs sm:text-sm font-bold text-[#A9B1E0] shrink-0">
                  أو التسجيل برقم الموبايل
                </span>
                <span className="h-px w-full bg-[#22307A]" />
              </div>
            </>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Field id="reg-name" label="الاسم الكامل" required>
              <input
                id="reg-name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="د. محمد أحمد عبد الرحمن"
                className={inputClassName}
                required
                minLength={2}
              />
            </Field>

            <Field
              id="reg-phone"
              label="رقم الموبايل"
              hint="مثال: 01012345678"
              required
            >
              <input
                id="reg-phone"
                type="tel"
                dir="ltr"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01012345678"
                className={inputClassName}
                required
              />
            </Field>

            <Field
              id="reg-pass"
              label="كلمة المرور"
              hint="8 أحرف على الأقل، وتحتوي على حرف واحد ورقم واحد على الأقل."
              required
            >
              <PasswordInput
                id="reg-pass"
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            <Field id="reg-pass-confirm" label="تأكيد كلمة المرور" required>
              <PasswordInput
                id="reg-pass-confirm"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </Field>

            <div className="space-y-2.5 rounded-2xl border border-bosla-line bg-bosla-bg/50 p-4 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-bosla-primary"
                  required
                />
                <span>
                  أوافق على{' '}
                  <Link href="/terms" className="font-bold text-bosla-tealText underline">
                    الشروط والأحكام
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-bosla-primary"
                  required
                />
                <span>
                  أوافق على{' '}
                  <Link href="/privacy" className="font-bold text-bosla-tealText underline">
                    سياسة الخصوصية وحماية البيانات
                  </Link>
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-[#8CA2FF]/35 bg-[#0B1440] p-3.5 text-xs sm:text-sm text-[#EEF0FF] flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[#8CA2FF]" />
              <span>
                بعد إنشاء الحساب، ستُطلب منك خطوة سريعة لتأكيد أمان جهازك وحفظ أكواد الطوارئ الاحتياطية.
              </span>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              <UserPlus className="h-4 w-4" />
              {busy ? 'جاري التسجيل...' : 'إنشاء الحساب والمتابعة'}
            </Button>
          </form>

          <p className="text-center text-xs text-bosla-muted">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-extrabold text-bosla-tealText hover:underline">
              سجل الدخول الآن
            </Link>
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
