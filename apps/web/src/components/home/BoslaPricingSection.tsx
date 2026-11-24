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

  // Section 7 rule: If no published plans exist, hide the section automatically
  if (!plans || plans.length === 0) {
    return null;
  }

  return (
    <section
      id="pricing"
      data-testid="homepage-pricing-section"
      onClick={onSelectSectionInEditor}
      className="relative overflow-hidden border-t border-[#8CA2FF]/15 bg-[#060B23] py-20 sm:py-24 text-[#EEF0FF]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-25"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#C084FC]/35 bg-[#7C3AED]/15 px-4 py-1.5 text-xs font-extrabold text-[#D8B4FE]">
            <Sparkles className="h-3.5 w-3.5" />
            عضويات أكاديمية بوصلة
          </span>

          <h2 className="text-3xl font-extrabold tracking-tight text-[#EEF0FF] sm:text-4xl">
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-[#A9B1E0]">
            {subtitleAr}
          </p>

          {/* Monthly / Annual Interval Switcher when both exist */}
          {hasBothIntervals && (
            <div
              data-testid="homepage-pricing-interval-switcher"
              className="inline-flex items-center rounded-2xl border border-[#8CA2FF]/25 bg-[#0B1440]/90 p-1.5 mt-2"
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
                className={`rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors ${
                  intervalFilter === 'ALL'
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'text-[#A9B1E0] hover:text-white'
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
                className={`rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors ${
                  intervalFilter === 'MONTHLY'
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'text-[#A9B1E0] hover:text-white'
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
                className={`rounded-xl px-4 py-1.5 text-xs font-extrabold transition-colors ${
                  intervalFilter === 'ANNUAL'
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'text-[#A9B1E0] hover:text-white'
                }`}
              >
                اشتراك سنوي
              </button>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div
          className={`mt-12 grid gap-6 ${
            visiblePlans.length === 1
              ? 'max-w-lg mx-auto'
              : visiblePlans.length === 2
              ? 'md:grid-cols-2 max-w-4xl mx-auto'
              : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {visiblePlans.map((plan) => {
            const isFeatured = Boolean(plan.isFeatured);
            const intervalLabel =
              plan.interval === 'ANNUAL' ? 'سنوياً' : 'شهرياً';
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
                    ? 'border-2 border-[#C084FC]/70 bg-gradient-to-b from-[#1A1654] to-[#0D153D] shadow-[0_0_40px_-12px_rgba(168,85,247,0.35)]'
                    : 'border border-[#8CA2FF]/22 bg-[#0B1440]/90 hover:border-[#8CA2FF]/40'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#8CA2FF]/30 bg-[#18266E]/60 px-3 py-1 text-xs font-extrabold text-[#C4D0FF]">
                      {plan.interval === 'ANNUAL' ? 'عضوية سنوية' : 'عضوية شهرية'}
                    </span>

                    {isFeatured && plan.badgeLabelAr && (
                      <span
                        data-testid={`homepage-pricing-featured-badge-${plan.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED] px-3 py-1 text-xs font-extrabold text-white"
                      >
                        <Sparkles className="h-3 w-3" />
                        {plan.badgeLabelAr}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-white">
                      {plan.nameAr}
                    </h3>
                    {plan.descriptionAr && (
                      <p className="mt-1.5 text-xs sm:text-sm text-[#A9B1E0] leading-relaxed">
                        {plan.descriptionAr}
                      </p>
                    )}
                  </div>

                  {/* Price Block */}
                  <div className="rounded-2xl border border-[#8CA2FF]/18 bg-[#070D2B]/75 p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white tabular-nums">
                        {formatEgp(plan.priceCents)}
                      </span>
                      <span className="text-xs font-bold text-[#A9B1E0]">
                        / {intervalLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[#8CA2FF]">
                      {plan.autoRenewSupported
                        ? 'يدعم التجديد التلقائي الاختياري'
                        : 'اشتراك محدد المدة بدون سحب أو تجديد تلقائي'}
                    </p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2.5 text-xs sm:text-sm text-[#E2E8F0]">
                    {builtFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-4 border-t border-[#8CA2FF]/15 space-y-2.5">
                  <Link
                    href={ctaHref}
                    data-testid={`homepage-pricing-cta-${plan.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-extrabold transition-colors ${
                      isFeatured
                        ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                        : 'bg-[#27389A] text-white hover:bg-[#3145B8]'
                    }`}
                  >
                    <span>اشترك في الباقة الآن</span>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#A9B1E0]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#77E2B5]" />
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
