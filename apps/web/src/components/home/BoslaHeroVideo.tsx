'use client';

import React, { useEffect, useRef, useState } from 'react';
export interface BoslaHeroVideoProps {
  motionPaused: boolean;
}

/**
 * Original cinema-rendered BOSLA Precision Studio & Meridian hero video player.
 * - Immediately paints the matched high-priority WebP poster to keep LCP fast and prevent layout shift.
 * - Progressively selects desktop (1920x1080) or portrait mobile (720x960) H.264 MP4 fast-start asset.
 * - Handles autoplay rejection cleanly by keeping the crisp poster visible.
 * - Pauses automatically offscreen (IntersectionObserver), when the tab is hidden, or under Save-Data / Reduced-Motion.
 */
export function BoslaHeroVideo({ motionPaused }: BoslaHeroVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);

  const shouldSuppressPlayback = motionPaused || osReducedMotion || saveData;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileMq = window.matchMedia('(max-width: 767px)');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const navConn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

    setIsMobileViewport(mobileMq.matches);
    setOsReducedMotion(reduceMq.matches);
    setSaveData(Boolean(navConn?.saveData));

    const onMobileChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    const onReduceChange = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);

    mobileMq.addEventListener?.('change', onMobileChange);
    reduceMq.addEventListener?.('change', onReduceChange);
    return () => {
      mobileMq.removeEventListener?.('change', onMobileChange);
      reduceMq.removeEventListener?.('change', onReduceChange);
    };
  }, []);

  const videoSrc = isMobileViewport
    ? '/videos/bosla-hero-mobile.mp4'
    : '/videos/bosla-hero-desktop.mp4';

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || typeof window === 'undefined') return;

    video.muted = true;
    video.playsInline = true;

    if (shouldSuppressPlayback) {
      video.pause();
      return;
    }

    let disposed = false;
    let inViewport = true;

    const tryPlay = () => {
      if (disposed || shouldSuppressPlayback || document.hidden || !inViewport) return;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise
          .then(() => {
            if (!disposed) setAutoplayFailed(false);
          })
          .catch(() => {
            if (!disposed) setAutoplayFailed(true);
          });
      }
    };

    const onLoadedData = () => {
      if (!disposed) {
        setVideoReady(true);
        tryPlay();
      }
    };

    video.addEventListener('loadeddata', onLoadedData);
    if (video.readyState >= 2) {
      setVideoReady(true);
      tryPlay();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || disposed) return;
        inViewport = entry.isIntersecting;
        if (inViewport) {
          tryPlay();
        } else {
          video.pause();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(container);

    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        tryPlay();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      video.removeEventListener('loadeddata', onLoadedData);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [shouldSuppressPlayback, videoSrc]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050A24] select-none"
    >
      {/* Immediate Responsive Poster (Zero white flash, optimal LCP) */}
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="/images/homepage/bosla-hero-poster-mobile.webp"
        />
        <img
          src="/images/homepage/bosla-hero-poster-desktop.webp"
          alt="استوديو بوصلة للتشخيص المخبري والدقة الميدانية"
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center md:object-[32%_center]"
        />
      </picture>

      {/* Seamless Looping Video Overlay */}
      {!saveData && (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          poster={
            isMobileViewport
              ? '/images/homepage/bosla-hero-poster-mobile.webp'
              : '/images/homepage/bosla-hero-poster-desktop.webp'
          }
          autoPlay={!shouldSuppressPlayback}
          muted
          loop
          playsInline
          preload={shouldSuppressPlayback ? 'none' : 'auto'}
          aria-hidden="true"
          width={isMobileViewport ? 720 : 1920}
          height={isMobileViewport ? 960 : 1080}
          className={`absolute inset-0 h-full w-full object-cover object-center md:object-[32%_center] transition-opacity duration-500 ${
            videoReady && !shouldSuppressPlayback && !autoplayFailed ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Protective Text-Side Directional Scrim (Guarantees WCAG AAA Contrast on Arabic Headline) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: isMobileViewport
            ? 'linear-gradient(180deg, rgba(5, 10, 36, 0.92) 0%, rgba(5, 10, 36, 0.72) 44%, rgba(5, 10, 36, 0.25) 76%, #050A24 100%)'
            : 'linear-gradient(270deg, rgba(5, 10, 36, 0.94) 0%, rgba(5, 10, 36, 0.80) 42%, rgba(5, 10, 36, 0.22) 72%, rgba(5, 10, 36, 0.08) 100%)',
        }}
      />

      {/* Seamless Bottom Hand-Off Into Real Course Showcase */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-36"
        style={{
          background:
            'linear-gradient(180deg, rgba(5, 10, 36, 0) 0%, rgba(5, 10, 36, 0.58) 58%, #050A24 100%)',
        }}
      />
    </div>
  );
}
