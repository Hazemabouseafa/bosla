'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Compass,
  DollarSign,
  Edit3,
  Film,
  Plus,
  Send,
  Star,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch, editorialStatusLabelAr, formatEgp } from '@/lib/api';
import { COVER_IMAGE_PRESETS } from '@/lib/labels';
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
import { InstructorCommunitiesPanel } from '@/components/community/InstructorCommunitiesPanel';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState(COVER_IMAGE_PRESETS[0].url);
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER',
  );
  const [isFree, setIsFree] = useState(false);
  const [descriptionAr, setDescriptionAr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, home] = await Promise.all([
        apiFetch<any>('/instructor/dashboard'),
        apiFetch<any>('/catalog/home'),
      ]);
      setData(dash);
      setCategories(home?.categories ?? []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/instructor');
      return;
    }
    if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
      router.replace('/student');
      return;
    }
    void loadData();
  }, [authLoading, user, router]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const effectiveSlug =
        slug.trim().toLowerCase() || slugifyTitle(titleAr, 'course');
      const created = await apiFetch<any>('/instructor/courses', {
        method: 'POST',
        body: JSON.stringify({
          titleAr,
          slug: effectiveSlug,
          categoryId: categoryId || null,
          thumbnailUrl: thumbnailUrl.trim() || null,
          difficulty,
          isFree,
          descriptionAr,
        }),
      });
      pushToast('تم إنشاء مسودة الكورس بنجاح!', 'success');
      setCreateOpen(false);
      router.push(`/instructor/courses/${created.id}`);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء الكورس', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickSubmit = async (courseId: string) => {
    try {
      await apiFetch(`/instructor/courses/${courseId}/submit`, { method: 'POST' });
      pushToast('تم إرسال الكورس للمراجعة الإدارية بنجاح', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الكورس', 'error');
    }
  };

  const handleReviewCompetency = async (
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
  ) => {
    try {
      await apiFetch(`/instructor/competency-requests/${requestId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reviewNotesAr:
            decision === 'APPROVE'
              ? 'تم التحقق من الكفاءة المهنية واعتماد الشهادة من المدرب'
              : 'يرجى استكمال المتطلبات العملية وإعادة التقديم',
        }),
      });
      pushToast(
        decision === 'APPROVE'
          ? 'تم اعتماد وإصدار شهادة الكفاءة للمتدرب!'
          : 'تم تسجيل ملاحظات المراجعة وإبلاغ المتدرب',
        'success',
      );
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ المراجعة', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <PublicPageLayout>
        <div className="py-20 text-center text-sm font-bold text-bosla-muted">
          جاري تحميل بوابة المدرب...
        </div>
      </PublicPageLayout>
    );
  }

  const stats = data?.stats;
  const maxProgress = Math.max(
    1,
    ...(data?.courses ?? []).map((c: any) => Number(c._count?.lessonProgress ?? 0)),
  );
  const navItems: DashboardNavItem[] = [
    {
      id: 'overview',
      label: 'نظرة عامة وكورساتي',
      icon: <Compass className="h-4 w-4" />,
      href: '/instructor',
      active: true,
    },
    {
      id: 'videos',
      label: 'مكتبة الفيديوهات',
      icon: <Film className="h-4 w-4" />,
      href: '/instructor/videos',
    },
    {
      id: 'catalog',
      label: 'عرض المنصة للطلاب',
      icon: <BookOpen className="h-4 w-4" />,
      href: '/courses',
    },
  ];

  return (
    <DashboardShell
      portalBadge="بوابة المدرب وصناعة المحتوى"
      portalTitle={`مرحباً، ${user?.fullName || 'المدرب'}`}
      portalSubtitle="أدر مسودات الكورسات، اعتماد الكفاءة، وكشف حسابك المالي المستقل."
      navItems={navItems}
      sidebarCtaLabel="+ إنشاء كورس جديد"
      onSidebarCtaClick={() => setCreateOpen(true)}
      headerActions={
        <div className="flex flex-wrap gap-2">
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                ← لوحة الإدارة الشاملة
              </Button>
            </Link>
          )}
          <Link href="/instructor/videos">
            <Button variant="outline" size="sm">
              <Film className="h-4 w-4" />
              مكتبة الفيديوهات والرفع
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            إنشاء كورس جديد
          </Button>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1">
          <p className="font-extrabold text-[#EEF0FF]">حالة الفيديوهات</p>
          <p className="text-[#8CA2FF] font-bold">
            {stats?.readyVideos ?? 0} / {stats?.totalVideos ?? 0} جاهز للبث
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {(() => {
          const coursesList: any[] = data?.courses ?? [];
          const publishedPct = coursesList.length
            ? Math.round(((stats?.publishedCourses ?? 0) / coursesList.length) * 100)
            : 0;
          const videoPct = (stats?.totalVideos ?? 0) > 0
            ? Math.round(((stats?.readyVideos ?? 0) / stats.totalVideos) * 100)
            : 100;
          const ratingPct = Math.min(100, Math.round(((Number(stats?.averageRating ?? 5) || 5) / 5) * 100));
          const nowDate = new Date();
          const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
          const totalInteractions = coursesList.reduce(
            (s, c) => s + Number(c._count?.lessonProgress ?? 0),
            0,
          );
          const engagementSeries = Array.from({ length: 8 }, (_, idx) => {
            const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (7 - idx), 1);
            const base = Math.max(4, coursesList.length * 3 + idx * 4);
            return {
              label: arabicMonths[d.getMonth()],
              current: idx === 7 ? Math.max(base, totalInteractions + (stats?.uniqueLearners ?? 0)) : base + (idx % 2 === 0 ? 5 : 1),
              previous: Math.max(2, Math.round(base * 0.72)),
            };
          });
          const pendingCompCount = (data?.competencyRequests ?? []).filter((r: any) => r.status === 'PENDING').length;
          return (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_316px] items-start">
              {/* CENTER MAIN BENTO COLUMN */}
              <div className="min-w-0 space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <BentoKpiCard
                    value={stats?.uniqueLearners ?? 0}
                    label="المتعلمون الفعليون"
                    delta={`${stats?.totalCourses ?? 0} كورس (${stats?.publishedCourses ?? 0} منشور)`}
                    deltaTone="success"
                    iconBgClass="bg-[#EEF0FF] text-[#4A43D9]"
                    icon={<Users className="h-5 w-5" />}
                  />
                  <BentoKpiCard
                    value={`${stats?.readyVideos ?? 0} / ${stats?.totalVideos ?? 0}`}
                    label="الفيديوهات الجاهزة للبث"
                    delta={`جاهزية ${videoPct}% • طلبات كفاءة: ${pendingCompCount}`}
                    deltaTone="warning"
                    iconBgClass="bg-[#EEF0FF] text-[#D97706]"
                    icon={<BarChart3 className="h-5 w-5" />}
                  />
                  <BentoKpiCard
                    value={stats?.averageRating ?? 0}
                    label="متوسط تقييم المتدربين"
                    delta={`الرصيد المستحق: ${formatEgp(data?.financialStatement?.account?.pendingBalanceCents ?? 0)}`}
                    deltaTone="info"
                    iconBgClass="bg-[#EEF0FF] text-[#E11D48]"
                    icon={<Star className="h-5 w-5 fill-current" />}
                  />
                </div>

                {coursesList.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {coursesList.slice(0, 3).map((course: any, idx: number) => {
                      const lp = Number(course._count?.lessonProgress ?? 0);
                      const pct = lp > 0 ? Math.min(100, Math.round((lp / maxProgress) * 100)) : course.status === 'PUBLISHED' ? 100 : 40;
                      const liveSt = editorialStatusLabelAr(course.status);
                      return (
                        <BentoCourseSpotlightCard
                          key={`spot-${course.id}`}
                          title={course.draftVersion?.titleAr || course.slug}
                          subtitle={`${lp} متابعة • ${course._count?.certificates ?? 0} شهادة`}
                          thumbnailUrl={course.publishedVersion?.thumbnailUrl || course.draftVersion?.thumbnailUrl}
                          progressPercent={pct}
                          ctaLabel="فتح محرر الدروس"
                          highlighted={idx === 0}
                          tintIndex={idx}
                          badgeText={liveSt.label}
                          href={`/instructor/courses/${course.id}`}
                        />
                      );
                    })}
                  </div>
                )}

                <MonthlyProgressSplineChart
                  title="معدل تفاعل الطلاب وحضور الدروس"
                  currentLabel="الشهر الحالي"
                  previousLabel="الشهر السابق"
                  seriesByFilter={{
                    'سجلات المتابعة': engagementSeries,
                  }}
                />
              </div>

              {/* END INSIGHTS RAIL */}
              <div className="w-full space-y-5">
                <EventDatesCalendarCard
                  title="جدول المتابعة والمواعيد"
                  events={[]}
                  seeAllHref="/events"
                />

                <ActivityGaugeCard
                  title="مؤشر الأداء وجودة المحتوى"
                  centerValue={`${Math.round((publishedPct + videoPct + ratingPct) / 3)}%`}
                  segments={[
                    {
                      label: 'نشر الكورسات',
                      percent: publishedPct,
                      color: '#7C95FF',
                      dotClass: 'bg-[#7C95FF]',
                    },
                    {
                      label: 'جاهزية الفيديو',
                      percent: videoPct,
                      color: '#F5B94A',
                      dotClass: 'bg-[#F5B94A]',
                    },
                    {
                      label: 'التقييم',
                      percent: ratingPct,
                      color: '#F2498D',
                      dotClass: 'bg-[#F2498D]',
                    },
                  ]}
                />

                <TopPerformersCard
                  title="تفاعلات كورساتك الأعلى"
                  items={coursesList.slice(0, 3).map((c: any) => ({
                    id: c.id,
                    name: c.draftVersion?.titleAr || c.slug,
                    subtitle: `${c._count?.certificates ?? 0} شهادة صادرة`,
                    score: `${c._count?.lessonProgress ?? 0} متابعة`,
                  }))}
                />
              </div>
            </div>
          );
        })()}

        {/* Permission boundary note */}
        <AlertBanner tone="info">
          يعمل النشر وفق حوكمة التحرير: يمكنك تعديل مسودات كورساتك ورفع الفيديوهات ثم إرسالها للمراجعة، بينما يعتمد المشرفون المراجعة والنشر النهائي للطلاب.
        </AlertBanner>

        {/* Courses List */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#8CA2FF]" />
            كورساتي ومشاريع الدروس ({data?.courses?.length ?? 0})
          </h2>
          {!data?.courses?.length ? (
            <EmptyState
              title="لم تنشئ أي كورس بعد"
              description="ابدأ بإنشاء أول مسودة كورس لك وأضف الدروس والمرفقات والاختبارات."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  إنشاء كورس جديد
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.courses.map((course: any) => {
                const draftSt = editorialStatusLabelAr(course.draftVersion?.status);
                const liveSt = editorialStatusLabelAr(course.status);
                return (
                  <Card key={course.id} className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={draftSt.tone}>المسودة: {draftSt.label}</Badge>
                        {course.publishedVersion && (
                          <Badge tone={liveSt.tone}>
                            النسخة الحية v{course.publishedVersion.versionNumber}: {liveSt.label}
                          </Badge>
                        )}
                      </div>
                      <span dir="ltr" className="font-mono text-xs text-bosla-muted">
                        /{course.slug}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold text-bosla-ink">
                        {course.draftVersion?.titleAr || course.slug}
                      </h3>
                      {course.instructor?.fullName && user?.role === 'ADMIN' && (
                        <p className="text-xs text-bosla-muted mt-0.5">
                          المدرب: {course.instructor.fullName}
                        </p>
                      )}
                      {course.draftVersion?.reviewNotes && (
                        <p className="mt-2 rounded-xl bg-[#F5B94A]/10 border border-[#F5B94A]/35 p-2.5 text-xs text-[#F5B94A]">
                          <strong>ملاحظة المراجعة الإدارية:</strong>{' '}
                          {course.draftVersion.reviewNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bosla-line pt-3 text-xs text-bosla-muted">
                      <span className="inline-flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" />
                        سجلات متابعة: {course._count?.lessonProgress ?? 0} • شهادات:{' '}
                        {course._count?.certificates ?? 0}
                      </span>
                      <div className="flex gap-2">
                        {(course.draftVersion?.status === 'DRAFT' ||
                          course.draftVersion?.status === 'CHANGES_REQUESTED') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickSubmit(course.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            إرسال للمراجعة
                          </Button>
                        )}
                        <Link href={`/instructor/courses/${course.id}`}>
                          <Button variant="primary" size="sm">
                            <Edit3 className="h-3.5 w-3.5" />
                            فتح المحرر
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Instructor Communities & Lesson Q&A */}
        <InstructorCommunitiesPanel />

        {/* Independent Instructor Financial Account Statement (Rule 4 + Admin %) */}
        {data?.financialStatement && (
          <Card className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22307A] pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#8CA2FF]" />
                  كشف الحساب المالي المستقل للمدرب
                </h2>
                <p className="text-xs text-[#A9B1E0] mt-0.5">
                  متابعة نسبتك المئوية في كل دورة وبرنامج والرصيد المستحق والدفعات المالية المسجلة.
                </p>
              </div>
              <span dir="ltr" className="rounded-lg border border-[#22307A] bg-[#0B1440] px-3 py-1 font-mono text-xs font-extrabold text-[#8CA2FF]">
                {data.financialStatement.account?.accountCode}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
                <p className="text-xs text-[#A9B1E0]">إجمالي العوائد المكتسبة</p>
                <p className="mt-1 text-xl font-extrabold text-[#77E2B5]">
                  {formatEgp(data.financialStatement.account?.totalEarnedCents ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4">
                <p className="text-xs text-[#A9B1E0]">إجمالي المنصرف والمحول</p>
                <p className="mt-1 text-xl font-extrabold text-[#8CA2FF]">
                  {formatEgp(data.financialStatement.account?.totalPaidOutCents ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#F5B94A]/40 bg-[#0B1440] p-4">
                <p className="text-xs text-[#A9B1E0]">الرصيد المعلق القابل للصرف</p>
                <p className="mt-1 text-xl font-extrabold text-[#F5B94A]">
                  {formatEgp(data.financialStatement.account?.pendingBalanceCents ?? 0)}
                </p>
              </div>
            </div>

            {data.financialStatement.programAssignments?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-extrabold text-[#EEF0FF]">
                  البرامج والدورات المعيّن بها ونسبتك المئوية المحددة من الإدارة:
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.financialStatement.programAssignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-extrabold text-[#EEF0FF] truncate">
                          {a.course?.publishedVersion?.titleAr ||
                            a.learningPath?.titleAr ||
                            a.diploma?.titleAr ||
                            'برنامج تدريبي'}
                        </p>
                        <p className="text-[#A9B1E0]">{a.roleTitleAr}</p>
                      </div>
                      <Badge tone="warning">نسبتك: {a.revenueSharePercent}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#EEF0FF]">
                حركات كشف الحساب وسجل الدفعات ({data.financialStatement.entries?.length ?? 0})
              </p>
              {!data.financialStatement.entries?.length ? (
                <p className="rounded-xl border border-dashed border-[#22307A] p-4 text-center text-xs text-[#A9B1E0]">
                  لا توجد قيود مالية مسجلة في كشف حسابك بعد. تسجل العوائد تلقائياً فور كل عملية شراء أو صرف مستحقات.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                  {data.financialStatement.entries.map((ent: any) => (
                    <div
                      key={ent.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-[#EEF0FF]">{ent.descriptionAr}</p>
                        <p className="text-[#A9B1E0] mt-0.5">
                          {new Date(ent.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                          {ent.sharePercent ? ` • النسبة ${ent.sharePercent}%` : ''}
                        </p>
                      </div>
                      <div className="text-end">
                        <p
                          className={`font-extrabold ${
                            ent.netAmountCents >= 0 ? 'text-[#77E2B5]' : 'text-[#F5B94A]'
                          }`}
                        >
                          {ent.netAmountCents >= 0 ? '+' : ''}
                          {formatEgp(ent.netAmountCents)}
                        </p>
                        <p className="text-[#A9B1E0]">
                          الرصيد بعد القيد: {formatEgp(ent.balanceAfterCents)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Competency Certificate Requests for Instructor's Assigned Programs */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                <Award className="h-5 w-5 text-[#F5B94A]" />
                طلبات شهادة الكفاءة المهنية ({(data?.competencyRequests ?? []).length})
              </h2>
              <p className="text-xs text-[#A9B1E0] mt-0.5">
                الطلبات المرسلة من المتدربين بعد إتمام 100% من الدورات والبرامج المعيّنة لك.
              </p>
            </div>
          </div>
          {!(data?.competencyRequests?.length) ? (
            <p className="text-xs text-[#A9B1E0]">لا توجد طلبات شهادة كفاءة حالياً.</p>
          ) : (
            <div className="space-y-3">
              {data.competencyRequests.map((req: any) => (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-xs"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[#EEF0FF]">{req.user?.fullName}</strong>
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
                          ? 'تم الاعتماد'
                          : req.status === 'REJECTED'
                            ? 'مُعاد بملاحظات'
                            : 'بانتظار المراجعة'}
                      </Badge>
                    </div>
                    <p className="text-[#8CA2FF] font-bold">
                      {req.course?.publishedVersion?.titleAr ||
                        req.learningPath?.titleAr ||
                        req.diploma?.titleAr ||
                        'برنامج تدريبي'}
                    </p>
                    {req.studentNotesAr && (
                      <p className="text-[#A9B1E0]">ملاحظة المتدرب: {req.studentNotesAr}</p>
                    )}
                    {req.certificate?.certificateCode && (
                      <p dir="ltr" className="font-mono text-[#77E2B5]">
                        {req.certificate.certificateCode}
                      </p>
                    )}
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        onClick={() => void handleReviewCompetency(req.id, 'APPROVE')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        اعتماد شهادة الكفاءة
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleReviewCompetency(req.id, 'REJECT')}
                      >
                        <XCircle className="h-4 w-4" />
                        إرجاع بملاحظات
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Instructor & Program Linked Reviews (Rule 6) */}
        {data?.reviews?.length > 0 && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <DollarSign className="hidden" />
              <Star className="h-5 w-5 text-[#F5B94A]" />
              تقييمات المتدربين المرتبطة بك وبالبرامج ({data.reviews.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.reviews.map((rev: any) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[#EEF0FF]">{rev.user?.fullName}</strong>
                    <span className="text-[#F5B94A] font-extrabold">
                      الدورة: {rev.rating}/5 ★ • المدرب: {rev.instructorRating ?? rev.rating}/5 ★
                    </span>
                  </div>
                  <p className="text-[#8CA2FF] font-bold">
                    {rev.course?.publishedVersion?.titleAr || rev.course?.slug}
                  </p>
                  {rev.commentAr && <p className="text-[#A9B1E0]">{rev.commentAr}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Editorial Feedback Log */}
        {data?.recentFeedback?.length > 0 && (
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-extrabold text-bosla-ink">سجل ملاحظات المراجعة</h2>
            <div className="space-y-2">
              {data.recentFeedback.map((log: any) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bosla-line p-3 text-xs"
                >
                  <div>
                    <span className="font-extrabold text-[#EEF0FF]">{log.course?.slug}</span>
                    {' — '}
                    <span>{log.comment || log.toStatus}</span>
                  </div>
                  <span className="text-bosla-muted">
                    {log.actor?.fullName} • {new Date(log.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Create Course Modal */}
        <NativeModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="إنشاء مسودة كورس جديد"
        >
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <Field id="nc-title" label="عنوان الكورس بالعربية" required>
              <input
                id="nc-title"
                className={inputClassName}
                value={titleAr}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitleAr(val);
                  if (!slugTouched) {
                    setSlug(slugifyTitle(val, 'course'));
                  }
                }}
                placeholder="مثال: إدارة عنابر التسمين الحديثة"
                required
                minLength={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="nc-slug"
                label="رابط الصفحة المختصر (تلقائي ويمكن تعديله)"
                hint="يتم توليده تلقائياً باللغة الإنجليزية"
                required
              >
                <input
                  id="nc-slug"
                  dir="ltr"
                  className={inputClassName}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="broiler-house-management"
                  required
                  pattern="[a-z0-9\-]+"
                />
              </Field>
              <Field id="nc-cat" label="التخصص">
                <select
                  id="nc-cat"
                  className={inputClassName}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">— اختر قسماً —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field id="nc-thumb" label="صورة غلاف الكورس">
              <select
                id="nc-thumb"
                className={inputClassName}
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
              >
                {COVER_IMAGE_PRESETS.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="nc-diff" label="المستوى">
                <select
                  id="nc-diff"
                  className={inputClassName}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                >
                  <option value="BEGINNER">مبتدئ</option>
                  <option value="INTERMEDIATE">متوسط</option>
                  <option value="ADVANCED">متقدم</option>
                </select>
              </Field>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-extrabold text-bosla-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="h-4 w-4 accent-bosla-primary"
                  />
                  كورس مجاني مفتوح لكل الطلاب
                </label>
              </div>
            </div>
            <Field id="nc-desc" label="وصف تفصيلي للكورس" required>
              <textarea
                id="nc-desc"
                rows={3}
                className={inputClassName}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                required
                minLength={10}
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'جاري الإنشاء...' : 'إنشاء وفتح محرر الكورس'}
            </Button>
          </form>
        </NativeModal>
      </div>
    </DashboardShell>
  );
}
