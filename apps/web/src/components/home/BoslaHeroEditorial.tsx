'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowLeft } from 'lucide-react';

export type HeroCollectionTarget = 'ALL' | 'COURSES' | 'PATHS' | 'DIPLOMAS';

export interface HomeStoryCardItem {
  uid: string;
  kind: 'course' | 'path' | 'diploma';
  kindLabelAr: string;
  titleAr: string;
  href: string;
  thumbnailUrl: string;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
  coverFitMode?: string | null;
  metaAr: string;
  priceLabelAr: string;
}

export interface BoslaHeroEditorialProps {
  badgeAr?: string | null;
  titleAr: string;
  subtitleAr: string;
  primaryCtaLabelAr: string;
  primaryCtaHref: string;
  secondaryCtaLabelAr: string;
  secondaryCtaHref: string;
  motionPaused: boolean;
  storyItems?: HomeStoryCardItem[];
  heroVideoDesktopUrl?: string | null;
  heroVideoMobileUrl?: string | null;
  heroPosterDesktopUrl?: string | null;
  heroPosterMobileUrl?: string | null;
  onJumpToCatalog: (collection?: HeroCollectionTarget) => void;
  onSelectSectionInEditor?: () => void;
}

const DEFAULT_VIDEO_DESKTOP = '/videos/bosla-door-hero-desktop.mp4';
const DEFAULT_VIDEO_MOBILE = '/videos/bosla-door-hero-mobile.mp4';
const DEFAULT_POSTER_DESKTOP = '/images/homepage/bosla-door-poster-desktop.webp';
const DEFAULT_POSTER_MOBILE = '/images/homepage/bosla-door-poster-mobile.webp';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeInOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function BoslaHeroEditorial({
  badgeAr: _badgeAr,
  titleAr,
  subtitleAr,
  primaryCtaLabelAr,
  primaryCtaHref,
  secondaryCtaLabelAr,
  secondaryCtaHref,
  motionPaused,
  heroVideoDesktopUrl,
  heroVideoMobileUrl,
  heroPosterDesktopUrl,
  heroPosterMobileUrl,
  onJumpToCatalog,
  onSelectSectionInEditor,
}: BoslaHeroEditorialProps) {
  const rootSectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const mediaWrapRef = useRef<HTMLDivElement>(null);
  const exitVeilRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);
  const [heroCopyInactive, setHeroCopyInactive] = useState(false);

  const resolvedPosterDesktop = heroPosterDesktopUrl?.trim() || DEFAULT_POSTER_DESKTOP;
  const resolvedPosterMobile = heroPosterMobileUrl?.trim() || DEFAULT_POSTER_MOBILE;
  const resolvedVideoDesktop = heroVideoDesktopUrl?.trim() || DEFAULT_VIDEO_DESKTOP;
  const resolvedVideoMobile = heroVideoMobileUrl?.trim() || DEFAULT_VIDEO_MOBILE;

  const activePoster = isMobileViewport ? resolvedPosterMobile : resolvedPosterDesktop;
  const activeVideoSrc = isMobileViewport ? resolvedVideoMobile : resolvedVideoDesktop;
  const shouldReduceMotion = motionPaused || osReducedMotion;

  const isSecondaryAnchor = secondaryCtaHref.startsWith('#');
  const resolvedPrimaryLabel = primaryCtaLabelAr?.trim() || 'استكشف الكورسات';
  const primaryHrefTrimmed = (primaryCtaHref || '#courses-showcase').trim();

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

  useEffect(() => {
    setVideoReady(false);
    setVideoErrored(false);
  }, [activeVideoSrc]);

  const renderPrimaryCta = (inactive: boolean, compact: boolean) => {
    const cls = `inline-flex ${
      compact
        ? 'min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 text-xs sm:text-sm'
        : 'min-h-[46px] px-6 text-sm'
    } items-center justify-center gap-2 rounded-xl bg-[var(--bosla-color-purple-royal)] font-extrabold text-[var(--bosla-color-white)] transition-colors hover:bg-[var(--bosla-color-purple-support)] cursor-pointer shadow-sm`;
    const IconComp = compact ? ArrowDown : ArrowLeft;
    const isCatalogAnchor =
      !primaryHrefTrimmed || primaryHrefTrimmed === '#courses-showcase' || primaryHrefTrimmed === '/';
    if (isCatalogAnchor) {
      return (
        <button
          id="hero-primary-cta"
          type="button"
          tabIndex={inactive ? -1 : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onJumpToCatalog('ALL');
          }}
          className={cls}
        >
          <span>{resolvedPrimaryLabel}</span>
          <IconComp className="h-4 w-4" aria-hidden="true" />
        </button>
      );
    }
    if (primaryHrefTrimmed.startsWith('#')) {
      return (
        <a
          id="hero-primary-cta"
          href={primaryHrefTrimmed}
          tabIndex={inactive ? -1 : undefined}
          onClick={(e) => e.stopPropagation()}
          className={cls}
        >
          <span>{resolvedPrimaryLabel}</span>
          <IconComp className="h-4 w-4" aria-hidden="true" />
        </a>
      );
    }
    return (
      <Link
        id="hero-primary-cta"
        href={primaryHrefTrimmed}
        tabIndex={inactive ? -1 : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cls}
      >
        <span>{resolvedPrimaryLabel}</span>
        <IconComp className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  };

  const renderSecondaryCta = (inactive: boolean, compact: boolean) => {
    const cls = `inline-flex ${
      compact ? 'min-h-[44px] sm:min-h-[46px] px-4 sm:px-5 text-xs sm:text-sm' : 'min-h-[46px] px-5 text-sm'
    } items-center justify-center rounded-xl border-2 border-[var(--bosla-home-border-strong)] bg-[var(--bosla-color-white)] font-extrabold text-[var(--bosla-color-ink)] transition-colors hover:border-[var(--bosla-color-purple-royal)] hover:bg-[var(--bosla-color-blue-light)] shadow-sm`;
    if (isSecondaryAnchor) {
      return (
        <a
          href={secondaryCtaHref}
          tabIndex={inactive ? -1 : undefined}
          onClick={(e) => e.stopPropagation()}
          className={cls}
        >
          {secondaryCtaLabelAr}
        </a>
      );
    }
    return (
      <Link
        href={secondaryCtaHref}
        tabIndex={inactive ? -1 : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cls}
      >
        {secondaryCtaLabelAr}
      </Link>
    );
  };

  // GSAP ScrollTrigger door-opening scrub + coalesced single-flight seek controller
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const triggerEl = rootSectionRef.current;
    const stageEl = stageRef.current;
    const videoEl = videoRef.current;
    if (!triggerEl || !stageEl) return;

    if (shouldReduceMotion) {
      setHeroCopyInactive(false);
      return;
    }

    setHeroCopyInactive(false);
    gsap.registerPlugin(ScrollTrigger);

    let disposed = false;
    let progress = 0;
    let duration = 4;
    let metadataReady = Boolean(videoEl && videoEl.readyState >= 1 && Number.isFinite(videoEl.duration));
    if (videoEl && metadataReady) {
      duration = Math.max(0.5, videoEl.duration);
    }

    let desiredTime = 0;
    let lastAppliedTime = -1;
    let isSeeking = false;
    let lastHeroInactive = false;
    let seekSafetyTimer: number | null = null;

    const clearSafetyTimer = () => {
      if (seekSafetyTimer !== null) {
        window.clearTimeout(seekSafetyTimer);
        seekSafetyTimer = null;
      }
    };

    const flushNextSeek = () => {
      if (disposed || !videoEl || !metadataReady || isSeeking) return;
      const safeEnd = Math.max(0.1, duration - 0.04);
      const targetTime = clamp(desiredTime, 0, safeEnd);
      const atBoundary =
        (targetTime === 0 && lastAppliedTime > 0) ||
        (targetTime >= safeEnd && lastAppliedTime < safeEnd);
      if (!atBoundary && Math.abs(targetTime - lastAppliedTime) < 0.008) return;

      isSeeking = true;
      lastAppliedTime = targetTime;
      clearSafetyTimer();
      seekSafetyTimer = window.setTimeout(() => {
        isSeeking = false;
      }, 180);

      try {
        videoEl.currentTime = targetTime;
      } catch {
        isSeeking = false;
        clearSafetyTimer();
      }
    };

    const onLoadedMetadata = () => {
      if (!videoEl || disposed) return;
      if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
        duration = videoEl.duration;
      }
      metadataReady = true;
      videoEl.pause();
      if (videoEl.readyState >= 2) {
        setVideoReady(true);
      }
      const safeEnd = Math.max(0.1, duration - 0.04);
      desiredTime = clamp(progress / 0.8, 0, 1) * safeEnd;
      flushNextSeek();
    };

    const onLoadedData = () => {
      if (!disposed) {
        setVideoReady(true);
        flushNextSeek();
      }
    };

    const onSeeked = () => {
      isSeeking = false;
      clearSafetyTimer();
      if (!disposed && videoEl && videoEl.readyState >= 2) {
        setVideoReady(true);
      }
      flushNextSeek();
    };

    const onVideoError = () => {
      if (!disposed) {
        setVideoErrored(true);
      }
    };

    if (videoEl) {
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.pause();
      videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.addEventListener('loadeddata', onLoadedData);
      videoEl.addEventListener('seeked', onSeeked);
      videoEl.addEventListener('error', onVideoError);
      if (videoEl.readyState >= 1) onLoadedMetadata();
      if (videoEl.readyState >= 2) setVideoReady(true);
    }

    const applyStageTransforms = (p: number) => {
      // Phase 1 (0.00 -> 0.22): Headline, subtitle & CTA quietly vanish before doors expose interior
      const copyFadeT = clamp(p / 0.22, 0, 1);
      if (heroCopyRef.current) {
        const copyAlpha = 1 - easeInOutCubic(copyFadeT);
        const copyY = 14 * easeInOutCubic(copyFadeT);
        heroCopyRef.current.style.opacity = copyAlpha.toFixed(3);
        heroCopyRef.current.style.transform = `translate3d(0, ${copyY.toFixed(1)}px, 0)`;
        heroCopyRef.current.style.visibility = copyAlpha <= 0.02 ? 'hidden' : 'visible';
      }

      const nextInactive = p > 0.16;
      if (nextInactive !== lastHeroInactive) {
        lastHeroInactive = nextInactive;
        setHeroCopyInactive(nextInactive);
      }

      // Phase 2 & 3 (0.68 -> 1.00): Gentle doorway push-in + bottom-up Sky-Blue blend into #courses-showcase
      if (mediaWrapRef.current) {
        const pushT = easeInOutCubic(clamp((p - 0.68) / 0.32, 0, 1));
        const scale = 1 + pushT * 0.06;
        const fadeTail = 1 - easeInOutCubic(clamp((p - 0.86) / 0.14, 0, 1)) * 0.18;
        mediaWrapRef.current.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(4)})`;
        mediaWrapRef.current.style.opacity = fadeTail.toFixed(3);
      }

      if (exitVeilRef.current) {
        const veilT = easeInOutCubic(clamp((p - 0.82) / 0.18, 0, 1)) * 0.88;
        exitVeilRef.current.style.opacity = veilT.toFixed(3);
      }
    };

    const tickVideoSync = () => {
      if (!disposed) {
        flushNextSeek();
      }
    };

    const ctx = gsap.context(() => {
      applyStageTransforms(0);
      ScrollTrigger.create({
        trigger: triggerEl,
        start: 'top top',
        end: () => (window.innerWidth >= 1024 ? '+=78%' : '+=58%'),
        pin: stageEl,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progress = clamp(self.progress, 0, 1);
          const safeEnd = Math.max(0.1, duration - 0.04);
          desiredTime = clamp(progress / 0.82, 0, 1) * safeEnd;
          applyStageTransforms(progress);
        },
      });
    }, rootSectionRef);

    gsap.ticker.add(tickVideoSync);

    const onResize = () => {
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      disposed = true;
      clearSafetyTimer();
      window.removeEventListener('resize', onResize);
      gsap.ticker.remove(tickVideoSync);
      if (videoEl) {
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoEl.removeEventListener('loadeddata', onLoadedData);
        videoEl.removeEventListener('seeked', onSeeked);
        videoEl.removeEventListener('error', onVideoError);
      }
      ctx.revert();
    };
  }, [activeVideoSrc, shouldReduceMotion]);

  // Static accessible hero under OS Reduced Motion or user motion toggle
  if (shouldReduceMotion) {
    return (
      <section
        id="hero-stage"
        ref={rootSectionRef}
        onClick={() => onSelectSectionInEditor?.()}
        aria-label="الواجهة الرئيسية واستعراض بوابة الأكاديمية"
        style={{ backgroundColor: 'var(--bosla-color-blue-primary)' }}
        className="relative w-full bg-gradient-to-b from-[var(--bosla-color-blue-light)] via-[var(--bosla-color-blue-primary)] to-[var(--bosla-color-blue-primary)] pt-[88px] pb-10 sm:pt-[100px] sm:pb-12 text-[var(--bosla-color-ink)]"
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8 space-y-6 sm:space-y-8">
          <div className="mx-auto max-w-3xl text-center space-y-3.5">
            <h1 className="bosla-display-font text-[clamp(1.9rem,4.2vw,3.35rem)] font-black leading-[1.18] text-[var(--bosla-color-ink)]">
              {titleAr || 'معرفة تتحوّل إلى خبرة'}
            </h1>
            <p className="mx-auto max-w-[60ch] text-sm sm:text-base leading-[1.75] font-medium text-[var(--bosla-color-ink-muted)]">
              {subtitleAr}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {renderPrimaryCta(false, false)}
              {renderSecondaryCta(false, false)}
            </div>
          </div>

          <div
            data-testid="hero-door-media-stage"
            className="mx-auto max-w-[980px] overflow-hidden rounded-2xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)] shadow-[0_24px_56px_-26px_rgba(23,36,61,0.28)]"
          >
            <picture>
              <source media="(max-width: 767px)" srcSet={resolvedPosterMobile} />
              <img
                src={resolvedPosterDesktop}
                alt="بوابة أكاديمية بوصلة للتأهيل التطبيقي"
                width={1920}
                height={1080}
                fetchPriority="high"
                decoding="async"
                className="aspect-video w-full h-auto object-cover"
              />
            </picture>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero-stage"
      ref={rootSectionRef}
      onClick={() => onSelectSectionInEditor?.()}
      aria-label="الواجهة الرئيسية واستعراض بوابة الأكاديمية"
      style={{ backgroundColor: 'var(--bosla-color-blue-primary)' }}
      className="relative w-full text-[var(--bosla-color-ink)]"
    >
      <div
        ref={stageRef}
        className="bosla-door-hero-stage relative flex w-full flex-col justify-start gap-4 overflow-hidden pt-[80px] pb-8 lg:block lg:h-[100svh] lg:min-h-[600px] lg:pt-[68px] lg:pb-0"
      >
        {/* Door Video Stage: sits high & uncropped on mobile/tablet so opening motion stays anchored; spans cleanly under header on desktop */}
        <div
          data-testid="hero-door-media-stage"
          className="relative z-10 order-1 mx-auto w-[min(94vw,860px)] overflow-hidden rounded-2xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-primary)] shadow-[0_24px_54px_-26px_rgba(23,36,61,0.3)] aspect-video lg:mx-0 lg:w-full lg:max-w-none lg:h-full lg:aspect-auto lg:rounded-none lg:border-0 lg:shadow-none"
        >
          <div
            ref={mediaWrapRef}
            className="relative h-full w-full will-change-transform origin-[50%_54%]"
          >
            {/* High-priority first-frame closed-door WebP poster (Zero white/black flash & resilient error fallback) */}
            <img
              src={activePoster}
              alt="بوابة أكاديمية بوصلة"
              width={isMobileViewport ? 960 : 1920}
              height={isMobileViewport ? 540 : 1080}
              fetchPriority="high"
              decoding="async"
              data-testid="hero-door-poster"
              className="bosla-hero-door-media h-full w-full"
            />

            {/* Scrubbed MP4 sliding-doors video (NO autoPlay, NO loop, strictly scrubbed via ScrollTrigger) */}
            {!saveData && !videoErrored && (
              <video
                ref={videoRef}
                key={activeVideoSrc}
                src={activeVideoSrc}
                poster={activePoster}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
                data-testid="hero-door-video"
                width={isMobileViewport ? 960 : 1920}
                height={isMobileViewport ? 540 : 1080}
                className={`bosla-hero-door-media pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${
                  videoReady ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
          </div>

          {/* Seamless Sky-Atrium Bottom Blend synced to end frames (preserves open doorway clarity without harsh cut) */}
          <div
            ref={exitVeilRef}
            aria-hidden="true"
            style={{
              opacity: 0,
              background:
                'linear-gradient(180deg, rgba(173, 213, 240, 0.14) 0%, rgba(198, 226, 245, 0.56) 58%, var(--bosla-color-blue-primary) 100%)',
            }}
            className="pointer-events-none absolute inset-0 z-10"
          />

          {/* Subtle bottom lip gradient matching #courses-showcase top #ADD5F0 stop */}
          <div
            aria-hidden="true"
            style={{
              background:
                'linear-gradient(180deg, rgba(173, 213, 240, 0) 0%, rgba(173, 213, 240, 0.65) 68%, var(--bosla-color-blue-primary) 100%)',
            }}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 sm:h-24"
          />
        </div>

        {/* Editorial Title + CTA Card: below video portal on mobile (above fold!), bottom-center below BOSLA sign on desktop */}
        <div
          ref={heroCopyRef}
          aria-hidden={heroCopyInactive}
          className={`relative z-20 order-2 mx-auto w-full max-w-[680px] px-4 text-center lg:absolute lg:bottom-7 lg:inset-x-0 lg:px-6 ${
            heroCopyInactive ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <div className="mx-auto rounded-2xl border border-[var(--bosla-home-border)] bg-[rgba(255,255,255,0.9)] px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-md shadow-[0_20px_50px_-24px_rgba(23,36,61,0.28)] space-y-2.5 sm:space-y-3">
            <h1 className="bosla-display-font text-[clamp(1.7rem,3.6vw,3.1rem)] font-black leading-[1.18] text-[var(--bosla-color-ink)]">
              {titleAr || 'معرفة تتحوّل إلى خبرة'}
            </h1>

            <p className="mx-auto max-w-[58ch] text-xs sm:text-[0.94rem] leading-[1.68] font-semibold text-[var(--bosla-color-ink-muted)] line-clamp-2 sm:line-clamp-none">
              {subtitleAr}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              {renderPrimaryCta(heroCopyInactive, true)}
              {renderSecondaryCta(heroCopyInactive, true)}
            </div>
          </div>
        </div>

        {/* Mobile quiet scroll prompt directly beneath uncropped architectural portal */}
        <p className="relative z-10 order-3 text-center text-xs font-extrabold text-[var(--bosla-color-purple-royal)] lg:hidden">
          مرّر لأسفل لفتح البوابة واستعراض الكورسات
        </p>
      </div>
    </section>
  );
}
