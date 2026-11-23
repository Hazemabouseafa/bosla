'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Selective progressive Three.js topographic wireframe elevation mesh mounted ONLY
 * inside the Peak ("من الطالب إلى المدير") stage on capable desktop viewports.
 * - Lazy-loaded via IntersectionObserver (`rootMargin: 600px`) with zero initial bundle bloat.
 * - Paused automatically when offscreen, tab-hidden, reduced-motion, or motionPaused.
 * - Bypassed cleanly on <= 768px mobile or Save-Data connections (falling back to static SVG wireframe).
 */
export function BoslaTopographyCanvas({
  motionPaused,
  observerTargetRef,
}: {
  motionPaused: boolean;
  observerTargetRef: React.RefObject<HTMLElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const section = observerTargetRef.current ?? host;
    if (!host || !section || motionPaused || typeof window === 'undefined') {
      return;
    }

    const reducedOs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const compactViewport = window.innerWidth <= 768;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    if (reducedOs || compactViewport || saveData) {
      return;
    }

    let disposed = false;
    let started = false;
    let active = false;
    let rafId = 0;
    let ro: ResizeObserver | null = null;
    let renderer: import('three').WebGLRenderer | null = null;
    let planeGeo: import('three').PlaneGeometry | null = null;
    let wireMat: import('three').MeshBasicMaterial | null = null;
    let resumeLoop: (() => void) | null = null;

    const handleVisibility = () => {
      if (resumeLoop) resumeLoop();
    };

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry || disposed) return;
        active = entry.isIntersecting;

        if (!started && entry.isIntersecting) {
          started = true;
          try {
            const THREE = await import('three');
            if (disposed || !hostRef.current) return;

            const scene = new THREE.Scene();
            const width = host.clientWidth || 1200;
            const height = host.clientHeight || 540;
            const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
            camera.position.set(0, 3.6, 8.5);
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({
              alpha: true,
              antialias: true,
              powerPreference: 'low-power',
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer.setSize(width, height);
            host.innerHTML = '';
            host.appendChild(renderer.domElement);

            planeGeo = new THREE.PlaneGeometry(14, 7, 28, 14);
            const pos = planeGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const elev = Math.exp(-(x * x) * 0.08) * 1.15 * Math.cos(y * 0.45);
              pos.setZ(i, elev);
            }
            planeGeo.rotateX(-Math.PI * 0.48);

            wireMat = new THREE.MeshBasicMaterial({
              color: 0xc084fc,
              wireframe: true,
              transparent: true,
              opacity: 0.34,
            });
            const terrainMesh = new THREE.Mesh(planeGeo, wireMat);
            scene.add(terrainMesh);

            ro = new ResizeObserver(() => {
              if (!renderer || !hostRef.current?.clientWidth || !hostRef.current?.clientHeight) return;
              camera.aspect = hostRef.current.clientWidth / hostRef.current.clientHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(hostRef.current.clientWidth, hostRef.current.clientHeight);
            });
            ro.observe(host);

            let angle = 0;
            const tick = () => {
              if (disposed || !active || document.hidden || !renderer) {
                rafId = 0;
                return;
              }
              angle += 0.0022;
              terrainMesh.rotation.y = Math.sin(angle) * 0.14;
              renderer.render(scene, camera);
              rafId = window.requestAnimationFrame(tick);
            };

            resumeLoop = () => {
              if (!disposed && active && !document.hidden && !rafId) {
                rafId = window.requestAnimationFrame(tick);
              }
            };

            document.addEventListener('visibilitychange', handleVisibility);
            if (active && !document.hidden) {
              rafId = window.requestAnimationFrame(tick);
            }
          } catch {
            // Static SVG wireframe beneath stays visible gracefully if WebGL fails
          }
        } else if (started && active && !rafId && resumeLoop) {
          resumeLoop();
        } else if (started && !active && rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(section);

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      ro?.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      planeGeo?.dispose();
      wireMat?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.remove();
      }
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
      }
    };
  }, [motionPaused, observerTargetRef]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] hidden opacity-65 md:block"
    />
  );
}
