import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Layers, PlayCircle } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function LearningPathDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const path = await serverApiGet<any>(
    `/catalog/learning-paths/${encodeURIComponent(slug)}`,
  );
  if (!path) notFound();

  const totalMinutes = (path.courses ?? []).reduce(
    (sum: number, item: any) =>
      sum + (item.course?.publishedVersion?.durationMinutes ?? 0),
    0,
  );
  const outcomes: string[] = Array.isArray(path.outcomesAr) ? path.outcomesAr : [];

  return (
    <PublicPageLayout>
      <section className="bg-gradient-to-l from-bosla-navy to-bosla-purple text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <Badge className="bg-white/15 text-bosla-amber border-bosla-amber/40">
            <Layers className="h-3.5 w-3.5" />
            مسار تعليمي منسّق ({path.courses.length} كورسات)
          </Badge>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{path.titleAr}</h1>
          <p className="max-w-3xl text-base text-indigo-100">{path.descriptionAr}</p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-bold text-indigo-100">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-bosla-amber" />
              المدة الإجمالية: {Math.max(1, Math.round(totalMinutes / 60))} ساعات تقريباً
            </span>
          </div>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link href="/pricing">
              <Button variant="gold">اشترك لفتح كل كورسات المسار</Button>
            </Link>
            {path.courses?.[0]?.course?.slug && (
              <Link href={`/learn/${path.courses[0].course.slug}`}>
                <Button
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <PlayCircle className="h-4 w-4" />
                  ابدأ بالكورس الأول
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        {outcomes.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-extrabold text-bosla-ink mb-4">
              مخرجات المسار المهنية
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {outcomes.map((out, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-bosla-ink">
                  <CheckCircle2 className="h-4 w-4 text-bosla-success shrink-0 mt-1" />
                  <span>{out}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-extrabold text-bosla-ink mb-4">
            خطوات الكورسات داخل المسار
          </h2>
          <div className="space-y-4">
            {path.courses.map((item: any, idx: number) => {
              const c = item.course;
              return (
                <Card key={item.id} className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-bosla-primary text-sm font-extrabold text-white">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-bosla-ink">
                        {c?.publishedVersion?.titleAr || c?.slug}
                      </h3>
                      <p className="mt-1 text-xs text-bosla-muted">
                        {c?.publishedVersion?.subtitleAr || c?.publishedVersion?.descriptionAr}
                      </p>
                      <p className="mt-2 text-xs font-bold text-bosla-primary">
                        المدرب: {c?.instructor?.fullName} • {c?.publishedVersion?.durationMinutes ?? 0} دقيقة
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/courses/${c.slug}`}>
                      <Button variant="outline" size="sm">
                        تفاصيل الكورس
                      </Button>
                    </Link>
                    <Link href={`/learn/${c.slug}`}>
                      <Button variant="primary" size="sm">
                        افتح المشغل
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
}
