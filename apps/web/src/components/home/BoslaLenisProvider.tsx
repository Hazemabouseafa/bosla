'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface LenisControlContextValue {
  scrollToElement: (
    target: HTMLElement | string,
    options?: { clearance?: number; immediate?: boolean; duration?: number },
  ) => void;
  setScrollLocked: (locked: boolean) => void;
}

const LenisControlContext = createContext<LenisControlContextValue | null>(null);

export function useHomeLenis() {
  return useContext(LenisControlContext);
}

/**
 * Homepage-scoped Lenis controller synchronized cleanly with GSAP ScrollTrigger.
 * Runs a single ticker loop (autoRaf: false -> gsap.ticker) and cleans up all
 * listeners/instances cleanly on navigation or reduced-motion toggle.
 */
export function BoslaLenisProvider({
  motionPaused,
  children,
}: {
  motionPaused: boolean;
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (motionPaused || osReduced) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      return;
    }

    // Prevent duplicate Lenis instance if effect re-runs cleanly
    if (lenisRef.current) {
      lenisRef.current.destroy();
      lenisRef.current = null;
    }

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.14,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      anchors: false,
      prevent: (node) =>
        Boolean(
          node.closest(
            'dialog, [role="dialog"], [data-lenis-prevent], .overflow-y-auto, .overflow-x-auto',
          ),
        ),
    });

    lenisRef.current = lenis;

    const handleLenisScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', handleLenisScroll);

    const updateTicker = (timeSeconds: number) => {
      lenis.raf(timeSeconds * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    const refreshRaf = window.requestAnimationFrame(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    });

    return () => {
      window.cancelAnimationFrame(refreshRaf);
      lenis.off('scroll', handleLenisScroll);
      gsap.ticker.remove(updateTicker);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      if (lenisRef.current === lenis) {
        lenisRef.current = null;
      }
    };
  }, [motionPaused]);

  const setScrollLocked = useCallback((locked: boolean) => {
    const inst = lenisRef.current;
    if (!inst) return;
    if (locked) {
      inst.stop();
    } else {
      inst.start();
    }
  }, []);

  const scrollToElement = useCallback(
    (
      target: HTMLElement | string,
      options: { clearance?: number; immediate?: boolean; duration?: number } = {},
    ) => {
      const el =
        typeof target === 'string'
          ? document.getElementById(target.replace(/^#/, ''))
          : target;
      if (!el) return;

      const desiredClearance = Math.max(0, options.clearance ?? 86);
      const scrollMarginTop = Number.parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
      const dist = Math.abs(el.getBoundingClientRect().top - Math.max(scrollMarginTop, desiredClearance));
      const osReduced =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const isImmediate = Boolean(
        options.immediate || motionPaused || osReduced || dist > window.innerHeight * 1.1,
      );

      const inst = lenisRef.current;
      if (inst) {
        // Lenis subtracts CSS scroll-margin-top automatically; only add remaining clearance if needed.
        const extraOffset =
          scrollMarginTop >= desiredClearance ? 0 : -(desiredClearance - scrollMarginTop);
        inst.scrollTo(el, {
          offset: extraOffset,
          immediate: isImmediate,
          duration: isImmediate ? 0 : (options.duration ?? 0.55),
          lock: false,
        });
        return;
      }

      const effectiveClearance = Math.max(scrollMarginTop, desiredClearance);
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - effectiveClearance);
      window.scrollTo({
        top,
        behavior: isImmediate ? ('instant' as ScrollBehavior) : 'smooth',
      });
    },
    [motionPaused],
  );

  return (
    <LenisControlContext.Provider value={{ scrollToElement, setScrollLocked }}>
      {children}
    </LenisControlContext.Provider>
  );
}
