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
        className={`relative mx-auto max-w-7xl px-4 sm:px-6 ${
          align === 'center' ? 'text-center' : ''
        }`}
      >
        <div className="mx-auto max-w-3xl space-y-3" style={align === 'start' ? { marginInlineStart: 0 } : undefined}>
          <p className="hero-seq-1 text-xs sm:text-sm font-medium text-[#8CA2FF]">
            {badge}
          </p>
          <h1 className="hero-seq-2 text-3xl font-semibold leading-[1.3] text-[#EEF0FF] sm:text-4xl lg:text-5xl">
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
