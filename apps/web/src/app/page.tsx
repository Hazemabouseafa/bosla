import React from 'react';
import { serverApiGet } from '@/lib/api';
import { BoslaIntroHome } from '@/components/home/BoslaIntroHome';
import type { HomepageCoursesPayload } from '@/components/home/BoslaCoursesShowcase';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [homeBundle, coursesData, liveLayout] = await Promise.all([
    serverApiGet<any>('/catalog/home'),
    serverApiGet<HomepageCoursesPayload>('/catalog/homepage-courses'),
    serverApiGet<any>('/catalog/live-layout'),
  ]);

  const heroCms = homeBundle?.cms?.home_hero;
  const liveCfg = liveLayout?.layout ?? liveLayout?.config;

  return (
    <BoslaIntroHome
      intro={{
        titleAr: liveCfg?.hero?.titleAr || heroCms?.titleAr,
        sloganAr: heroCms?.sloganAr,
        subtitleAr: liveCfg?.hero?.subtitleAr || heroCms?.subtitleAr,
        whatsapp: liveCfg?.contact?.whatsapp || heroCms?.whatsapp,
        email: liveCfg?.contact?.email || heroCms?.email,
      }}
      coursesData={coursesData}
      coursesFetchFailed={coursesData === null}
      liveLayout={liveLayout}
    />
  );
}
