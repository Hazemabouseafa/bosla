'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Compass,
  GraduationCap,
  MapPin,
  MessageCircle,
  Ticket,
  Users,
} from 'lucide-react';
import { difficultyLabelAr, formatDate, formatEgp, formatNumber } from '@/lib/api';
import { resolveSectionVisibility } from '@/lib/section-visibility';
import { Badge, Button, Card, NativeModal, inputClassName } from '@/components/ui/primitives';
import { LearningPathCard } from '@/components/catalog/LearningPathCard';
import type { HomeBundle } from './HomeExperience';

export function AuthenticatedHomeHub({
  data,
  user,
}: {
  data: HomeBundle;
  user: { fullName: string };
}) {
  const sec = resolveSectionVisibility(
    data?.sectionVisibility ??
      data?.settings?.section_visibility ??
      data?.settings?.sectionVisibility,
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');

  const filteredCourses = useMemo(() => {
    const all = data?.courses ?? [];
    if (selectedCategory === 'all') return all;
    if (selectedCategory === 'free') return all.filter((c) => c.isFree);
    return all.filter((c) => c.category?.slug === selectedCategory);
  }, [data?.courses, selectedCategory]);

  const assistantSuggestions = useMemo(() => {
    const q = assistantQuery.trim().toLowerCase();
    const pool = [
      ...data.courses.map((c) => ({
        title: c.publishedVersion?.titleAr || c.slug,
        kind: 'كورس',
        href: `/courses/${c.slug}`,
      })),
      ...data.learningPaths.map((p) => ({
        title: p.titleAr,
        kind: 'مسار تعلم',
        href: `/learning-paths/${p.slug}`,
      })),
      ...data.diplomas.map((d) => ({
        title: d.titleAr,
        kind: 'دبلومة',
        href: `/diplomas/${d.slug}`,
      })),
    ];
    if (!q) return pool.slice(0, 5);
    return pool.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 6);
  }, [data, assistantQuery]);

  return (
    <div id="authenticated-academy-content" className="relative">
      {sec.hero && (
        <section className="relative overflow-hidden border-b border-[#8CA2FF]/16 bg-[#070D2B] py-14 text-[#EEF0FF]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs sm:text-sm font-semibold text-[#8CA2FF]">
                من الطالب إلى المدير — البوابة المفعّلة للعضو
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                أهلاً بعودتك، {user.fullName}
              </h1>
              <p className="text-sm sm:text-base leading-relaxed text-[#A9B1E0]">
                جميع الكورسات التطبيقية والمسارات المهنية والدبلومات المعتمدة والفعاليات متاحة لك الآن.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link href="/student">
                <Button variant="primary" size="lg">
                  <Compass className="h-4 w-4" />
                  الدخول إلى لوحة التعلم
                </Button>
              </Link>
              <Link href="/courses">
                <Button variant="outline" size="lg">
                  مكتبة الكورسات الكاملة
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 1. Featured Courses */}
      {sec.courses && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="info">مكتبة العضو المفعّلة</Badge>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                أبرز الكورسات التطبيقية
              </h2>
            </div>
            <Link href="/courses" className="text-sm font-semibold text-[#8CA2FF] hover:underline">
              عرض جميع الكورسات ←
            </Link>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#7C95FF] text-[#070D2B]'
                  : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('free')}
              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                selectedCategory === 'free'
                  ? 'bg-[#7C95FF] text-[#070D2B]'
                  : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
              }`}
            >
              معاينة مجانية
            </button>
            {data.categories.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.slug)}
                className={`min-h-[40px] rounded-xl px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  selectedCategory === c.slug
                    ? 'border border-[#8CA2FF] bg-[#18266E] text-[#8CA2FF]'
                    : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF]/50 hover:text-[#EEF0FF]'
                }`}
              >
                {c.nameAr}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCourses.map((course) => {
              const lessonCount =
                course.publishedVersion?.sections.reduce(
                  (acc, s) => acc + s._count.lessons,
                  0,
                ) ?? 0;
              return (
                <Card
                  key={course.id}
                  spotlight
                  className="bosla-card-hover group flex flex-col overflow-hidden"
                >
                  <Link
                    href={`/courses/${course.slug}`}
                    className="relative block aspect-[16/10] overflow-hidden bg-[#0B1440]"
                  >
                    <img
                      src={
                        course.publishedVersion?.thumbnailUrl ||
                        '/images/brand/course-biosecurity.webp'
                      }
                      alt={course.publishedVersion?.titleAr || course.slug}
                      className="bosla-card-media h-full w-full object-cover"
                    />
                    <span className="absolute top-3 start-3">
                      <Badge
                        tone={
                          course.isFree
                            ? 'success'
                            : (course as any).includedInMembership === false
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {course.isFree
                          ? 'معاينة مجانية'
                          : (course as any).includedInMembership === false
                            ? `مستقل (${formatEgp((course as any).priceCents ?? 45000)})`
                            : 'ضمن العضوية'}
                      </Badge>
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col p-4">
                    <Link href={`/courses/${course.slug}`}>
                      <h3 className="text-base font-semibold leading-snug text-[#EEF0FF] group-hover:text-[#8CA2FF] line-clamp-2">
                        {course.publishedVersion?.titleAr || course.slug}
                      </h3>
                    </Link>
                    <p className="mt-2 text-xs sm:text-sm tabular-nums text-[#A9B1E0]">
                      {formatNumber(course.publishedVersion?.durationMinutes ?? 0)} دقيقة •{' '}
                      {formatNumber(lessonCount)} دروس •{' '}
                      {difficultyLabelAr(course.difficulty).split('—')[0]}
                    </p>
                    <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#8CA2FF]/14 gap-2">
                      <span className="text-xs font-medium text-[#EEF0FF] truncate">
                        {course.instructor.fullName}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#8CA2FF]">
                        {course.category?.nameAr}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Learning Paths */}
      {sec.learningPaths && (
        <section className="border-y border-[#8CA2FF]/16 bg-[#0B1440] py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge tone="info">خارطة التدرج المهني المنظمة</Badge>
                <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                  المسارات التعليمية
                </h2>
              </div>
              <Link href="/learning-paths">
                <Button variant="outline" size="md">
                  عرض جميع المسارات
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className={`grid gap-8 ${data.learningPaths.length === 1 ? 'mx-auto max-w-3xl' : 'lg:grid-cols-2'}`}>
              {data.learningPaths.map((path, idx) => (
                <LearningPathCard key={path.id} path={path} index={idx} headingLevel="h3" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Offline Events */}
      {sec.offlineEvents && (data.offlineEvents?.length ?? 0) > 0 && (
        <section className="border-b border-[#8CA2FF]/16 bg-[#070D2B] py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge tone="warning">تدريب عملي وميداني مباشر</Badge>
                <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                  الفعاليات والكورسات الأوفلاين
                </h2>
              </div>
              <Link href="/events">
                <Button variant="outline" size="md">
                  عرض جميع الفعاليات
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {data.offlineEvents!.slice(0, 4).map((ev) => (
                <Card key={ev.id} spotlight className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="relative h-48 w-full bg-[#0B1440]">
                      {ev.thumbnailUrl ? (
                        <img src={ev.thumbnailUrl} alt={ev.titleAr} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#8CA2FF]">
                          <Ticket className="h-12 w-12 opacity-60" />
                        </div>
                      )}
                      <div className="absolute top-3 start-3 rounded-lg bg-[#070D2B]/90 border border-[#8CA2FF]/25 px-3 py-1 text-xs font-semibold text-[#EEF0FF]">
                        {ev.categoryLabelAr}
                      </div>
                      <div className="absolute top-3 end-3 rounded-lg bg-[#7C95FF] px-3 py-1 text-xs font-semibold tabular-nums text-[#070D2B]">
                        {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                      </div>
                    </div>
                    <div className="p-6 space-y-2.5">
                      <h3 className="text-lg font-semibold text-[#EEF0FF]">{ev.titleAr}</h3>
                      <p className="text-sm text-[#A9B1E0] line-clamp-2">{ev.descriptionAr}</p>
                      <div className="flex flex-wrap gap-4 pt-1 text-xs text-[#A9B1E0] tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          {ev.cityAr}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          {formatDate(ev.startsAt, { dateStyle: 'medium' })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          متبقي {formatNumber(ev.remainingSeats)} من {formatNumber(ev.capacity)} مقعد
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <Link href={`/events/${ev.slug}`}>
                      <Button variant="primary" size="md" className="w-full">
                        تفاصيل الفعالية والحجز
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Diplomas (Exact heading for Admin toggle + E2E Test 5) */}
      {sec.diplomas && (
        <section className="py-14 sm:py-16 border-b border-[#8CA2FF]/16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#EEF0FF]">
                الدبلومات التطبيقية المعتمدة حتى 140 ساعة
              </h2>
              <Link href="/diplomas" className="text-sm font-semibold text-[#8CA2FF] hover:underline">
                تصفح الدبلومات ←
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {data.diplomas.map((dip) => (
                <Card key={dip.id} spotlight className="bosla-card-hover flex flex-col justify-between p-6">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <Badge tone="info">
                        <GraduationCap className="h-4 w-4" />
                        {formatNumber(dip.totalHours)} ساعة تدريبية
                      </Badge>
                      <span className="text-xs font-semibold text-[#F5B94A]">
                        مشروع عملي وتقييم مدرب
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-[#EEF0FF]">{dip.titleAr}</h3>
                    <p className="mt-2 text-sm sm:text-base leading-[1.7] text-[#A9B1E0]">
                      {dip.descriptionAr}
                    </p>
                  </div>
                  <div className="mt-6">
                    <Link href={`/diplomas/${dip.slug}`}>
                      <Button variant="primary" className="w-full">
                        التفاصيل والمتطلبات والشهادة
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Floating Smart Assistant */}
      <div className="fixed bottom-5 end-5 z-30">
        <Button
          variant="navy"
          onClick={() => setAssistantOpen(true)}
          aria-label="افتح مرشد بوصلة الذكي"
          className="rounded-xl border border-[#8CA2FF]/25 bg-[#0B1440] px-4 py-2.5"
        >
          <MessageCircle className="h-4 w-4 text-[#8CA2FF]" />
          <span className="hidden sm:inline">مرشد بوصلة</span>
        </Button>
      </div>

      <NativeModal
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        title="مرشد بوصلة التفاعلي"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#A9B1E0]">
            اكتب اسم التخصص أو المهارة التي تبحث عنها لنوجهك فوراً إلى الكورس أو المسار أو الدبلومة الأنسب:
          </p>
          <input
            type="search"
            value={assistantQuery}
            onChange={(e) => setAssistantQuery(e.target.value)}
            placeholder="مثال: دواجن، أمان حيوي، أعلاف، تسويق"
            className={inputClassName}
          />
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {assistantSuggestions.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                onClick={() => setAssistantOpen(false)}
                className="flex items-center justify-between rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-3 transition-colors hover:border-[#8CA2FF] hover:bg-[#18266E]"
              >
                <span className="text-sm font-semibold text-[#EEF0FF]">{item.title}</span>
                <Badge tone="info">{item.kind}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </NativeModal>
    </div>
  );
}
