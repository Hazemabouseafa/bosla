import React from 'react';

export function PageHero({
  badge,
  title,
  highlight,
  subtitle,
  align = 'start',
}: {
  badge: string;
  title: string;
  highlight?: string;
  subtitle: string;
  align?: 'start' | 'center';
}) {
  return (
    <section className="relative overflow-hidden border-b border-[#22307A] bg-[#0B1440] py-12 text-[#EEF0FF] sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-35"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_20%_25%,rgba(8,166,155,0.12),transparent_65%)]"
      />

      <div
        className={`relative mx-auto max-w-7xl px-4 sm:px-6 ${
          align === 'center' ? 'text-center' : ''
        }`}
      >
        <div className="mx-auto max-w-3xl space-y-3.5" style={align === 'start' ? { marginInlineStart: 0 } : undefined}>
          <span className="hero-seq-1 inline-flex items-center gap-2 rounded-full border border-[#8CA2FF]/35 bg-[#0F1A4A] px-4 py-1 text-xs sm:text-sm font-extrabold text-[#8CA2FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8CA2FF]" />
            {badge}
          </span>
          <h1 className="hero-seq-2 text-3xl font-extrabold leading-tight text-[#EEF0FF] sm:text-5xl">
            {title}{' '}
            {highlight && (
              <span className="text-[#8CA2FF] inline-block">{highlight}</span>
            )}
          </h1>
          <p className="hero-seq-3 text-base leading-[1.7] text-[#A9B1E0]">
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
