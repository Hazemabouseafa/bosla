'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { ArrowRight, Fingerprint, HelpCircle, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import { StatusCheckSvg } from '@/components/svg/StatusCheckSvg';
import {
  AlertBanner,
  Button,
  Field,
  PasswordInput,
  inputClassName,
} from '@/components/ui/primitives';

export default function RecoveryPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [identified, setIdentified] = useState<{
    canSelfRecover: boolean;
    methods: { passkey: boolean; recoveryCode: boolean; supportAssisted: boolean };
  } | null>(null);

  const [activeMethod, setActiveMethod] = useState<'passkey' | 'code' | 'support'>('passkey');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [supportName, setSupportName] = useState('');
  const [supportNotes, setSupportNotes] = useState('');
  const [supportTicket, setSupportTicket] = useState<string | null>(null);

  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{
        canSelfRecover: boolean;
        methods: { passkey: boolean; recoveryCode: boolean; supportAssisted: boolean };
      }>('/auth/recovery/identify', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({ countryCode: '+20', phoneNumber: phoneNumber.trim() }),
      });
      setIdentified(res);
      if (res.methods.passkey) setActiveMethod('passkey');
      else if (res.methods.recoveryCode) setActiveMethod('code');
      else setActiveMethod('support');
    } catch (err: any) {
      setError(err?.message || 'تعذر التحقق من رقم الموبايل المدخل');
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeyRecovery = async () => {
    setError(null);
    setBusy(true);
    try {
      const options = await apiFetch<any>('/auth/recovery/passkey/options', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({ countryCode: '+20', phoneNumber: phoneNumber.trim() }),
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      const res = await apiFetch<{ resetToken: string }>('/auth/recovery/passkey/verify', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          countryCode: '+20',
          phoneNumber: phoneNumber.trim(),
          response: assertion,
        }),
      });
      setResetToken(res.resetToken);
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق عبر الجهاز، يمكنك تجربة كود الاسترداد أو الدعم.');
    } finally {
      setBusy(false);
    }
  };

  const handleCodeRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ resetToken: string }>('/auth/recovery/code/verify', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          countryCode: '+20',
          phoneNumber: phoneNumber.trim(),
          recoveryCode,
        }),
      });
      setResetToken(res.resetToken);
    } catch (err: any) {
      setError(err?.message || 'كود الاسترداد غير صحيح أو مستخدم مسبقاً');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/recovery/reset-password', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      setCompleted(true);
    } catch (err: any) {
      setError(err?.message || 'تعذر تعيين كلمة المرور الجديدة');
    } finally {
      setBusy(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ requestId: string }>('/auth/recovery/support-request', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          countryCode: '+20',
          phoneNumber: phoneNumber.trim(),
          fullName: supportName,
          notes: supportNotes,
        }),
      });
      setSupportTicket(res.requestId || 'PENDING-REVIEW');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال طلب المساعدة');
    } finally {
      setBusy(false);
    }
  };

  const currentStage = completed
    ? 3
    : resetToken
      ? 3
      : identified
        ? 2
        : 1;

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden bg-[#070D2B] py-12 sm:py-16 text-[#EEF0FF]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-35"
        />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8 space-y-3">
              <p className="hero-seq-1 inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#C084FC]">
                <ShieldCheck className="h-4 w-4 text-[#77E2B5]" />
                <span>استرداد آمن للحساب</span>
              </p>
              <h1 className="hero-seq-2 text-3xl font-extrabold sm:text-4xl leading-[1.38]">
                نسيت كلمة المرور؟ استعد حسابك بأمان
              </h1>
              <p className="hero-seq-3 text-sm sm:text-base text-[#A9B1E0]">
                استخدم بصمة أو قفل جهازك المسجل، أو أحد أكواد الاسترداد، أو قدّم طلب مراجعة للدعم.
              </p>
            </div>
            <div className="hidden lg:flex lg:col-span-4 justify-end">
              <BoslaCompassSvg
                variant="seal"
                bearingDeg={currentStage * 30}
                className="h-28 w-28"
              />
            </div>
          </div>

          {/* 3-Step Recovery Progress Rail */}
          <ol className="hero-seq-3 grid grid-cols-3 gap-2 sm:gap-4 text-xs">
            {[
              { step: 1, label: 'تحديد الحساب' },
              { step: 2, label: 'التحقق من الهوية' },
              { step: 3, label: 'تعيين كلمة جديدة' },
            ].map((item) => (
              <li
                key={item.step}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  currentStage >= item.step
                    ? 'border-[#8CA2FF]/45 bg-[#0F1A4A] text-[#EEF0FF]'
                    : 'border-[#8CA2FF]/14 bg-[#0B1440]/60 text-[#A9B1E0]'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${
                    currentStage >= item.step
                      ? 'bg-[#6B21A8] text-white'
                      : 'border border-[#8CA2FF]/20 bg-[#0B1440] text-[#A9B1E0]'
                  }`}
                >
                  {item.step}
                </span>
                <span className="truncate font-semibold">{item.label}</span>
              </li>
            ))}
          </ol>

          <div
            data-sc-spotlight=""
            className="hero-seq-4 bosla-liquid-glass-portal mx-auto max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6"
          >
            {error && <AlertBanner tone="danger">{error}</AlertBanner>}

            {completed ? (
              <div className="space-y-4 text-center py-4">
                <StatusCheckSvg size={52} tone="emerald" className="mx-auto" />
                <h2 className="text-xl font-extrabold text-[#EEF0FF]">
                  تم تحديث كلمة المرور بنجاح
                </h2>
                <p className="text-sm text-[#A9B1E0]">
                  تم إغلاق جميع الجلسات القديمة لأمانك. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
                </p>
                <Link href="/login" className="block pt-2">
                  <Button variant="primary" size="lg" className="w-full">
                    الانتقال لتسجيل الدخول
                  </Button>
                </Link>
              </div>
            ) : resetToken ? (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <AlertBanner tone="success">
                  تم التحقق من هويتك بنجاح! أدخل كلمة المرور الجديدة الآن.
                </AlertBanner>
                <Field id="rst-pass" label="كلمة المرور الجديدة" required>
                  <PasswordInput
                    id="rst-pass"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Field>
                <Field id="rst-confirm" label="تأكيد كلمة المرور الجديدة" required>
                  <PasswordInput
                    id="rst-confirm"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                  <Lock className="h-4 w-4" />
                  {busy ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}
                </Button>
              </form>
            ) : !identified ? (
              <form onSubmit={handleIdentify} className="space-y-4">
                <Field id="rec-phone" label="رقم الموبايل المسجل" required>
                  <input
                    id="rec-phone"
                    type="tel"
                    dir="ltr"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="01012345678"
                    className={inputClassName}
                    required
                  />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                  {busy ? 'جاري البحث...' : 'متابعة خيارات الاسترداد'}
                </Button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs rounded-xl border border-[#8CA2FF]/18 bg-[#0B1440]/85 p-3">
                  <span>
                    الرقم: <strong dir="ltr" className="tabular-nums">{phoneNumber}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIdentified(null)}
                    className="font-bold text-[#8CA2FF] hover:underline cursor-pointer"
                  >
                    تغيير الرقم
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMethod('passkey')}
                    className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                      activeMethod === 'passkey'
                        ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                        : 'border-[#8CA2FF]/18 bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50'
                    }`}
                  >
                    <Fingerprint className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'passkey' ? 'text-white' : 'text-[#C084FC]'}`} />
                    بصمة الجهاز
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMethod('code')}
                    className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                      activeMethod === 'code'
                        ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                        : 'border-[#8CA2FF]/18 bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50'
                    }`}
                  >
                    <KeyRound className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'code' ? 'text-white' : 'text-[#C084FC]'}`} />
                    كود استرداد
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMethod('support')}
                    className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                      activeMethod === 'support'
                        ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                        : 'border-[#8CA2FF]/18 bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50'
                    }`}
                  >
                    <HelpCircle className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'support' ? 'text-white' : 'text-[#C084FC]'}`} />
                    مساعدة الدعم
                  </button>
                </div>

                {activeMethod === 'passkey' && (
                  <div className="space-y-4 pt-2">
                    <p className="text-xs sm:text-sm text-[#A9B1E0] leading-relaxed">
                      الطريقة الأسرع والأعلى أماناً: اضغط بالأسفل وتأكد ببصمة الجهاز أو مفتاح الأمان المسجل للحصول على إذن تغيير كلمة المرور فوراً.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={busy || !identified.methods.passkey}
                      onClick={handlePasskeyRecovery}
                    >
                      <Fingerprint className="h-5 w-5" />
                      {!identified.methods.passkey
                        ? 'لا يوجد جهاز موثق مسجل لهذا الرقم'
                        : busy
                        ? 'بانتظار تأكيد الجهاز...'
                        : 'التحقق عبر جهازك الآن'}
                    </Button>
                  </div>
                )}

                {activeMethod === 'code' && (
                  <form onSubmit={handleCodeRecovery} className="space-y-4 pt-2">
                    <Field
                      id="rec-code"
                      label="أحد أكواد الاسترداد الـ 10 (تُستهلك مرة واحدة)"
                      required
                    >
                      <input
                        id="rec-code"
                        dir="ltr"
                        className={`${inputClassName} font-mono tabular-nums`}
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX"
                        required
                      />
                    </Field>
                    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                      {busy ? 'جاري التحقق من الكود...' : 'التحقق واستهلاك الكود'}
                    </Button>
                  </form>
                )}

                {activeMethod === 'support' && (
                  <div className="pt-2">
                    {supportTicket ? (
                      <AlertBanner tone="success" title="تم استلام طلب التحقق من الهوية">
                        رقم المرجع: <strong dir="ltr">{supportTicket}</strong>. سيقوم مسؤولو الإدارة بمراجعة الطلب والتأكد من ملكية الحساب قبل تفعيل الاستعادة.
                      </AlertBanner>
                    ) : (
                      <form onSubmit={handleSupportSubmit} className="space-y-4">
                        <p className="text-xs sm:text-sm text-[#A9B1E0]">
                          في حال تعذر الوصول إلى جهازك الموثق وأكواد الاسترداد، أرسل طلباً ليراجعه فريق دعم بوصلة.
                        </p>
                        <Field id="sup-name" label="الاسم الكامل المسجل" required>
                          <input
                            id="sup-name"
                            className={inputClassName}
                            value={supportName}
                            onChange={(e) => setSupportName(e.target.value)}
                            required
                          />
                        </Field>
                        <Field id="sup-notes" label="تفاصيل للتحقق من ملكيتك للحساب" required>
                          <textarea
                            id="sup-notes"
                            rows={3}
                            className={inputClassName}
                            value={supportNotes}
                            onChange={(e) => setSupportNotes(e.target.value)}
                            placeholder="اذكر آخر كورس شاهدته أو تفاصيل الاشتراك..."
                            required
                            minLength={10}
                          />
                        </Field>
                        <Button type="submit" variant="navy" className="w-full" disabled={busy}>
                          {busy ? 'جاري الإرسال...' : 'إرسال طلب استرداد للدعم الإداري'}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-[#8CA2FF]/14 pt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#A9B1E0] hover:text-[#EEF0FF]"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى صفحة تسجيل الدخول</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
