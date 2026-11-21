import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FileDown,
  FileQuestion,
  GraduationCap,
  Layers,
  Lock,
  PlayCircle,
  Star,
} from 'lucide-react';
import { difficultyLabelAr, formatEgp, formatNumber, serverApiGet } from '@/lib/api';
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
      {/* Top Royal Indigo Course Header Band */}
      <section className="relative overflow-hidden border-b border-[#8CA2FF]/16 bg-[#070D2B] text-[#EEF0FF] py-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-35"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="hero-seq-1 flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-[#8CA2FF]">
                {course.category?.nameAr}
              </span>
              {course.isFree ? (
                <Badge tone="success">كورس مجاني بالكامل</Badge>
              ) : (
                <>
                  <Badge tone={course.includedInMembership === false ? 'warning' : 'info'}>
                    {course.includedInMembership === false
                      ? 'خارج العضوية / اشتراك منفرد'
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
            <p className="hero-seq-3 text-base leading-[1.8] text-[#A9B1E0]">
              {version?.subtitleAr || version?.descriptionAr}
            </p>
            <div className="hero-seq-3 flex flex-wrap items-center gap-5 pt-1 text-sm font-semibold text-[#EEF0FF] tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-[#8CA2FF]" />
                {formatNumber(totalLessons)} درس تطبيقي
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#8CA2FF]" />
                {formatNumber(version?.durationMinutes ?? 0)} دقيقة
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
            <div
              data-sc-spotlight=""
              className="bosla-liquid-glass-portal overflow-hidden rounded-3xl p-3"
            >
              <div className="bosla-image-frame overflow-hidden rounded-2xl bg-[#0B1440]">
                <img
                  src={version?.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                  alt={version?.titleAr || course.slug}
                  className="aspect-video w-full object-cover"
                />
              </div>
              <div className="flex items-center gap-3 p-3.5 text-[#EEF0FF]">
                <img
                  src={course.instructor?.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={course.instructor?.fullName}
                  className="h-11 w-11 rounded-full border border-[#8CA2FF]/40 object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#EEF0FF] truncate">
                    {course.instructor?.fullName}
                  </p>
                  <p className="text-xs sm:text-sm text-[#8CA2FF] truncate">
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
          <Card spotlight className="p-6 sm:p-7">
            <h2 className="text-xl font-extrabold text-[#EEF0FF] mb-3">
              عن هذا الكورس
            </h2>
            <p className="text-sm sm:text-base leading-[1.8] text-[#A9B1E0] whitespace-pre-line">
              {version?.descriptionAr}
            </p>
          </Card>

          {objectives.length > 0 && (
            <Card spotlight className="p-6 sm:p-7">
              <h2 className="text-xl font-extrabold text-[#EEF0FF] mb-4">
                ماذا ستتعلم في هذا الكورس؟
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#EEF0FF]">
                    <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0 mt-1" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Interactive Collapsible Curriculum Modules */}
          <Card className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold text-[#EEF0FF] tabular-nums">
                المنهج الدراسي والمحاور ({formatNumber(sections.length)} أقسام)
              </h2>
              <Link href={`/learn/${course.slug}`} className="text-xs font-extrabold text-[#8CA2FF] hover:underline">
                بدء المشاهدة ←
              </Link>
            </div>
            <div className="space-y-3.5">
              {sections.map((sec, sIdx) => (
                <details
                  key={sec.id}
                  open={sIdx === 0}
                  className="overflow-hidden rounded-2xl border border-[#8CA2FF]/18 bg-[#0B1440]/85"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#18266E]/45">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronDown className="bosla-chevron h-4 w-4 text-[#8CA2FF] shrink-0" />
                      <h3 className="text-sm font-extrabold text-[#EEF0FF] truncate tabular-nums">
                        {formatNumber(sIdx + 1)}. {sec.titleAr}
                      </h3>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#A9B1E0] tabular-nums">
                      {formatNumber(sec.lessons.length)} دروس
                    </span>
                  </summary>
                  <div className="divide-y divide-[#8CA2FF]/14 border-t border-[#8CA2FF]/14 bg-[#0F1A4A]/80">
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
                          <span className="font-semibold text-[#EEF0FF]">{lesson.titleAr}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B1E0] tabular-nums">
                          {lesson.quizId && (
                            <Badge tone="purple">
                              <FileQuestion className="h-3 w-3" />
                              اختبار
                            </Badge>
                          )}
                          {lesson.attachments?.length > 0 && (
                            <Badge tone="info">
                              <FileDown className="h-3 w-3" />
                              {formatNumber(lesson.attachments.length)} مرفق
                            </Badge>
                          )}
                          {lesson.isFreePreview && (
                            <Badge tone="success">معاينة مجانية</Badge>
                          )}
                          <span>{formatNumber(Math.max(1, Math.round((lesson.durationSeconds ?? 0) / 60)))} د</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </Card>

          {/* Reviews */}
          {course.reviews?.length > 0 && (
            <Card className="p-6 sm:p-7">
              <h2 className="text-xl font-extrabold text-[#EEF0FF] mb-4 tabular-nums">
                آراء وتقييمات المتدربين (مرتبطة بالكورس والمدرب) ({formatNumber(course.reviews.length)})
              </h2>
              <div className="space-y-4">
                {course.reviews.map((rev: any) => (
                  <div key={rev.id} className="rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-[#EEF0FF]">
                          {rev.user?.fullName}
                        </p>
                        {rev.instructor?.fullName && (
                          <span className="text-xs font-semibold text-[#8CA2FF]">
                            تقييم المدرب: {rev.instructor.fullName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#F5B94A] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          الكورس:
                          {Array.from({ length: rev.rating }).map((_, idx) => (
                            <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </span>
                        {rev.instructorRating && (
                          <span className="text-[#77E2B5]">
                            المدرب: {formatNumber(rev.instructorRating)}/5
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
            <Card spotlight className="p-6 space-y-3">
              <h3 className="text-base font-extrabold text-[#EEF0FF] tabular-nums">
                فريق التدريب المعتمد للبرنامج ({formatNumber(course.instructorAssignments.length)})
              </h3>
              <div className="space-y-2.5">
                {course.instructorAssignments.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3"
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
            <Card spotlight className="p-6 space-y-3">
              <h3 className="text-base font-extrabold text-[#EEF0FF]">
                هذا الكورس جزء من:
              </h3>
              {course.learningPathLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.learningPath.id}
                  href={`/learning-paths/${linkItem.learningPath.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-[#8CA2FF]/18 bg-[#0B1440]/85 p-3 transition-colors hover:border-[#8CA2FF]"
                >
                  <Layers className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                  <span className="text-sm font-bold text-[#EEF0FF]">
                    مسار: {linkItem.learningPath.titleAr}
                  </span>
                </Link>
              ))}
              {course.diplomaLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.diploma.id}
                  href={`/diplomas/${linkItem.diploma.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-[#8CA2FF]/35 bg-[#7C95FF]/14 p-3 transition-colors hover:border-[#8CA2FF]"
                >
                  <GraduationCap className="h-4 w-4 text-[#8CA2FF] shrink-0" />
                  <span className="text-sm font-bold text-[#EEF0FF]">
                    دبلومة: {linkItem.diploma.titleAr}
                  </span>
                </Link>
              ))}
            </Card>
          )}

          <Card className="p-6 bg-[#0B1440]/95 text-[#EEF0FF] border-[#8CA2FF]/18 space-y-3">
            <h3 className="text-base font-extrabold text-[#EEF0FF]">عن المدرب</h3>
            <p className="text-sm font-bold text-[#8CA2FF]">
              {course.instructor?.fullName}
            </p>
            <p className="text-sm leading-[1.8] text-[#A9B1E0]">
              {course.instructor?.bioAr || course.instructor?.headlineAr}
            </p>
          </Card>
        </aside>
      </section>
    </PublicPageLayout>
  );
}
