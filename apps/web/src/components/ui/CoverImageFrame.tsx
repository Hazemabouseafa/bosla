'use client';

import React from 'react';

export function CoverImageFrame({
  src,
  alt,
  focalX = 50,
  focalY = 50,
  fitMode = 'COVER',
  aspectClassName = 'aspect-[16/9]',
  className = '',
  children,
}: {
  src?: string | null;
  alt: string;
  focalX?: number | null;
  focalY?: number | null;
  fitMode?: 'COVER' | 'CONTAIN' | string | null;
  aspectClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const safeX = Number.isFinite(Number(focalX)) ? Math.max(0, Math.min(100, Number(focalX))) : 50;
  const safeY = Number.isFinite(Number(focalY)) ? Math.max(0, Math.min(100, Number(focalY))) : 50;
  const isContain = String(fitMode || 'COVER').toUpperCase() === 'CONTAIN';

  return (
    <div
      className={`bosla-image-frame relative w-full overflow-hidden bg-[#0B1440] ${aspectClassName} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{
            objectPosition: `${safeX}% ${safeY}%`,
          }}
          className={`bosla-card-media h-full w-full ${
            isContain ? 'object-contain p-1.5' : 'object-cover'
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0F1A4A] to-[#080F33] text-xs font-bold text-[#8CA2FF]/70">
          {alt}
        </div>
      )}
      {children}
    </div>
  );
}
