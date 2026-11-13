import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { HomeBundle, HomeExperience } from '@/components/home/HomeExperience';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await serverApiGet<HomeBundle>('/catalog/home');

  return (
    <PublicPageLayout>
      <HomeExperience data={data} />
    </PublicPageLayout>
  );
}
