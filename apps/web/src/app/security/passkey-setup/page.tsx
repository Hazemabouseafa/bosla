'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { CheckCircle2, Copy, Download, Fingerprint, KeyRound, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Button,
  Card,
  Field,
  inputClassName,
} from '@/components/ui/primitives';

export default function PasskeySetupPage() {
  const router = useRouter();
  const { user, isLoading, refreshSession, pushToast } = useAuth();

  const [friendlyName, setFriendlyName] = useState('جهازي الأساسي');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledgedSaved, setAcknowledgedSaved] = useState(false);

  const handleEnrollPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const options = await apiFetch<any>('/auth/passkeys/register/options', {
        method: 'POST',
      });
      const attestation = await startRegistration({ optionsJSON: options });
      const res = await apiFetch<{
        verified: boolean;
        accountActivated: boolean;
        recoveryCodes: string[] | null;
      }>('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          response: attestation,
          friendlyName: friendlyName.trim() || 'جهازي المعتمد',
        }),
      });
      await refreshSession();
      pushToast('تم تأمين الجهاز وتفعيل حسابك بنجاح!', 'success');
      if (res.recoveryCodes && res.recoveryCodes.length > 0) {
        setRecoveryCodes(res.recoveryCodes);
      } else {
        router.push('/student');
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تفعيل أمان الجهاز. تأكد من تفعيل بصمة الجهاز أو قفل الشاشة في المتصفح.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCodes = async () => {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    pushToast('تم نسخ جميع أكواد الاسترداد إلى الحافظة', 'success');
  };

  const handleDownloadCodes = () => {
    if (!recoveryCodes) return;
    const content = [
      'BOSLA ACADEMY — أكواد الاسترداد الاحتياطية (تُستخدم كل منها لمرة واحدة)',
      `الحساب: ${user?.fullName || ''} (${user?.phoneE164 || ''})`,
      '------------------------------------------------------',
      ...recoveryCodes,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bosla-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري التحقق من حالة الجلسة...
        </div>
      </PublicPageLayout>
    );
  }

  if (!user) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <AlertBanner tone="warning" title="يجب تسجيل الدخول أولاً">
            <p className="mb-4">
              يرجى تسجيل الدخول أو إنشاء حساب جديد قبل إعداد حماية الحساب.
            </p>
            <Link href="/register">
              <Button variant="primary">الانتقال إلى التسجيل</Button>
            </Link>
          </AlertBanner>
        </section>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-[#22307A] bg-[#070D2B] pb-28 pt-12 text-white">
        <div className="relative mx-auto max-w-2xl px-4 text-center space-y-2 sm:px-6 hero-seq-1">
          <p className="text-xs sm:text-sm font-medium text-[#F5B94A]">الخطوة الأخيرة لتفعيل الحساب</p>
          <h1 className="text-3xl font-semibold sm:text-4xl hero-seq-2">
            حماية حسابك <span className="text-[#8CA2FF]">وتفعيله</span>
          </h1>
          <p className="text-sm text-slate-200/85 leading-relaxed hero-seq-3">
            أهلاً {user.fullName}. لحماية حسابك ومنع الوصول غير المصرح به، قم بربطه ببصمة الإصبع أو الوجه أو قفل الشاشة الخاص بجهازك. ستستخدم هذه الطريقة للدخول السريع واستعادة الحساب بسهولة عند الحاجة.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-20 max-w-2xl px-4 pb-16 sm:px-6 hero-seq-4">
        <Card className="p-6 sm:p-8 space-y-6 border-[#22307A]">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {!recoveryCodes ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4">
                  <Fingerprint className="h-5 w-5 text-[#8CA2FF] mb-2" />
                  <p className="font-extrabold text-[#EEF0FF]">البصمة أو قفل الشاشة</p>
                  <p className="text-[#A9B1E0] mt-1 text-xs sm:text-sm">
                    يعمل عبر بصمة الهاتف أو الوجه أو رمز قفل جهازك.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4">
                  <ShieldCheck className="h-5 w-5 text-[#77E2B5] mb-2" />
                  <p className="font-extrabold text-[#EEF0FF]">حماية بالتشفير</p>
                  <p className="text-[#A9B1E0] mt-1 text-xs sm:text-sm">
                    بيانات القفل تبقى محفوظة على جهازك فقط.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4">
                  <KeyRound className="h-5 w-5 text-[#F5B94A] mb-2" />
                  <p className="font-extrabold text-[#EEF0FF]">أكواد طوارئ</p>
                  <p className="text-[#A9B1E0] mt-1 text-xs sm:text-sm">
                    ستحصل فوراً على 10 أكواد استرداد للاستعمال مرة واحدة.
                  </p>
                </div>
              </div>

              <Field id="pk-name" label="اسم الجهاز لتمييزه في الإعدادات">
                <input
                  id="pk-name"
                  className={inputClassName}
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  placeholder="مثال: لابتوب العمل أو هاتفي"
                />
              </Field>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={handleEnrollPasskey}
              >
                <Fingerprint className="h-5 w-5" />
                {busy
                  ? 'بانتظار التأكيد من جهازك...'
                  : 'تفعيل الحساب وتأكيد الأمان الآن'}
              </Button>
            </>
          ) : (
            <div className="space-y-5">
              <AlertBanner tone="success" title="تم تفعيل حسابك بنجاح!">
                احفظ أكواد الاسترداد العشرة التالية في مكان آمن الآن. لن تُعرض هذه الأكواد مرة أخرى وتُخزن لدينا بشكل مشفر وغير قابل للاسترجاع.
              </AlertBanner>

              <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 sm:grid-cols-5">
                {recoveryCodes.map((code) => (
                  <code
                    key={code}
                    dir="ltr"
                    className="rounded-lg border border-[#22307A] bg-[#0F1A4A] px-2 py-2 text-center font-mono text-xs font-extrabold text-[#8CA2FF]"
                  >
                    {code}
                  </code>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyCodes}>
                  <Copy className="h-4 w-4" />
                  نسخ جميع الأكواد
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadCodes}>
                  <Download className="h-4 w-4" />
                  تحميل ملف نصي (.txt)
                </Button>
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-[#F5B94A]/45 bg-[#F5B94A]/12 p-3.5 text-sm font-bold text-[#F5B94A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgedSaved}
                  onChange={(e) => setAcknowledgedSaved(e.target.checked)}
                  className="h-4 w-4 accent-bosla-primary"
                />
                <span>
                  أقر أنني حفظت أكواد الاسترداد الاحتياطية في مكان آمن ولن أفقدها.
                </span>
              </label>

              <Button
                type="button"
                variant="success"
                size="lg"
                className="w-full"
                disabled={!acknowledgedSaved}
                onClick={() => router.push('/student')}
              >
                <CheckCircle2 className="h-5 w-5" />
                الدخول إلى لوحة التعلم
              </Button>
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
