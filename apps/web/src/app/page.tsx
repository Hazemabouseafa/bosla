import type { Metadata } from 'next';
import { serverApiGet } from '@/lib/api';
import { BoslaIntroHome, type HomeIntroContent } from '@/components/home/BoslaIntroHome';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'أكاديمية بوصلة | من الطالب إلى المدير — BOSLA Academy',
  description:
    'معهد تطبيقي يربط بين الدراسة الأكاديمية في الطب البيطري والإنتاج الحيواني والداجني والأجريبيزنس وبين القيادة والتنفيذ الميداني.',
};

export default async function HomePage() {
  const [homeCms, contactCms] = await Promise.all([
    serverApiGet<any>('/catalog/pages/home').catch(() => null),
    serverApiGet<any>('/catalog/pages/contact').catch(() => null),
  ]);

  const intro: HomeIntroContent = {
    titleAr: homeCms?.titleAr ?? null,
    sloganAr: homeCms?.sections?.hero?.sloganAr ?? null,
    subtitleAr: homeCms?.sections?.hero?.subtitleAr ?? null,
    whatsapp: contactCms?.sections?.whatsapp ?? null,
    email: contactCms?.sections?.email ?? null,
  };

  return <BoslaIntroHome intro={intro} />;
}
