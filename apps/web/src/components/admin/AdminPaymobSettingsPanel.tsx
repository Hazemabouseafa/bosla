'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
} from '@/components/ui/primitives';

interface EnvFormState {
  apiKey: string;
  integrationIdCard: string;
  integrationIdWallet: string;
  iframeId: string;
  hmacSecret: string;
  publicKey: string;
  secretKey: string;
  hasApiKey?: boolean;
  hasHmacSecret?: boolean;
  hasSecretKey?: boolean;
}

const EMPTY_ENV: EnvFormState = {
  apiKey: '',
  integrationIdCard: '',
  integrationIdWallet: '',
  iframeId: '',
  hmacSecret: '',
  publicKey: '',
  secretKey: '',
};

export function AdminPaymobSettingsPanel() {
  const { pushToast } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [isEnabled, setIsEnabled] = useState(false);
  const [activeMode, setActiveMode] = useState<'TEST' | 'LIVE'>('TEST');
  const [editingTab, setEditingTab] = useState<'test' | 'live'>('test');
  const [testEnv, setTestEnv] = useState<EnvFormState>(EMPTY_ENV);
  const [liveEnv, setLiveEnv] = useState<EnvFormState>(EMPTY_ENV);

  // Track which secret fields the admin explicitly chose to replace
  const [replacingSecrets, setReplacingSecrets] = useState<Record<string, boolean>>({});
  const [webhooks, setWebhooks] = useState<{
    transactionProcessedCallbackUrl: string;
    transactionResponseReturnUrl: string;
  } | null>(null);
  const [readiness, setReadiness] = useState<{
    isReady: boolean;
    activeMode: string;
    missingFields: string[];
    summaryAr: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mapBackendToEnv = (res: any, prefix: 'test' | 'live'): EnvFormState => {
    const nested = res?.[prefix];
    const apiKeyVal = nested?.apiKey ?? res?.[`${prefix}ApiKeyMasked`] ?? '';
    const hmacVal = nested?.hmacSecret ?? res?.[`${prefix}HmacSecretMasked`] ?? '';
    const secretVal = nested?.secretKey ?? res?.[`${prefix}SecretKeyMasked`] ?? '';
    return {
      apiKey: apiKeyVal,
      integrationIdCard:
        nested?.integrationIdCard ?? res?.[`${prefix}IntegrationId`] ?? '',
      integrationIdWallet:
        nested?.integrationIdWallet ?? res?.[`${prefix}WalletIntegrationId`] ?? '',
      iframeId: nested?.iframeId ?? res?.[`${prefix}IframeId`] ?? '',
      hmacSecret: hmacVal,
      publicKey: nested?.publicKey ?? res?.[`${prefix}PublicKey`] ?? '',
      secretKey: secretVal,
      hasApiKey: Boolean(nested?.hasApiKey ?? apiKeyVal),
      hasHmacSecret: Boolean(nested?.hasHmacSecret ?? hmacVal),
      hasSecretKey: Boolean(nested?.hasSecretKey ?? secretVal),
    };
  };

  const mapBackendReadiness = (res: any, mode: 'TEST' | 'LIVE') => {
    const r = res?.readiness ?? res;
    const isReady = Boolean(
      r?.isReady ??
        r?.readyForActiveMode ??
        (mode === 'LIVE' ? r?.liveReady : r?.testReady),
    );
    const missingFields: string[] =
      r?.missingFields ??
      (mode === 'LIVE' ? r?.missingLiveFields : r?.missingTestFields) ??
      [];
    const summaryAr =
      r?.summaryAr ??
      r?.messageAr ??
      (isReady
        ? 'بوابة Paymob مكتملة الإعداد وجاهزة لاستقبال المدفوعات في الوضع النشط.'
        : 'يرجى استكمال الحقول المطلوبة لتفعيل الربط الكامل مع Paymob.');
    return {
      isReady,
      activeMode: mode,
      missingFields,
      summaryAr,
    };
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/admin/payments/paymob/config');
      const resolvedMode: 'TEST' | 'LIVE' =
        (res?.activeMode ?? res?.mode) === 'LIVE' ? 'LIVE' : 'TEST';
      setIsEnabled(Boolean(res?.isEnabled));
      setActiveMode(resolvedMode);
      setEditingTab(resolvedMode === 'LIVE' ? 'live' : 'test');
      setTestEnv(mapBackendToEnv(res, 'test'));
      setLiveEnv(mapBackendToEnv(res, 'live'));
      const wh = res?.webhooks;
      setWebhooks(
        wh
          ? {
              transactionProcessedCallbackUrl:
                wh.transactionProcessedCallbackUrl ??
                wh.transactionWebhookUrl ??
                '/api/v1/payments/paymob/webhook',
              transactionResponseReturnUrl:
                wh.transactionResponseReturnUrl ??
                wh.transactionCallbackUrl ??
                '/membership/checkout-result',
            }
          : null,
      );
      setReadiness(mapBackendReadiness(res, resolvedMode));
      setReplacingSecrets({});
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إعدادات Paymob', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await apiFetch<any>('/admin/payments/paymob/config', {
        method: 'PUT',
        body: JSON.stringify({
          isEnabled,
          mode: activeMode,
          currency: 'EGP',
          testApiKey: testEnv.apiKey,
          testIntegrationId: testEnv.integrationIdCard,
          testWalletIntegrationId: testEnv.integrationIdWallet,
          testIframeId: testEnv.iframeId,
          testHmacSecret: testEnv.hmacSecret,
          testPublicKey: testEnv.publicKey,
          testSecretKey: testEnv.secretKey,
          liveApiKey: liveEnv.apiKey,
          liveIntegrationId: liveEnv.integrationIdCard,
          liveWalletIntegrationId: liveEnv.integrationIdWallet,
          liveIframeId: liveEnv.iframeId,
          liveHmacSecret: liveEnv.hmacSecret,
          livePublicKey: liveEnv.publicKey,
          liveSecretKey: liveEnv.secretKey,
        }),
      });
      const resolvedMode: 'TEST' | 'LIVE' =
        (res?.activeMode ?? res?.mode) === 'LIVE' ? 'LIVE' : 'TEST';
      setIsEnabled(Boolean(res?.isEnabled));
      setActiveMode(resolvedMode);
      setTestEnv(mapBackendToEnv(res, 'test'));
      setLiveEnv(mapBackendToEnv(res, 'live'));
      setReadiness(mapBackendReadiness(res, resolvedMode));
      setReplacingSecrets({});
      pushToast(
        'تم تشفير وحفظ إعدادات Paymob بنجاح (AES-256-GCM)',
        'success',
      );
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ إعدادات Paymob', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyReadiness = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await apiFetch<any>('/admin/payments/paymob/verify', {
        method: 'POST',
      });
      const mapped = mapBackendReadiness(res, activeMode);
      setReadiness(mapped);
      pushToast(
        mapped.summaryAr || 'تم فحص جاهزية بوابة Paymob',
        mapped.isReady ? 'success' : 'info',
      );
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التحقق من جاهزية البوابة', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyUrl = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      pushToast('تم نسخ الرابط إلى الحافظة', 'success');
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      pushToast('تعذر النسخ التلقائي — يمكنك تحديد الرابط ونسخه يدوياً', 'info');
    }
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
        <p className="mt-2 text-sm font-semibold text-slate-300">
          جارٍ تحميل إعدادات بوابة الدفع Paymob المشفرة...
        </p>
      </Card>
    );
  }

  const currentEnv = editingTab === 'live' ? liveEnv : testEnv;
  const setCurrentEnv = (updater: (prev: EnvFormState) => EnvFormState) => {
    if (editingTab === 'live') {
      setLiveEnv(updater);
    } else {
      setTestEnv(updater);
    }
  };

  const renderSecretField = (opts: {
    fieldKey: 'apiKey' | 'hmacSecret' | 'secretKey';
    hasStoredFlag: boolean;
    label: string;
    hint: string;
    placeholder: string;
  }) => {
    const compositeKey = `${editingTab}_${opts.fieldKey}`;
    const isReplacing = Boolean(replacingSecrets[compositeKey]);
    const isLockedMasked = opts.hasStoredFlag && !isReplacing;

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-extrabold text-slate-100">{opts.label}</span>
            {opts.hasStoredFlag && (
              <Badge tone="success">
                <Lock className="h-3 w-3 inline ml-1" />
                محفوظ ومشفر
              </Badge>
            )}
          </div>

          {isLockedMasked ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid={`replace-secret-${compositeKey}`}
              onClick={() => {
                setReplacingSecrets((prev) => ({ ...prev, [compositeKey]: true }));
                setCurrentEnv((prev) => ({ ...prev, [opts.fieldKey]: '' }));
              }}
            >
              استبدال القيمة السرية
            </Button>
          ) : opts.hasStoredFlag && isReplacing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplacingSecrets((prev) => ({ ...prev, [compositeKey]: false }));
                void loadConfig();
              }}
            >
              إلغاء الاستبدال
            </Button>
          ) : null}
        </div>

        <input
          dir="ltr"
          type={isLockedMasked ? 'text' : 'password'}
          disabled={isLockedMasked}
          data-testid={`paymob-input-${compositeKey}`}
          value={currentEnv[opts.fieldKey]}
          onChange={(e) =>
            setCurrentEnv((prev) => ({ ...prev, [opts.fieldKey]: e.target.value }))
          }
          placeholder={opts.placeholder}
          className={`${inputClassName} font-mono text-xs ${
            isLockedMasked ? 'opacity-75 cursor-not-allowed bg-slate-950' : ''
          }`}
        />
        <p className="text-[11px] text-slate-400">{opts.hint}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="admin-paymob-settings-panel">
      {/* Top Header & Readiness Banner */}
      <Card className="p-5 sm:p-6 border-indigo-500/25 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">الإعدادات ← المدفوعات ← Paymob Egypt</Badge>
              <Badge tone={isEnabled ? 'success' : 'neutral'}>
                {isEnabled ? 'البوابة مفعّلة' : 'البوابة معطّلة'}
              </Badge>
              <Badge tone={activeMode === 'LIVE' ? 'danger' : 'warning'}>
                {activeMode === 'LIVE'
                  ? 'وضع الإنتاج الفعلي (LIVE)'
                  : 'وضع الاختبار (TEST / SANDBOX)'}
              </Badge>
            </div>
            <h2 className="mt-1.5 text-lg sm:text-xl font-extrabold text-slate-100">
              إعداد وتجهيز بوابة الدفع الإلكتروني Paymob (مصر — EGP)
            </h2>
            <p className="text-xs text-slate-400">
              تُحفظ المفاتيح السرية مشفّرة بالكامل على الخادم بمعيار AES-256-GCM ولا تُرسل للمتصفح بعد الحفظ إلا في صورة مقنّعة (`••••••••1234`).
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="paymob-verify-readiness-btn"
            disabled={verifying}
            onClick={() => void handleVerifyReadiness()}
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            فحص جاهزية الربط الآن
          </Button>
        </div>

        {/* Readiness Status Box */}
        {readiness && (
          <div data-testid="paymob-readiness-status">
            <AlertBanner
              tone={readiness.isReady ? 'success' : 'warning'}
              title={
                readiness.isReady
                  ? 'بوابة Paymob مكتملة الإعداد وجاهزة لاستقبال المدفوعات'
                  : 'حالة جاهزية الربط والحقول المتبقية'
              }
            >
              <p className="text-xs font-semibold">{readiness.summaryAr}</p>
              {readiness.missingFields.length > 0 && (
                <p className="mt-1 text-xs">
                  الحقول المطلوبة المتبقية في الوضع النشط:{' '}
                  <strong>{readiness.missingFields.join(' ، ')}</strong>
                </p>
              )}
            </AlertBanner>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left/Start Form Column (7 cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-5">
            {/* Enable / Disable & Active Mode Selection */}
            <div className="grid gap-4 sm:grid-cols-2 border-b border-slate-800 pb-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-slate-100">
                      تفعيل الدفع عبر Paymob
                    </p>
                    <p className="text-[11px] text-slate-400">
                      السماح بعمليات الدفع الإلكتروني بالبطاقات والمحافظ
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    data-testid="paymob-enable-toggle"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="h-5 w-5 rounded accent-indigo-600"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
                <span className="text-xs font-extrabold text-slate-100">
                  البيئة النشطة حالياً على الموقع:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="paymob-active-mode-test"
                    onClick={() => {
                      setActiveMode('TEST');
                      setEditingTab('test');
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors ${
                      activeMode === 'TEST'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    وضع الاختبار (Test)
                  </button>
                  <button
                    type="button"
                    data-testid="paymob-active-mode-live"
                    onClick={() => {
                      setActiveMode('LIVE');
                      setEditingTab('live');
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors ${
                      activeMode === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    وضع الإنتاج (Live)
                  </button>
                </div>
              </div>
            </div>

            {/* Environment Tabs for Independent Test vs Live Credentials */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                <button
                  type="button"
                  data-testid="paymob-tab-test-creds"
                  onClick={() => setEditingTab('test')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold ${
                    editingTab === 'test'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  بيانات بيئة الاختبار (Test Keys)
                </button>
                <button
                  type="button"
                  data-testid="paymob-tab-live-creds"
                  onClick={() => setEditingTab('live')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold ${
                    editingTab === 'live'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  بيانات بيئة الإنتاج (Live Keys)
                </button>
              </div>
              <Badge tone="info">
                {editingTab === 'live' ? 'تعديل مفاتيح Live' : 'تعديل مفاتيح Test'}
              </Badge>
            </div>

            {/* Non-Secret Integration & iFrame IDs */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Card Integration ID *"
                hint="رقم تكامل البطاقات البنكية (Visa / MasterCard / Meeza)"
              >
                <input
                  dir="ltr"
                  data-testid={`paymob-input-${editingTab}_integrationIdCard`}
                  value={currentEnv.integrationIdCard}
                  onChange={(e) =>
                    setCurrentEnv((prev) => ({
                      ...prev,
                      integrationIdCard: e.target.value.trim(),
                    }))
                  }
                  placeholder="مثال: 4512390"
                  className={`${inputClassName} font-mono text-xs`}
                />
              </Field>

              <Field
                label="Wallet Integration ID"
                hint="رقم تكامل المحافظ الإلكترونية (فودافون كاش وغيرها — اختياري)"
              >
                <input
                  dir="ltr"
                  data-testid={`paymob-input-${editingTab}_integrationIdWallet`}
                  value={currentEnv.integrationIdWallet}
                  onChange={(e) =>
                    setCurrentEnv((prev) => ({
                      ...prev,
                      integrationIdWallet: e.target.value.trim(),
                    }))
                  }
                  placeholder="مثال: 4512391"
                  className={`${inputClassName} font-mono text-xs`}
                />
              </Field>

              <Field
                label="iFrame ID *"
                hint="رقم إطار الدفع من قسم Developers → iFrames"
              >
                <input
                  dir="ltr"
                  data-testid={`paymob-input-${editingTab}_iframeId`}
                  value={currentEnv.iframeId}
                  onChange={(e) =>
                    setCurrentEnv((prev) => ({
                      ...prev,
                      iframeId: e.target.value.trim(),
                    }))
                  }
                  placeholder="مثال: 841025"
                  className={`${inputClassName} font-mono text-xs`}
                />
              </Field>
            </div>

            {/* Encrypted & Masked Secret Keys */}
            <div className="space-y-3">
              {renderSecretField({
                fieldKey: 'apiKey',
                hasStoredFlag: Boolean(currentEnv.hasApiKey),
                label: 'API Key (مفتاح الربط الرئيسي) *',
                hint: 'من لوحة Paymob Accept ← Developers ← API Keys',
                placeholder: 'أدخل Paymob API Key...',
              })}

              {renderSecretField({
                fieldKey: 'hmacSecret',
                hasStoredFlag: Boolean(currentEnv.hasHmacSecret),
                label: 'HMAC Secret (مفتاح التحقق من توقيع المعاملات) *',
                hint: 'يُستخدم للتحقق الإلزامي من صحة توقيع SHA-512 لجميع إشعارات Webhook قبل تفعيل الاشتراك',
                placeholder: 'أدخل Paymob HMAC Secret...',
              })}

              <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
                <summary className="cursor-pointer text-xs font-extrabold text-indigo-300">
                  مفاتيح Paymob Unified Checkout (Intention API v1 — اختياري)
                </summary>
                <div className="mt-3 space-y-3">
                  <Field
                    label="Public Key (المفتاح العام pk_test_... / pk_live_...)"
                    hint="يُستخدم في حالة الاعتماد على واجهة الدفع الموحدة الجديدة Intention API"
                  >
                    <input
                      dir="ltr"
                      data-testid={`paymob-input-${editingTab}_publicKey`}
                      value={currentEnv.publicKey}
                      onChange={(e) =>
                        setCurrentEnv((prev) => ({
                          ...prev,
                          publicKey: e.target.value.trim(),
                        }))
                      }
                      placeholder="egy_pk_test_..."
                      className={`${inputClassName} font-mono text-xs`}
                    />
                  </Field>

                  {renderSecretField({
                    fieldKey: 'secretKey',
                    hasStoredFlag: Boolean(currentEnv.hasSecretKey),
                    label: 'Secret Key (المفتاح السري sk_test_... / sk_live_...)',
                    hint: 'يُحفظ مشفراً على الخادم ولا يُرسل للمتصفح أبداً',
                    placeholder: 'egy_sk_test_...',
                  })}
                </div>
              </details>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                data-testid="paymob-save-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ تشفير وحفظ الإعدادات...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    حفظ وتشفير إعدادات Paymob
                  </>
                )}
              </Button>
            </div>
          </Card>
        </form>

        {/* Right/End Column: Copyable Webhook URLs + Step-by-Step Arabic Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Copyable Webhook & Callback URLs */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-extrabold text-slate-100">
                روابط الـ Webhook والـ Callback الجاهزة للنسخ
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              انسخ هذين الرابطين وضعهما داخل إعدادات كل Integration ID في لوحة Paymob Accept لضمان تفعيل الاشتراكات تلقائياً فور الدفع:
            </p>

            {webhooks && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-300">
                      1. Transaction Processed Callback (Server Webhook)
                    </span>
                    <button
                      type="button"
                      data-testid="copy-paymob-webhook-url"
                      onClick={() =>
                        void handleCopyUrl(
                          'webhook',
                          webhooks.transactionProcessedCallbackUrl,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-950 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-indigo-900"
                    >
                      {copiedKey === 'webhook' ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code
                    dir="ltr"
                    className="block truncate rounded bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300 font-mono"
                  >
                    {webhooks.transactionProcessedCallbackUrl}
                  </code>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-300">
                      2. Transaction Response Callback (Browser Return URL)
                    </span>
                    <button
                      type="button"
                      data-testid="copy-paymob-return-url"
                      onClick={() =>
                        void handleCopyUrl(
                          'return',
                          webhooks.transactionResponseReturnUrl,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-950 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:bg-indigo-900"
                    >
                      {copiedKey === 'return' ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code
                    dir="ltr"
                    className="block truncate rounded bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300 font-mono"
                  >
                    {webhooks.transactionResponseReturnUrl}
                  </code>
                </div>
              </div>
            )}
          </Card>

          {/* Arabic Step-by-Step Paymob Egypt Onboarding Guide */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-extrabold text-slate-100">
                دليل الحصول على بيانات حساب بوصلة من لوحة Paymob Egypt
              </h3>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-300 leading-relaxed list-decimal list-inside">
              <li>
                سجّل الدخول إلى لوحة تحكم{' '}
                <strong className="text-white">Paymob Accept Egypt</strong> وانتقل إلى قائمة{' '}
                <strong className="text-indigo-300">Developers → API Keys</strong> لنسخ كل من{' '}
                <code className="text-indigo-200">API Key</code> و{' '}
                <code className="text-indigo-200">HMAC Secret</code> (ومفاتيح{' '}
                <code className="text-indigo-200">Public / Secret Key</code> إن وجدت).
              </li>
              <li>
                انتقل إلى <strong className="text-indigo-300">Developers → Payment Integrations</strong>{' '}
                واختر بوابة البطاقات البنكية (Online Card) لنسخ رقم{' '}
                <code className="text-indigo-200">Integration ID</code>، والصق رابطَي الـ Webhook والـ Callback الموضحين أعلاه داخل إعدادات الـ Integration.
              </li>
              <li>
                انتقل إلى <strong className="text-indigo-300">Developers → iFrames</strong> لنسخ رقم{' '}
                <code className="text-indigo-200">iFrame ID</code> المعتمد لصفحة إدخال بيانات البطاقة.
              </li>
              <li>
                <strong className="text-amber-300">خطوات التفعيل الخارجية لدى Paymob:</strong> للانتقال من وضع الاختبار (Test) إلى وضع الإنتاج الفعلي (Live)، يتطلب حساب شركة بوصلة في Paymob استكمال مراجعة المستندات القانونية والبنكية (KYC) وتفعيل بوابات الدفع الحية (Live Integrations) من جانب فريق حسابات Paymob.
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
