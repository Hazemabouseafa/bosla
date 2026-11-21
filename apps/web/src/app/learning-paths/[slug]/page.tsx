import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Layers } from 'lucide-react';
import { formatEgp, formatNumber, serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { SmartLearningCta } from '@/components/learning/SmartLearningCta';
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
      <section className="relative overflow-hidden border-b border-[#8CA2FF]/16 bg-[#070D2B] text-[#EEF0FF] py-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-35"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <div className="hero-seq-1 flex flex-wrap items-center gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#8CA2FF] tabular-nums">
              <Layers className="h-3.5 w-3.5" />
              مسار تعليمي منسّق ({formatNumber(path.courses.length)} كورسات)
            </p>
            {path.includedInMembership === false ? (
              <Badge tone="warning">برنامج مستقل (غير مشمول في العضوية)</Badge>
            ) : (
              <Badge tone="success">
                شامل ضمن العضوية / شراء منفرد {formatEgp(path.priceCents ?? 95000)}
              </Badge>
            )}
          </div>
          <h1 className="hero-seq-2 text-3xl font-extrabold text-[#EEF0FF] sm:text-4xl">{path.titleAr}</h1>
          <p className="hero-seq-3 max-w-3xl text-base leading-[1.8] text-[#A9B1E0]">{path.descriptionAr}</p>
          <div className="hero-seq-3 flex flex-wrap gap-4 pt-1 text-sm font-semibold text-[#EEF0FF] tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#8CA2FF]" />
              المدة الإجمالية: {formatNumber(Math.max(1, Math.round(totalMinutes / 60)))} ساعات تقريباً
            </span>
          </div>
          {path.instructorAssignments?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-[#A9B1E0]">فريق المدربين:</span>
              {path.instructorAssignments.map((a: any) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/22 bg-[#0F1A4A] px-3 py-1 text-xs font-semibold text-[#EEF0FF]"
                >
                  {a.instructor?.fullName}
                  <span className="text-[#8CA2FF]">({a.roleTitleAr})</span>
                </span>
              ))}
            </div>
          )}
          <div className="hero-seq-4">
            <SmartLearningCta
              kind="path"
              targetId={path.id}
              slug={path.slug}
              priceCents={Number(path.priceCents ?? 95000)}
              compareAtPriceCents={path.compareAtPriceCents}
              includedInMembership={path.includedInMembership !== false}
              allowIndividualPurchase={path.allowIndividualPurchase !== false}
              firstCourseSlug={path.courses?.[0]?.course?.slug}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        {outcomes.length > 0 && (
          <Card spotlight className="p-6 sm:p-7">
            <h2 className="text-lg font-extrabold text-[#EEF0FF] mb-4">
              مخرجات المسار المهنية
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {outcomes.map((out, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-[#A9B1E0]">
                  <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0 mt-1.5" />
                  <span>{out}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-extrabold text-[#EEF0FF] mb-5">
            خطوات الكورسات داخل المسار
          </h2>
          <div className="space-y-4">
            {path.courses.map((item: any, idx: number) => {
              const c = item.course;
              return (
                <Card
                  key={item.id}
                  spotlight
                  className="bosla-card-hover p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/35 bg-[#0B1440] text-sm font-extrabold text-[#8CA2FF] tabular-nums">
                      {formatNumber(idx + 1)}
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-[#EEF0FF]">
                        {c?.publishedVersion?.titleAr || c?.slug}
                      </h3>
                      <p className="mt-1 text-sm text-[#A9B1E0]">
                        {c?.publishedVersion?.subtitleAr || c?.publishedVersion?.descriptionAr}
                      </p>
                      <p className="mt-2 text-xs sm:text-sm font-semibold text-[#8CA2FF] tabular-nums">
                        المدرب: {c?.instructor?.fullName} • {formatNumber(c?.publishedVersion?.durationMinutes ?? 0)} دقيقة
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
