'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowLeft, Layers } from 'lucide-react';

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
  storyItems: HomeStoryCardItem[];
  onJumpToCatalog: (collection?: HeroCollectionTarget) => void;
  onSelectSectionInEditor?: () => void;
}

interface CardPose {
  x: number;
  y: number;
  rot: number;
  scale: number;
  alpha: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function easeGlide(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
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
  storyItems,
  onJumpToCatalog,
  onSelectSectionInEditor,
}: BoslaHeroEditorialProps) {
  const rootSectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const midPromptRef = useRef<HTMLDivElement>(null);
  const cardNodeRefs = useRef<Array<HTMLDivElement | null>>([]);

  const cards = useMemo(() => storyItems.slice(0, 6), [storyItems]);
  const totalCards = cards.length;

  const [heroCopyInactive, setHeroCopyInactive] = useState(false);

  const isSecondaryAnchor = secondaryCtaHref.startsWith('#');
  const resolvedPrimaryLabel = primaryCtaLabelAr?.trim() || 'استكشف المحتوى';
  const primaryHrefTrimmed = (primaryCtaHref || '#courses-showcase').trim();

  const renderPrimaryCta = (inactive: boolean, compact: boolean) => {
    const cls = `inline-flex ${
      compact ? 'min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 text-xs sm:text-sm' : 'min-h-[46px] px-6 text-sm'
    } items-center justify-center gap-2 rounded-xl border border-[#A78BFA]/45 bg-[#4A1FB0] font-extrabold text-white transition-colors hover:bg-[#5E2CD6] cursor-pointer shadow-sm`;
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

  // Smooth reversible GSAP ScrollTrigger 2-phase timeline: Fan -> Scatter -> immediate unpin into Courses Marquee
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const triggerEl = rootSectionRef.current;
    const stageEl = stageRef.current;
    if (!triggerEl || !stageEl) return;

    const prefersReduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

    if (prefersReduced || totalCards === 0) {
      setHeroCopyInactive(false);
      return;
    }

    setHeroCopyInactive(false);

    gsap.registerPlugin(ScrollTrigger);

    let disposed = false;
    let currentProgress = 0;
    let lastHeroInactive = false;

    const introElapsed = { value: 0 };

    const dims = {
      W: stageEl.clientWidth || window.innerWidth,
      H: stageEl.clientHeight || window.innerHeight,
      safeTop: 80,
      copyBottomY: 310,
      midBottomY: 290,
      cw: 176,
      ch: 204,
      activeFanCount: totalCards,
      isMobile: false,
      isNarrowPhone: false,
      isShort: false,
    };

    const currentPoses: CardPose[] = cards.map(() => ({
      x: dims.W * 0.5,
      y: dims.H + 220,
      rot: 8,
      scale: 0.94,
      alpha: 0,
    }));

    const measureDims = () => {
      if (!stageRef.current) return;
      const stageRect = stageRef.current.getBoundingClientRect();
      const W = Math.max(320, stageRef.current.clientWidth || window.innerWidth);
      const H = Math.max(360, stageRef.current.clientHeight || window.innerHeight);
      const headerEl = document.querySelector('header');
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 68;
      const safeTop = Math.round(headerH + 10);

      const isMobile = W < 820 && W < H * 1.15;
      const isNarrowPhone = W < 640;
      const isShort = H < 540;
      const activeFanCount = isNarrowPhone ? Math.min(4, totalCards) : totalCards;

      const cw = isNarrowPhone
        ? clamp(Math.min(W * 0.25, H * 0.16), 92, 114)
        : isMobile
          ? clamp(Math.min(W * 0.172, H * 0.155), 112, 134)
          : isShort
            ? clamp(H * 0.25, 112, 148)
            : clamp(Math.min(W / 1440, H / 780) * 196, 146, 198);
      const ch = Math.round(cw * (isNarrowPhone ? 1.2 : 1.15));

      const copyRect = heroCopyRef.current?.getBoundingClientRect();
      const copyBottomY = copyRect
        ? copyRect.bottom - stageRect.top
        : safeTop + (isMobile ? 215 : 225);

      const midRect = midPromptRef.current?.getBoundingClientRect();
      const midBottomY = midRect
        ? midRect.bottom - stageRect.top
        : safeTop + (isMobile ? 160 : 210);

      dims.W = W;
      dims.H = H;
      dims.safeTop = safeTop;
      dims.isMobile = isMobile;
      dims.isNarrowPhone = isNarrowPhone;
      dims.isShort = isShort;
      dims.activeFanCount = activeFanCount;
      dims.cw = Math.round(cw);
      dims.ch = Math.round(ch);
      dims.copyBottomY = Math.round(copyBottomY);
      dims.midBottomY = Math.round(midBottomY);

      stageRef.current.style.setProperty('--fan-cw', `${dims.cw}px`);
      stageRef.current.style.setProperty('--fan-ch', `${dims.ch}px`);
    };

    const getFanPose = (i: number): CardPose => {
      const {
        W,
        H,
        cw,
        ch,
        copyBottomY,
        safeTop,
        isMobile,
        isNarrowPhone,
        isShort,
        activeFanCount,
      } = dims;
      if (i >= activeFanCount) {
        return {
          x: W * 0.5,
          y: H + ch * 1.1,
          rot: 0,
          scale: 0.78,
          alpha: 0,
        };
      }
      const R = isNarrowPhone
        ? Math.max(W * 1.1, 340)
        : isMobile
          ? Math.max(W * 1.05, 580)
          : Math.max(660, (1180 * W) / 1440);
      const gapFactor = isNarrowPhone ? 0.88 : isMobile ? 0.94 : 1.07;
      const step = 2 * Math.asin(Math.min(0.92, (gapFactor * cw) / (2 * R)));
      const slot = i - (activeFanCount - 1) / 2;
      const theta = slot * step;

      const minApex = copyBottomY + ch * 0.5 + (isMobile ? 24 : isShort ? 14 : 26);
      const maxApex = H - ch * 0.54 - (isMobile ? 26 : 18);
      const apexY = Math.max(
        safeTop + ch * 0.55,
        Math.min(Math.max(minApex, H * 0.65), Math.max(minApex, maxApex)),
      );
      const edgePad = isMobile ? 16 : 20;

      return {
        x: clamp(W * 0.5 + R * Math.sin(theta), cw * 0.56 + edgePad, W - cw * 0.56 - edgePad),
        y: clamp(apexY + R * (1 - Math.cos(theta)), safeTop + ch * 0.5, H - ch * 0.34),
        rot: (theta * 180) / Math.PI,
        scale: 1,
        alpha: 1,
      };
    };

    const getScatterPose = (i: number): CardPose => {
      const { W, H, cw, ch, safeTop, midBottomY, isMobile, isShort, activeFanCount } = dims;
      if (i >= activeFanCount) {
        return {
          x: W * 0.5,
          y: H + ch * 0.9,
          rot: 0,
          scale: 0.74,
          alpha: 0,
        };
      }

      const desktopSlots: Array<[number, number, number]> = [
        [0.11, 0.35, -18],
        [0.89, 0.35, 17],
        [0.18, 0.75, -12],
        [0.82, 0.75, 13],
        [0.36, 0.87, -7],
        [0.64, 0.87, 8],
      ];

      const mobileSlots: Array<[number, number, number]> = [
        [0.17, 0.56, -15],
        [0.83, 0.56, 15],
        [0.2, 0.77, -10],
        [0.8, 0.77, 10],
        [0.39, 0.9, -5],
        [0.61, 0.9, 6],
      ];

      const raw = (isMobile ? mobileSlots : desktopSlots)[i % 6]!;
      let x = raw[0] * W;
      let y = raw[1] * H;
      const rot = raw[2];

      if (isShort && y < H * 0.45) {
        y += H * 0.14;
      }

      x = clamp(x, cw * 0.52 + 12, W - cw * 0.52 - 12);
      const lowerClearance = midBottomY + ch * 0.5 + 14;
      if (isMobile || Math.abs(x - W * 0.5) < cw * 1.15) {
        y = Math.max(y, lowerClearance);
      }
      y = clamp(y, safeTop + ch * 0.52 + 8, H - ch * 0.48 - 10);

      return { x, y, rot, scale: isMobile ? 0.94 : 0.96, alpha: 1 };
    };

    const computeTargetPose = (i: number, p: number): CardPose => {
      if (p <= 0.24) {
        return getFanPose(i);
      }
      const t = easeInOutCubic(clamp((p - 0.24) / 0.48, 0, 1));
      const a = getFanPose(i);
      const b = getScatterPose(i);
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        rot: lerp(a.rot, b.rot, t),
        scale: lerp(a.scale, b.scale, t),
        alpha: lerp(a.alpha, b.alpha, t),
      };
    };

    const applyStageElements = (p: number) => {
      // Hero headline & CTA exit cleanly before reaching fixed header (0.22 -> 0.44)
      const copyFadeT = clamp((p - 0.22) / 0.22, 0, 1);
      if (heroCopyRef.current) {
        const copyAlpha = 1 - easeInOutCubic(copyFadeT);
        const copyY = -44 * easeInOutCubic(copyFadeT);
        heroCopyRef.current.style.opacity = String(copyAlpha);
        heroCopyRef.current.style.transform = `translate3d(0, ${copyY}px, 0)`;
        heroCopyRef.current.style.visibility = copyAlpha <= 0.02 ? 'hidden' : 'visible';
      }
      const nextHeroInactive = p > 0.35;
      if (nextHeroInactive !== lastHeroInactive) {
        lastHeroInactive = nextHeroInactive;
        setHeroCopyInactive(nextHeroInactive);
      }

      // Center Scatter prompt ("اختار خطوتك الجاية") remains clear until unpin straight into #courses-showcase
      if (midPromptRef.current) {
        const enter = clamp((p - 0.36) / 0.2, 0, 1);
        const midAlpha = easeInOutCubic(enter);
        const midY = (1 - easeGlide(enter)) * 18;
        midPromptRef.current.style.opacity = String(midAlpha);
        midPromptRef.current.style.transform = `translate3d(-50%, ${midY}px, 0)`;
        midPromptRef.current.style.visibility = midAlpha <= 0.02 ? 'hidden' : 'visible';
      }
    };

    const syncCardsTick = (_time: number, deltaMs: number) => {
      if (disposed) return;
      const dt = clamp(deltaMs || 16.67, 4, 60);
      introElapsed.value = Math.min(2, introElapsed.value + dt / 1000);

      for (let i = 0; i < totalCards; i++) {
        const el = cardNodeRefs.current[i];
        if (!el) continue;

        const target = computeTargetPose(i, currentProgress);

        let effectiveTarget = target;
        if (currentProgress < 0.04 && introElapsed.value < 1.1 && i < dims.activeFanCount) {
          const delay = i * 0.055;
          const riseT = clamp((introElapsed.value - delay) / 0.55, 0, 1);
          const easedRise = easeGlide(riseT);
          effectiveTarget = {
            x: target.x,
            y: lerp(dims.H + dims.ch * 0.7, target.y, easedRise),
            rot: lerp(target.rot + (i % 2 === 0 ? 6 : -6), target.rot, easedRise),
            scale: lerp(0.92, target.scale, easedRise),
            alpha: lerp(0, target.alpha, clamp(riseT * 1.6, 0, 1)),
          };
        }

        const cur = currentPoses[i]!;
        if (currentProgress <= 0.002 && introElapsed.value >= 1.1) {
          cur.x = effectiveTarget.x;
          cur.y = effectiveTarget.y;
          cur.rot = effectiveTarget.rot;
          cur.scale = effectiveTarget.scale;
          cur.alpha = effectiveTarget.alpha;
        } else {
          const weight = 0.22 + (i % 4) * 0.03;
          const k = 1 - Math.pow(1 - weight, dt / 16.67);
          cur.x = lerp(cur.x, effectiveTarget.x, k);
          cur.y = lerp(cur.y, effectiveTarget.y, k);
          cur.rot = lerp(cur.rot, effectiveTarget.rot, k);
          cur.scale = lerp(cur.scale, effectiveTarget.scale, k);
          cur.alpha = lerp(cur.alpha, effectiveTarget.alpha, k);
        }

        el.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0) rotate(${cur.rot.toFixed(2)}deg) scale(${cur.scale.toFixed(3)})`;
        el.style.opacity = cur.alpha.toFixed(3);
        el.style.visibility = cur.alpha <= 0.015 ? 'hidden' : 'visible';
      }
    };

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      measureDims();
      for (let i = 0; i < totalCards; i++) {
        const initTarget = computeTargetPose(i, 0);
        currentPoses[i] = {
          x: initTarget.x,
          y: i < dims.activeFanCount ? dims.H + dims.ch * 0.55 : dims.H + dims.ch,
          rot: initTarget.rot,
          scale: 0.94,
          alpha: i < dims.activeFanCount ? 0.25 : 0,
        };
      }
      applyStageElements(0);

      mm.add('(min-width: 820px)', () => {
        ScrollTrigger.create({
          trigger: triggerEl,
          start: 'top top',
          end: '+=115%',
          pin: stageEl,
          scrub: 0.45,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => {
            measureDims();
          },
          onUpdate: (self) => {
            currentProgress = clamp(self.progress, 0, 1);
            applyStageElements(currentProgress);
          },
        });
      });

      mm.add('(max-width: 819px)', () => {
        ScrollTrigger.create({
          trigger: triggerEl,
          start: 'top top',
          end: '+=80%',
          pin: stageEl,
          scrub: 0.35,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => {
            measureDims();
          },
          onUpdate: (self) => {
            currentProgress = clamp(self.progress, 0, 1);
            applyStageElements(currentProgress);
          },
        });
      });

      gsap.ticker.add(syncCardsTick);
    }, rootSectionRef);

    const ro = new ResizeObserver(() => {
      if (!disposed) {
        measureDims();
        ScrollTrigger.refresh();
      }
    });
    ro.observe(stageEl);

    document.fonts?.ready?.then(() => {
      if (!disposed) {
        measureDims();
        ScrollTrigger.refresh();
      }
    });

    return () => {
      disposed = true;
      ro.disconnect();
      gsap.ticker.remove(syncCardsTick);
      mm.revert();
      ctx.revert();
    };
  }, [cards, motionPaused, totalCards]);

  // Static reduced-motion / pause-motion layout (zero pinned travel, directly browsable fan shelf)
  if (motionPaused) {
    return (
      <section
        id="hero-stage"
        ref={rootSectionRef}
        onClick={() => onSelectSectionInEditor?.()}
        aria-label="الواجهة الرئيسية ومحتوى الأكاديمية"
        className="w-full bg-[#070D2B] pt-[96px] pb-12 sm:pt-[112px] sm:pb-16 text-[#EEF0FF]"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-10">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <h1 className="bosla-display-font text-[clamp(2rem,4.5vw,3.6rem)] font-black leading-[1.2] text-[#EEF0FF]">
              {titleAr || 'معرفة تتحوّل إلى خبرة'}
            </h1>

            <p className="mx-auto max-w-2xl text-sm sm:text-base leading-[1.78] font-medium text-[#B8C3F2]">
              {subtitleAr}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {renderPrimaryCta(false, false)}

              {isSecondaryAnchor ? (
                <a
                  href={secondaryCtaHref}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl border-2 border-[#8CA2FF]/45 bg-[#0F1A4A] px-5 text-sm font-extrabold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
                >
                  {secondaryCtaLabelAr}
                </a>
              ) : (
                <Link
                  href={secondaryCtaHref}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl border-2 border-[#8CA2FF]/45 bg-[#0F1A4A] px-5 text-sm font-extrabold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
                >
                  {secondaryCtaLabelAr}
                </Link>
              )}
            </div>
          </div>

          {cards.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map((card) => (
                <Link
                  key={card.uid}
                  href={card.href}
                  onClick={(e) => e.stopPropagation()}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#8CA2FF]/28 bg-[#0F1A4A] p-2 shadow-sm transition-colors hover:border-[#8CA2FF] hover:bg-[#142260]"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#070D2B]">
                    <img
                      src={card.thumbnailUrl}
                      alt={card.titleAr}
                      loading="eager"
                      style={{
                        objectPosition: `${card.coverFocalX ?? 50}% ${card.coverFocalY ?? 50}%`,
                      }}
                      className={`h-full w-full ${
                        card.coverFitMode === 'CONTAIN' ? 'object-contain bg-[#0B1440] p-1' : 'object-cover'
                      }`}
                    />
                  </div>
                  <div className="pt-2.5 px-1 space-y-1">
                    <span className="inline-block rounded-md border border-[#8CA2FF]/25 bg-[#18266E] px-2 py-0.5 text-[10px] font-extrabold text-[#C4B5FD]">
                      {card.kindLabelAr}
                    </span>
                    <p className="text-xs font-extrabold text-[#EEF0FF] line-clamp-2 group-hover:text-[#A5B4FC]">
                      {card.titleAr}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero-stage"
      ref={rootSectionRef}
      onClick={() => onSelectSectionInEditor?.()}
      aria-label="المقدمة والمحتوى التعليمي التفاعلي"
      className="relative w-full bg-[#070D2B] text-[#EEF0FF]"
    >
      <div
        ref={stageRef}
        className="bosla-story-stage"
        style={
          {
            '--fan-cw': '176px',
            '--fan-ch': '204px',
          } as React.CSSProperties
        }
      >
        {/* Phase 1: Initial Hero Copy (Top Half, Clean Above Fan) */}
        <div
          ref={heroCopyRef}
          aria-hidden={heroCopyInactive}
          className={`relative z-20 mx-auto max-w-[820px] px-4 sm:px-8 pt-[88px] sm:pt-[108px] text-center space-y-3 sm:space-y-4 ${
            heroCopyInactive ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <h1 className="bosla-display-font text-[clamp(2rem,4.3vw,3.55rem)] font-black leading-[1.18] text-[#EEF0FF]">
            {titleAr || 'معرفة تتحوّل إلى خبرة'}
          </h1>

          <p className="mx-auto max-w-[60ch] text-xs sm:text-[0.98rem] leading-[1.7] font-medium text-[#B8C3F2] line-clamp-2 sm:line-clamp-none">
            {subtitleAr}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-1">
            {renderPrimaryCta(heroCopyInactive, true)}

            {isSecondaryAnchor ? (
              <a
                href={secondaryCtaHref}
                tabIndex={heroCopyInactive ? -1 : undefined}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-[44px] sm:min-h-[46px] items-center justify-center rounded-xl border-2 border-[#8CA2FF]/45 bg-[#0F1A4A] px-4 sm:px-5 text-xs sm:text-sm font-extrabold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
              >
                {secondaryCtaLabelAr}
              </a>
            ) : (
              <Link
                href={secondaryCtaHref}
                tabIndex={heroCopyInactive ? -1 : undefined}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-[44px] sm:min-h-[46px] items-center justify-center rounded-xl border-2 border-[#8CA2FF]/45 bg-[#0F1A4A] px-4 sm:px-5 text-xs sm:text-sm font-extrabold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
              >
                {secondaryCtaLabelAr}
              </Link>
            )}
          </div>
        </div>

        {/* Phase 2: Center Safe Scatter Prompt before immediate exit into Programs & Courses */}
        <div
          ref={midPromptRef}
          aria-hidden="true"
          style={{ opacity: 0, visibility: 'hidden' }}
          className="pointer-events-none absolute top-[21%] sm:top-[25%] left-1/2 z-20 w-[min(90vw,520px)] text-center space-y-2.5"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/35 bg-[#0F1A4A] px-3.5 py-1 text-xs font-extrabold text-[#C4B5FD]">
            <Layers className="h-3.5 w-3.5 text-[#8CA2FF]" aria-hidden="true" />
            <span>من التعلّم التطبيقي إلى التطبيق الميداني</span>
          </span>
          <p className="bosla-display-font text-[clamp(1.75rem,3.6vw,2.9rem)] font-black leading-[1.2] text-[#EEF0FF]">
            اختار خطوتك الجاية
          </p>
          <p className="mx-auto max-w-[44ch] text-xs sm:text-sm font-semibold text-[#B8C3F2]">
            استمر في التمرير لاستعراض البرامج والكورسات التطبيقية المعتمدة مباشرة
          </p>
        </div>

        {/* Animated Fan -> Scatter Visual Cards (Decorative during motion; full catalog follows immediately below) */}
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
          {cards.map((card, i) => (
            <div
              key={card.uid}
              ref={(el) => {
                cardNodeRefs.current[i] = el;
              }}
              data-testid={`hero-story-card-${i}`}
              style={{
                width: 'var(--fan-cw)',
                height: 'var(--fan-ch)',
                marginLeft: 'calc(var(--fan-cw) * -0.5)',
                marginTop: 'calc(var(--fan-ch) * -0.5)',
                transform: 'translate3d(50vw, 120vh, 0)',
                zIndex: 20 + i,
                opacity: 0,
                visibility: 'hidden',
              }}
              className="bosla-fan-card pointer-events-none flex flex-col justify-between overflow-hidden rounded-2xl border border-[#8CA2FF]/38 bg-[#0F1A4A] p-1.5 sm:p-2"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#8CA2FF]/20 bg-[#070D2B]">
                <img
                  src={card.thumbnailUrl}
                  alt=""
                  loading="eager"
                  decoding="async"
                  style={{
                    objectPosition: `${card.coverFocalX ?? 50}% ${card.coverFocalY ?? 50}%`,
                  }}
                  className={`h-full w-full ${
                    card.coverFitMode === 'CONTAIN' ? 'object-contain bg-[#0B1440] p-1' : 'object-cover'
                  }`}
                />
              </div>

              <div className="flex flex-1 flex-col justify-between px-1 pt-1.5 pb-0.5 text-start">
                <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-extrabold">
                  <span className="truncate rounded-md border border-[#8CA2FF]/25 bg-[#18266E] px-1.5 py-0.5 text-[#C4B5FD]">
                    {card.kindLabelAr}
                  </span>
                  <span className="hidden lg:inline truncate text-[#77E2B5]">
                    {card.priceLabelAr}
                  </span>
                </div>

                <p className="mt-1 text-[11px] sm:text-xs font-extrabold leading-snug text-[#EEF0FF] line-clamp-2">
                  {card.titleAr}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
