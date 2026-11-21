'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { CheckCircle2, Fingerprint, HelpCircle, KeyRound, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Button,
  Card,
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

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-[#22307A] bg-[#070D2B] pb-28 pt-12 text-white">
        <div className="relative mx-auto max-w-xl px-4 text-center space-y-2.5 sm:px-6 hero-seq-1">
          <p className="text-xs sm:text-sm font-medium text-[#8CA2FF]">
            استرداد آمن للحساب
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl hero-seq-2">
            نسيت كلمة المرور؟ استعد حسابك بأمان
          </h1>
          <p className="text-sm text-slate-200/85 hero-seq-3">
            استخدم بصمة أو قفل جهازك المسجل، أو أحد أكواد الاسترداد، أو قدّم طلب مراجعة للدعم.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-20 max-w-xl px-4 pb-16 sm:px-6 space-y-6 hero-seq-4">

        <Card className="p-6 sm:p-8 space-y-6">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          {completed ? (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-bosla-success" />
              <h2 className="text-xl font-extrabold text-bosla-ink">
                تم تحديث كلمة المرور بنجاح
              </h2>
              <p className="text-sm text-bosla-muted">
                تم إغلاق جميع الجلسات القديمة لأمانك. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
              </p>
              <Link href="/login">
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
              <div className="flex items-center justify-between text-xs bg-bosla-bg rounded-xl p-3">
                <span>
                  الرقم: <strong dir="ltr">{phoneNumber}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIdentified(null)}
                  className="font-bold text-bosla-primary hover:underline cursor-pointer"
                >
                  تغيير الرقم
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMethod('passkey')}
                  className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                    activeMethod === 'passkey'
                      ? 'border-[#8CA2FF] bg-[#7C95FF] text-[#070D2B]'
                      : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#8CA2FF]'
                  }`}
                >
                  <Fingerprint className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'passkey' ? 'text-[#070D2B]' : 'text-[#8CA2FF]'}`} />
                  بصمة الجهاز
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMethod('code')}
                  className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                    activeMethod === 'code'
                      ? 'border-[#8CA2FF] bg-[#7C95FF] text-[#070D2B]'
                      : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#8CA2FF]'
                  }`}
                >
                  <KeyRound className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'code' ? 'text-[#070D2B]' : 'text-[#8CA2FF]'}`} />
                  كود استرداد
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMethod('support')}
                  className={`min-h-[44px] rounded-xl border p-2.5 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                    activeMethod === 'support'
                      ? 'border-[#8CA2FF] bg-[#7C95FF] text-[#070D2B]'
                      : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#8CA2FF]'
                  }`}
                >
                  <HelpCircle className={`mx-auto h-4 w-4 mb-1 ${activeMethod === 'support' ? 'text-[#070D2B]' : 'text-[#8CA2FF]'}`} />
                  مساعدة الدعم
                </button>
              </div>

              {activeMethod === 'passkey' && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-bosla-muted leading-relaxed">
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
                      className={`${inputClassName} font-mono`}
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
                      <p className="text-xs text-bosla-muted">
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
        </Card>
      </section>
    </PublicPageLayout>
  );
}
