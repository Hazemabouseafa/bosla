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
    <section className="relative overflow-hidden border-b border-[#C084FC]/20 bg-[#070D2B] py-12 text-[#EEF0FF] sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[#6B21A8]"
      />
      <div
        className={`relative mx-auto max-w-7xl px-4 sm:px-6 ${
          align === 'center' ? 'text-center' : ''
        }`}
      >
        <div
          className="mx-auto max-w-3xl space-y-3"
          style={align === 'start' ? { marginInlineStart: 0 } : undefined}
        >
          <p className="hero-seq-1 text-xs sm:text-sm font-semibold text-[#C084FC]">
            {badge}
          </p>
          <h1 className="hero-seq-2 text-3xl font-bold leading-[1.42] text-[#EEF0FF] sm:text-4xl lg:text-5xl bosla-display-font">
            {title}{' '}
            {highlight && (
              <span className="text-[#C084FC]">{highlight}</span>
            )}
          </h1>
          <p className="hero-seq-3 text-base leading-[1.75] text-[#C2CAF2]">
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
