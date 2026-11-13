'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  CreditCard,
  GraduationCap,
  Layers,
  PlayCircle,
  Settings,
} from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
        {/* Top Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="info">بوابة المتدرب</Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-bosla-ink sm:text-3xl">
              مرحباً {user?.fullName}
            </h1>
            <p className="text-sm text-bosla-muted">
              تابع دروسك، تقدم المسارات والدبلومات، واشتراكات العضوية والشهادات المعتمدة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/student/settings">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                إعدادات الحساب وPasskey
              </Button>
            </Link>
            <Link href="/courses">
              <Button variant="primary" size="sm">
                <BookOpen className="h-4 w-4" />
                تصفح الكورسات
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">حالة العضوية</p>
            <p className="mt-2 text-lg font-extrabold text-bosla-navy">
              {activeSub ? activeSub.plan?.nameAr || 'عضوية نشطة' : 'غير مشترك حالياً'}
            </p>
            <p className="mt-1 text-xs text-bosla-muted">
              {activeSub
                ? `سارية حتى ${new Date(activeSub.currentPeriodEnd).toLocaleDateString('ar-EG')}`
                : 'اشترك لفتح كل الكورسات والمسارات'}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">الكورسات المشمولة المتاحة</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-primary">
              {membership?.entitledCourseIds?.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-bosla-muted">وفق صلاحيات باقتك</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">الشهادات الصادرة</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-success">
              {data?.certificates?.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-bosla-muted">موثقة برمز تحقق عام</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold text-bosla-muted">مفاتيح الأمان المسجلة</p>
            <p className="mt-2 text-2xl font-extrabold text-bosla-ink">
              {user?.passkeyCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-bosla-muted">
              أكواد استرداد متبقية: {user?.unusedRecoveryCodesCount ?? 0}
            </p>
          </Card>
        </div>

        {/* Membership & Paymob Card */}
        <Card className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-indigo-200 bg-indigo-50/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-bosla-primary" />
              <h2 className="text-lg font-extrabold text-bosla-ink">
                إدارة العضوية والاشتراك
              </h2>
            </div>
            {activeSub ? (
              <p className="text-sm text-bosla-ink">
                أنت مشترك حالياً في <strong>{activeSub.plan?.nameAr}</strong>.{' '}
                {activeSub.cancelAtPeriodEnd
                  ? 'مجدول عدم التجديد بنهاية الفترة الحالية.'
                  : 'الاشتراك فعّال ويمكّنك من متابعة جميع الدروس المشمولة.'}
              </p>
            ) : (
              <p className="text-sm text-bosla-muted">
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

        {/* Continue Watching */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-bosla-ink">استأنف التعلم</h2>
          {!data?.continueWatching?.length ? (
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.continueWatching.map((c: any) => (
                <Card key={c.courseId} className="overflow-hidden flex flex-col">
                  <img
                    src={c.thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                    alt={c.titleAr}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-extrabold text-bosla-ink">{c.titleAr}</h3>
                      <div className="mt-3 flex items-center justify-between text-xs font-bold text-bosla-muted">
                        <span>
                          {c.completedLessons} من {c.totalLessons} دروس
                        </span>
                        <span>{c.progressPercent}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-bosla-success"
                          style={{ width: `${c.progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <Link href={`/learn/${c.slug}`}>
                      <Button variant="primary" size="sm" className="w-full">
                        <PlayCircle className="h-4 w-4" />
                        متابعة المشاهدة
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Learning Paths & Diplomas Progress */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
              <Layers className="h-5 w-5 text-bosla-primary" />
              تقدم المسارات التعليمية
            </h2>
            {(data?.pathProgress ?? []).map((p: any) => (
              <Link
                key={p.id}
                href={`/learning-paths/${p.slug}`}
                className="block rounded-xl border border-bosla-line p-3.5 hover:border-bosla-primary"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-bosla-ink">
                  <span>{p.titleAr}</span>
                  <span className="text-bosla-primary">{p.progressPercent}%</span>
                </div>
                <p className="mt-1 text-xs text-bosla-muted">
                  مكتمل {p.completedRequiredCourses} من {p.totalRequiredCourses} كورسات
                </p>
              </Link>
            ))}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
              <GraduationCap className="h-5 w-5 text-bosla-amber" />
              تقدم الدبلومات
            </h2>
            {(data?.diplomaProgress ?? []).map((d: any) => (
              <Link
                key={d.id}
                href={`/diplomas/${d.slug}`}
                className="block rounded-xl border border-bosla-line p-3.5 hover:border-bosla-amber"
              >
                <div className="flex items-center justify-between text-sm font-extrabold text-bosla-ink">
                  <span>{d.titleAr}</span>
                  <span className="text-bosla-primary">{d.progressPercent}%</span>
                </div>
                <p className="mt-1 text-xs text-bosla-muted">
                  مكتمل {d.completedRequiredCourses} من {d.totalRequiredCourses} كورسات أساسية
                </p>
              </Link>
            ))}
          </Card>
        </div>

        {/* Earned Certificates & Recent Payments */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
              <Award className="h-5 w-5 text-bosla-success" />
              شهاداتي الموثقة
            </h2>
            {!data?.certificates?.length ? (
              <p className="text-xs text-bosla-muted">
                تظهر شهاداتك تلقائياً هنا فور إتمام الدروس واجتياز اختبارات الكورسات.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.certificates.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-bosla-ink">{cert.titleAr}</p>
                      <p dir="ltr" className="font-mono text-xs text-bosla-primary text-end sm:text-start">
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
            <h2 className="text-lg font-extrabold text-bosla-ink">سجل المدفوعات (Paymob)</h2>
            {!membership?.payments?.length ? (
              <p className="text-xs text-bosla-muted">لا توجد معاملات مالية مسجلة.</p>
            ) : (
              <div className="space-y-2">
                {membership.payments.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-bosla-line p-3 text-xs"
                  >
                    <div>
                      <p className="font-extrabold text-bosla-ink">
                        {tx.plan?.nameAr || 'عضوية بوصلة'}
                      </p>
                      <p dir="ltr" className="font-mono text-[11px] text-bosla-muted">
                        {tx.merchantOrderId}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-extrabold text-bosla-navy">
                        {formatEgp(tx.amountCents)}
                      </p>
                      <Badge
                        tone={
                          tx.status === 'PAID'
                            ? 'success'
                            : tx.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>
    </PublicPageLayout>
  );
}
