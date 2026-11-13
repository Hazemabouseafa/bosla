import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { HomeBundle } from '@/components/home/HomeExperience';
import { Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function InstructorsPage() {
  const home = await serverApiGet<HomeBundle>('/catalog/home');
  const instructors = home?.instructors ?? [];

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        <div>
          <Badge tone="info">فريق الخبرة الميدانية</Badge>
          <h1 className="mt-2 text-3xl font-extrabold text-bosla-ink sm:text-4xl">
            مدربو واستشاريو أكاديمية بوصلة
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-bosla-muted">
            مجموعة من الأطباء البيطريين، مهندسي الإنتاج الحيواني، وخبراء تركيب العلائق والتسويق في كبرى شركات القطاع.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.map((inst) => (
            <Card key={inst.id} className="p-6 flex flex-col justify-between">
              <div className="text-center">
                <img
                  src={inst.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={inst.fullName}
                  className="mx-auto h-24 w-24 rounded-full border-2 border-bosla-line object-cover"
                />
                <h2 className="mt-4 text-lg font-extrabold text-bosla-ink">
                  {inst.fullName}
                </h2>
                <p className="mt-1 text-xs font-extrabold text-bosla-primary">
                  {inst.headlineAr || 'مدرب خبير في أكاديمية بوصلة'}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-bosla-muted">
                  {inst.bioAr || 'خبرة ميدانية متخصصة في الإنتاج والتشغيل.'}
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-bosla-line flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-bosla-navy">
                  <BookOpen className="h-3.5 w-3.5" />
                  {inst._count.instructedCourses} كورسات منشورة
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
