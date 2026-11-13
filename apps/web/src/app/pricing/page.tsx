import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PricingClient, PublicPlan } from '@/components/pricing/PricingClient';
import { Badge } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const plans = await serverApiGet<PublicPlan[]>('/memberships/plans');

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge tone="success">العضويات والأسعار</Badge>
          <h1 className="text-3xl font-extrabold text-bosla-ink sm:text-4xl">
            استثمر في مستقبلك المهني بخطة عضوية واضحة
          </h1>
          <p className="text-sm text-bosla-muted">
            اختر العضوية الشهرية المرنة أو العضوية السنوية الموفرة لفتح مكتبة الكورسات والمسارات والشهادات داخل أكاديمية بوصلة.
          </p>
        </div>

        <PricingClient plans={plans ?? []} highlightedSlug={params.plan} />
      </section>
    </PublicPageLayout>
  );
}
