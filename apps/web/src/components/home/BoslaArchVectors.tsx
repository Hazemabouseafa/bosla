import React from 'react';

/**
 * Architectural Elevation Vectors derived from BOSLA's three-pillar ascending
 * spire silhouette, hairline-ruled for daylight & obsidian atlas grounds.
 */
export function BoslaAscentDiagram({ activeStep }: { activeStep: number }) {
  return (
    <svg
      viewBox="0 0 420 264"
      aria-hidden="true"
      className="h-auto w-full select-none"
      fill="none"
    >
      {/* Datum reference grid lines */}
      <line x1="16" y1="224" x2="404" y2="224" stroke="#070D2B" strokeOpacity="0.28" strokeWidth="1" />
      <line x1="16" y1="146" x2="404" y2="146" stroke="#070D2B" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="16" y1="68" x2="404" y2="68" stroke="#070D2B" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 4" />

      {/* Vertical survey axes matching active step */}
      <line
        x1="82"
        y1="32"
        x2="82"
        y2="224"
        stroke={activeStep === 0 ? '#8F5C06' : '#070D2B'}
        strokeOpacity={activeStep === 0 ? '0.45' : '0.12'}
        strokeWidth="1"
      />
      <line
        x1="210"
        y1="32"
        x2="210"
        y2="224"
        stroke={activeStep === 1 ? '#8F5C06' : '#070D2B'}
        strokeOpacity={activeStep === 1 ? '0.45' : '0.12'}
        strokeWidth="1"
      />
      <line
        x1="338"
        y1="20"
        x2="338"
        y2="224"
        stroke={activeStep === 2 ? '#8F5C06' : '#070D2B'}
        strokeOpacity={activeStep === 2 ? '0.45' : '0.12'}
        strokeWidth="1"
      />

      {/* Stage 1 Block: Academic Foundation */}
      <rect
        x="42"
        y="162"
        width="80"
        height="62"
        fill={activeStep === 0 ? '#070D2B' : '#E3E8F7'}
        stroke="#070D2B"
        strokeWidth="1.25"
        className="transition-colors duration-200"
      />
      <text
        x="82"
        y="198"
        textAnchor="middle"
        fill={activeStep === 0 ? '#EEF0FF' : '#070D2B'}
        fontFamily="var(--font-beiruti), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        الأساس
      </text>

      {/* Stage 2 Block: Operational Protocol */}
      <rect
        x="170"
        y="112"
        width="80"
        height="112"
        fill={activeStep === 1 ? '#070D2B' : '#E3E8F7'}
        stroke="#070D2B"
        strokeWidth="1.25"
        className="transition-colors duration-200"
      />
      <text
        x="210"
        y="174"
        textAnchor="middle"
        fill={activeStep === 1 ? '#EEF0FF' : '#070D2B'}
        fontFamily="var(--font-beiruti), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        الممارسة
      </text>

      {/* Stage 3 Spire: Institutional Leadership */}
      <path
        d="M298 224V66L338 24L378 66V224H298Z"
        fill={activeStep === 2 ? '#070D2B' : '#E3E8F7'}
        stroke="#070D2B"
        strokeWidth="1.25"
        className="transition-colors duration-200"
      />
      <text
        x="338"
        y="148"
        textAnchor="middle"
        fill={activeStep === 2 ? '#F5B94A' : '#070D2B'}
        fontFamily="var(--font-beiruti), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        القيادة
      </text>

      {/* Meridian slope trajectory */}
      <path
        d="M82 142L210 92L338 14"
        stroke="#4A67F0"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="82" cy="142" r="4.5" fill={activeStep === 0 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.25" />
      <circle cx="210" cy="92" r="4.5" fill={activeStep === 1 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.25" />
      <circle cx="338" cy="14" r="4.5" fill={activeStep === 2 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.25" />
    </svg>
  );
}

/**
 * Orthographic wireframe elevation fallback when Three.js WebGL is unavailable,
 * paused, or running on compact mobile/reduced-motion viewports.
 */
export function BoslaMonolithHairline({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 260"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="120" cy="134" r="96" stroke="#8CA2FF" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx="120" cy="134" r="72" stroke="#F5B94A" strokeOpacity="0.22" strokeWidth="1" />
      <line x1="18" y1="134" x2="222" y2="134" stroke="#8CA2FF" strokeOpacity="0.18" strokeWidth="1" />
      <line x1="120" y1="18" x2="120" y2="244" stroke="#8CA2FF" strokeOpacity="0.22" strokeWidth="1" />
      {/* Left ascending buttress */}
      <path
        d="M68 86L98 66V214L68 196V86Z"
        stroke="#8CA2FF"
        strokeOpacity="0.44"
        strokeWidth="1.25"
      />
      {/* Central BOSLA spire arrow */}
      <path
        d="M120 26L142 62H128V220L120 229L112 220V62H98L120 26Z"
        stroke="#EEF0FF"
        strokeOpacity="0.65"
        strokeWidth="1.35"
      />
      {/* Right geometric B structural facets */}
      <path
        d="M142 66L184 94V132L156 146L184 160V196L142 220"
        stroke="#F5B94A"
        strokeOpacity="0.6"
        strokeWidth="1.35"
      />
    </svg>
  );
}
