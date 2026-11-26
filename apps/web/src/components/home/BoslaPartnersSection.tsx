'use client';

import React from 'react';
import { ExternalLink, Handshake } from 'lucide-react';

export interface HomepagePartner {
  id: string;
  nameAr: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  descriptionAr: string | null;
}

/**
 * Approved real partners showcase ("شركاؤنا").
 * Automatically returns null when zero published partner records exist.
 */
export function BoslaPartnersSection({
  partners,
  titleAr = 'شركاؤنا',
  subtitleAr = 'مؤسسات وشركات قطاع الإنتاج الحيواني والداجني التي تتكامل مع بوصلة في التأهيل العملي وبناء الكفاءات الميدانية.',
  ctaLabelAr = 'انضم كشريك نجاح',
  ctaHref = '#partner-apply',
}: {
  partners: HomepagePartner[];
  titleAr?: string;
  subtitleAr?: string;
  ctaLabelAr?: string;
  ctaHref?: string;
}) {
  if (!partners || partners.length === 0) {
    return null;
  }

  return (
    <section
      id="partners"
      className="relative border-t border-[#8CA2FF]/20 bg-[#0B1440] py-16 sm:py-20 text-[#EEF0FF]"
      aria-labelledby="partners-heading"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[58ch] space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#A5B4FC]">
              <Handshake className="h-4 w-4 text-[#8CA2FF]" strokeWidth={1.8} aria-hidden="true" />
              <span>شركاء النجاح والتطبيق الميداني</span>
            </div>
            <h2
              id="partners-heading"
              className="text-[clamp(1.8rem,3.1vw,2.6rem)] font-black leading-[1.28] text-[#EEF0FF] bosla-display-font"
            >
              {titleAr}
            </h2>
            <p className="text-sm sm:text-base leading-[1.75] font-medium text-[#B8C3F2]">
              {subtitleAr}
            </p>
          </div>

          <a
            href={ctaHref || '#partner-apply'}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-[#A78BFA]/45 bg-[#4A1FB0] px-5 text-sm font-extrabold text-white transition-colors hover:bg-[#5E2CD6]"
          >
            {ctaLabelAr || 'انضم كشريك نجاح'}
          </a>
        </div>

        <div
          className={`grid gap-6 ${
            partners.length === 1
              ? 'max-w-xl'
              : partners.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {partners.map((partner) => {
            const hasHref = Boolean(partner.websiteUrl && /^https?:\/\//i.test(partner.websiteUrl));
            return (
              <article
                key={partner.id}
                className="bosla-partner-reveal flex flex-col justify-between gap-5 rounded-3xl border border-[#8CA2FF]/26 bg-[#0F1A4A] p-6 transition-colors hover:border-[#8CA2FF] hover:bg-[#142260]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  {partner.logoUrl && (
                    <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-2xl border border-[#8CA2FF]/30 bg-white/95 p-2.5 shadow-sm">
                      <img
                        src={partner.logoUrl}
                        alt={partner.nameAr}
                        width={128}
                        height={80}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-lg font-extrabold leading-[1.4] text-[#EEF0FF] bosla-display-font">
                      <bdi>{partner.nameAr}</bdi>
                    </h3>
                    {partner.descriptionAr && (
                      <p className="text-sm leading-[1.7] font-medium text-[#B8C3F2]">
                        {partner.descriptionAr}
                      </p>
                    )}
                  </div>
                </div>

                {hasHref && partner.websiteUrl && (
                  <div className="border-t border-[#8CA2FF]/16 pt-4">
                    <a
                      href={partner.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[38px] items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#A5B4FC] transition-colors hover:text-white hover:underline"
                    >
                      <span>زيارة الموقع الرسمي للشريك</span>
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
