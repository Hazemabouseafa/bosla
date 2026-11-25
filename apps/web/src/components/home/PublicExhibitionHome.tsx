'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { rankSpecializationDomains } from '@bosla/shared';
import { apiFetch, formatNumber } from '@/lib/api';
import { resolveSectionVisibility } from '@/lib/section-visibility';
import {
  AlertBanner,
  Button,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import {
  BoslaAstrolabeHeroSvg,
  BoslaMeridianTraceSvg,
  BoslaPortalSealSvg,
  BoslaSchematicSvg,
} from '@/components/svg/BoslaExhibitionSvgs';
import type { HomeBundle } from './HomeExperience';

const DOCTRINE_CHAPTERS = [
  {
    code: '01',
    bearing: 22,
    kicker: 'الطبقة الأولى: كسر عزلة التلقي',
    title: 'الكتاب الجامعي يشرح الفسيولوجيا، لكنه لا يقرأ ميزانية عنبر تحت ضغط التشغيل',
    body: 'الفجوة بين مقاعد الدراسة وواقع الإنتاج الداجني والبيطري هي أخطر نقطة انكسار مهني. داخل بوصلة، يبدأ التدريب من قلب الموقف التشغيلي الحقيقي لا من تعريفات مكررة.',
    telemetry: 'تشخيص الفجوة التشغيلية قبل التحصين أو التسويق.',
  },
  {
    code: '02',
    bearing: 138,
    kicker: 'الطبقة الثانية: هندسة القرار الحرج',
    title: 'من طبيب يكتب روشتة منفردة إلى استشاري يحسب تكلفة الكيلو ومعامل التحويل',
    body: 'ننقل إليك نماذج التفكير التنفيذي من مديري المزارع والشركات: كيف تُصمّم منظومة أمان حيوي مغلقة، وكيف تقرأ انحراف القطيع قبل تحوله إلى خسارة مالية.',
    telemetry: 'ربط التشخيص البيطري باقتصاديات العائد اليومي.',
  },
  {
    code: '03',
    bearing: 258,
    kicker: 'الطبقة الثالثة: سيادة القيادة والاعتماد',
    title: 'مسار مغلق ينتهي بمؤهل قيادي موثّق وبرمز تحقق تسلسلي أمام جهات التوظيف',
    body: 'تتدرج داخل الأكاديمية عبر وحدات تطبيقية وتقييمات عملية ومشروع تخرج يُراجع من خبراء القطاع، لتنتقل بثقة من دور المنفذ إلى مدير يقود الفريق والسوق.',
    telemetry: 'اعتماد رقمي موثق برمز تحقق تسلسلي فريد.',
  },
];

const METHODOLOGY_PILLARS = [
  {
    index: '01',
    iconSrc: '/icons/bosla/pillar-field.svg',
    discipline: 'التطبيق الميداني',
    title: 'نماذج تشغيل حقيقية من عنابر الإنتاج',
    description:
      'دراسة حالات أزمات حقلية، بروتوكولات الأمان الحيوي، وصياغة العلائق الاقتصادية تحت إشراف مباشر.',
  },
  {
    index: '02',
    iconSrc: '/icons/bosla/pillar-mentors.svg',
    discipline: 'الإرشاد الاستشاري',
    title: 'نقل خبرة قادة الشركات والمزارع الكبرى',
    description:
      'تعلم من استشاريين يديرون خطوط إنتاج ومبيعات أدوية بيطرية وإضافات أعلاف في المنطقة العربية.',
  },
  {
    index: '03',
    iconSrc: '/icons/bosla/pillar-cert.svg',
    discipline: 'الاعتماد المزدوج',
    title: 'شهادات إتمام وكفاءة قابلة للتحقق الفوري',
    description:
      'منظومة مزدوجة توثّق الإتمام التلقائي ثم تمنح شهادة الكفاءة المهنية بعد المراجعة والتقييم الفعلي.',
  },
  {
    index: '04',
    iconSrc: '/icons/bosla/pillar-vault.svg',
    discipline: 'الحماية المغلقة',
    title: 'بيئة خاصة للأعضاء وبث محمي بالهوية الرقمية',
    description:
      'مكتبة كاملة مغلقة بالبصمة ومفاتيح الأمان، تفتح لك المسارات والدروس ومجتمعات النقاش فور تسجيل الدخول.',
  },
];

export function PublicExhibitionHome({ data }: { data: HomeBundle }) {
  const sec = resolveSectionVisibility(
    data?.sectionVisibility ??
      data?.settings?.section_visibility ??
      data?.settings?.sectionVisibility,
  );

  // Interactive Hero Astrolabe & Magnet CTA Refs (zero re-render rAF loops)
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const heroNeedleRef = useRef<SVGGElement | null>(null);
  const magnetCtaRef = useRef<HTMLAnchorElement | null>(null);
  const [heroAngle, setHeroAngle] = useState(24);

  // Peak Pinned Self-Drawing Schematic Refs
  const storyActRef = useRef<HTMLElement | null>(null);
  const layer1Ref = useRef<SVGGElement | null>(null);
  const layer2Ref = useRef<SVGGElement | null>(null);
  const layer3Ref = useRef<SVGGElement | null>(null);
  const schematicNeedleRef = useRef<SVGGElement | null>(null);
  const [storyStage, setStoryStage] = useState(0);

  // Bottom Horizon Rail Telemetry Refs (Signature Move)
  const hudTraceRef = useRef<SVGPathElement | null>(null);
  const hudDegRef = useRef<HTMLSpanElement | null>(null);
  const hudLabelRef = useRef<HTMLSpanElement | null>(null);

  // Specialization Compass Interactive State
  const [quizStep, setQuizStep] = useState<number>(0);
  const [dimScores, setDimScores] = useState<Record<string, number>>({});
  const [speciesScores, setSpeciesScores] = useState<Record<string, number>>({});
  const [rankedResults, setRankedResults] = useState<any[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // B2B / Individual Lead State
  const [leadType] = useState<'INDIVIDUAL' | 'CORPORATE_B2B'>('CORPORATE_B2B');
  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSector, setLeadSector] = useState('دواجن');
  const [leadTeamSize, setLeadTeamSize] = useState('10-50');
  const [leadNeed, setLeadNeed] = useState('تطوير مهارات الفريق الميداني');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);

  // Partner Modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [sponsorOrg, setSponsorOrg] = useState('');
  const [sponsorStatus, setSponsorStatus] = useState<string | null>(null);

  // 1. Fine-pointer Astrolabe Compass & Magnetic CTA rAF Controller
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !finePointer) return;

    const section = heroSectionRef.current;
    const needle = heroNeedleRef.current;
    const magnetEl = magnetCtaRef.current;
    if (!section) return;

    let currentDeg = heroAngle;
    let targetDeg = heroAngle;
    let pointerActive = false;
    let magnetTx = 0;
    let magnetTy = 0;
    let magnetCurX = 0;
    let magnetCurY = 0;
    let rafId = 0;

    const tick = () => {
      rafId = 0;
      let needsMore = false;

      if (needle && pointerActive) {
        const diff = ((((targetDeg - currentDeg) % 360) + 540) % 360) - 180;
        currentDeg += diff * 0.14;
        needle.style.transform = `rotate(${currentDeg.toFixed(2)}deg)`;
        if (Math.abs(diff) > 0.25) needsMore = true;
      }

      if (magnetEl) {
        magnetCurX += (magnetTx - magnetCurX) * 0.18;
        magnetCurY += (magnetTy - magnetCurY) * 0.18;
        magnetEl.style.transform = `translate3d(${magnetCurX.toFixed(2)}px, ${magnetCurY.toFixed(2)}px, 0)`;
        if (Math.abs(magnetTx - magnetCurX) > 0.1 || Math.abs(magnetTy - magnetCurY) > 0.1) {
          needsMore = true;
        }
      }

      if (needsMore) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const scheduleTick = () => {
      if (!rafId) rafId = window.requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (needle) {
        const rect = needle.ownerSVGElement?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
          targetDeg = angle;
          pointerActive = true;
        }
      }
      if (magnetEl) {
        const mRect = magnetEl.getBoundingClientRect();
        const dx = e.clientX - (mRect.left + mRect.width / 2);
        const dy = e.clientY - (mRect.top + mRect.height / 2);
        if (Math.hypot(dx, dy) < 120) {
          magnetTx = Math.max(-10, Math.min(10, dx * 0.16));
          magnetTy = Math.max(-8, Math.min(8, dy * 0.16));
        } else {
          magnetTx = 0;
          magnetTy = 0;
        }
      }
      scheduleTick();
    };

    const onLeave = () => {
      pointerActive = false;
      magnetTx = 0;
      magnetTy = 0;
      if (needle) needle.style.transform = `rotate(${heroAngle}deg)`;
      scheduleTick();
    };

    section.addEventListener('pointermove', onMove, { passive: true });
    section.addEventListener('pointerleave', onLeave);
    return () => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [heroAngle]);

  // 2. Peak Pinned Self-Drawing SVG Controller (reads ScrollMotionSystem sc:progress)
  useEffect(() => {
    const actEl = storyActRef.current;
    if (!actEl) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    const applySchematic = (p: number) => {
      const clamped = Math.max(0, Math.min(1, p));
      const p1 = Math.max(0, Math.min(1, clamped / 0.36));
      const p2 = Math.max(0, Math.min(1, (clamped - 0.28) / 0.42));
      const p3 = Math.max(0, Math.min(1, (clamped - 0.6) / 0.36));

      if (layer1Ref.current) layer1Ref.current.style.strokeDashoffset = (1 - p1).toFixed(4);
      if (layer2Ref.current) layer2Ref.current.style.strokeDashoffset = (1 - p2).toFixed(4);
      if (layer3Ref.current) layer3Ref.current.style.strokeDashoffset = (1 - p3).toFixed(4);
      if (schematicNeedleRef.current) {
        const rot = 18 + clamped * 240;
        schematicNeedleRef.current.style.transform = `rotate(${rot.toFixed(1)}deg)`;
      }

      const stage = clamped < 0.34 ? 0 : clamped < 0.68 ? 1 : 2;
      setStoryStage((prev) => (prev === stage ? prev : stage));
    };

    if (reduced || !isDesktop) {
      applySchematic(1);
      return;
    }

    const onProgress = (evt: Event) => {
      const p = Number((evt as CustomEvent<{ p: number }>).detail?.p ?? 0);
      applySchematic(p);
    };

    actEl.addEventListener('sc:progress', onProgress);
    applySchematic(0.08);
    return () => actEl.removeEventListener('sc:progress', onProgress);
  }, []);

  // 3. Persistent Bottom Meridian Horizon Rail Scroll Sync
  useEffect(() => {
    let raf = 0;
    const anchors = [
      { id: 'exhibition-open', label: '01 الاستهلال' },
      { id: 'story', label: '02 المرسم التطبيقي' },
      { id: 'methodology', label: '03 البنية والأركان' },
      { id: 'specialization-quiz', label: '04 بوصلة التخصص' },
      { id: 'join-academy', label: '05 البوابة المغلقة' },
    ];

    const syncHud = () => {
      raf = 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.max(0, Math.min(1, window.scrollY / maxScroll));

      if (hudTraceRef.current) {
        hudTraceRef.current.style.strokeDashoffset = (1 - p).toFixed(4);
      }
      if (hudDegRef.current) {
        hudDegRef.current.textContent = `${String(Math.round(p * 360)).padStart(3, '0')}°`;
      }
      if (hudLabelRef.current) {
        const idx = p < 0.16 ? 0 : p < 0.44 ? 1 : p < 0.66 ? 2 : p < 0.85 ? 3 : 4;
        hudLabelRef.current.textContent = anchors[idx].label;
      }
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(syncHud);
    };

    syncHud();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // Manual click handler on Pinned Stage Chapters
  const jumpStoryChapter = (idx: number) => {
    setStoryStage(idx);
    const ratios = [0.15, 0.5, 0.88];
    const targetP = ratios[idx] ?? 0.5;
    if (layer1Ref.current) layer1Ref.current.style.strokeDashoffset = idx >= 0 ? '0' : '1';
    if (layer2Ref.current) layer2Ref.current.style.strokeDashoffset = idx >= 1 ? '0' : '1';
    if (layer3Ref.current) layer3Ref.current.style.strokeDashoffset = idx >= 2 ? '0' : '1';
    if (schematicNeedleRef.current) {
      schematicNeedleRef.current.style.transform = `rotate(${DOCTRINE_CHAPTERS[idx].bearing}deg)`;
    }
    if (storyActRef.current && window.innerWidth >= 1024) {
      const top = storyActRef.current.getBoundingClientRect().top + window.scrollY;
      const travel = Math.max(0, storyActRef.current.offsetHeight - window.innerHeight);
      window.scrollTo({ top: top + travel * targetP, behavior: 'smooth' });
    }
  };

  // Quiz handlers
  const questions = data?.specialization?.questions ?? [];
  const currentQuestion = questions[quizStep];
  const quizBearing = rankedResults
    ? 360
    : Math.min(330, quizStep * 68 + 24);

  const handleQuizOption = async (option: {
    label?: string;
    labelAr?: string;
    weights?: string;
    species?: string;
    dimensionWeights?: Record<string, number>;
    speciesWeights?: Record<string, number>;
  }) => {
    const nextDim = { ...dimScores };
    const nextSpecies = { ...speciesScores };
    for (const [k, v] of Object.entries(option.dimensionWeights ?? {})) {
      nextDim[k] = (nextDim[k] ?? 0) + Number(v);
    }
    for (const match of (option.weights ?? '').match(/[a-z]\d/g) ?? []) {
      nextDim[match[0]] = (nextDim[match[0]] ?? 0) + Number(match[1]);
    }
    for (const [k, v] of Object.entries(option.speciesWeights ?? {})) {
      nextSpecies[k] = (nextSpecies[k] ?? 0) + Number(v);
    }
    if (option.species) {
      nextSpecies[option.species] = (nextSpecies[option.species] ?? 0) + 1;
    }
    setDimScores(nextDim);
    setSpeciesScores(nextSpecies);

    if (quizStep + 1 < questions.length) {
      setQuizStep(quizStep + 1);
    } else {
      const domains = data?.specialization?.domains ?? [];
      if (domains.length > 0) {
        const instantRanked = rankSpecializationDomains(
          domains.map((d: any) => ({
            id: d.id,
            slug: d.slug,
            nameAr: d.nameAr,
            descriptionAr: d.descriptionAr ?? '',
            weightsCode: d.weightsCode ?? '',
            speciesCode: d.speciesCode ?? '',
            leafCount: Array.isArray(d.subfields)
              ? d.subfields.reduce(
                  (acc: number, sf: any) => acc + (sf.leaves?.length ?? 0),
                  0,
                )
              : 0,
          })),
          nextDim,
          nextSpecies,
        )
          .slice(0, 3)
          .map((r) => ({
            ...r,
            domain: domains.find((d: any) => d.id === r.id),
          }));
        setRankedResults(instantRanked);
      } else {
        setRankingLoading(true);
      }

      try {
        const ranked = await apiFetch<any[]>('/catalog/specialization/rank', {
          method: 'POST',
          body: JSON.stringify({
            dimensionScores: nextDim,
            speciesScores: nextSpecies,
          }),
        });
        setRankedResults(ranked);
      } catch {
        // Keep local instant ranking
      } finally {
        setRankingLoading(false);
      }
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setDimScores({});
    setSpeciesScores({});
    setRankedResults(null);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    setLeadSuccess(null);
    setLeadBusy(true);
    try {
      const created = await apiFetch<{ leadScore: number | null }>('/catalog/leads', {
        method: 'POST',
        body: JSON.stringify({
          type: leadType,
          fullName: leadName,
          companyName: leadType === 'CORPORATE_B2B' ? leadCompany : undefined,
          phoneNumber: leadPhone,
          countryCode: '+20',
          sector: leadSector,
          teamSize: leadType === 'CORPORATE_B2B' ? leadTeamSize : undefined,
          need: leadNeed,
          timeline: 'خلال 30 يوم',
          notes: leadNotes,
        }),
      });
      setLeadSuccess(
        created?.leadScore
          ? `تم استلام طلبك للشركة بنجاح (درجة الجاهزية: ${formatNumber(created.leadScore)}/7). سيتواصل معكم فريق بوصلة للتدريب المؤسسي قريباً.`
          : 'تم تسجيل طلبك الاستشاري بنجاح، وسيتواصل معك مستشار التعلم في بوصلة عبر الواتساب أو الهاتف.',
      );
      setLeadName('');
      setLeadCompany('');
      setLeadPhone('');
      setLeadNotes('');
    } catch (err: any) {
      setLeadError(err?.message || 'تعذر إرسال الطلب، يرجى التحقق من رقم الهاتف والمحاولة.');
    } finally {
      setLeadBusy(false);
    }
  };

  const handleSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/catalog/leads', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SPONSOR',
          fullName: sponsorOrg || 'طلب رعاية شركات',
          companyName: sponsorOrg,
          phoneNumber: sponsorPhone,
          countryCode: '+20',
          need: 'رعاية دبلومة أو شراكة تعليمية',
        }),
      });
      setSponsorStatus('تم تسجيل طلب الشراكة بنجاح وسيتواصل معكم مدير الشراكات.');
      setSponsorPhone('');
      setSponsorOrg('');
    } catch (err: any) {
      setSponsorStatus(err?.message || 'تعذر إرسال الطلب.');
    }
  };

  const leadTestimonial = data.testimonials?.[0];
  const secondaryTestimonials = data.testimonials?.slice(1, 3) ?? [];

  return (
    <div className="relative bg-[#050A24] text-[#EEF0FF] pb-10">
      {/* =====================================================================
          PERSISTENT HORIZON RAIL (Signature Scroll-as-Playhead HUD, lg+)
         ===================================================================== */}
      <aside
        aria-label="شريط المسار الملاحي للعرض"
        className="pointer-events-none fixed bottom-4 inset-x-4 z-30 hidden lg:flex justify-center"
      >
        <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-[#8CA2FF]/30 bg-[#070D2B]/95 px-4 py-2.5 backdrop-blur-xl shadow-[0_18px_40px_-14px_rgba(3,7,28,0.9)]">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/icons/bosla/meridian-crest.svg"
              alt=""
              width={22}
              height={22}
              className="h-5 w-5"
            />
            <span
              ref={hudDegRef}
              dir="ltr"
              className="font-mono text-xs font-bold tabular-nums text-[#F5B94A]"
            >
              000°
            </span>
            <span
              ref={hudLabelRef}
              className="text-xs font-semibold text-[#EEF0FF] whitespace-nowrap"
            >
              01 الاستهلال
            </span>
          </div>

          <div className="flex-1 max-w-[260px]">
            <BoslaMeridianTraceSvg tracePathRef={hudTraceRef} />
          </div>

          <nav className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold">
            {[
              { href: '#story', label: 'المرسم' },
              { href: '#methodology', label: 'المنهج' },
              { href: '#specialization-quiz', label: 'البوصلة' },
              { href: '#join-academy', label: 'الدخول' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-1 text-[#A9B1E0] transition-colors hover:bg-[#18266E] hover:text-[#EEF0FF]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* =====================================================================
          MOVEMENT I — MONUMENTAL TYPOGRAPHIC PORTAL & ORBITAL ASTROLABE HERO
         ===================================================================== */}
      {sec.hero && (
        <section
          id="exhibition-open"
          ref={heroSectionRef}
          data-sc-act="flow"
          className="relative min-h-[calc(100svh-64px)] overflow-hidden border-b border-[#8CA2FF]/20 bg-[#050A24]"
        >
          {/* Rear Plane: Subtle architectural grid & masked edge photography */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
          />
          <div
            aria-hidden="true"
            data-sc-parallax="-0.45"
            className="pointer-events-none absolute inset-y-0 end-0 w-full lg:w-[56%] opacity-25 lg:opacity-40"
          >
            <img
              src="/images/brand/hero-banner.webp"
              alt=""
              fetchPriority="high"
              className="bosla-hero-vignette-mask h-full w-full object-cover object-[50%_20%]"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050A24]/90 via-[#050A24]/65 to-[#050A24]/40 lg:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_18%_42%,rgba(124,149,255,0.14),transparent_72%)]"
          />

          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] max-w-7xl flex-col justify-between px-4 pt-8 pb-12 sm:px-6 lg:pt-12 lg:pb-24">
            {/* Top Archival Coordinate Strip */}
            <div className="hero-seq-1 flex flex-wrap items-center justify-between gap-4 border-b border-[#8CA2FF]/15 pb-4 text-xs text-[#A9B1E0]">
              <p className="inline-flex items-center gap-2 font-semibold text-[#8CA2FF]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F5B94A]" />
                <span>من الطالب إلى المدير : المعهد التطبيقي للثروة الحيوانية والداجنة</span>
              </p>
              <span dir="ltr" className="hidden sm:inline font-mono tabular-nums text-[#A9B1E0]">
                LAT 30.0444 N / BOSLA MERIDIAN
              </span>
            </div>

            {/* Monumental Asymmetric Hero Body */}
            <div className="grid items-center gap-8 py-6 lg:grid-cols-12 lg:py-4">
              {/* Typographic Monument (Inline-Start) */}
              <div className="lg:col-span-6 space-y-6">
                <h1 className="hero-seq-2 bosla-monument-type text-[clamp(2.35rem,5.4vw,4.5rem)] font-extrabold leading-[1.2] text-[#EEF0FF]">
                  القيادة الميدانية
                  <span className="mt-2 block lg:ms-12 text-[#8CA2FF]">
                    تبدأ بقرارٍ لا بحفظ.
                  </span>
                </h1>

                <p className="hero-seq-3 max-w-[44ch] text-base sm:text-lg leading-[1.85] text-[#A9B1E0]">
                  مرصد تعليمي مغلق للأطباء البيطريين ومهندسي الإنتاج ومديري المبيعات. هنا تتحول المعرفة النظرية إلى انضباط تشغيلي كامل يحمي الاستثمار ويعظّم العائد.
                </p>

                {/* Open-Air Magnetic Entry Action + Underlined Access */}
                <div className="hero-seq-4 flex flex-wrap items-center gap-6 pt-2">
                  <Link
                    ref={magnetCtaRef}
                    href="/register"
                    className="group inline-flex min-h-[52px] items-center gap-3 rounded-xl bg-[#7C95FF] px-7 py-3.5 text-base font-bold text-[#050A24] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_28px_-10px_rgba(124,149,255,0.5)] transition-[background-color,box-shadow] duration-150 hover:bg-[#93A8FF]"
                    style={{ willChange: 'transform' }}
                  >
                    <span>ابدأ رحلتك الآن</span>
                    <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-1" />
                  </Link>

                  <Link
                    href="/login"
                    className="inline-flex min-h-[44px] items-center gap-2 border-b border-[#8CA2FF]/45 pb-1 text-sm sm:text-base font-semibold text-[#EEF0FF] transition-colors hover:border-[#F5B94A] hover:text-[#F5B94A]"
                  >
                    <Lock className="h-4 w-4 text-[#8CA2FF]" />
                    <span>دخول بوابة الأعضاء</span>
                  </Link>
                </div>
              </div>

              {/* Colossal Interactive Astrolabe Compass Centerpiece */}
              <div className="hero-seq-media lg:col-span-6 flex flex-col items-center justify-center">
                <BoslaAstrolabeHeroSvg
                  needleRef={heroNeedleRef}
                  activeAngle={heroAngle}
                  onSelectAngle={(deg) => {
                    setHeroAngle(deg);
                    if (heroNeedleRef.current) {
                      heroNeedleRef.current.style.transform = `rotate(${deg}deg)`;
                    }
                  }}
                  className="w-[min(86vw,430px)] lg:w-[min(44vw,520px)]"
                />

                {/* Interactive Bearing Calibration Pills (accessible click & keyboard controls) */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  {[
                    { deg: 0, label: '0° التأسيس' },
                    { deg: 90, label: '90° التشغيل' },
                    { deg: 180, label: '180° التحصين' },
                    { deg: 270, label: '270° القيادة' },
                  ].map((item) => (
                    <button
                      key={item.deg}
                      type="button"
                      onClick={() => {
                        setHeroAngle(item.deg);
                        if (heroNeedleRef.current) {
                          heroNeedleRef.current.style.transform = `rotate(${item.deg}deg)`;
                        }
                      }}
                      className={`rounded-lg border px-3 py-1.5 font-medium tabular-nums transition-colors cursor-pointer ${
                        heroAngle === item.deg
                          ? 'border-[#F5B94A] bg-[#0B1440] text-[#F5B94A]'
                          : 'border-[#8CA2FF]/20 bg-[#0B1440]/60 text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quiet Scroll Horizon Datum Footer */}
            <div className="hidden sm:flex items-center justify-between border-t border-[#8CA2FF]/15 pt-4 text-xs text-[#A9B1E0]">
              <span>المحتوى التعليمي والمنهجية الكاملة تُفتح حصرياً بعد تفعيل العضوية</span>
              <span className="tabular-nums text-[#8CA2FF]">
                تحريك المؤشر يُعاير إبرة المرصد الميداني
              </span>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MOVEMENT II (PEAK ACT) — PINNED SELF-DRAWING ARCHITECTURAL EXHIBITION
         ===================================================================== */}
      <section
        id="story"
        ref={storyActRef}
        data-sc-act="pin"
        className="sc-pin-desktop-only relative border-b border-[#8CA2FF]/15 bg-[#070D2B] lg:min-h-[300svh]"
      >
        <div className="sc-stage mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 lg:py-0">
          <div className="grid w-full items-center gap-10 lg:grid-cols-12">
            {/* Editorial Doctrine Split (Start, separated by 1px meridian line) */}
            <div className="lg:col-span-5 lg:border-e lg:border-[#8CA2FF]/20 lg:pe-10 space-y-6">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#8CA2FF]">
                  {DOCTRINE_CHAPTERS[storyStage].kicker}
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-sm font-bold tabular-nums text-[#F5B94A]"
                >
                  {DOCTRINE_CHAPTERS[storyStage].code} / 03
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold leading-[1.2] text-[#EEF0FF]">
                {DOCTRINE_CHAPTERS[storyStage].title}
              </h2>

              <p className="text-base leading-[1.85] text-[#A9B1E0]">
                {DOCTRINE_CHAPTERS[storyStage].body}
              </p>

              <p className="border-s-2 border-[#77E2B5] ps-4 text-sm font-semibold text-[#EEF0FF]">
                {DOCTRINE_CHAPTERS[storyStage].telemetry}
              </p>

              {/* Hairline Stage Stepper */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#8CA2FF]/15">
                {DOCTRINE_CHAPTERS.map((ch, idx) => (
                  <button
                    key={ch.code}
                    type="button"
                    onClick={() => jumpStoryChapter(idx)}
                    className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                      storyStage === idx
                        ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                        : 'border-[#8CA2FF]/20 bg-[#0B1440]/60 text-[#A9B1E0] hover:border-[#8CA2FF]/45 hover:text-[#EEF0FF]'
                    }`}
                  >
                    {ch.code}. {ch.kicker.split(':')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Colossal Self-Drawing Technical Schematic Canvas (End) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center">
              <BoslaSchematicSvg
                layer1Ref={layer1Ref}
                layer2Ref={layer2Ref}
                layer3Ref={layer3Ref}
                needleRef={schematicNeedleRef}
                activeChapter={storyStage}
                onSelectChapter={jumpStoryChapter}
                className="w-[min(88vw,460px)] lg:w-[min(46vw,530px)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT III — POLARITY INVERSION: LUMINOUS ARCHIVAL GROUND (#EEF0FF)
          Contrast Split Stage + Horizontal Editorial Manifesto (Zero Card Grids)
         ===================================================================== */}
      <section
        id="methodology"
        className="bosla-archival-light border-b border-[#070D2B]/15 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-16">
          {/* Asymmetric Contrast Paradox Header */}
          <div className="grid gap-10 border-b border-[#070D2B]/20 pb-14 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#070D2B] p-2">
                  <img
                    src="/icons/bosla/sector-reticle.svg"
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#18266E]">
                  المفارقة المنهجية : التلقين مقابل الإدارة التنفيذية
                </span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.15] text-[#070D2B]">
                أربع ركائز تحول الخبرة الفردية إلى نظام تشغيل قيادي لا يتكرر.
              </h2>
            </div>

            <div className="lg:col-span-4 space-y-2 border-s border-[#070D2B]/20 ps-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#4A67F0]">
                معيار أكاديمية بوصلة
              </p>
              <p className="text-sm sm:text-base leading-[1.75] text-[#2B3770]">
                صُممت المنظومة لرفع كفاءة الطبيب البيطري ومهندس الإنتاج بعيداً عن الحشو الأكاديمي غير التطبيقي.
              </p>
            </div>
          </div>

          {/* Horizontal Hairline Exhibition Bands (ZERO 3-column/4-column cards!) */}
          <div className="divide-y divide-[#070D2B]/15">
            {METHODOLOGY_PILLARS.map((pillar) => (
              <div
                key={pillar.index}
                className="scroll-reveal-up grid gap-6 py-8 sm:py-10 lg:grid-cols-12 lg:items-center"
              >
                <div className="lg:col-span-2 flex items-center gap-4">
                  <span
                    dir="ltr"
                    className="font-mono text-3xl sm:text-4xl font-extrabold tabular-nums text-[#4A67F0]"
                  >
                    {pillar.index}
                  </span>
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#070D2B] p-2.5">
                    <img
                      src={pillar.iconSrc}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                    />
                  </span>
                </div>

                <div className="lg:col-span-5">
                  <p className="text-xs font-bold text-[#4A67F0] mb-1">
                    {pillar.discipline}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#070D2B] leading-snug">
                    {pillar.title}
                  </h3>
                </div>

                <div className="lg:col-span-5">
                  <p className="text-sm sm:text-base leading-[1.8] text-[#2B3770]">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT IV — TELEMETRY RULER (#impact) + SPECIALIZATION COMPASS
         ===================================================================== */}
      {sec.metrics && (
        <section
          id="impact"
          className="border-b border-[#8CA2FF]/15 bg-[#070D2B] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#8CA2FF]/15 pb-6">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#8CA2FF]">
                  السجل المؤسسي الموثّق
                </p>
                <h2 className="mt-1 text-2xl sm:text-4xl font-extrabold text-[#EEF0FF]">
                  أرقام المنصة الفعلية المعتمدة
                </h2>
              </div>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-semibold text-[#F5B94A] hover:underline"
              >
                فتح التفاصيل الكاملة بعد الدخول ←
              </Link>
            </div>

            {/* Oversized Monumental Ruler Typography (Zero Stat Cards) */}
            <div className="grid grid-cols-2 gap-y-10 gap-x-6 lg:grid-cols-4">
              {[
                {
                  target: data.courses.length,
                  prefix: '+',
                  label: 'برنامجاً وكورساً تطبيقياً داخل البوابة المغلقة',
                },
                {
                  target: data.categories.length,
                  prefix: '',
                  label: 'تخصصاً بيطرياً وتجارياً معتمداً',
                },
                {
                  target: data.learningPaths.length,
                  prefix: '',
                  label: 'مسارات تدرج من التنفيذ إلى القيادة',
                },
                {
                  target: 140,
                  prefix: '',
                  label: 'ساعة عمق عملي في منظومة التقييم',
                },
              ].map((stat, idx) => (
                <div
                  key={stat.label}
                  className="border-s border-[#8CA2FF]/25 ps-5 sm:ps-6 space-y-2"
                >
                  <p className="font-mono text-xs font-medium text-[#8CA2FF] tabular-nums" dir="ltr">
                    0{idx + 1} / KPI
                  </p>
                  <p
                    className="text-4xl sm:text-6xl font-extrabold tabular-nums leading-none text-[#EEF0FF]"
                    data-sc-count={`0 ${stat.target}`}
                    data-sc-prefix={stat.prefix}
                  >
                    {stat.prefix}{formatNumber(stat.target)}
                  </p>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#A9B1E0]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Interactive Tactical Calibration Console (#specialization-quiz) */}
      {sec.specializationQuiz && (
        <section
          id="specialization-quiz"
          className="border-b border-[#8CA2FF]/15 bg-[#050A24] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Reactive Calibration Compass Dial */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-[#F5B94A]">
                    مختبر تحديد الميول التشغيلية
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-[#EEF0FF] leading-tight">
                    اختبار بوصلة لتحديد التخصص الأنسب لك
                  </h2>
                  <p className="text-sm sm:text-base text-[#A9B1E0] leading-[1.75]">
                    أجب عن الأسئلة الميدانية لتوجيه بوصلة تخصصك دون مغادرة الصفحة، واحفظ التوصية داخل حسابك عند الدخول.
                  </p>
                </div>

                <div className="mx-auto max-w-[290px] pt-2">
                  <BoslaCompassSvg
                    variant="lens"
                    bearingDeg={quizBearing}
                    activeStage={Math.min(2, quizStep)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Open Tactical Option Strips (Preserves button.text-start & المركز #1) */}
              <div className="lg:col-span-7 border-t border-[#8CA2FF]/20 pt-8 lg:border-t-0 lg:border-s lg:ps-10 lg:pt-0">
                {rankingLoading ? (
                  <div className="py-12 text-center text-base font-semibold text-[#8CA2FF]">
                    جاري معايرة إجاباتك وترتيب المجالات المناسبة...
                  </div>
                ) : rankedResults ? (
                  <div className="space-y-6">
                    <AlertBanner tone="success" title="نتيجة بوصلة لأفضل 3 تخصصات لك">
                      تم احتساب التوصيات بناءً على ميولك التشغيلية والقطاع الذي تفضل العمل به.
                    </AlertBanner>
                    <div className="divide-y divide-[#8CA2FF]/20 border-y border-[#8CA2FF]/20">
                      {rankedResults.map((res, idx) => (
                        <div
                          key={res.id}
                          className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                idx === 0
                                  ? 'bg-[#7C95FF] text-[#050A24]'
                                  : 'border border-[#8CA2FF]/25 bg-[#0B1440] text-[#8CA2FF]'
                              }`}
                            >
                              المركز #{formatNumber(idx + 1)}
                            </span>
                            <h3 className="text-lg font-bold text-[#EEF0FF] pt-1">
                              {res.nameAr}
                            </h3>
                            <p className="text-sm text-[#A9B1E0] max-w-xl">
                              {res.descriptionAr}
                            </p>
                          </div>
                          <Link
                            href="/login"
                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#F5B94A] hover:underline"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>دخول لفتح خطة التخصص</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={resetQuiz}>
                      <RotateCcw className="h-4 w-4" />
                      إعادة اختبار التخصص
                    </Button>
                  </div>
                ) : currentQuestion ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#8CA2FF]/15 pb-3 text-xs font-semibold tabular-nums text-[#8CA2FF]">
                      <span>المحور التفاعلي</span>
                      <span>
                        السؤال {formatNumber(quizStep + 1)} من {formatNumber(questions.length)}
                      </span>
                    </div>

                    <p className="text-lg sm:text-2xl font-bold text-[#EEF0FF] leading-snug">
                      {currentQuestion.promptAr}
                    </p>

                    <div className="space-y-3">
                      {currentQuestion.options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuizOption(opt)}
                          className="group flex w-full min-h-[56px] items-center justify-between gap-4 rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440]/65 px-5 py-3.5 text-start text-sm sm:text-base font-medium text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E] cursor-pointer"
                        >
                          <span className="flex items-center gap-3.5 min-w-0">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#070D2B] font-mono text-xs font-bold tabular-nums text-[#8CA2FF] group-hover:bg-[#7C95FF] group-hover:text-[#050A24]">
                              0{formatNumber(idx + 1)}
                            </span>
                            <span className="leading-snug">{opt.label ?? opt.labelAr ?? ''}</span>
                          </span>
                          <ArrowLeft className="h-4 w-4 shrink-0 text-[#8CA2FF] opacity-60 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-base text-[#A9B1E0]">
                    سجّل دخولك لاستعراض التخصصات القيادية المتاحة في بوصلة.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MOVEMENT V — BROADSHEET ENDORSEMENTS, CLOSING MONOLITH & ADVISORY
         ===================================================================== */}
      {(sec.testimonials || sec.partners) && (
        <section className="border-b border-[#8CA2FF]/15 bg-[#070D2B] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-16">
            {sec.testimonials && leadTestimonial && (
              <div className="grid gap-10 lg:grid-cols-12 items-start">
                <div className="lg:col-span-7 space-y-5">
                  <p className="text-xs font-bold text-[#F5B94A]">شهادات من قلب القطاع</p>
                  <blockquote className="text-2xl sm:text-3xl font-bold leading-[1.45] text-[#EEF0FF]">
                    “{leadTestimonial.quoteAr}”
                  </blockquote>
                  <div className="pt-2">
                    <p className="text-base font-bold text-[#8CA2FF]">
                      {leadTestimonial.studentNameAr || leadTestimonial.authorName}
                    </p>
                    <p className="text-xs sm:text-sm text-[#A9B1E0]">
                      {[leadTestimonial.roleTitleAr, leadTestimonial.companyAr].filter(Boolean).join('، ') ||
                        leadTestimonial.authorRoleAr}
                    </p>
                  </div>
                </div>

                {secondaryTestimonials.length > 0 && (
                  <div className="lg:col-span-5 divide-y divide-[#8CA2FF]/15 border-t lg:border-t-0 lg:border-s border-[#8CA2FF]/15 pt-8 lg:pt-0 lg:ps-8 space-y-6">
                    {secondaryTestimonials.map((t) => (
                      <div key={t.id} className="pt-6 first:pt-0 space-y-2.5">
                        <p className="text-sm sm:text-base leading-[1.75] text-[#A9B1E0]">
                          “{t.quoteAr}”
                        </p>
                        <p className="text-xs font-bold text-[#EEF0FF]">
                          {t.studentNameAr || t.authorName}
                          <span className="font-normal text-[#8CA2FF] ms-2">
                            {t.companyAr || t.authorRoleAr}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sec.partners && data.partners.length > 0 && (
              <div className="flex flex-col gap-6 border-t border-[#8CA2FF]/15 pt-10 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF]">
                    شركاء التدريب والاعتماد الصناعي
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A9B1E0] mt-1">
                    تعاون مشترك لربط الكفاءات الطبية والإنتاجية بسوق العمل الفعلي.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {data.partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="flex items-center gap-3 rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440]/85 px-4 py-2"
                    >
                      <img
                        src={partner.logoUrl || '/images/brand/partner-ommat.webp'}
                        alt={partner.nameAr || partner.name || 'شريك تدريب'}
                        className="h-8 w-8 rounded-lg bg-[#EEF0FF] p-1 object-contain"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-[#EEF0FF]">
                        {partner.nameAr || partner.name}
                      </span>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setPartnerModalOpen(true)}>
                    <Building2 className="h-4 w-4" />
                    كن شريكاً أو راعياً
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Exclusive Sanctuary Closing Monolith (#join-academy) */}
      <section
        id="join-academy"
        className="relative overflow-hidden border-b border-[#8CA2FF]/15 bg-[#050A24] py-24 sm:py-28"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-25"
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 space-y-8">
          <BoslaPortalSealSvg className="mx-auto h-40 w-40 sm:h-48 sm:w-48" />

          <div className="space-y-4">
            <p className="text-xs sm:text-sm font-bold text-[#F5B94A]">
              بوابة العضوية المغلقة
            </p>
            <h2 className="bosla-monument-type text-3xl sm:text-5xl font-extrabold leading-[1.15] text-[#EEF0FF]">
              المكتبة التطبيقية والمسارات الكاملة بانتظارك خلف البوابة.
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base leading-[1.8] text-[#A9B1E0]">
              تخضع مناهج أكاديمية بوصلة وبرامجها التخصصية لتفعيل الحساب الشخصي لحماية حقوق الملكية وتخصيص لوحة التعلم ومؤشرات التقدم لكل متدرب.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/login">
              <Button variant="primary" size="lg" className="px-8">
                <Lock className="h-4 w-4" />
                تسجيل الدخول للأكاديمية
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="px-8">
                إنشاء حساب متدرب جديد
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Open Architectural Split: Corporate Advisory (#lead-section) + Hairline FAQs */}
      {(sec.b2bLead || sec.faqs) && (
        <section id="lead-section" className="bg-[#070D2B] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 grid gap-14 lg:grid-cols-12 items-start">
            {sec.b2bLead && (
              <div className={sec.faqs ? 'lg:col-span-6 space-y-6' : 'lg:col-span-12 space-y-6'}>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-[#8CA2FF]">
                    استشارات وتدريب الشركات والمزارع B2B
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EEF0FF]">
                    انضم كشريك نجاح أو اطلب خطة تأهيل لفريق شركتك
                  </h2>
                </div>

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  {leadSuccess && <AlertBanner tone="success">{leadSuccess}</AlertBanner>}
                  {leadError && <AlertBanner tone="danger">{leadError}</AlertBanner>}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="lead-name" label="الاسم الكامل" required>
                      <input
                        id="lead-name"
                        className={inputClassName}
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="أحمد محمود"
                        required
                      />
                    </Field>
                    <Field id="lead-phone" label="رقم الهاتف (مصر / واتساب)" required>
                      <input
                        id="lead-phone"
                        dir="ltr"
                        className={inputClassName}
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        placeholder="01012345678"
                        required
                      />
                    </Field>
                  </div>

                  {leadType === 'CORPORATE_B2B' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="lead-company" label="اسم الشركة أو المزرعة" required>
                        <input
                          id="lead-company"
                          className={inputClassName}
                          value={leadCompany}
                          onChange={(e) => setLeadCompany(e.target.value)}
                          placeholder="مجموعة النيل للدواجن"
                          required
                        />
                      </Field>
                      <Field id="lead-size" label="حجم الفريق المستهدف">
                        <select
                          id="lead-size"
                          className={inputClassName}
                          value={leadTeamSize}
                          onChange={(e) => setLeadTeamSize(e.target.value)}
                        >
                          <option value="5-15">5 إلى 15 فرد</option>
                          <option value="15-50">15 إلى 50 فرد</option>
                          <option value="50-200">50 إلى 200 فرد</option>
                          <option value="200+">أكثر من 200 فرد</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="lead-sector" label="القطاع">
                      <select
                        id="lead-sector"
                        className={inputClassName}
                        value={leadSector}
                        onChange={(e) => setLeadSector(e.target.value)}
                      >
                        <option value="دواجن">إنتاج داجني وتفريخ</option>
                        <option value="ماشية وألبان">ماشية وألبان وتغذية</option>
                        <option value="أدوية وإضافات">أدوية بيطرية وإضافات أعلاف</option>
                        <option value="استزراع سمكي">استزراع سمكي وسلامة غذاء</option>
                      </select>
                    </Field>
                    <Field id="lead-need" label="الهدف التدريبي">
                      <input
                        id="lead-need"
                        className={inputClassName}
                        value={leadNeed}
                        onChange={(e) => setLeadNeed(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field id="lead-notes" label="ملاحظات إضافية">
                    <textarea
                      id="lead-notes"
                      rows={2}
                      className={inputClassName}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      placeholder="أخبرنا عن التحديات أو المهارات المطلوب تدريب الفريق عليها"
                    />
                  </Field>

                  <Button type="submit" variant="primary" className="w-full" disabled={leadBusy}>
                    {leadBusy ? 'جاري الإرسال' : 'إرسال الطلب الآن'}
                  </Button>
                </form>
              </div>
            )}

            {sec.faqs && (
              <div className={sec.b2bLead ? 'lg:col-span-6 space-y-5' : 'lg:col-span-12 space-y-5'}>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-[#F5B94A]">الأسئلة الشائعة</p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EEF0FF]">
                    إجابات واضحة حول العضوية والأمان والتعلم
                  </h2>
                </div>

                <div className="divide-y divide-[#8CA2FF]/15 border-y border-[#8CA2FF]/15">
                  {data.faqs.map((faq) => (
                    <details key={faq.id} className="group py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm sm:text-base font-bold text-[#EEF0FF] hover:text-[#8CA2FF] transition-colors">
                        <span>{faq.questionAr}</span>
                        <ChevronDown className="bosla-chevron h-4 w-4 shrink-0 text-[#8CA2FF]" />
                      </summary>
                      <p className="pt-3 text-sm leading-[1.8] text-[#A9B1E0]">
                        {faq.answerAr}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Partner / Sponsor Inquiry Dialog */}
      <NativeModal
        open={partnerModalOpen}
        onClose={() => setPartnerModalOpen(false)}
        title="الشراكات والرعاية التعليمية"
      >
        <form onSubmit={handleSponsorSubmit} className="space-y-4">
          {sponsorStatus && <AlertBanner tone="info">{sponsorStatus}</AlertBanner>}
          <Field id="sponsor-org" label="اسم الشركة / المؤسسة" required>
            <input
              id="sponsor-org"
              className={inputClassName}
              value={sponsorOrg}
              onChange={(e) => setSponsorOrg(e.target.value)}
              required
            />
          </Field>
          <Field id="sponsor-phone" label="رقم التواصل" required>
            <input
              id="sponsor-phone"
              dir="ltr"
              className={inputClassName}
              value={sponsorPhone}
              onChange={(e) => setSponsorPhone(e.target.value)}
              placeholder="01001234567"
              required
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full">
            إرسال طلب الشراكة
          </Button>
        </form>
      </NativeModal>
    </div>
  );
}
