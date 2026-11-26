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
      style={{
        backgroundColor: 'var(--bosla-color-blue-primary)',
        backgroundImage: 'var(--bosla-band-pricing)',
      }}
      className="relative overflow-hidden py-16 sm:py-20 text-[var(--bosla-color-ink)]"
    >
      {/* Subtle geometric compass circle watermark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        className="pointer-events-none absolute -top-40 end-[-120px] h-[540px] w-[540px] opacity-25"
        fill="none"
      >
        <circle cx="400" cy="400" r="320" stroke="#4A1FB0" strokeWidth="1.5" strokeDasharray="8 12" />
        <circle cx="400" cy="400" r="220" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>

      <div className="relative z-10 mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-3.5">
          <p className="text-xs font-extrabold text-[var(--bosla-color-purple-royal)]">عضويات أكاديمية بوصلة</p>

          <h2 className="text-[clamp(1.8rem,3.1vw,2.65rem)] font-black leading-[1.26] text-[var(--bosla-color-ink)] bosla-display-font">
            {titleAr}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed font-medium text-[var(--bosla-color-ink-muted)]">
            {subtitleAr}
          </p>

          {hasBothIntervals && (
            <div
              data-testid="homepage-pricing-interval-switcher"
              className="inline-flex items-center rounded-2xl border border-[var(--bosla-home-border)] bg-[var(--bosla-color-white)]/92 p-1.5 mt-2 shadow-sm"
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
                    ? 'bg-[var(--bosla-color-purple-royal)] text-[var(--bosla-color-white)]'
                    : 'text-[var(--bosla-color-ink)] hover:bg-[var(--bosla-color-blue-light)]'
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
                    ? 'bg-[var(--bosla-color-purple-royal)] text-[var(--bosla-color-white)]'
                    : 'text-[var(--bosla-color-ink)] hover:bg-[var(--bosla-color-blue-light)]'
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
                    ? 'bg-[var(--bosla-color-purple-royal)] text-[var(--bosla-color-white)]'
                    : 'text-[var(--bosla-color-ink)] hover:bg-[var(--bosla-color-blue-light)]'
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
                    ? 'border-2 border-[var(--bosla-color-purple-royal)] bg-[image:var(--bosla-gradient-purple)] text-[var(--bosla-color-white)] shadow-[0_26px_54px_-20px_rgba(74,31,176,0.45)]'
                    : 'border border-[var(--bosla-home-border)] bg-[var(--bosla-color-white)] text-[var(--bosla-color-ink)] hover:border-[var(--bosla-color-purple-royal)] shadow-[0_14px_32px_-24px_rgba(23,36,61,0.2)]'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold ${
                        isFeatured
                          ? 'border border-white/25 bg-white/15 text-[var(--bosla-color-white)]'
                          : 'border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)] text-[var(--bosla-color-ink)]'
                      }`}
                    >
                      {plan.interval === 'ANNUAL' ? 'عضوية سنوية' : 'عضوية شهرية'}
                    </span>

                    {isFeatured && (plan.badgeLabelAr || 'الأفضل قيمة') && (
                      <span
                        data-testid={`homepage-pricing-featured-badge-${plan.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--bosla-color-white)] px-3 py-1 text-xs font-extrabold text-[var(--bosla-color-purple-royal)] shadow-sm"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {plan.badgeLabelAr || 'الأفضل قيمة'}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3
                      className={`text-xl font-black bosla-display-font ${
                        isFeatured ? 'text-[var(--bosla-color-white)]' : 'text-[var(--bosla-color-ink)]'
                      }`}
                    >
                      {plan.nameAr}
                    </h3>
                    {plan.descriptionAr && (
                      <p
                        className={`mt-1.5 text-xs sm:text-sm font-medium leading-relaxed ${
                          isFeatured ? 'text-[var(--bosla-color-blue-light)]' : 'text-[var(--bosla-color-ink-muted)]'
                        }`}
                      >
                        {plan.descriptionAr}
                      </p>
                    )}
                  </div>

                  {/* Crisp High-Contrast Price Block */}
                  <div
                    className={`rounded-2xl p-4 shadow-sm ${
                      isFeatured
                        ? 'bg-[var(--bosla-color-white)] text-[var(--bosla-color-ink)]'
                        : 'border border-[var(--bosla-home-border)] bg-[var(--bosla-color-blue-light)]/65'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-[var(--bosla-color-purple-royal)] tabular-nums">
                        {formatEgp(plan.priceCents)}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--bosla-color-ink-muted)]">
                        / {intervalLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-[var(--bosla-color-ink-muted)]">
                      {plan.autoRenewSupported
                        ? 'يدعم التجديد التلقائي الاختياري'
                        : 'اشتراك محدد المدة بدون سحب أو تجديد تلقائي'}
                    </p>
                  </div>

                  {/* Features List */}
                  <ul
                    className={`space-y-2.5 text-xs sm:text-sm font-semibold ${
                      isFeatured ? 'text-[var(--bosla-color-white)]' : 'text-[var(--bosla-color-ink)]'
                    }`}
                  >
                    {builtFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            isFeatured ? 'text-[var(--bosla-color-blue-light)]' : 'text-[var(--bosla-color-purple-royal)]'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={`mt-7 pt-4 space-y-2.5 border-t ${
                    isFeatured ? 'border-white/20' : 'border-[var(--bosla-home-divider)]'
                  }`}
                >
                  <Link
                    href={ctaHref}
                    data-testid={`homepage-pricing-cta-${plan.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition-colors shadow-sm ${
                      isFeatured
                        ? 'bg-[var(--bosla-color-white)] text-[var(--bosla-color-purple-royal)] hover:bg-[var(--bosla-color-blue-light)]'
                        : 'bg-[var(--bosla-color-purple-royal)] text-[var(--bosla-color-white)] hover:bg-[var(--bosla-color-purple-support)]'
                    }`}
                  >
                    <span>اشترك في الباقة الآن</span>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <div
                    className={`flex items-center justify-center gap-1.5 text-[11px] font-bold ${
                      isFeatured ? 'text-[var(--bosla-color-blue-light)]' : 'text-[var(--bosla-color-ink-muted)]'
                    }`}
                  >
                    <ShieldCheck
                      className={`h-3.5 w-3.5 ${
                        isFeatured ? 'text-[var(--bosla-color-white)]' : 'text-[var(--bosla-color-success-bg)]'
                      }`}
                      aria-hidden="true"
                    />
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
