import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
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
import { difficultyLabelAr, serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card } from '@/components/ui/primitives';

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
      {/* Top Banner */}
      <section className="bg-gradient-to-l from-bosla-navy to-bosla-primary text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/15 text-white border-white/25">
                {course.category?.nameAr}
              </Badge>
              <Badge tone={course.isFree ? 'success' : 'warning'}>
                {course.isFree ? 'كورس مجاني بالكامل' : 'مشمول ضمن العضوية'}
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              {version?.titleAr || course.slug}
            </h1>
            <p className="text-base text-indigo-100 leading-relaxed">
              {version?.subtitleAr || version?.descriptionAr}
            </p>
            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs font-bold text-indigo-100">
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-bosla-amber" />
                {totalLessons} درس
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-bosla-amber" />
                {version?.durationMinutes ?? 0} دقيقة
              </span>
              <span>{difficultyLabelAr(course.difficulty)}</span>
            </div>

            <div className="flex flex-wrap gap-3 pt-3">
              <Link href={`/learn/${course.slug}`}>
                <Button variant="gold" size="lg">
                  <PlayCircle className="h-5 w-5" />
                  دخول مشغل الكورس والدروس
                </Button>
              </Link>
              {!course.isFree && (
                <Link href="/pricing">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    اشترك لفتح الكورس
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <Card className="overflow-hidden border-white/20 bg-white/10 p-2 backdrop-blur-md">
              <img
                src={version?.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                alt={version?.titleAr || course.slug}
                className="aspect-video w-full rounded-xl object-cover"
              />
              <div className="flex items-center gap-3 p-3 text-white">
                <img
                  src={course.instructor?.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={course.instructor?.fullName}
                  className="h-12 w-12 rounded-full border border-white/30 object-cover"
                />
                <div>
                  <p className="text-sm font-extrabold">{course.instructor?.fullName}</p>
                  <p className="text-xs text-indigo-100">
                    {course.instructor?.headlineAr || 'خبير أكاديمية بوصلة'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
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
                    <CheckCircle2 className="h-4 w-4 text-bosla-success shrink-0 mt-1" />
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
              <Link href={`/learn/${course.slug}`} className="text-xs font-extrabold text-bosla-primary hover:underline">
                بدء المشاهدة ←
              </Link>
            </div>
            <div className="space-y-4">
              {sections.map((sec, sIdx) => (
                <div
                  key={sec.id}
                  className="overflow-hidden rounded-2xl border border-bosla-line"
                >
                  <div className="flex items-center justify-between bg-bosla-bg/80 px-4 py-3">
                    <h3 className="text-sm font-extrabold text-bosla-navy">
                      {sIdx + 1}. {sec.titleAr}
                    </h3>
                    <span className="text-xs font-bold text-bosla-muted">
                      {sec.lessons.length} دروس
                    </span>
                  </div>
                  <div className="divide-y divide-bosla-line bg-white">
                    {sec.lessons.map((lesson: any) => (
                      <div
                        key={lesson.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          {lesson.isFreePreview || course.isFree ? (
                            <PlayCircle className="h-4 w-4 text-bosla-success shrink-0" />
                          ) : (
                            <Lock className="h-4 w-4 text-bosla-muted shrink-0" />
                          )}
                          <span className="font-bold text-bosla-ink">{lesson.titleAr}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-bosla-muted">
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
                آراء المتدربين ({course.reviews.length})
              </h2>
              <div className="space-y-4">
                {course.reviews.map((rev: any) => (
                  <div key={rev.id} className="rounded-xl border border-bosla-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-bosla-ink">
                        {rev.user?.fullName}
                      </p>
                      <div className="flex items-center gap-0.5 text-bosla-amber">
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    {rev.commentAr && (
                      <p className="mt-2 text-xs text-bosla-muted">{rev.commentAr}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {requirements.length > 0 && (
            <Card className="p-6">
              <h3 className="text-base font-extrabold text-bosla-ink mb-3">
                المتطلبات المسبقة
              </h3>
              <ul className="space-y-2 text-xs text-bosla-muted">
                {requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(course.learningPathLinks?.length > 0 || course.diplomaLinks?.length > 0) && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-extrabold text-bosla-ink">
                هذا الكورس جزء من:
              </h3>
              {course.learningPathLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.learningPath.id}
                  href={`/learning-paths/${linkItem.learningPath.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-bosla-line p-3 hover:border-bosla-primary"
                >
                  <Layers className="h-4 w-4 text-bosla-primary shrink-0" />
                  <span className="text-xs font-extrabold text-bosla-ink">
                    مسار: {linkItem.learningPath.titleAr}
                  </span>
                </Link>
              ))}
              {course.diplomaLinks?.map((linkItem: any) => (
                <Link
                  key={linkItem.diploma.id}
                  href={`/diplomas/${linkItem.diploma.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 hover:border-bosla-amber"
                >
                  <GraduationCap className="h-4 w-4 text-bosla-amber shrink-0" />
                  <span className="text-xs font-extrabold text-bosla-ink">
                    دبلومة: {linkItem.diploma.titleAr}
                  </span>
                </Link>
              ))}
            </Card>
          )}

          <Card className="p-6 bg-bosla-navy text-white space-y-3">
            <h3 className="text-base font-extrabold">عن المدرب</h3>
            <p className="text-sm font-bold text-bosla-amber">
              {course.instructor?.fullName}
            </p>
            <p className="text-xs leading-relaxed text-indigo-100">
              {course.instructor?.bioAr || course.instructor?.headlineAr}
            </p>
          </Card>
        </aside>
      </section>
    </PublicPageLayout>
  );
}
