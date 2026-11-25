'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDown,
  Award,
  Briefcase,
  Building2,
  Compass,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import {
  BoslaCoursesShowcase,
  type HomepageCoursesPayload,
} from './BoslaCoursesShowcase';
import { BoslaPartnerApplySection } from './BoslaPartnerApplySection';
import { BoslaPartnersSection } from './BoslaPartnersSection';
import { BoslaPricingSection } from './BoslaPricingSection';
import { BoslaTestimonialsSection } from './BoslaTestimonialsSection';
import { BoslaTopographyCanvas } from './BoslaTopographyCanvas';
import { BoslaTrainersMarquee } from './BoslaTrainersMarquee';
import { HomepageShell } from './HomepageShell';

export interface HomeIntroContent {
  titleAr?: string | null;
  sloganAr?: string | null;
  subtitleAr?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

const SECTOR_PILLARS = [
  {
    id: 'vet',
    index: '01',
    domainLine: 'الصحة الحيوية والوقاية',
    title: 'الطب البيطري والتشخيص الميداني',
    summary:
      'رصد العلامات المبكرة وضبط برامج الأمان الحيوي والتحصين لحماية استقرار القطيع.',
  },
  {
    id: 'production',
    index: '02',
    domainLine: 'هندسة بيئة العنبر',
    title: 'إنتاج الدواجن والثروة الحيوانية',
    summary:
      'ضبط التهوية والكثافات ومعدلات التحويل اليومي في مشروعات الإنتاج الحديثة.',
  },
  {
    id: 'nutrition',
    index: '03',
    domainLine: 'التوازن الغذائي والاقتصادي',
    title: 'تغذية الحيوان وصياغة العلائق',
    summary:
      'تقييم جودة الخامات وبناء التركيبة العلفية على أساس علمي يضبط التكلفة الفعلية.',
  },
  {
    id: 'agribusiness',
    index: '04',
    domainLine: 'القيادة وسلاسل السوق',
    title: 'الإدارة التجارية والأجريبيزنس',
    summary:
      'إعداد الكوادر الفنية لإدارة المبيعات التخصصية وعلاقات المزارع والمصانع باحترافية.',
  },
] as const;

const ELEVATION_STAGES = [
  {
    id: 'student',
    tag: 'المرحلة 01 · طالب الكلية',
    title: 'تجاوز الحفظ المنفصل قبل التخرج',
    summary:
      'ربط المقررات الأكاديمية في الطب البيطري والزراعة بمنطق التشغيل اليومي للمزرعة والمصنع.',
    isLeader: false,
  },
  {
    id: 'practitioner',
    tag: 'المرحلة 02 · الخريج والممارس',
    title: 'تحويل الملاحظة إلى بروتوكول',
    summary:
      'الانتقال من ردود الفعل الميدانية العاجلة إلى قراءة منهجية للمؤشرات والتعامل مع فرق التشغيل.',
    isLeader: false,
  },
  {
    id: 'leader',
    tag: 'المرحلة 03 · قائد المنشأة',
    title: 'توحيد لغة العلم والإدارة',
    summary:
      'بناء فرق متجانسة داخل المزارع والشركات تتحدث لغة تقنية وتجارية واحدة واضحة.',
    isLeader: true,
  },
] as const;

const REALITY_TENETS = [
  {
    title: 'تشخيص يسبق التدخل الدوائي',
    detail: 'بناء القرار الميداني على قراءة العينة والمؤشر الحيوي قبل تراكم التكلفة غير المبررة.',
  },
  {
    title: 'العلف كمعادلة تحويل اقتصادي',
    detail: 'فهم خامات العليقة ومعدلات التحويل كأرقام مباشرة تنعكس على كفاءة التشغيل.',
  },
  {
    title: 'لغة موحدة بين الميدان والإدارة',
    detail: 'ربط رؤية الطبيب البيطري ومهندس الإنتاج بفريق المبيعات والإدارة داخل منشأة واحدة.',
  },
] as const;

export function BoslaIntroHome({
  intro,
  coursesData,
  coursesFetchFailed = false,
  liveLayout,
  onSelectSectionInEditor,
}: {
  intro?: HomeIntroContent;
  coursesData: HomepageCoursesPayload | null;
  coursesFetchFailed?: boolean;
  liveLayout?: any;
  onSelectSectionInEditor?: (sectionKey: string) => void;
}) {
  const { user, requiresPasskeyEnrollment } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);

  const liveConfig = liveLayout?.layout ?? liveLayout?.config;
  const isSectionVisible = (key: string) => {
    if (key === 'pricing' && liveConfig?.pricing?.visible === false) return false;
    if (liveConfig?.[key] && typeof liveConfig[key] === 'object' && 'visible' in liveConfig[key]) {
      return liveConfig[key].visible !== false;
    }
    const secs: Array<{ key: string; visible: boolean }> = liveConfig?.sections ?? [];
    const found = secs.find((s) => s.key === key);
    return found ? found.visible !== false : true;
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const peakSectionRef = useRef<HTMLElement>(null);
  const reticleGroupRef = useRef<SVGGElement>(null);
  const scene2ImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq?.matches) {
      setMotionPaused(true);
    }
    const onMqChange = (e: MediaQueryListEvent) => setMotionPaused(e.matches);
    mq?.addEventListener?.('change', onMqChange);
    return () => mq?.removeEventListener?.('change', onMqChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-home-motion', motionPaused ? 'reduce' : 'full');
    return () => {
      document.documentElement.removeAttribute('data-home-motion');
    };
  }, [motionPaused]);

  // Warm Scene 2 after initial idle or first scroll so Scene 1 keeps strict LCP priority
  // while the circular iris never opens onto an undecoded frame.
  useEffect(() => {
    const warmScene2 = () => {
      const img = scene2ImgRef.current;
      if (!img) return;
      img.loading = 'eager';
      img.setAttribute('loading', 'eager');
      if (img.complete && img.naturalWidth > 0) {
        void img.decode().catch(() => {});
      } else {
        const handleLoad = () => {
          void img.decode().catch(() => {});
        };
        img.addEventListener('load', handleLoad, { once: true });
      }
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | null = null;
    let timerId: number | null = null;

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(warmScene2, { timeout: 900 });
    } else {
      timerId = window.setTimeout(warmScene2, 250);
    }

    window.addEventListener('scroll', warmScene2, { once: true, passive: true });

    return () => {
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      window.removeEventListener('scroll', warmScene2);
    };
  }, []);

  // Restored Living Threshold Choreography (GSAP 3.13 + ScrollTrigger)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

    if (prefersReduced) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let disposed = false;
    const syncReticleOrigin = () => {
      const group = reticleGroupRef.current;
      if (!group) return;
      if (window.innerWidth <= 820) {
        group.setAttribute('transform', 'translate(720, 666)');
      } else {
        group.setAttribute('transform', 'translate(504, 522)');
      }
    };

    syncReticleOrigin();
    window.addEventListener('resize', syncReticleOrigin, { passive: true });

    const ctx = gsap.context(() => {
      const compactViewport = window.innerWidth < 1024;
      const isDesktop = window.innerWidth >= 768;

      // ACT 1 & ACT 2: Pinned Hero Stage -> Signature Calibration Reticle & Aperture Iris -> Scene 2
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#hero-stage',
          start: 'top top',
          end: () => (window.innerWidth < 1024 ? '+=145%' : '+=185%'),
          pin: '.bosla-threshold-stage',
          scrub: compactViewport ? 0.65 : 0.85,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      tl.to(
        '.bosla-threshold-complex',
        { scale: compactViewport ? 1.04 : 1.07, yPercent: -3, ease: 'none', duration: 0.42 },
        0,
      )
        .to('.bosla-threshold-gantry', { yPercent: -44, ease: 'none', duration: 0.4 }, 0)
        .to(
          '.bosla-threshold-hero-copy',
          { y: -48, autoAlpha: 0, ease: 'power2.in', duration: 0.24 },
          0.08,
        )
        .to('#reticle-core', { opacity: 0.95, duration: 0.08 }, 0.04)
        .to(
          '#reticle-ring-inner',
          {
            strokeDashoffset: 0,
            rotation: 90,
            transformOrigin: 'center',
            ease: 'power2.out',
            duration: 0.28,
          },
          0.08,
        )
        .to(
          '#reticle-ring-outer',
          {
            strokeDashoffset: 0,
            rotation: -65,
            transformOrigin: 'center',
            ease: 'power2.out',
            duration: 0.32,
          },
          0.12,
        )
        .to('#reticle-ticks', { opacity: 0.92, duration: 0.16 }, 0.2)
        .to(
          '.bosla-threshold-lab',
          { '--iris-r': '135%', ease: 'power2.inOut', duration: 0.42 },
          0.22,
        )
        .to(
          ['#reticle-ring-outer', '#reticle-ring-inner', '#reticle-ticks', '#reticle-core'],
          { opacity: 0, scale: 1.32, duration: 0.16 },
          0.46,
        )
        .fromTo(
          '.bosla-threshold-lab-copy',
          { autoAlpha: 0, y: 20 },
          { autoAlpha: 1, y: 0, ease: 'power3.out', duration: 0.16 },
          0.38,
        )
        .to('.bosla-threshold-lab-copy', { duration: 0.42 }, 0.56);

      // ACT 3: Bio-Hall Background Parallax (Desktop only) + Pillar Stagger Reveal
      if (isDesktop && document.querySelector('.bosla-fields-bg')) {
        gsap.fromTo(
          '.bosla-fields-bg',
          { yPercent: -6 },
          {
            yPercent: 10,
            ease: 'none',
            scrollTrigger: {
              trigger: '#methodology',
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      }

      ScrollTrigger.batch('.bosla-field-pillar', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 18, opacity: 0.25 },
            {
              y: 0,
              opacity: 1,
              duration: 0.56,
              stagger: 0.08,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            },
          ),
      });

      // ACT 4: Quiet Silence Thesis Reveal
      if (document.querySelector('.bosla-thesis-frame')) {
        gsap.fromTo(
          '.bosla-thesis-frame',
          { y: 16, opacity: 0.25 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger: '#thesis-band', start: 'top 80%', once: true },
          },
        );
      }

      // ACT 5: Peak Elevation Progression Cards Reveal
      ScrollTrigger.batch('.bosla-stage-card', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 18, opacity: 0.25 },
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              stagger: 0.09,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            },
          ),
      });

      // ACT 6: Course Cards Stagger Reveal
      if (document.querySelector('.bosla-course-reveal')) {
        ScrollTrigger.batch('.bosla-course-reveal', {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { y: 18, opacity: 0.25 },
              {
                y: 0,
                opacity: 1,
                duration: 0.54,
                stagger: 0.07,
                ease: 'power2.out',
                clearProps: 'transform,opacity',
              },
            ),
        });
      }

      // ACT 7: Partner Cards Stagger Reveal
      if (document.querySelector('.bosla-partner-reveal')) {
        ScrollTrigger.batch('.bosla-partner-reveal', {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { y: 16, opacity: 0.25 },
              {
                y: 0,
                opacity: 1,
                duration: 0.52,
                stagger: 0.08,
                ease: 'power2.out',
                clearProps: 'transform,opacity',
              },
            ),
        });
      }

      // ACT 8: Command Bridge Backdrop Subtle Parallax (Desktop only)
      if (isDesktop && document.querySelector('.bosla-contact-bg')) {
        gsap.fromTo(
          '.bosla-contact-bg',
          { yPercent: -5 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: '#contact',
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      }
    }, rootRef);

    document.fonts?.ready?.then(() => {
      if (!disposed) {
        ScrollTrigger.refresh();
      }
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', syncReticleOrigin);
      ctx.revert();
    };
  }, [motionPaused]);

  const primaryDash = getDefaultDashboardForUser(user);
  const whatsappClean = (intro?.whatsapp || '+201001226683').replace(/[^0-9]/g, '') || '201001226683';
  const supportEmail = intro?.email || 'support@boslaagri.com';

  const scrollToCourses = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('courses-showcase');
    if (!target) return;
    e.preventDefault();
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 64);
    const reduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  };

  const configuredSocials = [
    { label: 'فيسبوك', href: liveConfig?.social?.facebookUrl },
    { label: 'يوتيوب', href: liveConfig?.social?.youtubeUrl },
    { label: 'لينكدإن', href: liveConfig?.social?.linkedinUrl },
    { label: 'إنستجرام', href: liveConfig?.social?.instagramUrl },
    { label: 'منصة X', href: liveConfig?.social?.xUrl },
  ].filter((item) => Boolean(item.href && /^https?:\/\//i.test(item.href)));

  const storytellingSteps: Array<{ stepNumber: string; titleAr: string; descriptionAr: string }> =
    Array.isArray(liveConfig?.storytelling?.steps) && liveConfig.storytelling.steps.length > 0
      ? liveConfig.storytelling.steps
      : [
          {
            stepNumber: '01',
            titleAr: 'التعلّم التطبيقي',
            descriptionAr: 'فهم عميق للطب البيطري والتغذية وإدارة العنابر عبر مناهج عملية مبنية على حالات واقعية.',
          },
          {
            stepNumber: '02',
            titleAr: 'التطبيق الميداني',
            descriptionAr: 'تطبيق البروتوكولات والاختبارات والأدوات التحليلية مباشرة في المزرعة والشركة.',
          },
          {
            stepNumber: '03',
            titleAr: 'التطور المهني',
            descriptionAr: 'انتقال مدروس نحو أدوار قيادية واستشارية مدعومة بشهادات إتمام وخطابات توصية معتمدة.',
          },
        ];

  return (
    <HomepageShell
      motionPaused={motionPaused}
      onToggleMotion={() => setMotionPaused((prev) => !prev)}
    >
      <div ref={rootRef} className="w-full overflow-x-clip">
        {/* ===================================================================
            ACT 1 & ACT 2 · PINNED THRESHOLD HERO -> CALIBRATION APERTURE IRIS -> SCENE 2
            Restores Approved Prototype Direction with User Scene 1 + Visual Continuation Scene 2
           =================================================================== */}
        <section
          id="hero-stage"
          className="relative w-full bg-[#050A24]"
          aria-label="الافتتاحية والانتقال المخبري"
        >
          <div className="bosla-threshold-stage">
            {/* L0: Midnight Indigo Atmospheric Sky Backdrop */}
            <div className="bosla-threshold-sky" aria-hidden="true" />

            {/* L1: Full-Bleed Edge-to-Edge Palette-Matched Scene 1 + Subtle Readability Scrim */}
            <div className="bosla-threshold-complex">
              <picture>
                <source
                  media="(max-width: 820px)"
                  srcSet={
                    liveConfig?.hero?.backgroundMobileUrl ||
                    '/images/homepage-threshold/hero-scene1-mobile.webp'
                  }
                />
                <img
                  src={
                    liveConfig?.hero?.backgroundDesktopUrl ||
                    liveConfig?.hero?.heroImage1Url ||
                    '/images/homepage-threshold/hero-scene1-desktop.webp'
                  }
                  alt="فريق أكاديمية بوصلة من الطلاب والأطباء البيطريين ومختصي الأجريبيزنس أمام صوامع ومصنع الأعلاف وقت الغسق"
                  width={2560}
                  height={1440}
                  style={{
                    objectPosition: `${liveConfig?.hero?.focalX ?? 50}% ${liveConfig?.hero?.focalY ?? 42}%`,
                  }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="bosla-threshold-scrim" aria-hidden="true" />

            {/* L2: Immediate Readable Headline & Dual Actions in Calm Dark Negative Space */}
            <div
              className="bosla-threshold-hero-copy"
              style={{ textShadow: '0 2px 18px rgba(5, 10, 36, 0.55)' }}
            >
                <h1 className="text-[clamp(1.85rem,7.2vw,2.45rem)] lg:text-[clamp(2.15rem,3.05vw,3.15rem)] font-bold leading-[1.34] lg:leading-[1.28] text-[#EEF0FF] mb-3 sm:mb-4 bosla-display-font">
                  <span className="bosla-threshold-line-mask">من مقعد الدراسة</span>
                  <span className="bosla-threshold-line-mask">إلى قيادة المنشأة</span>
                </h1>

                <p className="max-w-[38ch] text-[clamp(0.92rem,1.15vw,1.06rem)] leading-[1.72] sm:leading-[1.76] text-[#C2CAF2] mb-4 sm:mb-6">
                  {intro?.subtitleAr ||
                    'منظومة إعداد وتأهيل تطبيقي تصل علم الطب البيطري وتغذية الحيوان وإنتاج الدواجن بواقع الإدارة والتشغيل اليومي.'}
                </p>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <a
                    id="hero-primary-cta"
                    href="#courses-showcase"
                    onClick={scrollToCourses}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-[#6B21A8] px-3.5 sm:px-6 text-[0.82rem] sm:text-[0.94rem] font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87]"
                  >
                    <span>استكشف الكورسات المعتمدة</span>
                    <ArrowDown className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                  </a>

                  {!user ? (
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/75 px-3.5 sm:px-5 text-[0.82rem] sm:text-[0.94rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/18"
                    >
                      ابدأ مسارك المهني
                    </Link>
                  ) : requiresPasskeyEnrollment ? (
                    <Link
                      href="/security/passkey-setup"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#6B21A8]/20 px-3.5 sm:px-5 text-[0.82rem] sm:text-[0.94rem] font-semibold text-[#E9D5FF] transition-colors hover:border-[#C084FC]"
                    >
                      استكمال تفعيل الحساب
                    </Link>
                  ) : (
                    <Link
                      href={primaryDash.href}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/75 px-3.5 sm:px-5 text-[0.82rem] sm:text-[0.94rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC]"
                    >
                      الدخول إلى البوابة
                    </Link>
                  )}
                </div>
              </div>

            {/* L3: Foreground Architectural Horizon Apron (Royal Purple Hairline Sweep) */}
            <div className="bosla-threshold-gantry" aria-hidden="true" />

            {/* L4: SIGNATURE CALIBRATION APERTURE REVEAL -> Scene 2 Visual Continuation */}
            <div className="bosla-threshold-lab" aria-label="العينات والتشخيص المخبري">
              <picture>
                <source
                  media="(max-width: 820px)"
                  srcSet="/images/homepage-threshold/hero-scene2-mobile.webp"
                />
                <img
                  ref={scene2ImgRef}
                  src="/images/homepage-threshold/hero-scene2-desktop.webp"
                  alt="مهندسة ومهندس داخل عنبر دواجن حديث يراجعان بيانات التشغيل والتربية على الحاسب اللوحي"
                  width={2560}
                  height={1440}
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              </picture>
              <div className="bosla-threshold-lab-scrim" aria-hidden="true" />

              {/* L6: Scene 2 Diagnostic Headline & Narrative Inside Calm Midnight Upper Band */}
              <div
                className="bosla-threshold-lab-copy"
                style={{ textShadow: '0 2px 18px rgba(5, 10, 36, 0.55)' }}
              >
                <span className="inline-block mb-3 rounded-[4px] border border-[#C084FC]/45 bg-[#6B21A8]/22 px-3 py-1 text-[0.8rem] font-bold text-[#E9D5FF]">
                  المعيار الميداني
                </span>
                <h2 className="text-[clamp(1.55rem,6.1vw,2.05rem)] md:text-[clamp(1.75rem,3vw,2.9rem)] font-bold leading-[1.34] md:leading-[1.28] text-[#EEF0FF] mb-3 sm:mb-4 bosla-display-font">
                  العشوائية مكلفة... والتشخيص يبدأ من العينة
                </h2>
                <p className="max-w-[38ch] text-[clamp(0.95rem,1.15vw,1.08rem)] leading-[1.72] sm:leading-[1.75] text-[#C2CAF2]">
                  الفرق بين قراءة الورق وقيادة المنشأة يكمن في ربط الدليل الحيوي بجودة العلف وكفاءة
                  العنبر قبل أن تتراكم الخسارة.
                </p>
              </div>
            </div>

            {/* L5: Draw-On Calibration Reticle Overlay (Royal Purple + Indigo Optics) */}
            <svg
              className="bosla-threshold-reticle"
              viewBox="0 0 1440 900"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
              aria-hidden="true"
            >
              <g id="reticle-group" ref={reticleGroupRef} transform="translate(504, 522)">
                <circle
                  id="reticle-ring-outer"
                  cx="0"
                  cy="0"
                  r="116"
                  stroke="#8CA2FF"
                  strokeWidth="1.25"
                  strokeDasharray="729"
                  strokeDashoffset="729"
                  opacity="0.88"
                />
                <circle
                  id="reticle-ring-inner"
                  cx="0"
                  cy="0"
                  r="72"
                  stroke="#C084FC"
                  strokeWidth="1.75"
                  strokeDasharray="453"
                  strokeDashoffset="453"
                  opacity="0.95"
                />
                <path
                  id="reticle-ticks"
                  d="M0 -138 V-122 M0 122 V138 M-138 0 H-122 M122 0 H138"
                  stroke="#C084FC"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  opacity="0"
                />
                <circle id="reticle-core" cx="0" cy="0" r="4" fill="#E9D5FF" opacity="0" />
              </g>
            </svg>
          </div>
        </section>

        {/* ===================================================================
            ACT 2.5 · STORYTELLING JOURNEY (Learn -> Apply -> Career Growth)
           =================================================================== */}
        {isSectionVisible('storytelling') && (
          <section
            id="storytelling"
            onClick={() => onSelectSectionInEditor?.('storytelling')}
            className="relative border-t border-[#22307A] bg-[#060C28] py-16 sm:py-20 text-[#EEF0FF]"
            aria-labelledby="storytelling-heading"
          >
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6 space-y-10">
              <div className="max-w-[60ch] space-y-2.5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#C084FC]">
                  <Compass className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
                  <span>رحلة التأهيل التطبيقي في بوصلة</span>
                </span>
                <h2
                  id="storytelling-heading"
                  className="text-[clamp(1.7rem,3vw,2.6rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
                >
                  {liveConfig?.storytelling?.titleAr || 'من الفهم الميداني إلى التأثير المهني'}
                </h2>
                <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">
                  {liveConfig?.storytelling?.subtitleAr ||
                    'مسار واضح يأخذك من الأساس العلمي التطبيقي إلى التنفيذ داخل الميدان ثم التطور الوظيفي.'}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {storytellingSteps.map((step, i) => (
                  <article
                    key={step.stepNumber || i}
                    className="relative rounded-2xl border border-[#22307A] bg-[#0B1440]/92 p-6 space-y-3 transition-colors hover:border-[#C084FC]/50"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C084FC]/40 bg-[#6B21A8]/20 font-mono text-xs font-extrabold text-[#E9D5FF] tabular-nums">
                      {step.stepNumber}
                    </span>
                    <h3 className="text-lg font-extrabold text-[#EEF0FF] bosla-display-font">
                      {step.titleAr}
                    </h3>
                    <p className="text-xs sm:text-sm leading-[1.75] text-[#C2CAF2]">
                      {step.descriptionAr}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            ACT 3 · FOUR OPERATIONAL SYSTEMS (Bio-Hall Parallax Flow)
           =================================================================== */}
        <section
          id="methodology"
          className="relative overflow-hidden border-t border-[#22307A] bg-[#070D2B]"
          style={{ padding: 'clamp(72px, 10vw, 120px) clamp(18px, 4vw, 36px)' }}
          aria-label="التخصصات التطبيقية المترابطة"
        >
          <div className="bosla-fields-bg pointer-events-none absolute inset-x-0 -top-[10%] -bottom-[10%] z-[1] opacity-24 will-change-transform">
            <img
              src="/images/homepage-threshold/scene3-poultry-hall.webp"
              alt=""
              width={1600}
              height={894}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'linear-gradient(180deg, #050A24 0%, rgba(7, 13, 43, 0.78) 50%, #050A24 100%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-[4] mx-auto max-w-[1240px]">
            <div className="max-w-[60ch] mb-10 md:mb-12">
              <h2 className="text-[clamp(1.75rem,3.1vw,2.75rem)] font-bold leading-[1.3] text-[#EEF0FF] mb-3 bosla-display-font">
                أربعة أركان تشغيلية بلغة قرار واحدة
              </h2>
              <p className="text-base leading-[1.75] text-[#C2CAF2]">
                لا تعمل منشأة الإنتاج الحيواني كجزر معزولة. تبني بوصلة فهماً مترابطاً يجمع
                التشخيص، التغذية، هندسة العنبر، والإدارة التجارية داخل سياق تطبيقي واحد.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {SECTOR_PILLARS.map((pillar) => (
                <article
                  key={pillar.id}
                  className="bosla-field-pillar flex flex-col justify-between gap-4 rounded-xl border border-[#22307A] bg-[#0B1440]/90 p-6 backdrop-blur-md transition-colors hover:border-[#C084FC]/45"
                >
                  <div className="space-y-2.5">
                    <span className="inline-flex items-center gap-2 text-[0.8rem] font-semibold text-[#C084FC] tabular-nums">
                      <span>{pillar.index}</span>
                      <span aria-hidden="true">·</span>
                      <span>{pillar.domainLine}</span>
                    </span>
                    <h3 className="text-[1.15rem] font-bold leading-[1.38] text-[#EEF0FF] bosla-display-font">
                      {pillar.title}
                    </h3>
                  </div>
                  <p className="text-[0.92rem] leading-[1.72] text-[#C2CAF2]">{pillar.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            ACT 4 · QUIET SILENCE THESIS BREAK (Intentional Pause Before Peak)
           =================================================================== */}
        <section
          id="thesis-band"
          className="border-t border-[#22307A]/60 bg-[#050A24]"
          style={{ padding: 'clamp(80px, 11vw, 136px) clamp(18px, 4vw, 36px)' }}
          aria-label="ركيزة الفهم الميداني"
        >
          <div className="bosla-thesis-frame mx-auto max-w-[960px] border-s-2 border-[#6B21A8] py-3 ps-5 sm:ps-8">
            <p className="bosla-thesis-phrase text-[clamp(1.5rem,3vw,2.5rem)] font-bold leading-[1.48] text-[#EEF0FF] bosla-display-font">
              المعلومة النظريّة متاحة للجميع... الفارق الحقيقي يبدأ عند قرار اللحظة الميدانية.
            </p>
          </div>
        </section>

        {/* ===================================================================
            ACT 5 · PEAK: FROM STUDENT TO DIRECTOR + SELECTIVE LAZY THREE.JS
           =================================================================== */}
        <section
          id="elevation"
          ref={peakSectionRef}
          className="relative overflow-hidden border-t border-[#22307A] bg-[#0B1440]"
          style={{ padding: 'clamp(72px, 10vw, 118px) clamp(18px, 4vw, 36px)' }}
          aria-label="تدرج التأهيل من الطالب إلى المدير"
        >
          <BoslaTopographyCanvas
            motionPaused={motionPaused}
            observerTargetRef={peakSectionRef}
          />

          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-30"
            viewBox="0 0 1200 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 390 Q 320 360 620 265 T 1200 120" fill="none" stroke="#C084FC" strokeWidth="1.2" />
            <path d="M0 430 Q 340 395 660 305 T 1200 175" fill="none" stroke="#6B21A8" strokeWidth="0.95" />
          </svg>

          <div className="relative z-[4] mx-auto max-w-[1240px]">
            <div className="max-w-[60ch] mb-8 md:mb-10">
              <h2 className="text-[clamp(1.75rem,3.1vw,2.75rem)] font-bold leading-[1.3] text-[#EEF0FF] mb-3 bosla-display-font">
                من الطالب إلى المدير
              </h2>
              <p className="text-base leading-[1.75] text-[#C2CAF2]">
                تدرج تأهيلي صُمّم ليناسبك حيثما تقف الآن في مسيرتك الفنية أو الإدارية داخل القطاع.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {ELEVATION_STAGES.map((stage) => (
                <article
                  key={stage.id}
                  className={`bosla-stage-card rounded-xl border bg-[#050A24]/92 p-6 ${
                    stage.isLeader ? 'border-[#C084FC]/55' : 'border-[#22307A]'
                  }`}
                >
                  <span
                    className={`mb-2.5 block text-[0.78rem] font-semibold tabular-nums ${
                      stage.isLeader ? 'text-[#C084FC]' : 'text-[#A9B8FF]'
                    }`}
                  >
                    {stage.tag}
                  </span>
                  <h3 className="mb-2.5 text-[1.18rem] font-bold text-[#EEF0FF] bosla-display-font">
                    {stage.title}
                  </h3>
                  <p className="text-[0.92rem] leading-[1.72] text-[#C2CAF2]">{stage.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            ACT 6 · REAL PUBLISHED & APPROVED COURSES SHOWCASE
           =================================================================== */}
        {isSectionVisible('courses') && (
          <div onClick={() => onSelectSectionInEditor?.('courses')}>
            <BoslaCoursesShowcase initialData={coursesData} initialFailed={coursesFetchFailed} />
          </div>
        )}

        {/* ===================================================================
            ACT 6.5 · REAL SERVER-DRIVEN MEMBERSHIP PRICING PLANS ("الباقات والأسعار")
           =================================================================== */}
        {isSectionVisible('pricing') && (
          <BoslaPricingSection
            plans={liveLayout?.pricingPlans ?? []}
            titleAr={liveConfig?.pricing?.titleAr || 'الباقات والأسعار'}
            subtitleAr={
              liveConfig?.pricing?.subtitleAr ||
              'اختر خطة العضوية المناسبة لمسارك المهني مع وصول فوري للكورسات والشهادات المعتمدة'
            }
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('pricing') : undefined
            }
          />
        )}

        {/* ===================================================================
            ACT 6.7 · CERTIFIED TRAINERS MARQUEE ("نخبة المدربين وخبراء الميدان")
           =================================================================== */}
        {isSectionVisible('trainers') && (liveLayout?.trainers?.length ?? 0) > 0 && (
          <BoslaTrainersMarquee
            trainers={liveLayout.trainers}
            titleAr={liveConfig?.trainers?.titleAr}
            subtitleAr={liveConfig?.trainers?.subtitleAr}
            autoSpeedSeconds={liveConfig?.trainers?.autoSpeedSeconds}
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('trainers') : undefined
            }
          />
        )}

        {/* ===================================================================
            ACT 6.9 · AUTHENTIC STUDENT TESTIMONIALS (Auto-hidden when 0 published)
           =================================================================== */}
        {isSectionVisible('testimonials') && (liveLayout?.testimonials?.length ?? 0) > 0 && (
          <BoslaTestimonialsSection
            testimonials={liveLayout.testimonials}
            titleAr={liveConfig?.testimonials?.titleAr}
            subtitleAr={liveConfig?.testimonials?.subtitleAr}
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('testimonials') : undefined
            }
          />
        )}

        {/* ===================================================================
            ACT 7 · REAL PARTNERS ("شركاؤنا") & PARTNER APPLICATION ("انضم كشريك")
           =================================================================== */}
        {isSectionVisible('partners') && (
          <div onClick={() => onSelectSectionInEditor?.('partners')}>
            <BoslaPartnersSection
              partners={
                Array.isArray(liveConfig?.partners) && liveConfig.partners.length > 0
                  ? liveConfig.partners.map((p: any, idx: number) => ({
                      id: p.id || `lp_${idx}`,
                      nameAr: p.nameAr,
                      logoUrl: p.logoUrl || null,
                      websiteUrl: p.websiteUrl || null,
                      descriptionAr: p.descriptionAr || null,
                    }))
                  : (liveLayout?.partners?.length ? liveLayout.partners : coursesData?.partners) ?? []
              }
              titleAr={(!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.titleAr) || undefined}
              subtitleAr={(!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.subtitleAr) || undefined}
              ctaLabelAr={(!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.ctaLabelAr) || 'انضم كشريك نجاح'}
              ctaHref={(!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.ctaHref) || '#partner-apply'}
            />
            <BoslaPartnerApplySection />
          </div>
        )}

        {/* ===================================================================
            ACT 7.5 · FREQUENTLY ASKED QUESTIONS (Editable via Live Editor)
           =================================================================== */}
        {isSectionVisible('faqs') &&
          Array.isArray(liveConfig?.faqs) &&
          liveConfig.faqs.length > 0 && (
            <section
              id="faqs"
              data-testid="homepage-faqs-section"
              onClick={() => onSelectSectionInEditor?.('faqs')}
              className="border-t border-[#22307A] bg-[#060C28] py-16 sm:py-20 text-[#EEF0FF]"
            >
              <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
                <div className="text-center space-y-2">
                  <span className="inline-block rounded-full border border-[#C084FC]/35 bg-[#7C3AED]/15 px-3.5 py-1 text-xs font-extrabold text-[#D8B4FE]">
                    الأسئلة الشائعة
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    إجابات واضحة حول الدراسة والاشتراك في بوصلة
                  </h2>
                </div>
                <div className="space-y-3">
                  {liveConfig.faqs.map((faq: any, idx: number) => (
                    <details
                      key={faq.id || idx}
                      open={idx === 0}
                      className="rounded-2xl border border-[#8CA2FF]/20 bg-[#0B1440]/85 p-4"
                    >
                      <summary className="cursor-pointer text-sm sm:text-base font-extrabold text-white">
                        {faq.questionAr}
                      </summary>
                      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#A9B1E0]">
                        {faq.answerAr}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          )}

        {/* ===================================================================
            ACT 8 · COMMAND BRIDGE INQUIRY + PROTOTYPE SHARP PORTAL PLINTH
           =================================================================== */}
        <section
          id="contact"
          className="relative overflow-hidden border-t border-[#22307A] bg-[#070D2B]"
          style={{ padding: 'clamp(72px, 10vw, 116px) clamp(18px, 4vw, 36px)' }}
          aria-label="التواصل المباشر وبوابة الدخول"
        >
          <div
            className="bosla-contact-bg pointer-events-none absolute inset-x-0 -top-[8%] -bottom-[8%] z-0 opacity-20 will-change-transform"
            aria-hidden="true"
          >
            <img
              src="/images/homepage-threshold/scene6-command-bridge.webp"
              alt=""
              width={1600}
              height={894}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                'linear-gradient(180deg, rgba(7, 13, 43, 0.92) 0%, rgba(5, 10, 36, 0.88) 55%, #050A24 100%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-[4] mx-auto max-w-[1240px] space-y-12">
            <div className="grid gap-10 lg:grid-cols-12 items-start">
              <div className="lg:col-span-5 space-y-7">
                <div className="space-y-3">
                  <h2 className="text-[clamp(1.65rem,2.9vw,2.45rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font">
                    انضباط القرار فوق أرضية الواقع
                  </h2>
                  <p className="text-sm sm:text-base leading-[1.75] text-[#C2CAF2]">
                    للاستفسارات الفردية أو لترتيب خطط التأهيل المؤسسي لفرق الشركات والمزارع ومصانع
                    الأعلاف، تواصل مباشرة مع فريق بوصلة.
                  </p>
                </div>

                <div className="divide-y divide-[#22307A] border-y border-[#22307A]">
                  {REALITY_TENETS.map((item) => (
                    <div key={item.title} className="py-3.5 space-y-1">
                      <p className="text-sm font-bold text-[#EEF0FF] flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C084FC] shrink-0" aria-hidden="true" />
                        <span>{item.title}</span>
                      </p>
                      <p className="text-xs sm:text-sm leading-[1.68] text-[#C2CAF2]">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="divide-y divide-[#22307A] border-y border-[#22307A]">
                  <a
                    href={`https://wa.me/${whatsappClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[48px] items-center justify-between py-2.5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:text-[#77E2B5]"
                  >
                    <span className="flex items-center gap-2.5">
                      <MessageCircle className="h-4 w-4 text-[#77E2B5]" strokeWidth={1.6} aria-hidden="true" />
                      <span>واتساب المباشر</span>
                    </span>
                    <bdi dir="ltr" className="text-xs font-semibold text-[#C2CAF2] tabular-nums">
                      +{whatsappClean}
                    </bdi>
                  </a>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="flex min-h-[48px] items-center justify-between py-2.5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:text-[#C084FC]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                      <span>البريد الرسمي</span>
                    </span>
                    <bdi dir="ltr" className="text-xs font-semibold text-[#C2CAF2]">
                      {supportEmail}
                    </bdi>
                  </a>
                  <div className="flex min-h-[48px] items-center gap-2.5 py-2.5 text-xs font-semibold text-[#C2CAF2]">
                    <MapPin className="h-4 w-4 text-[#C084FC] shrink-0" strokeWidth={1.6} aria-hidden="true" />
                    <span>القاهرة، جمهورية مصر العربية</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-xl border border-[#22307A] bg-[#0B1440]/92 p-6 sm:p-8 space-y-6 backdrop-blur-md">
                  <div className="border-b border-[#22307A] pb-4 space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-bold text-[#EEF0FF] bosla-display-font">
                      القنوات المباشرة والخدمات الرسمية
                    </h3>
                    <p className="text-xs sm:text-sm text-[#C2CAF2]">
                      لشراكات الأعمال والدعم الفني والتحقق من الاعتمادات، اختر المسار المخصص مباشرة دون نماذج عامة.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs sm:text-sm">
                    <a
                      href="#partner-apply"
                      className="rounded-xl border border-[#C084FC]/35 bg-[#6B21A8]/16 p-4 hover:border-[#C084FC] transition-colors space-y-1.5 block"
                    >
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#EEF0FF]">
                        <Building2 className="h-4 w-4 text-[#C084FC]" />
                        انضم كشريك نجاح
                      </span>
                      <p className="text-xs text-[#C2CAF2]">
                        لتدريب الفرق والشراكات الميدانية ورعاية المناهج.
                      </p>
                    </a>

                    <Link
                      href="/support"
                      className="rounded-xl border border-[#8CA2FF]/25 bg-[#070D2B] p-4 hover:border-[#8CA2FF] transition-colors space-y-1.5 block"
                    >
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#EEF0FF]">
                        <LifeBuoy className="h-4 w-4 text-[#8CA2FF]" />
                        مركز الدعم والتذاكر
                      </span>
                      <p className="text-xs text-[#C2CAF2]">
                        للمساعدة في الحسابات والاشتراكات والتشغيل.
                      </p>
                    </Link>

                    <Link
                      href="/certificates/verify"
                      className="rounded-xl border border-[#77E2B5]/30 bg-[#070D2B] p-4 hover:border-[#77E2B5] transition-colors space-y-1.5 block"
                    >
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#EEF0FF]">
                        <Award className="h-4 w-4 text-[#77E2B5]" />
                        التحقق من الشهادات والتوصيات
                      </span>
                      <p className="text-xs text-[#C2CAF2]">
                        توثيق فوري للشهادات وخطابات التوصية المعتمدة.
                      </p>
                    </Link>

                    <Link
                      href="/careers"
                      className="rounded-xl border border-[#8CA2FF]/25 bg-[#070D2B] p-4 hover:border-[#C084FC] transition-colors space-y-1.5 block"
                    >
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#EEF0FF]">
                        <Briefcase className="h-4 w-4 text-[#F5B94A]" />
                        الوظائف وفرص الانضمام
                      </span>
                      <p className="text-xs text-[#C2CAF2]">
                        استعرض الفرص الوظيفية المتاحة في فريق بوصلة.
                      </p>
                    </Link>
                  </div>

                  {configuredSocials.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#22307A] pt-4 text-xs">
                      <span className="font-bold text-[#A9B1E0] me-1">حساباتنا الرسمية:</span>
                      {configuredSocials.map((s) => (
                        <a
                          key={s.label}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-[#8CA2FF]/25 bg-[#070D2B] px-3 py-1.5 font-bold text-[#EEF0FF] hover:border-[#C084FC]"
                        >
                          {s.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Grounded Sharp Prototype Portal Plinth (Royal Purple Accent Bar) */}
            <div className="bosla-portal-plinth p-6 sm:p-9 flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <img
                  src="/images/brand/bosla-logo.webp"
                  alt="بوصلة"
                  width={42}
                  height={42}
                  className="h-9 w-auto object-contain"
                />
                <div>
                  <h2 className="text-[clamp(1.25rem,2vw,1.65rem)] font-bold text-[#EEF0FF] mb-1 bosla-display-font">
                    بوصلة للإنتاج الحيواني والداجني
                  </h2>
                  <p className="text-[0.95rem] text-[#C2CAF2]">
                    بوابة الدخول الآمن للمتدربين والمؤسسات المسجلة
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/courses"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/40 bg-[#070D2B]/70 px-5 text-[0.925rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/20"
                >
                  كتالوج الكورسات
                </Link>
                {!user ? (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#8CA2FF]/36 bg-[#070D2B]/70 px-5 text-[0.925rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#0F1A4A]"
                    >
                      تسجيل الدخول
                    </Link>
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#6B21A8] px-5 text-[0.925rem] font-bold text-white transition-colors hover:bg-[#7E22CE]"
                    >
                      إنشاء حساب جديد
                    </Link>
                  </>
                ) : requiresPasskeyEnrollment ? (
                  <Link
                    href="/security/passkey-setup"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#6B21A8] px-5 text-[0.925rem] font-bold text-white transition-colors hover:bg-[#7E22CE]"
                  >
                    استكمال تفعيل الحساب
                  </Link>
                ) : (
                  <Link
                    href={primaryDash.href}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#6B21A8] px-5 text-[0.925rem] font-bold text-white transition-colors hover:bg-[#7E22CE]"
                  >
                    الدخول إلى البوابة
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </HomepageShell>
  );
}
