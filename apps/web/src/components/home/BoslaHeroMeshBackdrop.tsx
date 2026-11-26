'use client';

import React, { Component, useEffect, useRef, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

const MESH_PALETTE_COLORS = [
  '#ADD5F0',
  '#87BFE8',
  '#C6E2F5',
  '#FFFFFF',
  '#7046C8',
  '#ADD5F0',
];

class ShaderErrorBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Single animated MeshGradient hero background powered by @paper-design/shaders-react.
 * Renders an immediate CSS fallback on frame 0, probes WebGL2 safely, pauses outside
 * viewport or on hidden tabs, clamps resolution for mobile performance, and disables
 * decorative WebGL motion when Reduced Motion is enabled.
 */
export function BoslaHeroMeshBackdrop({
  motionPaused,
}: {
  motionPaused: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || motionPaused) return;
    const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (osReduced) return;

    let supported = false;
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2', {
        powerPreference: 'low-power',
        antialias: false,
        depth: false,
        stencil: false,
      });
      supported = Boolean(gl);
      if (gl && 'getExtension' in gl) {
        const loseCtx = gl.getExtension('WEBGL_lose_context');
        loseCtx?.loseContext();
      }
    } catch {
      supported = false;
    }

    if (supported) {
      setWebglReady(true);
      setIsMobileViewport(window.innerWidth < 768);
    } else {
      setWebglFailed(true);
    }
  }, [motionPaused]);

  useEffect(() => {
    if (typeof window === 'undefined' || !rootRef.current) return;
    const el = rootRef.current;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setInViewport(entry.isIntersecting);
        }
      },
      { threshold: 0.01 },
    );
    io.observe(el);

    const onVisibilityChange = () => {
      setTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const canRenderShader = webglReady && !webglFailed && !motionPaused;
  const activeSpeed = canRenderShader && inViewport && tabVisible ? 0.12 : 0;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-testid="hero-mesh-backdrop"
      data-shader-active={canRenderShader ? 'true' : 'false'}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none bosla-hero-mesh-fallback"
    >
      {canRenderShader && (
        <ShaderErrorBoundary onError={() => setWebglFailed(true)}>
          <div
            className="absolute inset-0 opacity-75 transition-opacity duration-500"
            style={{ width: '100%', height: '100%' }}
          >
            <MeshGradient
              colors={MESH_PALETTE_COLORS}
              distortion={0.4}
              swirl={0.22}
              grainMixer={0}
              grainOverlay={0}
              speed={activeSpeed}
              minPixelRatio={1}
              maxPixelCount={isMobileViewport ? 960 * 640 : 1440 * 900}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </ShaderErrorBoundary>
      )}

      {/* Calm readability zone behind central headings & seamless bottom blend into next band */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 76% 48% at 50% 27%, rgba(198, 226, 245, 0.78) 0%, rgba(173, 213, 240, 0.36) 62%, transparent 100%),
            linear-gradient(180deg, rgba(173, 213, 240, 0.22) 0%, rgba(173, 213, 240, 0.14) 45%, transparent 76%, var(--bosla-color-blue-primary, #ADD5F0) 100%)
          `,
        }}
      />
    </div>
  );
}
