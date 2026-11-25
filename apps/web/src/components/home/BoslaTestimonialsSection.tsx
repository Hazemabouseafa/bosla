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
      className="relative border-t border-[#22307A] bg-[#050A24] py-16 sm:py-20 text-[#EEF0FF]"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 space-y-10">
        <div className="max-w-[58ch] space-y-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#F5B94A]">
            <MessageSquareQuote className="h-4 w-4 text-[#F5B94A]" aria-hidden="true" />
            <span>شهادات وتجارب موثّقة</span>
          </span>
          <h2
            id="testimonials-heading"
            className="text-[clamp(1.75rem,3vw,2.65rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
          >
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">{subtitleAr}</p>
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
          {testimonials.map((t) => {
            const name = t.studentNameAr || t.authorName || 'متدرب بالأكاديمية';
            const roleLine = [t.roleTitleAr || t.authorRoleAr, t.companyAr]
              .filter(Boolean)
              .join(' — ');
            const rating = Math.max(1, Math.min(5, Number(t.rating || 5)));

            return (
              <article
                key={t.id}
                className="flex flex-col justify-between gap-5 rounded-2xl border border-[#22307A] bg-[#0B1440]/92 p-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-[#F5B94A]" aria-label={`التقييم ${formatNumber(rating)} من 5`}>
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="text-sm sm:text-base leading-[1.8] text-[#EEF0FF]">
                    “{t.quoteAr}”
                  </blockquote>
                </div>

                <div className="flex items-center gap-3 border-t border-[#22307A] pt-4">
                  {t.avatarUrl && (
                    <img
                      src={t.avatarUrl}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover border border-[#8CA2FF]/35 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#EEF0FF] truncate">{name}</p>
                    {roleLine && (
                      <p className="text-xs text-[#A9B1E0] truncate">{roleLine}</p>
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
