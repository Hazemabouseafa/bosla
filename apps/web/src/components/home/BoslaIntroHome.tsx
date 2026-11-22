'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BoslaAscentDiagram, BoslaMonolithHairline } from './BoslaArchVectors';
import type { MonolithViewPreset } from './BoslaMonolithCanvas';
import { HomepageShell } from './HomepageShell';

const BoslaMonolithCanvas = dynamic(
  () => import('./BoslaMonolithCanvas').then((m) => m.BoslaMonolithCanvas),
  { ssr: false },
);

export interface HomeIntroContent {
  titleAr?: string | null;
  sloganAr?: string | null;
  subtitleAr?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

const ELEVATION_STAGES = [
  {
    id: 'student',
    tag: 'طالب الكلية',
    title: 'تجاوز الحفظ النظري قبل التخرج',
    summary:
      'الربط المبكر بين المقررات الأكاديمية في الطب البيطري والزراعة وبين منطق التشغيل اليومي داخل العنبر والمختبر، لتتشكّل لديك عقلية تشخيصية وإدارية منظمة قبل دخول سوق العمل.',
    before: 'تراكم مواد نظرية منفصلة عن قرارات المزرعة ومصنع العلف.',
    after: 'فهم مترابط يربط صحة القطيع وكفاءة التشغيل بالعائد الاقتصادي.',
  },
  {
    id: 'practitioner',
    tag: 'خريج وممارس',
    title: 'تحويل الملاحظة الحقلية إلى بروتوكول منضبط',
    summary:
      'الانتقال من الاجتهاد الفردي المتفرق أمام تحديات الميدان إلى قراءة منهجية للمؤشرات الحيوية، وضبط التغذية والأمان الحيوي، والتعامل المهني مع فرق التشغيل والمُورّدين.',
    before: 'قرارات رد فعل سريعة تحت ضغط العمل الميداني اليومي.',
    after: 'منهجية تشخيص وتنفيذ منضبطة قابلة للتكرار والقياس في الموقع.',
  },
  {
    id: 'leader',
    tag: 'قائد منشأة وفريق',
    title: 'توحيد لغة العلم والإدارة داخل المؤسسة',
    summary:
      'تمكين مديري المزارع والمصانع وفرق الأجريبيزنس من بناء فرق متجانسة تتحدث لغة تقنية وتجارية واحدة ترفع استدامة الإنتاج وتقلل الهدر التشغيلي.',
    before: 'تباين مستوى التأهيل بين الفرق الفنية والمبيعات والإدارة.',
    after: 'معيار مؤسسي موحد يرتكز على التشغيل الواضح والمساءلة.',
  },
] as const;

const SECTOR_DISCIPLINES = [
  {
    id: 'vet',
    label: 'الطب البيطري والتشخيص الميداني',
    domainTag: 'الصحة الحيوية والوقاية',
    summary:
      'رصد العلامات المبكرة، وضبط بروتوكولات الأمان الحيوي وبرامج التحصين في المنشآت الميدانية لحماية استقرار القطيع.',
    image: '/images/homepage-atlas/discipline-vet-lab.webp',
    alt: 'مقعد تشخيص بيطري مجهز بدوارق زجاجية معقمة وقوارير عينات وماصة دقيقة في إضاءة دافئة',
  },
  {
    id: 'production',
    label: 'إنتاج الدواجن والثروة الحيوانية وإدارة المزارع',
    domainTag: 'هندسة بيئة العنبر',
    summary:
      'ضبط بيئة العنبر والتهوية والكثافات ومعدلات التحويل بما يحقق اتزان الأداء اليومي في مشروعات الإنتاج الحيواني والداجني.',
    image: '/images/homepage-atlas/discipline-poultry-hall.webp',
    alt: 'عنبر تربية دواجن وإنتاج حديث بتهوية دقيقة وخطوط علف معدنية منظمة تحت ضوء الصباح الطبيعي',
  },
  {
    id: 'nutrition',
    label: 'تغذية الحيوان وصياغة العلائق',
    domainTag: 'التوازن الغذائي والاقتصادي',
    summary:
      'قراءة جودة الخامات وتركيب العلائق على أسس علمية واقتصادية منضبطة تنعكس مباشرة على كفاءة التحويل وتكلفة الإنتاج.',
    image: '/images/homepage-atlas/discipline-nutrition-sieves.webp',
    alt: 'مناخل تحليل مخبرية نحاسية تحتوي على ذرة صفراء وكسب صويا وأعلاف محببة على لوح حجري داكن',
  },
  {
    id: 'agribusiness',
    label: 'الإدارة التجارية والأجريبيزنس',
    domainTag: 'القيادة وسلاسل السوق',
    summary:
      'إعداد الكوادر الفنية لإدارة المبيعات التخصصية وعلاقات الشركات والمزارع وبناء قرار تجاري يستند إلى فهم تقني صلب.',
    image: '/images/homepage-atlas/discipline-agribusiness-desk.webp',
    alt: 'مكتب قيادي لإدارة الأعمال الزراعية بملف عمل كحلي ومسطرة هندسية نحاسية مطل على صوبات وصوامع حديثة',
  },
] as const;

export function BoslaIntroHome({ intro }: { intro?: HomeIntroContent }) {
  const { user, pushToast } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(1);
  const [activeDisciplineIdx, setActiveDisciplineIdx] = useState(0);
  const [monolithView, setMonolithView] = useState<MonolithViewPreset>('perspective');

  // Lead / Concierge inquiry wired strictly to POST /api/v1/catalog/leads
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
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setMotionPaused(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-home-motion', motionPaused ? 'reduce' : 'full');
    return () => {
      document.documentElement.removeAttribute('data-home-motion');
    };
  }, [motionPaused]);

  const activeStage = ELEVATION_STAGES[activeStageIdx] ?? ELEVATION_STAGES[0];
  const activeDiscipline = SECTOR_DISCIPLINES[activeDisciplineIdx] ?? SECTOR_DISCIPLINES[0];
  const whatsappClean = (intro?.whatsapp || '+201001226683').replace(/[^0-9]/g, '') || '201001226683';
  const supportEmail = intro?.email || 'support@boslaagri.com';

  const rawTitle = intro?.titleAr?.trim() || '';
  const heroStatement =
    rawTitle && rawTitle !== 'أكاديمية بوصلة' && !rawTitle.includes('|')
      ? rawTitle
      : 'المعرفة التطبيقية حين تصبح قيادةً في الميدان';
  const heroSubtitle =
    intro?.subtitleAr ||
    'بيئة تعليمية وتطبيقية متخصصة في الطب البيطري وإنتاج الدواجن والثروة الحيوانية وتغذية الحيوان والأجريبيزنس، تربط بين الدراسة الجامعية وانضباط القرار داخل المزارع والشركات.';
  const colophonSlogan = intro?.sloganAr || 'من الطالب إلى المدير';

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
    } catch (err: any) {
      setFormError(err?.message || 'تعذر إرسال الرسالة، حاول مجدداً أو تواصل عبر واتساب.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HomepageShell
      motionPaused={motionPaused}
      onToggleMotion={() => setMotionPaused((prev) => !prev)}
    >
      {/* =====================================================================
          MOVEMENT I · ARCHITECTURAL ATLAS THRESHOLD (#050A24)
          No eyebrow pill kickers; borderless optical lab centerpiece in end horizon,
          Kufam monumental display statement anchored on dark slate start plane.
          ===================================================================== */}
      <section className="relative flex min-h-[calc(100svh-64px)] flex-col justify-between overflow-hidden bg-[#050A24]">
        <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-5 lg:gap-8 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
          {/* Desktop atmospheric studio horizon blending directly into void */}
          <div
            aria-hidden="true"
            className="pointer-events-none hidden lg:block absolute inset-y-0 end-0 w-[62%] overflow-hidden"
          >
            <img
              src="/images/homepage-atlas/atlas-hero-studio.webp"
              alt=""
              fetchPriority="high"
              className="h-full w-full object-cover object-left opacity-95"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(270deg, #050A24 0%, rgba(5,10,36,0.92) 22%, rgba(5,10,36,0.28) 64%, rgba(5,10,36,0.1) 100%)',
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-24"
              style={{
                background: 'linear-gradient(to top, #050A24 0%, transparent 100%)',
              }}
            />
          </div>

          {/* Mobile/Tablet Dedicated Edge-to-Edge Studio Photography Strip */}
          <div className="relative z-10 lg:hidden -mx-4 sm:-mx-6 -mt-5 sm:-mt-8 overflow-hidden border-b border-[#8CA2FF]/15 bg-[#070D2B]">
            <img
              src="/images/homepage-atlas/atlas-hero-studio.webp"
              alt="مجهر مخبري بيطري وأدوات قياس نحاسية وسجل ميداني تحت ضوء الصباح"
              fetchPriority="high"
              className="aspect-[2/1] max-h-[210px] w-full object-cover object-left"
            />
          </div>

          {/* Monumental Typographic Statement & Direct Entry */}
          <div className="relative z-10 lg:col-span-7 space-y-4 sm:space-y-6 lg:py-6 bosla-atlas-enter">
            <h1 className="bosla-display-font text-[clamp(2rem,4.7vw,4.35rem)] text-[#EEF0FF] max-w-[16ch]">
              {heroStatement}
            </h1>

            <p className="max-w-xl text-sm sm:text-lg leading-[1.75] sm:leading-[1.85] text-[#C8D0F5] border-s-2 border-[#F5B94A] ps-4">
              {heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              {!user ? (
                <Link
                  id="hero-primary-cta"
                  href="/register"
                  className="group inline-flex min-h-[46px] items-center gap-2.5 rounded-sm bg-[#7C95FF] px-5 sm:px-6 text-sm sm:text-base font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                >
                  <span>إنشاء حساب في الأكاديمية</span>
                  <ArrowLeft className="bosla-home-arrow h-4 w-4" />
                </Link>
              ) : (
                <Link
                  id="hero-primary-cta"
                  href="/login"
                  className="group inline-flex min-h-[46px] items-center gap-2.5 rounded-sm bg-[#7C95FF] px-5 sm:px-6 text-sm sm:text-base font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                >
                  <span>الدخول إلى حسابك</span>
                  <ArrowLeft className="bosla-home-arrow h-4 w-4" />
                </Link>
              )}

              <a
                href="#transition"
                className="inline-flex min-h-[46px] items-center gap-2 rounded-sm border border-[#8CA2FF]/35 bg-[#0B1440]/85 px-4 sm:px-5 text-sm sm:text-base font-semibold text-[#EEF0FF] transition-colors hover:border-[#F5B94A]"
              >
                <span>تعرّف على معادلة بوصلة</span>
                <ArrowDownLeft className="h-4 w-4 text-[#F5B94A]" />
              </a>
            </div>
          </div>
        </div>

        {/* Hairline Datum Horizon Anchor across Bottom of Opening Viewport */}
        <div className="relative z-10 border-t border-[#8CA2FF]/15 bg-[#050A24]/90">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 text-xs text-[#A9B1E0] sm:px-6 lg:px-8">
            <span className="font-bold text-[#F5B94A]">{colophonSlogan} — أكاديمية بوصلة</span>
            <span className="text-[#C2CAF2]">
              الطب البيطري · الإنتاج الحيواني والداجني · تغذية الحيوان · الأجريبيزنس
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT II · SUNLIT FIELD-LAB CHALK POLARITY (#F2F4FC, Ink #070D2B)
          Flat hairline-ruled architectural ledger with zero nested SaaS boxes.
          ===================================================================== */}
      <section
        id="transition"
        className="bosla-home-light border-y border-[#070D2B]/14 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="grid gap-10 lg:grid-cols-12 items-end">
            <div className="lg:col-span-7 space-y-5">
              <h2 className="bosla-display-font text-[clamp(1.95rem,3.6vw,3.2rem)] text-[#070D2B] max-w-[19ch]">
                الفجوة بين قاعة الدرس وقرار المزرعة لا تُسدّ بالحفظ
              </h2>
              <p className="max-w-2xl text-base sm:text-lg leading-[1.85] text-[#28346A]">
                في قطاع الثروة الحيوانية والداجنة والطب البيطري، يكسب الميدان من يربط المؤشر التشغيلي بتكلفة الطن وعائد العنبر قبل تنفيذ القرار. تأسست بوصلة لتنظيم هذا الانتقال المنهجي عبر مراحل العمل الواقعية.
              </p>
            </div>

            <div className="lg:col-span-5 border-t border-[#070D2B]/15 pt-4 lg:border-t-0 lg:border-s lg:ps-8">
              <BoslaAscentDiagram activeStep={activeStageIdx} />
              <div className="mt-3 flex items-center justify-between border-t border-[#070D2B]/15 pt-2.5 text-xs font-semibold text-[#28346A]">
                <span>مخطط الارتقاء الميداني</span>
                <span className="text-[#070D2B] font-bold">{activeStage.tag}</span>
              </div>
            </div>
          </div>

          {/* Flush Architectural Transformation Matrix (No Nested Floating Cards) */}
          <div className="border-y border-[#070D2B]/18 bg-[#E8ECF9]/55">
            <div
              role="tablist"
              aria-label="مراحل التحول التطبيقي في بوصلة"
              className="grid grid-cols-1 sm:grid-cols-3 border-b border-[#070D2B]/15"
            >
              {ELEVATION_STAGES.map((stage, idx) => {
                const selected = idx === activeStageIdx;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveStageIdx(idx)}
                    className={`min-h-[52px] px-5 py-3 text-start text-sm font-bold transition-colors cursor-pointer sm:border-e last:border-e-0 border-b sm:border-b-0 border-[#070D2B]/15 ${
                      selected
                        ? 'bg-[#070D2B] text-[#EEF0FF]'
                        : 'bg-transparent text-[#28346A] hover:bg-[#DDE3F6] hover:text-[#070D2B]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{stage.tag}</span>
                      {selected && (
                        <span className="inline-block h-2 w-2 rounded-full bg-[#F5B94A]" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-6 space-y-3">
                <h3 className="bosla-display-font text-2xl sm:text-3xl text-[#070D2B]">
                  {activeStage.title}
                </h3>
                <p className="text-sm sm:text-base leading-[1.85] text-[#28346A]">
                  {activeStage.summary}
                </p>
              </div>

              <div className="lg:col-span-6 grid gap-6 sm:grid-cols-2 border-t border-[#070D2B]/14 pt-6 lg:border-t-0 lg:border-s lg:ps-8 lg:pt-0">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#324075]">الوضع المعتاد قبل الانضباط التطبيقي</p>
                  <p className="text-sm sm:text-base font-semibold leading-[1.75] text-[#070D2B]">
                    {activeStage.before}
                  </p>
                </div>
                <div className="space-y-2 border-t border-[#070D2B]/14 pt-4 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0">
                  <p className="text-xs font-bold text-[#8F5C06]">المعادلة الميدانية داخل بوصلة</p>
                  <p className="text-sm sm:text-base font-semibold leading-[1.75] text-[#070D2B]">
                    {activeStage.after}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT III · 3D GEODESIC SPIRE ALCOVE & DOCTRINE (#070D2B)
          Open borderless WebGL stage echoing bosla-logo geometry + SVG fallback
          beside hairline-ruled operational doctrine.
          ===================================================================== */}
      <section id="architecture" className="relative bg-[#070D2B] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 items-center">
          {/* Open Spatial Architectural 3D Viewport */}
          <div className="lg:col-span-5">
            <div className="relative flex min-h-[360px] sm:min-h-[450px] items-center justify-center overflow-hidden border-y border-[#8CA2FF]/20 bg-[#050A24]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 44%, rgba(74, 103, 240, 0.2) 0%, rgba(5, 10, 36, 0.98) 74%)',
                }}
              />
              {/* Wireframe fallback rendered behind / when WebGL unavailable */}
              <BoslaMonolithHairline className="relative z-10 h-64 w-auto" />

              {/* Real-Time Interactive Extruded Three.js Sculpture */}
              <BoslaMonolithCanvas motionPaused={motionPaused} viewPreset={monolithView} />

              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t border-[#8CA2FF]/15 bg-[#050A24]/95 px-4 py-2.5 text-xs">
                <span className="hidden md:inline text-[#A9B1E0]">
                  اسحب الشكل ثلاثي الأبعاد للمعاينة
                </span>
                <span className="md:hidden text-[#A9B1E0]">
                  الإسقاط الهندسي المتعامد لعلامة بوصلة
                </span>
                <div className="hidden md:flex items-center gap-1.5" role="group" aria-label="زوايا معاينة النموذج">
                  {(
                    [
                      { id: 'perspective', label: 'منظور' },
                      { id: 'front', label: 'أمامي' },
                      { id: 'profile', label: 'جانبي' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setMonolithView(preset.id)}
                      aria-pressed={monolithView === preset.id}
                      className={`min-h-[32px] px-2.5 text-[11px] font-bold transition-colors cursor-pointer border ${
                        monolithView === preset.id
                          ? 'border-[#F5B94A] bg-[#F5B94A]/15 text-[#F5B94A]'
                          : 'border-[#8CA2FF]/20 text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Three Structural Tenets — Pure Hairline Boundaries */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h2 className="bosla-display-font text-[clamp(1.95rem,3.6vw,3.15rem)] text-[#EEF0FF] max-w-[18ch]">
                ثلاث ركائز تحكم البناء التعليمي داخل بوصلة
              </h2>
              <p className="max-w-2xl text-base leading-[1.85] text-[#C2CAF2]">
                لا تتعامل الأكاديمية مع المعرفة كعناوين منفصلة عن التنفيذ والعائد، بل كبنية متدرجة تبدأ من الانضباط العلمي وتصل إلى قرار الإدارة التجارية والميدانية.
              </p>
            </div>

            <div className="divide-y divide-[#8CA2FF]/16 border-y border-[#8CA2FF]/16">
              <div className="py-5 space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF] flex items-center gap-2.5">
                  <span className="inline-block h-2 w-2 bg-[#F5B94A] shrink-0" aria-hidden="true" />
                  <span>تنقية المحتوى التطبيقي وفق واقع السوق المصري والعربي</span>
                </h3>
                <p className="text-sm sm:text-base leading-[1.8] text-[#A9B1E0] ps-4.5">
                  التركيز على الإجراءات والقرارات التي تفرضها طبيعة العمل الفعلية في العنبر والمختبر والشركة، دون حشو نظري معزول عن التشغيل.
                </p>
              </div>
              <div className="py-5 space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF] flex items-center gap-2.5">
                  <span className="inline-block h-2 w-2 bg-[#7C95FF] shrink-0" aria-hidden="true" />
                  <span>ترجمة التشخيص والتغذية إلى لغة اقتصاديات الإنتاج</span>
                </h3>
                <p className="text-sm sm:text-base leading-[1.8] text-[#A9B1E0] ps-4.5">
                  تنمية القدرة على قراءة نسب التحويل، وجودة العلائق، والأمان الحيوي كأرقام تشغيلية واضحة أمام صاحب المنشأة والمستثمر.
                </p>
              </div>
              <div className="py-5 space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF] flex items-center gap-2.5">
                  <span className="inline-block h-2 w-2 bg-[#77E2B5] shrink-0" aria-hidden="true" />
                  <span>بوابة أعضاء مغلقة ومنضبطة للحفاظ على جودة التفاعل</span>
                </h3>
                <p className="text-sm sm:text-base leading-[1.8] text-[#A9B1E0] ps-4.5">
                  تبقى المقررات التطبيقية والتقييمات والمجتمعات التخصصية محصورة حصرياً داخل بوابة الأعضاء بعد تسجيل الدخول والتفعيل الأمني للحساب.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT IV · INTERACTIVE FOUR-DISCIPLINE ATLAS PLATE INDEX (#050A24)
          Asymmetric editorial dossier rejecting generic 4-card SaaS rows.
          Zero course/diploma/pricing references.
          ===================================================================== */}
      <section id="disciplines" className="border-t border-[#8CA2FF]/15 bg-[#050A24] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#8CA2FF]/16 pb-8">
            <h2 className="bosla-display-font text-[clamp(1.95rem,3.7vw,3.25rem)] text-[#EEF0FF] max-w-[18ch]">
              أربعة ميادين تشكّل العمود الفقري للصناعة
            </h2>
            <p className="max-w-md text-sm sm:text-base leading-[1.8] text-[#A9B1E0]">
              تغطي رسالة بوصلة الحلقات المتصلة في منظومة الثروة الحيوانية والداجنة، من الصحة والوقاية حتى التجارة والإدارة.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Start: Interactive 4-Discipline Index Ledger */}
            <div
              role="tablist"
              aria-label="ميادين التخصص في أكاديمية بوصلة"
              className="order-2 lg:order-1 lg:col-span-5 divide-y divide-[#8CA2FF]/16 border-y border-[#8CA2FF]/16"
            >
              {SECTOR_DISCIPLINES.map((discipline, idx) => {
                const selected = idx === activeDisciplineIdx;
                return (
                  <button
                    key={discipline.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveDisciplineIdx(idx)}
                    className={`group flex w-full flex-col gap-1.5 py-4 sm:py-5 px-4 text-start transition-colors cursor-pointer border-s-2 ${
                      selected
                        ? 'border-[#F5B94A] bg-[#0B1440]/85'
                        : 'border-transparent hover:border-[#8CA2FF]/50 hover:bg-[#09123A]'
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#8CA2FF]">
                      {discipline.domainTag}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[#EEF0FF] group-hover:text-[#F5B94A] transition-colors">
                      {discipline.label}
                    </span>
                    <span className={`text-sm leading-[1.75] text-[#A9B1E0] ${selected ? 'block' : 'hidden lg:block'}`}>
                      {discipline.summary}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* End (and First above tabs on Mobile): Authoritative Photography Plate */}
            <div className="order-1 lg:order-2 lg:col-span-7 space-y-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#8CA2FF]/22 bg-[#070D2B]">
                <img
                  src={activeDiscipline.image}
                  alt={activeDiscipline.alt}
                  className="h-full w-full object-cover transition-opacity duration-300"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050A24]/95 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-bold text-[#F5B94A]">{activeDiscipline.domainTag}</p>
                    <p className="mt-1 text-sm sm:text-lg font-bold text-[#EEF0FF]">
                      {activeDiscipline.label}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#C2CAF2] tabular-nums">
                    {activeDisciplineIdx + 1} / {SECTOR_DISCIPLINES.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MOVEMENT V · CONCIERGE DISPATCH & CLOSED GATE ENTRY (#F2F4FC)
          Direct API-backed inquiry form & clean membership entry gates.
          ===================================================================== */}
      <section
        id="contact"
        className="bosla-home-light border-t border-[#070D2B]/14 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 items-start">
          {/* Start Column: Direct Communication Ledger + Gate Panel */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-3">
              <h2 className="bosla-display-font text-[clamp(1.95rem,3.5vw,3rem)] text-[#070D2B]">
                تواصل مع فريق بوصلة مباشرة
              </h2>
              <p className="text-sm sm:text-base leading-[1.85] text-[#28346A]">
                للاستفسارات الفردية، أو لترتيب خطط التأهيل المؤسسي لفرق الشركات والمزارع ومصانع الأعلاف، يسعد فريقنا بالتواصل المباشر معك.
              </p>
            </div>

            <div className="divide-y divide-[#070D2B]/15 border-y border-[#070D2B]/15">
              <a
                href={`https://wa.me/${whatsappClean}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[52px] items-center justify-between py-3 text-sm font-bold text-[#070D2B] transition-colors hover:text-[#4A67F0]"
              >
                <span className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 text-[#0C7A52]" />
                  <span>التواصل الفوري عبر واتساب</span>
                </span>
                <span dir="ltr" className="text-xs font-semibold text-[#28346A] tabular-nums">
                  +{whatsappClean}
                </span>
              </a>

              <a
                href={`mailto:${supportEmail}`}
                className="flex min-h-[52px] items-center justify-between py-3 text-sm font-bold text-[#070D2B] transition-colors hover:text-[#4A67F0]"
              >
                <span className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[#4A67F0]" />
                  <span>البريد الرسمي</span>
                </span>
                <span dir="ltr" className="text-xs font-semibold text-[#28346A]">
                  {supportEmail}
                </span>
              </a>

              <div className="flex min-h-[48px] items-center gap-2.5 py-3 text-xs font-semibold text-[#28346A]">
                <MapPin className="h-4 w-4 text-[#4A67F0] shrink-0" />
                <span>القاهرة، جمهورية مصر العربية</span>
              </div>
            </div>

            {!user && (
              <div className="border border-[#070D2B] bg-[#070D2B] p-6 text-[#EEF0FF] space-y-4">
                <p className="text-base font-bold">هل لديك حساب عضو في الأكاديمية؟</p>
                <p className="text-xs sm:text-sm leading-relaxed text-[#A9B1E0]">
                  ادخل إلى حسابك أو أنشئ حساباً جديداً للانتقال لاحقاً إلى بوابة الأعضاء المغلقة.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    href="/login"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-[#7C95FF] px-5 text-sm font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                  >
                    تسجيل الدخول
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[#8CA2FF]/35 px-5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:border-[#F5B94A]"
                  >
                    إنشاء حساب
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* End Column: Hairline-Ruled Inquiry Form */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleContactSubmit}
              className="border border-[#070D2B]/18 bg-white p-6 sm:p-8 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#070D2B]/14 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#070D2B]">أرسل استفسارك مباشرة</h3>
                  <p className="text-xs text-[#28346A]">اختر صفة التواصل وأدخل بياناتك للرد عليك</p>
                </div>
                <div className="flex border border-[#070D2B]/20 bg-[#F2F4FC] p-0.5">
                  <button
                    type="button"
                    onClick={() => setLeadType('INDIVIDUAL')}
                    className={`min-h-[38px] px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                      leadType === 'INDIVIDUAL'
                        ? 'bg-[#070D2B] text-[#EEF0FF]'
                        : 'text-[#28346A] hover:text-[#070D2B]'
                    }`}
                  >
                    تواصل فردي
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadType('CORPORATE_B2B')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                      leadType === 'CORPORATE_B2B'
                        ? 'bg-[#070D2B] text-[#EEF0FF]'
                        : 'text-[#28346A] hover:text-[#070D2B]'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    شركة / مؤسسة
                  </button>
                </div>
              </div>

              {formError && (
                <div role="alert" className="border border-[#9E1C36]/35 bg-[#FFF1F3] px-4 py-3 text-sm font-semibold text-[#8A142B]">
                  {formError}
                </div>
              )}

              {submittedOk && (
                <div role="status" className="flex items-center gap-2.5 border border-[#0C7A52]/35 bg-[#EDFAF4] px-4 py-3 text-sm font-semibold text-[#0B6342]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>تم استلام رسالتك بنجاح! سيتواصل معك فريق أكاديمية بوصلة قريباً.</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="home-contact-name" className="block text-sm font-bold text-[#070D2B]">
                    الاسم الكامل *
                  </label>
                  <input
                    id="home-contact-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: د. كريم حسام"
                    className="w-full min-h-[46px] border border-[#070D2B]/25 bg-[#F8FAFF] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="home-contact-phone" className="block text-sm font-bold text-[#070D2B]">
                    رقم الموبايل (واتساب) *
                  </label>
                  <input
                    id="home-contact-phone"
                    type="tel"
                    dir="ltr"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="01001234567"
                    className="w-full min-h-[46px] border border-[#070D2B]/25 bg-[#F8FAFF] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
                  />
                </div>
              </div>

              {leadType === 'CORPORATE_B2B' && (
                <div className="space-y-1.5">
                  <label htmlFor="home-contact-company" className="block text-sm font-bold text-[#070D2B]">
                    اسم الشركة / المؤسسة
                  </label>
                  <input
                    id="home-contact-company"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="مثال: مجموعة مزارع أو شركة أعلاف"
                    className="w-full min-h-[46px] border border-[#070D2B]/25 bg-[#F8FAFF] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="home-contact-notes" className="block text-sm font-bold text-[#070D2B]">
                  تفاصيل الرسالة أو الاستفسار
                </label>
                <textarea
                  id="home-contact-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اكتب باختصار سؤالك أو مجال العمل الذي ترغب في التنسيق بشأنه..."
                  className="w-full min-h-[112px] border border-[#070D2B]/25 bg-[#F8FAFF] p-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2.5 rounded-sm bg-[#070D2B] px-7 text-sm font-bold text-[#EEF0FF] transition-colors hover:bg-[#111C59] disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-4 w-4 text-[#F5B94A]" />
                <span>{submitting ? 'جاري إرسال الرسالة...' : 'إرسال الرسالة الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </HomepageShell>
  );
}
