'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, BookOpen, Pause, Play, Sparkles, Users } from 'lucide-react';
import { apiFetch, formatNumber } from '@/lib/api';
import { NativeModal } from '@/components/ui/primitives';

export interface HomepageTrainerCard {
  id: string;
  fullName: string;
  headlineAr?: string | null;
  bioAr?: string | null;
  avatarUrl?: string | null;
  instructorProfile?: {
    specializations?: string[] | null;
    yearsExperience?: number | null;
    showOnHomepage?: boolean;
    homepageSortOrder?: number;
  } | null;
  instructedCourses?: Array<{
    id: string;
    slug: string;
    publishedVersion?: {
      titleAr: string;
      thumbnailUrl?: string | null;
    } | null;
  }>;
}

export function BoslaTrainersMarquee({
  trainers,
  titleAr = 'الخبراء والمدربون المعتمدون',
  subtitleAr = 'تعلّم مباشرة من قادة وممارسي الإنتاج الداجني والبيطري وإدارة المزارع ومصانع الأعلاف',
  autoSpeedSeconds = 36,
  onSelectSectionInEditor,
}: {
  trainers: HomepageTrainerCard[];
  titleAr?: string;
  subtitleAr?: string;
  autoSpeedSeconds?: number;
  onSelectSectionInEditor?: () => void;
}) {
  const [motionPaused, setMotionPaused] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<HomepageTrainerCard | null>(null);
  const [trainerDetail, setTrainerDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) setMotionPaused(true);
  }, []);

  if (!trainers || trainers.length === 0) {
    return null;
  }

  const openTrainerProfile = async (trainer: HomepageTrainerCard) => {
    setSelectedTrainer(trainer);
    setTrainerDetail(null);
    setDetailLoading(true);
    try {
      const res = await apiFetch<any>(`/catalog/instructors/${encodeURIComponent(trainer.id)}`);
      setTrainerDetail(res);
    } catch {
      setTrainerDetail(trainer);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderCard = (trainer: HomepageTrainerCard, isClone = false) => {
    const coursesCount = trainer.instructedCourses?.length ?? 0;
    const specs = Array.isArray(trainer.instructorProfile?.specializations)
      ? trainer.instructorProfile?.specializations.slice(0, 2)
      : [];

    const inner = (
      <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-white)] transition-all hover:border-[var(--bosla-color-purple-royal)] hover:shadow-[0_18px_36px_-22px_rgba(74,31,176,0.28)]">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bosla-color-blue-light)]">
          <img
            src={trainer.avatarUrl || '/images/brand/instructor-1.webp'}
            alt={isClone ? '' : trainer.fullName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bosla-color-ink)]/68 via-[var(--bosla-color-ink)]/15 to-transparent"
          />
          {coursesCount > 0 && (
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-full bg-[var(--bosla-color-white)] border border-[var(--bosla-home-border)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--bosla-color-ink)] shadow-sm">
              <BookOpen className="h-3 w-3 text-[var(--bosla-color-purple-royal)]" aria-hidden="true" />
              {formatNumber(coursesCount)} كورس
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-4 space-y-2 text-start">
          <div>
            <h3 className="text-base font-extrabold text-[var(--bosla-color-ink)] group-hover:text-[var(--bosla-color-purple-royal)] transition-colors line-clamp-1 bosla-display-font">
              {trainer.fullName}
            </h3>
            <p className="mt-1 text-xs font-medium text-[var(--bosla-color-ink-muted)] line-clamp-2">
              {trainer.headlineAr || 'خبير ومدرب معتمد بأكاديمية بوصلة'}
            </p>
          </div>
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {specs.map((sp) => (
                <span
                  key={sp}
                  className="rounded-md border border-[var(--bosla-home-border)] bg-[var(--bosla-color-purple-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--bosla-color-purple-royal)]"
                >
                  {sp}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    if (isClone) {
      return (
        <div
          key={`clone-${trainer.id}`}
          aria-hidden="true"
          className="w-[240px] sm:w-[260px] shrink-0 select-none"
        >
          {inner}
        </div>
      );
    }

    return (
      <button
        key={trainer.id}
        type="button"
        onClick={() => void openTrainerProfile(trainer)}
        className="w-[240px] sm:w-[260px] shrink-0 text-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bosla-color-purple-royal)] rounded-2xl"
      >
        {inner}
      </button>
    );
  };

  const useMarquee = trainers.length >= 4;
  const durationSec = Math.max(12, Math.min(90, Number(autoSpeedSeconds) || 36));
  const detail = trainerDetail || selectedTrainer;

  return (
    <section
      id="trainers"
      onClick={() => onSelectSectionInEditor?.()}
      style={{
        backgroundColor: 'var(--bosla-color-blue-light)',
        backgroundImage: 'var(--bosla-band-trainers)',
      }}
      className="relative overflow-hidden py-16 sm:py-20 text-[var(--bosla-color-ink)]"
      aria-labelledby="trainers-heading"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[58ch] space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[var(--bosla-color-purple-royal)]">
              <Users className="h-4 w-4 text-[var(--bosla-color-purple-support)]" aria-hidden="true" />
              <span>هيئة التدريب والخبرة الميدانية</span>
            </div>
            <h2
              id="trainers-heading"
              className="text-[clamp(1.8rem,3.1vw,2.6rem)] font-black leading-[1.28] text-[var(--bosla-color-ink)] bosla-display-font"
            >
              {titleAr}
            </h2>
            <p className="text-sm sm:text-base leading-[1.75] font-medium text-[var(--bosla-color-ink-muted)]">
              {subtitleAr}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {useMarquee && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMotionPaused((p) => !p);
                }}
                aria-pressed={motionPaused}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-white)]/92 px-3.5 text-xs font-extrabold text-[var(--bosla-color-ink)] hover:border-[var(--bosla-color-purple-royal)] hover:bg-[var(--bosla-color-white)] cursor-pointer"
              >
                {motionPaused ? <Play className="h-3.5 w-3.5 text-[var(--bosla-color-purple-royal)]" /> : <Pause className="h-3.5 w-3.5 text-[var(--bosla-color-purple-royal)]" />}
                <span>{motionPaused ? 'تشغيل العرض التلقائي' : 'إيقاف العرض التلقائي'}</span>
              </button>
            )}
            <Link
              href="/instructors"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--bosla-color-purple-royal)] px-4 text-xs sm:text-sm font-extrabold text-[var(--bosla-color-white)] hover:bg-[var(--bosla-color-purple-support)] transition-colors shadow-sm"
            >
              كل المدربين والخبراء
            </Link>
          </div>
        </div>

        {!useMarquee ? (
          <div className="flex flex-wrap justify-center gap-5">
            {trainers.map((t) => renderCard(t, false))}
          </div>
        ) : (
          <div
            className="bosla-marquee-shell relative overflow-hidden py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bosla-marquee-track flex w-max gap-5"
              data-paused={motionPaused ? 'true' : 'false'}
              style={{
                ['--marquee-duration' as any]: `${durationSec}s`,
                animationPlayState: motionPaused ? 'paused' : undefined,
              }}
            >
              {trainers.map((t) => renderCard(t, false))}
              {trainers.map((t) => renderCard(t, true))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Trainer Detail Modal */}
      <NativeModal
        open={Boolean(selectedTrainer)}
        onClose={() => {
          setSelectedTrainer(null);
          setTrainerDetail(null);
        }}
        title={detail?.fullName || 'ملف المدرب'}
      >
        {detail && (
          <div className="space-y-5 text-sm text-[var(--bosla-color-ink)]">
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <div className="w-28 aspect-[3/4] shrink-0 overflow-hidden rounded-xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)]">
                <img
                  src={detail.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={detail.fullName}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[var(--bosla-home-border)] bg-[var(--bosla-color-purple-soft)] px-3 py-0.5 text-xs font-extrabold text-[var(--bosla-color-purple-royal)]">
                    خبير معتمد
                  </span>
                  {detail.instructorProfile?.yearsExperience && (
                    <span className="inline-flex items-center rounded-full border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)] px-3 py-0.5 text-xs font-extrabold text-[var(--bosla-color-ink)]">
                      خبرة {formatNumber(detail.instructorProfile.yearsExperience)} سنة
                    </span>
                  )}
                </div>
                {detail.headlineAr && (
                  <p className="font-extrabold text-[var(--bosla-color-purple-royal)]">{detail.headlineAr}</p>
                )}
                <p className="text-xs leading-relaxed font-medium text-[var(--bosla-color-ink-muted)]">
                  {detail.bioAr ||
                    'مدرب وخبير متخصص يشارك خبرته العملية والميدانية عبر برامج وأنظمة أكاديمية بوصلة.'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-[var(--bosla-home-divider)] pt-4">
              <h4 className="text-xs font-extrabold text-[var(--bosla-color-ink)] flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[var(--bosla-color-purple-royal)]" aria-hidden="true" />
                الكورسات المنشورة للمدرب ({detail.instructedCourses?.length ?? 0})
              </h4>
              {detailLoading ? (
                <p className="text-xs text-[var(--bosla-color-ink-muted)]">جاري تحميل الكورسات...</p>
              ) : !(detail.instructedCourses?.length) ? (
                <p className="text-xs text-[var(--bosla-color-ink-muted)]">سيتم إدراج كورسات المدرب فور نشرها.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.instructedCourses.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.slug}`}
                      className="rounded-xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)]/60 p-3 hover:border-[var(--bosla-color-purple-royal)] hover:bg-[var(--bosla-color-white)] transition-colors flex items-center gap-2.5"
                    >
                      <Sparkles className="h-4 w-4 text-[var(--bosla-color-purple-royal)] shrink-0" aria-hidden="true" />
                      <span className="text-xs font-extrabold text-[var(--bosla-color-ink)] line-clamp-2">
                        {c.publishedVersion?.titleAr || c.slug}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </NativeModal>
    </section>
  );
}
