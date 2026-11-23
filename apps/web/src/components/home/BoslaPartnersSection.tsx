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
 * Automatically returns null when zero published partner records exist so no placeholder
 * or unverified company is ever shown.
 */
export function BoslaPartnersSection({ partners }: { partners: HomepagePartner[] }) {
  if (!partners || partners.length === 0) {
    return null;
  }

  return (
    <section
      id="partners"
      className="relative border-t border-[#22307A]/80 bg-[#050A24]"
      style={{ padding: 'clamp(72px, 9vw, 112px) clamp(18px, 4vw, 36px)' }}
      aria-labelledby="partners-heading"
    >
      <div className="mx-auto max-w-[1240px] space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[58ch] space-y-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#C084FC]">
              <Handshake className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
              <span>شركاء النجاح والتطبيق الميداني</span>
            </span>
            <h2
              id="partners-heading"
              className="text-[clamp(1.75rem,3vw,2.65rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
            >
              شركاؤنا
            </h2>
            <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">
              مؤسسات وشركات قطاع الإنتاج الحيواني والداجني التي تتكامل مع بوصلة في التأهيل العملي
              وبناء الكفاءات الميدانية.
            </p>
          </div>

          <a
            href="#partner-apply"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-[#C084FC]/35 bg-[#6B21A8]/16 px-5 text-sm font-semibold text-[#E9D5FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/28"
          >
            انضم كشريك معنا
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
                className="bosla-partner-reveal flex flex-col justify-between gap-6 rounded-2xl border border-[#22307A] bg-[#070D2B] p-6 sm:p-7 transition-colors hover:border-[#C084FC]/45"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  {partner.logoUrl && (
                    <div className="flex h-24 w-40 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white p-3">
                      <img
                        src={partner.logoUrl}
                        alt={partner.nameAr}
                        width={160}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="space-y-2 min-w-0">
                    <h3 className="text-lg font-bold leading-[1.4] text-[#EEF0FF] bosla-display-font">
                      <bdi>{partner.nameAr}</bdi>
                    </h3>
                    {partner.descriptionAr && (
                      <p className="text-sm leading-[1.75] text-[#C2CAF2]">
                        {partner.descriptionAr}
                      </p>
                    )}
                  </div>
                </div>

                {hasHref && partner.websiteUrl && (
                  <div className="border-t border-[#22307A]/80 pt-4">
                    <a
                      href={partner.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#C084FC] transition-colors hover:text-[#E9D5FF]"
                    >
                      <span>زيارة الموقع الرسمي للشريك</span>
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
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
