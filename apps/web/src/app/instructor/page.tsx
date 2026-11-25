'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileVideo,
  Layers,
  Plus,
  Send,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import {
  apiFetch,
  courseStatusLabelAr,
  difficultyLabelAr,
  formatEgp,
  formatNumber,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CourseWizardEditor } from '@/components/instructor/CourseWizardEditor';
import { InstructorCollabPanel } from '@/components/instructor/InstructorCollabPanel';
import { InstructorRecommendationsPanel } from '@/components/instructor/InstructorRecommendationsPanel';
import { buildInstructorAccordionNavItems } from '@/components/instructor/InstructorNavMap';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { InstructorShell } from '@/components/layout/SiteShell';
import { CoverImageFrame } from '@/components/ui/CoverImageFrame';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyStateCard,
  SkeletonDashboardGrid,
  StatCard,
} from '@/components/ui/primitives';

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCourseWizard, setShowNewCourseWizard] = useState(false);
  const [section, setSection] = useState<'courses' | 'collab' | 'recommendations'>('courses');
  const [unreadCollabCount, setUnreadCollabCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const sec = sp.get('section');
    if (sec === 'collab' || sec === 'recommendations') {
      setSection(sec);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cRes, catsRes] = await Promise.all([
        apiFetch<any[]>('/instructor/courses'),
        apiFetch<any[]>('/catalog/categories'),
      ]);
      setCourses(cRes ?? []);
      setCategories(catsRes ?? []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل بيانات لوحة المدرب', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, pushToast]);

  useEffect(() => {
    if (user) void loadData();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, loadData]);

  if (authLoading || loading) {
    return (
      <InstructorShell>
        <SkeletonDashboardGrid />
      </InstructorShell>
    );
  }

  if (!user) {
    return (
      <InstructorShell>
        <AlertBanner tone="warning" title="يرجى تسجيل الدخول بحساب مدرب">
          <Link href="/login">
            <Button variant="primary" size="sm" className="mt-2">
              تسجيل الدخول
            </Button>
          </Link>
        </AlertBanner>
      </InstructorShell>
    );
  }

  const publishedCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const inReviewCount = courses.filter(
    (c) =>
      c.status === 'IN_REVIEW' ||
      c.draftVersion?.status === 'SUBMITTED_FOR_REVIEW',
  ).length;
  const draftCount = courses.filter(
    (c) =>
      c.status === 'DRAFT' &&
      c.draftVersion?.status !== 'SUBMITTED_FOR_REVIEW',
  ).length;

  const navItems = buildInstructorAccordionNavItems({
    activeSection: section,
    onSelectSection: (nextSec) => setSection(nextSec),
    coursesCount: courses.length,
    unreadCollabCount,
  });

  const sectionTitle =
    section === 'collab'
      ? 'التواصل والمهام مع الإدارة العليا'
      : section === 'recommendations'
        ? 'طلبات خطابات التوصية المعتمدة'
        : 'إدارة الكورسات والمحتوى التعليمي';

  return (
    <DashboardShell
      variant="default"
      portalBadge="بوابة المدرب المعتمدة"
      breadcrumbLabel={`بوابة المدرب / ${sectionTitle}`}
      portalTitle={sectionTitle}
      portalSubtitle={`مرحباً ${user.fullName} — تحكّم في الكورسات، المهام، وخطابات التوصية`}
      navItems={navItems}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/instructor/videos">
            <Button variant="secondary" size="sm">
              <FileVideo className="h-4 w-4" />
              مكتبة الفيديوهات
            </Button>
          </Link>
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid="instructor-new-course-wizard-btn"
            onClick={() => {
              setSection('courses');
              setShowNewCourseWizard((v) => !v);
            }}
          >
            <Plus className="h-4 w-4" />
            {showNewCourseWizard ? 'إخفاء معالج الإنشاء' : 'إنشاء كورس جديد (4 خطوات)'}
          </Button>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1 text-[11px]">
          <p className="font-extrabold text-bosla-ink">{user.fullName}</p>
          <p className="text-bosla-muted">كورسات منشورة: {formatNumber(publishedCount)}</p>
        </div>
      }
    >
      {section === 'collab' ? (
        <InstructorCollabPanel
          currentUserId={user.id}
          onSummaryChange={(stats) => setUnreadCollabCount(stats?.unreadMessages ?? 0)}
          pushToast={pushToast}
        />
      ) : section === 'recommendations' ? (
        <InstructorRecommendationsPanel />
      ) : (
      <div className="space-y-6">

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard
            label="إجمالي كورساتي"
            value={formatNumber(courses.length)}
            icon={<BookOpen className="h-5 w-5" />}
          />
          <StatCard
            label="كورسات منشورة"
            value={formatNumber(publishedCount)}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="قيد المراجعة الإدارية"
            value={formatNumber(inReviewCount)}
            icon={<Send className="h-5 w-5" />}
          />
          <StatCard
            label="مسودات قيد الإعداد"
            value={formatNumber(draftCount)}
            icon={<Clock className="h-5 w-5" />}
          />
        </div>

        {/* Inline 4-Step Course Creation Wizard */}
        {showNewCourseWizard && (
          <CourseWizardEditor
            mode="instructor"
            categories={categories}
            onCourseCreated={(newId) => {
              router.push(`/instructor/courses/${newId}?step=2`);
            }}
            onCoursePublishedOrSubmitted={() => {
              setShowNewCourseWizard(false);
              void loadData();
            }}
            onClose={() => setShowNewCourseWizard(false)}
          />
        )}

        {/* Rich Course Management Cards (Section 5) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-100">
              قائمة الكورسات ({formatNumber(courses.length)})
            </h2>
          </div>

          {courses.length === 0 ? (
            <EmptyStateCard
              icon={<BookOpen className="h-6 w-6" />}
              title="لم تقم بإنشاء أي كورس بعد"
              description="ابدأ بإنشاء أول كورس تطبيقي لك في 4 خطوات بسيطة مع رفع الفيديوهات وحفظ المسودة تلقائياً."
              action={
                <Button
                  variant="primary"
                  onClick={() => setShowNewCourseWizard(true)}
                >
                  <Plus className="h-4 w-4" />
                  إنشاء أول كورس الآن
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((c) => {
                const ver = c.draftVersion ?? c.publishedVersion;
                const sections: any[] = ver?.sections ?? [];
                const lessons: any[] = sections.flatMap((s: any) => s.lessons ?? []);
                const videoLessons = lessons.filter((l: any) => l.type === 'VIDEO');
                const readyVideos = videoLessons.filter(
                  (l: any) =>
                    l.videoAssetId &&
                    (!l.videoAsset || l.videoAsset.status === 'READY'),
                );
                const freePreviewCount = lessons.filter(
                  (l: any) => c.isFree || l.isFreePreview,
                ).length;

                const isDraft = c.status === 'DRAFT';
                const isPublished = c.status === 'PUBLISHED';

                return (
                  <Card
                    key={c.id}
                    data-testid={`instructor-course-card-${c.id}`}
                    className="flex flex-col justify-between p-5 space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            tone={
                              isPublished
                                ? 'success'
                                : c.status === 'IN_REVIEW'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {courseStatusLabelAr(c.status)}
                          </Badge>
                          <Badge tone="info">{c.category?.nameAr || 'تصنيف عام'}</Badge>
                          <Badge tone={c.isFree ? 'success' : 'purple'}>
                            {c.isFree
                              ? 'مجاني بالكامل'
                              : formatEgp(Number(c.priceCents ?? 0))}
                          </Badge>
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {difficultyLabelAr(c.difficulty)}
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-28 shrink-0">
                          <CoverImageFrame
                            src={ver?.thumbnailUrl}
                            alt={ver?.titleAr || c.slug}
                            focalX={ver?.coverFocalX ?? 50}
                            focalY={ver?.coverFocalY ?? 50}
                            fitMode={ver?.coverFitMode ?? 'COVER'}
                            className="rounded-xl border border-slate-800"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-extrabold text-slate-100 line-clamp-1">
                            {ver?.titleAr || c.slug}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                            {ver?.subtitleAr || ver?.descriptionAr || 'بدون وصف مختصر'}
                          </p>
                        </div>
                      </div>

                      {/* Metadata Bar: Instructor, Lesson Count, Video Readiness, Free Previews */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800/90 bg-slate-900/70 p-3 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <UserIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">
                            المدرب: <strong>{c.instructor?.fullName || user.fullName}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-300 tabular-nums">
                          <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span>
                            الدروس: <strong>{formatNumber(lessons.length)}</strong> (
                            {formatNumber(freePreviewCount)} معاينة مجانية)
                          </span>
                        </div>

                        <div className="col-span-2 flex items-center gap-1.5 pt-0.5">
                          <FileVideo className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="text-slate-300">حالة الفيديوهات:</span>
                          {lessons.length === 0 ? (
                            <Badge tone="warning">بانتظار إضافة دروس</Badge>
                          ) : videoLessons.length === 0 ||
                            readyVideos.length === videoLessons.length ? (
                            <Badge tone="success">
                              جميع الفيديوهات جاهزة للتشغيل ({formatNumber(readyVideos.length)})
                            </Badge>
                          ) : (
                            <Badge tone="warning">
                              {formatNumber(readyVideos.length)} من{' '}
                              {formatNumber(videoLessons.length)} فيديو جاهز
                            </Badge>
                          )}
                        </div>
                      </div>

                      {ver?.reviewFeedbackAr && (
                        <AlertBanner tone="warning" title="ملاحظات المراجعة الإدارية">
                          {ver.reviewFeedbackAr}
                        </AlertBanner>
                      )}
                    </div>

                    {/* Direct Actions: Resume Draft / Edit Content / Preview */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                      <Link href={`/instructor/courses/${c.id}`}>
                        <Button variant="primary" size="sm">
                          {isDraft ? (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              استكمال المسودة (4 خطوات)
                            </>
                          ) : (
                            <>
                              <Edit3 className="h-3.5 w-3.5" />
                              تعديل المحتوى والدروس
                            </>
                          )}
                        </Button>
                      </Link>

                      <div className="flex items-center gap-2">
                        {isPublished ? (
                          <Link href={`/courses/${c.slug}`} target="_blank">
                            <Button variant="secondary" size="sm">
                              <Eye className="h-3.5 w-3.5" />
                              معاينة الكورس
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/instructor/courses/${c.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-3.5 w-3.5" />
                              معاينة كزائر / طالب
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </DashboardShell>
  );
}
