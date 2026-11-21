import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  FileDown,
  FileQuestion,
  GraduationCap,
  Layers,
  Lock,
  PlayCircle,
  Star,
} from 'lucide-react';
import { difficultyLabelAr, formatEgp, serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { SmartLearningCta } from '@/components/learning/SmartLearningCta';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await serverApiGet<any>(`/catalog/courses/${encodeURIComponent(slug)}`);
  if (!course) {
    notFound();
  }

  const version = course.publishedVersion;
  const sections: any[] = version?.sections ?? [];
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const objectives: string[] = Array.isArray(version?.learningObjectives)
    ? version.learningObjectives
    : [];
  const requirements: string[] = Array.isArray(version?.requirements)
    ? version.requirements
    : [];

  return (
    <PublicPageLayout>
      {/* Top Navy Course Header Band */}
      <section className="relative overflow-hidden border-b border-[#22307A] bg-bosla-mesh text-white py-12">
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="hero-seq-1 flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-[#8CA2FF]">
                {course.category?.nameAr}
              </span>
              {course.isFree ? (
                <Badge tone="success">كورس مجاني بالكامل</Badge>
              ) : (
                <>
                  <Badge tone={course.includedInMembership === false ? 'warning' : 'info'}>
                    {course.includedInMembership === false
                      ? 'خارج العضوية — اشتراك منفرد'
                      : 'مشمول ضمن العضوية'}
                  </Badge>
                  {course.allowIndividualPurchase !== false && Number(course.priceCents) > 0 && (
                    <Badge tone="warning">شراء منفرد: {formatEgp(course.priceCents)}</Badge>
                  )}
                </>
              )}
            </div>
            <h1 className="hero-seq-2 text-3xl font-extrabold leading-tight text-[#EEF0FF] sm:text-4xl">
              {version?.titleAr || course.slug}
            </h1>
            <p className="hero-seq-3 text-base leading-[1.7] text-[#A9B1E0]">
              {version?.subtitleAr || version?.descriptionAr}
            </p>
            <div className="hero-seq-3 flex flex-wrap items-center gap-5 pt-1 text-sm font-bold text-[#EEF0FF]">
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-[#8CA2FF]" />
                {totalLessons} درس تطبيقي
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#8CA2FF]" />
                {version?.durationMinutes ?? 0} دقيقة
              </span>
              <span>{difficultyLabelAr(course.difficulty)}</span>
            </div>

            <div className="hero-seq-4">
              <SmartLearningCta
                kind="course"
                targetId={course.id}
                slug={course.slug}
                isFree={Boolean(course.isFree)}
                priceCents={Number(course.priceCents ?? 0)}
                compareAtPriceCents={course.compareAtPriceCents}
                includedInMembership={course.includedInMembership !== false}
                allowIndividualPurchase={course.allowIndividualPurchase !== false}
                communityEnabled={course.communitySettings?.isEnabled !== false}
              />
            </div>
          </div>

          <div className="hero-seq-media lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-2.5">
              <img
                src={version?.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                alt={version?.titleAr || course.slug}
                className="aspect-video w-full rounded-xl object-cover"
              />
              <div className="flex items-center gap-3 p-3 text-[#EEF0FF]">
                <img
                  src={course.instructor?.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={course.instructor?.fullName}
                  className="h-11 w-11 rounded-full border border-[#8CA2FF]/40 object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#EEF0FF] truncate">
                    {course.instructor?.fullName}
                  </p>
                  <p className="text-sm text-[#8CA2FF] truncate">
                    {course.instructor?.headlineAr || 'خبير أكاديمية بوصلة'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-extrabold text-bosla-ink mb-3">
              عن هذا الكورس
            </h2>
            <p className="text-sm leading-relaxed text-bosla-muted whitespace-pre-line">
              {version?.descriptionAr}
            </p>
          </Card>

          {objectives.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-extrabold text-bosla-ink mb-4">
                ماذا ستتعلم في هذا الكورس؟
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-bosla-ink">
                    <CheckCircle2 className="h-4 w-4 text-bosla-tealText shrink-0 mt-1" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Curriculum */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold text-bosla-ink">
                المنهج الدراسي والمحاور ({sections.length} أقسام)
              </h2>
              <Link href={`/learn/${course.slug}`} className="text-xs font-extrabold text-bosla-tealText hover:underline">
                بدء المشاهدة ←
              </Link>
            </div>
            <div className="space-y-4">
              {sections.map((sec, sIdx) => (
                <div
                  key={sec.id}
                  className="overflow-hidden rounded-2xl border border-[#22307A]"
                >
                  <div className="flex items-center justify-between bg-[#0B1440] px-4 py-3 border-b border-[#22307A]">
                    <h3 className="text-sm font-extrabold text-[#EEF0FF]">
                      {sIdx + 1}. {sec.titleAr}
                    </h3>
                    <span className="text-xs sm:text-sm font-bold text-[#A9B1E0]">
                      {sec.lessons.length} دروس
                    </span>
                  </div>
                  <div className="divide-y divide-[#22307A] bg-[#0F1A4A]">
                    {sec.lessons.map((lesson: any) => (
                      <div
                        key={lesson.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          {lesson.isFreePreview || course.isFree ? (
                            <PlayCircle className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                          ) : (
                            <Lock className="h-4 w-4 text-[#A9B1E0] shrink-0" />
                          )}
                          <span className="font-bold text-[#EEF0FF]">{lesson.titleAr}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B1E0]">
                          {lesson.quizId && (
                            <Badge tone="purple">
                              <FileQuestion className="h-3 w-3" />
                              اختبار
                            </Badge>
                          )}
                          {lesson.attachments?.length > 0 && (
                            <Badge tone="info">
                              <FileDown className="h-3 w-3" />
                              {lesson.attachments.length} مرفق
                            </Badge>
                          )}
                          {lesson.isFreePreview && (
                            <Badge tone="success">معاينة مجانية</Badge>
                          )}
                          <span>{Math.max(1, Math.round((lesson.durationSeconds ?? 0) / 60))} د</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Reviews */}
          {course.reviews?.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-extrabold text-bosla-ink mb-4">
                آراء وتقييمات المتدربين (مرتبطة بالكورس والمدرب) ({course.reviews.length})
              </h2>
              <div className="space-y-4">
                {course.reviews.map((rev: any) => (
                  <div key={rev.id} className="rounded-xl border border-bosla-line bg-bosla-bg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-bosla-ink">
                          {rev.user?.fullName}
                        </p>
                        {rev.instructor?.fullName && (
                          <span className="text-xs font-bold text-[#8CA2FF]">
                            تقييم المدرب: {rev.instructor.fullName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#F5B94A]">
                        <span className="inline-flex items-center gap-1">
                          الكورس:
                          {Array.from({ length: rev.rating }).map((_, idx) => (
                            <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </span>
                        {rev.instructorRating && (
                          <span className="text-[#77E2B5]">
                            المدرب: {rev.instructorRating}/5 ★
                          </span>
                        )}
                      </div>
                    </div>
                    {rev.commentAr && (
                      <p className="text-sm text-[#A9B1E0]">{rev.commentAr}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {course.instructorAssignments?.length > 0 && (
            <Card className="p-6 space-y-3">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">
                فريق التدريب المعتمد للبرنامج ({course.instructorAssignments.length})
              </h3>
              <div className="space-y-2.5">
                {course.instructorAssignments.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3"
                  >
                    <img
                      src={a.instructor?.avatarUrl || '/images/brand/instructor-1.webp'}
                      alt={a.instructor?.fullName}
                      className="h-10 w-10 rounded-full object-cover border border-[#8CA2FF]/35 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#EEF0FF] truncate">
                        {a.instructor?.fullName}
                      </p>
                      <p className="text-xs text-[#8CA2FF] truncate">{a.roleTitleAr}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {requirements.length > 0 && (
            <Card className="p-6">
              <h3 className="text-base font-extrabold text-[#EEF0FF] mb-3">
                المتطلبات المسبقة
              </h3>
              <ul className="space-y-2 text-sm text-[#A9B1E0]">
                {requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#8CA2FF] font-extrabold">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(course.learningPathLinks?.length > 0 || course.diplomaLinks?.length > 0) && (
            <Card className="p-6 space-y-3">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">
                هذا الكورس جزء من:
              </h3>
              {course.learningPathLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.learningPath.id}
                  href={`/learning-paths/${linkItem.learningPath.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 transition-colors hover:border-[#8CA2FF]"
                >
                  <Layers className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                  <span className="text-sm font-extrabold text-[#EEF0FF]">
                    مسار: {linkItem.learningPath.titleAr}
                  </span>
                </Link>
              ))}
              {course.diplomaLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.diploma.id}
                  href={`/diplomas/${linkItem.diploma.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-[#8CA2FF]/40 bg-[#7C95FF]/15 p-3 transition-colors hover:border-[#8CA2FF]"
                >
                  <GraduationCap className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                  <span className="text-sm font-extrabold text-[#EEF0FF]">
                    دبلومة: {linkItem.diploma.titleAr}
                  </span>
                </Link>
              ))}
            </Card>
          )}

          <Card className="p-6 bg-[#0B1440] text-[#EEF0FF] border-[#22307A] space-y-3">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">عن المدرب</h3>
            <p className="text-sm font-bold text-[#8CA2FF]">
              {course.instructor?.fullName}
            </p>
            <p className="text-sm leading-[1.7] text-[#A9B1E0]">
              {course.instructor?.bioAr || course.instructor?.headlineAr}
            </p>
          </Card>
        </aside>
      </section>
    </PublicPageLayout>
  );
}
