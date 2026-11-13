'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CreditCard, XCircle } from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

function SandboxCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantOrderId = searchParams.get('merchantOrderId') || '';
  const amountCents = Number(searchParams.get('amountCents') || '0');
  const planName = searchParams.get('planName') || 'عضوية أكاديمية بوصلة';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerOutcome = async (outcome: 'PAID' | 'FAILED') => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/payments/paymob/sandbox-simulate', {
        method: 'POST',
        body: JSON.stringify({ merchantOrderId, outcome }),
      });
      router.push(
        `/membership/checkout-result?merchantOrderId=${encodeURIComponent(
          merchantOrderId,
        )}`,
      );
    } catch (err: any) {
      setError(err?.message || 'تعذر محاكاة استجابة Webhook لبوابة Paymob.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8 space-y-5">
          <Badge tone="warning">بوابة الاختبار المحلية — Paymob Sandbox</Badge>
          <h1 className="text-2xl font-extrabold text-bosla-ink">
            تأكيد معاملة الدفع التجريبية
          </h1>
          <p className="text-xs leading-relaxed text-bosla-muted">
            ملاحظة: مفاتيح بوابة الدفع الحقيقية Paymob غير مفعلة في البيئة المحلية، لذلك تمر هذه المحاكاة عبر نقطة نهاية{' '}
            <code className="font-mono">Webhook + HMAC-SHA512</code> الفعلية في الخادم تماماً كما في الإنتاج.
          </p>

          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          <div className="rounded-2xl border border-bosla-line bg-bosla-bg/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-bosla-muted">الباقة:</span>
              <span className="font-extrabold text-bosla-ink">{planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bosla-muted">رقم الطلب المرجعي:</span>
              <span dir="ltr" className="font-mono text-xs font-bold text-bosla-navy">
                {merchantOrderId || '—'}
              </span>
            </div>
            <div className="flex justify-between border-t border-bosla-line pt-2">
              <span className="text-bosla-muted">الإجمالي:</span>
              <span className="text-lg font-extrabold text-bosla-primary">
                {formatEgp(amountCents)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <Button
              variant="success"
              size="lg"
              disabled={busy || !merchantOrderId}
              onClick={() => triggerOutcome('PAID')}
            >
              <CheckCircle2 className="h-5 w-5" />
              محاكاة دفع ناجح (HMAC)
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={busy || !merchantOrderId}
              onClick={() => triggerOutcome('FAILED')}
            >
              <XCircle className="h-5 w-5 text-rose-600" />
              محاكاة فشل الدفع
            </Button>
          </div>
          <p className="text-center text-xs text-bosla-muted flex items-center justify-center gap-1">
            <CreditCard className="h-3.5 w-3.5" />
            لن تُحفظ أي بيانات بطاقة داخل الخادم
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}

export default function SandboxCheckoutPage() {
  return (
    <Suspense
      fallback={
        <PublicPageLayout>
          <div className="py-20 text-center text-sm font-bold text-bosla-muted">
            جاري التجهيز...
          </div>
        </PublicPageLayout>
      }
    >
      <SandboxCheckoutContent />
    </Suspense>
  );
}
