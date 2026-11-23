import type { Metadata } from 'next';
import { serverApiGet } from '@/lib/api';
import { BoslaIntroHome, type HomeIntroContent } from '@/components/home/BoslaIntroHome';
import type { HomepageCoursesPayload } from '@/components/home/BoslaCoursesShowcase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'أكاديمية بوصلة | من الطالب إلى المدير — BOSLA Academy',
  description:
    'منصة تأهيل تطبيقي متخصصة في الطب البيطري وتغذية الحيوان وإنتاج الدواجن والإدارة التجارية للأجريبيزنس — استكشف الكورسات المعتمدة وابدأ مسارك.',
};

export default async function HomePage() {
  const [homeCms, contactCms, coursesData] = await Promise.all([
    serverApiGet<any>('/catalog/pages/home').catch(() => null),
    serverApiGet<any>('/catalog/pages/contact').catch(() => null),
    serverApiGet<HomepageCoursesPayload>('/catalog/homepage-courses').catch(() => null),
  ]);

  const intro: HomeIntroContent = {
    titleAr: homeCms?.titleAr ?? null,
    sloganAr: homeCms?.sections?.hero?.sloganAr ?? null,
    subtitleAr: homeCms?.sections?.hero?.subtitleAr ?? null,
    whatsapp: contactCms?.sections?.whatsapp ?? null,
    email: contactCms?.sections?.email ?? null,
  };

  return (
    <BoslaIntroHome
      intro={intro}
      coursesData={coursesData}
      coursesFetchFailed={coursesData === null}
    />
  );
}
