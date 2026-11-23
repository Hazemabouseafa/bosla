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
      pushToast('تم تجهيز طلب الدفع الإلكتروني', 'info');
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
            'الاختبارات التفاعلية والشهادات الرسمية (شهادة الحضور + طلب شهادة الكفاءة)',
            'وصول لمجتمع المشتركين العام للأسئلة والأجوبة بالإضافة لمجتمعات الكورسات',
          ];

          return (
            <div
              key={plan.id}
              className={`scroll-reveal-zoom bosla-card-hover flex flex-col justify-between rounded-2xl p-7 ${
                isHighlighted
                  ? 'relative overflow-hidden border border-[#C084FC]/60 bg-[#18266E] text-[#EEF0FF]'
                  : 'border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF]'
              }`}
            >
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Badge tone={plan.interval === 'ANNUAL' ? 'purple' : 'info'}>
                    {plan.discountLabelAr ||
                      (plan.interval === 'ANNUAL' ? 'أفضل قيمة سنوية' : 'خطة شهرية')}
                  </Badge>
                  <span className="text-xs sm:text-sm font-bold text-[#C084FC]">
                    دفع إلكتروني آمن
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold text-[#EEF0FF]">
                  {plan.nameAr}
                </h2>
                <p className="mt-2 text-base leading-[1.7] text-[#A9B1E0]">
                  {plan.descriptionAr}
                </p>

                <div className="mt-6 flex items-baseline gap-2 border-y border-[#22307A] py-4 tabular-nums">
                  <span className="text-4xl font-extrabold text-[#EEF0FF]">
                    {formatEgp(plan.priceCents)}
                  </span>
                  <span className="text-sm font-bold text-[#C084FC]">
                    / {plan.interval === 'ANNUAL' ? 'سنة كاملة' : 'شهر'}
                  </span>
                  {plan.compareAtPriceCents && plan.compareAtPriceCents > plan.priceCents && (
                    <span className="text-sm line-through ms-2 text-[#A9B1E0]">
                      {formatEgp(plan.compareAtPriceCents)}
                    </span>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 text-sm sm:text-base text-[#EEF0FF]">
                  {features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-1 text-[#77E2B5]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative mt-8 space-y-3">
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
                <p className="text-center text-xs sm:text-sm flex items-center justify-center gap-1.5 text-[#A9B1E0]">
                  <ShieldCheck className="h-4 w-4 text-[#8CA2FF]" />
                  تفعيل فوري للصلاحية بعد تأكيد الدفع الإلكتروني
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Included Content Preview */}
      {plans[0]?.includedContent && (
        <Card className="scroll-reveal-up p-6 max-w-4xl mx-auto">
          <h3 className="text-base font-extrabold text-[#EEF0FF] mb-4">
            المحتوى المشمول حالياً ضمن باقات العضوية
          </h3>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
              <p className="font-extrabold text-[#8CA2FF] mb-2">
                الكورسات ({plans[0].includedContent.courses.length})
              </p>
              <ul className="space-y-1.5 text-[#A9B1E0]">
                {plans[0].includedContent.courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/courses/${c.slug}`} className="hover:text-[#8CA2FF] hover:underline font-bold">
                      • {c.publishedVersion?.titleAr || c.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
              <p className="font-extrabold text-[#8CA2FF] mb-2">
                المسارات ({plans[0].includedContent.learningPaths.length})
              </p>
              <ul className="space-y-1.5 text-[#A9B1E0]">
                {plans[0].includedContent.learningPaths.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/learning-paths/${p.slug}`}
                      className="hover:text-[#8CA2FF] hover:underline font-bold"
                    >
                      • {p.titleAr}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
              <p className="font-extrabold text-[#8CA2FF] mb-2">
                الدبلومات ({plans[0].includedContent.diplomas.length})
              </p>
              <ul className="space-y-1.5 text-[#A9B1E0]">
                {plans[0].includedContent.diplomas.map((d) => (
                  <li key={d.id}>
                    <Link href={`/diplomas/${d.slug}`} className="hover:text-[#8CA2FF] hover:underline font-bold">
                      • {d.titleAr}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
