import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import {
  CatalogCourseCard,
  CourseCatalogClient,
} from '@/components/catalog/CourseCatalogClient';
import { HomeBundle } from '@/components/home/HomeExperience';

export const dynamic = 'force-dynamic';

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; difficulty?: string; free?: string }>;
}) {
  const params = await searchParams;
  const [courses, home] = await Promise.all([
    serverApiGet<CatalogCourseCard[]>('/catalog/courses'),
    serverApiGet<HomeBundle>('/catalog/home'),
  ]);

  return (
    <PublicPageLayout>
      <PageHero
        badge="كتالوج أكاديمية بوصلة"
        title="جميع الكورسات"
        highlight="التدريبية التطبيقية"
        subtitle="مكتبة متجددة من الكورسات العملية في طب الدواجن، تركيب العلائق، الأمان الحيوي، التسويق البيطري، وإدارة المزارع."
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <CourseCatalogClient
          courses={courses ?? []}
          categories={home?.categories ?? []}
          initialCategory={params.category || 'all'}
          initialDifficulty={params.difficulty || 'all'}
          initialFree={params.free === 'true'}
        />
      </section>
    </PublicPageLayout>
  );
}
