'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDown,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import {
  BoslaCoursesShowcase,
  type HomepageCoursesPayload,
} from './BoslaCoursesShowcase';
import { BoslaPartnerApplySection } from './BoslaPartnerApplySection';
import { BoslaPartnersSection } from './BoslaPartnersSection';
import { BoslaTopographyCanvas } from './BoslaTopographyCanvas';
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
}: {
  intro?: HomeIntroContent;
  coursesData: HomepageCoursesPayload | null;
  coursesFetchFailed?: boolean;
}) {
  const { user, requiresPasskeyEnrollment, pushToast } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const peakSectionRef = useRef<HTMLElement>(null);
  const reticleGroupRef = useRef<SVGGElement>(null);

  // Lead / Concierge inquiry wired strictly to existing POST /api/v1/catalog/leads
  const [leadType, setLeadType] = useState<'INDIVIDUAL' | 'CORPORATE_B2B'>('INDIVIDUAL');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      if (window.innerWidth < 1024) {
        group.setAttribute('transform', 'translate(720, 594)');
      } else {
        group.setAttribute('transform', 'translate(518, 477)');
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

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmittedOk(false);
    if (fullName.trim().length < 2) {
      setFormError('يرجى كتابة الاسم الكامل بشكل صحيح.');
      return;
    }
    if (phoneNumber.trim().length < 8) {
      setFormError('يرجى إدخال رقم هاتف صالح للتواصل.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/catalog/leads', {
        method: 'POST',
        skipCsrf: true,
        body: JSON.stringify({
          type: leadType,
          fullName: fullName.trim(),
          companyName: leadType === 'CORPORATE_B2B' ? companyName.trim() || undefined : undefined,
          phoneNumber: phoneNumber.trim(),
          countryCode: '+20',
          need: leadType === 'CORPORATE_B2B' ? 'شراكة أو تأهيل مؤسسي' : 'استفسار تعريفي عام',
          notes: notes.trim() || undefined,
        }),
      });
      setSubmittedOk(true);
      setFullName('');
      setCompanyName('');
      setPhoneNumber('');
      setNotes('');
      pushToast('تم استلام رسالتك وسيتم التواصل معك من فريق بوصلة قريباً.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setFormError(msg || 'تعذر إرسال الرسالة، حاول مجدداً أو تواصل عبر واتساب.');
    } finally {
      setSubmitting(false);
    }
  };

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

            {/* L1 + L2: Responsive RTL Editorial Composition Preserving Complete 16:9 Scene 1 */}
            <div className="bosla-threshold-scene1-grid">
              {/* L2: Immediate Readable Headline & Dual Actions on Calm Space */}
              <div className="bosla-threshold-hero-copy">
                <h1 className="text-[clamp(1.85rem,7.2vw,2.45rem)] lg:text-[clamp(2.35rem,3.6vw,3.65rem)] font-bold leading-[1.34] lg:leading-[1.28] text-[#EEF0FF] mb-4 bosla-display-font">
                  <span className="bosla-threshold-line-mask">من مقعد الدراسة</span>
                  <span className="bosla-threshold-line-mask">إلى قيادة المنشأة</span>
                </h1>

                <p className="max-w-[46ch] text-[clamp(0.95rem,1.25vw,1.12rem)] leading-[1.78] text-[#C2CAF2] mb-6">
                  {intro?.subtitleAr ||
                    'منظومة إعداد وتأهيل تطبيقي تصل علم الطب البيطري وتغذية الحيوان وإنتاج الدواجن بواقع الإدارة والتشغيل اليومي.'}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    id="hero-primary-cta"
                    href="#courses-showcase"
                    onClick={scrollToCourses}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#6B21A8] px-4 sm:px-6 text-[0.875rem] sm:text-[0.94rem] font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87]"
                  >
                    <span>استكشف الكورسات المعتمدة</span>
                    <ArrowDown className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                  </a>

                  {!user ? (
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/75 px-4 sm:px-5 text-[0.875rem] sm:text-[0.94rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/18"
                    >
                      ابدأ مسارك المهني
                    </Link>
                  ) : requiresPasskeyEnrollment ? (
                    <Link
                      href="/security/passkey-setup"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#6B21A8]/20 px-4 sm:px-5 text-[0.875rem] sm:text-[0.94rem] font-semibold text-[#E9D5FF] transition-colors hover:border-[#C084FC]"
                    >
                      استكمال تفعيل الحساب
                    </Link>
                  ) : (
                    <Link
                      href={primaryDash.href}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/75 px-4 sm:px-5 text-[0.875rem] sm:text-[0.94rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC]"
                    >
                      الدخول إلى البوابة
                    </Link>
                  )}
                </div>
              </div>

              {/* L1: User Uploaded Scene 1 (Exact 16:9 Ratio Preserved Without Cropping or Distortion) */}
              <div className="bosla-threshold-complex">
                <div className="bosla-scene1-frame">
                  <picture>
                    <source
                      media="(max-width: 768px)"
                      srcSet="/images/homepage-threshold/hero-scene1-community-mobile.webp"
                    />
                    <img
                      src="/images/homepage-threshold/hero-scene1-community.webp"
                      alt="طلاب وأطباء بيطريون وقادة الأجريبيزنس أمام مقر أكاديمية بوصلة وصوامع الأعلاف"
                      width={1024}
                      height={576}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </picture>
                </div>
              </div>
            </div>

            {/* L3: Foreground Architectural Horizon Apron (Royal Purple Hairline Sweep) */}
            <div className="bosla-threshold-gantry" aria-hidden="true" />

            {/* L4: SIGNATURE CALIBRATION APERTURE REVEAL -> Scene 2 Visual Continuation */}
            <div className="bosla-threshold-lab" aria-label="العينات والتشخيص المخبري">
              <picture>
                <source
                  media="(max-width: 768px)"
                  srcSet="/images/homepage-threshold/hero-scene2-lab-mobile.webp"
                />
                <img
                  src="/images/homepage-threshold/hero-scene2-lab.webp"
                  alt="مقعد تشخيص بيطري ومناخل وأطباق ذرة صفراء معقمة داخل المختبر"
                  width={1600}
                  height={894}
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="bosla-threshold-lab-scrim" aria-hidden="true" />

              {/* L6: Scene 2 Diagnostic Headline & Narrative Inside Calm Midnight Upper Band */}
              <div className="bosla-threshold-lab-copy">
                <span className="inline-block mb-3 rounded-[4px] border border-[#C084FC]/45 bg-[#6B21A8]/22 px-3 py-1 text-[0.8rem] font-bold text-[#E9D5FF]">
                  المعيار الميداني
                </span>
                <h2 className="text-[clamp(1.6rem,6.4vw,2.15rem)] md:text-[clamp(1.9rem,3.6vw,3.35rem)] font-bold leading-[1.34] md:leading-[1.28] text-[#EEF0FF] mb-4 bosla-display-font">
                  العشوائية مكلفة... والتشخيص يبدأ من العينة
                </h2>
                <p className="max-w-[48ch] text-[clamp(0.98rem,1.25vw,1.12rem)] leading-[1.75] text-[#C2CAF2]">
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
              <g id="reticle-group" ref={reticleGroupRef} transform="translate(518, 477)">
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
        <BoslaCoursesShowcase initialData={coursesData} initialFailed={coursesFetchFailed} />

        {/* ===================================================================
            ACT 7 · REAL PARTNERS ("شركاؤنا") & PARTNER APPLICATION ("انضم كشريك")
           =================================================================== */}
        <BoslaPartnersSection partners={coursesData?.partners ?? []} />

        <BoslaPartnerApplySection />

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
                <form
                  onSubmit={handleContactSubmit}
                  className="rounded-xl border border-[#22307A] bg-[#0B1440]/92 p-6 sm:p-8 space-y-5 backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22307A] pb-4">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-[#EEF0FF] bosla-display-font">
                        أرسل استفسارك مباشرة
                      </h3>
                      <p className="text-xs text-[#C2CAF2]">اختر صفة التواصل وأدخل بياناتك للرد عليك</p>
                    </div>
                    <div className="flex rounded-lg border border-[#22307A] bg-[#050A24] p-0.5">
                      <button
                        type="button"
                        onClick={() => setLeadType('INDIVIDUAL')}
                        className={`min-h-[38px] rounded-[6px] px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                          leadType === 'INDIVIDUAL'
                            ? 'bg-[#6B21A8] text-white'
                            : 'text-[#C2CAF2] hover:text-[#EEF0FF]'
                        }`}
                      >
                        تواصل فردي
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadType('CORPORATE_B2B')}
                        className={`min-h-[38px] rounded-[6px] inline-flex items-center gap-1.5 px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                          leadType === 'CORPORATE_B2B'
                            ? 'bg-[#6B21A8] text-white'
                            : 'text-[#C2CAF2] hover:text-[#EEF0FF]'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
                        <span>شركة / مؤسسة</span>
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-[#FF9CAA]/45 bg-[#FF9CAA]/10 px-4 py-3 text-sm font-semibold text-[#FF9CAA]"
                    >
                      {formError}
                    </div>
                  )}

                  {submittedOk && (
                    <div
                      role="status"
                      className="flex items-center gap-2.5 rounded-lg border border-[#77E2B5]/45 bg-[#77E2B5]/10 px-4 py-3 text-sm font-semibold text-[#77E2B5]"
                    >
                      <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                      <span>تم استلام رسالتك بنجاح، سيتواصل معك فريق أكاديمية بوصلة قريباً.</span>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="home-contact-name" className="block text-sm font-bold text-[#EEF0FF]">
                        الاسم الكامل *
                      </label>
                      <input
                        id="home-contact-name"
                        type="text"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="الاسم الثلاثي"
                        className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="home-contact-phone" className="block text-sm font-bold text-[#EEF0FF]">
                        رقم الموبايل (واتساب) *
                      </label>
                      <input
                        id="home-contact-phone"
                        type="tel"
                        dir="ltr"
                        required
                        autoComplete="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="01001234567"
                        className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-end text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                      />
                    </div>
                  </div>

                  {leadType === 'CORPORATE_B2B' && (
                    <div className="space-y-1.5">
                      <label htmlFor="home-contact-company" className="block text-sm font-bold text-[#EEF0FF]">
                        اسم الشركة / المؤسسة
                      </label>
                      <input
                        id="home-contact-company"
                        type="text"
                        autoComplete="organization"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="اسم الشركة أو المزرعة"
                        className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="home-contact-notes" className="block text-sm font-bold text-[#EEF0FF]">
                      تفاصيل الرسالة أو الاستفسار
                    </label>
                    <textarea
                      id="home-contact-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="اكتب باختصار سؤالك أو مجال العمل المطلوب"
                      className="w-full min-h-[96px] rounded-lg border border-[#22307A] bg-[#050A24] p-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#6B21A8] px-7 text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87] disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-4 w-4 text-white rtl:-scale-x-100" strokeWidth={1.6} aria-hidden="true" />
                    <span>{submitting ? 'جاري إرسال الرسالة' : 'إرسال الرسالة الآن'}</span>
                  </button>
                </form>
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
