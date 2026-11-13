import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function LearningPathsPage() {
  const paths = await serverApiGet<any[]>('/catalog/learning-paths');

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        <div>
          <Badge tone="purple">المسارات التعليمية المهنية</Badge>
          <h1 className="mt-2 text-3xl font-extrabold text-bosla-ink sm:text-4xl">
            خرائط التعلم المتدرجة من التأسيس إلى الإتقان
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-bosla-muted">
            تجمع المسارات التعليمية كورسات الأكاديمية الموجودة في تسلسل منطقي منظم لبناء مهارة مهنية متكاملة بدون تكرار.
          </p>
        </div>

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
          <div className="grid gap-6 md:grid-cols-2">
            {paths.map((path) => (
              <Card key={path.id} className="overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="aspect-[16/7] overflow-hidden bg-slate-100">
                    <img
                      src={path.thumbnailUrl || '/images/brand/track-poultry.webp'}
                      alt={path.titleAr}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <Badge tone="info">
                      <Layers className="h-3.5 w-3.5" />
                      {path.courses.length} كورسات في المسار
                    </Badge>
                    <h2 className="mt-3 text-xl font-extrabold text-bosla-ink">
                      {path.titleAr}
                    </h2>
                    <p className="mt-2 text-sm text-bosla-muted">{path.descriptionAr}</p>
                    <ol className="mt-4 space-y-2">
                      {path.courses.map((item: any, idx: number) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 text-xs font-bold text-bosla-ink"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-bosla-primary">
                            {idx + 1}
                          </span>
                          <span>
                            {item.course?.publishedVersion?.titleAr || item.course?.slug}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <Link href={`/learning-paths/${path.slug}`}>
                    <Button variant="primary" className="w-full">
                      عرض تفاصيل المسار
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
