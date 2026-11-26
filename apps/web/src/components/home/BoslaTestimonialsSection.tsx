'use client';

import React from 'react';
import { MessageSquareQuote, Star } from 'lucide-react';
import { formatNumber } from '@/lib/api';

export interface PublicTestimonialItem {
  id: string;
  studentNameAr?: string | null;
  authorName?: string | null;
  roleTitleAr?: string | null;
  authorRoleAr?: string | null;
  companyAr?: string | null;
  quoteAr: string;
  rating: number;
  avatarUrl?: string | null;
}

export function BoslaTestimonialsSection({
  testimonials,
  titleAr = 'آراء المتدربين وخريجي بوصلة',
  subtitleAr = 'تجارب حقيقية لخريجين وأطباء ومهندسين بعد التطبيق داخل المنشآت والمزارع',
  onSelectSectionInEditor,
}: {
  testimonials: PublicTestimonialItem[];
  titleAr?: string;
  subtitleAr?: string;
  onSelectSectionInEditor?: () => void;
}) {
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <section
      id="testimonials"
      onClick={() => onSelectSectionInEditor?.()}
      style={{
        backgroundColor: 'var(--bosla-color-blue-support)',
        backgroundImage: 'var(--bosla-band-testimonials)',
      }}
      className="relative py-16 sm:py-20 text-[var(--bosla-color-ink)]"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-10">
        <div className="max-w-[58ch] space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[var(--bosla-color-purple-royal)]">
            <MessageSquareQuote className="h-4 w-4 text-[var(--bosla-color-purple-support)]" aria-hidden="true" />
            <span>تجارب وشهادات موثّقة</span>
          </div>
          <h2
            id="testimonials-heading"
            className="text-[clamp(1.8rem,3.1vw,2.6rem)] font-black leading-[1.28] text-[var(--bosla-color-ink)] bosla-display-font"
          >
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-[1.75] font-medium text-[var(--bosla-color-ink-muted)]">
            {subtitleAr}
          </p>
        </div>

        <div
          className={`grid gap-6 ${
            testimonials.length === 1
              ? 'max-w-2xl'
              : testimonials.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {testimonials.map((t, idx) => {
            const name = t.studentNameAr || t.authorName || 'متدرب بالأكاديمية';
            const roleLine = [t.roleTitleAr || t.authorRoleAr, t.companyAr]
              .filter(Boolean)
              .join(' — ');
            const rating = Math.max(1, Math.min(5, Number(t.rating || 5)));
            const isPurpleHighlight = idx === 0;

            return (
              <article
                key={t.id}
                className={`flex flex-col justify-between gap-5 rounded-3xl border p-6 shadow-[0_14px_30px_-22px_rgba(23,36,61,0.18)] ${
                  isPurpleHighlight
                    ? 'border-[var(--bosla-color-purple-royal)] bg-[image:var(--bosla-gradient-purple)] text-[var(--bosla-color-white)]'
                    : 'border-[var(--bosla-home-border)] bg-[var(--bosla-color-white)] text-[var(--bosla-color-ink)]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex items-center gap-1 ${
                        isPurpleHighlight ? 'text-[#FDE68A]' : 'text-[var(--bosla-color-gold)]'
                      }`}
                      aria-label={`التقييم ${formatNumber(rating)} من 5`}
                    >
                      {Array.from({ length: rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                      ))}
                    </div>
                    <span
                      className={`text-xs font-extrabold ${
                        isPurpleHighlight ? 'text-[var(--bosla-color-blue-light)]' : 'text-[var(--bosla-color-purple-royal)]'
                      }`}
                      aria-hidden="true"
                    >
                      «»
                    </span>
                  </div>
                  <blockquote
                    className={`text-sm sm:text-base leading-[1.82] font-medium ${
                      isPurpleHighlight ? 'text-[var(--bosla-color-white)]' : 'text-[var(--bosla-color-ink)]'
                    }`}
                  >
                    “{t.quoteAr}”
                  </blockquote>
                </div>

                <div
                  className={`flex items-center gap-3 border-t pt-4 ${
                    isPurpleHighlight ? 'border-white/20' : 'border-[var(--bosla-home-divider)]'
                  }`}
                >
                  {t.avatarUrl && (
                    <img
                      src={t.avatarUrl}
                      alt={name}
                      className={`h-10 w-10 rounded-full object-cover border shrink-0 ${
                        isPurpleHighlight ? 'border-white/35' : 'border-[var(--bosla-home-border)]'
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-extrabold truncate ${
                        isPurpleHighlight ? 'text-[var(--bosla-color-white)]' : 'text-[var(--bosla-color-ink)]'
                      }`}
                    >
                      {name}
                    </p>
                    {roleLine && (
                      <p
                        className={`text-xs font-bold truncate ${
                          isPurpleHighlight ? 'text-[var(--bosla-color-blue-light)]' : 'text-[var(--bosla-color-purple-royal)]'
                        }`}
                      >
                        {roleLine}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
