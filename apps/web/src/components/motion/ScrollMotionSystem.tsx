'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const latnFormatter = new Intl.NumberFormat('ar-EG', { numberingSystem: 'latn' });

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Scroll-Craft Runtime + Single-Pass Reveal Observer
 * - Drives --sc-p on [data-sc-act], real metric tick-up on [data-sc-count],
 *   clip-path wipes on [data-sc-reveal], and fine-pointer --sc-mx/--sc-my refraction.
 * - Zero React re-renders during scroll; respects prefers-reduced-motion cleanly.
 */
export function ScrollMotionSystem() {
  const pathname = usePathname();
  const fallbackBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-sc-count]'));
    const parseCounterTarget = (el: HTMLElement) => {
      const raw = el.getAttribute('data-sc-count') || '0';
      const parts = raw.trim().split(/\s+/);
      const from = Number((parts[0] || '0').replace(/,/g, '')) || 0;
      const toStr = parts[1] ?? parts[0] ?? '0';
      const to = Number(toStr.replace(/,/g, '')) || 0;
      const prefix = el.getAttribute('data-sc-prefix') || '';
      const suffix = el.getAttribute('data-sc-suffix') || '';
      return { from, to, prefix, suffix };
    };

    const setCounterFinal = (el: HTMLElement) => {
      const { to, prefix, suffix } = parseCounterTarget(el);
      el.textContent = `${prefix}${latnFormatter.format(to)}${suffix}`;
    };

    if (reduced) {
      document.documentElement.classList.remove('bosla-motion-ready');
      counters.forEach(setCounterFinal);
      return;
    }

    const supportsScrollTimeline =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timeline: scroll()');

    let rafBar = 0;
    const updateBar = () => {
      rafBar = 0;
      if (!fallbackBarRef.current || supportsScrollTimeline) return;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp01(window.scrollY / max);
      fallbackBarRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    document.documentElement.classList.add('bosla-motion-ready');

    // Reveal-once observer for .scroll-reveal-* and [data-sc-in]
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.scroll-reveal-up, .scroll-reveal-deep, .scroll-reveal-start, .scroll-reveal-end, .scroll-reveal-clip, .scroll-reveal-zoom, [data-sc-in]',
      ),
    );
    const vh = () => window.innerHeight || 900;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.removeAttribute('data-reveal');
            el.setAttribute('data-revealed', 'true');
            revealObserver.unobserve(el);
          }
        }
      },
      { rootMargin: '80px 0px -16px 0px', threshold: 0.02 },
    );

    const revealVisibleOrPassed = () => {
      const limit = vh() * 1.06;
      for (const el of revealTargets) {
        if (el.getAttribute('data-revealed') === 'true') continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= limit) {
          el.removeAttribute('data-reveal');
          el.setAttribute('data-revealed', 'true');
          revealObserver.unobserve(el);
        }
      }
    };

    const viewportLimit = vh() * 1.04;
    for (const el of revealTargets) {
      if (el.getAttribute('data-revealed') === 'true') continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= viewportLimit) {
        el.removeAttribute('data-reveal');
        el.setAttribute('data-revealed', 'true');
      } else {
        el.setAttribute('data-reveal', 'pending');
        revealObserver.observe(el);
      }
    }

    // One-shot animated real numbers (data-sc-count)
    const counterTimers: number[] = [];
    const countObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          if (el.getAttribute('data-sc-counted') === '1') continue;
          el.setAttribute('data-sc-counted', '1');
          countObserver.unobserve(el);

          const { from, to, prefix, suffix } = parseCounterTarget(el);
          const duration = Number(el.getAttribute('data-sc-count-ms')) || 1250;
          const startTs = performance.now();

          const step = (now: number) => {
            const t = clamp01((now - startTs) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = Math.round(from + (to - from) * eased);
            el.textContent = `${prefix}${latnFormatter.format(current)}${suffix}`;
            if (t < 1) {
              const id = window.requestAnimationFrame(step);
              counterTimers.push(id);
            }
          };
          const id = window.requestAnimationFrame(step);
          counterTimers.push(id);
        }
      },
      { threshold: 0.35 },
    );
    counters.forEach((c) => countObserver.observe(c));

    // Scroll-Craft [data-sc-act] --sc-p & parallax loop
    const acts = Array.from(document.querySelectorAll<HTMLElement>('[data-sc-act]'));
    let actRaf = 0;

    const updateActs = () => {
      actRaf = 0;
      const heightVh = vh();
      for (const act of acts) {
        const rect = act.getBoundingClientRect();
        const isPinned = act.getAttribute('data-sc-act') === 'pin';
        let p = 0;
        if (isPinned) {
          const travel = Math.max(1, act.offsetHeight - heightVh);
          p = clamp01(-rect.top / travel);
        } else {
          const span = Math.max(1, act.offsetHeight + heightVh);
          p = clamp01((heightVh - rect.top) / span);
        }
        act.style.setProperty('--sc-p', p.toFixed(4));
        act.dispatchEvent(new CustomEvent('sc:progress', { detail: { p } }));

        const parallaxEls = act.querySelectorAll<HTMLElement>('[data-sc-parallax]');
        parallaxEls.forEach((pEl) => {
          const rate = Number(pEl.getAttribute('data-sc-parallax')) || 0;
          const dy = rate * (p - 0.5) * 100;
          pEl.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0)`;
        });
      }
    };

    const onScroll = () => {
      revealVisibleOrPassed();
      if (!rafBar && !supportsScrollTimeline) {
        rafBar = window.requestAnimationFrame(updateBar);
      }
      if (!actRaf && acts.length > 0) {
        actRaf = window.requestAnimationFrame(updateActs);
      }
    };

    // Fine-pointer spotlight tracking (zero re-render, pointer-fine only)
    const spotlights = Array.from(document.querySelectorAll<HTMLElement>('[data-sc-spotlight]'));
    const pointerCleanups: Array<() => void> = [];
    if (finePointer) {
      spotlights.forEach((el) => {
        const onMove = (e: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const mx = clamp01((e.clientX - rect.left) / rect.width);
          const my = clamp01((e.clientY - rect.top) / rect.height);
          el.style.setProperty('--sc-mx', mx.toFixed(3));
          el.style.setProperty('--sc-my', my.toFixed(3));
        };
        el.addEventListener('pointermove', onMove, { passive: true });
        pointerCleanups.push(() => el.removeEventListener('pointermove', onMove));
      });
    }

    updateBar();
    updateActs();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('hashchange', onScroll);
    document.addEventListener('focusin', onScroll);

    return () => {
      revealObserver.disconnect();
      countObserver.disconnect();
      counterTimers.forEach((id) => window.cancelAnimationFrame(id));
      pointerCleanups.forEach((fn) => fn());
      if (rafBar) window.cancelAnimationFrame(rafBar);
      if (actRaf) window.cancelAnimationFrame(actRaf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onScroll);
      document.removeEventListener('focusin', onScroll);
    };
  }, [pathname]);

  return (
    <>
      <div aria-hidden="true" className="bosla-grain-layer" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2.5px] overflow-hidden bg-transparent"
      >
        <div
          ref={fallbackBarRef}
          className="scroll-progress-bar h-full w-full bg-[#7C95FF]"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </>
  );
}
