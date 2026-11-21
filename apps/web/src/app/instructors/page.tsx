import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { HomeBundle } from '@/components/home/HomeExperience';
import { Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const STAGGER_CLASSES = [
  'scroll-stagger-1',
  'scroll-stagger-2',
  'scroll-stagger-3',
  'scroll-stagger-4',
];

export default async function InstructorsPage() {
  const home = await serverApiGet<HomeBundle>('/catalog/home');
  const instructors = home?.instructors ?? [];

  return (
    <PublicPageLayout>
      <PageHero
        badge="فريق الخبرة الميدانية"
        title="مدربو واستشاريو"
        highlight="أكاديمية بوصلة"
        subtitle="مجموعة من الأطباء البيطريين، مهندسي الإنتاج الحيواني، وخبراء تركيب العلائق والتسويق في كبرى شركات القطاع."
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.map((inst, idx) => (
            <Card
              key={inst.id}
              className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 4]} bosla-card-hover group p-6 flex flex-col justify-between`}
            >
              <div className="text-center">
                <img
                  src={inst.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={inst.fullName}
                  className="mx-auto h-24 w-24 rounded-full border-2 border-[#8CA2FF]/50 object-cover"
                />
                <h2 className="mt-4 text-lg font-extrabold text-[#EEF0FF] group-hover:text-[#8CA2FF] transition-colors">
                  {inst.fullName}
                </h2>
                <p className="mt-1 text-sm font-bold text-[#8CA2FF]">
                  {inst.headlineAr || 'مدرب خبير في أكاديمية بوصلة'}
                </p>
                <p className="mt-3 text-sm leading-[1.7] text-[#A9B1E0]">
                  {inst.bioAr || 'خبرة ميدانية متخصصة في الإنتاج والتشغيل.'}
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-[#22307A] flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#EEF0FF]">
                  <BookOpen className="h-4 w-4 text-[#8CA2FF]" />
                  {inst._count?.instructedCourses ?? 0} كورسات منشورة
                </span>
                <Link href="/courses">
                  <Button variant="ghost" size="sm">
                    تصفح الدروس
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </PublicPageLayout>
  );
}
