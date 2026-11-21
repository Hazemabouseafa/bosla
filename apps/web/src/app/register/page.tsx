'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Compass, ShieldCheck, UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import {
  AlertBanner,
  Button,
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

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden bg-[#070D2B] py-12 sm:py-16 text-[#EEF0FF]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-40"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/3 h-[420px] w-[420px] rounded-full bg-[#4A67F0]/14 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
            {/* Editorial Admission Column */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24 text-center lg:text-start">
              <div className="hero-seq-1 inline-flex items-center gap-2 rounded-full border border-[#8CA2FF]/25 bg-[#0B1440]/85 px-3.5 py-1.5 text-xs font-semibold text-[#8CA2FF]">
                <Compass className="h-3.5 w-3.5 text-[#F5B94A]" strokeWidth={1.75} />
                <span>انضم إلى أكاديمية بوصلة</span>
              </div>

              <div className="space-y-3">
                <h1 className="hero-seq-2 text-3xl font-extrabold leading-[1.2] text-[#EEF0FF] sm:text-4xl">
                  إنشاء حساب طالب جديد في{' '}
                  <span className="text-[#8CA2FF]">بوصلة</span>
                </h1>
                <p className="hero-seq-3 text-sm sm:text-base leading-[1.8] text-[#A9B1E0]">
                  أنشئ حسابك الجديد للوصول إلى الدورات التطبيقية والمسارات المهنية والشهادات المعتمدة بعد تأمين جهازك.
                </p>
              </div>

              <div className="hero-seq-3 hidden lg:block rounded-2xl border border-[#8CA2FF]/16 bg-[#0B1440]/65 p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <BoslaCompassSvg
                    variant="seal"
                    bearingDeg={42}
                    className="h-24 w-24 shrink-0"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#F5B94A]">خطوات التسجيل والتفعيل</p>
                    <p className="text-sm font-bold text-[#EEF0FF]">مسار تسجيل محمي بخطوتين</p>
                  </div>
                </div>
                <ul className="space-y-2.5 border-t border-[#8CA2FF]/14 pt-3 text-xs text-[#A9B1E0]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#77E2B5]" />
                    <span>إدخال بياناتك الشخصية ورقم الموبايل الفعلي</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8CA2FF]" />
                    <span>توثيق الجهاز بالبصمة أو القفل واستلام 10 أكواد طوارئ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F5B94A]" />
                    <span>فتح لوحة المتدرب والمحتوى التعليمي الكامل فور التفعيل</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Registration Liquid Glass Card */}
            <div className="hero-seq-4 lg:col-span-7">
              <div
                data-sc-spotlight=""
                className="bosla-liquid-glass-portal rounded-3xl p-6 sm:p-9 space-y-6"
              >
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
                      <span className="h-px w-full bg-[#8CA2FF]/18" />
                      <span className="bg-[#0E1947] px-3 text-xs sm:text-sm font-semibold text-[#A9B1E0] shrink-0">
                        أو التسجيل برقم الموبايل
                      </span>
                      <span className="h-px w-full bg-[#8CA2FF]/18" />
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

                  <Field
                    id="reg-pass-confirm"
                    label="تأكيد كلمة المرور"
                    error={passwordMismatch ? 'كلمتا المرور غير متطابقتين' : undefined}
                    required
                  >
                    <PasswordInput
                      id="reg-pass-confirm"
                      name="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      ariaInvalid={passwordMismatch}
                      required
                    />
                  </Field>

                  <div className="space-y-2.5 rounded-2xl border border-[#8CA2FF]/18 bg-[#0B1440]/85 p-4 text-xs sm:text-sm text-[#EEF0FF]">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#7C95FF]"
                        required
                      />
                      <span>
                        أوافق على{' '}
                        <Link href="/terms" className="font-bold text-[#8CA2FF] underline">
                          الشروط والأحكام
                        </Link>
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptPrivacy}
                        onChange={(e) => setAcceptPrivacy(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#7C95FF]"
                        required
                      />
                      <span>
                        أوافق على{' '}
                        <Link href="/privacy" className="font-bold text-[#8CA2FF] underline">
                          سياسة الخصوصية وحماية البيانات
                        </Link>
                      </span>
                    </label>
                  </div>

                  <div className="rounded-xl border border-[#8CA2FF]/25 bg-[#0B1440]/90 p-3.5 text-xs sm:text-sm text-[#A9B1E0] flex items-start gap-2.5">
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

                <p className="text-center text-xs sm:text-sm text-[#A9B1E0]">
                  لديك حساب بالفعل؟{' '}
                  <Link href="/login" className="font-bold text-[#8CA2FF] hover:underline">
                    سجل الدخول الآن
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
