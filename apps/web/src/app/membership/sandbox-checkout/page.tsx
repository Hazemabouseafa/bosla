'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CreditCard, XCircle } from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

function SandboxCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantOrderId = searchParams.get('merchantOrderId') || '';
  const queryAmountCents = Number(searchParams.get('amountCents') || '0');
  const queryItemName = searchParams.get('planName') || '';

  const [txInfo, setTxInfo] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantOrderId) return;
    apiFetch<any>(`/memberships/transactions/${encodeURIComponent(merchantOrderId)}`)
      .then(setTxInfo)
      .catch(() => {});
  }, [merchantOrderId]);

  const amountCents = Number(txInfo?.amountCents ?? queryAmountCents ?? 0);
  const isEvent = txInfo?.targetType === 'OFFLINE_EVENT' || merchantOrderId.startsWith('BOSLA-EVT-');
  const itemName =
    txInfo?.plan?.nameAr ||
    txInfo?.event?.titleAr ||
    queryItemName ||
    (isEvent ? 'تذكرة فعالية / كورس أوفلاين' : 'عضوية أكاديمية بوصلة');

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
      setError(err?.message || 'تعذر تأكيد استجابة بوابة الدفع التجريبية.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <section className="bg-bosla-navy pb-20 pt-10 text-white">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6 space-y-2">
          <Badge tone="warning">بوابة الدفع التجريبية</Badge>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            تأكيد معاملة الدفع التجريبية
          </h1>
        </div>
      </section>
      <section className="relative z-10 mx-auto -mt-12 max-w-xl px-4 pb-16 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8 space-y-5">
          <p className="text-sm leading-[1.7] text-[#A9B1E0]">
            {isEvent
              ? 'ملاحظة: هذه واجهة دفع إلكتروني تجريبية لاختبار حجز مقاعد الفعالية الأوفلاين وتأكيد التذكرة محلياً دون خصم أي مبالغ حقيقية.'
              : 'ملاحظة: هذه واجهة دفع تجريبية لاختبار خطوات تفعيل العضوية محلياً دون خصم أي مبالغ حقيقية.'}
          </p>

          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-[#A9B1E0]">{isEvent ? 'الفعالية:' : 'الباقة:'}</span>
              <span className="font-extrabold text-[#EEF0FF] text-end">{itemName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A9B1E0]">رقم الطلب المرجعي:</span>
              <span dir="ltr" className="font-mono text-xs font-bold text-[#8CA2FF]">
                {merchantOrderId || '—'}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#22307A] pt-2">
              <span className="text-[#A9B1E0]">الإجمالي:</span>
              <span className="text-lg font-extrabold text-[#8CA2FF]">
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
              تأكيد دفع تجريبي ناجح
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={busy || !merchantOrderId}
              onClick={() => triggerOutcome('FAILED')}
            >
              <XCircle className="h-5 w-5 text-[#FF9CAA]" />
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
