import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PageHero } from '@/components/layout/PageHero';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  EventsCatalogClient,
  type PublicOfflineEvent,
} from '@/components/events/EventsCatalogClient';

export const dynamic = 'force-dynamic';

export default async function OfflineEventsPage() {
  const events = (await serverApiGet<PublicOfflineEvent[]>('/events')) || [];

  return (
    <PublicPageLayout>
      <PageHero
        badge="الكورسات الأوفلاين والفعاليات الحضورية"
        title="فعاليات وورش العمل الميدانية"
        highlight="(حجز فوري وتذكرة مستقلة)"
        subtitle="معسكرات تطبيقية في المزارع، المعامل المرجعية، وقاعات التدريب بنظام سعر مستقل لكل فعالية وتأكيد حجز إلكتروني فوري."
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EventsCatalogClient initialEvents={events} />
      </section>
    </PublicPageLayout>
  );
}
