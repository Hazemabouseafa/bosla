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
      <section className="bg-bosla-navy pb-20 pt-10 text-white">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h1 className="text-2xl font-extrabold">حالة معاملة الاشتراك</h1>
        </div>
      </section>
      <section className="relative z-10 mx-auto -mt-12 max-w-xl px-4 pb-16 sm:px-6">
        {loading ? (
          <Card className="p-8 text-center text-sm font-bold text-[#A9B1E0]">
            جاري التحقق من حالة المعاملة من قاعدة البيانات...
          </Card>
        ) : error ? (
          <AlertBanner tone="danger">{error}</AlertBanner>
        ) : (
          <Card className="p-8 text-center space-y-5">
            {tx?.status === 'PAID' ? (
              tx?.targetType === 'OFFLINE_EVENT' ? (
                <>
                  <CheckCircle2 className="mx-auto h-14 w-14 text-[#77E2B5]" />
                  <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                    تم تأكيد حجز مقعدك في الفعالية بنجاح!
                  </h1>
                  <p className="text-sm text-[#A9B1E0]">
                    الفعالية: <strong className="text-[#EEF0FF]">{tx.event?.titleAr}</strong> • المبلغ المؤكد:{' '}
                    <strong className="text-[#8CA2FF]">{formatEgp(tx.amountCents)}</strong>
                  </p>
                  {tx.eventRegistration?.ticketCode && (
                    <div className="mx-auto max-w-sm rounded-xl border border-[#77E2B5]/35 bg-[#0B1440] p-3 text-xs space-y-1">
                      <p className="text-[#A9B1E0]">كود التذكرة المعتمد للحضور</p>
                      <p dir="ltr" className="font-mono text-base font-extrabold text-[#77E2B5]">
                        {tx.eventRegistration.ticketCode}
                      </p>
                      {tx.event?.cityAr && (
                        <p className="text-[#A9B1E0]">
                          {tx.event.cityAr} — {tx.event.venueNameAr}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Link href="/student">
                      <Button variant="primary" size="lg">
                        عرض تذاكري في لوحة التعلم
                      </Button>
                    </Link>
                    {tx.event?.slug && (
                      <Link href={`/events/${tx.event.slug}`}>
                        <Button variant="outline" size="lg">
                          العودة لصفحة الفعالية
                        </Button>
                      </Link>
                    )}
                  </div>
                </>
              ) : tx?.targetType === 'COURSE' ||
                tx?.targetType === 'LEARNING_PATH' ||
                tx?.targetType === 'DIPLOMA' ? (
                <>
                  <CheckCircle2 className="mx-auto h-14 w-14 text-[#77E2B5]" />
                  <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                    تم تفعيل اشتراكك في البرنامج بنجاح!
                  </h1>
                  <p className="text-sm text-[#A9B1E0]">
                    البرنامج:{' '}
                    <strong className="text-[#EEF0FF]">
                      {tx.course?.publishedVersion?.titleAr ||
                        tx.learningPath?.titleAr ||
                        tx.diploma?.titleAr ||
                        'برنامج بوصلة'}
                    </strong>{' '}
                    • المبلغ المؤكد: <strong className="text-[#8CA2FF]">{formatEgp(tx.amountCents)}</strong>
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    {tx.course?.slug ? (
                      <Link href={`/learn/${tx.course.slug}`}>
                        <Button variant="primary" size="lg">
                          بدء دراسة الكورس الآن
                        </Button>
                      </Link>
                    ) : tx.learningPath?.slug ? (
                      <Link href={`/learning-paths/${tx.learningPath.slug}`}>
                        <Button variant="primary" size="lg">
                          فتح المسار التعليمي الآن
                        </Button>
                      </Link>
                    ) : tx.diploma?.slug ? (
                      <Link href={`/diplomas/${tx.diploma.slug}`}>
                        <Button variant="primary" size="lg">
                          فتح الدبلومة الآن
                        </Button>
                      </Link>
                    ) : null}
                    <Link href="/student">
                      <Button variant="outline" size="lg">
                        لوحة التعلم
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mx-auto h-14 w-14 text-[#77E2B5]" />
                  <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                    تم تفعيل عضويتك في بوصلة بنجاح!
                  </h1>
                  <p className="text-sm text-[#A9B1E0]">
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
              )
            ) : tx?.status === 'PENDING' || tx?.status === 'INITIATED' ? (
              <>
                <Clock className="mx-auto h-14 w-14 text-[#F5B94A]" />
                <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                  المعاملة قيد انتظار تأكيد الدفع
                </h1>
                <p className="text-sm text-[#A9B1E0]">
                  جاري انتظار تأكيد عملية الدفع من بوابة السداد. حدّث الصفحة خلال لحظات أو راجع لوحتك.
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-14 w-14 text-[#FF9CAA]" />
                <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                  لم تكتمل عملية الدفع
                </h1>
                <p className="text-sm text-[#A9B1E0]">
                  لم يتم خصم المبلغ. يمكنك إعادة المحاولة من صفحة الطلب.
                </p>
                <Link href={tx?.targetType === 'OFFLINE_EVENT' && tx?.event?.slug ? `/events/${tx.event.slug}` : '/pricing'}>
                  <Button variant="primary">
                    {tx?.targetType === 'OFFLINE_EVENT' ? 'العودة إلى صفحة الفعالية' : 'العودة إلى خطط العضوية'}
                  </Button>
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
