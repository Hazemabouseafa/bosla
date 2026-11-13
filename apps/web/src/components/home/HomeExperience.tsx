'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Building2,
  Clock,
  Compass,
  GraduationCap,
  Layers,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  apiFetch,
  difficultyLabelAr,
  formatEgp,
} from '@/lib/api';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

export interface HomeBundle {
  homePage?: any;
  categories: Array<{
    id: string;
    slug: string;
    nameAr: string;
    descriptionAr: string | null;
    iconUrl: string | null;
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
  learningPaths: Array<{
    id: string;
    slug: string;
    titleAr: string;
    subtitleAr: string | null;
    descriptionAr: string;
    thumbnailUrl: string | null;
    courses: Array<{
      id: string;
      sortOrder: number;
      course: {
        slug: string;
        publishedVersion: {
          titleAr: string;
          thumbnailUrl: string | null;
          durationMinutes: number;
        } | null;
      };
    }>;
  }>;
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
    authorName: string;
    authorRoleAr: string;
    quoteAr: string;
    rating: number;
  }>;
  partners: Array<{
    id: string;
    name: string;
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
  specialization: {
    questions: Array<{
      id: string;
      promptAr: string;
      options: Array<{
        labelAr: string;
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
    desc: 'حدد مسارك في الإنتاج الحيواني أو الداجني أو المبيعات البيطرية عبر اختبار التخصص الذكي.',
    href: '#specialization-quiz',
    color: 'from-bosla-primary to-bosla-navy',
  },
  {
    step: '02',
    title: 'ابدأ بكورسات التأسيس',
    desc: 'تعلّم الأسس الميدانية في التغذية والأمان الحيوي والتشريح التطبيقي بلغة بسيطة وعملية.',
    href: '/courses',
    color: 'from-bosla-purple to-bosla-primary',
  },
  {
    step: '03',
    title: 'انضم لمسار مهني',
    desc: 'ارتبط بخطة تعلم متدرجة تجمع الكورسات المترابطة للوصول إلى جاهزية سوق العمل.',
    href: '/learning-paths',
    color: 'from-bosla-navy to-bosla-success',
  },
  {
    step: '04',
    title: 'أتقن دبلومة تطبيقية',
    desc: '140 ساعة عملية تشمل مشاريع مزرعة وتقييمات تطبيقية ومراجعة من الخبراء.',
    href: '/diplomas',
    color: 'from-bosla-success to-bosla-primary',
  },
  {
    step: '05',
    title: 'قد فريقك بنجاح',
    desc: 'وثّق مهارتك بشهادات معتمدة برمز تحقق رقمي وانتقل من التنفيذ إلى إدارة المشاريع.',
    href: '/certificates/verify',
    color: 'from-bosla-amber to-bosla-primary',
  },
];

const PERSONAS = [
  {
    key: 'student',
    title: 'طالب جامعي',
    subtitle: 'سد الفجوة بين الكلية وسوق المزارع والشركات',
    recommend: 'ابدأ بدروس التأسيس المجانية ثم مسار أساسيات تربية الدواجن والتغذية.',
    ctaLabel: 'استكشف الكورسات التأسيسية',
    href: '/courses?difficulty=BEGINNER',
  },
  {
    key: 'grad',
    title: 'خريج حديث',
    subtitle: 'ادخل أول وظيفة بثقة طبية وتسويقية جاهزة',
    recommend: 'مسار مهندس/طبيب مزرعة محترف مع ملفات الأمان الحيوي وتقييم القطيع.',
    ctaLabel: 'عرض المسارات المهنية',
    href: '/learning-paths',
  },
  {
    key: 'field',
    title: 'طبيب أو مهندس ميداني',
    subtitle: 'طوّر أدواتك في تركيب العلائق، التشخيص الحقلي وخفض النفوق',
    recommend: 'الكورسات التطبيقية المتقدمة في إدارة العنابر وتحليل مؤشرات الأداء.',
    ctaLabel: 'تصفح الكورسات التطبيقية',
    href: '/courses?difficulty=INTERMEDIATE',
  },
  {
    key: 'manager',
    title: 'مدير مبيعات أو مزرعة',
    subtitle: 'تعظيم الربحية، قيادة الفرق البيعية وإدارة سلاسل التوريد',
    recommend: 'دبلومة إدارة مزارع الدواجن الشاملة وكورس التسويق البيطري الاستراتيجي.',
    ctaLabel: 'عرض الدبلومات المتخصصة',
    href: '/diplomas',
  },
];

export function HomeExperience({ data }: { data: HomeBundle | null }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activePersona, setActivePersona] = useState<string>('student');
  const [trackModalCat, setTrackModalCat] = useState<
    HomeBundle['categories'][number] | null
  >(null);

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

  // Assistant drawer
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');

  const filteredCourses = useMemo(() => {
    const all = data?.courses ?? [];
    if (selectedCategory === 'all') return all;
    if (selectedCategory === 'free') return all.filter((c) => c.isFree);
    return all.filter((c) => c.category?.slug === selectedCategory);
  }, [data?.courses, selectedCategory]);

  const modalCourses = useMemo(() => {
    if (!trackModalCat || !data) return [];
    return data.courses.filter((c) => c.category?.id === trackModalCat.id);
  }, [trackModalCat, data]);

  const questions = data?.specialization?.questions ?? [];
  const currentQuestion = questions[quizStep];

  const handleQuizOption = async (option: {
    labelAr: string;
    dimensionWeights?: Record<string, number>;
    speciesWeights?: Record<string, number>;
  }) => {
    const nextDim = { ...dimScores };
    const nextSpecies = { ...speciesScores };
    for (const [k, v] of Object.entries(option.dimensionWeights ?? {})) {
      nextDim[k] = (nextDim[k] ?? 0) + Number(v);
    }
    for (const [k, v] of Object.entries(option.speciesWeights ?? {})) {
      nextSpecies[k] = (nextSpecies[k] ?? 0) + Number(v);
    }
    setDimScores(nextDim);
    setSpeciesScores(nextSpecies);

    if (quizStep + 1 < questions.length) {
      setQuizStep(quizStep + 1);
    } else {
      setRankingLoading(true);
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
        setRankedResults(
          (data?.specialization?.domains ?? []).slice(0, 3).map((d, idx) => ({
            id: d.id,
            nameAr: d.nameAr,
            descriptionAr: d.descriptionAr,
            score: 92 - idx * 8,
            domain: d,
          })),
        );
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
          ? `تم استلام طلب الشركة بنجاح (درجة الجاهزية: ${created.leadScore}/7). سيتواصل معكم فريق بوصلة للتدريب المؤسسي قريباً.`
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
            لم نتمكن من جلب الكتالوج الحي من خادم الواجهة الخلفية في هذه اللحظة. تأكد من تشغيل خدمة API ثم أعد المحاولة.
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

  const personaObj = PERSONAS.find((p) => p.key === activePersona) ?? PERSONAS[0];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-[#081648] via-bosla-navy to-bosla-primary text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,#f5b94a,transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-bosla-amber/40 bg-bosla-amber/15 px-4 py-1.5 text-xs font-extrabold text-bosla-amber sm:text-sm">
              <Sparkles className="h-4 w-4" />
              من الطالب إلى المدير — التعليم البيطري والداجني التطبيقي
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
              حوّل دراستك إلى{' '}
              <span className="text-bosla-amber">خبرة ميدانية وقيادية</span>{' '}
              في الثروة الحيوانية والداجنة
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-indigo-100 sm:text-lg">
              أول أكاديمية رقمية متكاملة في العالم العربي تجمع بين الكورسات التطبيقية، المسارات المهنية، الدبلومات العملية 140 ساعة، والشهادات الموثقة — ببث فيديو آمن وتوثيق Passkey حديث بدون OTP.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href="/register">
                <Button variant="gold" size="lg">
                  ابدأ رحلتك الآن مجاناً
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#specialization-quiz">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Compass className="h-4 w-4" />
                  اكتشف تخصصك المناسب
                </Button>
              </a>
              <Link
                href="/pricing"
                className="text-sm font-bold text-indigo-100 underline decoration-bosla-amber/70 underline-offset-4 hover:text-white px-2"
              >
                عرض خطط العضوية الشهرية والسنوية
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-xl font-extrabold text-bosla-amber">+5,000</p>
                <p className="text-xs text-indigo-100">طالب وخريج ومدير</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-xl font-extrabold text-white">+200</p>
                <p className="text-xs text-indigo-100">ساعة تطبيقية وميدانية</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-xl font-extrabold text-emerald-300">9</p>
                <p className="text-xs text-indigo-100">تخصصات بيطرية وتجارية</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-xl font-extrabold text-bosla-amber">4.9 / 5</p>
                <p className="text-xs text-indigo-100">متوسط رضا المتدربين</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
              <img
                src="/images/brand/hero-banner.webp"
                alt="طلاب وخبراء أكاديمية بوصلة في التدريب التطبيقي"
                className="w-full rounded-2xl object-cover aspect-[4/3]"
                fetchPriority="high"
              />
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-bosla-ink/80 px-4 py-3 text-xs sm:text-sm">
                <span className="flex items-center gap-2 font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-bosla-success" />
                  عضوية شاملة تفتح الكورسات والمسارات
                </span>
                <Link
                  href="/courses"
                  className="font-extrabold text-bosla-amber hover:underline"
                >
                  تصفح {data.courses.length} كورساً ←
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Journey */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge tone="info">خارطة بوصلة المهنية</Badge>
            <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              رحلة متكاملة من مقعد الدراسة إلى إدارة المشروعات
            </h2>
          </div>
          <p className="max-w-md text-sm text-bosla-muted">
            ثلاث ركائز تعليمية فقط بدون تعقيد: الكورسات الفردية، مسارات التعلم المترابطة، والدبلومات التطبيقية المعتمدة.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY_STEPS.map((item) => (
            <Link key={item.step} href={item.href} className="group">
              <Card className="h-full p-5 transition-all hover:-translate-y-1 hover:border-bosla-primary">
                <div
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-sm font-extrabold text-white shadow-sm`}
                >
                  {item.step}
                </div>
                <h3 className="text-base font-extrabold text-bosla-ink group-hover:text-bosla-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-bosla-muted">
                  {item.desc}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 9 Tracks Showcase */}
      <section className="bg-white py-14 border-y border-bosla-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="purple">9 مجالات متخصصة</Badge>
              <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
                أقسام المعرفة التطبيقية في أكاديمية بوصلة
              </h2>
            </div>
            <Link href="/courses" className="text-sm font-bold text-bosla-primary hover:underline">
              استعرض الكتالوج الكامل ←
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTrackModalCat(cat)}
                className="group flex flex-col items-start rounded-2xl border border-bosla-line bg-bosla-bg/60 p-4 text-start transition-all hover:border-bosla-primary hover:bg-white hover:shadow-md cursor-pointer"
              >
                <div className="mb-3 h-14 w-14 overflow-hidden rounded-2xl border border-bosla-line bg-white p-1">
                  <img
                    src={cat.iconUrl || '/images/brand/track-poultry.webp'}
                    alt={cat.nameAr}
                    className="h-full w-full rounded-xl object-cover"
                  />
                </div>
                <p className="text-sm font-extrabold text-bosla-ink group-hover:text-bosla-primary">
                  {cat.nameAr}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-bosla-muted">
                  {cat.descriptionAr || 'تخصص تطبيقي متكامل ضمن مكتبة بوصلة'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Start From Where You Are + Specialization Quiz */}
      <section id="specialization-quiz" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Personas */}
          <Card className="p-6 lg:col-span-5 flex flex-col justify-between">
            <div>
              <Badge tone="warning">ابدأ من حيث أنت</Badge>
              <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink">
                توصية مخصصة لمستواك الحالي
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {PERSONAS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setActivePersona(p.key)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      activePersona === p.key
                        ? 'border-bosla-primary bg-bosla-primary text-white'
                        : 'border-bosla-line bg-bosla-bg/50 text-bosla-ink hover:border-bosla-primary'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-sm font-extrabold text-bosla-navy">
                  {personaObj.subtitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-bosla-ink">
                  {personaObj.recommend}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <Link href={personaObj.href}>
                <Button variant="navy" className="w-full">
                  {personaObj.ctaLabel}
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Interactive Specialization Assessment */}
          <Card className="p-6 lg:col-span-7 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <Badge tone="success">تقييم 12 مجالًا مهنيًا</Badge>
                <h2 className="mt-2 text-xl font-extrabold text-bosla-ink sm:text-2xl">
                  اختبار بوصلة لتحديد التخصص الأنسب لك
                </h2>
              </div>
              {questions.length > 0 && !rankedResults && (
                <span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-extrabold text-bosla-primary">
                  السؤال {quizStep + 1} من {questions.length}
                </span>
              )}
            </div>

            {rankingLoading ? (
              <div className="py-12 text-center text-sm font-bold text-bosla-muted">
                جاري تحليل إجاباتك وترتيب المجالات المهنية المناسبة...
              </div>
            ) : rankedResults ? (
              <div className="space-y-4">
                <AlertBanner tone="success" title="نتيجة بوصلة لأفضل 3 تخصصات لك">
                  تم احتساب التوصيات بناءً على ميولك التشغيلية والنوع الذي تفضل العمل به.
                </AlertBanner>
                <div className="grid gap-3 sm:grid-cols-3">
                  {rankedResults.map((res, idx) => (
                    <div
                      key={res.id}
                      className="rounded-2xl border border-bosla-line bg-white p-4 shadow-sm"
                    >
                      <span className="text-xs font-extrabold text-bosla-primary">
                        المركز #{idx + 1}
                      </span>
                      <h3 className="mt-1 text-base font-extrabold text-bosla-ink">
                        {res.nameAr}
                      </h3>
                      <p className="mt-1.5 text-xs text-bosla-muted line-clamp-3">
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
                          className="mt-3 inline-block text-xs font-extrabold text-bosla-success hover:underline"
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
                <p className="text-base font-extrabold text-bosla-navy">
                  {currentQuestion.promptAr}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuizOption(opt)}
                      className="rounded-xl border border-bosla-line bg-white p-3.5 text-start text-sm font-bold text-bosla-ink transition-all hover:border-bosla-primary hover:bg-indigo-50 cursor-pointer"
                    >
                      {opt.labelAr}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-bosla-muted">
                يمكنك تصفح المجالات الـ {data.specialization?.domains?.length ?? 12} مباشرة من الكتالوج.
              </p>
            )}
          </Card>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="info">الكورسات المميزة</Badge>
            <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              ابدأ التعلم التطبيقي اليوم
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-bosla-primary text-white'
                  : 'border border-bosla-line bg-white text-bosla-ink hover:border-bosla-primary'
              }`}
            >
              الكل ({data.courses.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('free')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === 'free'
                  ? 'bg-bosla-success text-white'
                  : 'border border-bosla-line bg-white text-bosla-ink hover:border-bosla-success'
              }`}
            >
              مجانية / معاينة
            </button>
            {data.categories.slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.slug)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  selectedCategory === c.slug
                    ? 'bg-bosla-primary text-white'
                    : 'border border-bosla-line bg-white text-bosla-ink hover:border-bosla-primary'
                }`}
              >
                {c.nameAr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCourses.map((course) => {
            const lessonCount =
              course.publishedVersion?.sections.reduce(
                (acc, s) => acc + s._count.lessons,
                0,
              ) ?? 0;
            return (
              <Card
                key={course.id}
                className="flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <Link href={`/courses/${course.slug}`} className="relative block aspect-video overflow-hidden bg-slate-100">
                  <img
                    src={
                      course.publishedVersion?.thumbnailUrl ||
                      '/images/brand/course-biosecurity.webp'
                    }
                    alt={course.publishedVersion?.titleAr || course.slug}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <span className="absolute top-3 start-3">
                    <Badge tone={course.isFree ? 'success' : 'warning'}>
                      {course.isFree ? 'كورس مجاني' : 'مشترك / عضوية'}
                    </Badge>
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <span className="text-xs font-bold text-bosla-primary">
                    {course.category?.nameAr}
                  </span>
                  <Link href={`/courses/${course.slug}`}>
                    <h3 className="mt-1 text-base font-extrabold text-bosla-ink hover:text-bosla-primary line-clamp-2">
                      {course.publishedVersion?.titleAr || course.slug}
                    </h3>
                  </Link>
                  <p className="mt-1.5 text-xs text-bosla-muted line-clamp-2">
                    {course.publishedVersion?.subtitleAr ||
                      course.publishedVersion?.descriptionAr}
                  </p>
                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-bosla-muted border-t border-bosla-line pt-3">
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="h-3.5 w-3.5 text-bosla-primary" />
                        {lessonCount} درس
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.publishedVersion?.durationMinutes ?? 0} د
                      </span>
                      <span>{difficultyLabelAr(course.difficulty).split('—')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          course.instructor.avatarUrl ||
                          '/images/brand/instructor-1.webp'
                        }
                        alt={course.instructor.fullName}
                        className="h-7 w-7 rounded-full object-cover border border-bosla-line"
                      />
                      <span className="text-xs font-bold text-bosla-ink truncate">
                        {course.instructor.fullName}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Learning Paths & 140-Hr Diplomas */}
      <section className="bg-white py-14 border-y border-bosla-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          {/* Paths */}
          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge tone="purple">المسارات التعليمية المهنية</Badge>
                <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink">
                  مسارات مبنية من كورسات الأكاديمية بدون تكرار
                </h2>
              </div>
              <Link href="/learning-paths" className="text-sm font-bold text-bosla-primary hover:underline">
                جميع المسارات ←
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {data.learningPaths.map((path) => (
                <Card key={path.id} className="p-6 flex flex-col justify-between border-indigo-200">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <Badge tone="info">
                        <Layers className="h-3.5 w-3.5" />
                        {path.courses.length} كورسات متتابعة
                      </Badge>
                      <span className="text-xs font-bold text-bosla-muted">
                        مسار مهني متكامل
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-bosla-ink">{path.titleAr}</h3>
                    <p className="mt-2 text-sm text-bosla-muted">{path.descriptionAr}</p>
                    <ul className="mt-4 space-y-1.5">
                      {path.courses.map((item, idx) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 text-xs font-semibold text-bosla-ink"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-bosla-primary font-extrabold">
                            {idx + 1}
                          </span>
                          {item.course.publishedVersion?.titleAr || item.course.slug}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6">
                    <Link href={`/learning-paths/${path.slug}`}>
                      <Button variant="primary" className="w-full">
                        استعراض خريطة المسار
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Diplomas */}
          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge tone="warning">الدبلومات التطبيقية المعتمدة</Badge>
                <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink">
                  دبلومات عملية حتى 140 ساعة مع تقييم المشاريع
                </h2>
              </div>
              <Link href="/diplomas" className="text-sm font-bold text-bosla-primary hover:underline">
                تصفح الدبلومات ←
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {data.diplomas.map((dip) => (
                <Card
                  key={dip.id}
                  className="overflow-hidden border-amber-200 bg-gradient-to-br from-white to-amber-50/40 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <Badge tone="warning">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {dip.totalHours} ساعة تدريبية
                      </Badge>
                      <span className="text-xs font-bold text-bosla-muted">
                        تتضمن مشروعاً عملياً وتقييم مدرب
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-bosla-ink">{dip.titleAr}</h3>
                    <p className="mt-2 text-sm text-bosla-muted">{dip.descriptionAr}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-amber-200/80 bg-white p-3 text-center text-xs">
                      <div>
                        <p className="font-extrabold text-bosla-primary">60 س</p>
                        <p className="text-bosla-muted">محاضرات عملية</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-bosla-success">50 س</p>
                        <p className="text-bosla-muted">حالات ومزارع</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-bosla-purple">30 س</p>
                        <p className="text-bosla-muted">مشروع تخرج</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Link href={`/diplomas/${dip.slug}`}>
                      <Button variant="gold" className="w-full">
                        التفاصيل والمتطلبات والشهادة
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Graduate Certificate Showcase */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <Card className="overflow-hidden bg-gradient-to-l from-bosla-navy to-bosla-primary text-white p-6 sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-7 space-y-4">
              <Badge className="bg-white/15 text-bosla-amber border-bosla-amber/40">
                شهادات موثقة رقمياً
              </Badge>
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                شهادة إتمام قابلة للتحقق الفوري برقم تسلسلي فريد
              </h2>
              <p className="text-sm leading-relaxed text-indigo-100">
                يحصل الطالب فور إتمام الدروس واجتياز الاختبارات أو تقييم الدبلومة على شهادة بوصلة الرسمية برمز تحقق عام يتيح للشركات وأصحاب المزارع التحقق من مصداقيتها في ثوانٍ.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/certificates/verify">
                  <Button variant="gold">
                    <Award className="h-4 w-4" />
                    تحقق من شهادة برمزها
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    سجل وابدأ مسيرتك
                  </Button>
                </Link>
              </div>
            </div>
            <div className="md:col-span-5">
              <img
                src="/images/brand/graduate-certificate.webp"
                alt="نموذج شهادة خريج أكاديمية بوصلة"
                className="w-full rounded-2xl border border-white/20 shadow-xl object-cover"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* Instructors */}
      <section className="bg-white py-14 border-y border-bosla-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="info">نخبة الخبراء والاستشاريين</Badge>
              <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
                مدربو أكاديمية بوصلة
              </h2>
            </div>
            <Link href="/instructors" className="text-sm font-bold text-bosla-primary hover:underline">
              تعرف على جميع المدربين ←
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.instructors.slice(0, 8).map((inst) => (
              <Card key={inst.id} className="p-5 text-center hover:border-bosla-primary transition-colors">
                <img
                  src={inst.avatarUrl || '/images/brand/instructor-1.webp'}
                  alt={inst.fullName}
                  className="mx-auto h-20 w-20 rounded-full border-2 border-bosla-line object-cover"
                />
                <h3 className="mt-3 text-base font-extrabold text-bosla-ink">
                  {inst.fullName}
                </h3>
                <p className="mt-1 text-xs font-bold text-bosla-primary line-clamp-2">
                  {inst.headlineAr || 'خبير ومدرب تطبيقي في أكاديمية بوصلة'}
                </p>
                <p className="mt-2 text-xs text-bosla-muted line-clamp-2">
                  {inst.bioAr || ''}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Pricing Plans */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 text-center">
          <Badge tone="success">نظام العضوية الشاملة</Badge>
          <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
            باقات العضوية الشهرية والسنوية
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-bosla-muted">
            اشتراك واحد يفتح لك المحتوى المشمول في الباقة وفق صلاحيات دقيقة وتحديثات مستمرة من الإدارة عبر بوابة Paymob.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {data.plans.map((plan) => (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col justify-between ${
                plan.interval === 'ANNUAL'
                  ? 'border-2 border-bosla-primary shadow-md'
                  : 'border-bosla-line'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge tone={plan.interval === 'ANNUAL' ? 'warning' : 'info'}>
                    {plan.discountLabelAr ||
                      (plan.interval === 'ANNUAL' ? 'الأكثر توفيراً' : 'مرونة شهرية')}
                  </Badge>
                  <span className="text-xs font-bold text-bosla-muted">
                    {plan.interval === 'ANNUAL' ? 'سنوي' : 'شهري'}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-bosla-ink">{plan.nameAr}</h3>
                <p className="mt-2 text-sm text-bosla-muted">{plan.descriptionAr}</p>
                <p className="mt-5 text-3xl font-extrabold text-bosla-navy">
                  {formatEgp(plan.priceCents)}
                  <span className="text-sm font-semibold text-bosla-muted">
                    {' '}
                    / {plan.interval === 'ANNUAL' ? 'سنة' : 'شهر'}
                  </span>
                </p>
              </div>
              <div className="mt-6">
                <Link href={`/pricing?plan=${plan.slug}`}>
                  <Button
                    variant={plan.interval === 'ANNUAL' ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    اشترك الآن
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials & Partners */}
      <section className="bg-white py-14 border-y border-bosla-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          <div className="grid gap-6 md:grid-cols-3">
            {data.testimonials.map((t) => (
              <Card key={t.id} className="p-6 bg-bosla-bg/40">
                <div className="mb-3 flex items-center gap-1 text-bosla-amber">
                  {Array.from({ length: t.rating }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-bosla-ink">“{t.quoteAr}”</p>
                <div className="mt-4 border-t border-bosla-line pt-3">
                  <p className="text-sm font-extrabold text-bosla-navy">{t.authorName}</p>
                  <p className="text-xs text-bosla-muted">{t.authorRoleAr}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="rounded-3xl border border-bosla-line bg-bosla-bg/50 p-6 sm:p-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-bosla-ink">
                شركاء النجاح والتدريب الصناعي
              </h3>
              <p className="text-sm text-bosla-muted mt-1">
                تعاون مثمر لربط الكفاءات الشابة بشركات الإنتاج الداجني والأدوية البيطرية.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {data.partners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex items-center gap-3 rounded-2xl border border-bosla-line bg-white px-4 py-2.5"
                >
                  <img
                    src={partner.logoUrl || '/images/brand/partner-ommat.webp'}
                    alt={partner.name}
                    className="h-10 w-10 rounded-xl object-contain"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-bosla-ink">{partner.name}</p>
                    <p className="text-xs text-bosla-muted">{partner.descriptionAr || 'شريك تدريب'}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPartnerModalOpen(true)}>
                <Building2 className="h-4 w-4" />
                كن شريكاً أو راعياً
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate B2B & Individual Lead Form + FAQs */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="p-6 sm:p-8 lg:col-span-6">
            <Badge tone="info">استشارات وتدريب الشركات والأفراد</Badge>
            <h2 className="mt-2 text-2xl font-extrabold text-bosla-ink">
              اطلب خطة تدريب لفريقك أو استشارة مسار مهني
            </h2>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setLeadType('INDIVIDUAL')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold cursor-pointer ${
                  leadType === 'INDIVIDUAL'
                    ? 'border-bosla-primary bg-bosla-primary text-white'
                    : 'border-bosla-line bg-white text-bosla-ink'
                }`}
              >
                متدرب فردي
              </button>
              <button
                type="button"
                onClick={() => setLeadType('CORPORATE_B2B')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold cursor-pointer ${
                  leadType === 'CORPORATE_B2B'
                    ? 'border-bosla-navy bg-bosla-navy text-white'
                    : 'border-bosla-line bg-white text-bosla-ink'
                }`}
              >
                تدريب شركات ومزارع B2B
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

          {/* FAQs */}
          <div className="lg:col-span-6 space-y-4">
            <Badge tone="neutral">الأسئلة الشائعة</Badge>
            <h2 className="text-2xl font-extrabold text-bosla-ink">
              إجابات واضحة حول العضوية والأمان والتعلم
            </h2>
            <div className="space-y-3">
              {data.faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="group rounded-2xl border border-bosla-line bg-white p-4 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-bosla-ink">
                    <span>{faq.questionAr}</span>
                    <span className="text-bosla-primary text-lg group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-bosla-line pt-3 text-sm leading-relaxed text-bosla-muted">
                    {faq.answerAr}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Track Courses Modal */}
      <NativeModal
        open={Boolean(trackModalCat)}
        onClose={() => setTrackModalCat(null)}
        title={trackModalCat ? `قسم: ${trackModalCat.nameAr}` : 'القسم'}
      >
        {trackModalCat && (
          <div className="space-y-4">
            <p className="text-sm text-bosla-muted">
              {trackModalCat.descriptionAr ||
                'مجموعة الكورسات المعتمدة والمرتبطة بهذا المجال التطبيقي.'}
            </p>
            {modalCourses.length > 0 ? (
              <div className="space-y-2.5">
                {modalCourses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/courses/${c.slug}`}
                    onClick={() => setTrackModalCat(null)}
                    className="flex items-center justify-between rounded-xl border border-bosla-line p-3 hover:border-bosla-primary hover:bg-indigo-50/40"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-bosla-ink">
                        {c.publishedVersion?.titleAr || c.slug}
                      </p>
                      <p className="text-xs text-bosla-muted">{c.instructor.fullName}</p>
                    </div>
                    <Badge tone={c.isFree ? 'success' : 'info'}>
                      {c.isFree ? 'مجاني' : 'عضوية'}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-bosla-muted">
                تُضاف كورسات جديدة لهذا القسم بانتظام. استعرض الكتالوج الكامل لمعرفة المتاح حالياً.
              </p>
            )}
            <Link
              href={`/courses?category=${trackModalCat.slug}`}
              onClick={() => setTrackModalCat(null)}
            >
              <Button variant="primary" className="w-full">
                عرض صفحة القسم في الكتالوج
              </Button>
            </Link>
          </div>
        )}
      </NativeModal>

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
          className="rounded-full shadow-xl px-4 py-3"
        >
          <MessageCircle className="h-5 w-5 text-bosla-amber" />
          <span className="hidden sm:inline">مرشد بوصلة</span>
        </Button>
      </div>

      <NativeModal
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        title="مرشد بوصلة التفاعلي"
      >
        <div className="space-y-4">
          <p className="text-sm text-bosla-muted">
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
                className="flex items-center justify-between rounded-xl border border-bosla-line p-3 hover:border-bosla-primary hover:bg-indigo-50/40"
              >
                <span className="text-sm font-bold text-bosla-ink">{item.title}</span>
                <Badge tone="info">{item.kind}</Badge>
              </Link>
            ))}
          </div>
          <div className="border-t border-bosla-line pt-3 flex items-center justify-between text-xs text-bosla-muted">
            <span>تحتاج دعماً مباشراً؟</span>
            <a
              href="https://wa.me/201001226683"
              target="_blank"
              rel="noreferrer"
              className="font-extrabold text-bosla-success hover:underline"
            >
              تواصل واتساب ←
            </a>
          </div>
        </div>
      </NativeModal>
    </div>
  );
}
