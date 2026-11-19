import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { PricingClient, PublicPlan } from '@/components/pricing/PricingClient';

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
      <PageHero
        badge="العضويات والأسعار"
        title="استثمر في مستقبلك المهني"
        highlight="بخطة عضوية واضحة"
        subtitle="اختر العضوية الشهرية المرنة أو العضوية السنوية الموفرة لفتح مكتبة الكورسات والمسارات والشهادات داخل أكاديمية بوصلة."
        align="center"
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <PricingClient plans={plans ?? []} highlightedSlug={params.plan} />
      </section>
    </PublicPageLayout>
  );
}
