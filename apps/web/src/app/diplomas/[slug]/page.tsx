import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, ClipboardCheck, GraduationCap } from 'lucide-react';
import { formatEgp, serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { DiplomaSubmissionBox } from '@/components/learning/DiplomaSubmissionBox';
import { SmartLearningCta } from '@/components/learning/SmartLearningCta';

export const dynamic = 'force-dynamic';

export default async function DiplomaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const diploma = await serverApiGet<any>(
    `/catalog/diplomas/${encodeURIComponent(slug)}`,
  );
  if (!diploma) notFound();

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden border-b border-[#22307A] bg-[#0B1440] text-[#EEF0FF] py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <div className="hero-seq-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/40 bg-[#0F1A4A] px-3.5 py-1 text-xs sm:text-sm font-extrabold text-[#8CA2FF]">
              <GraduationCap className="h-4 w-4" />
              دبلومة مهنية معتمدة • {diploma.totalHours} ساعة
            </span>
            {diploma.includedInMembership === false ? (
              <span className="inline-flex items-center rounded-full border border-[#F5B94A]/45 bg-[#F5B94A]/15 px-3 py-1 text-xs font-extrabold text-[#F5B94A]">
                برنامج مستقل (غير مشمول في العضوية)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#77E2B5]/40 bg-[#77E2B5]/15 px-3 py-1 text-xs font-extrabold text-[#77E2B5]">
                شامل ضمن العضوية • شراء منفرد {formatEgp(diploma.priceCents ?? 180000)}
              </span>
            )}
          </div>
          <h1 className="hero-seq-2 text-3xl font-extrabold text-[#EEF0FF] sm:text-4xl">{diploma.titleAr}</h1>
          <p className="hero-seq-3 max-w-3xl text-base leading-[1.7] text-[#A9B1E0]">{diploma.descriptionAr}</p>
          {diploma.instructorAssignments?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-[#A9B1E0]">المدربون المشاركون في الدبلومة:</span>
              {diploma.instructorAssignments.map((a: any) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#22307A] bg-[#0F1A4A] px-3 py-1 text-xs font-bold text-[#EEF0FF]"
                >
                  {a.instructor?.fullName}
                  <span className="text-[#8CA2FF]">({a.roleTitleAr})</span>
                </span>
              ))}
            </div>
          )}
          <div className="hero-seq-4 flex flex-wrap items-center gap-3">
            <SmartLearningCta
              kind="diploma"
              targetId={diploma.id}
              slug={diploma.slug}
              priceCents={Number(diploma.priceCents ?? 180000)}
              compareAtPriceCents={diploma.compareAtPriceCents}
              includedInMembership={diploma.includedInMembership !== false}
              allowIndividualPurchase={diploma.allowIndividualPurchase !== false}
              firstCourseSlug={diploma.courses?.[0]?.course?.slug}
            />
            <Link href="/certificates/verify" className="pt-2">
              <Button variant="outline" size="lg">
                <Award className="h-4 w-4" />
                نموذج التحقق من الشهادة
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-extrabold text-[#EEF0FF]">
            الكورسات المكونة للدبلومة ({diploma.courses?.length ?? 0})
          </h2>
          <div className="space-y-3">
            {(diploma.courses ?? []).map((item: any, idx: number) => (
              <Card key={item.id} className="bosla-card-hover p-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-extrabold text-[#8CA2FF]">
                    الوحدة {idx + 1}
                  </span>
                  <h3 className="text-base font-extrabold text-[#EEF0FF]">
                    {item.course?.publishedVersion?.titleAr || item.course?.slug}
                  </h3>
                  <p className="text-sm text-[#A9B1E0] mt-1">
                    المدرب: {item.course?.instructor?.fullName} • {item.course?.publishedVersion?.durationMinutes ?? 0} دقيقة
                  </p>
                </div>
                <Link href={`/courses/${item.course.slug}`}>
                  <Button variant="outline" size="sm">
                    عرض الكورس
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF] mb-4">
              <ClipboardCheck className="h-5 w-5 text-[#8CA2FF]" />
              التقييمات ومشروع التخرج العملي
            </h2>
            {(diploma.assessments ?? []).length === 0 ? (
              <p className="text-sm leading-[1.7] text-[#A9B1E0]">
                يتم احتساب الشهادة تلقائياً فور اجتياز اختبارات الكورسات المكونة للدبلومة.
              </p>
            ) : (
              <div className="space-y-4">
                {diploma.assessments.map((ass: any) => (
                  <div key={ass.id} className="space-y-3 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-[#EEF0FF]">{ass.titleAr}</p>
                      <Badge tone="info">النجاح {ass.passingScorePercent}%</Badge>
                    </div>
                    <p className="text-sm text-[#A9B1E0]">{ass.descriptionAr}</p>
                    <DiplomaSubmissionBox assessmentId={ass.id} diplomaSlug={diploma.slug} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>
    </PublicPageLayout>
  );
}
