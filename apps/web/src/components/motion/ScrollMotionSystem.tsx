'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Top viewport scroll progress bar + single-pass reveal-once IntersectionObserver.
 * Respects `prefers-reduced-motion: reduce`, leaves initial fold immediately visible,
 * and never re-hides elements once revealed.
 */
export function ScrollMotionSystem() {
  const pathname = usePathname();
  const fallbackBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      document.documentElement.classList.remove('bosla-motion-ready');
      return;
    }

    const supportsScrollTimeline =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timeline: scroll()');

    let cleanupScroll: (() => void) | undefined;
    if (!supportsScrollTimeline && fallbackBarRef.current) {
      const bar = fallbackBarRef.current;
      let raf = 0;
      const updateBar = () => {
        raf = 0;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        bar.style.transform = `scaleX(${progress.toFixed(4)})`;
      };
      const onScroll = () => {
        if (!raf) raf = window.requestAnimationFrame(updateBar);
      };
      updateBar();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      cleanupScroll = () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        if (raf) window.cancelAnimationFrame(raf);
      };
    }

    document.documentElement.classList.add('bosla-motion-ready');

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.scroll-reveal-up, .scroll-reveal-deep, .scroll-reveal-start, .scroll-reveal-end, .scroll-reveal-clip, .scroll-reveal-zoom',
      ),
    );

    const vh = () => window.innerHeight || 900;

    const revealVisibleOrPassed = () => {
      const limit = vh() * 1.06;
      for (const el of targets) {
        if (el.getAttribute('data-revealed') === 'true') continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= limit) {
          el.removeAttribute('data-reveal');
          el.setAttribute('data-revealed', 'true');
          observer.unobserve(el);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.removeAttribute('data-reveal');
            el.setAttribute('data-revealed', 'true');
            observer.unobserve(el);
          }
        }
      },
      { rootMargin: '80px 0px -16px 0px', threshold: 0.02 },
    );

    const viewportLimit = vh() * 1.04;
    for (const el of targets) {
      if (el.getAttribute('data-revealed') === 'true') continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= viewportLimit) {
        el.removeAttribute('data-reveal');
        el.setAttribute('data-revealed', 'true');
      } else {
        el.setAttribute('data-reveal', 'pending');
        observer.observe(el);
      }
    }

    const onScrollSync = () => revealVisibleOrPassed();
    window.addEventListener('scroll', onScrollSync, { passive: true });
    window.addEventListener('hashchange', onScrollSync);
    document.addEventListener('focusin', onScrollSync);

    return () => {
      cleanupScroll?.();
      observer.disconnect();
      window.removeEventListener('scroll', onScrollSync);
      window.removeEventListener('hashchange', onScrollSync);
      document.removeEventListener('focusin', onScrollSync);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2.5px] overflow-hidden bg-transparent"
    >
      <div
        ref={fallbackBarRef}
        className="scroll-progress-bar h-full w-full origin-right bg-gradient-to-l from-[#7C95FF] via-[#8CA2FF] to-[#B4C4FF]"
      />
    </div>
  );
}
