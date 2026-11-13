'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Edit3,
  Film,
  Plus,
  Send,
  Star,
  Users,
} from 'lucide-react';
import { apiFetch, editorialStatusLabelAr } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
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
  const [categoryId, setCategoryId] = useState('');
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
      const created = await apiFetch<any>('/instructor/courses', {
        method: 'POST',
        body: JSON.stringify({
          titleAr,
          slug: slug.trim().toLowerCase(),
          categoryId: categoryId || null,
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

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="purple">بوابة المدرب وصناعة المحتوى</Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              استوديو المدرب — {user?.fullName}
            </h1>
            <p className="text-sm text-bosla-muted">
              أنشئ مسودات الكورسات وارفع الفيديوهات والمرفقات والاختبارات ثم أرسلها للاعتماد والنشر من الإدارة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/instructor/videos">
              <Button variant="outline" size="sm">
                <Film className="h-4 w-4" />
                مكتبة الفيديوهات ورفع HLS
              </Button>
            </Link>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              إنشاء كورس جديد
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">كورساتي</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-navy">
              {stats?.totalCourses ?? 0}
            </p>
            <p className="text-xs text-bosla-success font-bold mt-1">
              منشور: {stats?.publishedCourses ?? 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">المتعلمون الفعليون</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-primary flex items-center gap-2">
              <Users className="h-5 w-5" />
              {stats?.uniqueLearners ?? 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">الفيديوهات الجاهزة (HLS)</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-success">
              {stats?.readyVideos ?? 0} / {stats?.totalVideos ?? 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">متوسط التقييم</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-amber flex items-center gap-1.5">
              <Star className="h-5 w-5 fill-current" />
              {stats?.averageRating ?? 0}
            </p>
          </Card>
        </div>

        {/* Permission boundary note */}
        <AlertBanner tone="info">
          يعمل النشر وفق حوكمة التحرير: يمكنك تعديل مسودات كورساتك ورفع الفيديوهات ثم إرسالها للمراجعة، بينما يعتمد المشرفون المراجعة والنشر النهائي للطلاب.
        </AlertBanner>

        {/* Courses List */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-bosla-ink flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-bosla-primary" />
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
                      {course.draftVersion?.reviewNotes && (
                        <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-950">
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
                    <span className="font-extrabold text-bosla-navy">{log.course?.slug}</span>
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
            <Field id="nc-title" label="عنوان الكورس (بالعربية)" required>
              <input
                id="nc-title"
                className={inputClassName}
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="إدارة عنابر التسمين المغلقة"
                required
                minLength={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="nc-slug"
                label="الرابط المختصر (Slug بالإنجليزية)"
                hint="أحرف إنجليزية صغيرة وأرقام وشرطة فقط"
                required
              >
                <input
                  id="nc-slug"
                  dir="ltr"
                  className={inputClassName}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="broiler-house-management"
                  required
                  pattern="^[a-z0-9-]+$"
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
      </section>
    </PublicPageLayout>
  );
}
