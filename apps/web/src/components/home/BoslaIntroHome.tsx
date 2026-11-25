'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Award,
  Briefcase,
  Building2,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import type { LearningPathCardData } from '@/components/catalog/LearningPathCard';
import {
  BoslaCoursesShowcase,
  type HomepageCoursesPayload,
  type HomepageDiplomaItem,
} from './BoslaCoursesShowcase';
import {
  BoslaHeroEditorial,
  type HeroCollectionTarget,
  type HomeStoryCardItem,
} from './BoslaHeroEditorial';
import { BoslaPartnerApplySection } from './BoslaPartnerApplySection';
import { BoslaPartnersSection } from './BoslaPartnersSection';
import { BoslaPricingSection } from './BoslaPricingSection';
import { BoslaTestimonialsSection } from './BoslaTestimonialsSection';
import { BoslaTrainersMarquee } from './BoslaTrainersMarquee';
import { HomepageShell } from './HomepageShell';

export interface HomeIntroContent {
  titleAr?: string | null;
  sloganAr?: string | null;
  subtitleAr?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

const REMOVED_SECTION_KEYS = new Set([
  'storytelling',
  'scene2',
  'pillars',
  'thesis',
  'elevation',
]);

const DEFAULT_SECTION_ORDER = [
  'hero',
  'courses',
  'pricing',
  'trainers',
  'testimonials',
  'partners',
  'partner_apply',
  'faq',
  'careers',
  'contact',
];

export function BoslaIntroHome({
  intro,
  coursesData,
  learningPaths = [],
  diplomas = [],
  coursesFetchFailed = false,
  liveLayout,
  onSelectSectionInEditor,
}: {
  intro?: HomeIntroContent;
  coursesData: HomepageCoursesPayload | null;
  learningPaths?: LearningPathCardData[];
  diplomas?: HomepageDiplomaItem[];
  coursesFetchFailed?: boolean;
  liveLayout?: any;
  onSelectSectionInEditor?: (sectionKey: string) => void;
}) {
  const { user, requiresPasskeyEnrollment } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);

  const liveConfig = liveLayout?.layout ?? liveLayout?.config;

  const isSectionVisible = (key: string) => {
    if (REMOVED_SECTION_KEYS.has(key)) return false;
    if (key === 'pricing' && liveConfig?.pricing?.visible === false) return false;
    if (key === 'faq' && liveConfig?.faqs?.visible === false) return false;
    if (liveConfig?.[key] && typeof liveConfig[key] === 'object' && 'visible' in liveConfig[key]) {
      return liveConfig[key].visible !== false;
    }
    const secs: Array<{ key: string; visible: boolean }> = liveConfig?.sections ?? [];
    const found = secs.find((s) => s.key === key);
    return found ? found.visible !== false : true;
  };

  const rootRef = useRef<HTMLDivElement>(null);

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
      if (document.querySelector('.bosla-course-reveal')) {
        ScrollTrigger.batch('.bosla-course-reveal', {
          start: 'top 92%',
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { y: 18 },
              {
                y: 0,
                duration: 0.48,
                stagger: 0.06,
                ease: 'power2.out',
                clearProps: 'transform',
              },
            ),
        });
      }

      if (document.querySelector('.bosla-partner-reveal')) {
        ScrollTrigger.batch('.bosla-partner-reveal', {
          start: 'top 92%',
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { y: 16 },
              {
                y: 0,
                duration: 0.48,
                stagger: 0.07,
                ease: 'power2.out',
                clearProps: 'transform',
              },
            ),
        });
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
  const whatsappClean =
    (liveConfig?.contact?.whatsapp || intro?.whatsapp || '+201001226683').replace(/[^0-9]/g, '') ||
    '201001226683';
  const supportEmail = liveConfig?.contact?.email || intro?.email || 'support@boslaagri.com';

  const scrollToElementId = (elementId: string) => {
    const target = document.getElementById(elementId);
    if (!target) return;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 86);
    const dist = Math.abs(top - window.scrollY);
    const reduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    window.scrollTo({
      top,
      behavior: reduced || dist > window.innerHeight * 1.1 ? ('instant' as ScrollBehavior) : 'smooth',
    });
  };

  const handleJumpToCatalog = (_collection: HeroCollectionTarget = 'ALL') => {
    scrollToElementId('courses-showcase');
  };

  const configuredSocials = [
    { label: 'فيسبوك', href: liveConfig?.social?.facebookUrl },
    { label: 'يوتيوب', href: liveConfig?.social?.youtubeUrl },
    { label: 'لينكدإن', href: liveConfig?.social?.linkedinUrl },
    { label: 'إنستجرام', href: liveConfig?.social?.instagramUrl },
    { label: 'منصة X', href: liveConfig?.social?.xUrl },
  ].filter((item) => Boolean(item.href && /^https?:\/\//i.test(item.href)));

  const sanitizeLegacyHeroTitle = (raw?: string | null) => {
    if (!raw) return 'معرفة تتحوّل إلى خبرة';
    const trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed === 'أكاديمية بوصلة' ||
      trimmed === 'أكاديمية بوصلة | من الطالب إلى المدير' ||
      trimmed === 'التأهيل التطبيقي للطب البيطري والإنتاج الحيواني'
    ) {
      return 'معرفة تتحوّل إلى خبرة';
    }
    return trimmed;
  };

  const heroTitleAr = sanitizeLegacyHeroTitle(liveConfig?.hero?.titleAr || intro?.titleAr);
  const heroSubtitleAr =
    liveConfig?.hero?.subtitleAr ||
    intro?.subtitleAr ||
    'منصة تعليمية تطبيقية تجمع بين الكورسات المعتمدة، المسارات المتدرجة، والدبلومات المهنية في الدواجن والطب البيطري والتغذية وإدارة الأعمال.';

  const storyItems = useMemo<HomeStoryCardItem[]>(() => {
    const items: HomeStoryCardItem[] = [];
    const seenSlugs = new Set<string>();
    const chosenIds: string[] =
      liveConfig?.featuredCourseIds ?? liveConfig?.courses?.selectedCourseIds ?? [];

    const rawCourses = [...(coursesData?.courses ?? [])].sort((a, b) => {
      const ia = chosenIds.indexOf(a.id);
      const ib = chosenIds.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });

    for (const c of rawCourses) {
      if (items.length >= 12) break;
      if (!c.slug || seenSlugs.has(`course:${c.slug}`)) continue;
      seenSlugs.add(`course:${c.slug}`);
      items.push({
        uid: `course:${c.id}`,
        kind: 'course',
        kindLabelAr: c.category?.nameAr || 'كورس تطبيقي',
        titleAr: c.titleAr,
        href: `/courses/${c.slug}`,
        thumbnailUrl: c.thumbnailUrl || '/images/brand/course-biosecurity.webp',
        coverFocalX: (c as any).coverFocalX ?? 50,
        coverFocalY: (c as any).coverFocalY ?? 50,
        coverFitMode: (c as any).coverFitMode ?? 'COVER',
        metaAr:
          c.durationMinutes > 0
            ? `${Math.max(1, Math.round(c.durationMinutes / 60))} ساعات`
            : `${c.lessonCount} دروس`,
        priceLabelAr: c.isFree
          ? 'مجاني'
          : c.priceCents > 0
            ? formatEgp(c.priceCents)
            : 'ضمن العضوية',
      });
    }

    for (const p of learningPaths) {
      if (items.length >= 12) break;
      if (!p.slug || seenSlugs.has(`path:${p.slug}`)) continue;
      seenSlugs.add(`path:${p.slug}`);
      items.push({
        uid: `path:${p.id}`,
        kind: 'path',
        kindLabelAr: 'مسار تعليمي',
        titleAr: p.titleAr,
        href: `/learning-paths/${p.slug}`,
        thumbnailUrl: p.thumbnailUrl || '/images/brand/track-poultry.webp',
        coverFocalX: p.coverFocalX ?? 50,
        coverFocalY: p.coverFocalY ?? 50,
        coverFitMode: p.coverFitMode ?? 'COVER',
        metaAr: `${p.courses?.length ?? 0} كورسات`,
        priceLabelAr: 'مسار متدرج',
      });
    }

    for (const d of diplomas) {
      if (items.length >= 12) break;
      if (!d.slug || seenSlugs.has(`diploma:${d.slug}`)) continue;
      seenSlugs.add(`diploma:${d.slug}`);
      items.push({
        uid: `diploma:${d.id}`,
        kind: 'diploma',
        kindLabelAr: 'دبلومة مهنية',
        titleAr: d.titleAr,
        href: `/diplomas/${d.slug}`,
        thumbnailUrl: d.thumbnailUrl || '/images/brand/course-vet-marketing.webp',
        coverFocalX: d.coverFocalX ?? 50,
        coverFocalY: d.coverFocalY ?? 50,
        coverFitMode: d.coverFitMode ?? 'COVER',
        metaAr: `${d.totalHours || 0} ساعة`,
        priceLabelAr: 'شهادة معتمدة',
      });
    }

    return items;
  }, [
    coursesData?.courses,
    diplomas,
    learningPaths,
    liveConfig?.courses?.selectedCourseIds,
    liveConfig?.featuredCourseIds,
  ]);

  const orderedSectionKeys: string[] = (() => {
    const srcOrder: string[] =
      Array.isArray(liveConfig?.sectionOrder) && liveConfig.sectionOrder.length > 0
        ? liveConfig.sectionOrder
        : DEFAULT_SECTION_ORDER;
    const filtered = srcOrder.filter((k) => !REMOVED_SECTION_KEYS.has(k));
    for (const reqKey of DEFAULT_SECTION_ORDER) {
      if (!filtered.includes(reqKey) && !(reqKey === 'faq' && filtered.includes('faqs'))) {
        filtered.push(reqKey);
      }
    }
    return filtered;
  })();

  const faqList: Array<{ id?: string; questionAr: string; answerAr: string }> =
    Array.isArray(liveConfig?.faqs) && liveConfig.faqs.length > 0
      ? liveConfig.faqs
      : Array.isArray(liveLayout?.faqs)
        ? liveLayout.faqs
        : [];

  const partnersList =
    Array.isArray(liveConfig?.partners) && liveConfig.partners.length > 0
      ? liveConfig.partners.map((p: any, idx: number) => ({
          id: p.id || `lp_${idx}`,
          nameAr: p.nameAr,
          logoUrl: p.logoUrl || null,
          websiteUrl: p.websiteUrl || null,
          descriptionAr: p.descriptionAr || null,
        }))
      : (liveLayout?.partners?.length ? liveLayout.partners : coursesData?.partners) ?? [];

  const renderSection = (key: string) => {
    switch (key) {
      case 'hero':
        if (!isSectionVisible('hero')) return null;
        return (
          <BoslaHeroEditorial
            key="hero"
            badgeAr={liveConfig?.hero?.badgeAr || 'أكاديمية بوصلة للتأهيل الميداني'}
            titleAr={heroTitleAr}
            subtitleAr={heroSubtitleAr}
            primaryCtaLabelAr={liveConfig?.hero?.primaryCtaLabelAr || 'استكشف المحتوى'}
            primaryCtaHref={liveConfig?.hero?.primaryCtaHref || '#courses-showcase'}
            secondaryCtaLabelAr={liveConfig?.hero?.secondaryCtaLabelAr || 'ابدأ الانضمام للأكاديمية'}
            secondaryCtaHref={
              !user
                ? liveConfig?.hero?.secondaryCtaHref || '/register'
                : requiresPasskeyEnrollment
                  ? '/security/passkey-setup'
                  : primaryDash.href
            }
            motionPaused={motionPaused}
            storyItems={storyItems}
            onJumpToCatalog={handleJumpToCatalog}
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('hero') : undefined
            }
          />
        );

      case 'courses':
        if (!isSectionVisible('courses')) return null;
        return (
          <div key="courses" onClick={() => onSelectSectionInEditor?.('courses')}>
            <BoslaCoursesShowcase
              initialData={coursesData}
              initialFailed={coursesFetchFailed}
              learningPaths={learningPaths}
              diplomas={diplomas}
              featuredCourseIds={
                liveConfig?.featuredCourseIds ?? liveConfig?.courses?.selectedCourseIds ?? []
              }
              titleAr={liveConfig?.courses?.titleAr}
              subtitleAr={liveConfig?.courses?.subtitleAr}
              motionPaused={motionPaused}
            />
          </div>
        );

      case 'pricing':
        if (!isSectionVisible('pricing')) return null;
        return (
          <BoslaPricingSection
            key="pricing"
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
        );

      case 'trainers':
        if (!isSectionVisible('trainers') || !(liveLayout?.trainers?.length > 0)) return null;
        return (
          <BoslaTrainersMarquee
            key="trainers"
            trainers={liveLayout.trainers}
            titleAr={liveConfig?.trainers?.titleAr}
            subtitleAr={liveConfig?.trainers?.subtitleAr}
            autoSpeedSeconds={liveConfig?.trainers?.autoSpeedSeconds}
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('trainers') : undefined
            }
          />
        );

      case 'testimonials':
        if (!isSectionVisible('testimonials') || !(liveLayout?.testimonials?.length > 0)) {
          return null;
        }
        return (
          <BoslaTestimonialsSection
            key="testimonials"
            testimonials={liveLayout.testimonials}
            titleAr={liveConfig?.testimonials?.titleAr}
            subtitleAr={liveConfig?.testimonials?.subtitleAr}
            onSelectSectionInEditor={
              onSelectSectionInEditor ? () => onSelectSectionInEditor('testimonials') : undefined
            }
          />
        );

      case 'partners':
        if (!isSectionVisible('partners')) return null;
        return (
          <div key="partners" onClick={() => onSelectSectionInEditor?.('partners')}>
            <BoslaPartnersSection
              partners={partnersList}
              titleAr={
                (!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.titleAr) ||
                undefined
              }
              subtitleAr={
                (!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.subtitleAr) ||
                undefined
              }
              ctaLabelAr={
                (!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.ctaLabelAr) ||
                'انضم كشريك نجاح'
              }
              ctaHref={
                (!Array.isArray(liveConfig?.partners) && liveConfig?.partners?.ctaHref) ||
                '#partner-apply'
              }
            />
          </div>
        );

      case 'partner_apply':
        if (!isSectionVisible('partner_apply') && !isSectionVisible('partners')) return null;
        return (
          <BoslaPartnerApplySection
            key="partner_apply"
            titleAr={liveConfig?.partner_apply?.titleAr || 'انضم كشريك'}
            subtitleAr={liveConfig?.partner_apply?.subtitleAr}
          />
        );

      case 'faq':
      case 'faqs':
        if (!isSectionVisible('faq') && !isSectionVisible('faqs')) return null;
        if (faqList.length === 0) return null;
        return (
          <section
            key="faq"
            id="faqs"
            data-testid="homepage-faqs-section"
            onClick={() => onSelectSectionInEditor?.('faqs')}
            className="border-t border-[#4A1FB0]/18 bg-[#C6E2F5] py-16 sm:py-20 text-[#17243D]"
          >
            <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs font-extrabold text-[#351078]">الأسئلة الشائعة</p>
                <h2 className="text-2xl sm:text-3xl font-black text-[#17243D] bosla-display-font">
                  {liveConfig?.faq?.titleAr || 'إجابات واضحة حول الدراسة والاشتراك في بوصلة'}
                </h2>
              </div>
              <div className="space-y-3">
                {faqList.map((faq, idx) => (
                  <details
                    key={faq.id || idx}
                    open={idx === 0}
                    className="rounded-2xl border border-[#4A1FB0]/20 bg-[#ADD5F0] p-4 transition-colors open:border-[#4A1FB0] open:bg-[#FFFFFF]"
                  >
                    <summary className="cursor-pointer text-sm sm:text-base font-extrabold text-[#17243D]">
                      {faq.questionAr}
                    </summary>
                    <p className="mt-2.5 text-xs sm:text-sm leading-relaxed font-medium text-[#263959]">
                      {faq.answerAr}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        );

      case 'contact':
        if (!isSectionVisible('contact')) return null;
        return (
          <section
            key="contact"
            id="contact"
            onClick={() => onSelectSectionInEditor?.('contact')}
            className="relative overflow-hidden border-t border-[#4A1FB0]/18 bg-[#ADD5F0] py-16 sm:py-20 text-[#17243D]"
            aria-label="التواصل المباشر وبوابة الدخول"
          >
            <div className="mx-auto max-w-[1320px] px-4 sm:px-8 space-y-12">
              <div className="grid gap-10 lg:grid-cols-12 items-start">
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-extrabold text-[#351078]">القنوات الرسمية</p>
                    <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-[1.28] text-[#17243D] bosla-display-font">
                      {liveConfig?.contact?.titleAr || 'التواصل المباشر وخطط التأهيل المؤسسي'}
                    </h2>
                    <p className="text-sm sm:text-base leading-[1.75] font-medium text-[#263959]">
                      {liveConfig?.contact?.subtitleAr ||
                        'للاستفسارات الفردية أو لترتيب خطط التأهيل المؤسسي لفرق الشركات والمزارع ومصانع الأعلاف، تواصل مباشرة مع فريق بوصلة.'}
                    </p>
                  </div>

                  <div className="divide-y divide-[#17243D]/15 border-y border-[#17243D]/15">
                    <a
                      href={`https://wa.me/${whatsappClean}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-h-[48px] items-center justify-between py-2.5 text-sm font-extrabold text-[#17243D] transition-colors hover:text-[#0F5C4E]"
                    >
                      <span className="flex items-center gap-2.5">
                        <MessageCircle className="h-4 w-4 text-[#0F5C4E]" strokeWidth={1.8} aria-hidden="true" />
                        <span>واتساب المباشر</span>
                      </span>
                      <bdi dir="ltr" className="text-xs font-extrabold text-[#263959] tabular-nums">
                        +{whatsappClean}
                      </bdi>
                    </a>
                    <a
                      href={`mailto:${supportEmail}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-h-[48px] items-center justify-between py-2.5 text-sm font-extrabold text-[#17243D] transition-colors hover:text-[#4A1FB0]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Mail className="h-4 w-4 text-[#4A1FB0]" strokeWidth={1.8} aria-hidden="true" />
                        <span>البريد الرسمي</span>
                      </span>
                      <bdi dir="ltr" className="text-xs font-extrabold text-[#263959]">
                        {supportEmail}
                      </bdi>
                    </a>
                    <div className="flex min-h-[48px] items-center gap-2.5 py-2.5 text-xs font-extrabold text-[#263959]">
                      <MapPin className="h-4 w-4 text-[#4A1FB0] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                      <span>{liveConfig?.contact?.addressAr || 'القاهرة، جمهورية مصر العربية'}</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-3xl border-2 border-[#4A1FB0]/25 bg-[#C6E2F5] p-6 sm:p-8 space-y-6">
                    <div className="border-b border-[#17243D]/12 pb-4 space-y-1.5">
                      <h3 className="text-lg sm:text-xl font-black text-[#17243D] bosla-display-font">
                        القنوات المباشرة والخدمات الرسمية
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-[#263959]">
                        لشراكات الأعمال والدعم الفني والتحقق من الاعتمادات، اختر المسار المخصص مباشرة.
                      </p>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2 text-xs sm:text-sm">
                      <a
                        href="#partner-apply"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-2xl border border-[#4A1FB0]/22 bg-[#FFFFFF] p-4 hover:border-[#4A1FB0] transition-colors space-y-1.5 block"
                      >
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-[#17243D]">
                          <Building2 className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                          انضم كشريك نجاح
                        </span>
                        <p className="text-xs font-medium text-[#263959]">
                          لتدريب الفرق والشراكات الميدانية ورعاية المناهج.
                        </p>
                      </a>

                      <Link
                        href="/support"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-2xl border border-[#4A1FB0]/22 bg-[#FFFFFF] p-4 hover:border-[#4A1FB0] transition-colors space-y-1.5 block"
                      >
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-[#17243D]">
                          <LifeBuoy className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                          مركز الدعم والتذاكر
                        </span>
                        <p className="text-xs font-medium text-[#263959]">
                          للمساعدة في الحسابات والاشتراكات والتشغيل.
                        </p>
                      </Link>

                      <Link
                        href="/certificates/verify"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-2xl border border-[#4A1FB0]/22 bg-[#FFFFFF] p-4 hover:border-[#0F5C4E] transition-colors space-y-1.5 block"
                      >
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-[#17243D]">
                          <Award className="h-4 w-4 text-[#0F5C4E]" aria-hidden="true" />
                          التحقق من الشهادات والتوصيات
                        </span>
                        <p className="text-xs font-medium text-[#263959]">
                          توثيق فوري للشهادات وخطابات التوصية المعتمدة.
                        </p>
                      </Link>

                      <Link
                        href="/careers"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-2xl border border-[#4A1FB0]/22 bg-[#FFFFFF] p-4 hover:border-[#4A1FB0] transition-colors space-y-1.5 block"
                      >
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-[#17243D]">
                          <Briefcase className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                          الوظائف وفرص الانضمام
                        </span>
                        <p className="text-xs font-medium text-[#263959]">
                          استعرض الفرص الوظيفية المتاحة في فريق بوصلة.
                        </p>
                      </Link>
                    </div>

                    {configuredSocials.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-[#17243D]/12 pt-4 text-xs">
                        <span className="font-extrabold text-[#263959] me-1">حساباتنا الرسمية:</span>
                        {configuredSocials.map((s) => (
                          <a
                            key={s.label}
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3 py-1.5 font-extrabold text-[#17243D] hover:border-[#4A1FB0] hover:text-[#4A1FB0]"
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Grounded Deep-Purple Portal Bar */}
              <div className="rounded-3xl bg-[#351078] p-6 sm:p-9 text-white flex flex-wrap items-center justify-between gap-6 shadow-[0_24px_48px_-24px_rgba(53,16,120,0.45)]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 p-2">
                    <img
                      src="/images/brand/bosla-logo.webp"
                      alt="بوصلة"
                      width={34}
                      height={34}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <div>
                    <h2 className="text-[clamp(1.2rem,2vw,1.6rem)] font-black text-white mb-1 bosla-display-font">
                      بوصلة للإنتاج الحيواني والداجني
                    </h2>
                    <p className="text-xs sm:text-sm text-[#ADD5F0] font-semibold">
                      بوابة الدخول الآمن للمتدربين والمدربين والمؤسسات المسجلة
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/courses"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/20"
                  >
                    كتالوج الكورسات
                  </Link>
                  {!user ? (
                    <>
                      <Link
                        href="/login"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/30 bg-transparent px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                      >
                        تسجيل الدخول
                      </Link>
                      <Link
                        href="/register"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#FFFFFF] px-5 text-sm font-extrabold text-[#351078] transition-colors hover:bg-[#C6E2F5]"
                      >
                        إنشاء حساب جديد
                      </Link>
                    </>
                  ) : requiresPasskeyEnrollment ? (
                    <Link
                      href="/security/passkey-setup"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#FFFFFF] px-5 text-sm font-extrabold text-[#351078] transition-colors hover:bg-[#C6E2F5]"
                    >
                      استكمال تفعيل الحساب
                    </Link>
                  ) : (
                    <Link
                      href={primaryDash.href}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#FFFFFF] px-5 text-sm font-extrabold text-[#351078] transition-colors hover:bg-[#C6E2F5]"
                    >
                      الدخول إلى البوابة
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <HomepageShell
      motionPaused={motionPaused}
      onToggleMotion={() => setMotionPaused((prev) => !prev)}
      liveConfig={liveConfig}
      careersCount={liveLayout?.careersCount ?? 0}
    >
      <div ref={rootRef} className="w-full overflow-x-clip">
        {orderedSectionKeys.map((key) => renderSection(key))}
      </div>
    </HomepageShell>
  );
}
