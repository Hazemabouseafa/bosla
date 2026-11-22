'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type MonolithViewPreset = 'perspective' | 'front' | 'profile';

/**
 * Interactive real-time WebGL Three.js sculpture reproducing BOSLA Academy's
 * ascending three-column spire and geometric B facet geometry in cobalt-obsidian
 * and brushed champagne brass with calibrated architectural gimbal rings.
 *
 * Interaction & Safeguards:
 * - Supports horizontal/vertical pointer-drag inspection on fine-pointer desktops.
 * - Switches smoothly across explicit viewport presets (perspective, front, profile).
 * - Automatically bypassed on reduced-motion, in-page pause, saveData, WebGL failure, or <768px screens.
 * - Full geometry, material, canvas & listener disposal on unmount.
 */
export function BoslaMonolithCanvas({
  motionPaused,
  viewPreset = 'perspective',
}: {
  motionPaused: boolean;
  viewPreset?: MonolithViewPreset;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const presetRef = useRef<MonolithViewPreset>(viewPreset);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    presetRef.current = viewPreset;
  }, [viewPreset]);

  useEffect(() => {
    const container = hostRef.current;
    if (!container || motionPaused) {
      setReady(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const isReducedOs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isCompactViewport = window.innerWidth < 768;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
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
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      27,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      40,
    );
    camera.position.set(0, 0.15, 8.8);
    camera.lookAt(0, 0.15, 0);

    // Architectural studio lighting matching deep obsidian + amber beam + sapphire fill
    scene.add(new THREE.AmbientLight('#8CA2FF', 0.55));

    const keyLight = new THREE.DirectionalLight('#F5B94A', 2.4);
    keyLight.position.set(-3.6, 4.2, 4.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#7C95FF', 2.1);
    rimLight.position.set(3.8, 1.5, -2.5);
    scene.add(rimLight);

    const bottomFill = new THREE.DirectionalLight('#22307A', 1.15);
    bottomFill.position.set(0, -3.5, 2.5);
    scene.add(bottomFill);

    const monument = new THREE.Group();
    scene.add(monument);

    const cobaltBodyMat = new THREE.MeshStandardMaterial({
      color: '#0E1A54',
      roughness: 0.28,
      metalness: 0.62,
    });

    const obsidianShaftMat = new THREE.MeshStandardMaterial({
      color: '#081036',
      roughness: 0.24,
      metalness: 0.74,
    });

    const brassInlayMat = new THREE.MeshStandardMaterial({
      color: '#F5B94A',
      roughness: 0.26,
      metalness: 0.88,
    });

    // Build authentic ExtrudeGeometry echoing BOSLA upward arrow prism silhouette
    const spireShape = new THREE.Shape();
    spireShape.moveTo(0, 1.95);
    spireShape.lineTo(0.46, 1.2);
    spireShape.lineTo(0.2, 1.2);
    spireShape.lineTo(0.2, -1.35);
    spireShape.lineTo(0, -1.52);
    spireShape.lineTo(-0.2, -1.35);
    spireShape.lineTo(-0.2, 1.2);
    spireShape.lineTo(-0.46, 1.2);
    spireShape.closePath();

    const spireGeo = new THREE.ExtrudeGeometry(spireShape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 2,
    });
    spireGeo.translate(0, 0, -0.19);
    const spireMesh = new THREE.Mesh(spireGeo, obsidianShaftMat);
    monument.add(spireMesh);

    // Center brass meridian inlay bar
    const brassBarGeo = new THREE.BoxGeometry(0.055, 2.55, 0.44);
    const brassBar = new THREE.Mesh(brassBarGeo, brassInlayMat);
    brassBar.position.set(0, -0.05, 0);
    monument.add(brassBar);

    // Left stabilizing bevel column (BOSLA monogram vertical pillar)
    const colShape = new THREE.Shape();
    colShape.moveTo(-0.78, -1.1);
    colShape.lineTo(-0.42, -1.34);
    colShape.lineTo(-0.42, 0.95);
    colShape.lineTo(-0.78, 0.68);
    colShape.closePath();

    const colGeo = new THREE.ExtrudeGeometry(colShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    colGeo.translate(0, 0, -0.17);
    const leftPillar = new THREE.Mesh(colGeo, cobaltBodyMat);
    monument.add(leftPillar);

    // Right geometric "B" wings extruded cohesively
    const bShape = new THREE.Shape();
    bShape.moveTo(0.38, 0.95);
    bShape.lineTo(0.95, 0.56);
    bShape.lineTo(0.95, 0.08);
    bShape.lineTo(0.56, -0.08);
    bShape.lineTo(0.95, -0.26);
    bShape.lineTo(0.95, -0.92);
    bShape.lineTo(0.38, -1.32);
    bShape.lineTo(0.38, -0.95);
    bShape.lineTo(0.7, -0.74);
    bShape.lineTo(0.7, -0.34);
    bShape.lineTo(0.38, -0.18);
    bShape.lineTo(0.38, 0.02);
    bShape.lineTo(0.7, 0.16);
    bShape.lineTo(0.7, 0.48);
    bShape.lineTo(0.38, 0.68);
    bShape.closePath();

    const bGeo = new THREE.ExtrudeGeometry(bShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    bGeo.translate(0, 0, -0.17);
    const rightWing = new THREE.Mesh(bGeo, cobaltBodyMat);
    monument.add(rightWing);

    // Calibrated equatorial & meridian brass/sapphire gimbal rings
    const ringOuterGeo = new THREE.TorusGeometry(2.15, 0.012, 8, 96);
    const ringOuterMat = new THREE.MeshBasicMaterial({
      color: '#7C95FF',
      transparent: true,
      opacity: 0.28,
    });
    const ringOuter = new THREE.Mesh(ringOuterGeo, ringOuterMat);
    ringOuter.rotation.x = Math.PI / 2.25;
    scene.add(ringOuter);

    const ringInnerGeo = new THREE.TorusGeometry(1.78, 0.011, 8, 84);
    const ringInnerMat = new THREE.MeshBasicMaterial({
      color: '#F5B94A',
      transparent: true,
      opacity: 0.36,
    });
    const ringInner = new THREE.Mesh(ringInnerGeo, ringInnerMat);
    ringInner.rotation.y = Math.PI / 3;
    scene.add(ringInner);

    let rafId = 0;
    let isVisible = true;
    let isContextLost = false;
    let dragging = false;
    let lastPtrX = 0;
    let lastPtrY = 0;
    let manualYaw = 0;
    let manualPitch = 0;
    let pointerHoverX = 0;
    let pointerHoverY = 0;
    let currentRotY = -0.32;
    let currentRotX = 0.08;
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

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMoveCanvas = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPtrX;
      const dy = e.clientY - lastPtrY;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      manualYaw = Math.max(-1.6, Math.min(1.6, manualYaw + dx * 0.008));
      manualPitch = Math.max(-0.55, Math.min(0.55, manualPitch + dy * 0.006));
    };

    const onPointerUpCanvas = (e: PointerEvent) => {
      dragging = false;
      canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || dragging) return;
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      pointerHoverX = nx * 0.22;
      pointerHoverY = ny * 0.09;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = Boolean(entries[0]?.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
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

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMoveCanvas);
    canvas.addEventListener('pointerup', onPointerUpCanvas);
    canvas.addEventListener('pointercancel', onPointerUpCanvas);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('resize', syncSize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let firstFrame = false;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (!isVisible || document.hidden || isContextLost || !renderer) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const baseYaw =
        presetRef.current === 'front'
          ? 0.04
          : presetRef.current === 'profile'
            ? 0.72
            : -0.34;
      const basePitch =
        presetRef.current === 'front'
          ? 0.02
          : presetRef.current === 'profile'
            ? -0.06
            : 0.1;

      const scrollOffset = Math.min(1, window.scrollY / Math.max(600, window.innerHeight)) * 0.26;
      const targetY = baseYaw + manualYaw + pointerHoverX + scrollOffset;
      const targetX = basePitch + manualPitch - pointerHoverY;

      const alpha = 1 - Math.exp(-dt * 5.2);
      currentRotY += (targetY - currentRotY) * alpha;
      currentRotX += (targetX - currentRotX) * alpha;

      monument.rotation.y = currentRotY;
      monument.rotation.x = currentRotX;
      monument.position.y = Math.sin(now * 0.0008) * 0.045;

      ringOuter.rotation.z += dt * 0.12;
      ringInner.rotation.x += dt * 0.09;

      renderer.render(scene, camera);
      if (!firstFrame) {
        firstFrame = true;
        setReady(true);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMoveCanvas);
      canvas.removeEventListener('pointerup', onPointerUpCanvas);
      canvas.removeEventListener('pointercancel', onPointerUpCanvas);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('resize', syncSize);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
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
      className={`absolute inset-0 transition-opacity duration-500 ${
        ready && !motionPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    />
  );
}
