// Isolated BOSLA Motion Prototype Choreography (GSAP 3.13 + Selective Lazy Three.js)
// Preserves full semantic readability under slow networks, mobile screens, and prefers-reduced-motion.

const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const isMobile = () => window.innerWidth <= 768;
const saveData = Boolean(navigator.connection?.saveData);

const toastEl = document.getElementById('route-toast');
document.querySelectorAll('[data-portal-link]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    // Prevent dead 404 inside standalone design/prototype server while keeping true href semantics
    event.preventDefault();
    const targetRoute = anchor.getAttribute('data-portal-link') || '/register';
    if (!toastEl) return;
    toastEl.textContent = `بوابة بوصلة الفعلية (${targetRoute}) محفوظة للعمل كما هي على الخادم الرئيسي دون تعديل في هذا النموذج التفاعلي.`;
    toastEl.classList.add('is-open');
    window.clearTimeout(window.__boslaToastTimer);
    window.__boslaToastTimer = window.setTimeout(() => toastEl.classList.remove('is-open'), 4500);
  });
});

// Deterministic runtime telemetry collector for measurement transparency
window.__boslaProtoState = {
  reducedMotion: prefersReducedMotion,
  gsapLoaded: Boolean(window.gsap && window.ScrollTrigger),
  heroTimelineReady: false,
  threeStatus: 'not-loaded',
  irisProgress: 0,
};

function setupMotion() {
  if (!window.gsap || !window.ScrollTrigger || prefersReducedMotion) {
    // Reduced motion or no GSAP: reveal laboratory scene statically and keep crisp readability
    if (prefersReducedMotion) {
      const labCopy = document.querySelector('.layer-lab-copy');
      if (labCopy) {
        labCopy.style.opacity = '1';
        labCopy.style.visibility = 'visible';
      }
      window.__boslaProtoState.heroTimelineReady = true;
    }
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // One-time subtle entrance only on hero sub-elements (H1 lines remain readable immediately without zero flash)
  document.fonts?.ready?.then(() => {
    const heroSub = document.querySelector('.hero-sub');
    const heroCtas = document.querySelector('.hero-cta-row');
    if (heroSub && heroCtas && window.scrollY < 40) {
      gsap.from([heroSub, heroCtas], {
        y: 12,
        opacity: 0.72,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }
  });

  // Main Signature Choreography: Hero Multi-Plane Depth -> Calibration Aperture Iris -> Lab Core
  const stageRoot = document.querySelector('.stage-viewport');
  const complexLayer = document.querySelector('.layer-hero-complex');
  const gantryLayer = document.querySelector('.layer-foreground-gantry');
  const heroCopy = document.querySelector('.layer-hero-copy');
  const labReveal = document.querySelector('.layer-lab-reveal');
  const labCopy = document.querySelector('.layer-lab-copy');
  const reticleOuter = document.getElementById('reticle-ring-outer');
  const reticleInner = document.getElementById('reticle-ring-inner');
  const reticleTicks = document.getElementById('reticle-ticks');
  const reticleCore = document.getElementById('reticle-core');
  const reticleGroup = document.getElementById('reticle-group');

  const syncReticleOrigin = () => {
    if (!reticleGroup) return;
    if (isMobile()) {
      reticleGroup.setAttribute('transform', 'translate(720, 504)');
    } else {
      reticleGroup.setAttribute('transform', 'translate(590, 513)');
    }
  };
  syncReticleOrigin();
  window.addEventListener('resize', syncReticleOrigin, { passive: true });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#hero-stage',
      start: 'top top',
      end: () => (isMobile() ? '+=185%' : '+=220%'),
      pin: '.stage-viewport',
      scrub: 0.85,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        window.__boslaProtoState.irisProgress = Number(self.progress.toFixed(3));
      },
    },
  });

  // 0.0 -> 0.42: Multi-plane parallax separation & horizon approach
  tl.to(complexLayer, { scale: 1.15, yPercent: -4, ease: 'none', duration: 0.45 }, 0)
    .to(gantryLayer, { yPercent: -48, ease: 'none', duration: 0.42 }, 0)
    .to(heroCopy, { y: -64, autoAlpha: 0, ease: 'power2.in', duration: 0.24 }, 0.1)
    // 0.04 -> 0.44: SVG Calibration Reticle Dot & Stroke-Dashoffset Draw-On
    .to(reticleCore, { opacity: 0.95, duration: 0.08 }, 0.04)
    .to(reticleInner, { strokeDashoffset: 0, rotation: 90, transformOrigin: 'center', ease: 'power2.out', duration: 0.3 }, 0.08)
    .to(reticleOuter, { strokeDashoffset: 0, rotation: -65, transformOrigin: 'center', ease: 'power2.out', duration: 0.34 }, 0.12)
    .to(reticleTicks, { opacity: 0.92, duration: 0.16 }, 0.2)
    // 0.24 -> 0.68: Signature Clip-Path Aperture Expand into Diagnostic Lab Core
    .to(labReveal, { '--iris-r': '135%', ease: 'power2.inOut', duration: 0.44 }, 0.24)
    .to([reticleOuter, reticleInner, reticleTicks, reticleCore], { opacity: 0, scale: 1.35, duration: 0.18 }, 0.48)
    // 0.40 -> 0.56: Scene 2 Diagnostic Copy Arrives Crisply BEFORE Crossing Plateau
    .fromTo(
      labCopy,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, ease: 'power3.out', duration: 0.16 },
      0.4,
    )
    .to(labCopy, { duration: 0.44 }, 0.56); // Full contrast readability hold across iris completion

  // Deterministic preview seek hook (?t=0..1 normalized progress)
  const seekParam = new URLSearchParams(window.location.search).get('p');
  if (seekParam !== null) {
    const targetP = Math.max(0, Math.min(1, parseFloat(seekParam) || 0));
    window.setTimeout(() => {
      const st = tl.scrollTrigger;
      if (st) {
        const y = st.start + (st.end - st.start) * targetP;
        window.scrollTo(0, y);
        ScrollTrigger.update();
      }
    }, 350);
  }

  // ACT 3: Subtle Poultry Hall Background Parallax + Batch Pillar Stagger Reveal
  gsap.to('.fields-bg-media', {
    yPercent: 14,
    ease: 'none',
    scrollTrigger: {
      trigger: '.section-fields',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });

  gsap.set('.field-pillar', { autoAlpha: 0, y: 22 });
  ScrollTrigger.batch('.field-pillar', {
    start: 'top 86%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: 0.62,
        stagger: 0.08,
        ease: 'power2.out',
        overwrite: true,
      }),
  });

  // ACT 4: Quiet Thesis Reveal
  gsap.from('.thesis-frame', {
    autoAlpha: 0,
    y: 18,
    duration: 0.7,
    ease: 'power2.out',
    scrollTrigger: { trigger: '.section-thesis', start: 'top 78%', once: true },
  });

  // ACT 5 Preview: Progression Cards Reveal
  gsap.set('.stage-card', { autoAlpha: 0, y: 20 });
  ScrollTrigger.batch('.stage-card', {
    start: 'top 86%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: 0.58,
        stagger: 0.1,
        ease: 'power2.out',
      }),
  });

  window.__boslaMasterTimeline = tl;
  window.__boslaProtoState.heroTimelineReady = true;
}

// Selective Lazy Three.js Scene in Act 5 Preview Only (Desktop + Fine Pointer + !saveData + !reducedMotion)
function setupSelectiveThreeLazy() {
  const host = document.getElementById('three-elevation-host');
  const section = document.getElementById('scene-peak-preview');
  if (!host || !section) return;

  if (prefersReducedMotion || saveData || isMobile()) {
    window.__boslaProtoState.threeStatus = 'skipped-by-budget';
    return;
  }

  let started = false;
  let active = false;
  let rafId = 0;
  let renderer;
  let resumeLoop = null;

  const observer = new IntersectionObserver(
    async (entries) => {
      const entry = entries[0];
      if (!entry) return;
      active = entry.isIntersecting;

      if (!started && entry.isIntersecting) {
        started = true;
        window.__boslaProtoState.threeStatus = 'loading';
        try {
          const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js');
          const scene = new THREE.Scene();
          const width = host.clientWidth || 1200;
          const height = host.clientHeight || 540;
          const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
          camera.position.set(0, 3.6, 8.5);
          camera.lookAt(0, 0, 0);

          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.setSize(width, height);
          host.appendChild(renderer.domElement);

          // Precision Wireframe Elevation Lattice reflecting BOSLA compass topography
          const planeGeo = new THREE.PlaneGeometry(14, 7, 28, 14);
          const pos = planeGeo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const elev = Math.exp(-(x * x) * 0.08) * 1.15 * Math.cos(y * 0.45);
            pos.setZ(i, elev);
          }
          planeGeo.rotateX(-Math.PI * 0.48);

          const wireMat = new THREE.MeshBasicMaterial({
            color: 0x7c95ff,
            wireframe: true,
            transparent: true,
            opacity: 0.28,
          });
          const terrainMesh = new THREE.Mesh(planeGeo, wireMat);
          scene.add(terrainMesh);

          const ro = new ResizeObserver(() => {
            if (!renderer || !host.clientWidth || !host.clientHeight) return;
            camera.aspect = host.clientWidth / host.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(host.clientWidth, host.clientHeight);
          });
          ro.observe(host);

          window.__boslaProtoState.threeStatus = 'active';
          let angle = 0;

          const tick = () => {
            if (!active || document.hidden) {
              rafId = 0;
              return;
            }
            angle += 0.0022;
            terrainMesh.rotation.y = Math.sin(angle) * 0.14;
            renderer.render(scene, camera);
            rafId = window.requestAnimationFrame(tick);
          };

          resumeLoop = () => {
            if (active && !document.hidden && !rafId) {
              window.__boslaProtoState.threeStatus = 'active';
              rafId = window.requestAnimationFrame(tick);
            }
          };

          document.addEventListener('visibilitychange', () => {
            if (resumeLoop) resumeLoop();
          });
          rafId = window.requestAnimationFrame(tick);
        } catch (err) {
          window.__boslaProtoState.threeStatus = 'fallback-svg';
        }
      } else if (started && active && !rafId && resumeLoop) {
        resumeLoop();
      } else if (started && !active && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        window.__boslaProtoState.threeStatus = 'paused-offscreen';
      }
    },
    { rootMargin: '600px 0px' },
  );

  observer.observe(section);
}

setupMotion();
setupSelectiveThreeLazy();
