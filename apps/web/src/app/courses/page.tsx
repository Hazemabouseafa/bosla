import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  CatalogCourseCard,
  CourseCatalogClient,
} from '@/components/catalog/CourseCatalogClient';
import { HomeBundle } from '@/components/home/HomeExperience';
import { Badge } from '@/components/ui/primitives';

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
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        <div>
          <Badge tone="info">كتالوج أكاديمية بوصلة</Badge>
          <h1 className="mt-2 text-3xl font-extrabold text-bosla-ink sm:text-4xl">
            جميع الكورسات التدريبية التطبيقية
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-bosla-muted">
            مكتبة متجددة من الكورسات العملية في طب الدواجن، تركيب العلائق، الأمان الحيوي، التسويق البيطري، وإدارة المزارع.
          </p>
        </div>

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
