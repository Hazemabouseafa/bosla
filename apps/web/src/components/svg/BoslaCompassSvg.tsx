'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/api';

interface BoslaCompassSvgProps {
  /** Rotation angle in degrees (can be static, stateful, or driven by scroll progress) */
  bearingDeg?: number;
  /** Optional size utility class */
  className?: string;
  /** Compact variant for auth portals or badges */
  variant?: 'hero' | 'lens' | 'seal';
  /** Active doctrinal stage index (0, 1, 2) for storytelling dial highlight */
  activeStage?: number;
  /** Optional interactive click handler to step bearings */
  onSelectBearing?: (stageIndex: number) => void;
}

const CARDINAL_TICKS = Array.from({ length: 24 }, (_, idx) => {
  const angle = idx * 15;
  const isMajor = idx % 6 === 0;
  const isMedium = idx % 2 === 0;
  return { angle, isMajor, isMedium };
});

export function BoslaCompassSvg({
  bearingDeg = 28,
  className = '',
  variant = 'hero',
  activeStage = 0,
  onSelectBearing,
}: BoslaCompassSvgProps) {
  const gradId = useMemo(
    () => `bosla-compass-${variant}`,
    [variant],
  );

  const stageLabel =
    activeStage === 0
      ? 'الأساس التطبيقي'
      : activeStage === 1
        ? 'الانضباط الميداني'
        : 'القيادة التنفيذية';

  return (
    <div
      className={`relative select-none ${className}`}
      data-sc-compass=""
    >
      <svg
        viewBox="0 0 420 420"
        role="img"
        aria-labelledby={`${gradId}-title ${gradId}-desc`}
        className="h-full w-full overflow-visible"
      >
        <title id={`${gradId}-title`}>بوصلة أكاديمية بوصلة المعمارية</title>
        <desc id={`${gradId}-desc`}>
          أداة توجيه تفاعلية تمثل مسار المتدرب من مقعد الدراسة إلى القيادة الميدانية والتنفيذية.
        </desc>

        <defs>
          <radialGradient id={`${gradId}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#18266E" stopOpacity="0.65" />
            <stop offset="68%" stopColor="#0B1440" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#070D2B" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`${gradId}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8CA2FF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#7C95FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F5B94A" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id={`${gradId}-needle-n`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#A6B7FF" />
            <stop offset="100%" stopColor="#6B86FA" />
          </linearGradient>

          <linearGradient id={`${gradId}-needle-s`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#F5B94A" />
            <stop offset="100%" stopColor="#C88D22" />
          </linearGradient>
        </defs>

        {/* Soft calibrated depth disk */}
        <circle cx="210" cy="210" r="196" fill={`url(#${gradId}-core)`} />

        {/* Outer draw-on azimuth ring */}
        <circle
          cx="210"
          cy="210"
          r="192"
          fill="none"
          stroke="#22307A"
          strokeWidth="1"
          strokeOpacity="0.85"
        />
        <circle
          cx="210"
          cy="210"
          r="182"
          fill="none"
          stroke={`url(#${gradId}-ring)`}
          strokeWidth="1.5"
          strokeDasharray="1144"
          className="bosla-svg-draw-ring"
        />

        {/* Slow subtle orbital ring (paused automatically on reduced motion) */}
        <g
          className="bosla-svg-orbit"
          style={{ transformOrigin: '210px 210px' }}
        >
          <circle
            cx="210"
            cy="210"
            r="160"
            fill="none"
            stroke="#7C95FF"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="12 8 3 8"
          />
          <circle cx="210" cy="50" r="3.5" fill="#8CA2FF" />
          <circle cx="210" cy="370" r="3" fill="#F5B94A" fillOpacity="0.85" />
        </g>

        {/* Precision graduated compass rose ticks */}
        <g>
          {CARDINAL_TICKS.map((t) => {
            const innerR = t.isMajor ? 168 : t.isMedium ? 174 : 178;
            const outerR = 186;
            const rad = ((t.angle - 90) * Math.PI) / 180;
            const x1 = 210 + innerR * Math.cos(rad);
            const y1 = 210 + innerR * Math.sin(rad);
            const x2 = 210 + outerR * Math.cos(rad);
            const y2 = 210 + outerR * Math.sin(rad);
            return (
              <line
                key={t.angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={t.isMajor ? '#EEF0FF' : '#7C95FF'}
                strokeOpacity={t.isMajor ? 0.85 : t.isMedium ? 0.5 : 0.25}
                strokeWidth={t.isMajor ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Inner azimuth geometry tracks */}
        <circle
          cx="210"
          cy="210"
          r="116"
          fill="#0B1440"
          fillOpacity="0.72"
          stroke="#22307A"
          strokeWidth="1.25"
        />
        <circle
          cx="210"
          cy="210"
          r="96"
          fill="none"
          stroke="#8CA2FF"
          strokeOpacity="0.18"
          strokeWidth="1"
        />

        {/* 3 Stage Azimuth Waypoint Nodes (0, 120, 240 deg) */}
        {[0, 120, 240].map((deg, idx) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const cx = 210 + 138 * Math.cos(rad);
          const cy = 210 + 138 * Math.sin(rad);
          const isCurrent = activeStage === idx;
          return (
            <g
              key={deg}
              onClick={onSelectBearing ? () => onSelectBearing(idx) : undefined}
              className={onSelectBearing ? 'cursor-pointer' : undefined}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isCurrent ? 9 : 6}
                fill={isCurrent ? '#7C95FF' : '#0F1A4A'}
                stroke={isCurrent ? '#EEF0FF' : '#7C95FF'}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              />
              {isCurrent && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill="none"
                  stroke="#8CA2FF"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                />
              )}
            </g>
          );
        })}

        {/* Magnetic Rotating Compass Needle — driven cleanly via GPU transform */}
        <g
          className="bosla-svg-needle"
          style={{
            transform: `rotate(${bearingDeg}deg)`,
            transformOrigin: '210px 210px',
            willChange: 'transform',
          }}
        >
          {/* North pointer (Royal Periwinkle) */}
          <polygon
            points="210,74 226,210 210,196 194,210"
            fill={`url(#${gradId}-needle-n)`}
          />
          {/* Subtle inner ridge highlight on needle */}
          <line
            x1="210"
            y1="82"
            x2="210"
            y2="196"
            stroke="#EEF0FF"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          {/* South counterweight (Editorial Gold) */}
          <polygon
            points="210,346 226,210 210,224 194,210"
            fill={`url(#${gradId}-needle-s)`}
          />
          {/* Jewel center pivot */}
          <circle cx="210" cy="210" r="18" fill="#070D2B" stroke="#8CA2FF" strokeWidth="2" />
          <circle cx="210" cy="210" r="7" fill="#EEF0FF" />
        </g>

        {/* Clean cardinal markers (N / E / S / W telemetry) */}
        <text
          x="210"
          y="24"
          textAnchor="middle"
          fill="#8CA2FF"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--font-ibm-arabic), monospace"
        >
          {formatNumber(0)}°
        </text>
        <text
          x="396"
          y="214"
          textAnchor="middle"
          fill="#A9B1E0"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-ibm-arabic), monospace"
        >
          {formatNumber(90)}°
        </text>
        <text
          x="210"
          y="404"
          textAnchor="middle"
          fill="#A9B1E0"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-ibm-arabic), monospace"
        >
          {formatNumber(180)}°
        </text>
        <text
          x="24"
          y="214"
          textAnchor="middle"
          fill="#A9B1E0"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-ibm-arabic), monospace"
        >
          {formatNumber(270)}°
        </text>
      </svg>

      {variant === 'lens' && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-[#A9B1E0]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7C95FF]" />
          <span>زاوية التوجيه الحالية:</span>
          <span className="font-semibold text-[#EEF0FF] tabular-nums">
            {formatNumber(Math.round(((bearingDeg % 360) + 360) % 360))}° — {stageLabel}
          </span>
        </div>
      )}
    </div>
  );
}
