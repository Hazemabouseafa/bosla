'use client';

import React from 'react';

export function StatusCheckSvg({
  size = 44,
  tone = 'emerald',
  className = '',
}: {
  size?: number;
  tone?: 'emerald' | 'accent' | 'gold';
  className?: string;
}) {
  const stroke =
    tone === 'gold' ? '#F5B94A' : tone === 'accent' ? '#7C95FF' : '#77E2B5';

  return (
    <svg
      viewBox="0 0 52 52"
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
      role="img"
      aria-hidden="true"
    >
      <circle
        cx="26"
        cy="26"
        r="23"
        fill="none"
        stroke={stroke}
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <circle
        cx="26"
        cy="26"
        r="23"
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeDasharray="150"
        className="bosla-svg-draw-check-circle"
      />
      <path
        d="M16 26.5L23 33.5L36.5 19"
        fill="none"
        stroke={stroke}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="48"
        className="bosla-svg-draw-check-mark"
      />
    </svg>
  );
}
