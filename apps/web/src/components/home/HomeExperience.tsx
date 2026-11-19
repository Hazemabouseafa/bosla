'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Compass,
  GraduationCap,
  Layers,
  Calendar,
  MapPin,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Users,
} from 'lucide-react';
import { rankSpecializationDomains } from '@bosla/shared';
import {
  apiFetch,
  difficultyLabelAr,
} from '@/lib/api';
import { formatEgp } from '@/lib/api';
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
    subtitleAr: string | null;
    descriptionAr: string;
    thumbnailUrl: string | null;
    totalHours: number;
    courses: Array<{
      id: string;
      course: {
        slug: string;
        publishedVersion: { titleAr: string; durationMinutes: number } | null;
      };
    }>;
  }>;
  instructors: Array<{
    id: string;
    fullName: string;
    headlineAr: string | null;
    bioAr: string | null;
    avatarUrl: string | null;
    _count: { instructedCourses: number };
  }>;
  testimonials: Array<{
    id: string;
    authorName?: string;
    authorRoleAr?: string;
    studentNameAr?: string;
    roleTitleAr?: string;
    companyAr?: string | null;
    quoteAr: string;
    rating: number;
  }>;
  partners: Array<{
    id: string;
    name?: string;
    nameAr?: string;
    descriptionAr: string | null;
    logoUrl: string | null;
    websiteUrl: string | null;
  }>;
  faqs: Array<{
    id: string;
    questionAr: string;
    answerAr: string;
  }>;
  plans: Array<{
    id: string;
    slug: string;
    nameAr: string;
    descriptionAr: string;
    interval: 'MONTHLY' | 'ANNUAL';
    priceCents: number;
    compareAtPriceCents?: number | null;
    discountLabelAr?: string | null;
    currency: string;
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
    endsAt?: string | null;
    priceCents: number;
    compareAtPriceCents?: number | null;
    currency: string;
    capacity: number;
    seatsBooked: number;
    remainingSeats: number;
    speakerNameAr?: string | null;
    instructor?: { fullName: string } | null;
  }>;
  specialization: {
    questions: Array<{
      id: string;
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
    domains: Array<{
      id: string;
      slug: string;
      nameAr: string;
      descriptionAr: string;
      subfields: Array<{
        id: string;
        nameAr: string;
        leaves: Array<{
          id: string;
          nameAr: string;
          mappedCourse?: { slug: string; status: string } | null;
        }>;
      }>;
    }>;
  };
}

const JOURNEY_STEPS = [
  {
    step: '01',
    title: 'اكتشف تخصصك',
    desc: 'حدد مسارك في الإنتاج الحيواني أو الداجني أو المبيعات البيطرية عبر اختبار التخصص.',
    href: '#specialization-quiz',
  },
  {
    step: '02',
    title: 'ابدأ بكورسات التأسيس',
    desc: 'تعلّم الأسس الميدانية في التغذية والأمان الحيوي والتشريح التطبيقي بأسلوب عملي.',
    href: '/courses',
  },
  {
    step: '03',
    title: 'انضم لمسار مهني',
    desc: 'ارتبط بخطة تعلم متدرجة تجمع الكورسات المترابطة للوصول إلى جاهزية سوق العمل.',
    href: '/learning-paths',
  },
  {
    step: '04',
    title: 'أتقن دبلومة تطبيقية',
    desc: 'برامج معمّقة تشمل مشاريع مزرعة وتقييمات تطبيقية ومراجعة من الخبراء.',
    href: '/diplomas',
  },
  {
    step: '05',
    title: 'قد فريقك باحترافية',
    desc: 'وثّق مهارتك بشهادات رقمية برمز تحقق عام وانتقل من التنفيذ إلى القيادة.',
    href: '/certificates/verify',
  },
];

const HERO_PILLARS = [
  {
    icon: BookOpen,
    title: 'كورسات تطبيقية محدثة',
    subtitle: 'منهجية مستندة إلى واقع المزارع',
  },
  {
    icon: Users,
    title: 'مدربون خبراء ميدانيون',
    subtitle: 'استشاريو الإنتاج وسوق الدواء',
  },
  {
    icon: Award,
    title: 'شهادات رقمية موثقة',
    subtitle: 'تحقق فوري برمز تسلسلي فريد',
  },
  {
    icon: ShieldCheck,
    title: 'تعلّم بمرونة وأمان',
    subtitle: 'بث فيديو مشفر ومجتمعات خاصة',
  },
];

const STAGGER_CLASSES = [
  'scroll-stagger-1',
  'scroll-stagger-2',
  'scroll-stagger-3',
  'scroll-stagger-4',
  'scroll-stagger-5',
];

export function HomeExperience({ data }: { data: HomeBundle | null }) {
  const sec = resolveSectionVisibility(
    data?.sectionVisibility ?? data?.settings?.section_visibility ?? data?.settings?.sectionVisibility,
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Specialization interactive quiz state
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

  // Sponsor inquiry modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [sponsorOrg, setSponsorOrg] = useState('');
  const [sponsorStatus, setSponsorStatus] = useState<string | null>(null);

  // Guide drawer
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');

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
          ? `تم استلام طلبك للشركة بنجاح (درجة الجاهزية: ${created.leadScore}/7). سيتواصل معكم فريق بوصلة للتدريب المؤسسي قريباً.`
          : 'تم تسجيل طلبك الاستشاري بنجاح! سيتواصل معك مستشار التعلم في بوصلة عبر الواتساب أو الهاتف.',
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
    if (!data) return [];
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
  }, [data, assistantQuery]);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <AlertBanner tone="warning" title="جارٍ تهيئة اتصال المنصة">
          <p className="mb-4">
            لم نتمكن من جلب الكتالوج الحي من خادم الواجهة الخلفية في هذه اللحظة.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/courses">
              <Button variant="primary">الانتقال إلى كتالوج الكورسات</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">تسجيل الدخول</Button>
            </Link>
          </div>
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* =====================================================================
          1. DARK MIDNIGHT CINEMATIC HERO (#070D2B + Blended Hero Portrait)
         ===================================================================== */}
      {sec.hero && (
      <section className="relative overflow-hidden border-b border-[#22307A] bg-[#070D2B] pb-16 pt-10 text-[#EEF0FF] sm:pb-20 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_18%_28%,rgba(8,166,155,0.12),transparent_65%)]"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            {/* Editorial Copy Column */}
            <div className="lg:col-span-6 space-y-5">
              <div className="hero-seq-1 inline-flex max-w-full items-center gap-2 rounded-full border border-[#8CA2FF]/35 bg-[#0F1A4A] px-4 py-1.5 text-xs sm:text-sm font-extrabold text-[#8CA2FF]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#8CA2FF]" />
                <span>من الطالب إلى المدير — التعليم البيطري والداجني</span>
              </div>

              <h1 className="hero-seq-2 text-[2rem] font-extrabold leading-[1.2] tracking-tight text-[#EEF0FF] sm:text-5xl lg:text-[3.35rem]">
                تعلّم مهارات حقيقية
                <span className="mt-1.5 block">
                  لبناء{' '}
                  <span className="text-[#8CA2FF]">
                    مستقبلك المهني
                  </span>
                </span>
              </h1>

              <p className="hero-seq-3 max-w-xl text-base leading-[1.7] text-[#A9B1E0]">
                كورسات تطبيقية، مسارات مهنية، ودبلومات معتمدة حتى 140 ساعة في الثروة الحيوانية والداجنة والأجريبيزنس — مصممة خصيصاً لسوق العمل والمزارع الحديثة.
              </p>

              <div className="hero-seq-4 flex flex-wrap items-center gap-3 pt-2">
                <Link href="/courses">
                  <Button variant="primary" size="lg" className="px-7">
                    <PlayCircle className="h-4 w-4" />
                    استكشف الكورسات
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="lg">
                    ابدأ رحلتك الآن
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href="#specialization-quiz"
                  className="inline-flex min-h-[44px] items-center gap-1.5 px-2.5 py-2 text-sm font-bold text-[#8CA2FF] hover:text-[#B4C4FF] transition-colors"
                >
                  <Compass className="h-4 w-4" />
                  <span className="underline underline-offset-4">اكتشف تخصصك</span>
                </a>
              </div>
            </div>

            {/* Blended Hero Portrait */}
            <div className="hero-seq-media lg:col-span-6 relative flex items-center justify-center">
              <div className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-[#22307A] bg-[#0B1440]">
                <img
                  src="/images/brand/hero-banner.webp"
                  alt="متدرب أكاديمية بوصلة في التعليم التطبيقي البيطري والداجني"
                  className="bosla-hero-portrait-mask aspect-[4/3] w-full object-cover object-[50%_18%]"
                  fetchPriority="high"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070D2B] via-transparent to-[#070D2B]/25"
                />
              </div>
            </div>
          </div>

          {/* 4 Architectural Value Pillars */}
          <div className="mt-10 grid grid-cols-2 divide-y divide-[#22307A] border-t border-[#22307A] pt-6 lg:grid-cols-4 lg:divide-y-0 lg:divide-x lg:divide-x-reverse">
            {HERO_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="flex flex-col items-center text-center px-3 py-3 lg:py-1"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22307A] bg-[#0F1A4A] text-[#8CA2FF]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-2.5 text-sm font-extrabold text-[#EEF0FF]">
                    {pillar.title}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-[#A9B1E0]">
                    {pillar.subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
          2. ELEVATED DARK METRIC BAR (100% REAL DATABASE COUNTS)
         ===================================================================== */}
      {sec.metrics && (
      <section className={`relative z-20 mx-auto ${sec.hero ? '-mt-7' : 'mt-6'} max-w-6xl px-4 sm:px-6`}>
        <div className="grid grid-cols-2 divide-y divide-[#22307A] rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
          {[
            {
              value: `+${data.courses.length}`,
              label: 'كورس تطبيقي منشور',
              icon: PlayCircle,
            },
            {
              value: `${data.categories.length}`,
              label: 'تخصصات بيطرية وتجارية',
              icon: Sparkles,
            },
            {
              value: `${data.learningPaths.length}`,
              label: 'مسارات مهنية متكاملة',
              icon: Layers,
            },
            {
              value: `${data.diplomas.length}`,
              label: 'دبلومات تطبيقية 140 ساعة',
              icon: GraduationCap,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center justify-center gap-3 px-3 py-2.5"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-[#8CA2FF]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xl font-extrabold text-[#EEF0FF] sm:text-2xl">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-[#A9B1E0]">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* =====================================================================
          3. CURATED COURSES SHOWCASE (4-COL GRID ON DARK MIDNIGHT)
         ===================================================================== */}
      {sec.courses && (
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-12 sm:px-6">
        <div className="scroll-reveal-up mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
            أبرز الكورسات التطبيقية
          </h2>
          <Link
            href="/courses"
            className="text-sm font-extrabold text-[#8CA2FF] hover:underline"
          >
            عرض جميع الكورسات ←
          </Link>
        </div>

        {/* Clean Category Filter Pills */}
        <div className="mb-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[44px] rounded-full px-5 py-2 text-sm font-extrabold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#7C95FF] text-[#070D2B]'
                : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF]'
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('free')}
            className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition-colors cursor-pointer ${
              selectedCategory === 'free'
                ? 'bg-[#7C95FF] text-[#070D2B]'
                : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF]'
            }`}
          >
            معاينة مجانية
          </button>
          {data.categories.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.slug)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                selectedCategory === c.slug
                  ? 'border border-[#8CA2FF] bg-[#18266E] text-[#8CA2FF] font-extrabold'
                  : 'border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF]'
              }`}
            >
              {c.nameAr}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCourses.map((course, idx) => {
            const lessonCount =
              course.publishedVersion?.sections.reduce(
                (acc, s) => acc + s._count.lessons,
                0,
              ) ?? 0;
            return (
              <Card
                key={course.id}
                className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 4]} bosla-card-hover group flex flex-col overflow-hidden`}
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
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1440]/65 via-transparent to-transparent"
                  />
                  <span className="absolute top-3 start-3 rounded-full bg-[#0B1440]/90 backdrop-blur-sm">
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
                    <h3 className="text-base font-extrabold leading-snug text-[#EEF0FF] transition-colors group-hover:text-[#8CA2FF] line-clamp-2">
                      {course.publishedVersion?.titleAr || course.slug}
                    </h3>
                  </Link>
                  <p className="mt-2 text-sm font-medium text-[#A9B1E0]">
                    {course.publishedVersion?.durationMinutes ?? 0} دقيقة • {lessonCount} دروس •{' '}
                    {difficultyLabelAr(course.difficulty).split('—')[0]}
                  </p>
                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between border-t border-[#22307A] pt-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={
                            course.instructor.avatarUrl ||
                            '/images/brand/instructor-1.webp'
                          }
                          alt={course.instructor.fullName}
                          className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[#22307A]"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#EEF0FF] truncate">
                          {course.instructor.fullName}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-extrabold text-[#8CA2FF]">
                        {course.category?.nameAr}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      )}

      {/* =====================================================================
          4. FLAGSHIP LEARNING PATHS SHOWCASE (LARGE & CLEAR)
         ===================================================================== */}
      {sec.learningPaths && (
      <section className="border-y border-[#22307A] bg-[#0B1440] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="scroll-reveal-up mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Badge tone="info">خارطة التدرج المهني المنظمة</Badge>
              <h2 className="mt-2.5 text-3xl font-extrabold text-[#EEF0FF] sm:text-4xl">
                المسارات التعليمية
              </h2>
              <p className="mt-2.5 text-base leading-[1.7] text-[#A9B1E0]">
                خطط تعلم متكاملة تجمع الكورسات المترابطة في تسلسل عملي واضح بدون تكرار لتأهيلك مهنياً من الطالب إلى المدير.
              </p>
            </div>
            <Link href="/learning-paths">
              <Button variant="outline" size="md">
                عرض جميع المسارات
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div
            className={`grid gap-8 ${
              data.learningPaths.length === 1
                ? 'mx-auto max-w-3xl'
                : 'lg:grid-cols-2'
            }`}
          >
            {data.learningPaths.map((path, idx) => (
              <LearningPathCard
                key={path.id}
                path={path}
                index={idx}
                headingLevel="h3"
                className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 3]}`}
              />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
          4B. OFFLINE EVENTS & WORKSHOPS SHOWCASE (Standalone Ticketing)
         ===================================================================== */}
      {sec.offlineEvents && (data.offlineEvents?.length ?? 0) > 0 && (
        <section className="border-y border-[#1E2B6F] bg-[#091138] py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="scroll-reveal-up mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <Badge tone="warning">تدريب عملي وميداني مباشر</Badge>
                <h2 className="mt-2.5 text-3xl font-extrabold text-[#EEF0FF] sm:text-4xl">
                  الفعاليات والكورسات الأوفلاين
                </h2>
                <p className="mt-2.5 text-base leading-[1.7] text-[#A9B1E0]">
                  ورش عمل تطبيقية وحلقات ميدانية وجهاً لوجه مع نخبة خبراء الدواجن، بتسعير مستقل لكل فعالية وحجز إلكتروني فوري.
                </p>
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
                <Card
                  key={ev.id}
                  className="overflow-hidden border-[#22307A] bg-[#0F1A4A] flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-52 w-full bg-[#0B1440]">
                      {ev.thumbnailUrl ? (
                        <img
                          src={ev.thumbnailUrl}
                          alt={ev.titleAr}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#8CA2FF]">
                          <Ticket className="h-12 w-12 opacity-60" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#091138]/90 border border-[#22307A] px-3 py-1 text-xs font-bold text-[#EEF0FF]">
                          {ev.categoryLabelAr}
                        </span>
                      </div>
                      <div className="absolute top-3 left-3 rounded-full bg-[#7C95FF] px-3 py-1 text-xs font-extrabold text-[#070D2B]">
                        {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <h3 className="text-xl font-extrabold text-[#EEF0FF] leading-snug">
                        {ev.titleAr}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#A9B1E0] line-clamp-2">
                        {ev.descriptionAr}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-[#A9B1E0]">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          {ev.cityAr} — {ev.venueNameAr}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          {new Date(ev.startsAt).toLocaleDateString('ar-EG', {
                            dateStyle: 'medium',
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          متبقي {ev.remainingSeats} من {ev.capacity} مقعد
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#A9B1E0]">سعر التذكرة</p>
                      <p className="text-lg font-extrabold text-[#8CA2FF]">
                        {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                      </p>
                    </div>
                    <Link href={`/events/${ev.slug}`}>
                      <Button variant="primary" size="md">
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

      {/* =====================================================================
          5. 140-HR APPLIED DIPLOMAS SHOWCASE
         ===================================================================== */}
      {sec.diplomas && (
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="scroll-reveal-up mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
                الدبلومات التطبيقية المعتمدة حتى 140 ساعة
              </h2>
            </div>
            <Link
              href="/diplomas"
              className="text-sm font-extrabold text-[#8CA2FF] hover:underline"
            >
              تصفح الدبلومات ←
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {data.diplomas.map((dip, idx) => (
              <div
                key={dip.id}
                className={`scroll-reveal-zoom ${STAGGER_CLASSES[idx % 2]} bosla-card-hover flex flex-col justify-between rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-6 sm:p-7 text-[#EEF0FF]`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/18 px-3.5 py-1 text-xs sm:text-sm font-extrabold text-[#8CA2FF]">
                      <GraduationCap className="h-4 w-4" />
                      {dip.totalHours} ساعة تدريبية
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#8CA2FF]">
                      تتضمن مشروعاً عملياً وتقييم مدرب
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#EEF0FF]">{dip.titleAr}</h3>
                  <p className="mt-2 text-base leading-[1.7] text-[#A9B1E0]">
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
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
          6. 5-STEP KINETIC JOURNEY
         ===================================================================== */}
      {sec.journey && (
      <section className="border-y border-[#22307A] bg-[#0B1440] py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="scroll-reveal-up mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge tone="info">خارطة بوصلة المهنية</Badge>
              <h2 className="mt-2.5 text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
                رحلة متكاملة من مقعد الدراسة إلى إدارة المشروعات
              </h2>
            </div>
            <p className="max-w-md text-base leading-[1.7] text-[#A9B1E0]">
              ثلاث ركائز تعليمية بدون تعقيد: الكورسات الفردية، مسارات التعلم المترابطة، والدبلومات التطبيقية المعتمدة.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {JOURNEY_STEPS.map((item, idx) => (
              <Link
                key={item.step}
                href={item.href}
                className={`group scroll-reveal-up ${STAGGER_CLASSES[idx % 5]} block`}
              >
                <Card className="bosla-card-hover h-full p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-sm font-extrabold text-[#8CA2FF]">
                      {item.step}
                    </span>
                    <ArrowLeft className="h-4 w-4 text-[#A9B1E0] transition-transform group-hover:-translate-x-1 group-hover:text-[#8CA2FF]" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#EEF0FF] group-hover:text-[#8CA2FF] transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-[1.7] text-[#A9B1E0]">
                    {item.desc}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
          7. SPECIALIZATION QUIZ ARENA
             (Preserves #specialization-quiz, button.text-start & "المركز #1")
         ===================================================================== */}
      {sec.specializationQuiz && (
      <section
        id="specialization-quiz"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16"
      >
        <Card className="scroll-reveal-up p-6 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <Badge tone="info">تقييم التخصصات</Badge>
                <h2 className="mt-2 text-xl font-extrabold text-[#EEF0FF] sm:text-2xl">
                  اختبار بوصلة لتحديد التخصص الأنسب لك
                </h2>
              </div>
              {questions.length > 0 && !rankedResults && (
                <span className="rounded-xl border border-[#22307A] bg-[#0B1440] px-3.5 py-1.5 text-sm font-extrabold text-[#8CA2FF]">
                  السؤال {quizStep + 1} من {questions.length}
                </span>
              )}
            </div>

            {questions.length > 0 && !rankedResults && (
              <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full border border-[#22307A] bg-[#0B1440]">
                <div
                  className="h-full rounded-full bg-[#7C95FF] transition-all duration-300"
                  style={{ width: `${Math.max(12, quizProgress)}%` }}
                />
              </div>
            )}

            {rankingLoading ? (
              <div className="py-12 text-center text-base font-bold text-[#A9B1E0]">
                جاري تحليل إجاباتك وترتيب المجالات المهنية المناسبة...
              </div>
            ) : rankedResults ? (
              <div className="space-y-4">
                <AlertBanner tone="success" title="نتيجة بوصلة لأفضل 3 تخصصات لك">
                  تم احتساب التوصيات بناءً على ميولك التشغيلية والنوع الذي تفضل العمل به.
                </AlertBanner>
                <div className="grid gap-4 sm:grid-cols-3">
                  {rankedResults.map((res, idx) => (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-5 transition-colors ${
                        idx === 0
                          ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                          : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF]'
                      }`}
                    >
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                          idx === 0
                            ? 'bg-[#7C95FF] text-[#070D2B]'
                            : 'border border-[#22307A] bg-[#0F1A4A] text-[#8CA2FF]'
                        }`}
                      >
                        المركز #{idx + 1}
                      </span>
                      <h3 className="mt-2.5 text-base font-extrabold text-[#EEF0FF]">
                        {res.nameAr}
                      </h3>
                      <p className="mt-1.5 text-sm leading-[1.6] text-[#A9B1E0] line-clamp-3">
                        {res.descriptionAr}
                      </p>
                      {res.domain?.subfields?.[0]?.leaves?.find(
                        (l: any) => l.mappedCourse?.slug,
                      )?.mappedCourse?.slug && (
                        <Link
                          href={`/courses/${
                            res.domain.subfields[0].leaves.find(
                              (l: any) => l.mappedCourse?.slug,
                            ).mappedCourse.slug
                          }`}
                          className="mt-3 inline-block text-sm font-extrabold text-[#8CA2FF] hover:underline"
                        >
                          ابدأ الكورس المقترح ←
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
                <p className="text-base font-extrabold text-[#EEF0FF] sm:text-lg">
                  {currentQuestion.promptAr}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuizOption(opt)}
                      className="group flex min-h-[52px] items-start gap-2.5 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-start text-sm sm:text-base font-bold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E] cursor-pointer"
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#22307A] bg-[#0F1A4A] text-xs font-extrabold text-[#8CA2FF] group-hover:border-[#7C95FF] group-hover:bg-[#7C95FF] group-hover:text-[#070D2B]">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{opt.label ?? opt.labelAr ?? ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-base text-[#A9B1E0]">
                يمكنك تصفح المجالات المتخصصة مباشرة من الكتالوج.
              </p>
            )}
        </Card>
      </section>
      )}

      {/* =====================================================================
          8. INSTRUCTORS SHOWCASE
         ===================================================================== */}
      {sec.instructors && (
      <section className="border-y border-[#22307A] bg-[#0B1440] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="scroll-reveal-up mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="info">نخبة الخبراء والاستشاريين</Badge>
              <h2 className="mt-2.5 text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
                مدربو أكاديمية بوصلة
              </h2>
            </div>
            <Link
              href="/instructors"
              className="text-sm font-extrabold text-[#8CA2FF] hover:underline"
            >
              تعرف على جميع المدربين ←
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.instructors.slice(0, 8).map((inst, idx) => (
              <Card
                key={inst.id}
                className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 4]} bosla-card-hover p-5 text-center`}
              >
                <img
                  src={inst.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={inst.fullName}
                  className="mx-auto h-20 w-20 rounded-full border-2 border-[#8CA2FF]/50 object-cover"
                />
                <h3 className="mt-3 text-base font-extrabold text-[#EEF0FF]">
                  {inst.fullName}
                </h3>
                <p className="mt-1 text-sm font-bold text-[#8CA2FF] line-clamp-2">
                  {inst.headlineAr || 'خبير ومدرب تطبيقي في أكاديمية بوصلة'}
                </p>
                <p className="mt-1.5 text-sm leading-[1.6] text-[#A9B1E0] line-clamp-2">
                  {inst.bioAr || ''}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* =====================================================================
          10. MEMBERSHIP PLANS
         ===================================================================== */}
      {sec.memberships && (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="scroll-reveal-up mb-9 text-center">
          <Badge tone="info">نظام العضوية الشاملة</Badge>
          <h2 className="mt-2.5 text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
            باقات العضوية الشهرية والسنوية
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-base leading-[1.7] text-[#A9B1E0]">
            اشتراك واحد يفتح لك المحتوى المشمول في الباقة وفق صلاحيات دقيقة وتحديثات مستمرة من الإدارة ودفع إلكتروني آمن.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {data.plans.map((plan) => {
            const isAnnual = plan.interval === 'ANNUAL';
            return (
              <div
                key={plan.id}
                className={`scroll-reveal-zoom bosla-card-hover flex flex-col justify-between rounded-2xl border p-7 ${
                  isAnnual
                    ? 'border-[#8CA2FF] bg-[#18266E] text-[#EEF0FF]'
                    : 'border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Badge tone={isAnnual ? 'success' : 'info'}>
                      {plan.discountLabelAr || (isAnnual ? 'الأكثر توفيراً' : 'مرونة شهرية')}
                    </Badge>
                    <span className="text-sm font-extrabold text-[#8CA2FF]">
                      {isAnnual ? 'سنوي' : 'شهري'}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#EEF0FF]">
                    {plan.nameAr}
                  </h3>
                  <p className="mt-2 text-base leading-[1.7] text-[#A9B1E0]">
                    {plan.descriptionAr}
                  </p>
                  <p className="mt-5 text-4xl font-extrabold text-[#EEF0FF]">
                    {formatEgp(plan.priceCents)}
                    <span className="text-sm font-semibold text-[#8CA2FF]">
                      {' '}
                      / {isAnnual ? 'سنة' : 'شهر'}
                    </span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm font-medium text-[#A9B1E0]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#77E2B5]" />
                      وصول مباشر للكورسات ومجتمعات التعلم المشمولة
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#77E2B5]" />
                      أسئلة وأجوبة مرتبطة بتوقيت الفيديو مع المدرب
                    </li>
                  </ul>
                </div>
                <div className="mt-7">
                  <Link href={`/pricing?plan=${plan.slug}`}>
                    <Button variant={isAnnual ? 'primary' : 'outline'} className="w-full">
                      اشترك الآن
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* =====================================================================
          11. TESTIMONIALS & INDUSTRIAL PARTNERS
         ===================================================================== */}
      {(sec.testimonials || sec.partners) && (
      <section className="border-y border-[#22307A] bg-[#0B1440] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          {sec.testimonials && (
          <div className="grid gap-5 md:grid-cols-3">
            {data.testimonials.map((t, idx) => (
              <Card
                key={t.id}
                className={`scroll-reveal-up ${STAGGER_CLASSES[idx % 3]} bosla-card-hover flex flex-col justify-between p-6`}
              >
                <div>
                  <div className="mb-3 flex items-center gap-1 text-[#F5B94A]">
                    {Array.from({ length: t.rating }).map((_, sIdx) => (
                      <Star key={sIdx} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-base leading-[1.7] text-[#EEF0FF]">“{t.quoteAr}”</p>
                </div>
                <div className="mt-5 border-t border-[#22307A] pt-3">
                  <p className="text-sm font-extrabold text-[#EEF0FF]">
                    {t.studentNameAr || t.authorName}
                  </p>
                  <p className="text-sm text-[#A9B1E0]">
                    {[t.roleTitleAr, t.companyAr].filter(Boolean).join(' — ') ||
                      t.authorRoleAr}
                  </p>
                </div>
              </Card>
            ))}
          </div>
          )}

          {sec.partners && (
          <div className="scroll-reveal-up rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-[#EEF0FF]">
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
                  className="flex items-center gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] px-4 py-2.5"
                >
                  <img
                    src={partner.logoUrl || '/images/brand/partner-ommat.webp'}
                    alt={partner.nameAr || partner.name || 'شريك تدريب'}
                    className="h-9 w-9 rounded-lg bg-[#EEF0FF] p-1 object-contain"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-[#EEF0FF]">
                      {partner.nameAr || partner.name}
                    </p>
                    <p className="text-xs sm:text-sm text-[#A9B1E0]">{partner.descriptionAr || 'شريك تدريب'}</p>
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
          12. B2B CORPORATE TRAINING & FAQ ACCORDIONS
         ===================================================================== */}
      {(sec.b2bLead || sec.faqs) && (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-12">
          {sec.b2bLead && (
          <>
          {/* Lead Capture (Preserves #lead-name, #lead-phone, #lead-company) */}
          <Card className={`scroll-reveal-start p-6 sm:p-8 ${sec.faqs ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
            <Badge tone="info">استشارات وتدريب الشركات والأفراد</Badge>
            <h2 className="mt-2.5 text-2xl font-extrabold text-[#EEF0FF]">
              اطلب خطة تدريب لفريقك أو استشارة مسار مهني
            </h2>
            <div className="mt-4 flex gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-1">
              <button
                type="button"
                onClick={() => setLeadType('INDIVIDUAL')}
                className={`min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-extrabold transition-colors cursor-pointer ${
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
                className={`min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-extrabold transition-colors cursor-pointer ${
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
                  placeholder="أخبرنا عن التحديات أو المهارات المطلوب تدريب الفريق عليها..."
                />
              </Field>

              <Button type="submit" variant="primary" className="w-full" disabled={leadBusy}>
                {leadBusy ? 'جاري الإرسال...' : 'إرسال الطلب الآن'}
              </Button>
            </form>
          </Card>
          </>
          )}

          {sec.faqs && (
          <>
          {/* FAQs */}
          <div className={`scroll-reveal-end ${sec.b2bLead ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}>
            <Badge tone="neutral">الأسئلة الشائعة</Badge>
            <h2 className="text-2xl font-extrabold text-[#EEF0FF]">
              إجابات واضحة حول العضوية والأمان والتعلم
            </h2>
            <div className="space-y-3">
              {data.faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="group rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4 transition-colors open:border-[#8CA2FF]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-extrabold text-[#EEF0FF]">
                    <span>{faq.questionAr}</span>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#22307A] bg-[#0B1440] text-[#8CA2FF]">
                      <ChevronDown className="bosla-chevron h-4 w-4" />
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-[#22307A] pt-3 text-base leading-[1.7] text-[#A9B1E0]">
                    {faq.answerAr}
                  </p>
                </details>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      </section>
      )}

      {/* Partner / Sponsor Inquiry Modal */}
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

      {/* Floating Bosla Guide Button + Modal */}
      <div className="fixed bottom-5 end-5 z-30">
        <Button
          variant="navy"
          onClick={() => setAssistantOpen(true)}
          aria-label="افتح مرشد بوصلة الذكي"
          className="rounded-full border border-[#8CA2FF]/45 bg-[#0B1440] px-4 py-3"
        >
          <MessageCircle className="h-5 w-5 text-[#8CA2FF]" />
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
            placeholder="مثال: دواجن، أمان حيوي، أعلاف، تسويق..."
            className={inputClassName}
          />
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {assistantSuggestions.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                onClick={() => setAssistantOpen(false)}
                className="flex items-center justify-between rounded-xl border border-[#22307A] bg-[#0B1440] p-3 transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
              >
                <span className="text-sm font-bold text-[#EEF0FF]">{item.title}</span>
                <Badge tone="info">{item.kind}</Badge>
              </Link>
            ))}
          </div>
          <div className="border-t border-[#22307A] pt-3 flex items-center justify-between text-sm text-[#A9B1E0]">
            <span>تحتاج دعماً مباشراً؟</span>
            <a
              href="https://wa.me/201001226683"
              target="_blank"
              rel="noreferrer"
              className="font-extrabold text-[#8CA2FF] hover:underline"
            >
              تواصل واتساب ←
            </a>
          </div>
        </div>
      </NativeModal>
    </div>
  );
}
