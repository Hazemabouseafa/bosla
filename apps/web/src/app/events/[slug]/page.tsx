import React from 'react';
import { notFound } from 'next/navigation';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  EventDetailClient,
  type EventDetailData,
} from '@/components/events/EventDetailClient';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await serverApiGet<EventDetailData>(
    `/events/${encodeURIComponent(slug)}`,
  );

  if (!event) {
    notFound();
  }

  return (
    <PublicPageLayout>
      <EventDetailClient initialEvent={event} />
    </PublicPageLayout>
  );
}
