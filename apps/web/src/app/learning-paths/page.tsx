import React from 'react';
import Link from 'next/link';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import {
  LearningPathCard,
  type LearningPathCardData,
} from '@/components/catalog/LearningPathCard';
import { Button, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function LearningPathsPage() {
  const paths = await serverApiGet<LearningPathCardData[]>('/catalog/learning-paths');

  return (
    <PublicPageLayout>
      <PageHero
        badge="المسارات التعليمية المهنية"
        title="خرائط التعلم المتدرجة من"
        highlight="التأسيس إلى الإتقان"
        subtitle="تجمع المسارات التعليمية كورسات الأكاديمية الموجودة في تسلسل منطقي منظم لبناء مهارة مهنية متكاملة بدون تكرار."
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {!paths || paths.length === 0 ? (
          <EmptyState
            title="لا توجد مسارات منشورة حالياً"
            description="تعمل الإدارة على نشر مسارات جديدة قريباً."
            action={
              <Link href="/courses">
                <Button variant="primary">تصفح الكورسات</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {paths.map((path, idx) => (
              <LearningPathCard
                key={path.id}
                path={path}
                index={idx}
                headingLevel="h2"
                className={idx % 2 === 0 ? 'scroll-reveal-start' : 'scroll-reveal-end'}
              />
            ))}
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
