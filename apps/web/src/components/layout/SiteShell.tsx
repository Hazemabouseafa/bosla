'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';
import { NotificationBell } from '@/components/community/NotificationBell';
import { ScrollMotionSystem } from '@/components/motion/ScrollMotionSystem';
import { Button, NativeModal, inputClassName } from '@/components/ui/primitives';

const UNAUTH_LINKS = [
  { href: '/courses', label: 'الكورسات' },
  { href: '/#methodology', label: 'الأركان التشغيلية' },
  { href: '/#partners', label: 'شركاؤنا' },
  { href: '/#partner-apply', label: 'انضم كشريك' },
  { href: '/pricing', label: 'العضويات' },
  { href: '/about', label: 'عن بوصلة' },
];

const AUTH_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/student', label: 'لوحة التعلم' },
  { href: '/courses', label: 'الكورسات' },
  { href: '/learning-paths', label: 'المسارات' },
  { href: '/diplomas', label: 'الدبلومات' },
  { href: '/events', label: 'الفعاليات' },
  { href: '/community', label: 'المجتمع' },
  { href: '/instructors', label: 'المدربون' },
];

export function SiteHeader({ isRolePortal = false }: { isRolePortal?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);
  const navLinks = isUnlocked ? AUTH_LINKS : UNAUTH_LINKS;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    setSearchOpen(false);
    setMobileOpen(false);
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : '/courses');
  };

  return (
    <>
      <ScrollMotionSystem />
      <header className="sticky top-0 z-40 border-b border-[#8CA2FF]/16 bg-[#070D2B]/90 backdrop-blur-md text-[#EEF0FF]">
        <a
          href="#main-content"
          className={`visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:font-semibold ${
            isRolePortal ? 'focus:bg-[#7C95FF] focus:text-[#070D2B]' : 'focus:bg-[#6B21A8] focus:text-white'
          }`}
        >
          تخطي إلى المحتوى الرئيسي
        </a>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="شعار أكاديمية بوصلة"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-[#EEF0FF] sm:text-base whitespace-nowrap">
                أكاديمية بوصلة
              </span>
              <span dir="ltr" className="text-[11px] font-medium text-[#A9B1E0] whitespace-nowrap">
                BOSLA Academy
              </span>
            </span>
          </Link>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden xl:flex items-center gap-4 2xl:gap-5"
          >
            {navLinks.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : !item.href.startsWith('/#') && pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative whitespace-nowrap py-2 text-xs 2xl:text-sm font-medium transition-colors duration-150 ${
                    active
                      ? isRolePortal
                        ? 'text-[#8CA2FF] font-semibold'
                        : 'text-[#C084FC] font-semibold'
                      : 'text-[#A9B1E0] hover:text-[#EEF0FF]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full ${
                        isRolePortal ? 'bg-[#8CA2FF]' : 'bg-[#6B21A8]'
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            {isUnlocked && (
              <>
                <form
                  onSubmit={handleSearchSubmit}
                  className="hidden 2xl:flex items-center relative"
                  role="search"
                  aria-label="البحث السريع في الكورسات"
                >
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن كورس"
                    aria-label="ابحث عن كورس"
                    className="h-10 w-40 rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A]/90 ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 transition-[width,border-color] duration-150 focus:w-48 focus:border-[#8CA2FF] focus:outline-none"
                  />
                  <Search className="pointer-events-none absolute start-3 h-4 w-4 text-[#A9B1E0]" />
                </form>

                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="بحث في الكورسات"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A]/90 text-[#A9B1E0] transition-colors duration-150 hover:border-[#8CA2FF] hover:text-[#8CA2FF] 2xl:hidden cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                </button>
              </>
            )}

            {!user && (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-[40px] items-center gap-1.5 px-3 text-sm font-medium text-[#A9B1E0] transition-colors hover:text-[#EEF0FF] whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5 text-[#8CA2FF]" />
                  تسجيل الدخول
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm" className="whitespace-nowrap">
                    ابدأ رحلتك الآن
                  </Button>
                </Link>
              </>
            )}

            {user && requiresPasskeyEnrollment && (
              <Link href="/security/passkey-setup">
                <Button variant="gold" size="sm" className="whitespace-nowrap">
                  <ShieldCheck className="h-4 w-4" />
                  استكمال تفعيل الحساب
                </Button>
              </Link>
            )}

            {isUnlocked && user && (
              <>
                {(() => {
                  const primaryDash = getDefaultDashboardForUser(user);
                  const allRoles = new Set<string>([user.role, ...(user.roles || [])]);
                  return (
                    <>
                      {primaryDash.href !== '/student' && (
                        <Link href={primaryDash.href}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap !px-2.5 xl:!px-3.5 !text-xs xl:!text-sm !border-[#8CA2FF]/35 !bg-[#18266E] !text-[#8CA2FF]"
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0" />
                            {primaryDash.label}
                          </Button>
                        </Link>
                      )}
                      {allRoles.has('INSTRUCTOR') && primaryDash.href !== '/instructor' && (
                        <Link href="/instructor">
                          <Button variant="outline" size="sm" className="whitespace-nowrap !px-2.5">
                            <BookOpen className="h-4 w-4 shrink-0" />
                            بوابة المدرب
                          </Button>
                        </Link>
                      )}
                      {allRoles.has('AFFILIATE_SELLER') && primaryDash.href !== '/seller' && (
                        <Link href="/seller">
                          <Button variant="outline" size="sm" className="whitespace-nowrap !px-2.5">
                            لوحة البائع
                          </Button>
                        </Link>
                      )}
                    </>
                  );
                })()}
                <Link href="/student">
                  <Button variant="primary" size="sm" className="whitespace-nowrap !px-3">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    تعلمي ({user.fullName.split(' ')[0]})
                  </Button>
                </Link>
                <NotificationBell darkSurface />
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="تسجيل الخروج"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] transition-colors hover:border-[#FF9CAA]/55 hover:text-[#FF9CAA] cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#EEF0FF] hover:border-[#8CA2FF] xl:hidden cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="فتح القائمة"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#8CA2FF]/16 bg-[#070D2B] px-4 py-4 xl:hidden">
            <nav aria-label="قائمة الجوال" className="flex flex-col gap-1.5 mb-4">
              {navLinks.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : !item.href.startsWith('/#') && pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`min-h-[44px] flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? isRolePortal
                          ? 'bg-[#7C95FF] text-[#070D2B] font-semibold'
                          : 'bg-[#6B21A8] text-white font-semibold'
                        : 'text-[#A9B1E0] hover:bg-[#0F1A4A] hover:text-[#EEF0FF]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2.5 border-t border-[#8CA2FF]/16 pt-3">
              {isUnlocked && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    setSearchOpen(true);
                  }}
                >
                  <Search className="h-4 w-4" />
                  بحث في الكورسات
                </Button>
              )}
              {!user ? (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">
                      تسجيل الدخول
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    <Button variant="primary" className="w-full">
                      ابدأ رحلتك الآن
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  {(() => {
                    const primaryDash = getDefaultDashboardForUser(user);
                    return (
                      primaryDash.href !== '/student' && (
                        <Link href={primaryDash.href} onClick={() => setMobileOpen(false)}>
                          <Button variant="gold" className="w-full">
                            {primaryDash.label}
                          </Button>
                        </Link>
                      )
                    );
                  })()}
                  <Link
                    href={requiresPasskeyEnrollment ? '/security/passkey-setup' : '/student'}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Button variant="primary" className="w-full">
                      {requiresPasskeyEnrollment ? 'استكمال تفعيل الحساب' : 'بوابتي التعليمية'}
                    </Button>
                  </Link>
                  <Link href="/notifications" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">
                      الإشعارات والتنبيهات
                    </Button>
                  </Link>
                  <Button variant="ghost" onClick={handleLogout} className="w-full">
                    تسجيل الخروج
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {isUnlocked && (
        <NativeModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          title="ابحث في أكاديمية بوصلة"
        >
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <p className="text-sm text-[#A9B1E0]">
              ابحث باسم الكورس أو التخصص في الدواجن والإنتاج الحيواني والإدارة البيطرية.
            </p>
            <div className="flex gap-2">
              <input
                type="search"
                className={inputClassName}
                placeholder="مثال: الأمن الحيوي، عنابر التسمين، إدارة المبيعات"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Button type="submit" variant="primary">
                بحث
              </Button>
            </div>
          </form>
        </NativeModal>
      )}
    </>
  );
}

export function SiteFooter({ isRolePortal = false }: { isRolePortal?: boolean }) {
  const { user, requiresPasskeyEnrollment } = useAuth();
  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);
  const [showFooterCta, setShowFooterCta] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/catalog/section-visibility', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((map) => {
        if (active && map && map.footerCta === false) {
          setShowFooterCta(false);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-[#8CA2FF]/16 bg-[#070D2B] text-[#A9B1E0]">
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {showFooterCta && (
          <div className="mb-10 flex flex-col gap-5 rounded-2xl bosla-liquid-glass p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                  isRolePortal
                    ? 'border-[#8CA2FF]/25 bg-[#0B1440] text-[#8CA2FF]'
                    : 'border-[#C084FC]/30 bg-[#6B21A8]/18 text-[#C084FC]'
                }`}
              >
                <Compass className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-semibold text-[#EEF0FF] sm:text-lg">
                  جاهز للانتقال من الدراسة النظرية إلى قيادة القطاع؟
                </p>
                <p className="mt-1 text-sm text-[#A9B1E0]">
                  {isUnlocked
                    ? 'افتح لوحة المتدرب الخاصة بك لمتابعة الكورسات والمسارات والدبلومات المفعّلة.'
                    : 'سجّل دخولك الآن لفتح منظومة الكورسات التطبيقية والمسارات المهنية والشهادات الموثقة.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              {isUnlocked ? (
                <>
                  <Link href="/student">
                    <Button variant="primary" size="md">
                      لوحة التعلم الخاصة بك
                    </Button>
                  </Link>
                  <Link href="/courses">
                    <Button variant="outline" size="md">
                      تصفح الكورسات
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register">
                    <Button variant="primary" size="md">
                      ابدأ رحلتك الآن
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="md">
                      تسجيل الدخول
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/brand/bosla-logo.webp"
                alt="شعار بوصلة"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] p-1 object-contain"
              />
              <div>
                <p className="text-base font-semibold text-[#EEF0FF]">أكاديمية بوصلة — BOSLA</p>
                <p className="text-xs font-medium text-[#8CA2FF]">
                  من الطالب إلى المدير — التعليم البيطري والداجني التطبيقي
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-[1.7] text-[#A9B1E0]">
              أول منصة تعليمية متخصصة في الثروة الحيوانية والداجنة والطب البيطري والإدارة التجارية في العالم العربي، لربط الدراسة الجامعية بمتطلبات المزارع والشركات الفعلية.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-medium">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] px-3.5 text-[#EEF0FF] hover:border-[#8CA2FF] hover:text-[#8CA2FF] transition-colors"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] px-3.5 text-[#EEF0FF] hover:border-[#8CA2FF] hover:text-[#8CA2FF] transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://wa.me/201001226683"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#77E2B5]/35 bg-[#0B1440] px-3.5 text-[#77E2B5] hover:border-[#77E2B5] transition-colors"
              >
                تواصل واتساب مباشر
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#EEF0FF]">
              <BookOpen className="h-4 w-4 text-[#8CA2FF]" />
              الأكاديمية والمنهجية
            </p>
            <ul className="space-y-1.5 text-sm">
              {isUnlocked ? (
                <>
                  <li><Link href="/courses" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الكورسات التدريبية</Link></li>
                  <li><Link href="/learning-paths" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">المسارات المهنية</Link></li>
                  <li><Link href="/diplomas" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الدبلومات التطبيقية</Link></li>
                  <li><Link href="/events" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الفعاليات الأوفلاين</Link></li>
                  <li><Link href="/community" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">مجتمع الأسئلة والأجوبة</Link></li>
                </>
              ) : (
                <>
                  <li><Link href="/courses" className="inline-block py-1 hover:text-[#C084FC] transition-colors">الكورسات المعتمدة</Link></li>
                  <li><Link href="/#methodology" className="inline-block py-1 hover:text-[#C084FC] transition-colors">الأركان التشغيلية</Link></li>
                  <li><Link href="/#partners" className="inline-block py-1 hover:text-[#C084FC] transition-colors">شركاؤنا</Link></li>
                  <li><Link href="/#partner-apply" className="inline-block py-1 hover:text-[#C084FC] transition-colors">انضم كشريك</Link></li>
                  <li><Link href="/pricing" className="inline-block py-1 hover:text-[#C084FC] transition-colors">باقات العضوية</Link></li>
                </>
              )}
              <li><Link href="/instructors" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الخبراء والمدربون</Link></li>
              <li><Link href="/certificates/verify" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">التحقق من الشهادات</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#EEF0FF]">
              <Award className="h-4 w-4 text-[#8CA2FF]" />
              البوابات والدعم
            </p>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/certificates/verify" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">التحقق من الشهادات</Link></li>
              <li><Link href="/student" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">بوابة المتدرب</Link></li>
              <li><Link href="/org" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الشركات والمؤسسات B2B</Link></li>
              <li><Link href="/support" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">تذاكر الدعم الفني</Link></li>
              <li><Link href="/recovery" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">استرداد الحساب</Link></li>
              <li><Link href="/#partner-apply" className="inline-block py-1 hover:text-[#C084FC] transition-colors">طلبات الشراكة والتعاون</Link></li>
              <li><Link href="/contact" className="inline-block py-1 hover:text-[#C084FC] transition-colors">التدريب المؤسسي للشركات</Link></li>
              <li><Link href="/about" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">عن أكاديمية بوصلة</Link></li>
              <li><Link href="/privacy" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">سياسة الخصوصية</Link></li>
              <li><Link href="/terms" className="inline-block py-1 hover:text-[#8CA2FF] transition-colors">الشروط والأحكام</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#8CA2FF]/16 pt-6 text-xs sm:text-sm text-[#A9B1E0] sm:flex-row">
          <p className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#8CA2FF]" />
            <span>© {new Date().getFullYear()} أكاديمية بوصلة — BOSLA Academy. جميع الحقوق محفوظة</span>
          </p>
          <p className="text-[#8CA2FF]/85">
            منصة تعليمية متخصصة في الثروة الحيوانية والداجنة والأجريبيزنس
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageLayout({
  children,
  isRolePortal = false,
}: {
  children: React.ReactNode;
  isRolePortal?: boolean;
}) {
  return (
    <div
      className={`flex min-h-screen flex-col ${
        isRolePortal ? 'bg-[#050A24] text-[#EEF0FF]' : 'bosla-public-scope bg-[#050A24] text-[#EEF0FF]'
      }`}
    >
      <SiteHeader isRolePortal={isRolePortal} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter isRolePortal={isRolePortal} />
    </div>
  );
}
