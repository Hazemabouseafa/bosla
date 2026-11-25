'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  Clock,
  Compass,
  CreditCard,
  GraduationCap,
  Layers,
  MapPin,
  MessageSquare,
  PlayCircle,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { difficultyLabelAr, apiFetch, formatDate, formatEgp, formatNumber } from '@/lib/api';
import { getEventRegistrationStatusMeta, getPaymentStatusMeta } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import {
  ActivityGaugeCard,
  BentoCourseSpotlightCard,
  BentoKpiCard,
  BentoProgressRingCard,
  EventDatesCalendarCard,
  MonthlyProgressSplineChart,
  TopPerformersCard,
} from '@/components/dashboard/DashboardWidgets';
import { BoslaCompassSvg } from '@/components/svg/BoslaCompassSvg';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { StudentCredentialsPanel } from '@/components/student/StudentCredentialsPanel';
import { Badge, Button, Card, EmptyState, SkeletonDashboardGrid } from '@/components/ui/primitives';

type StudentWorkspaceTab = 'overview' | 'library' | 'tracks' | 'credentials';

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, requiresPasskeyEnrollment, pushToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [catalogCourses, setCatalogCourses] = useState<any[]>([]);
  const [catalogPaths, setCatalogPaths] = useState<any[]>([]);
  const [catalogDiplomas, setCatalogDiplomas] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<StudentWorkspaceTab>('overview');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, coursesRes, pathsRes, diplomasRes] = await Promise.allSettled([
        apiFetch<any>('/learning/dashboard'),
        apiFetch<any[]>('/catalog/courses'),
        apiFetch<any[]>('/catalog/learning-paths'),
        apiFetch<any[]>('/catalog/diplomas'),
      ]);
      setData(dashRes.status === 'fulfilled' ? dashRes.value : null);
      setCatalogCourses(coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value) ? coursesRes.value : []);
      setCatalogPaths(pathsRes.status === 'fulfilled' && Array.isArray(pathsRes.value) ? pathsRes.value : []);
      setCatalogDiplomas(diplomasRes.status === 'fulfilled' && Array.isArray(diplomasRes.value) ? diplomasRes.value : []);
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

  const categoriesList = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalogCourses) {
      if (c?.category?.slug && c?.category?.nameAr) {
        map.set(c.category.slug, c.category.nameAr);
      }
    }
    return Array.from(map.entries()).map(([slug, nameAr]) => ({ slug, nameAr }));
  }, [catalogCourses]);

  const filteredCatalogCourses = useMemo(() => {
    const term = libraryQuery.trim().toLowerCase();
    return catalogCourses.filter((c) => {
      if (libraryCategory !== 'ALL' && c?.category?.slug !== libraryCategory) {
        return false;
      }
      if (!term) return true;
      const title = (c?.publishedVersion?.titleAr || c?.slug || '').toLowerCase();
      const desc = (c?.publishedVersion?.subtitleAr || c?.publishedVersion?.descriptionAr || '').toLowerCase();
      const inst = (c?.instructor?.fullName || '').toLowerCase();
      return title.includes(term) || desc.includes(term) || inst.includes(term);
    });
  }, [catalogCourses, libraryQuery, libraryCategory]);

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-6">
          <SkeletonDashboardGrid />
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
      label: 'لوحة التعلم والنظرة العامة',
      group: 'مساحتي التعليمية',
      icon: <Compass className="h-4 w-4" />,
      onClick: () => setActiveTab('overview'),
      active: activeTab === 'overview',
    },
    {
      id: 'courses',
      label: 'مكتبة الكورسات',
      group: 'مساحتي التعليمية',
      icon: <BookOpen className="h-4 w-4" />,
      onClick: () => setActiveTab('library'),
      active: activeTab === 'library',
      badge: catalogCourses.length > 0 ? formatNumber(catalogCourses.length) : undefined,
    },
    {
      id: 'paths',
      label: 'المسارات والدبلومات',
      group: 'مساحتي التعليمية',
      icon: <Layers className="h-4 w-4" />,
      onClick: () => setActiveTab('tracks'),
      active: activeTab === 'tracks',
      badge:
        catalogPaths.length + catalogDiplomas.length > 0
          ? formatNumber(catalogPaths.length + catalogDiplomas.length)
          : undefined,
    },
    {
      id: 'wishlist',
      label: 'السلة وقائمة المحفوظات',
      group: 'مساحتي التعليمية',
      icon: <Bookmark className="h-4 w-4" />,
      href: '/cart',
      badge: data?.wishlistCount > 0 ? formatNumber(data.wishlistCount) : undefined,
    },
    {
      id: 'diplomas-page',
      label: 'دليل الدبلومات الكامل',
      group: 'الفعاليات والمجتمع',
      icon: <GraduationCap className="h-4 w-4" />,
      href: '/diplomas',
    },
    {
      id: 'events',
      label: 'الفعاليات الأوفلاين',
      group: 'الفعاليات والمجتمع',
      icon: <Ticket className="h-4 w-4" />,
      href: '/events',
    },
    {
      id: 'community',
      label: 'مجتمع الأسئلة والأجوبة',
      group: 'الفعاليات والمجتمع',
      icon: <MessageSquare className="h-4 w-4" />,
      href: '/community',
    },
    {
      id: 'credentials',
      label: 'الشهادات والتوصيات والتذاكر',
      group: 'الشهادات والتوصيات',
      icon: <Award className="h-4 w-4" />,
      onClick: () => setActiveTab('credentials'),
      active: activeTab === 'credentials',
    },
    {
      id: 'verify',
      label: 'التحقق من الشهادات والتوصيات',
      group: 'الشهادات والتوصيات',
      icon: <Award className="h-4 w-4" />,
      href: '/certificates/verify',
    },
    {
      id: 'notifications',
      label: 'الإشعارات',
      group: 'الحساب والدعم',
      icon: <Bell className="h-4 w-4" />,
      href: '/notifications',
    },
    {
      id: 'settings',
      label: 'الإعدادات والأمان',
      group: 'الحساب والدعم',
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
      sidebarCtaLabel="استعراض كل الكورسات"
      sidebarCtaHref="/courses"
      searchPlaceholder="ابحث في مكتبة الكورسات..."
      searchValue={libraryQuery}
      onSearchChange={(val) => {
        setLibraryQuery(val);
        if (val.trim() && activeTab === 'overview') {
          setActiveTab('library');
        }
      }}
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Link href="/community" className="hidden xl:inline-flex">
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4" />
              مجتمع الأسئلة
            </Button>
          </Link>
          <Link href="/student/settings" className="hidden 2xl:inline-flex">
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
        const resumeCourse = mergedCourses[0] ?? null;
        const certsCount = Number(data?.certificates?.length ?? 0);
        const entitledIds = new Set<string>(membership?.entitledCourseIds ?? []);
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

        const studentCalendarEvents = [
          ...(data?.eventRegistrations ?? []).map((reg: any) => ({
            id: reg.id,
            titleAr: reg.event?.titleAr || 'فعالية أوفلاين',
            startsAt: reg.event?.startsAt || new Date().toISOString(),
            cityAr: reg.event?.cityAr,
          })),
          ...((data?.lmsSchedule?.upcomingSessions ?? []).map((sess: any) => ({
            id: `sess-${sess.id}`,
            titleAr: `جلسة: ${sess.titleAr}`,
            startsAt: sess.startsAt,
            cityAr: sess.locationAr || 'أونلاين / بث مباشر',
          }))),
        ];

        const leaderboardItems = [
          ...(data?.pathProgress ?? []).map((p: any) => ({
            id: `p-${p.id}`,
            name: p.titleAr,
            subtitle: `${formatNumber(p.completedRequiredCourses)}/${formatNumber(p.totalRequiredCourses)} كورسات`,
            score: `${formatNumber(p.progressPercent)}%`,
          })),
          ...(data?.diplomaProgress ?? []).map((d: any) => ({
            id: `d-${d.id}`,
            name: d.titleAr,
            subtitle: `${formatNumber(d.completedRequiredCourses)}/${formatNumber(d.totalRequiredCourses)} كورسات`,
            score: `${formatNumber(d.progressPercent)}%`,
          })),
        ].slice(0, 3);

        const workspaceTabs: Array<{ id: StudentWorkspaceTab; label: string; count?: number }> = [
          { id: 'overview', label: 'نظرة عامة والنشاط' },
          { id: 'library', label: 'مكتبة الكورسات', count: catalogCourses.length },
          {
            id: 'tracks',
            label: 'المسارات والدبلومات',
            count: catalogPaths.length + catalogDiplomas.length,
          },
          {
            id: 'credentials',
            label: 'الفعاليات والشهادات والمدفوعات',
            count: (data?.certificates?.length ?? 0) + (data?.eventRegistrations?.length ?? 0),
          },
        ];

        return (
      <div className="space-y-6">
        {/* Personalized Trainee Welcome Spotlight */}
        <section
          data-sc-spotlight=""
          className="bosla-liquid-glass-portal rounded-3xl p-5 sm:p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="hidden sm:block shrink-0">
                <BoslaCompassSvg
                  variant="seal"
                  bearingDeg={Math.min(350, Math.max(18, avgProgressPercent * 3.5))}
                  className="h-24 w-24"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={activeSub ? 'success' : 'info'}>
                    {activeSub ? activeSub.plan?.nameAr || 'عضوية نشطة' : 'متدرب في أكاديمية بوصلة'}
                  </Badge>
                  <span className="text-xs font-medium text-[#A9B1E0] tabular-nums">
                    {formatNumber(entitledCount)} كورس متاح • {formatNumber(completedLessonsTotal)} درس مكتمل
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#EEF0FF] truncate">
                  {resumeCourse
                    ? `استكمل رحلتك: ${resumeCourse.titleAr}`
                    : 'أهلاً بك في مساحتك التعليمية الخاصة'}
                </h2>
                <p className="text-xs sm:text-sm text-[#A9B1E0] leading-relaxed max-w-2xl">
                  {resumeCourse
                    ? `أنجزت ${formatNumber(resumeCourse.completedLessons)} من أصل ${formatNumber(resumeCourse.totalLessons)} درساً (${formatNumber(resumeCourse.progressPercent)}%). عد من نفس الثانية عبر المشغل المحمي.`
                    : 'ابدأ باختيار أول كورس أو مسار تعليمي من المكتبة المتاحة لك داخل البوابة.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {resumeCourse ? (
                <Link href={`/learn/${resumeCourse.slug}`}>
                  <Button variant="primary" size="md">
                    <PlayCircle className="h-4 w-4" />
                    متابعة المشاهدة الآن
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setActiveTab('library')}
                >
                  <BookOpen className="h-4 w-4" />
                  فتح مكتبة الكورسات
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setActiveTab('tracks')}
              >
                <Layers className="h-4 w-4" />
                المسارات والدبلومات
              </Button>
            </div>
          </div>
        </section>

        {/* Segmented Dashboard Tabs */}
        <div
          role="tablist"
          aria-label="أقسام بوابة المتدرب"
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-1.5"
        >
          {workspaceTabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF0FF] text-[#070D2B] shadow-[0_6px_16px_-8px_rgba(238,240,255,0.45)]'
                    : 'text-[#A9B1E0] hover:bg-[#18266E]/60 hover:text-[#EEF0FF]'
                }`}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${
                      isActive
                        ? 'bg-[#070D2B]/12 text-[#070D2B]'
                        : 'bg-[#0F1A4A] text-[#8CA2FF]'
                    }`}
                  >
                    {formatNumber(t.count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'library' && (
          <section className="space-y-5">
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#EEF0FF]">
                    مكتبة الكورسات المتاحة ({formatNumber(filteredCatalogCourses.length)})
                  </h2>
                  <p className="text-xs text-[#A9B1E0]">
                    تصفح جميع الكورسات المنشورة وافتح المشغل التعليمي مباشرة من داخل لوحتك.
                  </p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A9B1E0]" />
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="ابحث بالعنوان أو المدرب..."
                    className="h-10 w-full rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] ps-9 pe-3 text-xs font-medium text-[#EEF0FF] placeholder:text-[#A9B1E0]/65 focus:border-[#8CA2FF] focus:outline-none"
                  />
                </div>
              </div>

              {categoriesList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLibraryCategory('ALL')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      libraryCategory === 'ALL'
                        ? 'bg-[#7C95FF] text-[#070D2B]'
                        : 'border border-[#8CA2FF]/18 bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
                    }`}
                  >
                    كل التخصصات
                  </button>
                  {categoriesList.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setLibraryCategory(cat.slug)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        libraryCategory === cat.slug
                          ? 'bg-[#7C95FF] text-[#070D2B]'
                          : 'border border-[#8CA2FF]/18 bg-[#0B1440] text-[#A9B1E0] hover:text-[#EEF0FF]'
                      }`}
                    >
                      {cat.nameAr}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {filteredCatalogCourses.length === 0 ? (
              <EmptyState
                title="لا توجد كورسات مطابقة"
                description="جرّب تغيير كلمة البحث أو استعراض جميع التخصصات."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLibraryQuery('');
                      setLibraryCategory('ALL');
                    }}
                  >
                    إعادة ضبط البحث
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredCatalogCourses.map((course: any) => {
                  const lessonCount = (course.publishedVersion?.sections ?? []).reduce(
                    (acc: number, s: any) => acc + (s.lessons?.length ?? 0),
                    0,
                  );
                  const isEntitled = Boolean(course.isFree) || entitledIds.has(course.id);
                  const courseProgress = mergedCourses.find((m: any) => m.courseId === course.id);
                  return (
                    <Card key={course.id} spotlight className="group bosla-card-hover flex flex-col overflow-hidden p-0">
                      <Link href={`/courses/${course.slug}`} className="bosla-image-frame relative h-44 overflow-hidden bg-[#0B1440]">
                        <img
                          src={course.publishedVersion?.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                          alt={course.publishedVersion?.titleAr || course.slug}
                          className="bosla-card-media h-full w-full object-cover"
                        />
                        <div className="absolute top-3 start-3 flex flex-wrap gap-1.5">
                          {course.isFree ? (
                            <Badge tone="success">مجاني</Badge>
                          ) : isEntitled ? (
                            <Badge tone="info">متاح بحسابك</Badge>
                          ) : (
                            <Badge tone="warning">{formatEgp(course.priceCents)}</Badge>
                          )}
                        </div>
                      </Link>
                      <div className="flex flex-1 flex-col p-5 space-y-3">
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-[#8CA2FF]">
                            {course.category?.nameAr}
                          </span>
                          <Link href={`/courses/${course.slug}`}>
                            <h3 className="text-base font-bold text-[#EEF0FF] group-hover:text-[#8CA2FF] transition-colors line-clamp-2">
                              {course.publishedVersion?.titleAr || course.slug}
                            </h3>
                          </Link>
                          <p className="text-xs text-[#A9B1E0] line-clamp-2 leading-relaxed">
                            {course.publishedVersion?.subtitleAr || course.publishedVersion?.descriptionAr}
                          </p>
                        </div>

                        <div className="mt-auto space-y-3 pt-2 border-t border-[#8CA2FF]/14">
                          <div className="flex items-center justify-between text-xs text-[#A9B1E0] tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <PlayCircle className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {formatNumber(lessonCount)} درس
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {formatNumber(course.publishedVersion?.durationMinutes ?? 0)} د
                            </span>
                            <span>{difficultyLabelAr(course.difficulty).split('—')[0]}</span>
                          </div>
                          {courseProgress && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#18266E]">
                                <div
                                  className="h-full rounded-full bg-[#77E2B5]"
                                  style={{ width: `${Math.max(4, courseProgress.progressPercent || 0)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-[#77E2B5] tabular-nums">
                                {formatNumber(courseProgress.progressPercent || 0)}%
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Link href={`/learn/${course.slug}`} className="flex-1">
                              <Button variant="primary" size="sm" className="w-full">
                                <PlayCircle className="h-4 w-4" />
                                {courseProgress?.progressPercent > 0 ? 'متابعة الدرس' : 'فتح المشغل'}
                              </Button>
                            </Link>
                            <Link href={`/courses/${course.slug}`}>
                              <Button variant="outline" size="sm">
                                التفاصيل
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'tracks' && (
          <section className="space-y-8">
            {/* Learning Paths */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#EEF0FF]">
                  <Layers className="h-5 w-5 text-[#8CA2FF]" />
                  المسارات المهنية المنظمة ({formatNumber(catalogPaths.length)})
                </h2>
                <Link href="/learning-paths" className="text-xs font-semibold text-[#8CA2FF] hover:underline">
                  الصفحة الكاملة للمسارات ←
                </Link>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {catalogPaths.map((p: any) => {
                  const prog = (data?.pathProgress ?? []).find((x: any) => x.id === p.id);
                  return (
                    <Card key={p.id} spotlight className="p-6 flex flex-col justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone={p.includedInMembership === false ? 'warning' : 'success'}>
                            {p.includedInMembership === false ? 'اشتراك مستقل' : 'شامل ضمن العضوية'}
                          </Badge>
                          <span className="text-xs text-[#A9B1E0] tabular-nums">
                            {formatNumber(p.courses?.length ?? 0)} كورسات متتابعة
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-[#EEF0FF]">{p.titleAr}</h3>
                        <p className="text-xs sm:text-sm text-[#A9B1E0] leading-relaxed line-clamp-2">
                          {p.descriptionAr}
                        </p>
                      </div>
                      <div className="space-y-3 border-t border-[#8CA2FF]/14 pt-3">
                        {prog && (
                          <div className="flex items-center justify-between text-xs text-[#77E2B5] font-semibold tabular-nums">
                            <span>تقدمك: {formatNumber(prog.completedRequiredCourses)}/{formatNumber(prog.totalRequiredCourses)}</span>
                            <span>{formatNumber(prog.progressPercent)}%</span>
                          </div>
                        )}
                        <Link href={`/learning-paths/${p.slug}`} className="block">
                          <Button variant="primary" size="sm" className="w-full justify-between">
                            <span>عرض خارطة المسار والبدء</span>
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Applied Diplomas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#EEF0FF]">
                  <GraduationCap className="h-5 w-5 text-[#F5B94A]" />
                  الدبلومات التطبيقية المعتمدة ({formatNumber(catalogDiplomas.length)})
                </h2>
                <Link href="/diplomas" className="text-xs font-semibold text-[#8CA2FF] hover:underline">
                  دليل الدبلومات الكامل ←
                </Link>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {catalogDiplomas.map((d: any) => {
                  const prog = (data?.diplomaProgress ?? []).find((x: any) => x.id === d.id);
                  return (
                    <Card key={d.id} spotlight className="p-6 flex flex-col justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone="warning">
                            <GraduationCap className="h-3.5 w-3.5" />
                            {formatNumber(d.totalHours ?? 0)} ساعة تطبيقية
                          </Badge>
                          <span className="text-xs text-[#A9B1E0] tabular-nums">
                            {formatNumber(d.courses?.length ?? 0)} وحدات تدريبية
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-[#EEF0FF]">{d.titleAr}</h3>
                        <p className="text-xs sm:text-sm text-[#A9B1E0] leading-relaxed line-clamp-2">
                          {d.descriptionAr}
                        </p>
                      </div>
                      <div className="space-y-3 border-t border-[#8CA2FF]/14 pt-3">
                        {prog && (
                          <div className="flex items-center justify-between text-xs text-[#F5B94A] font-semibold tabular-nums">
                            <span>الإنجاز: {formatNumber(prog.completedRequiredCourses)}/{formatNumber(prog.totalRequiredCourses)}</span>
                            <span>{formatNumber(prog.progressPercent)}%</span>
                          </div>
                        )}
                        <Link href={`/diplomas/${d.slug}`} className="block">
                          <Button variant="gold" size="sm" className="w-full justify-between">
                            <span>استعراض تفاصيل الدبلومة والتقديم</span>
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {(activeTab === 'overview') && (
        <>
        {/* Interactive Progress Rings Strip */}
        <div className="grid gap-4 md:grid-cols-3">
          <BentoProgressRingCard
            title="إنجاز الكورسات الجارية"
            subtitle={`أنهيت ${formatNumber(completedLessonsTotal)} درساً عبر كورساتك النشطة`}
            percent={avgProgressPercent}
            tone="accent"
            ringLabel="كورس"
          />
          <BentoProgressRingCard
            title="إتقان المسارات المهنية"
            subtitle="متوسط إتمام الكورسات المتسلسلة داخل مساراتك"
            percent={pathsAvg}
            tone="emerald"
            ringLabel="مسار"
          />
          <BentoProgressRingCard
            title="الدبلومات التطبيقية"
            subtitle="نسبة استيفاء الوحدات ومتطلبات مشروع التخرج"
            percent={diplomasAvg}
            tone="gold"
            ringLabel="دبلومة"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_316px] items-start">
          {/* CENTER MAIN COLUMN */}
          <div className="min-w-0 space-y-6">
            {/* 3 Bento KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <BentoKpiCard
                value={`${formatNumber(avgProgressPercent)}%`}
                label="إجمالي التقدم في الكورسات"
                delta={`${formatNumber(completedLessonsTotal)} درساً مكتملاً عبر ${formatNumber(continueWatching.length)} كورس`}
                deltaTone="success"
                iconBgClass="border border-[#8CA2FF]/25 bg-[#0B1440] text-[#77E2B5]"
                icon={<PlayCircle className="h-5 w-5" />}
              />
              <BentoKpiCard
                value={entitledCount}
                label="الكورسات المتاحة لك"
                delta={activeSub ? activeSub.plan?.nameAr || 'عضوية نشطة' : 'شراء مستقل / مجاني'}
                deltaTone="warning"
                iconBgClass="border border-[#F5B94A]/30 bg-[#0B1440] text-[#F5B94A]"
                icon={<BookOpen className="h-5 w-5" />}
              />
              <BentoKpiCard
                value={`${formatNumber(certsCount)} شهادة`}
                label="الشهادات والأمان"
                delta={`مفاتيح الأمان: ${formatNumber(user?.passkeyCount ?? 0)} • استرداد: ${formatNumber(user?.unusedRecoveryCodesCount ?? 0)}`}
                deltaTone="info"
                iconBgClass="border border-[#8CA2FF]/25 bg-[#0B1440] text-[#8CA2FF]"
                icon={<Award className="h-5 w-5" />}
              />
            </div>

            {/* 3 Illustrated Bento Course Cards */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#EEF0FF]">
                  كورساتي واستئناف التعلم ({formatNumber(mergedCourses.length)})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className="text-xs font-extrabold text-[#8CA2FF] hover:underline cursor-pointer"
                >
                  استكشف كل الكورسات ←
                </button>
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
                      subtitle={
                        c.lastLessonTitleAr
                          ? `آخر درس: ${c.lastLessonTitleAr} • ${formatNumber(c.completedLessons)}/${formatNumber(c.totalLessons)}`
                          : `${formatNumber(c.completedLessons)} من ${formatNumber(c.totalLessons)} دروس`
                      }
                      thumbnailUrl={c.thumbnailUrl}
                      coverFocalX={c.coverFocalX ?? 50}
                      coverFocalY={c.coverFocalY ?? 50}
                      coverFitMode={c.coverFitMode ?? 'COVER'}
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={c.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                          alt={c.titleAr}
                          className="h-12 w-16 shrink-0 rounded-lg object-cover border border-[#8CA2FF]/18"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#EEF0FF] truncate">{c.titleAr}</p>
                          <p className="text-[11px] text-[#A9B1E0] mt-0.5 tabular-nums">
                            {formatNumber(c.completedLessons)} من {formatNumber(c.totalLessons)} دروس • الإنجاز {formatNumber(c.progressPercent)}%
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
            <Card className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-[#8CA2FF]/30 bg-[#13205D]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#8CA2FF]" />
                  <h2 className="text-base font-extrabold text-[#EEF0FF]">
                    إدارة العضوية والاشتراك
                  </h2>
                </div>
                {activeSub ? (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-[#EEF0FF]">
                      أنت مشترك حالياً في <strong>{activeSub.plan?.nameAr}</strong>.{' '}
                      {activeSub.cancelAtPeriodEnd
                        ? 'مجدول عدم التجديد بنهاية الفترة الحالية.'
                        : 'الاشتراك فعّال ويمكّنك من متابعة جميع الدروس المشمولة.'}
                    </p>
                    {activeSub.isManualGrant && (
                      <Badge tone="purple">
                        عضوية ممنوحة عبر الدعم / الإدارة {activeSub.grantReasonAr ? `— ${activeSub.grantReasonAr}` : ''}
                      </Badge>
                    )}
                  </div>
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
              centerValue={`${formatNumber(avgProgressPercent)}%`}
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
                className="block rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3.5 hover:border-[#8CA2FF] transition-colors"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-[#EEF0FF]">
                  <span>{p.titleAr}</span>
                  <span className="text-[#8CA2FF] tabular-nums">{formatNumber(p.progressPercent)}%</span>
                </div>
                <p className="mt-1 text-xs text-[#A9B1E0] tabular-nums">
                  مكتمل {formatNumber(p.completedRequiredCourses)} من {formatNumber(p.totalRequiredCourses)} كورسات
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
                className="block rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3.5 hover:border-[#F5B94A] transition-colors"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-[#EEF0FF]">
                  <span>{d.titleAr}</span>
                  <span className="text-[#8CA2FF] tabular-nums">{formatNumber(d.progressPercent)}%</span>
                </div>
                <p className="mt-1 text-xs text-[#A9B1E0] tabular-nums">
                  مكتمل {formatNumber(d.completedRequiredCourses)} من {formatNumber(d.totalRequiredCourses)} كورسات أساسية
                </p>
              </Link>
            ))}
          </Card>
        </div>
        </>
        )}

        {(activeTab === 'overview' || activeTab === 'credentials') && (
        <>
        {/* Offline Event Tickets */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">
                تذاكر الفعاليات والكورسات الأوفلاين ({formatNumber((data?.eventRegistrations ?? []).length)})
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
            <div className="rounded-xl border border-dashed border-[#8CA2FF]/22 bg-[#0B1440]/60 p-5 text-center text-xs text-[#A9B1E0]">
              لا توجد لديك تذاكر فعاليات أوفلاين محجوزة حتى الآن. يمكنك اختيار ورشة أو فعالية وحجز مقعدك أونلاين.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.eventRegistrations.map((reg: any) => {
                const st = getEventRegistrationStatusMeta(reg.status);
                return (
                  <div
                    key={reg.id}
                    className="rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/90 p-4 space-y-3"
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
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                              {formatDate(reg.event.startsAt, {
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
                      <span className="text-[#A9B1E0] tabular-nums">
                        {formatNumber(reg.seatsCount)} مقعد • {formatEgp(reg.amountCents)}
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
                  البرامج والكورسات المشتراة بشكل مستقل ({formatNumber(membership.directPurchases.length)})
                </h2>
                <div className="space-y-2.5">
                  {membership.directPurchases.map((dp: any) => (
                    <div
                      key={dp.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3.5 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-[#EEF0FF]">
                          {dp.course?.publishedVersion?.titleAr ||
                            dp.learningPath?.titleAr ||
                            dp.diploma?.titleAr ||
                            'برنامج تدريبي'}
                        </p>
                        <p className="text-[#A9B1E0] tabular-nums">
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
                  طلبات شهادة الكفاءة المهنية ({formatNumber(data.competencyRequests.length)})
                </h2>
                <div className="space-y-2.5">
                  {data.competencyRequests.map((req: any) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3.5 text-xs space-y-1.5"
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

        {/* Real DB Upcoming Training Sessions & Assignments */}
        {((data?.lmsSchedule?.upcomingSessions?.length ?? 0) > 0 ||
          (data?.lmsSchedule?.upcomingAssignments?.length ?? 0) > 0) && (
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[#EEF0FF]">
                <Clock className="h-4 w-4 text-[#8CA2FF]" />
                الجلسات التدريبية والواجبات المجدولة
              </h2>
              <span className="text-xs text-[#A9B1E0]">بيانات مباشرة من مجموعاتك التدريبية</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              {(data?.lmsSchedule?.upcomingSessions ?? []).slice(0, 4).map((sess: any) => (
                <div key={sess.id} className="rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440]/85 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#EEF0FF]">{sess.titleAr}</span>
                    <Badge tone="info">جلسة</Badge>
                  </div>
                  <p className="text-[#A9B1E0] tabular-nums">
                    {formatDate(sess.startsAt)} {sess.locationAr ? `• ${sess.locationAr}` : ''}
                  </p>
                </div>
              ))}
              {(data?.lmsSchedule?.upcomingAssignments ?? []).slice(0, 4).map((asg: any) => (
                <div key={asg.id} className="rounded-xl border border-[#F5B94A]/25 bg-[#0B1440]/85 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#EEF0FF]">{asg.titleAr}</span>
                    <Badge tone="warning">واجب / اختبار</Badge>
                  </div>
                  <p className="text-[#A9B1E0] tabular-nums">
                    {asg.course?.publishedVersion?.titleAr || ''}
                    {asg.dueAt ? ` • الموعد: ${formatDate(asg.dueAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Earned Certificates, Recommendations & Recent Payments */}
        <div className="grid gap-6 md:grid-cols-2 items-start">
          <StudentCredentialsPanel
            certificates={data?.certificates ?? []}
            enrolledCourses={mergedCourses}
            pathProgress={data?.pathProgress ?? []}
            catalogCourses={catalogCourses}
            catalogPaths={catalogPaths}
            onReload={loadDashboard}
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">سجل المدفوعات المنفصل</h2>
            {!membership?.payments?.length ? (
              <p className="text-sm text-[#A9B1E0]">لا توجد معاملات مالية مسجلة.</p>
            ) : (
              <div className="space-y-2">
                {membership.payments.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-[#8CA2FF]/16 bg-[#0B1440]/85 p-3.5 text-xs"
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
                      <p className="font-extrabold text-[#EEF0FF] tabular-nums">
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
        </>
        )}
      </div>
        );
      })()}
    </DashboardShell>
  );
}
