'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, PlayCircle, Search, SlidersHorizontal } from 'lucide-react';
import { difficultyLabelAr, formatEgp, formatNumber } from '@/lib/api';
import { Badge, Button, Card, EmptyState, inputClassName } from '@/components/ui/primitives';

export interface CatalogCourseCard {
  id: string;
  slug: string;
  isFree: boolean;
  priceCents?: number;
  includedInMembership?: boolean;
  allowIndividualPurchase?: boolean;
  difficulty: string;
  category: { id: string; slug: string; nameAr: string };
  instructor: {
    id: string;
    fullName: string;
    headlineAr: string | null;
    avatarUrl: string | null;
  };
  publishedVersion: {
    titleAr: string;
    subtitleAr: string | null;
    descriptionAr: string;
    thumbnailUrl: string | null;
    durationMinutes: number;
    sections: Array<{
      id: string;
      _count?: { lessons: number };
      lessons?: Array<any>;
    }>;
  } | null;
}

const STAGGER_CLASSES = [
  'scroll-stagger-1',
  'scroll-stagger-2',
  'scroll-stagger-3',
];

export function CourseCatalogClient({
  courses,
  categories,
  initialCategory = 'all',
  initialDifficulty = 'all',
  initialFree = false,
}: {
  courses: CatalogCourseCard[];
  categories: Array<{ id: string; slug: string; nameAr: string }>;
  initialCategory?: string;
  initialDifficulty?: string;
  initialFree?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [freeOnly, setFreeOnly] = useState(initialFree);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (category !== 'all' && c.category?.slug !== category) return false;
      if (difficulty !== 'all' && c.difficulty !== difficulty) return false;
      if (freeOnly && !c.isFree) return false;
      if (!q) return true;
      return (
        (c.publishedVersion?.titleAr || '').toLowerCase().includes(q) ||
        (c.publishedVersion?.descriptionAr || '').toLowerCase().includes(q) ||
        c.instructor.fullName.toLowerCase().includes(q)
      );
    });
  }, [courses, search, category, difficulty, freeOnly]);

  return (
    <div className="space-y-8">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="catalog-search" className="mb-1.5 block text-xs font-extrabold text-bosla-ink">
              ابحث في الكورسات أو المدربين
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-3.5 h-4 w-4 text-bosla-tealText" />
              <input
                id="catalog-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="مثال: دواجن، أمان حيوي، تغذية، تسويق..."
                className={`${inputClassName} ps-10`}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[540px]">
            <div>
              <label htmlFor="cat-filter" className="mb-1.5 block text-xs font-extrabold text-bosla-ink">
                التخصص
              </label>
              <select
                id="cat-filter"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClassName}
              >
                <option value="all">كل التخصصات</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="diff-filter" className="mb-1.5 block text-xs font-extrabold text-bosla-ink">
                المستوى
              </label>
              <select
                id="diff-filter"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={inputClassName}
              >
                <option value="all">كل المستويات</option>
                <option value="BEGINNER">مبتدئ — مناسب للطلاب</option>
                <option value="INTERMEDIATE">متوسط — تطبيقي عملي</option>
                <option value="ADVANCED">متقدم — إداري وتشغيلي</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFreeOnly((v) => !v)}
                aria-pressed={freeOnly}
                className={`min-h-[44px] w-full rounded-[10px] border px-3 text-sm font-bold transition-colors cursor-pointer ${
                  freeOnly
                    ? 'border-[#C084FC]/60 bg-[#6B21A8] text-white'
                    : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50 hover:bg-[#18266E]'
                }`}
              >
                <SlidersHorizontal className="inline h-3.5 w-3.5 me-1.5" />
                {freeOnly ? 'المجانية فقط' : 'عرض المجانية فقط'}
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#22307A] pt-4">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer tabular-nums ${
              category === 'all'
                ? 'bg-[#6B21A8] text-white'
                : 'border border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50'
            }`}
          >
            الكل ({formatNumber(courses.length)})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-bold transition-colors cursor-pointer ${
                category === cat.slug
                  ? 'border border-[#C084FC]/60 bg-[#6B21A8]/24 text-[#E9D5FF]'
                  : 'border border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#C084FC]/50'
              }`}
            >
              {cat.nameAr}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد كورسات مطابقة لبحثك"
          description="جرب إزالة بعض المرشحات أو البحث بكلمات أخرى في مكتبة بوصلة."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setDifficulty('all');
                setFreeOnly(false);
              }}
            >
              إعادة ضبط الفلاتر
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course, idx) => {
            const lessonCount =
              course.publishedVersion?.sections.reduce(
                (acc, s) => acc + (s._count?.lessons ?? s.lessons?.length ?? 0),
                0,
              ) ?? 0;
            return (
              <Card
                key={course.id}
                className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 3]} bosla-card-hover group flex flex-col overflow-hidden`}
              >
                <Link
                  href={`/courses/${course.slug}`}
                  className="relative aspect-video overflow-hidden bg-bosla-navy"
                >
                  <img
                    src={
                      course.publishedVersion?.thumbnailUrl ||
                      '/images/brand/course-biosecurity.webp'
                    }
                    alt={course.publishedVersion?.titleAr || course.slug}
                    className="bosla-card-media h-full w-full object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bosla-navy/60 via-transparent to-transparent"
                  />
                  <span className="absolute top-3 start-3">
                    <Badge
                      tone={
                        course.isFree
                          ? 'success'
                          : course.includedInMembership === false
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {course.isFree
                        ? 'كورس مجاني'
                        : course.includedInMembership === false
                          ? `خارج العضوية • ${formatEgp(course.priceCents ?? 45000)}`
                          : course.allowIndividualPurchase !== false && Number(course.priceCents) > 0
                            ? `ضمن العضوية أو ${formatEgp(course.priceCents!)}`
                            : 'ضمن العضوية'}
                    </Badge>
                  </span>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-bold text-[#C084FC]">
                    {course.category?.nameAr}
                  </span>
                  <Link href={`/courses/${course.slug}`}>
                    <h2 className="mt-1.5 text-lg font-bold text-[#EEF0FF] transition-colors group-hover:text-[#E9D5FF] line-clamp-2">
                      <bdi>{course.publishedVersion?.titleAr || course.slug}</bdi>
                    </h2>
                  </Link>
                  <p className="mt-2 text-xs leading-relaxed text-[#A9B1E0] line-clamp-2">
                    {course.publishedVersion?.subtitleAr ||
                      course.publishedVersion?.descriptionAr}
                  </p>

                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#A9B1E0] border-t border-[#8CA2FF]/16 pt-3 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="h-3.5 w-3.5 text-[#C084FC]" />
                        {formatNumber(lessonCount)} درس
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#C084FC]" />
                        {formatNumber(course.publishedVersion?.durationMinutes ?? 0)} د
                      </span>
                      <span>{difficultyLabelAr(course.difficulty).split('—')[0]}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={
                            course.instructor.avatarUrl ||
                            '/images/brand/instructor-1.webp'
                          }
                          alt={course.instructor.fullName}
                          className="h-8 w-8 rounded-full object-cover ring-2 ring-[#8CA2FF]/25"
                        />
                        <span className="text-xs font-bold text-[#EEF0FF] truncate">
                          {course.instructor.fullName}
                        </span>
                      </div>
                      <Link href={`/courses/${course.slug}`}>
                        <Button variant="primary" size="sm">
                          التفاصيل
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
