'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  Compass,
  GraduationCap,
  Layers,
  Lock,
  MapPin,
  MessageCircle,
  PlayCircle,
  Star,
  Ticket,
  Users,
} from 'lucide-react';
import { rankSpecializationDomains } from '@bosla/shared';
import {
  apiFetch,
  difficultyLabelAr,
  formatDate,
  formatEgp,
  formatNumber,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { resolveSectionVisibility } from '@/lib/section-visibility';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import {
  LearningPathCard,
  type LearningPathCardData,
} from '@/components/catalog/LearningPathCard';

export interface HomeBundle {
  homePage?: any;
  settings?: Record<string, any> | null;
  sectionVisibility?: Record<string, boolean> | null;
  categories: Array<{
    id: string;
    slug: string;
    nameAr: string;
    descriptionAr: string | null;
    iconUrl?: string | null;
    thumbnailUrl?: string | null;
  }>;
  courses: Array<{
    id: string;
    slug: string;
    isFree: boolean;
    difficulty: string;
    category: { id: string; slug: string; nameAr: string };
    instructor: {
      id: string;
      fullName: string;
      headlineAr: string | null;
      avatarUrl: string | null;
    };
    publishedVersion: {
      titleAr: string;
      subtitleAr: string | null;
      descriptionAr: string;
      thumbnailUrl: string | null;
      durationMinutes: number;
      sections: Array<{ id: string; _count: { lessons: number } }>;
    } | null;
  }>;
  learningPaths: LearningPathCardData[];
  diplomas: Array<{
    id: string;
    slug: string;
    titleAr: string;
    descriptionAr: string;
    totalHours: number;
    thumbnailUrl: string | null;
  }>;
  instructors: Array<{
    id: string;
    fullName: string;
    headlineAr: string | null;
    bioAr: string | null;
    avatarUrl: string | null;
    _count?: { instructedCourses: number };
  }>;
  plans: Array<{
    id: string;
    slug: string;
    nameAr: string;
    descriptionAr: string;
    interval: 'MONTHLY' | 'ANNUAL';
    priceCents: number;
    discountLabelAr: string | null;
  }>;
  offlineEvents?: Array<{
    id: string;
    slug: string;
    titleAr: string;
    subtitleAr?: string | null;
    descriptionAr: string;
    thumbnailUrl?: string | null;
    categoryLabelAr: string;
    cityAr: string;
    venueNameAr: string;
    startsAt: string;
    priceCents: number;
    compareAtPriceCents?: number | null;
    capacity: number;
    remainingSeats: number;
    speakerNameAr?: string | null;
    instructor?: { id: string; fullName: string; avatarUrl?: string | null } | null;
  }>;
  testimonials: Array<{
    id: string;
    studentNameAr?: string;
    authorName?: string;
    roleTitleAr?: string | null;
    authorRoleAr?: string | null;
    companyAr?: string | null;
    quoteAr: string;
    rating: number;
  }>;
  partners: Array<{
    id: string;
    name?: string;
    nameAr?: string;
    descriptionAr?: string | null;
    logoUrl: string | null;
  }>;
  faqs: Array<{ id: string; questionAr: string; answerAr: string }>;
  specialization: {
    questions: Array<{
      id: string;
      stepOrder?: number;
      promptAr: string;
      options: Array<{
        label?: string;
        labelAr?: string;
        weights?: string;
        species?: string;
        dimensionWeights?: Record<string, number>;
        speciesWeights?: Record<string, number>;
      }>;
    }>;
    domains: any[];
  };
}

const STORY_CHAPTERS = [
  {
    bearing: 18,
    kicker: 'الرؤية الميدانية',
    title: 'تجاوز الفجوة بين قاعات الدراسة وإدارة المزارع الحقيقية',
    body: 'سوق الثروة الحيوانية والداجنة لا يختبر حفظ المراجع، بل يختبر سرعة التشخيص الدقيق، وقرار التحصين والأمان الحيوي، وقدرتك على حماية ربحية القطيع تحت الضغط التشغيلي.',
    detail: 'نحو تأهيل تطبيقي يربط المعلومة البيطرية بالاقتصاديات اليومية للمزرعة.',
  },
  {
    bearing: 138,
    kicker: 'فلسفة التوجيه',
    title: 'نقل خبرة استشاريي الإنتاج والدواء إلى غرفة العمليات الخاصة بك',
    body: 'كل نقطة توجيه في بوصلة صيغت من واقع الإشراف المباشر على كبرى المزارع والشركات، لتحصل على منهجية عمل مترابطة بدلاً من محتوى مجزأ أو فيديوهات متفرقة.',
    detail: 'إشراف خبير، قراءة مؤشرات الأداء، وقرارات مبنية على الواقع الحقلي.',
  },
  {
    bearing: 258,
    kicker: 'منهجية القيادة',
    title: 'من طبيب أو مهندس منفّذ إلى مدير يدير الفرق والاستثمار',
    body: 'التدرج المنظم هو جوهر الأكاديمية: تبدأ ببناء أساس التشغيل الميداني ثم تنتقل عبر مسارات مهنية وتقييمات تطبيقية وصولاً إلى اعتماد الكفاءة وقيادة المشروعات.',
    detail: 'شهادات رقمية برمز تحقق تسلسلي فريد قابلة للتوثيق أمام جهات العمل.',
  },
];

const METHODOLOGY_PILLARS = [
  {
    iconSrc: '/icons/bosla/pillar-field.svg',
    title: 'منهجية مستندة إلى واقع المزارع',
    description:
      'دراسة حالات تشغيلية حقيقية تشمل الأمن الحيوي، تركيب العلائق، ومعالجة تحديات الإنتاج عالية الخطورة.',
  },
  {
    iconSrc: '/icons/bosla/pillar-mentors.svg',
    title: 'إشراف نخبة استشاريي القطاع',
    description:
      'تعلّم مباشر من خبراء ومستشاري مزارع الإنتاج الحيواني والداجني وتسويق الأدوية البيطرية في المنطقة.',
  },
  {
    iconSrc: '/icons/bosla/pillar-cert.svg',
    title: 'اعتماد وتوثيق تسلسلي فوري',
    description:
      'نظام مزدوج يجمع بين شهادات الإتمام التلقائية وشهادات الكفاءة المعتمدة بعد التقييم والمراجعة الفعلية.',
  },
  {
    iconSrc: '/icons/bosla/pillar-vault.svg',
    title: 'بنية تعليمية خاصة وآمنة',
    description:
      'منظومة مغلقة بمجتمعات تفاعلية مرتبطة بتوقيت الدروس وبث فيديو مشفّر متاح فور تسجيل الدخول.',
  },
];

const STAGGER_CLASSES = [
  'scroll-stagger-1',
  'scroll-stagger-2',
  'scroll-stagger-3',
  'scroll-stagger-4',
];

export function HomeExperience({ data }: { data: HomeBundle | null }) {
  const { user, requiresPasskeyEnrollment } = useAuth();
  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);
  const sec = resolveSectionVisibility(
    data?.sectionVisibility ?? data?.settings?.section_visibility ?? data?.settings?.sectionVisibility,
  );

  // Hero & Sticky Storytelling compass states
  const [heroBearing, setHeroBearing] = useState(24);
  const [storyStage, setStoryStage] = useState(0);
  const [storyBearing, setStoryBearing] = useState(STORY_CHAPTERS[0].bearing);
  const storyActRef = useRef<HTMLElement | null>(null);

  // Authenticated catalog filters & floating guide
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');

  // Career specialization orientation quiz state
  const [quizStep, setQuizStep] = useState<number>(0);
  const [dimScores, setDimScores] = useState<Record<string, number>>({});
  const [speciesScores, setSpeciesScores] = useState<Record<string, number>>({});
  const [rankedResults, setRankedResults] = useState<any[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // B2B / Individual Lead state
  const [leadType, setLeadType] = useState<'INDIVIDUAL' | 'CORPORATE_B2B'>('INDIVIDUAL');
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

  // Partner / Sponsor modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [sponsorOrg, setSponsorOrg] = useState('');
  const [sponsorStatus, setSponsorStatus] = useState<string | null>(null);

  // Drive sticky storytelling dial cleanly off ScrollCraft --sc-p event
  useEffect(() => {
    const actEl = storyActRef.current;
    if (!actEl || isUnlocked) return;

    const onProgress = (evt: Event) => {
      const p = Number((evt as CustomEvent<{ p: number }>).detail?.p ?? 0);
      const nextStage = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
      setStoryStage((prev) => (prev === nextStage ? prev : nextStage));
      setStoryBearing(18 + p * 255);
    };

    actEl.addEventListener('sc:progress', onProgress);
    return () => actEl.removeEventListener('sc:progress', onProgress);
  }, [isUnlocked]);

  const filteredCourses = useMemo(() => {
    const all = data?.courses ?? [];
    if (selectedCategory === 'all') return all;
    if (selectedCategory === 'free') return all.filter((c) => c.isFree);
    return all.filter((c) => c.category?.slug === selectedCategory);
  }, [data?.courses, selectedCategory]);

  const questions = data?.specialization?.questions ?? [];
  const currentQuestion = questions[quizStep];
  const quizProgress = questions.length
    ? Math.round(((quizStep + (rankedResults ? 1 : 0)) / questions.length) * 100)
    : 0;

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
        // Keep synchronous client ranking computed from catalog bundle
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

  const assistantSuggestions = useMemo(() => {
    if (!data || !isUnlocked) return [];
    const q = assistantQuery.trim().toLowerCase();
    const pool = [
      ...data.courses.map((c) => ({
        title: c.publishedVersion?.titleAr || c.slug,
        kind: 'كورس',
        href: `/courses/${c.slug}`,
      })),
      ...data.learningPaths.map((p) => ({
        title: p.titleAr,
        kind: 'مسار تعلم',
        href: `/learning-paths/${p.slug}`,
      })),
      ...data.diplomas.map((d) => ({
        title: d.titleAr,
        kind: 'دبلومة',
        href: `/diplomas/${d.slug}`,
      })),
    ];
    if (!q) return pool.slice(0, 5);
    return pool.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 6);
  }, [data, isUnlocked, assistantQuery]);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <AlertBanner tone="warning" title="جارٍ تهيئة اتصال المنصة">
          <p className="mb-4">
            لم نتمكن من جلب بيانات المنصة من خادم الواجهة الخلفية في هذه اللحظة.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button variant="primary">تسجيل الدخول</Button>
            </Link>
            <Link href="/about">
              <Button variant="outline">عن أكاديمية بوصلة</Button>
            </Link>
          </div>
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* =====================================================================
          ACT 1 — CINEMATIC ASYMMETRIC HERO (Animated BOSLA Compass + Split Depth)
         ===================================================================== */}
      {sec.hero && (
        <section
          data-sc-act="flow"
          data-sc-spotlight=""
          className="relative flex min-h-[calc(100svh-68px)] items-center overflow-hidden border-b border-[#8CA2FF]/16 bg-[#070D2B] py-12 text-[#EEF0FF] sm:py-16"
        >
          {/* Ambient radial indigo lighting behind focal subject */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_22%_45%,rgba(124,149,255,0.12),transparent_70%)]"
          />

          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              {/* Inline-Start Editorial Narrative */}
              <div className="lg:col-span-6 space-y-6">
                <p className="hero-seq-1 text-xs sm:text-sm font-medium text-[#8CA2FF]">
                  من الطالب إلى المدير — التعليم البيطري والداجني
                </p>

                <h1 className="hero-seq-2 text-3xl font-semibold leading-[1.18] text-[#EEF0FF] sm:text-5xl lg:text-[3.25rem]">
                  قيادة المزارع الحديثة تبدأ{' '}
                  <span className="mt-1.5 block text-[#8CA2FF]">
                    بقرار ميداني دقيق
                  </span>
                </h1>

                <p className="hero-seq-3 max-w-[54ch] text-base sm:text-lg leading-[1.75] text-[#A9B1E0]">
                  {isUnlocked
                    ? `أهلاً بعودتك، ${user?.fullName}. جميع الكورسات التطبيقية والمسارات المهنية والدبلومات المعتمدة مفتوحة لك الآن.`
                    : 'أكاديمية تطبيقية متخصصة في الثروة الحيوانية والداجنة والإدارة التجارية. سجّل دخولك لفتح المناهج الكاملة والمسارات القيادية الحصرية.'}
                </p>

                <div className="hero-seq-4 flex flex-wrap items-center gap-3.5 pt-2">
                  {isUnlocked ? (
                    <>
                      <Link href="/student">
                        <Button variant="primary" size="lg" className="px-7">
                          <Compass className="h-4 w-4" />
                          الدخول إلى لوحة التعلم
                        </Button>
                      </Link>
                      <Link href="/courses">
                        <Button variant="glass" size="lg" className="px-6">
                          استعراض مكتبة الأكاديمية
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/register">
                        <Button variant="primary" size="lg" className="px-7">
                          ابدأ رحلتك الآن
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href="/login">
                        <Button variant="glass" size="lg" className="px-6">
                          <Lock className="h-4 w-4 text-[#8CA2FF]" />
                          تسجيل الدخول
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                {!isUnlocked && (
                  <div className="hero-seq-4 flex flex-wrap items-center gap-3 pt-1 text-xs text-[#A9B1E0]">
                    <span>زاوية التوجيه الاستكشافية:</span>
                    {[
                      { deg: 24, label: 'التأسيس' },
                      { deg: 144, label: 'التشغيل' },
                      { deg: 264, label: 'القيادة' },
                    ].map((preset) => (
                      <button
                        key={preset.deg}
                        type="button"
                        onClick={() => setHeroBearing(preset.deg)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          heroBearing === preset.deg
                            ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                            : 'border-[#8CA2FF]/20 bg-[#0B1440]/80 text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline-End Multi-Plane Depth Composition (Portrait + Interactive SVG Compass) */}
              <div className="hero-seq-media lg:col-span-6 relative flex items-center justify-center">
                <div className="relative w-full max-w-[540px]">
                  <div data-sc-parallax="-0.35" className="relative overflow-hidden">
                    <img
                      src="/images/brand/hero-banner.webp"
                      alt="أخصائي بيطري وإدارة مزارع يراجع المؤشرات الميدانية"
                      className="bosla-hero-portrait-mask aspect-[4/3] w-full object-cover object-[50%_20%]"
                      fetchPriority="high"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070D2B] via-transparent to-[#070D2B]/30"
                    />
                  </div>

                  {/* Interactive Architectural Compass Overlay Layer */}
                  <div
                    data-sc-parallax="0.25"
                    className="mx-auto -mt-20 w-56 sm:w-64 lg:absolute lg:-bottom-10 lg:-end-6 lg:mt-0 lg:w-64 rounded-2xl bosla-liquid-glass-portal p-3"
                  >
                    <BoslaCompassSvg
                      variant="hero"
                      bearingDeg={heroBearing}
                      activeStage={heroBearing < 100 ? 0 : heroBearing < 200 ? 1 : 2}
                      onSelectBearing={(stageIdx) =>
                        setHeroBearing(stageIdx === 0 ? 24 : stageIdx === 1 ? 144 : 264)
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ACT 2 (UNAUTHENTICATED PUBLIC HOME) — STICKY SCROLL STORYTELLING PEAK
         ===================================================================== */}
      {!isUnlocked && (
        <section
          id="story"
          ref={storyActRef}
          data-sc-act="pin"
          className="sc-pin-desktop-only relative border-b border-[#8CA2FF]/16 bg-[#050A24] lg:min-h-[250svh]"
        >
          <div className="sc-stage mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 lg:py-0">
            <div className="grid w-full items-center gap-10 lg:grid-cols-12">
              {/* Narrative Chapter Copy (Start) */}
              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-[#8CA2FF]">
                    المسار الفكري لبوصلة
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-semibold text-[#EEF0FF] leading-tight">
                    لماذا تبني بوصلة عقلاً تشغيلياً لا مجرد شهادة حضور؟
                  </h2>
                </div>

                {/* Chapter Tabs (Keyboard / Touch fallback + indicator) */}
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="فصول منهجية بوصلة">
                  {STORY_CHAPTERS.map((ch, idx) => (
                    <button
                      key={ch.kicker}
                      type="button"
                      role="tab"
                      aria-selected={storyStage === idx}
                      onClick={() => {
                        setStoryStage(idx);
                        setStoryBearing(ch.bearing);
                      }}
                      className={`rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                        storyStage === idx
                          ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                          : 'border-[#8CA2FF]/18 bg-[#0B1440] text-[#A9B1E0] hover:border-[#8CA2FF]/45 hover:text-[#EEF0FF]'
                      }`}
                    >
                      {formatNumber(idx + 1)}. {ch.kicker}
                    </button>
                  ))}
                </div>

                {/* Active Storytelling Card */}
                <div className="rounded-2xl bosla-liquid-glass p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-[#8CA2FF]/16 pb-3">
                    <span className="text-xs font-semibold text-[#8CA2FF]">
                      {STORY_CHAPTERS[storyStage].kicker}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-[#F5B94A]">
                      المرحلة {formatNumber(storyStage + 1)} من {formatNumber(3)}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-[#EEF0FF] leading-snug">
                    {STORY_CHAPTERS[storyStage].title}
                  </h3>
                  <p className="text-base leading-[1.8] text-[#A9B1E0]">
                    {STORY_CHAPTERS[storyStage].body}
                  </p>
                  <p className="border-s-2 border-[#7C95FF] ps-3.5 text-sm font-medium text-[#EEF0FF]">
                    {STORY_CHAPTERS[storyStage].detail}
                  </p>
                </div>
              </div>

              {/* Pinned Azimuth Compass Dial (End) */}
              <div className="lg:col-span-6 flex items-center justify-center">
                <div className="w-full max-w-[380px] rounded-2xl bosla-liquid-glass p-6 sm:p-8">
                  <BoslaCompassSvg
                    variant="lens"
                    bearingDeg={storyBearing}
                    activeStage={storyStage}
                    onSelectBearing={(idx) => {
                      setStoryStage(idx);
                      setStoryBearing(STORY_CHAPTERS[idx].bearing);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          ACT 3 (PUBLIC & AUTHENTICATED) — INSTITUTIONAL METHODOLOGY PILLARS
          (Asymmetric hairline layout — zero generic 3-col cards, zero courses)
         ===================================================================== */}
      <section
        id="methodology"
        className="border-b border-[#8CA2FF]/16 bg-[#070D2B] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4 scroll-reveal-up">
              <p className="text-xs sm:text-sm font-medium text-[#8CA2FF]">
                منهجية التأهيل التنفيذي
              </p>
              <h2 className="text-2xl sm:text-4xl font-semibold text-[#EEF0FF] leading-tight">
                بنية تعليمية صُممت لصناعة القرار لا لحفظ المصطلحات
              </h2>
              <p className="text-base leading-[1.75] text-[#A9B1E0]">
                تجمع المنظومة بين الانضباط الأكاديمي والواقع الميداني عبر أربع ركائز متكاملة يحصل عليها المتدرب فور انضمامه.
              </p>
            </div>

            <div className="lg:col-span-7 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {METHODOLOGY_PILLARS.map((pillar, idx) => (
                <div
                  key={pillar.title}
                  className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 4]} border-t border-[#8CA2FF]/22 pt-5 space-y-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-2">
                      <img
                        src={pillar.iconSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                      />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-[#EEF0FF]">
                      {pillar.title}
                    </h3>
                  </div>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#A9B1E0]">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ACT 4 — VERIFIED IMPACT METRICS (Real Aggregate Counts Only, NO Lists)
         ===================================================================== */}
      {sec.metrics && (
        <section id="impact" className="border-b border-[#8CA2FF]/16 bg-[#0B1440] py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#EEF0FF]">
                  أرقام المنصة الفعلية المعتمدة
                </h2>
                <p className="mt-1 text-sm text-[#A9B1E0]">
                  إحصاءات حية مباشرة من قاعدة بيانات الأكاديمية
                </p>
              </div>
              {!isUnlocked && (
                <Link href="/login" className="text-xs sm:text-sm font-semibold text-[#8CA2FF] hover:underline">
                  سجّل الدخول للاطلاع على التفاصيل الكاملة ←
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 divide-y divide-[#8CA2FF]/16 rounded-2xl bosla-liquid-glass p-4 sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
              {[
                {
                  target: data.courses.length,
                  prefix: '+',
                  label: 'برنامجاً وكورساً تطبيقياً مغلقاً للأعضاء',
                  icon: PlayCircle,
                },
                {
                  target: data.categories.length,
                  prefix: '',
                  label: 'تخصصات بيطرية وتجارية',
                  icon: Compass,
                },
                {
                  target: data.learningPaths.length,
                  prefix: '',
                  label: 'مسارات تأهيل قيادي',
                  icon: Layers,
                },
                {
                  target: 140,
                  prefix: '',
                  label: 'ساعة عمق تدريبي للدبلومات التطبيقية',
                  icon: GraduationCap,
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-start gap-2 px-4 py-4 sm:px-6"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#070D2B] text-[#8CA2FF]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p
                      className="text-2xl sm:text-3xl font-semibold tabular-nums leading-tight text-[#EEF0FF]"
                      data-sc-count={`0 ${stat.target}`}
                      data-sc-prefix={stat.prefix}
                    >
                      {stat.prefix}{formatNumber(stat.target)}
                    </p>
                    <p className="text-xs sm:text-sm text-[#A9B1E0] leading-snug">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          AUTHENTICATED-ONLY ACADEMY PORTAL SECTION (Strictly Hidden When !isUnlocked)
          Courses, Learning Paths, Offline Events & Diplomas appear ONLY after login.
         ===================================================================== */}
      {isUnlocked && (
        <div id="authenticated-academy-content" className="border-b border-[#8CA2FF]/16">
          {/* 1. Featured Courses */}
          {sec.courses && (
            <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge tone="info">مكتبة العضو المفعّلة</Badge>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                    أبرز الكورسات التطبيقية
                  </h2>
                </div>
                <Link href="/courses" className="text-sm font-semibold text-[#8CA2FF] hover:underline">
                  عرض جميع الكورسات ←
                </Link>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#7C95FF] text-[#070D2B]'
                      : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('free')}
                  className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                    selectedCategory === 'free'
                      ? 'bg-[#7C95FF] text-[#070D2B]'
                      : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                  }`}
                >
                  معاينة مجانية
                </button>
                {data.categories.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.slug)}
                    className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                      selectedCategory === c.slug
                        ? 'border border-[#8CA2FF] bg-[#18266E] text-[#8CA2FF]'
                        : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                    }`}
                  >
                    {c.nameAr}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {filteredCourses.map((course) => {
                  const lessonCount =
                    course.publishedVersion?.sections.reduce(
                      (acc, s) => acc + s._count.lessons,
                      0,
                    ) ?? 0;
                  return (
                    <Card
                      key={course.id}
                      spotlight
                      className="bosla-card-hover group flex flex-col overflow-hidden"
                    >
                      <Link
                        href={`/courses/${course.slug}`}
                        className="relative block aspect-[16/10] overflow-hidden bg-[#0B1440]"
                      >
                        <img
                          src={
                            course.publishedVersion?.thumbnailUrl ||
                            '/images/brand/course-biosecurity.webp'
                          }
                          alt={course.publishedVersion?.titleAr || course.slug}
                          className="bosla-card-media h-full w-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1440]/70 via-transparent to-transparent"
                        />
                        <span className="absolute top-3 start-3">
                          <Badge
                            tone={
                              course.isFree
                                ? 'success'
                                : (course as any).includedInMembership === false
                                  ? 'warning'
                                  : 'info'
                            }
                          >
                            {course.isFree
                              ? 'معاينة مجانية'
                              : (course as any).includedInMembership === false
                                ? `مستقل (${formatEgp((course as any).priceCents ?? 45000)})`
                                : 'ضمن العضوية'}
                          </Badge>
                        </span>
                      </Link>
                      <div className="flex flex-1 flex-col p-4">
                        <Link href={`/courses/${course.slug}`}>
                          <h3 className="text-base font-semibold leading-snug text-[#EEF0FF] group-hover:text-[#8CA2FF] line-clamp-2">
                            {course.publishedVersion?.titleAr || course.slug}
                          </h3>
                        </Link>
                        <p className="mt-2 text-xs sm:text-sm tabular-nums text-[#A9B1E0]">
                          {formatNumber(course.publishedVersion?.durationMinutes ?? 0)} دقيقة • {formatNumber(lessonCount)} دروس •{' '}
                          {difficultyLabelAr(course.difficulty).split('—')[0]}
                        </p>
                        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#8CA2FF]/14 gap-2">
                          <span className="text-xs font-medium text-[#EEF0FF] truncate">
                            {course.instructor.fullName}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[#8CA2FF]">
                            {course.category?.nameAr}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Learning Paths */}
          {sec.learningPaths && (
            <section className="border-y border-[#8CA2FF]/16 bg-[#0B1440] py-14 sm:py-16">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <Badge tone="info">خارطة التدرج المهني المنظمة</Badge>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                      المسارات التعليمية
                    </h2>
                  </div>
                  <Link href="/learning-paths">
                    <Button variant="outline" size="md">
                      عرض جميع المسارات
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className={`grid gap-8 ${data.learningPaths.length === 1 ? 'mx-auto max-w-3xl' : 'lg:grid-cols-2'}`}>
                  {data.learningPaths.map((path, idx) => (
                    <LearningPathCard
                      key={path.id}
                      path={path}
                      index={idx}
                      headingLevel="h3"
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 3. Offline Events */}
          {sec.offlineEvents && (data.offlineEvents?.length ?? 0) > 0 && (
            <section className="border-b border-[#8CA2FF]/16 bg-[#070D2B] py-14">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <Badge tone="warning">تدريب عملي وميداني مباشر</Badge>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                      الفعاليات والكورسات الأوفلاين
                    </h2>
                  </div>
                  <Link href="/events">
                    <Button variant="outline" size="md">
                      عرض جميع الفعاليات
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {data.offlineEvents!.slice(0, 4).map((ev) => (
                    <Card key={ev.id} spotlight className="overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="relative h-48 w-full bg-[#0B1440]">
                          {ev.thumbnailUrl ? (
                            <img src={ev.thumbnailUrl} alt={ev.titleAr} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#8CA2FF]">
                              <Ticket className="h-12 w-12 opacity-60" />
                            </div>
                          )}
                          <div className="absolute top-3 start-3 rounded-lg bg-[#070D2B]/90 border border-[#8CA2FF]/25 px-3 py-1 text-xs font-semibold text-[#EEF0FF]">
                            {ev.categoryLabelAr}
                          </div>
                          <div className="absolute top-3 end-3 rounded-lg bg-[#7C95FF] px-3 py-1 text-xs font-semibold tabular-nums text-[#070D2B]">
                            {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                          </div>
                        </div>
                        <div className="p-6 space-y-2.5">
                          <h3 className="text-lg font-semibold text-[#EEF0FF]">{ev.titleAr}</h3>
                          <p className="text-sm text-[#A9B1E0] line-clamp-2">{ev.descriptionAr}</p>
                          <div className="flex flex-wrap gap-4 pt-1 text-xs text-[#A9B1E0] tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {ev.cityAr}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {formatDate(ev.startsAt, { dateStyle: 'medium' })}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              متبقي {formatNumber(ev.remainingSeats)} من {formatNumber(ev.capacity)} مقعد
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-6 pb-6">
                        <Link href={`/events/${ev.slug}`}>
                          <Button variant="primary" size="md" className="w-full">
                            تفاصيل الفعالية والحجز
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 4. Diplomas (Preserves exact heading for Admin toggle + E2E Test 5) */}
          {sec.diplomas && (
            <section className="py-14 sm:py-16">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                    الدبلومات التطبيقية المعتمدة حتى 140 ساعة
                  </h2>
                  <Link href="/diplomas" className="text-sm font-semibold text-[#8CA2FF] hover:underline">
                    تصفح الدبلومات ←
                  </Link>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {data.diplomas.map((dip) => (
                    <Card key={dip.id} spotlight className="bosla-card-hover flex flex-col justify-between p-6">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <Badge tone="info">
                            <GraduationCap className="h-4 w-4" />
                            {formatNumber(dip.totalHours)} ساعة تدريبية
                          </Badge>
                          <span className="text-xs font-semibold text-[#F5B94A]">
                            مشروع عملي وتقييم مدرب
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-[#EEF0FF]">{dip.titleAr}</h3>
                        <p className="mt-2 text-sm sm:text-base leading-[1.7] text-[#A9B1E0]">
                          {dip.descriptionAr}
                        </p>
                      </div>
                      <div className="mt-6">
                        <Link href={`/diplomas/${dip.slug}`}>
                          <Button variant="primary" className="w-full">
                            التفاصيل والمتطلبات والشهادة
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE CAREER ORIENTATION COMPASS (#specialization-quiz)
          (Preserves #specialization-quiz, button.text-start & "المركز #1")
         ===================================================================== */}
      {sec.specializationQuiz && (
        <section
          id="specialization-quiz"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6"
        >
          <Card spotlight className="scroll-reveal-up p-6 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <Badge tone="info">تحديد الميول التشغيلية</Badge>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-[#EEF0FF]">
                  اختبار بوصلة لتحديد التخصص الأنسب لك
                </h2>
              </div>
              {questions.length > 0 && !rankedResults && (
                <span className="rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] px-3.5 py-1.5 text-sm font-semibold tabular-nums text-[#8CA2FF]">
                  السؤال {formatNumber(quizStep + 1)} من {formatNumber(questions.length)}
                </span>
              )}
            </div>

            {questions.length > 0 && !rankedResults && (
              <div className="mb-5 h-2 w-full overflow-hidden rounded-full border border-[#8CA2FF]/20 bg-[#0B1440]">
                <div
                  className="h-full rounded-full bg-[#7C95FF] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(12, quizProgress)}%` }}
                />
              </div>
            )}

            {rankingLoading ? (
              <div className="py-12 text-center text-base font-medium text-[#A9B1E0]">
                جاري تحليل إجاباتك وترتيب المجالات المهنية المناسبة
              </div>
            ) : rankedResults ? (
              <div className="space-y-4">
                <AlertBanner tone="success" title="نتيجة بوصلة لأفضل 3 تخصصات لك">
                  تم احتساب التوصيات بناءً على ميولك التشغيلية والقطاع الذي تفضل العمل به.
                </AlertBanner>
                <div className="grid gap-4 sm:grid-cols-3">
                  {rankedResults.map((res, idx) => (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-5 transition-colors ${
                        idx === 0
                          ? 'border-[#8CA2FF]/60 bg-[#18266E] text-[#EEF0FF]'
                          : 'border-[#8CA2FF]/18 bg-[#0B1440] text-[#EEF0FF]'
                      }`}
                    >
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${
                          idx === 0
                            ? 'bg-[#7C95FF] text-[#070D2B]'
                            : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#8CA2FF]'
                        }`}
                      >
                        المركز #{formatNumber(idx + 1)}
                      </span>
                      <h3 className="mt-2.5 text-base font-semibold text-[#EEF0FF]">
                        {res.nameAr}
                      </h3>
                      <p className="mt-1.5 text-sm leading-[1.6] text-[#A9B1E0] line-clamp-3">
                        {res.descriptionAr}
                      </p>
                      {isUnlocked ? (
                        res.domain?.subfields?.[0]?.leaves?.find(
                          (l: any) => l.mappedCourse?.slug,
                        )?.mappedCourse?.slug && (
                          <Link
                            href={`/courses/${
                              res.domain.subfields[0].leaves.find(
                                (l: any) => l.mappedCourse?.slug,
                              ).mappedCourse.slug
                            }`}
                            className="mt-3 inline-block text-sm font-semibold text-[#8CA2FF] hover:underline"
                          >
                            ابدأ الكورس المقترح ←
                          </Link>
                        )
                      ) : (
                        <Link
                          href="/login"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5B94A] hover:underline"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          سجّل دخولك لفتح خطة التخصص
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={resetQuiz}>
                  إعادة الاختبار
                </Button>
              </div>
            ) : currentQuestion ? (
              <div className="space-y-4">
                <p className="text-base sm:text-lg font-semibold text-[#EEF0FF]">
                  {currentQuestion.promptAr}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuizOption(opt)}
                      className="group flex min-h-[52px] items-start gap-3 rounded-xl border border-[#8CA2FF]/18 bg-[#0B1440] p-4 text-start text-sm sm:text-base font-medium text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E] cursor-pointer"
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A] text-xs font-semibold tabular-nums text-[#8CA2FF] group-hover:bg-[#7C95FF] group-hover:text-[#070D2B]">
                        {formatNumber(idx + 1)}
                      </span>
                      <span className="leading-snug">{opt.label ?? opt.labelAr ?? ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-base text-[#A9B1E0]">
                سجّل دخولك لاستعراض التخصصات القيادية المتاحة في بوصلة.
              </p>
            )}
          </Card>
        </section>
      )}

      {/* =====================================================================
          TESTIMONIALS & INDUSTRIAL PARTNERS
         ===================================================================== */}
      {(sec.testimonials || sec.partners) && (
        <section className="border-y border-[#8CA2FF]/16 bg-[#0B1440] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
            {sec.testimonials && data.testimonials.length > 0 && (
              <div className="grid gap-6 md:grid-cols-3">
                {data.testimonials.map((t, idx) => (
                  <Card
                    key={t.id}
                    spotlight
                    className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 3]} bosla-card-hover flex flex-col justify-between p-6`}
                  >
                    <div>
                      <div className="mb-3 flex items-center gap-1 text-[#F5B94A]">
                        {Array.from({ length: t.rating }).map((_, sIdx) => (
                          <Star key={sIdx} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="text-base leading-[1.75] text-[#EEF0FF]">“{t.quoteAr}”</p>
                    </div>
                    <div className="mt-5 border-t border-[#8CA2FF]/14 pt-3">
                      <p className="text-sm font-semibold text-[#EEF0FF]">
                        {t.studentNameAr || t.authorName}
                      </p>
                      <p className="text-xs sm:text-sm text-[#A9B1E0]">
                        {[t.roleTitleAr, t.companyAr].filter(Boolean).join(' — ') ||
                          t.authorRoleAr}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {sec.partners && data.partners.length > 0 && (
              <div className="scroll-reveal-up rounded-2xl bosla-liquid-glass p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#EEF0FF]">
                    شركاء النجاح والتدريب الصناعي
                  </h3>
                  <p className="text-sm leading-[1.7] text-[#A9B1E0] mt-1">
                    تعاون مثمر لربط الكفاءات الشابة بشركات الإنتاج الداجني والأدوية البيطرية.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {data.partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="flex items-center gap-3 rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] px-4 py-2.5"
                    >
                      <img
                        src={partner.logoUrl || '/images/brand/partner-ommat.webp'}
                        alt={partner.nameAr || partner.name || 'شريك تدريب'}
                        className="h-9 w-9 rounded-lg bg-[#EEF0FF] p-1 object-contain"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#EEF0FF]">
                          {partner.nameAr || partner.name}
                        </p>
                        <p className="text-xs text-[#A9B1E0]">{partner.descriptionAr || 'شريك تدريب'}</p>
                      </div>
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

      {/* =====================================================================
          ACT 5 — EXCLUSIVE INVITATION GATE + B2B CORPORATE INQUIRY + FAQ
         ===================================================================== */}
      {!isUnlocked && (
        <section id="join-academy" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <div className="rounded-2xl bosla-liquid-glass-portal p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-start">
              <div className="w-28 shrink-0">
                <BoslaCompassSvg variant="seal" bearingDeg={35} className="w-full" />
              </div>
              <div className="space-y-3 max-w-xl">
                <p className="text-xs sm:text-sm font-medium text-[#F5B94A]">
                  بوابة الأعضاء والمتدربين
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                  افتح مكتبة الكورسات والمسارات والدبلومات كاملة بعد تسجيل الدخول
                </h2>
                <p className="text-sm sm:text-base leading-[1.7] text-[#A9B1E0]">
                  بمجرد دخولك إلى حسابك ستنتقل إلى لوحة المتدرب الخاصة بك مع مؤشرات التقدم والمسارات التعليمية والمجتمعات التفاعلية ومشغل الدروس عالي الجودة.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full sm:w-auto lg:w-64">
              <Link href="/login" className="w-full">
                <Button variant="primary" size="lg" className="w-full">
                  <Lock className="h-4 w-4" />
                  تسجيل الدخول للأكاديمية
                </Button>
              </Link>
              <Link href="/register" className="w-full">
                <Button variant="outline" size="lg" className="w-full">
                  إنشاء حساب متدرب جديد
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {(sec.b2bLead || sec.faqs) && (
        <section id="lead-section" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12">
            {sec.b2bLead && (
              <Card
                spotlight
                className={`scroll-reveal-start p-6 sm:p-8 ${sec.faqs ? 'lg:col-span-6' : 'lg:col-span-12'}`}
              >
                <Badge tone="info">استشارات وتدريب الشركات والأفراد</Badge>
                <h2 className="mt-2.5 text-2xl font-semibold text-[#EEF0FF]">
                  اطلب خطة تدريب لفريقك أو استشارة مسار مهني
                </h2>
                <div className="mt-4 flex gap-2 rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-1">
                  <button
                    type="button"
                    onClick={() => setLeadType('INDIVIDUAL')}
                    className={`min-h-[44px] flex-1 rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      leadType === 'INDIVIDUAL'
                        ? 'bg-[#7C95FF] text-[#070D2B]'
                        : 'text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF]'
                    }`}
                  >
                    متدرب فردي
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadType('CORPORATE_B2B')}
                    className={`min-h-[44px] flex-1 rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      leadType === 'CORPORATE_B2B'
                        ? 'bg-[#7C95FF] text-[#070D2B]'
                        : 'text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF]'
                    }`}
                  >
                    تدريب شركات ومزارع
                  </button>
                </div>

                <form onSubmit={handleLeadSubmit} className="mt-5 space-y-4">
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
              </Card>
            )}

            {sec.faqs && (
              <div
                className={`scroll-reveal-end ${sec.b2bLead ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}
              >
                <Badge tone="neutral">الأسئلة الشائعة</Badge>
                <h2 className="text-2xl font-semibold text-[#EEF0FF]">
                  إجابات واضحة حول العضوية والأمان والتعلم
                </h2>
                <div className="space-y-3">
                  {data.faqs.map((faq) => (
                    <details
                      key={faq.id}
                      className="group rounded-2xl bosla-liquid-glass p-4 transition-colors open:border-[#8CA2FF]/45"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-[#EEF0FF]">
                        <span>{faq.questionAr}</span>
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#8CA2FF]">
                          <ChevronDown className="bosla-chevron h-4 w-4" />
                        </span>
                      </summary>
                      <p className="mt-3 border-t border-[#8CA2FF]/14 pt-3 text-sm sm:text-base leading-[1.7] text-[#A9B1E0]">
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

      {/* Partner Inquiry Modal */}
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

      {/* Floating Guide Modal (ONLY available after authentication so unauthenticated / stays gated) */}
      {isUnlocked && (
        <>
          <div className="fixed bottom-5 end-5 z-30">
            <Button
              variant="navy"
              onClick={() => setAssistantOpen(true)}
              aria-label="افتح مرشد بوصلة الذكي"
              className="rounded-xl border border-[#8CA2FF]/25 bg-[#0B1440] px-4 py-2.5"
            >
              <MessageCircle className="h-4 w-4 text-[#8CA2FF]" />
              <span className="hidden sm:inline">مرشد بوصلة</span>
            </Button>
          </div>

          <NativeModal
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            title="مرشد بوصلة التفاعلي"
          >
            <div className="space-y-4">
              <p className="text-sm text-[#A9B1E0]">
                اكتب اسم التخصص أو المهارة التي تبحث عنها لنوجهك فوراً إلى الكورس أو المسار أو الدبلومة الأنسب:
              </p>
              <input
                type="search"
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                placeholder="مثال: دواجن، أمان حيوي، أعلاف، تسويق"
                className={inputClassName}
              />
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {assistantSuggestions.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    onClick={() => setAssistantOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-3 transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
                  >
                    <span className="text-sm font-semibold text-[#EEF0FF]">{item.title}</span>
                    <Badge tone="info">{item.kind}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </NativeModal>
        </>
      )}
    </div>
  );
}
