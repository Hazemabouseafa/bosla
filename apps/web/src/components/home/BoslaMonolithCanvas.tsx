'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Isolated, performance-budgeted architectural Three.js monolith sculpture
 * echoing the official BOSLA ascending geometric spire mark.
 *
 * Safeguards:
 * - Static imagery & DOM paint immediately behind it (never blocks LCP or typography).
 * - Skipped on reduced-motion, in-page motion pause, saveData, WebGL unavailability, or narrow viewports (<768px).
 * - Paused via IntersectionObserver & visibilitychange when offscreen or backgrounded.
 * - Full geometry, material, event listener & WebGLRenderer disposal on unmount.
 */
export function BoslaMonolithCanvas({ motionPaused }: { motionPaused: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = hostRef.current;
    if (!container || motionPaused) {
      setReady(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const isReducedOs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isCompactViewport = window.innerWidth < 768;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (isReducedOs || isCompactViewport || saveData) {
      setReady(false);
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setReady(false);
      return;
    }

    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      26,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      40,
    );
    camera.position.set(0.12, 0.25, 8.6);
    camera.lookAt(0, 0.2, 0);

    // Three-point architectural lighting matching dark obsidian slate + brushed brass image bible
    const ambient = new THREE.AmbientLight('#8CA2FF', 0.45);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#F5B94A', 2.1);
    keyLight.position.set(-3.2, 3.8, 3.6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#7C95FF', 1.85);
    rimLight.position.set(3.6, 1.4, -2.2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight('#22307A', 0.9);
    fillLight.position.set(0, -3.5, 2.5);
    scene.add(fillLight);

    // Architectural sculpture group mirroring BOSLA upward facet silhouette
    const monument = new THREE.Group();
    scene.add(monument);

    const slateMat = new THREE.MeshStandardMaterial({
      color: '#0D184D',
      roughness: 0.34,
      metalness: 0.58,
    });

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: '#09123B',
      roughness: 0.28,
      metalness: 0.72,
    });

    const brassEdgeMat = new THREE.MeshStandardMaterial({
      color: '#E5AA3E',
      roughness: 0.32,
      metalness: 0.85,
    });

    // Left stabilizing column slab
    const leftGeo = new THREE.BoxGeometry(0.42, 2.15, 0.48);
    const leftCol = new THREE.Mesh(leftGeo, slateMat);
    leftCol.position.set(-0.62, -0.22, -0.1);
    leftCol.rotation.y = 0.22;
    monument.add(leftCol);

    // Central ascending monolith shaft + pyramid apex spire
    const centerGeo = new THREE.BoxGeometry(0.5, 2.75, 0.54);
    const centerCol = new THREE.Mesh(centerGeo, obsidianMat);
    centerCol.position.set(0, -0.05, 0.14);
    monument.add(centerCol);

    const apexGeo = new THREE.ConeGeometry(0.52, 0.95, 4);
    const apexMesh = new THREE.Mesh(apexGeo, slateMat);
    apexMesh.position.set(0, 1.78, 0.14);
    apexMesh.rotation.y = Math.PI / 4;
    monument.add(apexMesh);

    // Brass precision meridian fillet embedded on center shaft
    const filletGeo = new THREE.BoxGeometry(0.06, 2.4, 0.58);
    const filletMesh = new THREE.Mesh(filletGeo, brassEdgeMat);
    filletMesh.position.set(0.24, 0.08, 0.14);
    monument.add(filletMesh);

    // Right stepped structural shoulders (minimalist geometric B echo)
    const upperStepGeo = new THREE.BoxGeometry(0.56, 0.88, 0.44);
    const upperStep = new THREE.Mesh(upperStepGeo, slateMat);
    upperStep.position.set(0.66, 0.45, -0.06);
    upperStep.rotation.z = -0.18;
    monument.add(upperStep);

    const lowerStepGeo = new THREE.BoxGeometry(0.62, 0.98, 0.44);
    const lowerStep = new THREE.Mesh(lowerStepGeo, obsidianMat);
    lowerStep.position.set(0.68, -0.62, -0.14);
    lowerStep.rotation.z = 0.16;
    monument.add(lowerStep);

    // Wireframe architectural measurement cage (very subtle hairlines, zero neon)
    const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.45, 3.65, 1.45));
    const cageMat = new THREE.LineBasicMaterial({
      color: '#7C95FF',
      transparent: true,
      opacity: 0.14,
    });
    const cageLines = new THREE.LineSegments(cageGeo, cageMat);
    cageLines.position.set(0.05, 0.18, -0.15);
    monument.add(cageLines);

    let rafId = 0;
    let isVisible = true;
    let isContextLost = false;
    let pointerX = 0;
    let pointerY = 0;
    let currentRotY = -0.34;
    let currentRotX = 0.1;
    let lastTime = performance.now();

    const syncSize = () => {
      if (!renderer || !container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    syncSize();

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      pointerX = nx * 0.24;
      pointerY = ny * 0.1;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = Boolean(entries[0]?.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    const onVisibilityChange = () => {
      if (document.hidden) isVisible = false;
      else isVisible = true;
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      setReady(false);
    };

    const onContextRestored = () => {
      isContextLost = false;
      setReady(true);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', syncSize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let firstFrameDrawn = false;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (!isVisible || document.hidden || isContextLost || !renderer) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const scrollFactor = Math.min(1, window.scrollY / Math.max(600, window.innerHeight));
      const targetRotY = -0.34 + pointerX + scrollFactor * 0.42;
      const targetRotX = 0.08 - pointerY - scrollFactor * 0.14;

      const alpha = 1 - Math.exp(-dt * 4.5);
      currentRotY += (targetRotY - currentRotY) * alpha;
      currentRotX += (targetRotX - currentRotX) * alpha;

      monument.rotation.y = currentRotY;
      monument.rotation.x = currentRotX;
      monument.position.y = Math.sin(now * 0.00075) * 0.055;

      renderer.render(scene, camera);
      if (!firstFrameDrawn) {
        firstFrameDrawn = true;
        setReady(true);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', syncSize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer?.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [motionPaused]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
        ready && !motionPaused ? 'opacity-90' : 'opacity-0'
      }`}
    />
  );
}
