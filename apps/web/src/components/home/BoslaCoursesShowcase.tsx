'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  Compass,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Route,
} from 'lucide-react';
import { apiFetch, difficultyLabelAr, formatEgp, formatNumber } from '@/lib/api';
import type { LearningPathCardData } from '@/components/catalog/LearningPathCard';
import type { HomepagePartner } from './BoslaPartnersSection';
import type { HeroCollectionTarget } from './BoslaHeroEditorial';

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
  coverFocalX?: number | null;
  coverFocalY?: number | null;
  coverFitMode?: string | null;
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

export interface HomepageDiplomaItem {
  id: string;
  slug: string;
  titleAr: string;
  descriptionAr: string;
  totalHours: number;
  thumbnailUrl: string | null;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
  coverFitMode?: string | null;
  courses?: Array<{
    id: string;
    course?: {
      slug?: string;
      publishedVersion?: {
        titleAr: string;
      } | null;
    };
  }>;
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

interface UnifiedMarqueeItem {
  uid: string;
  kind: 'course' | 'path' | 'diploma';
  href: string;
  titleAr: string;
  subtitleAr: string | null;
  thumbnailUrl: string;
  coverFocalX: number;
  coverFocalY: number;
  coverFitMode: string;
  primaryBadgeAr: string;
  accessLabelAr: string;
  accessTone: 'free' | 'membership' | 'paid' | 'program';
  durationLabelAr: string;
  secondaryMetaAr: string;
  footerNameAr: string;
  footerAvatarUrl: string | null;
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
      label: course.priceCents > 0 ? `شراء منفرد · ${formatEgp(course.priceCents)}` : 'خارج العضوية',
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
  learningPaths = [],
  diplomas = [],
  featuredCourseIds = [],
  titleAr,
  subtitleAr,
  motionPaused = false,
}: {
  initialData: HomepageCoursesPayload | null;
  initialFailed: boolean;
  learningPaths?: LearningPathCardData[];
  diplomas?: HomepageDiplomaItem[];
  featuredCourseIds?: string[];
  titleAr?: string | null;
  subtitleAr?: string | null;
  motionPaused?: boolean;
  collectionTab?: HeroCollectionTarget;
  onCollectionTabChange?: (tab: HeroCollectionTarget) => void;
}) {
  const [data, setData] = useState<HomepageCoursesPayload | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialFailed && !initialData);
  const [ribbonPaused, setRibbonPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(72);

  const shellRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) {
      setRibbonPaused(true);
    }
    const onChange = (e: MediaQueryListEvent) => setRibbonPaused(e.matches);
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

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

  const courses = useMemo(() => {
    const base = data?.courses ?? [];
    if (!featuredCourseIds || featuredCourseIds.length === 0) return base;
    return [...base].sort((a, b) => {
      const ia = featuredCourseIds.indexOf(a.id);
      const ib = featuredCourseIds.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });
  }, [data, featuredCourseIds]);

  // Unified slow-marquee items (real published Courses + Learning Paths + Diplomas — no category filtering!)
  const marqueeItems = useMemo<UnifiedMarqueeItem[]>(() => {
    const out: UnifiedMarqueeItem[] = [];
    const seen = new Set<string>();

    for (const c of courses) {
      if (!c.slug || seen.has(`course:${c.slug}`)) continue;
      seen.add(`course:${c.slug}`);
      const access = formatCourseAccessLabel(c);
      out.push({
        uid: `course:${c.id}`,
        kind: 'course',
        href: `/courses/${c.slug}`,
        titleAr: c.titleAr,
        subtitleAr: c.subtitleAr,
        thumbnailUrl: c.thumbnailUrl || '/images/brand/course-biosecurity.webp',
        coverFocalX: c.coverFocalX ?? 50,
        coverFocalY: c.coverFocalY ?? 50,
        coverFitMode: c.coverFitMode ?? 'COVER',
        primaryBadgeAr: c.category?.nameAr || 'كورس تطبيقي',
        accessLabelAr: access.label,
        accessTone: access.tone,
        durationLabelAr: formatDurationArabic(c.durationMinutes),
        secondaryMetaAr: `${formatNumber(c.lessonCount)} درس`,
        footerNameAr: c.instructor.fullName,
        footerAvatarUrl: c.instructor.avatarUrl || '/images/brand/instructor-1.webp',
      });
    }

    for (const p of learningPaths) {
      if (!p.slug || seen.has(`path:${p.slug}`)) continue;
      seen.add(`path:${p.slug}`);
      const totalMinutes = (p.courses ?? []).reduce(
        (sum, item) => sum + (item.course?.publishedVersion?.durationMinutes ?? 0),
        0,
      );
      const totalHours = Math.max(1, Math.round(totalMinutes / 60));
      out.push({
        uid: `path:${p.id}`,
        kind: 'path',
        href: `/learning-paths/${p.slug}`,
        titleAr: p.titleAr,
        subtitleAr: p.subtitleAr || p.descriptionAr,
        thumbnailUrl: p.thumbnailUrl || '/images/brand/track-poultry.webp',
        coverFocalX: p.coverFocalX ?? 50,
        coverFocalY: p.coverFocalY ?? 50,
        coverFitMode: p.coverFitMode ?? 'COVER',
        primaryBadgeAr: 'مسار تعليمي',
        accessLabelAr: 'مسار متدرج',
        accessTone: 'program',
        durationLabelAr: `${formatNumber(totalHours)} ساعة`,
        secondaryMetaAr: `${formatNumber(p.courses?.length ?? 0)} كورسات`,
        footerNameAr: 'مسار بوصلة التطبيقي',
        footerAvatarUrl: null,
      });
    }

    for (const d of diplomas) {
      if (!d.slug || seen.has(`diploma:${d.slug}`)) continue;
      seen.add(`diploma:${d.slug}`);
      out.push({
        uid: `diploma:${d.id}`,
        kind: 'diploma',
        href: `/diplomas/${d.slug}`,
        titleAr: d.titleAr,
        subtitleAr: d.descriptionAr,
        thumbnailUrl: d.thumbnailUrl || '/images/brand/course-vet-marketing.webp',
        coverFocalX: d.coverFocalX ?? 50,
        coverFocalY: d.coverFocalY ?? 50,
        coverFitMode: d.coverFitMode ?? 'COVER',
        primaryBadgeAr: 'دبلومة مهنية',
        accessLabelAr: 'شهادة معتمدة',
        accessTone: 'paid',
        durationLabelAr: `${formatNumber(d.totalHours || 0)} ساعة`,
        secondaryMetaAr: Array.isArray(d.courses)
          ? `${formatNumber(d.courses.length)} مقررات`
          : difficultyLabelAr('INTERMEDIATE').split('—')[0].trim(),
        footerNameAr: 'دبلومة أكاديمية بوصلة',
        footerAvatarUrl: null,
      });
    }

    return out;
  }, [courses, diplomas, learningPaths]);

  const effectivePaused = ribbonPaused || motionPaused;
  const useInfiniteMarquee = marqueeItems.length >= 2 && !effectivePaused;

  // Constant slow ~34 px/s linear marquee speed recalculated from real pixel width (MotionSites Technique #10)
  useEffect(() => {
    const groupEl = groupRef.current;
    if (!groupEl || marqueeItems.length < 2) return;
    const recalc = () => {
      const w = groupEl.scrollWidth;
      if (w > 0) {
        const secs = Math.max(36, Math.round(w / 34));
        setDurationSec(secs);
      }
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(groupEl);
    return () => ro.disconnect();
  }, [marqueeItems.length]);

  const renderCard = (item: UnifiedMarqueeItem, isClone = false) => {
    const badgeClass =
      item.accessTone === 'free'
        ? 'bg-[#0F5C4E] text-white'
        : item.accessTone === 'paid'
          ? 'bg-[#351078] text-white'
          : item.accessTone === 'program'
            ? 'bg-[#4A1FB0] text-white'
            : 'bg-[#FFFFFF] text-[#17243D] border border-[#4A1FB0]/25';

    const cardBody = (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#4A1FB0]/24 bg-[#C6E2F5] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF] shadow-[0_14px_30px_-22px_rgba(23,36,61,0.22)]">
        <div className="relative bg-[#ADD5F0] p-2.5">
          <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#4A1FB0]/20 bg-[#17243D]">
            <img
              src={item.thumbnailUrl}
              alt={isClone ? '' : item.titleAr}
              width={640}
              height={400}
              loading="lazy"
              decoding="async"
              style={{
                objectPosition: `${item.coverFocalX}% ${item.coverFocalY}%`,
              }}
              className={`h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03] ${
                item.coverFitMode === 'CONTAIN' ? 'object-contain p-1.5 bg-white' : 'object-cover'
              }`}
            />
          </div>
          <span
            className={`absolute top-4 start-4 rounded-lg px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${badgeClass}`}
          >
            {item.accessLabelAr}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
            <span className="inline-flex items-center gap-1 text-[#4A1FB0] truncate">
              {item.kind === 'path' ? (
                <Route className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : item.kind === 'diploma' ? (
                <Award className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{item.primaryBadgeAr}</span>
            </span>
          </div>

          <h3 className="mt-2 text-base sm:text-lg font-extrabold leading-[1.45] text-[#17243D] transition-colors group-hover:text-[#4A1FB0] line-clamp-2 bosla-display-font">
            <bdi>{item.titleAr}</bdi>
          </h3>

          {item.subtitleAr && (
            <p className="mt-2 text-xs leading-[1.7] font-medium text-[#263959] line-clamp-2">
              {item.subtitleAr}
            </p>
          )}

          <div className="mt-auto pt-4 space-y-3">
            <div className="flex items-center justify-between border-t border-[#17243D]/12 pt-3 text-xs font-bold text-[#263959] tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#4A1FB0]" strokeWidth={1.8} aria-hidden="true" />
                <span>{item.durationLabelAr}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#17243D]" strokeWidth={1.8} aria-hidden="true" />
                <span>{item.secondaryMetaAr}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {item.footerAvatarUrl && (
                  <img
                    src={item.footerAvatarUrl}
                    alt=""
                    width={30}
                    height={30}
                    loading="lazy"
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-[#4A1FB0]/30 shrink-0"
                  />
                )}
                <span className="text-xs font-extrabold text-[#17243D] truncate">
                  <bdi>{item.footerNameAr}</bdi>
                </span>
              </div>

              <span className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#351078] px-3.5 text-xs font-extrabold text-white transition-colors group-hover:bg-[#4A1FB0]">
                <span>التفاصيل</span>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    if (isClone) {
      return (
        <div
          key={`clone-${item.uid}`}
          aria-hidden="true"
          className="w-[290px] sm:w-[340px] shrink-0 select-none"
        >
          {cardBody}
        </div>
      );
    }

    return (
      <article
        key={item.uid}
        className="w-[290px] sm:w-[340px] shrink-0 snap-start"
      >
        <Link
          href={item.href}
          className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A1FB0]"
        >
          {cardBody}
        </Link>
      </article>
    );
  };

  return (
    <section
      id="courses-showcase"
      className="relative border-t border-[#4A1FB0]/20 bg-[#98C7E8] py-14 sm:py-20 text-[#17243D]"
      aria-labelledby="courses-showcase-heading"
    >
      <div className="relative z-10 mx-auto max-w-[1320px] px-4 sm:px-8 space-y-10">
        {/* Clean Editorial Header + Direct Links + Slow Ribbon Pause Control (No Classification Tabs) */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[66ch] space-y-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#351078]">
              <Compass className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
              <span>بوصلة المحتوى التعليمي المعتمد</span>
            </div>
            <h2
              id="courses-showcase-heading"
              className="text-[clamp(1.85rem,3.4vw,2.9rem)] font-black leading-[1.24] text-[#17243D] bosla-display-font"
            >
              {titleAr || 'البرامج والكورسات التطبيقية المعتمدة'}
            </h2>
            <p className="text-sm sm:text-base leading-[1.78] font-medium text-[#263959]">
              {subtitleAr ||
                'مناهج تطبيقية منشورة ومعتمدة في الطب البيطري، تغذية الحيوان، إنتاج الدواجن، والمبيعات التخصصية.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {marqueeItems.length >= 2 && (
              <button
                type="button"
                data-testid="courses-marquee-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setRibbonPaused((p) => !p);
                }}
                aria-pressed={effectivePaused}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#4A1FB0]/30 bg-[#C6E2F5] px-4 text-xs sm:text-sm font-extrabold text-[#17243D] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF] cursor-pointer"
              >
                {effectivePaused ? (
                  <Play className="h-3.5 w-3.5 text-[#4A1FB0]" aria-hidden="true" />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-[#4A1FB0]" aria-hidden="true" />
                )}
                <span>{effectivePaused ? 'تشغيل الشريط' : 'إيقاف الشريط'}</span>
              </button>
            )}
            <Link
              href="/courses"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#4A1FB0] px-5 text-sm font-extrabold text-white transition-colors hover:bg-[#351078]"
            >
              <span>كل الكورسات</span>
              {courses.length > 0 && (
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {formatNumber(courses.length)}
                </span>
              )}
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            {learningPaths.length > 0 && (
              <Link
                href="/learning-paths"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#4A1FB0]/30 bg-[#C6E2F5] px-4 text-xs sm:text-sm font-bold text-[#17243D] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF]"
              >
                المسارات ({formatNumber(learningPaths.length)})
              </Link>
            )}
            {diplomas.length > 0 && (
              <Link
                href="/diplomas"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#4A1FB0]/30 bg-[#C6E2F5] px-4 text-xs sm:text-sm font-bold text-[#17243D] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF]"
              >
                الدبلومات ({formatNumber(diplomas.length)})
              </Link>
            )}
          </div>
        </div>

        {/* Loading / Error / Empty Fallbacks */}
        {loading && (
          <div className="flex gap-6 overflow-hidden" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="w-[300px] sm:w-[340px] shrink-0 overflow-hidden rounded-2xl border border-[#4A1FB0]/20 bg-[#C6E2F5] p-4 space-y-4"
              >
                <div className="aspect-[16/10] w-full rounded-xl bg-[#ADD5F0]" />
                <div className="h-4 w-24 rounded bg-[#ADD5F0]" />
                <div className="h-6 w-4/5 rounded bg-[#ADD5F0]" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#4A1FB0]/25 bg-[#C6E2F5] p-8 text-center sm:flex-row sm:text-start"
          >
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#17243D] bosla-display-font">
                تعذر تحميل قائمة الكورسات حالياً
              </h3>
              <p className="text-sm text-[#263959]">
                يمكنك إعادة المحاولة أو الانتقال مباشرة إلى صفحة الكتالوج الكاملة.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4A1FB0] px-5 text-sm font-bold text-white transition-colors hover:bg-[#351078] cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                <span>إعادة المحاولة</span>
              </button>
              <Link
                href="/courses"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#4A1FB0]/30 bg-[#FFFFFF] px-5 text-sm font-bold text-[#17243D] hover:border-[#4A1FB0]"
              >
                فتح الكتالوج
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && marqueeItems.length === 0 && (
          <div className="rounded-2xl border border-[#4A1FB0]/20 bg-[#C6E2F5] px-6 py-12 text-center space-y-4">
            <h3 className="text-xl font-bold text-[#17243D] bosla-display-font">
              لا توجد برامج أو كورسات منشورة للعرض العام حالياً
            </h3>
            <Link
              href="/courses"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#4A1FB0]/30 bg-[#FFFFFF] px-5 text-sm font-bold text-[#17243D] hover:border-[#4A1FB0]"
            >
              الانتقال لصفحة الكورسات
            </Link>
          </div>
        )}

        {/* Continuous Slow Infinite Marquee Ribbon (Paused safely on hover / focus / toggle / reduced-motion) */}
        {!loading && !error && marqueeItems.length > 0 && (
          <div
            ref={shellRef}
            data-testid="courses-slow-marquee"
            className={`bosla-courses-marquee-shell py-2 ${
              effectivePaused ? 'overflow-x-auto scroll-smooth' : 'overflow-hidden'
            }`}
          >
            <div
              data-paused={effectivePaused ? 'true' : 'false'}
              style={{ '--courses-marquee-duration': `${durationSec}s` } as React.CSSProperties}
              className={`bosla-courses-marquee-track ${
                effectivePaused ? 'gap-6 snap-x snap-mandatory pb-2' : ''
              }`}
            >
              <div
                ref={groupRef}
                className={`bosla-courses-marquee-group flex items-stretch gap-6 ${
                  useInfiniteMarquee ? 'pe-6' : ''
                }`}
              >
                {marqueeItems.map((item) => renderCard(item, false))}
              </div>

              {useInfiniteMarquee && (
                <div
                  aria-hidden="true"
                  className="bosla-courses-marquee-group flex items-stretch gap-6 pe-6"
                >
                  {marqueeItems.map((item) => renderCard(item, true))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
