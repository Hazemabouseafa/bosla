import React from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function DiplomasPage() {
  const diplomas = await serverApiGet<any[]>('/catalog/diplomas');

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        <div>
          <Badge tone="warning">الدبلومات المهنية التطبيقية</Badge>
          <h1 className="mt-2 text-3xl font-extrabold text-bosla-ink sm:text-4xl">
            دبلومات بوصلة المتخصصة (حتى 140 ساعة عملية)
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-bosla-muted">
            تأهيل مهني عميق يجمع بين الكورسات الأساسية والمحاكاة الحقلية ومشروع التخرج المقيّم بشهادة معتمدة.
          </p>
        </div>

        {!diplomas || diplomas.length === 0 ? (
          <EmptyState
            title="لا توجد دبلومات منشورة حالياً"
            description="تعمل الإدارة على نشر الدبلومات الجديدة قريباً."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {diplomas.map((dip) => (
              <Card
                key={dip.id}
                className="overflow-hidden border-amber-200 bg-gradient-to-br from-white to-amber-50/40 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/7] overflow-hidden bg-slate-100">
                    <img
                      src={dip.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                      alt={dip.titleAr}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="warning">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {dip.totalHours} ساعة
                      </Badge>
                      <span className="text-xs font-bold text-bosla-muted">
                        {dip.courses.length} كورسات أساسية
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-extrabold text-bosla-ink">
                      {dip.titleAr}
                    </h2>
                    <p className="mt-2 text-sm text-bosla-muted">{dip.descriptionAr}</p>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <Link href={`/diplomas/${dip.slug}`}>
                    <Button variant="gold" className="w-full">
                      التفاصيل والمشروع العملي
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
