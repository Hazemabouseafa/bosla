'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, BookOpen, Pause, Play, Sparkles, Users } from 'lucide-react';
import { apiFetch, formatNumber } from '@/lib/api';
import { Badge, NativeModal } from '@/components/ui/primitives';

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
      <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#22307A] bg-[#0B1440]/92 transition-all hover:border-[#C084FC]/60 hover:shadow-[0_14px_34px_-16px_rgba(192,132,252,0.45)]">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#070D2B]">
          <img
            src={trainer.avatarUrl || '/images/brand/instructor-1.webp'}
            alt={isClone ? '' : trainer.fullName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050A24] via-[#050A24]/60 to-transparent"
          />
          {coursesCount > 0 && (
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-full border border-[#8CA2FF]/35 bg-[#050A24]/90 px-2.5 py-1 text-[11px] font-bold text-[#EEF0FF]">
              <BookOpen className="h-3 w-3 text-[#C084FC]" aria-hidden="true" />
              {formatNumber(coursesCount)} كورس
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-4 space-y-2 text-start">
          <div>
            <h3 className="text-base font-extrabold text-[#EEF0FF] group-hover:text-[#C084FC] transition-colors line-clamp-1">
              {trainer.fullName}
            </h3>
            <p className="mt-1 text-xs text-[#C2CAF2] line-clamp-2">
              {trainer.headlineAr || 'خبير ومدرب معتمد بأكاديمية بوصلة'}
            </p>
          </div>
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {specs.map((sp) => (
                <span
                  key={sp}
                  className="rounded-md border border-[#8CA2FF]/20 bg-[#070D2B] px-2 py-0.5 text-[10px] font-semibold text-[#8CA2FF]"
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
        className="w-[240px] sm:w-[260px] shrink-0 text-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CA2FF] rounded-2xl"
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
      className="relative overflow-hidden border-t border-[#22307A] bg-[#070D2B] py-16 sm:py-20 text-[#EEF0FF]"
      aria-labelledby="trainers-heading"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[58ch] space-y-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#C084FC]">
              <Users className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
              <span>هيئة التدريب والخبرة الميدانية</span>
            </span>
            <h2
              id="trainers-heading"
              className="text-[clamp(1.75rem,3vw,2.65rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
            >
              {titleAr}
            </h2>
            <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">{subtitleAr}</p>
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
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#8CA2FF]/30 bg-[#0B1440] px-3 text-xs font-bold text-[#EEF0FF] hover:border-[#C084FC] cursor-pointer"
              >
                {motionPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                <span>{motionPaused ? 'تشغيل العرض التلقائي' : 'إيقاف العرض التلقائي'}</span>
              </button>
            )}
            <Link
              href="/instructors"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#C084FC]/35 bg-[#6B21A8]/16 px-4 text-xs sm:text-sm font-semibold text-[#E9D5FF] hover:border-[#C084FC]"
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
            className="relative overflow-hidden py-2"
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
          <div className="space-y-5 text-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <div className="w-28 aspect-[3/4] shrink-0 overflow-hidden rounded-xl border border-[#8CA2FF]/30 bg-[#0B1440]">
                <img
                  src={detail.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={detail.fullName}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">خبير معتمد</Badge>
                  {detail.instructorProfile?.yearsExperience && (
                    <Badge tone="info">
                      خبرة {formatNumber(detail.instructorProfile.yearsExperience)} سنة
                    </Badge>
                  )}
                </div>
                {detail.headlineAr && (
                  <p className="font-bold text-[#8CA2FF]">{detail.headlineAr}</p>
                )}
                <p className="text-xs leading-relaxed text-[#C2CAF2]">
                  {detail.bioAr ||
                    'مدرب وخبير متخصص يشارك خبرته العملية والميدانية عبر برامج وأنظمة أكاديمية بوصلة.'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-[#22307A] pt-4">
              <h4 className="text-xs font-extrabold text-[#EEF0FF] flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[#F5B94A]" />
                الكورسات المنشورة للمدرب ({detail.instructedCourses?.length ?? 0})
              </h4>
              {detailLoading ? (
                <p className="text-xs text-[#A9B1E0]">جاري تحميل الكورسات...</p>
              ) : !(detail.instructedCourses?.length) ? (
                <p className="text-xs text-[#A9B1E0]">سيتم إدراج كورسات المدرب فور نشرها.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.instructedCourses.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.slug}`}
                      className="rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-3 hover:border-[#C084FC] transition-colors flex items-center gap-2.5"
                    >
                      <Sparkles className="h-4 w-4 text-[#C084FC] shrink-0" />
                      <span className="text-xs font-bold text-[#EEF0FF] line-clamp-2">
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
