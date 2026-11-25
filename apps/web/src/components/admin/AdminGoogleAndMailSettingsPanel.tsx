'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react';
import { apiFetch, formatDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
} from '@/components/ui/primitives';

export function AdminGoogleAndMailSettingsPanel({
  mode = 'both',
}: {
  mode?: 'google' | 'mail' | 'both';
}) {
  const { pushToast } = useAuth();
  const [loading, setLoading] = useState(true);

  // Google OAuth state
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleSecretMasked, setGoogleSecretMasked] = useState('');
  const [googleCallbackUrl, setGoogleCallbackUrl] = useState('');
  const [googleReady, setGoogleReady] = useState<any>(null);
  const [replacingGoogleSecret, setReplacingGoogleSecret] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [copiedCb, setCopiedCb] = useState(false);

  // SMTP Mail state
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpPassMasked, setSmtpPassMasked] = useState('');
  const [replacingSmtpPass, setReplacingSmtpPass] = useState(false);
  const [fromName, setFromName] = useState('BOSLA Academy');
  const [fromEmail, setFromEmail] = useState('');
  const [smtpStatusInfo, setSmtpStatusInfo] = useState<any>(null);
  const [savingSmtp, setSavingSmtp] = useState(false);

  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [mailLogs, setMailLogs] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, mRes, logsRes] = await Promise.all([
        mode === 'mail' ? Promise.resolve(null) : apiFetch<any>('/admin/integrations/google'),
        mode === 'google' ? Promise.resolve(null) : apiFetch<any>('/admin/integrations/mail'),
        mode === 'google' ? Promise.resolve([]) : apiFetch<any[]>('/admin/integrations/mail/logs?limit=25'),
      ]);

      if (gRes) {
        setGoogleEnabled(Boolean(gRes.isEnabled));
        setGoogleClientId(gRes.clientId || '');
        setGoogleSecretMasked(gRes.clientSecretMasked || '');
        setGoogleClientSecret(gRes.clientSecretMasked || '');
        setReplacingGoogleSecret(!gRes.hasClientSecret);
        setGoogleCallbackUrl(gRes.callbackUrl || '');
        setGoogleReady(gRes);
      }

      if (mRes) {
        setSmtpEnabled(Boolean(mRes.isEnabled));
        setSmtpHost(mRes.host || '');
        setSmtpPort(String(mRes.port || 587));
        setSmtpSecure(Boolean(mRes.secure));
        setSmtpUser(mRes.username || '');
        setSmtpPassMasked(mRes.passwordMasked || '');
        setSmtpPass(mRes.passwordMasked || '');
        setReplacingSmtpPass(!mRes.hasPassword);
        setFromName(mRes.fromName || 'BOSLA Academy');
        setFromEmail(mRes.fromEmail || '');
        setSmtpStatusInfo(mRes);
      }

      if (Array.isArray(logsRes)) {
        setMailLogs(logsRes);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إعدادات التكاملات', 'error');
    } finally {
      setLoading(false);
    }
  }, [mode, pushToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSaveGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoogle(true);
    try {
      const payload: Record<string, unknown> = {
        isEnabled: googleEnabled,
        clientId: googleClientId.trim(),
      };
      if (replacingGoogleSecret || googleClientSecret !== googleSecretMasked) {
        payload.clientSecret = googleClientSecret.trim();
      }
      await apiFetch('/admin/integrations/google', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      pushToast('تم حفظ إعدادات تسجيل الدخول بحساب Google مع التشفير بنجاح', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ إعدادات Google', 'error');
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const payload: Record<string, unknown> = {
        isEnabled: smtpEnabled,
        host: smtpHost.trim(),
        port: Number(smtpPort || 587),
        secure: smtpSecure,
        username: smtpUser.trim(),
        fromName: fromName.trim() || 'BOSLA Academy',
        fromEmail: fromEmail.trim(),
      };
      if (replacingSmtpPass || smtpPass !== smtpPassMasked) {
        payload.password = smtpPass;
      }
      await apiFetch('/admin/integrations/mail', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      pushToast('تم حفظ إعدادات البريد الصادر (SMTP) بنجاح', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ إعدادات SMTP', 'error');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setSendingTest(true);
    try {
      const res = await apiFetch<any>('/admin/integrations/mail/test', {
        method: 'POST',
        body: JSON.stringify({ recipientEmail: testEmail.trim() }),
      });
      pushToast(res?.messageAr || 'تم إرسال رسالة الاختبار بنجاح', 'success');
      await loadAll();
    } catch (err: any) {
      pushToast(err?.message || 'فشل إرسال رسالة الاختبار', 'error');
      await loadAll();
    } finally {
      setSendingTest(false);
    }
  };

  const copyCallbackUrl = async () => {
    if (!googleCallbackUrl) return;
    await navigator.clipboard?.writeText(googleCallbackUrl).catch(() => {});
    setCopiedCb(true);
    pushToast('تم نسخ رابط الاستجابة (Callback URL)', 'success');
    setTimeout(() => setCopiedCb(false), 2000);
  };

  if (loading) {
    return (
      <Card className="p-6 text-sm text-[#A9B1E0]">
        جاري تحميل إعدادات التكاملات والبريد...
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {(mode === 'both' || mode === 'google') && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#8CA2FF]" />
                تسجيل الدخول عبر Google (OAuth 2.0 / OIDC)
              </h2>
              <p className="text-xs text-[#A9B1E0] mt-1">
                تفعيل وربط تسجيل الدخول بحساب جوجل في وقت التشغيل مع تشفير Client Secret بـ AES-256-GCM
                واشتراط توثيق البريد (email_verified).
              </p>
            </div>
            <Badge tone={googleReady?.readiness?.readyForSignIn ? 'success' : 'warning'}>
              {googleReady?.readiness?.readyForSignIn ? 'مفعّل وجاهز' : 'يحتاج ضبط التفعيل'}
            </Badge>
          </div>

          <div className="rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-4 space-y-2">
            <p className="text-xs font-bold text-[#EEF0FF]">
              رابط الاستجابة المعتمد لـ Google Cloud Console (Authorized Redirect URI)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 rounded-lg border border-[#8CA2FF]/20 bg-[#050A24] px-3 py-2 text-xs text-[#8CA2FF] break-all"
              >
                {googleCallbackUrl || 'https://academy.bosla.com/api/v1/auth/google/callback'}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyCallbackUrl}>
                {copiedCb ? <Check className="h-4 w-4 text-[#77E2B5]" /> : <Copy className="h-4 w-4" />}
                نسخ الرابط
              </Button>
            </div>
          </div>

          <form onSubmit={handleSaveGoogle} className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm font-bold text-[#EEF0FF] cursor-pointer">
              <input
                type="checkbox"
                checked={googleEnabled}
                onChange={(e) => setGoogleEnabled(e.target.checked)}
              />
              تفعيل زر تسجيل الدخول بحساب Google في صفحة الدخول والتسجيل
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Google Client ID">
                <input
                  dir="ltr"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Google Client Secret (مشفر)"
                hint={
                  googleReady?.hasClientSecret && !replacingGoogleSecret
                    ? 'محفوظ ومشفر بالكامل. اضغط تغيير لاستبدال السر.'
                    : undefined
                }
              >
                <div className="flex gap-2">
                  <input
                    dir="ltr"
                    type={replacingGoogleSecret ? 'text' : 'password'}
                    value={googleClientSecret}
                    onChange={(e) => {
                      setReplacingGoogleSecret(true);
                      setGoogleClientSecret(e.target.value);
                    }}
                    placeholder="GOCSPX-..."
                    className={inputClassName}
                    readOnly={!replacingGoogleSecret && Boolean(googleSecretMasked)}
                  />
                  {!replacingGoogleSecret && googleSecretMasked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplacingGoogleSecret(true);
                        setGoogleClientSecret('');
                      }}
                    >
                      تغيير
                    </Button>
                  )}
                </div>
              </Field>
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={savingGoogle}>
              <Save className="h-4 w-4" />
              {savingGoogle ? 'جاري الحفظ...' : 'حفظ إعدادات Google OAuth'}
            </Button>
          </form>
        </Card>
      )}

      {(mode === 'both' || mode === 'mail') && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#77E2B5]" />
                إعدادات البريد الصادر (Outbound SMTP Mail)
              </h2>
              <p className="text-xs text-[#A9B1E0] mt-1">
                تستخدم المنصة خادم SMTP لإرسال روابط توثيق البريد، استعادة الحساب، إشعارات مهام المدربين، وخطابات التوصية.
              </p>
            </div>
            <Badge tone={smtpStatusInfo?.readiness?.ready ? 'success' : 'warning'}>
              {smtpStatusInfo?.readiness?.ready ? 'خادم البريد جاهز' : 'غير مفعّل بعد'}
            </Badge>
          </div>

          {smtpStatusInfo?.lastVerifyMessageAr && (
            <AlertBanner
              tone={smtpStatusInfo.lastVerifyStatus === 'VERIFIED' ? 'success' : 'warning'}
              title={
                smtpStatusInfo.lastVerifyStatus === 'VERIFIED'
                  ? 'آخر فحص إرسال ناجح'
                  : 'تنبيه آخر محاولة اختبار'
              }
            >
              {smtpStatusInfo.lastVerifyMessageAr}
            </AlertBanner>
          )}

          <form onSubmit={handleSaveSmtp} className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2.5 text-sm font-bold text-[#EEF0FF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpEnabled}
                  onChange={(e) => setSmtpEnabled(e.target.checked)}
                />
                تفعيل إرسال رسائل البريد الإلكتروني من المنصة
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#A9B1E0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                />
                استخدام اتصال TLS/SSL مباشر (غالباً للمنفذ 465)
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="خادم SMTP (Host)">
                <input
                  dir="ltr"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.hostinger.com"
                  className={inputClassName}
                />
              </Field>
              <Field label="المنفذ (Port)">
                <input
                  dir="ltr"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className={inputClassName}
                />
              </Field>
              <Field label="اسم المُرسِل (From Name)">
                <input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="BOSLA Academy"
                  className={inputClassName}
                />
              </Field>
              <Field label="بريد المُرسِل (From Email)">
                <input
                  dir="ltr"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@boslaagri.com"
                  className={inputClassName}
                />
              </Field>
              <Field label="اسم المستخدم (SMTP User)">
                <input
                  dir="ltr"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="noreply@boslaagri.com"
                  className={inputClassName}
                />
              </Field>
              <Field label="كلمة المرور (مشفرة)">
                <div className="flex gap-2">
                  <input
                    dir="ltr"
                    type={replacingSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => {
                      setReplacingSmtpPass(true);
                      setSmtpPass(e.target.value);
                    }}
                    placeholder="••••••••"
                    className={inputClassName}
                    readOnly={!replacingSmtpPass && Boolean(smtpPassMasked)}
                  />
                  {!replacingSmtpPass && smtpPassMasked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplacingSmtpPass(true);
                        setSmtpPass('');
                      }}
                    >
                      تغيير
                    </Button>
                  )}
                </div>
              </Field>
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={savingSmtp}>
              <Save className="h-4 w-4" />
              {savingSmtp ? 'جاري الحفظ...' : 'حفظ إعدادات SMTP'}
            </Button>
          </form>

          {/* Test SMTP Send */}
          <form
            onSubmit={handleSendTestMail}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-4"
          >
            <div className="min-w-[240px] flex-1">
              <Field label="اختبار الإرسال الفعلي (أرسل رسالة اختبار الآن)">
                <input
                  dir="ltr"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="admin-test@example.com"
                  className={inputClassName}
                  required
                />
              </Field>
            </div>
            <Button type="submit" variant="success" size="sm" disabled={sendingTest}>
              <Send className="h-4 w-4" />
              {sendingTest ? 'جاري الاختبار...' : 'إرسال رسالة اختبار'}
            </Button>
          </form>

          {/* Outbound Email Logs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#EEF0FF]">سجل إرسال الرسائل الصادرة ({mailLogs.length})</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()}>
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </Button>
            </div>
            {mailLogs.length === 0 ? (
              <p className="text-xs text-[#A9B1E0]">لا توجد محاولات إرسال مسجلة حتى الآن.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#8CA2FF]/15">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#8CA2FF]/15">
                      <th className="p-2.5">المستلم</th>
                      <th className="p-2.5">التصنيف</th>
                      <th className="p-2.5">الموضوع</th>
                      <th className="p-2.5">الحالة</th>
                      <th className="p-2.5">التاريخ / التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailLogs.map((log) => (
                      <tr key={log.id} className="border-t border-[#8CA2FF]/10">
                        <td className="p-2.5" dir="ltr">{log.recipientEmail}</td>
                        <td className="p-2.5 text-[#A9B1E0]">{log.category}</td>
                        <td className="p-2.5">{log.subjectAr}</td>
                        <td className="p-2.5">
                          <Badge
                            tone={
                              log.status === 'SENT'
                                ? 'success'
                                : log.status === 'FAILED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {log.status === 'SENT' ? 'تم الإرسال' : log.status === 'FAILED' ? 'فشل' : 'قيد المحاولة'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-[#A9B1E0]">
                          <div>{formatDateTime(log.createdAt)}</div>
                          {log.lastErrorAr && (
                            <p className="text-[11px] text-[#FF9CAA] mt-0.5">{log.lastErrorAr}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
