'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { formatEgp, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface HomepagePricingPlanItem {
  id: string;
  code: string;
  nameAr: string;
  descriptionAr?: string | null;
  interval: 'MONTHLY' | 'ANNUAL' | string;
  priceCents: number;
  currency: string;
  features?: string[];
  isFeatured?: boolean;
  badgeLabelAr?: string | null;
  coursesCount?: number;
  pathsCount?: number;
  diplomasCount?: number;
  autoRenewSupported?: boolean;
}

export function BoslaPricingSection({
  plans,
  titleAr = 'الباقات والأسعار',
  subtitleAr = 'اختر خطة العضوية المناسبة لمسارك المهني مع وصول فوري للكورسات والشهادات المعتمدة',
  onSelectSectionInEditor,
}: {
  plans: HomepagePricingPlanItem[];
  titleAr?: string;
  subtitleAr?: string;
  onSelectSectionInEditor?: () => void;
}) {
  const { user } = useAuth();
  const [intervalFilter, setIntervalFilter] = useState<'ALL' | 'MONTHLY' | 'ANNUAL'>('ALL');

  const hasMonthly = useMemo(
    () => plans.some((p) => p.interval === 'MONTHLY'),
    [plans],
  );
  const hasAnnual = useMemo(
    () => plans.some((p) => p.interval === 'ANNUAL'),
    [plans],
  );
  const hasBothIntervals = hasMonthly && hasAnnual;

  const visiblePlans = useMemo(() => {
    if (!hasBothIntervals || intervalFilter === 'ALL') return plans;
    return plans.filter((p) => p.interval === intervalFilter);
  }, [hasBothIntervals, intervalFilter, plans]);

  if (!plans || plans.length === 0) {
    return null;
  }

  return (
    <section
      id="pricing"
      data-testid="homepage-pricing-section"
      onClick={onSelectSectionInEditor}
      className="relative overflow-hidden border-t border-[#8CA2FF]/20 bg-[#070D2B] py-16 sm:py-20 text-[#EEF0FF]"
    >
      {/* Subtle geometric compass circle watermark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        className="pointer-events-none absolute -top-40 end-[-120px] h-[540px] w-[540px] opacity-20"
        fill="none"
      >
        <circle cx="400" cy="400" r="320" stroke="#8CA2FF" strokeWidth="1.5" strokeDasharray="8 12" />
        <circle cx="400" cy="400" r="220" stroke="#4A1FB0" strokeWidth="1.2" />
      </svg>

      <div className="relative z-10 mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-3.5">
          <p className="text-xs font-extrabold text-[#A5B4FC]">عضويات أكاديمية بوصلة</p>

          <h2 className="text-[clamp(1.8rem,3.1vw,2.65rem)] font-black leading-[1.26] text-[#EEF0FF] bosla-display-font">
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed font-medium text-[#B8C3F2]">
            {subtitleAr}
          </p>

          {hasBothIntervals && (
            <div
              data-testid="homepage-pricing-interval-switcher"
              className="inline-flex items-center rounded-2xl border border-[#8CA2FF]/28 bg-[#0B1440] p-1.5 mt-2 shadow-sm"
              role="tablist"
              aria-label="تصفية الباقات حسب مدة الاشتراك"
            >
              <button
                type="button"
                role="tab"
                aria-selected={intervalFilter === 'ALL'}
                data-testid="pricing-filter-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setIntervalFilter('ALL');
                }}
                className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                  intervalFilter === 'ALL'
                    ? 'bg-[#4A1FB0] text-white border border-[#A78BFA]/45'
                    : 'text-[#B8C3F2] hover:bg-[#18266E] hover:text-white'
                }`}
              >
                جميع الباقات
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intervalFilter === 'MONTHLY'}
                data-testid="pricing-filter-monthly"
                onClick={(e) => {
                  e.stopPropagation();
                  setIntervalFilter('MONTHLY');
                }}
                className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                  intervalFilter === 'MONTHLY'
                    ? 'bg-[#4A1FB0] text-white border border-[#A78BFA]/45'
                    : 'text-[#B8C3F2] hover:bg-[#18266E] hover:text-white'
                }`}
              >
                اشتراك شهري
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intervalFilter === 'ANNUAL'}
                data-testid="pricing-filter-annual"
                onClick={(e) => {
                  e.stopPropagation();
                  setIntervalFilter('ANNUAL');
                }}
                className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                  intervalFilter === 'ANNUAL'
                    ? 'bg-[#4A1FB0] text-white border border-[#A78BFA]/45'
                    : 'text-[#B8C3F2] hover:bg-[#18266E] hover:text-white'
                }`}
              >
                اشتراك سنوي
              </button>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div
          className={`mt-10 grid gap-6 ${
            visiblePlans.length === 1
              ? 'max-w-lg mx-auto'
              : visiblePlans.length === 2
              ? 'md:grid-cols-2 max-w-4xl mx-auto'
              : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {visiblePlans.map((plan) => {
            const isFeatured = Boolean(plan.isFeatured);
            const intervalLabel = plan.interval === 'ANNUAL' ? 'سنوياً' : 'شهرياً';
            const targetPricingPath = `/pricing?plan=${encodeURIComponent(plan.id)}`;
            const ctaHref = user
              ? targetPricingPath
              : `/login?next=${encodeURIComponent(targetPricingPath)}`;

            const builtFeatures: string[] = [];
            if ((plan.coursesCount ?? 0) > 0 || (plan.pathsCount ?? 0) > 0) {
              builtFeatures.push(
                `تفتح ${formatNumber(plan.coursesCount ?? 0)} كورس تطبيقي${
                  (plan.pathsCount ?? 0) > 0
                    ? ` و${formatNumber(plan.pathsCount ?? 0)} مسار تخصصي`
                    : ''
                }${
                  (plan.diplomasCount ?? 0) > 0
                    ? ` و${formatNumber(plan.diplomasCount ?? 0)} دبلومة`
                    : ''
                }`,
              );
            } else {
              builtFeatures.push('وصول كامل لجميع الكورسات والمسارات المشمولة بالباقة');
            }
            if (Array.isArray(plan.features) && plan.features.length > 0) {
              for (const f of plan.features) {
                if (typeof f === 'string' && f.trim()) {
                  builtFeatures.push(f.trim());
                }
              }
            } else {
              builtFeatures.push(
                'تحميل المرفقات والملفات التشغيلية والشهادات المعتمدة برمز تحقق QR',
                'وصول لمجتمع المشتركين والأسئلة المباشرة مع المدربين',
              );
            }

            return (
              <div
                key={plan.id}
                data-testid={`homepage-pricing-plan-${plan.id}`}
                data-featured={isFeatured ? 'true' : 'false'}
                className={`relative flex flex-col justify-between rounded-3xl p-7 transition-all duration-200 ${
                  isFeatured
                    ? 'border-2 border-[#7C95FF] bg-[#121F5B] shadow-[0_26px_54px_-24px_rgba(74,31,176,0.55)]'
                    : 'border border-[#8CA2FF]/26 bg-[#0F1A4A] hover:border-[#8CA2FF]/65 shadow-[0_14px_32px_-24px_rgba(3,7,28,0.8)]'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#8CA2FF]/30 bg-[#070D2B] px-3 py-1 text-xs font-extrabold text-[#C4B5FD]">
                      {plan.interval === 'ANNUAL' ? 'عضوية سنوية' : 'عضوية شهرية'}
                    </span>

                    {isFeatured && (plan.badgeLabelAr || 'الأفضل قيمة') && (
                      <span
                        data-testid={`homepage-pricing-featured-badge-${plan.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-[#A78BFA]/45 bg-[#4A1FB0] px-3 py-1 text-xs font-extrabold text-white"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {plan.badgeLabelAr || 'الأفضل قيمة'}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-[#EEF0FF] bosla-display-font">
                      {plan.nameAr}
                    </h3>
                    {plan.descriptionAr && (
                      <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#B8C3F2] leading-relaxed">
                        {plan.descriptionAr}
                      </p>
                    )}
                  </div>

                  {/* Crisp High-Contrast Price Zone */}
                  <div className="rounded-2xl border border-[#8CA2FF]/26 bg-[#070D2B] p-4 shadow-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-[#FFFFFF] tabular-nums">
                        {formatEgp(plan.priceCents)}
                      </span>
                      <span className="text-xs font-extrabold text-[#A5B4FC]">
                        / {intervalLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-[#B8C3F2]">
                      {plan.autoRenewSupported
                        ? 'يدعم التجديد التلقائي الاختياري'
                        : 'اشتراك محدد المدة بدون سحب أو تجديد تلقائي'}
                    </p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-[#EEF0FF]">
                    {builtFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-4 border-t border-[#8CA2FF]/16 space-y-2.5">
                  <Link
                    href={ctaHref}
                    data-testid={`homepage-pricing-cta-${plan.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition-colors ${
                      isFeatured
                        ? 'border border-[#A78BFA]/45 bg-[#4A1FB0] text-white hover:bg-[#5E2CD6]'
                        : 'border border-[#8CA2FF]/45 bg-[#18266E] text-white hover:bg-[#4A1FB0]'
                    }`}
                  >
                    <span>اشترك في الباقة الآن</span>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#B8C3F2]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#77E2B5]" aria-hidden="true" />
                    <span>تفعيل فوري بعد السداد الآمن عبر Paymob</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
