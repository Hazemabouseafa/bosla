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
    tag: '٠١ · طالب الكلية',
    title: 'تجاوز الحفظ النظري قبل يوم التخرج',
    summary:
      'الربط المبكر بين المناهج الأكاديمية في الطب البيطري والزراعة وبين منطق التشغيل الفعلي داخل العنبر والمختبر، لبناء عقلية تشخيصية وإدارية منظمة قبل دخول السوق.',
    shiftFrom: 'تراكم مقررات نظرية منفصلة عن قرارات المزرعة والشركة.',
    shiftTo: 'فهم متكامل لعلاقة صحة القطيع وكفاءة التشغيل بالعائد الاقتصادي.',
  },
  {
    id: 'practitioner',
    tag: '٠٢ · خريج وممارس',
    title: 'تحويل الملاحظة الميدانية إلى بروتوكول منضبط',
    summary:
      'الانتقال من رد الفعل العشوائي أمام المشكلات اليومية إلى قراءة منهجية للمؤشرات الحيوية، وضبط التغذية والأمان الحيوي، والتفاوض العلمي مع فرق العمل.',
    shiftFrom: 'اجتهاد فردي وتجارب متفرقة تحت ضغط العمل الميداني.',
    shiftTo: 'منهجية تشخيص وتنفيذ قابلة للتكرار والقياس في مواقع الإنتاج.',
  },
  {
    id: 'leader',
    tag: '٠٣ · قائد منشأة وفريق',
    title: 'توحيد لغة العلم والإدارة داخل المؤسسة',
    summary:
      'تمكين مديري المزارع والمصانع وفرق الأجريبيزنس من تأسيس فرق متجانسة تتحدث لغة تقنية وتجارية موحدة ترفع استدامة الإنتاج وجودة القرار.',
    shiftFrom: 'تباين مستوى التأهيل بين الفرق الفنية والإدارية والتجارية.',
    shiftTo: 'منظومة قيادة مؤسسية ترتكز على المعايير التطبيقية والمساءلة.',
  },
] as const;

const IMPACT_DOMAINS = [
  {
    code: '01',
    title: 'الطب البيطري والتشخيص الميداني',
    subtitle: 'من الوقاية والأمان الحيوي إلى دقة القرار العلاجي',
    body: 'بناء الانضباط التطبيقي في رصد العلامات المبكرة، وتصميم برامج التحصين والوقاية الحيوية بما يحمي استقرار القطيع.',
    image: '/images/homepage/domain-veterinary.webp',
    alt: 'معدات مخبرية دقيقة ودوارق زجاجية معقمة داخل مختبر تشخيص بيطري',
  },
  {
    code: '02',
    title: 'إنتاج الدواجن والثروة الحيوانية وإدارة المزارع',
    subtitle: 'هندسة بيئة العنبر وكفاءة التشغيل اليومي',
    body: 'ربط علوم الرعاية والتهوية والإدارة الحقلية بمعدلات التحويل والنمو لتحقيق أداء متوازن ومستقر في المنشآت الحديثة.',
    image: '/images/homepage/domain-production.webp',
    alt: 'عنبر زراعي وإنتاجي حديث بتصميم هندسي متناظر وهياكل تهوية دقيقة',
  },
  {
    code: '03',
    title: 'تغذية الحيوان وصياغة العلائق',
    subtitle: 'التوازن بين القيمة الغذائية وتكلفة الطن',
    body: 'قراءة جودة الخامات وضبط التركيبات العلفية على أسس علمية واقتصادية دقيقة تنعكس مباشرة على الأداء الإنتاجي.',
    image: '/images/homepage/domain-nutrition.webp',
    alt: 'مناخل تحليل مخبرية مع خامات وحبيبات الأعلاف ووزن معايرة نحاسي على لوح داكن',
  },
  {
    code: '04',
    title: 'الإدارة التجارية والأجريبيزنس',
    subtitle: 'الربط بين التخصص الفني وواقع السوق والمنشآت',
    body: 'تأهيل الكوادر البيطرية والزراعية لإدارة المبيعات الفنية، وعلاقات المزارع والشركات، وبناء قرار تجاري يستند إلى معرفة تقنية راسخة.',
    image: '/images/homepage/domain-agribusiness.webp',
    alt: 'ملف إداري ومسطرة قياس هندسية معتمة وقلم معدني في تكوين مكتبي قيادي',
  },
] as const;

export function BoslaIntroHome({ intro }: { intro?: HomeIntroContent }) {
  const { user, pushToast } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(1);

  // Contact / Lead form backed by existing POST /api/v1/catalog/leads
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
    const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (osReduced) {
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

  const toggleMotion = () => setMotionPaused((prev) => !prev);

  const activeStage = ELEVATION_STAGES[activeStageIdx] ?? ELEVATION_STAGES[0];
  const whatsappClean = (intro?.whatsapp || '+201001226683').replace(/[^0-9]/g, '') || '201001226683';
  const supportEmail = intro?.email || 'support@boslaagri.com';

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmittedOk(false);
    if (fullName.trim().length < 2) {
      setFormError('يرجى إدخال الاسم الكامل بشكل صحيح.');
      return;
    }
    if (phoneNumber.trim().length < 8) {
      setFormError('يرجى إدخال رقم هاتف للتواصل.');
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
    <HomepageShell motionPaused={motionPaused} onToggleMotion={toggleMotion}>
      {/* =====================================================================
          ACT I · HERO OPENING STAGE (100svh, Vault #050A24)
          Asymmetric architectural composition: RTL editorial headline sits in calm
          studio void on the start side while bespoke hardware studio photography holds
          the end horizon. Instant visible LCP; mobile cleanly stacks visual + copy.
          ===================================================================== */}
      <section className="relative overflow-hidden bg-[#050A24]">
        <div className="mx-auto grid min-h-[calc(100svh-68px)] max-w-7xl grid-cols-1 lg:grid-cols-12 items-center gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          {/* Desktop atmospheric right-fade background frame */}
          <div
            aria-hidden="true"
            className="pointer-events-none hidden lg:block absolute inset-y-0 end-0 w-[64%] overflow-hidden"
          >
            <img
              src="/images/homepage/hero-field-studio.webp"
              alt=""
              fetchPriority="high"
              className="h-full w-full object-cover object-left opacity-95"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(270deg, #050A24 0%, rgba(5,10,36,0.92) 26%, rgba(5,10,36,0.34) 68%, rgba(5,10,36,0.12) 100%)',
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-28"
              style={{
                background: 'linear-gradient(to top, #050A24 0%, transparent 100%)',
              }}
            />
          </div>

          {/* Start Column (Right in RTL): Monumental Rakkas Statement & Primary Actions */}
          <div className="relative z-10 lg:col-span-7 space-y-6 lg:py-8">
            <div className="flex items-center gap-3">
              <span className="inline-block h-[1px] w-8 bg-[#F5B94A]" aria-hidden="true" />
              <p className="text-xs sm:text-sm font-semibold text-[#A9B1E0]">
                {intro?.sloganAr || 'من الطالب إلى المدير'} · أكاديمية بوصلة
              </p>
            </div>

            <h1 className="bosla-display-font text-[clamp(2.5rem,5.4vw,4.9rem)] text-[#EEF0FF] max-w-[14ch] sm:max-w-[16ch]">
              المعرفة حين تصبح أثراً عملياً يُقاس
            </h1>

            <p className="max-w-xl text-base sm:text-lg leading-[1.85] text-[#C2CAF2]">
              بيئة تعليمية وتطبيقية متخصصة في الطب البيطري والإنتاج الحيواني والداجني والأجريبيزنس، تصحبك من مقاعد الدراسة النظرية إلى انضباط التشغيل والقيادة الواثقة في المزارع والشركات.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!user ? (
                <Link
                  href="/register"
                  className="group inline-flex min-h-[48px] items-center gap-2.5 rounded-xl bg-[#7C95FF] px-6 text-sm sm:text-base font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                >
                  <span>إنشاء حساب</span>
                  <ArrowLeft className="bosla-home-arrow h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="group inline-flex min-h-[48px] items-center gap-2.5 rounded-xl bg-[#7C95FF] px-6 text-sm sm:text-base font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                >
                  <span>الدخول إلى حسابك</span>
                  <ArrowLeft className="bosla-home-arrow h-4 w-4" />
                </Link>
              )}

              <a
                href="#about-bosla"
                className="group inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#8CA2FF]/30 bg-[#0B1440]/85 px-5 text-sm sm:text-base font-semibold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:bg-[#0F1A4A]"
              >
                <span>تعرّف على بوصلة</span>
                <ArrowDownLeft className="h-4 w-4 text-[#8CA2FF]" />
              </a>
            </div>
          </div>

          {/* Dedicated Mobile / Tablet Photography Frame (360–1023px) */}
          <div className="relative z-10 lg:hidden overflow-hidden rounded-2xl border border-[#8CA2FF]/20 bg-[#070D2B]">
            <img
              src="/images/homepage/hero-field-studio.webp"
              alt="مجهر مخبري وأدوات قياس نحاسية على لوح حجري داكن داخل استوديو أكاديمية بوصلة"
              fetchPriority="high"
              className="aspect-[16/10] w-full object-cover object-left"
            />
          </div>
        </div>
      </section>

      {/* =====================================================================
          ACT II · ABOUT BOSLA & INTERACTIVE STAGE LENS
          (Daylight Architectural Polarity #F4F6FC, Ink #070D2B)
          ===================================================================== */}
      <section
        id="about-bosla"
        className="bosla-home-light border-y border-[#070D2B]/10 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-bold tracking-wide text-[#4A67F0]">
                لماذا أُسِّست أكاديمية بوصلة؟
              </p>
              <h2 className="bosla-display-font text-[clamp(2rem,3.9vw,3.45rem)] text-[#070D2B] max-w-[18ch]">
                الفجوة بين قاعة الدرس وقرار المزرعة لا تُسدّ بالحفظ
              </h2>
              <p className="max-w-2xl text-base sm:text-lg leading-[1.85] text-[#2B3770]">
                في قطاع الثروة الحيوانية والداجنة والطب البيطري، يكسب الميدان من يقرأ المؤشرات التشغيلية بدقة ويفهم اقتصاديات القرار قبل تنفيذه. صُمّمت بوصلة لتكون الجسر التطبيقي بين التأسيس الجامعي ومتطلبات العمل القيادي الفعلي.
              </p>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#070D2B]/12 bg-white/80 p-6 shadow-[0_12px_36px_-18px_rgba(7,13,43,0.18)]">
              <BoslaAscentDiagram activeStep={activeStageIdx} />
              <div className="mt-4 flex items-center justify-between border-t border-[#070D2B]/10 pt-3 text-xs font-semibold text-[#2B3770]">
                <span>تسلسل البناء التطبيقي داخل بوصلة</span>
                <span className="text-[#070D2B]">{activeStage.tag}</span>
              </div>
            </div>
          </div>

          {/* Interactive Transformation Stage Lens */}
          <div className="rounded-3xl border border-[#070D2B]/12 bg-white p-6 sm:p-8 lg:p-10 shadow-[0_18px_48px_-22px_rgba(7,13,43,0.16)] space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#070D2B]/10 pb-5">
              <div>
                <p className="text-xs font-bold text-[#4A67F0]">عدسة التحوّل المهني</p>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-[#070D2B]">
                  اختر موقعك الحالي لتتضح معادلة التطوير
                </h3>
              </div>

              <div
                role="tablist"
                aria-label="مراحل التحول في بوصلة"
                className="flex flex-wrap gap-2"
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
                      className={`min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#070D2B] text-[#EEF0FF]'
                          : 'border border-[#070D2B]/15 bg-[#F4F6FC] text-[#2B3770] hover:border-[#070D2B]/40 hover:text-[#070D2B]'
                      }`}
                    >
                      {stage.tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-6 space-y-3">
                <h4 className="bosla-display-font text-2xl sm:text-3xl text-[#070D2B]">
                  {activeStage.title}
                </h4>
                <p className="text-sm sm:text-base leading-[1.85] text-[#2B3770]">
                  {activeStage.summary}
                </p>
              </div>

              <div className="lg:col-span-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#070D2B]/12 bg-[#F4F6FC] p-5 space-y-2">
                  <p className="text-xs font-bold text-[#2B3770]">التحدي المعتاد قبل بوصلة</p>
                  <p className="text-sm font-semibold leading-[1.7] text-[#070D2B]">
                    {activeStage.shiftFrom}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#4A67F0]/25 bg-[#070D2B] p-5 space-y-2 text-[#EEF0FF]">
                  <p className="text-xs font-bold text-[#F5B94A]">الأثر العملي المستهدف</p>
                  <p className="text-sm font-semibold leading-[1.7] text-[#EEF0FF]">
                    {activeStage.shiftTo}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ACT III · PHILOSOPHY & 3D ARCHITECTURAL MONOLITH STAGE
          (#philosophy, Vault #070D2B, dedicated procedural Three.js monolith alcove)
          ===================================================================== */}
      <section id="philosophy" className="relative bg-[#070D2B] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 items-center">
          {/* Interactive Architectural Monolith Showcase (WebGL on desktop when active + crisp hairline static poster fallback) */}
          <div className="lg:col-span-5">
            <div className="relative flex min-h-[340px] sm:min-h-[440px] items-center justify-center overflow-hidden rounded-3xl border border-[#8CA2FF]/20 bg-[#050A24]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 42%, rgba(74, 103, 240, 0.22) 0%, rgba(5, 10, 36, 0.96) 72%)',
                }}
              />
              {/* Always-rendered crisp SVG monolith wireframe base (fallback when WebGL paused/off/compact) */}
              <BoslaMonolithHairline className="relative z-10 h-60 w-auto text-[#8CA2FF]" />

              {/* Progressive enhanced Three.js architectural sculpture */}
              <BoslaMonolithCanvas motionPaused={motionPaused} />

              <div className="absolute inset-x-5 bottom-4 z-20 flex items-center justify-between border-t border-[#8CA2FF]/15 pt-3 text-xs text-[#A9B1E0]">
                <span>هيكل الارتقاء التطبيقي</span>
                <span className="text-[#F5B94A] font-semibold">٠١ ← ٠٢ ← ٠٣</span>
              </div>
            </div>
          </div>

          {/* Three Structural Pillars Copy */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-bold text-[#8CA2FF]">منهجية العمل والتفكير</p>
              <h2 className="bosla-display-font text-[clamp(2rem,3.8vw,3.3rem)] text-[#EEF0FF] max-w-[17ch]">
                ثلاث طبقات تصنع الكفاءة القيادية في القطاع
              </h2>
              <p className="max-w-2xl text-base leading-[1.85] text-[#C2CAF2]">
                لا تتعامل بوصلة مع العلم بوصفه محتوى منفصلاً عن العائد والتشغيل، بل كمنظومة مترابطة تتدرج من الأساس العلمي وحتى قرار الإدارة.
              </p>
            </div>

            <div className="divide-y divide-[#8CA2FF]/15 border-y border-[#8CA2FF]/15">
              <div className="py-5 flex items-start gap-4">
                <span className="mt-0.5 text-sm font-bold text-[#F5B94A] tabular-nums">٠١</span>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF]">
                    تصفية المعرفة وفق احتياج السوق الفعلي
                  </h3>
                  <p className="text-sm leading-[1.75] text-[#A9B1E0]">
                    التركيز على المفاهيم والإجراءات التي تفرضها طبيعة العمل في العنبر والمختبر والشركة، دون حشو أكاديمي معزول.
                  </p>
                </div>
              </div>
              <div className="py-5 flex items-start gap-4">
                <span className="mt-0.5 text-sm font-bold text-[#F5B94A] tabular-nums">٠٢</span>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF]">
                    ربط المؤشر الفني بالتكلفة والعائد
                  </h3>
                  <p className="text-sm leading-[1.75] text-[#A9B1E0]">
                    تنمية القدرة على ترجمة التشخيص البيطري وجودة العلف والإدارة اليومية إلى أرقام تشغيلية واضحة أمام صاحب القرار.
                  </p>
                </div>
              </div>
              <div className="py-5 flex items-start gap-4">
                <span className="mt-0.5 text-sm font-bold text-[#F5B94A] tabular-nums">٠٣</span>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#EEF0FF]">
                    الاعتماد المؤسسي وبيئة الأعضاء المغلقة
                  </h3>
                  <p className="text-sm leading-[1.75] text-[#A9B1E0]">
                    تظل المواد التطبيقية والمجتمعات التخصصية محصورة داخل البوابة التعليمية للأعضاء بعد التسجيل والالتحاق الرسمي.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ACT IV · FIELDS OF IMPACT (4 Bespoke Art-Directed Editorial Plates)
          Strict Sector Focus — ZERO courses, ZERO diplomas, ZERO catalog teasers
          ===================================================================== */}
      <section id="fields" className="bg-[#050A24] py-16 sm:py-24 border-t border-[#8CA2FF]/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-bold text-[#F5B94A]">مجالات الأثر والاختصاص</p>
              <h2 className="bosla-display-font text-[clamp(2rem,3.9vw,3.35rem)] text-[#EEF0FF]">
                أربعة ميادين تشكّل العمود الفقري للصناعة
              </h2>
            </div>
            <p className="max-w-md text-sm leading-[1.8] text-[#A9B1E0]">
              تغطي رسالة بوصلة الحلقات المتصلة في منظومة الثروة الحيوانية والداجنة، من الصحة والوقاية حتى التجارة والإدارة.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {IMPACT_DOMAINS.map((domain, i) => (
              <article
                key={domain.code}
                className={`group flex flex-col overflow-hidden rounded-2xl border border-[#8CA2FF]/18 bg-[#0B1440]/85 transition-colors hover:border-[#8CA2FF]/45 ${
                  i % 2 === 1 ? 'lg:mt-8' : ''
                }`}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#070D2B]">
                  <img
                    src={domain.image}
                    alt={domain.alt}
                    loading="lazy"
                    className="bosla-card-media h-full w-full object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#070D2B] via-[#070D2B]/25 to-transparent"
                  />
                  <span className="absolute top-3.5 start-3.5 rounded-md border border-[#8CA2FF]/35 bg-[#050A24]/85 px-2.5 py-1 text-xs font-bold text-[#F5B94A] tabular-nums">
                    {domain.code}
                  </span>
                </div>

                <div className="flex-1 p-5 space-y-2.5">
                  <p className="text-xs font-semibold text-[#8CA2FF]">{domain.subtitle}</p>
                  <h3 className="text-lg font-bold leading-snug text-[#EEF0FF]">
                    {domain.title}
                  </h3>
                  <p className="text-sm leading-[1.75] text-[#A9B1E0]">{domain.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          ACT V · ACCOUNT ACCESS GATE & CONTACT CONCIERGE (#contact)
          ===================================================================== */}
      <section
        id="contact"
        className="bosla-home-light border-t border-[#070D2B]/12 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-12 items-start">
          {/* Contact Information & Direct Access Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#4A67F0]">التواصل والانضمام</p>
              <h2 className="bosla-display-font text-[clamp(2rem,3.6vw,3.1rem)] text-[#070D2B]">
                تواصل مع فريق بوصلة مباشرة
              </h2>
              <p className="text-sm sm:text-base leading-[1.85] text-[#2B3770]">
                للاستفسارات الفردية، أو لترتيب برامج التأهيل المؤسسي لفرق الشركات والمزارع ومصانع الأعلاف، يسعد فريقنا بالتواصل المباشر معك.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[#070D2B]/12 bg-white p-5">
              <a
                href={`https://wa.me/${whatsappClean}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[48px] items-center justify-between rounded-xl border border-[#070D2B]/10 bg-[#F4F6FC] px-4 py-3 text-sm font-bold text-[#070D2B] transition-colors hover:border-[#4A67F0]"
              >
                <span className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 text-[#0C7A52]" />
                  <span>التواصل الفوري عبر واتساب</span>
                </span>
                <span dir="ltr" className="text-xs font-semibold text-[#2B3770]">
                  +{whatsappClean}
                </span>
              </a>

              <a
                href={`mailto:${supportEmail}`}
                className="flex min-h-[48px] items-center justify-between rounded-xl border border-[#070D2B]/10 bg-[#F4F6FC] px-4 py-3 text-sm font-bold text-[#070D2B] transition-colors hover:border-[#4A67F0]"
              >
                <span className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[#4A67F0]" />
                  <span>البريد الرسمي</span>
                </span>
                <span dir="ltr" className="text-xs font-semibold text-[#2B3770]">
                  {supportEmail}
                </span>
              </a>

              <div className="flex items-center gap-2.5 px-2 pt-1 text-xs font-semibold text-[#2B3770]">
                <MapPin className="h-4 w-4 text-[#4A67F0] shrink-0" />
                <span>القاهرة، جمهورية مصر العربية</span>
              </div>
            </div>

            {!user && (
              <div className="rounded-2xl border border-[#070D2B]/15 bg-[#070D2B] p-6 text-[#EEF0FF] space-y-4">
                <p className="text-base font-bold">هل لديك حساب عضو في الأكاديمية؟</p>
                <p className="text-xs sm:text-sm leading-relaxed text-[#A9B1E0]">
                  ادخل إلى حسابك أو أنشئ حساباً جديداً للانتقال لاحقاً إلى بوابة الأعضاء المغلقة.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    href="/login"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#7C95FF] px-5 text-sm font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                  >
                    تسجيل الدخول
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#8CA2FF]/35 px-5 text-sm font-semibold text-[#EEF0FF] transition-colors hover:border-[#8CA2FF]"
                  >
                    إنشاء حساب
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Functional Inquiry Form wired to POST /api/v1/catalog/leads */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleContactSubmit}
              className="rounded-3xl border border-[#070D2B]/14 bg-white p-6 sm:p-8 shadow-[0_18px_48px_-22px_rgba(7,13,43,0.16)] space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#070D2B]/10 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#070D2B]">أرسل استفسارك مباشرة</h3>
                  <p className="text-xs text-[#2B3770]">اختر صفة التواصل وأدخل بياناتك للرد عليك</p>
                </div>
                <div className="flex rounded-xl border border-[#070D2B]/15 bg-[#F4F6FC] p-1">
                  <button
                    type="button"
                    onClick={() => setLeadType('INDIVIDUAL')}
                    className={`min-h-[38px] rounded-lg px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                      leadType === 'INDIVIDUAL'
                        ? 'bg-[#070D2B] text-[#EEF0FF]'
                        : 'text-[#2B3770] hover:text-[#070D2B]'
                    }`}
                  >
                    تواصل فردي
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadType('CORPORATE_B2B')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                      leadType === 'CORPORATE_B2B'
                        ? 'bg-[#070D2B] text-[#EEF0FF]'
                        : 'text-[#2B3770] hover:text-[#070D2B]'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    شركة / مؤسسة
                  </button>
                </div>
              </div>

              {formError && (
                <div role="alert" className="rounded-xl border border-[#9E1C36]/30 bg-[#FFF1F3] px-4 py-3 text-sm font-semibold text-[#8A142B]">
                  {formError}
                </div>
              )}

              {submittedOk && (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-[#0C7A52]/30 bg-[#EDFAF4] px-4 py-3 text-sm font-semibold text-[#0B6342]">
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
                    className="w-full min-h-[46px] rounded-xl border border-[#070D2B]/20 bg-[#F9FAFD] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
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
                    className="w-full min-h-[46px] rounded-xl border border-[#070D2B]/20 bg-[#F9FAFD] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
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
                    className="w-full min-h-[46px] rounded-xl border border-[#070D2B]/20 bg-[#F9FAFD] px-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
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
                  className="w-full min-h-[112px] rounded-xl border border-[#070D2B]/20 bg-[#F9FAFD] p-3.5 text-sm text-[#070D2B] placeholder:text-[#5B6696] focus:border-[#4A67F0] focus:outline-none focus:ring-2 focus:ring-[#4A67F0]/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-[#070D2B] px-7 text-sm font-bold text-[#EEF0FF] transition-colors hover:bg-[#111C59] disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-4 w-4 text-[#7C95FF]" />
                <span>{submitting ? 'جاري إرسال الرسالة...' : 'إرسال الرسالة الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </HomepageShell>
  );
}
