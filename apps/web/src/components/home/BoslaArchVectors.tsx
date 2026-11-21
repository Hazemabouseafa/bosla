import React from 'react';

/**
 * Geometric Architectural Elevation Vectors derived strictly from BOSLA's
 * upward prism crest (no compass needles, radar rings, or rotating globes).
 */
export function BoslaAscentDiagram({ activeStep }: { activeStep: number }) {
  return (
    <svg
      viewBox="0 0 420 290"
      aria-hidden="true"
      className="h-auto w-full select-none"
      fill="none"
    >
      {/* Subtle architectural datum lines */}
      <line x1="24" y1="248" x2="396" y2="248" stroke="#22307A" strokeOpacity="0.24" strokeWidth="1" />
      <line x1="24" y1="168" x2="396" y2="168" stroke="#22307A" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="24" y1="88" x2="396" y2="88" stroke="#22307A" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="4 4" />

      {/* Stage 1 Column: Grounded Knowledge */}
      <rect
        x="48"
        y="176"
        width="76"
        height="72"
        rx="2"
        fill={activeStep === 0 ? '#070D2B' : '#E7ECF8'}
        stroke="#070D2B"
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <text
        x="86"
        y="218"
        textAnchor="middle"
        fill={activeStep === 0 ? '#EEF0FF' : '#070D2B'}
        fontFamily="var(--font-mada), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        ٠١ الأساس
      </text>

      {/* Stage 2 Column: Operational Discipline */}
      <rect
        x="172"
        y="120"
        width="76"
        height="128"
        rx="2"
        fill={activeStep === 1 ? '#070D2B' : '#E7ECF8'}
        stroke="#070D2B"
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <text
        x="210"
        y="188"
        textAnchor="middle"
        fill={activeStep === 1 ? '#EEF0FF' : '#070D2B'}
        fontFamily="var(--font-mada), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        ٠٢ التطبيق
      </text>

      {/* Stage 3 Spire: Practical Impact & Decision */}
      <path
        d="M296 248V74L334 32L372 74V248H296Z"
        fill={activeStep === 2 ? '#070D2B' : '#E7ECF8'}
        stroke="#070D2B"
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <text
        x="334"
        y="156"
        textAnchor="middle"
        fill={activeStep === 2 ? '#F5B94A' : '#070D2B'}
        fontFamily="var(--font-mada), sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        ٠٣ الأثر
      </text>

      {/* Precision vector progression rail connecting stages */}
      <path
        d="M86 154L210 100L334 18"
        stroke="#4A67F0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="86" cy="154" r="5" fill={activeStep === 0 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.5" />
      <circle cx="210" cy="100" r="5" fill={activeStep === 1 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.5" />
      <circle cx="334" cy="18" r="5" fill={activeStep === 2 ? '#F5B94A' : '#4A67F0'} stroke="#070D2B" strokeWidth="1.5" />
    </svg>
  );
}

export function BoslaMonolithHairline({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 220"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M90 12L108 42H97V198L90 206L83 198V42H72L90 12Z"
        stroke="currentColor"
        strokeOpacity="0.34"
        strokeWidth="1.25"
      />
      <path
        d="M52 70L76 54V192L52 178V70Z"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.25"
      />
      <path
        d="M104 54L142 78V116L118 130L142 144V176L104 198"
        stroke="currentColor"
        strokeOpacity="0.26"
        strokeWidth="1.25"
      />
    </svg>
  );
}
