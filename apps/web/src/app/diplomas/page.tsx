import React from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { Button, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function DiplomasPage() {
  const diplomas = await serverApiGet<any[]>('/catalog/diplomas');

  return (
    <PublicPageLayout>
      <PageHero
        badge="الدبلومات المهنية التطبيقية"
        title="دبلومات بوصلة المتخصصة"
        highlight="(حتى 140 ساعة عملية)"
        subtitle="تأهيل مهني عميق يجمع بين الكورسات الأساسية والمحاكاة الحقلية ومشروع التخرج المقيّم بشهادة معتمدة."
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {!diplomas || diplomas.length === 0 ? (
          <EmptyState
            title="لا توجد دبلومات منشورة حالياً"
            description="تعمل الإدارة على نشر الدبلومات الجديدة قريباً."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {diplomas.map((dip, idx) => (
              <div
                key={dip.id}
                className={`${idx % 2 === 0 ? 'scroll-reveal-start' : 'scroll-reveal-end'} bosla-card-hover group overflow-hidden rounded-2xl border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] flex flex-col justify-between`}
              >
                <div>
                  <div className="relative aspect-[16/7] overflow-hidden bg-[#0B1440]">
                    <img
                      src={dip.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                      alt={dip.titleAr}
                      className="bosla-card-media h-full w-full object-cover"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0F1A4A] via-transparent to-transparent"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/18 px-3 py-1 text-xs sm:text-sm font-extrabold text-[#8CA2FF]">
                        <GraduationCap className="h-4 w-4" />
                        {dip.totalHours} ساعة
                      </span>
                      <span className="text-sm font-bold text-[#8CA2FF]">
                        {dip.courses.length} كورسات أساسية
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-extrabold text-[#EEF0FF]">
                      {dip.titleAr}
                    </h2>
                    <p className="mt-2 text-base leading-[1.7] text-[#A9B1E0]">
                      {dip.descriptionAr}
                    </p>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <Link href={`/diplomas/${dip.slug}`}>
                    <Button variant="primary" className="w-full">
                      التفاصيل والمشروع العملي
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
