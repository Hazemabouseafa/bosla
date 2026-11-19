import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Compass, Layers } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

export interface LearningPathCardData {
  id: string;
  slug: string;
  titleAr: string;
  subtitleAr: string | null;
  descriptionAr: string;
  thumbnailUrl: string | null;
  learningObjectives?: string[] | null;
  courses: Array<{
    id: string;
    sortOrder?: number;
    course: {
      slug: string;
      publishedVersion: {
        titleAr: string;
        thumbnailUrl?: string | null;
        durationMinutes: number;
      } | null;
    };
  }>;
}

export function LearningPathCard({
  path,
  index,
  headingLevel = 'h3',
  className = '',
}: {
  path: LearningPathCardData;
  index: number;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading = headingLevel;
  const totalMinutes = (path.courses ?? []).reduce(
    (sum, item) => sum + (item.course?.publishedVersion?.durationMinutes ?? 0),
    0,
  );
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));
  const objectives = Array.isArray(path.learningObjectives)
    ? path.learningObjectives.slice(0, 3)
    : [];
  const stepLabel = String(index + 1).padStart(2, '0');

  return (
    <article
      className={`bosla-card-hover group flex h-full flex-col overflow-hidden rounded-2xl border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] ${className}`}
    >
      {/* Visual Hero Banner */}
      <div className="relative aspect-[16/8] overflow-hidden bg-[#0B1440]">
        <img
          src={path.thumbnailUrl || '/images/brand/track-poultry.webp'}
          alt={path.titleAr}
          className="bosla-card-media block h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1440]/85 via-transparent to-transparent"
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#22307A] bg-[#0B1440] px-3.5 py-1.5 text-xs font-extrabold text-[#EEF0FF]">
            <span className="h-2 w-2 rounded-full bg-[#8CA2FF]" />
            مسار مهني #{stepLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/18 px-3.5 py-1.5 text-xs font-extrabold text-[#8CA2FF]">
            <Layers className="h-3.5 w-3.5 shrink-0 text-[#8CA2FF]" />
            <span>{path.courses.length} كورسات متدرجة</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22307A] bg-[#0B1440] px-3.5 py-1.5 text-xs font-extrabold text-[#EEF0FF]">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#8CA2FF]" />
            <span>~{totalHours} ساعات</span>
          </span>
        </div>

        <header className="space-y-2">
          {path.subtitleAr && (
            <p className="text-sm font-extrabold text-[#8CA2FF]">
              {path.subtitleAr}
            </p>
          )}
          <Heading className="text-xl font-extrabold leading-snug text-[#EEF0FF] sm:text-2xl">
            <Link
              href={`/learning-paths/${path.slug}`}
              className="transition-colors hover:text-[#8CA2FF] focus-visible:rounded-md"
            >
              {path.titleAr}
            </Link>
          </Heading>
        </header>

        <p className="mt-3 text-base leading-[1.7] text-[#A9B1E0]">
          {path.descriptionAr}
        </p>

        {/* Clear Numbered Course Progression */}
        <div className="mt-6 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-extrabold">
            <span className="inline-flex items-center gap-1.5 text-[#EEF0FF]">
              <Compass className="h-4 w-4 text-[#8CA2FF]" />
              خطة الكورسات داخل المسار
            </span>
            <span className="text-[#8CA2FF]">{totalMinutes} دقيقة تدريبية</span>
          </div>

          <ol className="mt-4 space-y-2.5">
            {path.courses.slice(0, 4).map((item, cIdx) => {
              const courseTitle =
                item.course.publishedVersion?.titleAr || item.course.slug;
              const courseMins = item.course.publishedVersion?.durationMinutes ?? 0;
              return (
                <li key={item.id}>
                  <Link
                    href={`/courses/${item.course.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0F1A4A] px-3.5 py-3 transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/35 bg-[#7C95FF]/18 text-xs font-extrabold text-[#8CA2FF]">
                        {String(cIdx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-extrabold leading-snug text-[#EEF0FF]">
                        {courseTitle}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm font-bold text-[#A9B1E0]">
                      <span>{courseMins} د</span>
                      <ArrowLeft className="h-3.5 w-3.5 text-[#8CA2FF]" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {path.courses.length > 4 && (
            <p className="mt-3 text-xs sm:text-sm font-bold text-[#8CA2FF]">
              + {path.courses.length - 4} كورسات إضافية داخل المسار الكامل
            </p>
          )}
        </div>

        {/* Key Career Outcomes */}
        {objectives.length > 0 && (
          <ul className="mt-5 space-y-2">
            {objectives.map((obj, oIdx) => (
              <li
                key={oIdx}
                className="flex items-start gap-2 text-sm leading-[1.6] text-[#A9B1E0]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#77E2B5]" />
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Prominent Footer CTA */}
      <footer className="mt-auto border-t border-[#22307A] bg-[#0B1440] px-6 py-5 sm:px-8">
        <Link href={`/learning-paths/${path.slug}`} className="block">
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-between px-6 text-sm sm:text-base"
          >
            <span>استكشف خطة المسار الكاملة</span>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </footer>
    </article>
  );
}
