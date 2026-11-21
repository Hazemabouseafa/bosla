'use client';

import React from 'react';
import { formatNumber } from '@/lib/api';

interface ProgressRingSvgProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'accent' | 'gold' | 'emerald';
  label?: string;
  className?: string;
}

const TONE_HEX: Record<'accent' | 'gold' | 'emerald', string> = {
  accent: '#7C95FF',
  gold: '#F5B94A',
  emerald: '#77E2B5',
};

export function ProgressRingSvg({
  percent,
  size = 96,
  strokeWidth = 7,
  tone = 'accent',
  label,
  className = '',
}: ProgressRingSvgProps) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const viewSize = 120;
  const radius = (viewSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePercent / 100) * circumference;
  const strokeColor = TONE_HEX[tone];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="h-full w-full -rotate-90"
        role="img"
        aria-label={label ? `${label}: ${formatNumber(safePercent)}%` : `${formatNumber(safePercent)}%`}
      >
        <circle
          cx={viewSize / 2}
          cy={viewSize / 2}
          r={radius}
          fill="none"
          stroke="#22307A"
          strokeOpacity="0.65"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={viewSize / 2}
          cy={viewSize / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 650ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-base font-semibold tabular-nums leading-none text-[#EEF0FF]">
          {formatNumber(safePercent)}%
        </span>
        {label && (
          <span className="mt-1 text-[10px] font-medium text-[#A9B1E0]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
