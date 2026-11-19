'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Compass, ShieldAlert } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Button, Card } from '@/components/ui/primitives';

export default function SellerReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [sellerCode, setSellerCode] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const nextPath = searchParams.get('next') || '/courses';

  useEffect(() => {
    const rawCode = decodeURIComponent(params?.code || '');
    if (!rawCode) {
      setStatus('invalid');
      setErrorMessage('كود الإحالة غير صالح أو غير متاح حالياً');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{
          valid: boolean;
          code?: string;
          sellerDisplayName?: string;
          message?: string;
        }>('/sellers/referrals/track', {
          method: 'POST',
          skipCsrf: true,
          body: JSON.stringify({
            code: rawCode,
            landingPath: nextPath,
            sourceTag: searchParams.get('src') || undefined,
          }),
        });
        if (cancelled) return;
        if (res.valid && res.code) {
          setSellerCode(res.code);
          setSellerName(res.sellerDisplayName || '');
          setStatus('valid');
        } else {
          setStatus('invalid');
          setErrorMessage(res.message || 'كود الإحالة غير صالح أو غير متاح حالياً');
        }
      } catch {
        if (!cancelled) {
          setStatus('invalid');
          setErrorMessage('كود الإحالة غير صالح أو غير متاح حالياً');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params?.code, nextPath, searchParams]);

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center space-y-5 border border-[#22307A] bg-[#0F1A4A]">
          {status === 'loading' && (
            <div className="space-y-3 py-6">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7C95FF]/20 text-[#8CA2FF]">
                <Compass className="h-7 w-7 animate-spin" />
              </div>
              <h1 className="text-xl font-extrabold text-[#EEF0FF]">جاري توثيق رابط الإحالة...</h1>
              <p className="text-sm text-[#A9B1E0]">سيتم حفظ كود البائع تلقائياً لتسهيل إتمام التسجيل.</p>
            </div>
          )}

          {status === 'valid' && (
            <div className="space-y-5">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-[#EEF0FF]">
                  أهلاً بك في أكاديمية بوصلة!
                </h1>
                <p className="text-sm text-[#A9B1E0]">
                  تم حفظ كود الإحالة <span dir="ltr" className="font-mono font-bold text-[#8CA2FF]">{sellerCode}</span>
                  {sellerName ? ` (${sellerName})` : ''} لمدة 30 يوماً، وسيظهر تلقائياً عند إتمام الطلب مع إمكانية تعديله أو إزالته في أي وقت.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="primary" onClick={() => router.push(nextPath.startsWith('/') ? nextPath : '/courses')}>
                  استعراض الكورسات الآن
                </Button>
                <Link href="/cart">
                  <Button variant="outline">الانتقال لسلة الشراء</Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-5">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <AlertBanner tone="warning" title="رابط إحالة غير نشط">
                {errorMessage}
              </AlertBanner>
              <Link href="/courses">
                <Button variant="primary">تصفح الكورسات المتاحة</Button>
              </Link>
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
