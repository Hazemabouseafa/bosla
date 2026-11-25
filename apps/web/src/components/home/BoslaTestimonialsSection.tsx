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
      className="relative border-t border-[#4A1FB0]/18 bg-[#ADD5F0] py-16 sm:py-20 text-[#17243D]"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-10">
        <div className="max-w-[58ch] space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#351078]">
            <MessageSquareQuote className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
            <span>تجارب وشهادات موثّقة</span>
          </div>
          <h2
            id="testimonials-heading"
            className="text-[clamp(1.8rem,3.1vw,2.6rem)] font-black leading-[1.28] text-[#17243D] bosla-display-font"
          >
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-[1.75] font-medium text-[#263959]">
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

            return (
              <article
                key={t.id}
                className={`flex flex-col justify-between gap-5 rounded-3xl border p-6 shadow-[0_14px_30px_-22px_rgba(21,35,68,0.2)] ${
                  idx === 0
                    ? 'border-[#4A1FB0] bg-[#C6E2F5]'
                    : 'border-[#4A1FB0]/24 bg-[#C6E2F5]/90'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-1 text-[#9A5B00]"
                      aria-label={`التقييم ${formatNumber(rating)} من 5`}
                    >
                      {Array.from({ length: rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                      ))}
                    </div>
                    <span className="text-xs font-extrabold text-[#4A1FB0]" aria-hidden="true">
                      «»
                    </span>
                  </div>
                  <blockquote className="text-sm sm:text-base leading-[1.82] font-medium text-[#17243D]">
                    “{t.quoteAr}”
                  </blockquote>
                </div>

                <div className="flex items-center gap-3 border-t border-[#17243D]/12 pt-4">
                  {t.avatarUrl && (
                    <img
                      src={t.avatarUrl}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover border border-[#4A1FB0]/25 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#17243D] truncate">{name}</p>
                    {roleLine && (
                      <p className="text-xs font-bold text-[#351078] truncate">{roleLine}</p>
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
