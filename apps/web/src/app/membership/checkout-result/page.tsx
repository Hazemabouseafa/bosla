'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Button, Card } from '@/components/ui/primitives';

function CheckoutResultContent() {
  const searchParams = useSearchParams();
  const merchantOrderId = searchParams.get('merchantOrderId') || '';

  const [tx, setTx] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantOrderId) {
      setError('لم يتم تحديد رقم المعاملة.');
      setLoading(false);
      return;
    }
    apiFetch<any>(
      `/memberships/transactions/${encodeURIComponent(merchantOrderId)}`,
    )
      .then(setTx)
      .catch((err: any) =>
        setError(err?.message || 'تعذر التحقق من حالة المعاملة من الخادم.'),
      )
      .finally(() => setLoading(false));
  }, [merchantOrderId]);

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        {loading ? (
          <Card className="p-8 text-center text-sm font-bold text-bosla-muted">
            جاري التحقق من حالة المعاملة من قاعدة البيانات...
          </Card>
        ) : error ? (
          <AlertBanner tone="danger">{error}</AlertBanner>
        ) : (
          <Card className="p-8 text-center space-y-5">
            {tx?.status === 'PAID' ? (
              <>
                <CheckCircle2 className="mx-auto h-14 w-14 text-bosla-success" />
                <h1 className="text-2xl font-extrabold text-bosla-ink">
                  تم تفعيل عضويتك في بوصلة بنجاح!
                </h1>
                <p className="text-sm text-bosla-muted">
                  الباقة: <strong>{tx.plan?.nameAr}</strong> • المبلغ المؤكد:{' '}
                  <strong>{formatEgp(tx.amountCents)}</strong>
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Link href="/student">
                    <Button variant="primary" size="lg">
                      الانتقال إلى لوحة التعلم
                    </Button>
                  </Link>
                  <Link href="/courses">
                    <Button variant="outline" size="lg">
                      تصفح الكورسات المفتوحة
                    </Button>
                  </Link>
                </div>
              </>
            ) : tx?.status === 'PENDING' || tx?.status === 'INITIATED' ? (
              <>
                <Clock className="mx-auto h-14 w-14 text-bosla-amber" />
                <h1 className="text-2xl font-extrabold text-bosla-ink">
                  المعاملة قيد انتظار تأكيد Paymob
                </h1>
                <p className="text-sm text-bosla-muted">
                  لم يصل إشعار Webhook المؤكد بعد. حدّث الصفحة خلال لحظات أو راجع لوحتك.
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-14 w-14 text-rose-600" />
                <h1 className="text-2xl font-extrabold text-bosla-ink">
                  لم تكتمل عملية الدفع ({tx?.status})
                </h1>
                <p className="text-sm text-bosla-muted">
                  لم يتم خصم الاشتراك. يمكنك إعادة المحاولة من صفحة الأسعار.
                </p>
                <Link href="/pricing">
                  <Button variant="gold">العودة إلى خطط العضوية</Button>
                </Link>
              </>
            )}
          </Card>
        )}
      </section>
    </PublicPageLayout>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense
      fallback={
        <PublicPageLayout>
          <div className="py-20 text-center text-sm font-bold text-bosla-muted">
            جاري التحقق...
          </div>
        </PublicPageLayout>
      }
    >
      <CheckoutResultContent />
    </Suspense>
  );
}
