'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export interface PublicPlan {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr: string;
  interval: 'MONTHLY' | 'ANNUAL';
  priceCents: number;
  compareAtPriceCents?: number | null;
  discountLabelAr?: string | null;
  currency: string;
  includedContent?: {
    courses: Array<{ id: string; slug: string; publishedVersion?: { titleAr: string } | null }>;
    learningPaths: Array<{ id: string; slug: string; titleAr: string }>;
    diplomas: Array<{ id: string; slug: string; titleAr: string }>;
  };
}

export function PricingClient({
  plans,
  highlightedSlug,
}: {
  plans: PublicPlan[];
  highlightedSlug?: string;
}) {
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, pushToast } = useAuth();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: PublicPlan) => {
    setError(null);
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/pricing?plan=${plan.slug}`)}`);
      return;
    }
    if (requiresPasskeyEnrollment) {
      router.push('/security/passkey-setup');
      return;
    }
    setBusyPlanId(plan.id);
    try {
      const res = await apiFetch<{
        merchantOrderId: string;
        mode: string;
        checkoutUrl: string;
        amountCents: number;
      }>('/memberships/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id }),
      });
      pushToast('تم تجهيز طلب الدفع عبر Paymob', 'info');
      if (res.mode === 'SANDBOX') {
        router.push(
          `/membership/sandbox-checkout?merchantOrderId=${encodeURIComponent(
            res.merchantOrderId,
          )}&amountCents=${res.amountCents}&planName=${encodeURIComponent(plan.nameAr)}`,
        );
      } else {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر بدء عملية الاشتراك حالياً');
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="space-y-8">
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isHighlighted =
            highlightedSlug ? plan.slug === highlightedSlug : plan.interval === 'ANNUAL';
          const includedCount =
            (plan.includedContent?.courses?.length ?? 0) +
            (plan.includedContent?.learningPaths?.length ?? 0) +
            (plan.includedContent?.diplomas?.length ?? 0);

          const features = [
            includedCount > 0
              ? `تفتح تلقائياً ${plan.includedContent?.courses?.length ?? 0} كورسات و${plan.includedContent?.learningPaths?.length ?? 0} مسار و${plan.includedContent?.diplomas?.length ?? 0} دبلومة`
              : 'وصول كامل لجميع الكورسات والمسارات المشمولة بالعضوية',
            'تحميل المرفقات والملفات التشغيلية PDF و Excel',
            'الاختبارات التفاعلية والشهادات الرسمية برمز التحقق',
            'تحديثات مستمرة للمحتوى طوال فترة سريان الاشتراك',
          ];

          return (
            <Card
              key={plan.id}
              className={`p-7 flex flex-col justify-between ${
                isHighlighted ? 'border-2 border-bosla-primary shadow-lg' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Badge tone={plan.interval === 'ANNUAL' ? 'warning' : 'info'}>
                    {plan.discountLabelAr ||
                      (plan.interval === 'ANNUAL' ? 'أفضل قيمة سنوية' : 'خطة شهرية')}
                  </Badge>
                  <span className="text-xs font-bold text-bosla-muted">
                    دفع آمن عبر Paymob
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold text-bosla-ink">{plan.nameAr}</h2>
                <p className="mt-2 text-sm text-bosla-muted">{plan.descriptionAr}</p>

                <div className="mt-6 flex items-baseline gap-2 border-y border-bosla-line py-4">
                  <span className="text-4xl font-extrabold text-bosla-navy">
                    {formatEgp(plan.priceCents)}
                  </span>
                  <span className="text-sm font-bold text-bosla-muted">
                    / {plan.interval === 'ANNUAL' ? 'سنة كاملة' : 'شهر'}
                  </span>
                  {plan.compareAtPriceCents && plan.compareAtPriceCents > plan.priceCents && (
                    <span className="text-xs line-through text-slate-400 ms-2">
                      {formatEgp(plan.compareAtPriceCents)}
                    </span>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 text-sm text-bosla-ink">
                  {features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-bosla-success shrink-0 mt-1" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 space-y-3">
                <Button
                  variant={isHighlighted ? 'primary' : 'outline'}
                  size="lg"
                  className="w-full"
                  disabled={busyPlanId === plan.id}
                  onClick={() => handleSubscribe(plan)}
                >
                  {busyPlanId === plan.id
                    ? 'جاري تحويلك لبوابة الدفع...'
                    : `اشترك في ${plan.nameAr} (${formatEgp(plan.priceCents)})`}
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {!user && (
                  <p className="text-center text-xs text-bosla-muted">
                    ليس لديك حساب؟{' '}
                    <Link href="/register" className="font-bold text-bosla-primary hover:underline">
                      أنشئ حساباً في ثوانٍ
                    </Link>
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="max-w-4xl mx-auto p-6 bg-indigo-50/70 border-indigo-200 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-bosla-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-bosla-ink">
              تفعيل فوري بعد تأكيد Webhook من بوابة Paymob
            </p>
            <p className="text-xs text-bosla-muted mt-1">
              لا يتم تفعيل أي اشتراك من المتصفح وحده؛ يتحقق الخادم من توقيع HMAC-SHA512 قبل فتح صلاحيات المشاهدة.
            </p>
          </div>
        </div>
        <Link href="/contact">
          <Button variant="outline" size="sm">
            باقات تدريب الشركات
          </Button>
        </Link>
      </Card>
    </div>
  );
}
