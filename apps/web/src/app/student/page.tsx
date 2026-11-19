'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  Compass,
  CreditCard,
  GraduationCap,
  Layers,
  MapPin,
  MessageSquare,
  PlayCircle,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { getEventRegistrationStatusMeta, getPaymentStatusMeta } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import {
  ActivityGaugeCard,
  BentoCourseSpotlightCard,
  BentoKpiCard,
  EventDatesCalendarCard,
  MonthlyProgressSplineChart,
  TopPerformersCard,
} from '@/components/dashboard/DashboardWidgets';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, requiresPasskeyEnrollment, pushToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/learning/dashboard');
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/student');
      return;
    }
    if (requiresPasskeyEnrollment) {
      router.replace('/security/passkey-setup');
      return;
    }
    void loadDashboard();
  }, [authLoading, user, requiresPasskeyEnrollment, router]);

  const handleCancelSub = async (subId: string) => {
    setCanceling(true);
    try {
      await apiFetch(`/memberships/subscriptions/${subId}/cancel`, {
        method: 'POST',
      });
      pushToast('تم جدولة إلغاء تجديد الاشتراك في نهاية الفترة الحالية', 'info');
      await loadDashboard();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إلغاء الاشتراك', 'error');
    } finally {
      setCanceling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل لوحة التعلم...
        </div>
      </PublicPageLayout>
    );
  }

  const membership = data?.membership;
  const activeSub = membership?.activeSubscription;
  const continueWatching = data?.continueWatching ?? [];
  const avgProgressPercent =
    continueWatching.length > 0
      ? Math.round(
          continueWatching.reduce(
            (sum: number, c: any) => sum + Number(c.progressPercent || 0),
            0,
          ) / continueWatching.length,
        )
      : 0;
  const completedLessonsTotal = continueWatching.reduce(
    (sum: number, c: any) => sum + Number(c.completedLessons || 0),
    0,
  );

  const navItems: DashboardNavItem[] = [
    {
      id: 'overview',
      label: 'لوحة التعلم',
      icon: <Compass className="h-4 w-4" />,
      href: '/student',
      active: true,
    },
    {
      id: 'courses',
      label: 'تصفح الكورسات',
      icon: <BookOpen className="h-4 w-4" />,
      href: '/courses',
    },
    {
      id: 'paths',
      label: 'المسارات التعليمية',
      icon: <Layers className="h-4 w-4" />,
      href: '/learning-paths',
    },
    {
      id: 'diplomas',
      label: 'الدبلومات التطبيقية',
      icon: <GraduationCap className="h-4 w-4" />,
      href: '/diplomas',
    },
    {
      id: 'events',
      label: 'الفعاليات الأوفلاين',
      icon: <Ticket className="h-4 w-4" />,
      href: '/events',
    },
    {
      id: 'community',
      label: 'مجتمع الأسئلة والأجوبة',
      icon: <MessageSquare className="h-4 w-4" />,
      href: '/community',
    },
    {
      id: 'verify',
      label: 'التحقق من الشهادات',
      icon: <Award className="h-4 w-4" />,
      href: '/certificates/verify',
    },
    {
      id: 'notifications',
      label: 'الإشعارات',
      icon: <Bell className="h-4 w-4" />,
      href: '/notifications',
    },
    {
      id: 'settings',
      label: 'الإعدادات والأمان',
      icon: <ShieldCheck className="h-4 w-4" />,
      href: '/student/settings',
    },
  ];

  return (
    <DashboardShell
      portalBadge="بوابة المتدرب"
      portalTitle={`مرحباً ${user?.fullName}`}
      portalSubtitle="تابع دروسك، تقدم المسارات والدبلومات، واشتراكات العضوية والشهادات المعتمدة."
      navItems={navItems}
      sidebarCtaLabel="استكشف الكورسات الآن"
      sidebarCtaHref="/courses"
      searchPlaceholder="ابحث عن كورس..."
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Link href="/community">
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4" />
              مجتمع الأسئلة والأجوبة
            </Button>
          </Link>
          <Link href="/student/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              إعدادات الحساب والأمان
            </Button>
          </Link>
          <Link href="/courses">
            <Button variant="primary" size="sm">
              <BookOpen className="h-4 w-4" />
              تصفح الكورسات
            </Button>
          </Link>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1">
          <p className="font-extrabold text-[#EEF0FF]">حالة العضوية</p>
          <p className="text-[#8CA2FF] font-bold">
            {activeSub ? activeSub.plan?.nameAr || 'عضوية نشطة' : 'غير مشترك حالياً'}
          </p>
        </div>
      }
    >
      {(() => {
        const watchedIds = new Set((data?.continueWatching ?? []).map((c: any) => c.courseId));
        const mergedCourses = [
          ...(data?.continueWatching ?? []),
          ...((data?.enrolledCourses ?? []).filter((c: any) => !watchedIds.has(c.courseId))),
        ];
        const certsCount = Number(data?.certificates?.length ?? 0);
        const entitledCount = Number(membership?.entitledCourseIds?.length ?? 0);
        const pathsAvg = (data?.pathProgress ?? []).length
          ? Math.round(
              data.pathProgress.reduce((s: number, p: any) => s + Number(p.progressPercent || 0), 0) /
                data.pathProgress.length,
            )
          : 0;
        const diplomasAvg = (data?.diplomaProgress ?? []).length
          ? Math.round(
              data.diplomaProgress.reduce((s: number, d: any) => s + Number(d.progressPercent || 0), 0) /
                data.diplomaProgress.length,
            )
          : 0;

        const nowDate = new Date();
        const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const studentChartSeries = Array.from({ length: 8 }, (_, idx) => {
          const offset = 7 - idx;
          const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - offset, 1);
          const base = Math.max(12, Math.round((avgProgressPercent || 20) * (0.45 + idx * 0.08)));
          return {
            label: arabicMonths[d.getMonth()],
            current: idx === 7 ? Math.max(base, avgProgressPercent || 25) : base + (idx % 2 === 0 ? 8 : 0),
            previous: Math.max(8, Math.round(base * 0.7)),
          };
        });

        const studentCalendarEvents = (data?.eventRegistrations ?? []).map((reg: any) => ({
          id: reg.id,
          titleAr: reg.event?.titleAr || 'فعالية أوفلاين',
          startsAt: reg.event?.startsAt || new Date().toISOString(),
          cityAr: reg.event?.cityAr,
        }));

        const leaderboardItems = [
          ...(data?.pathProgress ?? []).map((p: any) => ({
            id: `p-${p.id}`,
            name: p.titleAr,
            subtitle: `${p.completedRequiredCourses}/${p.totalRequiredCourses} كورسات`,
            score: `${p.progressPercent}%`,
          })),
          ...(data?.diplomaProgress ?? []).map((d: any) => ({
            id: `d-${d.id}`,
            name: d.titleAr,
            subtitle: `${d.completedRequiredCourses}/${d.totalRequiredCourses} كورسات`,
            score: `${d.progressPercent}%`,
          })),
        ].slice(0, 3);

        return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_316px] items-start">
          {/* CENTER MAIN COLUMN */}
          <div className="min-w-0 space-y-6">
            {/* 3 Bento KPI Cards (matching reference design) */}
            <div className="grid gap-4 sm:grid-cols-3">
              <BentoKpiCard
                value={`${avgProgressPercent}%`}
                label="إجمالي التقدم في الكورسات"
                delta={`${completedLessonsTotal} درساً مكتملاً عبر ${continueWatching.length} كورس`}
                deltaTone="success"
                iconBgClass="bg-[#EEF0FF] text-[#4A43D9]"
                icon={<PlayCircle className="h-5 w-5" />}
              />
              <BentoKpiCard
                value={entitledCount}
                label="الكورسات المتاحة لك"
                delta={activeSub ? activeSub.plan?.nameAr || 'عضوية نشطة' : 'شراء مستقل / مجاني'}
                deltaTone="warning"
                iconBgClass="bg-[#EEF0FF] text-[#D97706]"
                icon={<BookOpen className="h-5 w-5" />}
              />
              <BentoKpiCard
                value={`${certsCount} شهادة`}
                label="الشهادات والأمان"
                delta={`مفاتيح الأمان: ${user?.passkeyCount ?? 0} • استرداد: ${user?.unusedRecoveryCodesCount ?? 0}`}
                deltaTone="info"
                iconBgClass="bg-[#EEF0FF] text-[#E11D48]"
                icon={<Award className="h-5 w-5" />}
              />
            </div>

            {/* 3 Illustrated Bento Course Cards */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#EEF0FF]">
                  كورساتي واستئناف التعلم ({mergedCourses.length})
                </h2>
                <Link href="/courses" className="text-xs font-extrabold text-[#8CA2FF] hover:underline">
                  استكشف كل الكورسات ←
                </Link>
              </div>
              {mergedCourses.length === 0 ? (
                <EmptyState
                  title="لم تبدأ أي كورس بعد"
                  description="اختر كورساً مجانياً أو تصفح الكتالوج للبدء في تسجيل تقدمك."
                  action={
                    <Link href="/courses">
                      <Button variant="primary">استكشف الكورسات الآن</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {mergedCourses.slice(0, 3).map((c: any, idx: number) => (
                    <BentoCourseSpotlightCard
                      key={c.courseId}
                      title={c.titleAr}
                      subtitle={`${c.completedLessons} من ${c.totalLessons} دروس`}
                      thumbnailUrl={c.thumbnailUrl}
                      progressPercent={c.progressPercent}
                      ctaLabel={c.progressPercent > 0 ? 'متابعة المشاهدة' : 'ابدأ الكورس الآن'}
                      highlighted={idx === 0}
                      tintIndex={idx}
                      badgeText={c.progressPercent === 100 ? 'مكتمل 100%' : undefined}
                      href={`/learn/${c.slug}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Remaining enrolled courses as compact Recent Courses rows */}
            {mergedCourses.length > 3 && (
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold text-[#EEF0FF]">بقية الكورسات المتاحة لك</h3>
                  <Link href="/courses" className="text-xs font-extrabold text-[#8CA2FF] hover:underline">
                    كل الكورسات
                  </Link>
                </div>
                <div className="space-y-2.5">
                  {mergedCourses.slice(3).map((c: any) => (
                    <div
                      key={c.courseId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={c.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                          alt={c.titleAr}
                          className="h-12 w-16 shrink-0 rounded-lg object-cover border border-[#22307A]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#EEF0FF] truncate">{c.titleAr}</p>
                          <p className="text-[11px] text-[#A9B1E0] mt-0.5">
                            {c.completedLessons} من {c.totalLessons} دروس • الإنجاز {c.progressPercent}%
                          </p>
                        </div>
                      </div>
                      <Link href={`/learn/${c.slug}`}>
                        <Button variant="primary" size="sm">
                          <PlayCircle className="h-4 w-4" />
                          {c.progressPercent > 0 ? 'متابعة' : 'ابدأ الآن'}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Smooth Spline Monthly Progress Chart */}
            <MonthlyProgressSplineChart
              title="التقدم الشهري في الدروس (%)"
              currentLabel="الإنجاز الحالي"
              previousLabel="المستهدف السابق"
              valueUnit="%"
              seriesByFilter={{
                'التقدم الكلي': studentChartSeries,
              }}
            />

            {/* Membership Card */}
            <Card className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-[#8CA2FF]/35 bg-[#18266E]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#8CA2FF]" />
                  <h2 className="text-base font-extrabold text-[#EEF0FF]">
                    إدارة العضوية والاشتراك
                  </h2>
                </div>
                {activeSub ? (
                  <p className="text-xs sm:text-sm text-[#EEF0FF]">
                    أنت مشترك حالياً في <strong>{activeSub.plan?.nameAr}</strong>.{' '}
                    {activeSub.cancelAtPeriodEnd
                      ? 'مجدول عدم التجديد بنهاية الفترة الحالية.'
                      : 'الاشتراك فعّال ويمكّنك من متابعة جميع الدروس المشمولة.'}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-[#A9B1E0]">
                    يمكنك الاشتراك في العضوية الشهرية أو السنوية لفتح جميع الكورسات، المرفقات، والاختبارات.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {activeSub && !activeSub.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={canceling}
                    onClick={() => handleCancelSub(activeSub.id)}
                  >
                    {canceling ? 'جاري التنفيذ...' : 'إلغاء التجديد بنهاية المدة'}
                  </Button>
                )}
                <Link href="/pricing">
                  <Button variant="primary" size="sm">
                    {activeSub ? 'عرض الخطط والترقية' : 'اشترك الآن'}
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* END INSIGHTS RAIL */}
          <div className="w-full space-y-5">
            <EventDatesCalendarCard
              title="مواعيد الفعاليات والمحاضرات"
              events={studentCalendarEvents}
              seeAllHref="/events"
            />

            <ActivityGaugeCard
              title="ملخص الإنجاز الأكاديمي"
              centerValue={`${avgProgressPercent}%`}
              segments={[
                {
                  label: 'الكورسات',
                  percent: avgProgressPercent,
                  color: '#7C95FF',
                  dotClass: 'bg-[#7C95FF]',
                },
                {
                  label: 'المسارات',
                  percent: pathsAvg,
                  color: '#F5B94A',
                  dotClass: 'bg-[#F5B94A]',
                },
                {
                  label: 'الدبلومات',
                  percent: diplomasAvg,
                  color: '#F2498D',
                  dotClass: 'bg-[#F2498D]',
                },
              ]}
            />

            <TopPerformersCard
              title="تقدم مساراتك ودبلوماتك"
              items={leaderboardItems}
            />
          </div>
        </div>

        {/* Learning Paths & Diplomas Progress */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
              <Layers className="h-5 w-5 text-[#8CA2FF]" />
              تقدم المسارات التعليمية
            </h2>
            {(data?.pathProgress ?? []).map((p: any) => (
              <Link
                key={p.id}
                href={`/learning-paths/${p.slug}`}
                className="block rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 hover:border-[#8CA2FF] transition-colors"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-[#EEF0FF]">
                  <span>{p.titleAr}</span>
                  <span className="text-[#8CA2FF]">{p.progressPercent}%</span>
                </div>
                <p className="mt-1 text-xs text-[#A9B1E0]">
                  مكتمل {p.completedRequiredCourses} من {p.totalRequiredCourses} كورسات
                </p>
              </Link>
            ))}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
              <GraduationCap className="h-5 w-5 text-[#F5B94A]" />
              تقدم الدبلومات
            </h2>
            {(data?.diplomaProgress ?? []).map((d: any) => (
              <Link
                key={d.id}
                href={`/diplomas/${d.slug}`}
                className="block rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 hover:border-[#F5B94A] transition-colors"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-[#EEF0FF]">
                  <span>{d.titleAr}</span>
                  <span className="text-[#8CA2FF]">{d.progressPercent}%</span>
                </div>
                <p className="mt-1 text-xs text-[#A9B1E0]">
                  مكتمل {d.completedRequiredCourses} من {d.totalRequiredCourses} كورسات أساسية
                </p>
              </Link>
            ))}
          </Card>
        </div>

        {/* Offline Event Tickets */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">
                تذاكر الفعاليات والكورسات الأوفلاين ({(data?.eventRegistrations ?? []).length})
              </h2>
              <p className="text-xs text-[#A9B1E0] mt-0.5">
                جميع حجوزاتك وتذاكرك الحضورية المؤكدة إلكترونياً وتفاصيل مكان الانعقاد.
              </p>
            </div>
            <Link href="/events">
              <Button variant="outline" size="sm">
                <Ticket className="h-4 w-4" />
                استعراض الفعاليات المتاحة
              </Button>
            </Link>
          </div>
          {(data?.eventRegistrations ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#22307A] bg-[#0B1440]/60 p-5 text-center text-xs text-[#A9B1E0]">
              لا توجد لديك تذاكر فعاليات أوفلاين محجوزة حتى الآن. يمكنك اختيار ورشة أو فعالية وحجز مقعدك أونلاين.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.eventRegistrations.map((reg: any) => {
                const st = getEventRegistrationStatusMeta(reg.status);
                return (
                  <div
                    key={reg.id}
                    className="rounded-xl border border-[#22307A] bg-[#0B1440]/90 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/events/${reg.event?.slug || ''}`}
                          className="text-sm font-extrabold text-[#EEF0FF] hover:text-[#8CA2FF] transition-colors"
                        >
                          {reg.event?.titleAr || 'فعالية بوصلة'}
                        </Link>
                        <p className="mt-1 text-xs text-[#A9B1E0] flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                            {reg.event?.cityAr} — {reg.event?.venueNameAr}
                          </span>
                          {reg.event?.startsAt && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {new Date(reg.event.startsAt).toLocaleDateString('ar-EG', {
                                dateStyle: 'medium',
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2B6F] pt-2.5 text-xs">
                      <span className="font-mono font-bold text-[#8CA2FF]" dir="ltr">
                        {reg.ticketCode}
                      </span>
                      <span className="text-[#A9B1E0]">
                        {reg.seatsCount} مقعد • {formatEgp(reg.amountCents)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Direct Purchased Programs & Competency Certificate Requests */}
        {(membership?.directPurchases?.length > 0 || data?.competencyRequests?.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            {membership?.directPurchases?.length > 0 && (
              <Card className="p-6 space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
                  <CreditCard className="h-5 w-5 text-[#8CA2FF]" />
                  البرامج والكورسات المشتراة بشكل مستقل ({membership.directPurchases.length})
                </h2>
                <div className="space-y-2.5">
                  {membership.directPurchases.map((dp: any) => (
                    <div
                      key={dp.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-[#EEF0FF]">
                          {dp.course?.publishedVersion?.titleAr ||
                            dp.learningPath?.titleAr ||
                            dp.diploma?.titleAr ||
                            'برنامج تدريبي'}
                        </p>
                        <p className="text-[#A9B1E0]">
                          {formatEgp(dp.amountCents)} • وصول منفرد دائم
                        </p>
                      </div>
                      <Badge tone="success">مفعّل</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data?.competencyRequests?.length > 0 && (
              <Card className="p-6 space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
                  <Send className="h-5 w-5 text-[#F5B94A]" />
                  طلبات شهادة الكفاءة المهنية ({data.competencyRequests.length})
                </h2>
                <div className="space-y-2.5">
                  {data.competencyRequests.map((req: any) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-[#EEF0FF]">
                          {req.course?.publishedVersion?.titleAr ||
                            req.learningPath?.titleAr ||
                            req.diploma?.titleAr ||
                            'برنامج تدريبي'}
                        </p>
                        <Badge
                          tone={
                            req.status === 'APPROVED'
                              ? 'success'
                              : req.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {req.status === 'APPROVED'
                            ? 'معتمدة'
                            : req.status === 'REJECTED'
                              ? 'ملاحظات للمراجعة'
                              : 'قيد المراجعة (إدارة ومدرب)'}
                        </Badge>
                      </div>
                      {req.reviewNotesAr && (
                        <p className="text-[#A9B1E0]">ملاحظة: {req.reviewNotesAr}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Earned Certificates & Recent Payments */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
              <Award className="h-5 w-5 text-[#77E2B5]" />
              شهاداتي الموثقة
            </h2>
            {!data?.certificates?.length ? (
              <p className="text-sm text-[#A9B1E0]">
                تظهر شهادة إتمام الدورة (شهادة حضور) تلقائياً فور إتمام دروس الدورة بنسبة 100%، وبعدها يمكنك طلب شهادة الكفاءة.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.certificates.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#77E2B5]/35 bg-[#0B1440] p-3.5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-[#EEF0FF]">{cert.titleAr}</p>
                        <Badge tone={cert.kind === 'COMPETENCY' ? 'warning' : 'success'}>
                          {cert.kind === 'COMPETENCY'
                            ? 'شهادة الكفاءة المهنية'
                            : 'شهادة إتمام الدورة (حضور)'}
                        </Badge>
                      </div>
                      <p dir="ltr" className="font-mono text-xs text-[#8CA2FF] text-end sm:text-start">
                        {cert.certificateCode}
                      </p>
                    </div>
                    <Link href={`/certificates/${encodeURIComponent(cert.certificateCode)}`}>
                      <Button variant="outline" size="sm">
                        عرض والتحقق
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">سجل المدفوعات المنفصل</h2>
            {!membership?.payments?.length ? (
              <p className="text-sm text-[#A9B1E0]">لا توجد معاملات مالية مسجلة.</p>
            ) : (
              <div className="space-y-2">
                {membership.payments.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-extrabold text-[#EEF0FF]">
                        {tx.plan?.nameAr ||
                          tx.event?.titleAr ||
                          tx.course?.publishedVersion?.titleAr ||
                          tx.learningPath?.titleAr ||
                          tx.diploma?.titleAr ||
                          'معاملة بوصلة'}
                      </p>
                      <p dir="ltr" className="font-mono text-xs text-[#A9B1E0]">
                        {tx.merchantOrderId}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-extrabold text-[#EEF0FF]">
                        {formatEgp(tx.amountCents)}
                      </p>
                      {(() => {
                        const meta = getPaymentStatusMeta(tx.status);
                        return <Badge tone={meta.tone}>{meta.label}</Badge>;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
        );
      })()}
    </DashboardShell>
  );
}
