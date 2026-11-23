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
  Pause,
  Play,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import {
  BoslaCoursesShowcase,
  type HomepageCoursesPayload,
} from './BoslaCoursesShowcase';
import { BoslaHeroVideo } from './BoslaHeroVideo';
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

const THESIS_PHRASES = [
  'المعلومة النظرية متاحة للجميع...',
  'الفارق الحقيقي يبدأ عندما تقرأ العينة،',
  'تضبط التكلفة داخل العنبر،',
  'وتحسم قرار اللحظة الميدانية بثقة.',
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

  // Continuous, non-trapping GSAP + ScrollTrigger Choreography (Never leaves elements hidden on error)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

    if (prefersReduced) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    let disposed = false;

    const ctx = gsap.context(() => {
      // Crisp, subtle initial entrance without hiding SSR copy before hydration
      gsap.from('.bosla-hero-enter', {
        y: 16,
        opacity: 0.01,
        duration: 0.68,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });

      // Scroll-driven depth transition as the Courses Showcase glides up over the hero curtain
      if (document.querySelector('.bosla-hero-video-layer')) {
        gsap.to('.bosla-hero-video-layer', {
          yPercent: 8,
          scale: 1.04,
          opacity: 0.45,
          ease: 'none',
          scrollTrigger: {
            trigger: '#hero-stage',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      if (document.querySelector('.bosla-hero-copy-wrap')) {
        gsap.to('.bosla-hero-copy-wrap', {
          y: -32,
          opacity: 0.25,
          ease: 'none',
          scrollTrigger: {
            trigger: '#hero-stage',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // Spotlight course cover subtle scrub parallax
      const spotlightImg = document.querySelector('.bosla-spotlight-cover');
      if (spotlightImg) {
        gsap.fromTo(
          spotlightImg,
          { yPercent: -6 },
          {
            yPercent: 4,
            ease: 'none',
            scrollTrigger: {
              trigger: '#courses-showcase',
              start: 'top 90%',
              end: 'bottom 20%',
              scrub: true,
            },
          },
        );
      }

      // Course cards graceful stagger reveal
      ScrollTrigger.batch('.bosla-course-reveal', {
        start: 'top 90%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 20, opacity: 0.25 },
            {
              y: 0,
              opacity: 1,
              duration: 0.56,
              stagger: 0.07,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            },
          ),
      });

      // Editorial Manifesto phrase illumination while scrolling comfortably
      const phraseEls = gsap.utils.toArray<HTMLElement>('.bosla-thesis-phrase');
      if (phraseEls.length > 0) {
        gsap.set(phraseEls, { color: '#6E79B3' });
        gsap.to(phraseEls, {
          color: '#EEF0FF',
          stagger: 0.35,
          ease: 'none',
          scrollTrigger: {
            trigger: '#thesis-band',
            start: 'top 78%',
            end: 'bottom 52%',
            scrub: 0.6,
          },
        });
      }

      // Soft background parallax on bio-hall photography
      if (document.querySelector('.bosla-fields-bg')) {
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

      // Pillar cards gentle batch entrance
      ScrollTrigger.batch('.bosla-field-pillar', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y: 20, opacity: 0.25 },
            {
              y: 0,
              opacity: 1,
              duration: 0.58,
              stagger: 0.08,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            },
          ),
      });

      // Peak Elevation Progression cards
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

      // Partner cards batch entrance (if any approved partners are rendered)
      if (document.querySelector('.bosla-partner-reveal')) {
        ScrollTrigger.batch('.bosla-partner-reveal', {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { y: 18, opacity: 0.25 },
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

      // Command bridge subtle parallax backdrop
      if (document.querySelector('.bosla-contact-bg')) {
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
      ctx.revert();
    };
  }, [motionPaused]);

  const primaryDash = getDefaultDashboardForUser(user);
  const whatsappClean = (intro?.whatsapp || '+201001226683').replace(/[^0-9]/g, '') || '201001226683';
  const supportEmail = intro?.email || 'support@boslaagri.com';

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
            ACT 1 · HERO VIDEO STAGE (Sticky Depth Curtain + Direct RTL Copy)
           =================================================================== */}
        <section
          id="hero-stage"
          className="relative flex min-h-[100svh] w-full flex-col justify-between overflow-hidden bg-[#050A24] pt-[96px] pb-24 md:pt-[118px] md:pb-32"
          aria-label="الافتتاحية الرئيسية لأكاديمية بوصلة"
        >
          <BoslaHeroVideo motionPaused={motionPaused} />

          <div
            className="bosla-hero-copy-wrap relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-start md:justify-center will-change-transform"
            style={{ paddingInline: 'clamp(18px, 4vw, 48px)' }}
          >
            <div className="max-w-[680px] space-y-5 md:space-y-6 pt-3 md:pt-0">
              <h1
                className="bosla-hero-enter text-[clamp(2rem,7.8vw,2.65rem)] md:text-[clamp(2.6rem,4.1vw,3.9rem)] font-black leading-[1.3] md:leading-[1.24] text-[#EEF0FF] bosla-display-font"
                style={{ textShadow: '0 10px 30px rgba(3, 6, 22, 0.72)' }}
              >
                <span className="block sm:whitespace-nowrap">من مقعد الدراسة</span>
                <span className="block text-[#C084FC] sm:whitespace-nowrap">إلى قيادة المنشأة</span>
              </h1>

              <p
                className="bosla-hero-enter max-w-[48ch] text-[clamp(0.98rem,1.3vw,1.16rem)] leading-[1.82] text-[#D8DDF8]"
                style={{ textShadow: '0 4px 18px rgba(3, 6, 22, 0.78)' }}
              >
                {intro?.subtitleAr ||
                  'نربط علم الطب البيطري وتغذية الحيوان وإنتاج الدواجن بواقع التشغيل اليومي داخل المزارع ومصانع الأعلاف وسوق الأجريبيزنس.'}
              </p>

              <div className="bosla-hero-enter flex flex-wrap items-center gap-3 pt-2">
                <a
                  id="hero-primary-cta"
                  href="#courses-showcase"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#6B21A8] px-6 text-[0.95rem] font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87]"
                >
                  <span>استكشف الكورسات المعتمدة</span>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>

                {!user ? (
                  <Link
                    href="/register"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/80 px-5 text-[0.93rem] font-semibold text-[#EEF0FF] backdrop-blur-md transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/22"
                  >
                    ابدأ التأهيل مجاناً
                  </Link>
                ) : requiresPasskeyEnrollment ? (
                  <Link
                    href="/security/passkey-setup"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#C084FC]/55 bg-[#6B21A8]/25 px-5 text-[0.93rem] font-semibold text-[#E9D5FF] backdrop-blur-md transition-colors hover:bg-[#6B21A8]/38"
                  >
                    استكمال تفعيل الحساب
                  </Link>
                ) : (
                  <Link
                    href={primaryDash.href}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[#C084FC]/45 bg-[#070D2B]/80 px-5 text-[0.93rem] font-semibold text-[#EEF0FF] backdrop-blur-md transition-colors hover:border-[#C084FC]"
                  >
                    الدخول إلى البوابة
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Calm Video Motion Toggle Positioned Clear of the Showcase Overlap */}
          <div
            className="relative z-10 mx-auto mt-8 flex w-full max-w-[1280px] justify-end"
            style={{ paddingInline: 'clamp(18px, 4vw, 48px)' }}
          >
            <button
              type="button"
              onClick={() => setMotionPaused((prev) => !prev)}
              aria-label={motionPaused ? 'تشغيل فيديو الخلفية والحركة' : 'إيقاف فيديو الخلفية مؤقتاً'}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-[#C084FC]/35 bg-[#070D2B]/85 px-4 text-xs font-semibold text-[#EEF0FF] backdrop-blur-md transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/24 cursor-pointer"
            >
              {motionPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 text-[#C084FC]" aria-hidden="true" />
                  <span>تشغيل المشهد</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-[#C084FC]" aria-hidden="true" />
                  <span>إيقاف الحركة</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ===================================================================
            ACT 2 · REAL PUBLISHED COURSES SHOWCASE (Curved Overlapping Sheet)
           =================================================================== */}
        <BoslaCoursesShowcase initialData={coursesData} initialFailed={coursesFetchFailed} />

        {/* ===================================================================
            ACT 3 · THESIS MANIFESTO + FOUR OPERATIONAL PILLARS
           =================================================================== */}
        <section
          id="thesis-band"
          className="border-t border-[#22307A]/60 bg-[#050A24]"
          style={{ padding: 'clamp(76px, 11vw, 132px) clamp(18px, 4vw, 36px)' }}
          aria-label="ركيزة الفهم الميداني"
        >
          <div className="mx-auto max-w-[980px] border-s-2 border-[#6B21A8] py-2 ps-5 sm:ps-8">
            <p className="text-[clamp(1.45rem,3vw,2.45rem)] font-bold leading-[1.5] text-[#EEF0FF] bosla-display-font">
              {THESIS_PHRASES.map((phrase, idx) => (
                <span key={idx} className="bosla-thesis-phrase inline">
                  {phrase}{' '}
                </span>
              ))}
            </p>
          </div>
        </section>

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

            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 lg:grid-cols-4">
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
            ACT 4 · PEAK PROGRESSION: FROM STUDENT TO DIRECTOR
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

            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
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
            ACT 5 · REAL PARTNERS ("شركاؤنا") & PARTNER APPLICATION ("انضم كشريك")
           =================================================================== */}
        <BoslaPartnersSection partners={coursesData?.partners ?? []} />

        <BoslaPartnerApplySection />

        {/* ===================================================================
            ACT 6 · DIRECT INQUIRY + INSTITUTIONAL PORTAL PLINTH
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
                    className="flex min-h-[50px] items-center justify-between py-2.5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:text-[#77E2B5]"
                  >
                    <span className="flex items-center gap-2.5">
                      <MessageCircle className="h-4 w-4 text-[#77E2B5]" strokeWidth={1.6} aria-hidden="true" />
                      <span>واتساب المباشر</span>
                    </span>
                    <span dir="ltr" className="text-xs font-semibold text-[#C2CAF2] tabular-nums">
                      +{whatsappClean}
                    </span>
                  </a>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="flex min-h-[50px] items-center justify-between py-2.5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:text-[#C084FC]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                      <span>البريد الرسمي</span>
                    </span>
                    <span dir="ltr" className="text-xs font-semibold text-[#C2CAF2]">
                      {supportEmail}
                    </span>
                  </a>
                  <div className="flex min-h-[46px] items-center gap-2.5 py-2.5 text-xs font-semibold text-[#C2CAF2]">
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
                      <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
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
                        placeholder="مثال: د. كريم حسام"
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
                        className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
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
                        placeholder="مثال: مجموعة مزارع أو شركة أعلاف"
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
                      placeholder="اكتب باختصار سؤالك أو مجال العمل الذي ترغب في التنسيق بشأنه"
                      className="w-full min-h-[96px] rounded-lg border border-[#22307A] bg-[#050A24] p-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2.5 rounded-lg bg-[#6B21A8] px-7 text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87] disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-4 w-4 text-white" strokeWidth={1.6} aria-hidden="true" />
                    <span>{submitting ? 'جاري إرسال الرسالة...' : 'إرسال الرسالة الآن'}</span>
                  </button>
                </form>
              </div>
            </div>

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
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#C084FC]/40 bg-[#070D2B]/70 px-5 text-[0.925rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#6B21A8]/22"
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
