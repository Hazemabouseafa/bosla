import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, ClipboardCheck, GraduationCap } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { DiplomaSubmissionBox } from '@/components/learning/DiplomaSubmissionBox';

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
      <section className="bg-gradient-to-l from-[#101c4d] via-bosla-navy to-bosla-primary text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <Badge className="bg-bosla-amber/20 text-bosla-amber border-bosla-amber/40">
            <GraduationCap className="h-3.5 w-3.5" />
            دبلومة مهنية معتمدة • {diploma.totalHours} ساعة
          </Badge>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{diploma.titleAr}</h1>
          <p className="max-w-3xl text-base text-indigo-100">{diploma.descriptionAr}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/pricing">
              <Button variant="gold">اشترك للالتحاق بالدبلومة</Button>
            </Link>
            <Link href="/certificates/verify">
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Award className="h-4 w-4" />
                نموذج التحقق من الشهادة
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-extrabold text-bosla-ink">
            الكورسات المكونة للدبلومة ({diploma.courses?.length ?? 0})
          </h2>
          <div className="space-y-3">
            {(diploma.courses ?? []).map((item: any, idx: number) => (
              <Card key={item.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold text-bosla-primary">
                    الوحدة {idx + 1}
                  </span>
                  <h3 className="text-base font-extrabold text-bosla-ink">
                    {item.course?.publishedVersion?.titleAr || item.course?.slug}
                  </h3>
                  <p className="text-xs text-bosla-muted mt-1">
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
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink mb-4">
              <ClipboardCheck className="h-5 w-5 text-bosla-success" />
              التقييمات ومشروع التخرج العملي
            </h2>
            {(diploma.assessments ?? []).length === 0 ? (
              <p className="text-sm text-bosla-muted">
                يتم احتساب الشهادة تلقائياً فور اجتياز اختبارات الكورسات المكونة للدبلومة.
              </p>
            ) : (
              <div className="space-y-4">
                {diploma.assessments.map((ass: any) => (
                  <div key={ass.id} className="space-y-3 rounded-2xl border border-bosla-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-bosla-ink">{ass.titleAr}</p>
                      <Badge tone="info">النجاح {ass.passingScorePercent}%</Badge>
                    </div>
                    <p className="text-xs text-bosla-muted">{ass.descriptionAr}</p>
                    <DiplomaSubmissionBox assessmentId={ass.id} />
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
