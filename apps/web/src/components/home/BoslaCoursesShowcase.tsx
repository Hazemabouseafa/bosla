'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiFetch, difficultyLabelAr, formatEgp, formatNumber } from '@/lib/api';
import type { HomepagePartner } from './BoslaPartnersSection';

export interface HomepageShowcaseCourse {
  id: string;
  slug: string;
  isFree: boolean;
  priceCents: number;
  currency: string;
  includedInMembership: boolean;
  allowIndividualPurchase: boolean;
  difficulty: string;
  deliveryMode: string;
  featuredOrder: number | null;
  publishedAt: string | null;
  category: { id: string; slug: string; nameAr: string } | null;
  instructor: {
    id: string;
    fullName: string;
    headlineAr: string | null;
    avatarUrl: string | null;
  };
  titleAr: string;
  subtitleAr: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number;
  lessonCount: number;
}

export interface HomepageCoursesPayload {
  courses: HomepageShowcaseCourse[];
  categories: Array<{ id: string; slug: string; nameAr: string }>;
  partners?: HomepagePartner[];
  stats: {
    publishedCoursesCount: number;
    activeInstructorsCount: number;
  };
}

function formatCourseAccessLabel(course: HomepageShowcaseCourse): {
  label: string;
  tone: 'free' | 'membership' | 'paid';
} {
  if (course.isFree) {
    return { label: 'مجاني بالكامل', tone: 'free' };
  }
  if (course.includedInMembership === false) {
    return {
      label: course.priceCents > 0 ? `شراء منفرد • ${formatEgp(course.priceCents)}` : 'خارج العضوية',
      tone: 'paid',
    };
  }
  if (course.allowIndividualPurchase !== false && course.priceCents > 0) {
    return {
      label: `ضمن العضوية أو ${formatEgp(course.priceCents)}`,
      tone: 'membership',
    };
  }
  return { label: 'متاح ضمن العضوية', tone: 'membership' };
}

function formatDurationArabic(minutes: number): string {
  const safeMins = Math.max(0, Math.round(minutes || 0));
  if (safeMins >= 60) {
    const hrs = Math.floor(safeMins / 60);
    const rem = safeMins % 60;
    return rem > 0 ? `${formatNumber(hrs)} س ${formatNumber(rem)} د` : `${formatNumber(hrs)} ساعة`;
  }
  return `${formatNumber(safeMins)} دقيقة`;
}

export function BoslaCoursesShowcase({
  initialData,
  initialFailed,
}: {
  initialData: HomepageCoursesPayload | null;
  initialFailed: boolean;
}) {
  const [data, setData] = useState<HomepageCoursesPayload | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialFailed && !initialData);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleRetry = async () => {
    setLoading(true);
    setError(false);
    try {
      const fresh = await apiFetch<HomepageCoursesPayload>('/catalog/homepage-courses');
      setData(fresh);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const courses = useMemo(() => data?.courses ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);

  const filteredCourses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return courses.filter((course) => {
      if (selectedCategory !== 'all' && course.category?.slug !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        course.titleAr.toLowerCase().includes(q) ||
        (course.subtitleAr || '').toLowerCase().includes(q) ||
        (course.category?.nameAr || '').toLowerCase().includes(q) ||
        course.instructor.fullName.toLowerCase().includes(q)
      );
    });
  }, [courses, selectedCategory, searchTerm]);

  const showSpotlight =
    selectedCategory === 'all' && !searchTerm.trim() && filteredCourses.length >= 3;
  const spotlightCourse = showSpotlight ? filteredCourses[0] : null;
  const remainingCourses = showSpotlight ? filteredCourses.slice(1, 7) : filteredCourses.slice(0, 6);

  return (
    <section
      id="courses-showcase"
      className="relative border-t border-[#22307A] bg-[#050A24]"
      style={{ padding: 'clamp(72px, 10vw, 118px) clamp(18px, 4vw, 36px)' }}
      aria-labelledby="courses-showcase-heading"
    >
      <div className="mx-auto max-w-[1240px] space-y-10">
        {/* Editorial Section Header + Direct Link to Full Catalog */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[62ch] space-y-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#C084FC]">
              <BookOpen className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
              <span>الكورسات المعتمدة والمنشورة</span>
            </span>
            <h2
              id="courses-showcase-heading"
              className="text-[clamp(1.75rem,3.3vw,2.85rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
            >
              تعلّم تطبيقي يقودك مباشرة إلى واقع الميدان
            </h2>
            <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">
              تصفّح الكورسات المنشورة والمعتمدة في الطب البيطري، تغذية الحيوان، إدارة مزارع الدواجن،
              والمبيعات البيطرية — وافتح تفاصيل أي كورس لمعرفة المحاور والمدرب ونظام الالتحاق.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/courses"
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-[#C084FC]/35 bg-[#070D2B] px-5 text-sm font-bold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/22"
            >
              <span>عرض الكتالوج الكامل</span>
              {courses.length > 0 && (
                <span className="rounded-md bg-[#6B21A8]/35 px-2 py-0.5 text-xs font-semibold text-[#E9D5FF] tabular-nums">
                  {formatNumber(courses.length)}
                </span>
              )}
              <ArrowLeft className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Category Filter Tabs & Compact Search */}
        {!error && courses.length > 0 && (
          <div className="flex flex-col gap-4 rounded-xl border border-[#22307A] bg-[#070D2B] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="تصفية الكورسات حسب التخصص"
            >
              <button
                type="button"
                aria-pressed={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
                className={`min-h-[40px] shrink-0 rounded-lg px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#6B21A8] text-white'
                    : 'border border-[#22307A] bg-[#0B1440] text-[#C2CAF2] hover:border-[#C084FC]/45 hover:text-[#EEF0FF]'
                }`}
              >
                الكل ({formatNumber(courses.length)})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selectedCategory === cat.slug}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`min-h-[40px] shrink-0 rounded-lg px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    selectedCategory === cat.slug
                      ? 'bg-[#6B21A8] text-white'
                      : 'border border-[#22307A] bg-[#0B1440] text-[#C2CAF2] hover:border-[#C084FC]/45 hover:text-[#EEF0FF]'
                  }`}
                >
                  {cat.nameAr}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-[260px] shrink-0">
              <label htmlFor="home-course-search" className="visually-hidden">
                بحث في الكورسات
              </label>
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C084FC]"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <input
                id="home-course-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالعنوان أو المدرب"
                className="min-h-[42px] w-full rounded-lg border border-[#22307A] bg-[#050A24] pe-3.5 ps-10 text-xs sm:text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-[#22307A] bg-[#070D2B] p-4 space-y-4"
              >
                <div className="aspect-video w-full rounded-xl bg-[#0F1A4A]" />
                <div className="h-4 w-24 rounded bg-[#0F1A4A]" />
                <div className="h-6 w-4/5 rounded bg-[#0F1A4A]" />
                <div className="h-4 w-2/3 rounded bg-[#0F1A4A]" />
              </div>
            ))}
          </div>
        )}

        {/* Graceful API Error State */}
        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#22307A] bg-[#070D2B] p-8 text-center sm:flex-row sm:text-start"
          >
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#EEF0FF] bosla-display-font">
                تعذر تحميل قائمة الكورسات حالياً
              </h3>
              <p className="text-sm text-[#C2CAF2]">
                يمكنك إعادة المحاولة أو الانتقال مباشرة إلى صفحة الكتالوج الكاملة.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#6B21A8] px-5 text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
                <span>إعادة المحاولة</span>
              </button>
              <Link
                href="/courses"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#8CA2FF]/35 px-5 text-sm font-semibold text-[#EEF0FF] hover:border-[#C084FC]"
              >
                فتح الكتالوج
              </Link>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredCourses.length === 0 && (
          <div className="rounded-2xl border border-[#22307A] bg-[#070D2B] px-6 py-12 text-center space-y-4">
            <h3 className="text-xl font-bold text-[#EEF0FF] bosla-display-font">
              {courses.length === 0
                ? 'لا توجد كورسات منشورة للعرض العام حالياً'
                : 'لا توجد كورسات مطابقة للتصفية الحالية'}
            </h3>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-[#C2CAF2]">
              {courses.length === 0
                ? 'يتم نشر الكورسات بعد اعتمادها مراجعةً ومحتوىً من إدارة الأكاديمية، ويمكنك تصفح الكتالوج أو التواصل معنا للاستفسار.'
                : 'جرّب اختيار تخصص آخر أو مسح عبارة البحث لاستعراض بقية الكورسات المنشورة.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {courses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchTerm('');
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#6B21A8] px-5 text-sm font-bold text-white hover:bg-[#7E22CE] cursor-pointer"
                >
                  عرض جميع الكورسات المنشورة
                </button>
              )}
              <Link
                href="/courses"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#8CA2FF]/35 bg-[#0B1440] px-5 text-sm font-semibold text-[#EEF0FF] hover:border-[#C084FC]"
              >
                الانتقال لصفحة الكورسات
              </Link>
            </div>
          </div>
        )}

        {/* Tier 1: Editorial Spotlight Lead Card (Asymmetric Split Hero Feature) */}
        {!loading && !error && spotlightCourse && (
          <article className="bosla-course-reveal group grid overflow-hidden rounded-2xl border border-[#C084FC]/30 bg-[#070D2B] lg:grid-cols-12 transition-colors hover:border-[#C084FC]/65">
            <Link
              href={`/courses/${spotlightCourse.slug}`}
              className="relative aspect-video lg:aspect-auto lg:min-h-[360px] lg:col-span-6 overflow-hidden bg-[#0B1440]"
            >
              <img
                src={spotlightCourse.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                alt={spotlightCourse.titleAr}
                width={960}
                height={540}
                loading="lazy"
                decoding="async"
                className="bosla-spotlight-cover h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050A24]/80 to-transparent"
              />
            </Link>

            <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {spotlightCourse.featuredOrder !== null && (
                    <span className="rounded-md border border-[#C084FC]/40 bg-[#6B21A8]/22 px-3 py-1 text-[#E9D5FF]">
                      كورس مختار للبدء
                    </span>
                  )}
                  {spotlightCourse.category && (
                    <span className="rounded-md bg-[#18266E] px-3 py-1 text-[#C2CAF2]">
                      {spotlightCourse.category.nameAr}
                    </span>
                  )}
                  <span className="rounded-md border border-[#22307A] bg-[#0B1440] px-3 py-1 text-[#A9B1E0]">
                    {difficultyLabelAr(spotlightCourse.difficulty).split('—')[0].trim()}
                  </span>
                </div>

                <Link href={`/courses/${spotlightCourse.slug}`} className="block">
                  <h3 className="text-[clamp(1.35rem,2.2vw,1.95rem)] font-bold leading-[1.35] text-[#EEF0FF] transition-colors group-hover:text-[#C084FC] bosla-display-font">
                    <bdi>{spotlightCourse.titleAr}</bdi>
                  </h3>
                </Link>

                {spotlightCourse.subtitleAr && (
                  <p className="text-sm sm:text-[0.98rem] leading-[1.75] text-[#C2CAF2] line-clamp-3">
                    {spotlightCourse.subtitleAr}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[#22307A]/80 py-3 text-xs sm:text-sm font-semibold text-[#C2CAF2] tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                    <span>{formatDurationArabic(spotlightCourse.durationMinutes)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#8CA2FF]" strokeWidth={1.6} aria-hidden="true" />
                    <span>{formatNumber(spotlightCourse.lessonCount)} درس</span>
                  </span>
                  <span className="text-[#EEF0FF] font-bold">
                    {formatCourseAccessLabel(spotlightCourse).label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={spotlightCourse.instructor.avatarUrl || '/images/brand/instructor-1.webp'}
                      alt={spotlightCourse.instructor.fullName}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-[#C084FC]/35 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#EEF0FF] truncate">
                        <bdi>{spotlightCourse.instructor.fullName}</bdi>
                      </p>
                      {spotlightCourse.instructor.headlineAr && (
                        <p className="text-xs text-[#A9B1E0] truncate">
                          {spotlightCourse.instructor.headlineAr}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/courses/${spotlightCourse.slug}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#6B21A8] px-5 text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87]"
                  >
                    <span>تفاصيل الكورس</span>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Tier 2: Varied Bento Grid (First remaining spans 2 cols horizontally when >= 3 remaining or asymmetric rhythm) */}
        {!loading && !error && remainingCourses.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {remainingCourses.map((course, idx) => {
              const access = formatCourseAccessLabel(course);
              const isSecondaryFeature = showSpotlight && remainingCourses.length === 4 && idx === 0;
              return (
                <article
                  key={course.id}
                  className={`bosla-course-reveal group flex flex-col overflow-hidden rounded-2xl border border-[#22307A] bg-[#070D2B] transition-colors hover:border-[#C084FC]/50 ${
                    isSecondaryFeature ? 'lg:col-span-2 lg:grid lg:grid-cols-12' : ''
                  }`}
                >
                  <Link
                    href={`/courses/${course.slug}`}
                    className={`relative overflow-hidden bg-[#0B1440] ${
                      isSecondaryFeature
                        ? 'aspect-video lg:aspect-auto lg:col-span-5'
                        : 'aspect-video'
                    }`}
                  >
                    <img
                      src={course.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                      alt={course.titleAr}
                      width={640}
                      height={360}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#050A24]/85 to-transparent"
                    />
                    <span
                      className={`absolute top-3 start-3 rounded-md px-2.5 py-1 text-[11px] font-bold backdrop-blur-md ${
                        access.tone === 'free'
                          ? 'border border-[#77E2B5]/45 bg-[#050A24]/88 text-[#77E2B5]'
                          : access.tone === 'paid'
                            ? 'border border-[#C084FC]/45 bg-[#050A24]/88 text-[#E9D5FF]'
                            : 'border border-[#8CA2FF]/40 bg-[#050A24]/88 text-[#EEF0FF]'
                      }`}
                    >
                      {access.label}
                    </span>
                  </Link>

                  <div
                    className={`flex flex-1 flex-col p-5 sm:p-6 ${
                      isSecondaryFeature ? 'lg:col-span-7 justify-between' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                        <span className="text-[#C084FC] truncate">
                          {course.category?.nameAr || 'تخصص تطبيقي'}
                        </span>
                        <span className="text-[#A9B1E0] shrink-0">
                          {difficultyLabelAr(course.difficulty).split('—')[0].trim()}
                        </span>
                      </div>

                      <Link href={`/courses/${course.slug}`} className="mt-2 block">
                        <h3 className="text-lg font-bold leading-[1.45] text-[#EEF0FF] transition-colors group-hover:text-[#C084FC] line-clamp-2 bosla-display-font">
                          <bdi>{course.titleAr}</bdi>
                        </h3>
                      </Link>

                      {course.subtitleAr && (
                        <p className="mt-2 text-xs sm:text-[0.84rem] leading-[1.7] text-[#C2CAF2] line-clamp-2">
                          {course.subtitleAr}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto pt-4 space-y-3.5">
                      <div className="flex items-center justify-between border-t border-[#22307A]/80 pt-3 text-xs font-semibold text-[#A9B1E0] tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                          <span>{formatDurationArabic(course.durationMinutes)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-[#8CA2FF]" strokeWidth={1.6} aria-hidden="true" />
                          <span>{formatNumber(course.lessonCount)} درس</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-0.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={course.instructor.avatarUrl || '/images/brand/instructor-1.webp'}
                            alt={course.instructor.fullName}
                            width={34}
                            height={34}
                            loading="lazy"
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-[#C084FC]/35 shrink-0"
                          />
                          <span className="text-xs font-bold text-[#EEF0FF] truncate">
                            <bdi>{course.instructor.fullName}</bdi>
                          </span>
                        </div>

                        <Link
                          href={`/courses/${course.slug}`}
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#C084FC]/35 bg-[#0B1440] px-3.5 text-xs font-bold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8] hover:text-white"
                        >
                          <span>التفاصيل</span>
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
