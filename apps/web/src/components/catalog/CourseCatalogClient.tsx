'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, PlayCircle, Search, SlidersHorizontal } from 'lucide-react';
import { difficultyLabelAr } from '@/lib/api';
import { Badge, Button, Card, EmptyState, inputClassName } from '@/components/ui/primitives';

export interface CatalogCourseCard {
  id: string;
  slug: string;
  isFree: boolean;
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
              <Search className="pointer-events-none absolute start-3.5 top-3.5 h-4 w-4 text-bosla-muted" />
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
                className={`min-h-[44px] w-full rounded-xl border px-3 text-xs font-extrabold transition-colors cursor-pointer ${
                  freeOnly
                    ? 'border-bosla-success bg-bosla-success text-white'
                    : 'border-bosla-line bg-white text-bosla-ink hover:border-bosla-primary'
                }`}
              >
                <SlidersHorizontal className="inline h-3.5 w-3.5 me-1.5" />
                {freeOnly ? 'المجانية فقط ✓' : 'عرض المجانية فقط'}
              </button>
            </div>
          </div>
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
          {filtered.map((course) => {
            const lessonCount =
              course.publishedVersion?.sections.reduce(
                (acc, s) => acc + (s._count?.lessons ?? s.lessons?.length ?? 0),
                0,
              ) ?? 0;
            return (
              <Card
                key={course.id}
                className="flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <Link
                  href={`/courses/${course.slug}`}
                  className="relative aspect-video overflow-hidden bg-slate-100"
                >
                  <img
                    src={
                      course.publishedVersion?.thumbnailUrl ||
                      '/images/brand/course-biosecurity.webp'
                    }
                    alt={course.publishedVersion?.titleAr || course.slug}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <span className="absolute top-3 start-3">
                    <Badge tone={course.isFree ? 'success' : 'warning'}>
                      {course.isFree ? 'كورس مجاني' : 'مشترك / عضوية'}
                    </Badge>
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-extrabold text-bosla-primary">
                    {course.category?.nameAr}
                  </span>
                  <Link href={`/courses/${course.slug}`}>
                    <h2 className="mt-1 text-lg font-extrabold text-bosla-ink hover:text-bosla-primary">
                      {course.publishedVersion?.titleAr || course.slug}
                    </h2>
                  </Link>
                  <p className="mt-2 text-xs leading-relaxed text-bosla-muted line-clamp-2">
                    {course.publishedVersion?.subtitleAr ||
                      course.publishedVersion?.descriptionAr}
                  </p>
                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center justify-between border-t border-bosla-line pt-3 text-xs text-bosla-muted">
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="h-3.5 w-3.5 text-bosla-primary" />
                        {lessonCount} درس
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.publishedVersion?.durationMinutes ?? 0} دقيقة
                      </span>
                      <span>{difficultyLabelAr(course.difficulty).split('—')[0]}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={
                            course.instructor.avatarUrl ||
                            '/images/brand/instructor-1.webp'
                          }
                          alt={course.instructor.fullName}
                          className="h-8 w-8 rounded-full border border-bosla-line object-cover shrink-0"
                        />
                        <span className="truncate text-xs font-bold text-bosla-ink">
                          {course.instructor.fullName}
                        </span>
                      </div>
                      <Link href={`/courses/${course.slug}`}>
                        <Button variant="outline" size="sm">
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
