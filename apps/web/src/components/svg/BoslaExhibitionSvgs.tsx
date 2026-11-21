'use client';

import React, { useMemo } from 'react';

const HERO_TICKS = Array.from({ length: 72 }, (_, idx) => {
  const angle = idx * 5;
  const isCardinal = angle % 90 === 0;
  const isMajor = angle % 30 === 0;
  const isMedium = angle % 15 === 0;
  return { angle, isCardinal, isMajor, isMedium };
});

export function BoslaAstrolabeHeroSvg({
  needleRef,
  activeAngle = 24,
  onSelectAngle,
  className = '',
}: {
  needleRef?: React.RefObject<SVGGElement | null>;
  activeAngle?: number;
  onSelectAngle?: (deg: number) => void;
  className?: string;
}) {
  const uid = useMemo(() => 'bosla-astrolabe-hero', []);

  const cardinalPoints = [
    { deg: 0, label: '0° التأسيس', x: 290, y: 26, anchor: 'middle' as const },
    { deg: 90, label: '90° التشغيل', x: 552, y: 294, anchor: 'end' as const },
    { deg: 180, label: '180° التحصين', x: 290, y: 562, anchor: 'middle' as const },
    { deg: 270, label: '270° القيادة', x: 28, y: 294, anchor: 'start' as const },
  ];

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 580 580"
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        className="h-full w-full overflow-visible"
      >
        <title id={`${uid}-t`}>مرصد بوصلة المعماري التفاعلي</title>
        <desc id={`${uid}-d`}>
          بوصلة ملاحية تفاعلية تعبر عن الانتقال المنهجي في أكاديمية بوصلة من التأسيس إلى القيادة.
        </desc>

        <defs>
          <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#18266E" stopOpacity="0.48" />
            <stop offset="55%" stopColor="#0B1440" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#050A24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8CA2FF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#7C95FF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F5B94A" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`${uid}-n`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#EEF0FF" />
            <stop offset="100%" stopColor="#7C95FF" />
          </linearGradient>
          <linearGradient id={`${uid}-s`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#F5B94A" />
            <stop offset="100%" stopColor="#B88221" />
          </linearGradient>
        </defs>

        {/* Deep optical depth bed */}
        <circle cx="290" cy="290" r="278" fill={`url(#${uid}-halo)`} />

        {/* Crosshair sighting lines */}
        <line x1="290" y1="42" x2="290" y2="538" stroke="#7C95FF" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 6" />
        <line x1="42" y1="290" x2="538" y2="290" stroke="#7C95FF" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 6" />

        {/* Outer calibration track */}
        <circle cx="290" cy="290" r="246" fill="none" stroke="#22307A" strokeWidth="1" strokeOpacity="0.9" />
        <circle
          cx="290"
          cy="290"
          r="236"
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="1.5"
          pathLength={1}
          strokeDasharray="1"
          className="bosla-svg-draw-ring"
        />

        {/* Rotating broken orbital telemetry ring */}
        <g className="bosla-svg-orbit" style={{ transformOrigin: '290px 290px' }}>
          <circle
            cx="290"
            cy="290"
            r="210"
            fill="none"
            stroke="#8CA2FF"
            strokeOpacity="0.32"
            strokeWidth="1.2"
            strokeDasharray="24 14 4 14"
          />
          <circle cx="290" cy="80" r="3.5" fill="#8CA2FF" />
          <circle cx="500" cy="290" r="3" fill="#F5B94A" />
          <circle cx="290" cy="500" r="3" fill="#77E2B5" />
        </g>

        {/* Precision 5-degree radial tick ring */}
        <g>
          {HERO_TICKS.map((t) => {
            const innerR = t.isCardinal ? 218 : t.isMajor ? 225 : t.isMedium ? 230 : 233;
            const outerR = 242;
            const rad = ((t.angle - 90) * Math.PI) / 180;
            const x1 = 290 + innerR * Math.cos(rad);
            const y1 = 290 + innerR * Math.sin(rad);
            const x2 = 290 + outerR * Math.cos(rad);
            const y2 = 290 + outerR * Math.sin(rad);
            return (
              <line
                key={t.angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={t.isCardinal ? '#F5B94A' : t.isMajor ? '#EEF0FF' : '#7C95FF'}
                strokeOpacity={t.isCardinal ? 0.95 : t.isMajor ? 0.72 : 0.3}
                strokeWidth={t.isCardinal ? 2 : t.isMajor ? 1.5 : 0.9}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Inner azimuth sanctuary circle */}
        <circle cx="290" cy="290" r="154" fill="#070D2B" fillOpacity="0.78" stroke="#22307A" strokeWidth="1.25" />
        <circle cx="290" cy="290" r="120" fill="none" stroke="#8CA2FF" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 6" />

        {/* Magnetic Rotating Compass Needle — controlled cleanly via ref transform */}
        <g
          ref={needleRef}
          style={{
            transform: `rotate(${activeAngle}deg)`,
            transformOrigin: '290px 290px',
            willChange: 'transform',
            transition: 'transform 260ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          <polygon points="290,94 310,290 290,268 270,290" fill={`url(#${uid}-n)`} />
          <line x1="290" y1="104" x2="290" y2="268" stroke="#070D2B" strokeOpacity="0.45" strokeWidth="1.2" />
          <polygon points="290,486 310,290 290,312 270,290" fill={`url(#${uid}-s)`} />
        </g>

        {/* Central brass-and-indigo sight cradle around real BOSLA logo */}
        <circle cx="290" cy="290" r="46" fill="#050A24" stroke="#8CA2FF" strokeOpacity="0.7" strokeWidth="1.5" />
        <circle cx="290" cy="290" r="38" fill="#0B1440" stroke="#F5B94A" strokeOpacity="0.5" strokeWidth="1" />

        {/* Interactive Cardinal Labels */}
        {cardinalPoints.map((pt) => {
          const isNear = Math.abs((((activeAngle - pt.deg) % 360) + 540) % 360 - 180) < 40;
          return (
            <text
              key={pt.deg}
              x={pt.x}
              y={pt.y}
              textAnchor={pt.anchor}
              onClick={onSelectAngle ? () => onSelectAngle(pt.deg) : undefined}
              fill={isNear ? '#F5B94A' : '#A9B1E0'}
              fontSize="13"
              fontWeight="600"
              fontFamily="var(--font-ibm-arabic), sans-serif"
              className={onSelectAngle ? 'cursor-pointer hover:fill-[#EEF0FF] transition-colors' : ''}
            >
              {pt.label}
            </text>
          );
        })}
      </svg>

      {/* Authentic BOSLA Brand Logo locked symmetrically at instrument axis */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#070D2B]/90 p-2.5 shadow-[inset_0_1px_0_rgba(238,240,255,0.2)]">
          <img
            src="/images/brand/bosla-logo.webp"
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Peak Scroll-Scrubbed Technical Schematic SVG:
 * Strokes literally assemble themselves line-by-line from --sc-p via direct DOM refs.
 */
export function BoslaSchematicSvg({
  layer1Ref,
  layer2Ref,
  layer3Ref,
  needleRef,
  staticComplete = false,
  activeChapter = 0,
  onSelectChapter,
  className = '',
}: {
  layer1Ref?: React.RefObject<SVGGElement | null>;
  layer2Ref?: React.RefObject<SVGGElement | null>;
  layer3Ref?: React.RefObject<SVGGElement | null>;
  needleRef?: React.RefObject<SVGGElement | null>;
  staticComplete?: boolean;
  activeChapter?: number;
  onSelectChapter?: (idx: number) => void;
  className?: string;
}) {
  const uid = 'bosla-schematic-peak';
  const defaultOffset = staticComplete ? 0 : 1;

  const nodes = [
    { deg: 18, label: '01', cx: 280 + 186 * Math.cos(((18 - 90) * Math.PI) / 180), cy: 280 + 186 * Math.sin(((18 - 90) * Math.PI) / 180), tone: '#8CA2FF' },
    { deg: 138, label: '02', cx: 280 + 186 * Math.cos(((138 - 90) * Math.PI) / 180), cy: 280 + 186 * Math.sin(((138 - 90) * Math.PI) / 180), tone: '#F5B94A' },
    { deg: 258, label: '03', cx: 280 + 186 * Math.cos(((258 - 90) * Math.PI) / 180), cy: 280 + 186 * Math.sin(((258 - 90) * Math.PI) / 180), tone: '#77E2B5' },
  ];

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox="0 0 560 560"
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        className="h-full w-full overflow-visible"
      >
        <title id={`${uid}-t`}>مخطط هندسة التأهيل الميداني</title>
        <desc id={`${uid}-d`}>
          رسم هندسي تفاعلي يُرسم تدريجياً مع التمرير لإظهار مراحل الانتقال من الدراسة إلى القيادة.
        </desc>

        {/* Faint permanent drafting underlay so stage is grounded at p = 0 */}
        <g opacity="0.16" stroke="#7C95FF" fill="none">
          <circle cx="280" cy="280" r="236" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="280" cy="280" r="186" strokeWidth="1" />
          <circle cx="280" cy="280" r="118" strokeWidth="1" strokeDasharray="2 5" />
          <line x1="44" y1="280" x2="516" y2="280" strokeWidth="1" />
          <line x1="280" y1="44" x2="280" y2="516" strokeWidth="1" />
        </g>

        {/* LAYER 1: Diagnostic Grid & Primary Perimeter Ring (Draws 0.0 -> 0.36) */}
        <g
          ref={layer1Ref}
          fill="none"
          stroke="#8CA2FF"
          strokeLinecap="round"
          style={{ strokeDasharray: 1, strokeDashoffset: defaultOffset }}
        >
          <circle cx="280" cy="280" r="236" strokeWidth="1.75" pathLength={1} />
          <path d="M90 280 L280 90 L470 280 L280 470 Z" strokeWidth="1.25" strokeOpacity="0.65" pathLength={1} />
          <path d="M140 180 H420 M140 380 H420" strokeWidth="1" strokeOpacity="0.4" pathLength={1} />
        </g>

        {/* LAYER 2: Operational Decision Polygon & Biosecurity Curves (Draws 0.32 -> 0.70) */}
        <g
          ref={layer2Ref}
          fill="none"
          stroke="#F5B94A"
          strokeLinecap="round"
          style={{ strokeDasharray: 1, strokeDashoffset: defaultOffset }}
        >
          <circle cx="280" cy="280" r="186" strokeWidth="2" pathLength={1} />
          <path
            d="M118 330 C 175 180, 240 350, 295 210 S 395 160, 442 250"
            strokeWidth="2.2"
            pathLength={1}
          />
          <polygon
            points="280,104 432,368 128,368"
            strokeWidth="1.35"
            strokeOpacity="0.7"
            pathLength={1}
          />
        </g>

        {/* LAYER 3: Executive Command Crown & Accreditation Ring (Draws 0.64 -> 0.96) */}
        <g
          ref={layer3Ref}
          fill="none"
          stroke="#77E2B5"
          strokeLinecap="round"
          style={{ strokeDasharray: 1, strokeDashoffset: defaultOffset }}
        >
          <circle cx="280" cy="280" r="118" strokeWidth="2" pathLength={1} />
          <path d="M210 280 L260 326 L354 226" strokeWidth="3" pathLength={1} strokeOpacity="0.88" />
        </g>

        {/* Interactive Chapter Bearing Nodes */}
        {nodes.map((node, idx) => {
          const isCurrent = activeChapter === idx;
          return (
            <g
              key={node.label}
              onClick={onSelectChapter ? () => onSelectChapter(idx) : undefined}
              className={onSelectChapter ? 'cursor-pointer' : ''}
            >
              <circle
                cx={node.cx}
                cy={node.cy}
                r={isCurrent ? 20 : 15}
                fill="#070D2B"
                stroke={isCurrent ? node.tone : '#22307A'}
                strokeWidth={isCurrent ? 2 : 1.25}
              />
              <text
                x={node.cx}
                y={node.cy + 4}
                textAnchor="middle"
                fill={isCurrent ? node.tone : '#A9B1E0'}
                fontSize="11"
                fontWeight="700"
                fontFamily="monospace"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Scrubbed Precision Needle */}
        <g
          ref={needleRef}
          style={{
            transform: `rotate(${staticComplete ? 258 : 18}deg)`,
            transformOrigin: '280px 280px',
            willChange: 'transform',
          }}
        >
          <line x1="280" y1="74" x2="280" y2="280" stroke="#EEF0FF" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="280,62 287,82 273,82" fill="#F5B94A" />
          <line x1="280" y1="280" x2="280" y2="412" stroke="#7C95FF" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />
        </g>

        {/* Center Jewel */}
        <circle cx="280" cy="280" r="22" fill="#050A24" stroke="#8CA2FF" strokeWidth="2" />
        <circle cx="280" cy="280" r="6" fill="#EEF0FF" />
      </svg>
    </div>
  );
}

/**
 * Horizontal Telemetry Bearing Path Trace for Floating Bottom Horizon HUD
 */
export function BoslaMeridianTraceSvg({
  tracePathRef,
  className = '',
}: {
  tracePathRef?: React.RefObject<SVGPathElement | null>;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 24"
      className={`h-6 w-full overflow-visible ${className}`}
      aria-hidden="true"
    >
      <path
        d="M 4 12 L 72 12 L 90 5 L 116 19 L 136 12 L 220 12 L 236 6 L 252 17 L 268 12 L 356 12"
        fill="none"
        stroke="#22307A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        ref={tracePathRef}
        d="M 4 12 L 72 12 L 90 5 L 116 19 L 136 12 L 220 12 L 236 6 L 252 17 L 268 12 L 356 12"
        fill="none"
        stroke="#8CA2FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
      />
    </svg>
  );
}

/**
 * Closing Gate Architectural Seal Framing Genuine BOSLA Emblem
 */
export function BoslaPortalSealSvg({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none ${className}`}>
      <svg viewBox="0 0 260 260" className="h-full w-full" aria-hidden="true">
        <circle cx="130" cy="130" r="118" fill="none" stroke="#8CA2FF" strokeOpacity="0.22" strokeWidth="1" />
        <g className="bosla-svg-orbit" style={{ transformOrigin: '130px 130px' }}>
          <circle
            cx="130"
            cy="130"
            r="102"
            fill="none"
            stroke="#8CA2FF"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            strokeDasharray="16 10 3 10"
          />
          <circle cx="130" cy="28" r="3" fill="#F5B94A" />
        </g>
        <circle cx="130" cy="130" r="68" fill="#0B1440" stroke="#22307A" strokeWidth="1.5" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img
          src="/images/brand/bosla-logo.webp"
          alt="شعار أكاديمية بوصلة"
          width={52}
          height={52}
          className="h-12 w-12 object-contain"
        />
      </div>
    </div>
  );
}

export function BearingReadoutLabel({ deg }: { deg: number }) {
  return (
    <span className="font-mono text-xs font-semibold tabular-nums text-[#8CA2FF]" dir="ltr">
      {String(Math.round(((deg % 360) + 360) % 360)).padStart(3, '0')}°
    </span>
  );
}
