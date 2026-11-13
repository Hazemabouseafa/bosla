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
  Badge,
  Button,
  Card,
  Field,
  PasswordInput,
  inputClassName,
} from '@/components/ui/primitives';

export default function RegisterPage() {
  const router = useRouter();
  const { refreshSession, pushToast } = useAuth();

  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
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
          countryCode,
          phoneNumber,
          password,
          confirmPassword,
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      });
      await refreshSession();
      pushToast('تم إنشاء الحساب! الخطوة التالية: تأمين حسابك بـ Passkey', 'success');
      router.push('/security/passkey-setup');
    } catch (err: any) {
      setError(err?.message || 'تعذر إتمام التسجيل، تحقق من البيانات المدخلة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6 space-y-6">
        <div className="text-center space-y-2">
          <Badge tone="success">تسجيل حديث بدون رموز OTP</Badge>
          <h1 className="text-3xl font-extrabold text-bosla-ink">
            إنشاء حساب طالب جديد في بوصلة
          </h1>
          <p className="text-sm text-bosla-muted">
            اختر التسجيل المباشر عبر Google، أو التسجيل برقم الموبايل وكلمة المرور مع تفعيل Passkey على جهازك.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {/* Option A: Google */}
          <div className="space-y-2">
            <GoogleSignInButton
              mode="signup"
              onSuccess={() => router.push('/student')}
            />
            <p className="text-center text-[11px] text-bosla-muted">
              لا يتطلب حساب Google إعداد كلمة مرور أو Passkey إلزامي.
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <span className="h-px w-full bg-bosla-line" />
            <span className="bg-white px-3 text-xs font-bold text-bosla-muted shrink-0">
              أو الخيار الثاني: الموبايل + كلمة المرور
            </span>
            <span className="h-px w-full bg-bosla-line" />
          </div>

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
              label="رقم الموبايل مع مفتاح الدولة"
              hint="يُحفظ بالصيغة الدولية (E.164) لربط حسابك دون إرسال رسائل تحقق OTP."
              required
            >
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
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel-national"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  className={inputClassName}
                  required
                />
              </div>
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
                  <Link href="/terms" className="font-bold text-bosla-primary underline">
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
                  <Link href="/privacy" className="font-bold text-bosla-primary underline">
                    سياسة الخصوصية وحماية البيانات
                  </Link>
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-bosla-navy flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-bosla-primary" />
              <span>
                بعد إنشاء الحساب، سيُطلب منك تسجيل مفتاح <strong>Passkey</strong> على جهازك لتفعيل الحساب وإصدار أكواد الاسترداد الاحتياطية.
              </span>
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
              <UserPlus className="h-4 w-4" />
              {busy ? 'جاري التسجيل...' : 'إنشاء الحساب والمتابعة لتأمين Passkey'}
            </Button>
          </form>

          <p className="text-center text-xs text-bosla-muted">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-extrabold text-bosla-primary hover:underline">
              سجل الدخول الآن
            </Link>
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
