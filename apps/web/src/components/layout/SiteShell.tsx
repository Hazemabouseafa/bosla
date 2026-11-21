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

const PUBLIC_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/courses', label: 'الكورسات' },
  { href: '/learning-paths', label: 'المسارات' },
  { href: '/diplomas', label: 'الدبلومات' },
  { href: '/events', label: 'الفعاليات' },
  { href: '/community', label: 'المجتمع' },
  { href: '/instructors', label: 'المدربون' },
  { href: '/pricing', label: 'العضويات' },
  { href: '/about', label: 'عن بوصلة' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      <header className="sticky top-0 z-40 border-b border-[#22307A] bg-[#0B1440] text-[#EEF0FF]">
        <a
          href="#main-content"
          className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-[10px] focus:bg-[#7C95FF] focus:px-4 focus:py-2 focus:font-extrabold focus:text-[#070D2B]"
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
            className="hidden xl:flex items-center gap-2 2xl:gap-3.5"
          >
            {PUBLIC_LINKS.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative whitespace-nowrap py-2.5 text-xs 2xl:text-sm font-bold transition-colors duration-200 ${
                    active
                      ? 'text-[#8CA2FF] font-extrabold'
                      : 'text-[#A9B1E0] hover:text-[#EEF0FF]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-0.5 h-[2.5px] rounded-full bg-[#8CA2FF]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-1.5 xl:gap-2 shrink-0">
            <form
              onSubmit={handleSearchSubmit}
              className={`${user ? 'hidden 2xl:flex' : 'hidden xl:flex'} items-center relative`}
              role="search"
              aria-label="البحث السريع في الكورسات"
            >
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث عن كورس"
                aria-label="ابحث عن كورس"
                className="h-10 w-40 2xl:w-44 rounded-lg border border-[#22307A] bg-[#0F1A4A] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/75 transition-colors duration-150 focus:w-48 focus:border-[#8CA2FF] focus:outline-none"
              />
              <Search className="pointer-events-none absolute start-3 h-4 w-4 text-[#A9B1E0]" />
            </form>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="بحث في الكورسات"
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] transition-colors duration-150 hover:border-[#8CA2FF] hover:text-[#8CA2FF] ${
                user ? '2xl:hidden' : 'xl:hidden'
              } cursor-pointer`}
            >
              <Search className="h-4 w-4" />
            </button>

            {!user && (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-[40px] items-center px-3 text-sm font-medium text-[#A9B1E0] transition-colors hover:text-[#EEF0FF] whitespace-nowrap"
                >
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

            {user && !requiresPasskeyEnrollment && (
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
                            className="whitespace-nowrap !px-2.5 xl:!px-3.5 !text-xs xl:!text-sm !border-[#8CA2FF]/45 !bg-[#18266E] !text-[#8CA2FF] hover:!border-[#8CA2FF]"
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0" />
                            {primaryDash.label}
                          </Button>
                        </Link>
                      )}
                      {allRoles.has('INSTRUCTOR') && primaryDash.href !== '/instructor' && (
                        <Link href="/instructor">
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap !px-2.5 xl:!px-3.5 !text-xs xl:!text-sm"
                          >
                            <BookOpen className="h-4 w-4 shrink-0" />
                            بوابة المدرب
                          </Button>
                        </Link>
                      )}
                      {allRoles.has('AFFILIATE_SELLER') && primaryDash.href !== '/seller' && (
                        <Link href="/seller">
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap !px-2.5 xl:!px-3.5 !text-xs xl:!text-sm"
                          >
                            لوحة البائع
                          </Button>
                        </Link>
                      )}
                    </>
                  );
                })()}
                <Link href="/student">
                  <Button
                    variant="primary"
                    size="sm"
                    className="whitespace-nowrap !px-2.5 xl:!px-3.5 !text-xs xl:!text-sm"
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    تعلمي ({user.fullName.split(' ')[0]})
                  </Button>
                </Link>
                <NotificationBell darkSurface />
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="تسجيل الخروج"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] transition-colors hover:border-[#FF9CAA]/55 hover:text-[#FF9CAA] cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] hover:border-[#8CA2FF] xl:hidden cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="فتح القائمة"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#22307A] bg-[#0B1440] px-4 py-4 xl:hidden">
            <nav aria-label="قائمة الجوال" className="flex flex-col gap-1.5 mb-4">
              {PUBLIC_LINKS.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`min-h-[44px] flex items-center rounded-[10px] px-3.5 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? 'bg-[#7C95FF] text-[#070D2B] font-extrabold'
                        : 'text-[#A9B1E0] hover:bg-[#0F1A4A] hover:text-[#EEF0FF]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2.5 border-t border-[#22307A] pt-3">
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
                    const allRoles = new Set<string>([user.role, ...(user.roles || [])]);
                    return (
                      <>
                        {primaryDash.href !== '/student' && (
                          <Link href={primaryDash.href} onClick={() => setMobileOpen(false)}>
                            <Button variant="gold" className="w-full">
                              {primaryDash.label}
                            </Button>
                          </Link>
                        )}
                        {allRoles.has('INSTRUCTOR') && primaryDash.href !== '/instructor' && (
                          <Link href="/instructor" onClick={() => setMobileOpen(false)}>
                            <Button variant="outline" className="w-full">
                              بوابة المدرب
                            </Button>
                          </Link>
                        )}
                        {allRoles.has('AFFILIATE_SELLER') && primaryDash.href !== '/seller' && (
                          <Link href="/seller" onClick={() => setMobileOpen(false)}>
                            <Button variant="outline" className="w-full">
                              لوحة البائع والعمولات
                            </Button>
                          </Link>
                        )}
                      </>
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
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full"
                  >
                    تسجيل الخروج
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

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
    </>
  );
}

export function SiteFooter() {
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
    <footer className="relative mt-16 overflow-hidden border-t border-[#22307A] bg-[#0B1440] text-[#A9B1E0]">
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {showFooterCta && (
        <div className="mb-10 flex flex-col gap-5 rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/30 bg-[#7C95FF]/15 text-[#8CA2FF]">
              <Compass className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#EEF0FF] sm:text-lg">
                جاهز للانتقال من الدراسة النظرية إلى قيادة القطاع؟
              </p>
              <p className="mt-1 text-sm text-[#A9B1E0]">
                بوصلتك نحو التميز في المزارع، المعامل، وشركات الدواء والتربية في العالم العربي.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link href="/register">
              <Button variant="primary">ابدأ رحلتك الآن</Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline">تصفح الكورسات</Button>
            </Link>
          </div>
        </div>
        )}

        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22307A] bg-[#0F1A4A] p-2">
                <img
                  src="/images/brand/bosla-logo.webp"
                  alt="BOSLA Academy"
                  width={32}
                  height={32}
                  className="h-7 w-7 object-contain"
                />
              </span>
              <div>
                <p className="text-base font-extrabold text-[#EEF0FF]">أكاديمية بوصلة — BOSLA</p>
                <p className="text-sm font-bold text-[#8CA2FF]">
                  من الطالب إلى المدير — التعليم البيطري والداجني التطبيقي
                </p>
              </div>
            </div>
            <p className="text-sm leading-[1.7] text-[#A9B1E0] max-w-lg">
              أول منصة تعليمية وتطبيقية متخصصة في الثروة الحيوانية والداجنة والطب البيطري والإدارة التجارية في العالم العربي، تربط الدراسة الجامعية بمتطلبات المزارع والشركات الفعلية.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 text-sm font-bold">
              <a
                href="https://www.facebook.com/BoslaAgri"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-[10px] border border-[#22307A] bg-[#0F1A4A] px-4 py-2 text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:text-[#8CA2FF]"
              >
                Facebook
              </a>
              <a
                href="https://www.instagram.com/bosla_career/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-[10px] border border-[#22307A] bg-[#0F1A4A] px-4 py-2 text-[#EEF0FF] transition-colors hover:border-[#8CA2FF] hover:text-[#8CA2FF]"
              >
                Instagram
              </a>
              <a
                href="https://wa.me/201001226683"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-[10px] border border-[#8CA2FF]/45 bg-[#7C95FF]/18 px-4 py-2 text-[#8CA2FF] transition-colors hover:bg-[#7C95FF]/28"
              >
                تواصل واتساب مباشر
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#EEF0FF] mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8CA2FF]" />
              التعلم والأكاديمية
            </h3>
            <ul className="space-y-2.5 text-sm text-[#A9B1E0]">
              <li><Link href="/courses" className="hover:text-[#8CA2FF] transition-colors">الكورسات التدريبية</Link></li>
              <li><Link href="/cart" className="hover:text-[#8CA2FF] transition-colors">سلة الشراء والطلبات</Link></li>
              <li><Link href="/learning-paths" className="hover:text-[#8CA2FF] transition-colors">المسارات المهنية</Link></li>
              <li><Link href="/diplomas" className="hover:text-[#8CA2FF] transition-colors">الدبلومات المتخصصة</Link></li>
              <li><Link href="/community" className="hover:text-[#8CA2FF] transition-colors">مجتمع الأسئلة والأجوبة</Link></li>
              <li><Link href="/events" className="hover:text-[#8CA2FF] transition-colors">الفعاليات والكورسات الأوفلاين</Link></li>
              <li><Link href="/pricing" className="hover:text-[#8CA2FF] transition-colors">خطط العضوية الشهرية والسنوية</Link></li>
              <li><Link href="/instructors" className="hover:text-[#8CA2FF] transition-colors">نخبة المدربين والخبراء</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-[#EEF0FF] mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8CA2FF]" />
              الثقة والدعم
            </h3>
            <ul className="space-y-2.5 text-sm text-[#A9B1E0]">
              <li><Link href="/certificates/verify" className="hover:text-[#8CA2FF] transition-colors inline-flex items-center gap-1.5"><Award className="h-4 w-4 text-[#8CA2FF]" /> التحقق من الشهادات</Link></li>
              <li><Link href="/seller" className="hover:text-[#8CA2FF] transition-colors">بوابة البائعين والشركاء</Link></li>
              <li><Link href="/org" className="hover:text-[#8CA2FF] transition-colors">بوابة الشركات والمؤسسات (B2B)</Link></li>
              <li><Link href="/support" className="hover:text-[#8CA2FF] transition-colors">تذاكر الدعم الفني</Link></li>
              <li><Link href="/recovery" className="hover:text-[#8CA2FF] transition-colors inline-flex items-center gap-1.5"><UserCheck className="h-4 w-4 text-[#8CA2FF]" /> استرداد الحساب</Link></li>
              <li><Link href="/contact" className="hover:text-[#8CA2FF] transition-colors">التدريب المؤسسي للشركات</Link></li>
              <li><Link href="/about" className="hover:text-[#8CA2FF] transition-colors">عن أكاديمية بوصلة</Link></li>
              <li><Link href="/privacy" className="hover:text-[#8CA2FF] transition-colors">سياسة الخصوصية</Link></li>
              <li><Link href="/terms" className="hover:text-[#8CA2FF] transition-colors">الشروط والأحكام</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-[#22307A] bg-[#070D2B]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-[#A9B1E0] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} أكاديمية بوصلة — BOSLA Academy. جميع الحقوق محفوظة.</p>
          <p>منصة تعليمية متخصصة في الثروة الحيوانية والداجنة والأجريبيزنس</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#070D2B] text-[#EEF0FF]">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
