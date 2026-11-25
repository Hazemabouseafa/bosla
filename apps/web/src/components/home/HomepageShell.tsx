'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  Pause,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';

const HOME_ANCHORS = [
  { href: '#courses-showcase', label: 'المحتوى التعليمي' },
  { href: '#pricing', label: 'الباقات والأسعار' },
  { href: '#trainers', label: 'المدربون' },
  { href: '#partners', label: 'شركاؤنا' },
  { href: '#contact', label: 'التواصل' },
];

const DRAWER_ANCHORS = [
  ...HOME_ANCHORS,
  { href: '#partner-apply', label: 'انضم كشريك' },
];

export function HomepageShell({
  motionPaused,
  onToggleMotion,
  liveConfig,
  careersCount = 0,
  children,
}: {
  motionPaused: boolean;
  onToggleMotion: () => void;
  liveConfig?: any;
  careersCount?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);
  const primaryDash = getDefaultDashboardForUser(user);

  const handleAnchorNav = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    closeDrawer = false,
  ) => {
    if (!href.startsWith('#')) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    if (closeDrawer) setMobileOpen(false);
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 86);
    const dist = Math.abs(top - window.scrollY);
    const reduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    window.scrollTo({
      top,
      behavior: reduced || dist > window.innerHeight * 1.1 ? ('instant' as ScrollBehavior) : 'smooth',
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 28);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeMenu = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    router.refresh();
  };

  const showAnnouncement = Boolean(
    liveConfig?.header?.showAnnouncement && liveConfig?.header?.announcementTextAr,
  );
  const headerCtaLabel =
    liveConfig?.header?.ctaLabelAr ||
    liveConfig?.header?.primaryCtaLabelAr ||
    'ابدأ التأهيل';
  const headerCtaHref =
    liveConfig?.header?.ctaHref ||
    liveConfig?.header?.primaryCtaHref ||
    '/register';
  const careersVisible = liveConfig?.careers?.visible !== false && (careersCount ?? 0) >= 0;
  const careersLabel = liveConfig?.careers?.navLabelAr || 'الوظائف';

  const whatsappRaw = liveConfig?.contact?.whatsapp || '+201001226683';
  const whatsappClean = whatsappRaw.replace(/[^0-9]/g, '') || '201001226683';
  const supportEmail = liveConfig?.contact?.email || 'support@boslaagri.com';

  return (
    <div className="bosla-public-scope bosla-home-scope flex min-h-screen flex-col bg-[#ADD5F0] text-[#17243D]">
      <a
        href="#main-content"
        className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[90] focus:rounded-lg focus:bg-[#4A1FB0] focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      {/* Fixed Translucent Sky-Blue Header Bar */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
          scrolled
            ? 'border-b border-[#4A1FB0]/25 bg-[#98C7E8]/95 backdrop-blur-xl shadow-[0_12px_30px_-18px_rgba(21,35,68,0.22)]'
            : 'border-b border-[#17243D]/12 bg-[#ADD5F0]/92 backdrop-blur-md'
        }`}
      >
        {showAnnouncement && (
          <div className="bg-[#4A1FB0] px-4 py-1.5 text-center text-xs font-bold text-white">
            {liveConfig.header.announcementTextAr}
          </div>
        )}

        <div className="mx-auto flex h-[68px] w-full max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group inline-flex items-center gap-2.5 shrink-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#17243D] p-1.5 shadow-sm transition-transform group-hover:scale-[1.03]">
              <img
                src="/images/brand/bosla-logo.webp"
                alt="شعار أكاديمية بوصلة الرسمي"
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold text-[#17243D] transition-colors group-hover:text-[#4A1FB0] bosla-display-font whitespace-nowrap">
                {liveConfig?.header?.brandNameAr || 'بوصلة'}
              </span>
              <small className="hidden 2xl:inline-block border-s border-[#17243D]/20 ps-2.5 text-xs font-bold text-[#263959] whitespace-nowrap">
                أكاديمية الطب البيطري والإنتاج
              </small>
            </div>
          </Link>

          {/* Desktop Center Navigation Rail */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden lg:flex items-center gap-0.5 rounded-full border border-[#4A1FB0]/22 bg-[#C6E2F5]/90 px-1.5 py-1 min-w-0"
          >
            {HOME_ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorNav(e, item.href)}
                className="rounded-full px-2.5 xl:px-3 py-1.5 text-[0.8rem] xl:text-[0.84rem] font-bold text-[#17243D] transition-colors hover:bg-[#98C7E8] hover:text-[#351078] whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
            <span className="mx-0.5 h-4 w-px bg-[#4A1FB0]/25 shrink-0" aria-hidden="true" />
            <Link
              href="/courses"
              className="rounded-full px-2.5 xl:px-3 py-1.5 text-[0.8rem] xl:text-[0.84rem] font-extrabold text-[#4A1FB0] transition-colors hover:bg-[#FFFFFF] whitespace-nowrap"
            >
              جميع الكورسات
            </Link>
            {careersVisible && (
              <Link
                href="/careers"
                className="hidden xl:inline-block rounded-full px-2.5 py-1.5 text-[0.8rem] font-bold text-[#263959] transition-colors hover:bg-[#98C7E8] hover:text-[#351078] whitespace-nowrap"
              >
                {careersLabel}
              </Link>
            )}
          </nav>

          {/* Right Auth & Accessibility Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleMotion}
              aria-label={motionPaused ? 'تشغيل المؤثرات الحركية' : 'تقليل المؤثرات الحركية'}
              title={motionPaused ? 'تشغيل الحركة' : 'تقليل الحركة'}
              className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#4A1FB0]/28 bg-[#C6E2F5] text-[#17243D] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF] hover:text-[#4A1FB0] cursor-pointer"
            >
              {motionPaused ? (
                <Play className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>

            {!user && (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-[#4A1FB0]/35 bg-[#C6E2F5] px-3.5 md:px-4 text-xs md:text-[0.875rem] font-extrabold text-[#17243D] transition-colors hover:border-[#4A1FB0] hover:bg-[#FFFFFF] whitespace-nowrap"
                >
                  {liveConfig?.header?.loginLabelAr || 'دخول المتدربين'}
                </Link>
                <Link
                  href={headerCtaHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#4A1FB0] px-3.5 md:px-4 text-xs md:text-[0.875rem] font-extrabold text-white transition-colors hover:bg-[#351078] whitespace-nowrap"
                >
                  {headerCtaLabel}
                </Link>
              </>
            )}

            {user && requiresPasskeyEnrollment && (
              <Link
                href="/security/passkey-setup"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#4A1FB0]/35 bg-[#C6E2F5] px-3.5 md:px-4 text-xs md:text-sm font-bold text-[#4A1FB0] transition-colors hover:bg-[#4A1FB0] hover:text-white whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span>استكمال التفعيل</span>
              </Link>
            )}

            {isUnlocked && user && (
              <>
                <Link
                  href={primaryDash.href}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#4A1FB0] px-3.5 md:px-4 text-xs md:text-sm font-bold text-white transition-colors hover:bg-[#351078] whitespace-nowrap"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>دخول البوابة</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="تسجيل الخروج"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#BE123C]/35 bg-[#C6E2F5] text-[#BE123C] transition-colors hover:bg-[#FFF1F2] cursor-pointer"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </>
            )}

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="home-mobile-drawer"
              aria-label="فتح قائمة التنقل"
              className="inline-flex lg:hidden h-11 w-11 items-center justify-center rounded-xl border border-[#4A1FB0]/30 bg-[#C6E2F5] text-[#17243D] cursor-pointer"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            onClick={closeMenu}
            className="absolute inset-0 bg-[#17243D]/48 backdrop-blur-sm"
          />
          <aside
            id="home-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل السريع"
            className="relative flex h-full w-[min(86vw,340px)] flex-col justify-between border-e border-[#4A1FB0]/25 bg-[#ADD5F0] p-5 text-[#17243D]"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#17243D]/14 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#17243D] p-1.5">
                    <img
                      src="/images/brand/bosla-logo.webp"
                      alt="شعار أكاديمية بوصلة"
                      width={24}
                      height={24}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="font-bold text-sm bosla-display-font text-[#17243D]">
                    أكاديمية بوصلة
                  </span>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeMenu}
                  aria-label="إغلاق القائمة"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#4A1FB0]/28 bg-[#C6E2F5] text-[#17243D]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <nav
                aria-label="قائمة الجوال"
                className="flex flex-col divide-y divide-[#17243D]/12 border-y border-[#17243D]/12"
              >
                {DRAWER_ANCHORS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleAnchorNav(e, item.href, true)}
                    className="flex min-h-[48px] items-center justify-between px-2 text-sm font-bold text-[#17243D] hover:bg-[#98C7E8] hover:text-[#351078]"
                  >
                    <span>{item.label}</span>
                    <ArrowLeft className="h-4 w-4 text-[#4A1FB0]" strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ))}
                <Link
                  href="/courses"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-between px-2 text-sm font-extrabold text-[#4A1FB0] hover:bg-[#98C7E8]"
                >
                  <span>كتالوج الكورسات الكامل</span>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/careers"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-between px-2 text-sm font-bold text-[#263959] hover:bg-[#98C7E8] hover:text-[#351078]"
                >
                  <span>{careersLabel}</span>
                  <ArrowLeft className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                </Link>
              </nav>

              <button
                type="button"
                onClick={() => {
                  onToggleMotion();
                  setMobileOpen(false);
                }}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#4A1FB0]/25 bg-[#C6E2F5] px-3.5 text-xs font-extrabold text-[#17243D]"
              >
                <span>{motionPaused ? 'تشغيل المؤثرات الحركية' : 'وضع تقليل الحركة'}</span>
                {motionPaused ? (
                  <Play className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                ) : (
                  <Pause className="h-4 w-4 text-[#4A1FB0]" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="space-y-2.5 border-t border-[#17243D]/14 pt-4">
              {!user ? (
                <>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#4A1FB0] px-4 text-sm font-extrabold text-white"
                  >
                    إنشاء حساب جديد
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-xl border-2 border-[#4A1FB0]/40 bg-[#C6E2F5] px-4 text-sm font-bold text-[#17243D]"
                  >
                    تسجيل الدخول
                  </Link>
                </>
              ) : requiresPasskeyEnrollment ? (
                <Link
                  href="/security/passkey-setup"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#4A1FB0] px-4 text-sm font-extrabold text-white"
                >
                  استكمال تفعيل الحساب
                </Link>
              ) : (
                <>
                  <Link
                    href={primaryDash.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#4A1FB0] px-4 text-sm font-extrabold text-white"
                  >
                    دخول البوابة
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#BE123C]/40 bg-[#C6E2F5] text-sm font-bold text-[#BE123C]"
                  >
                    تسجيل الخروج
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {/* Luminous Sky-Blue Architectural Footer */}
      <footer className="border-t border-[#4A1FB0]/20 bg-[#98C7E8] text-[#17243D]">
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-9">
          <div className="grid gap-10 border-b border-[#17243D]/14 pb-12 md:grid-cols-12">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#17243D] p-2 shadow-sm">
                  <img
                    src="/images/brand/bosla-logo.webp"
                    alt="شعار أكاديمية بوصلة الرسمي"
                    width={32}
                    height={32}
                    className="h-full w-full object-contain"
                  />
                </span>
                <div>
                  <p className="text-base font-extrabold text-[#17243D] bosla-display-font">
                    أكاديمية بوصلة
                  </p>
                  <p className="text-xs font-extrabold text-[#351078]">
                    <bdi>BOSLA Academy</bdi> — التعليم التطبيقي والقيادة الميدانية
                  </p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-[1.8] font-medium text-[#263959]">
                {liveConfig?.footer?.taglineAr ||
                  'منظومة إعداد وتأهيل تطبيقي متخصصة في الطب البيطري وإنتاج الدواجن والثروة الحيوانية وتغذية الحيوان والإدارة التجارية للأجريبيزنس.'}
              </p>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-extrabold text-[#351078]">أقسام الأكاديمية</p>
              <ul className="space-y-1.5 text-sm">
                {DRAWER_ANCHORS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={(e) => handleAnchorNav(e, item.href)}
                      className="inline-block py-1 font-bold text-[#17243D] transition-colors hover:text-[#4A1FB0]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link
                    href="/courses"
                    className="inline-block py-1 font-extrabold text-[#4A1FB0] hover:underline"
                  >
                    جميع الكورسات المعتمدة
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="inline-block py-1 font-bold text-[#263959] hover:text-[#4A1FB0]"
                  >
                    {liveConfig?.footer?.careersLabelAr || 'الوظائف والانضمام إلينا'}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-extrabold text-[#351078]">البوابة والاتصال</p>
              <ul className="space-y-1.5 text-sm">
                {!user ? (
                  <>
                    <li>
                      <Link
                        href="/login"
                        className="inline-block py-1 font-bold text-[#17243D] hover:text-[#4A1FB0]"
                      >
                        تسجيل الدخول للأعضاء
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/register"
                        className="inline-block py-1 font-extrabold text-[#4A1FB0] hover:underline"
                      >
                        إنشاء حساب جديد
                      </Link>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link
                      href={primaryDash.href}
                      className="inline-block py-1 font-extrabold text-[#17243D] hover:text-[#4A1FB0]"
                    >
                      دخول البوابة التعليمية
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href={liveConfig?.footer?.verifyHref || '/certificates/verify'}
                    className="inline-block py-1 font-bold text-[#263959] hover:text-[#4A1FB0]"
                  >
                    {liveConfig?.footer?.verifyLabelAr || 'التحقق من الشهادات والتوصيات'}
                  </Link>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${whatsappClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 py-1 font-extrabold text-[#0F5C4E] hover:underline"
                  >
                    <span>واتساب:</span>
                    <span dir="ltr" className="tabular-nums">
                      +{whatsappClean}
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="inline-block py-1 font-bold text-[#17243D] hover:text-[#4A1FB0]"
                    dir="ltr"
                  >
                    {supportEmail}
                  </a>
                </li>
                <li className="flex flex-wrap items-center gap-4 pt-2 text-xs font-bold text-[#263959]">
                  <Link href="/terms" className="hover:text-[#4A1FB0] underline-offset-4 hover:underline">
                    الشروط والأحكام
                  </Link>
                  <Link href="/privacy" className="hover:text-[#4A1FB0] underline-offset-4 hover:underline">
                    سياسة الخصوصية
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 pt-6 text-xs font-bold text-[#263959] sm:flex-row sm:items-center">
            <p>
              {liveConfig?.footer?.copyrightTextAr ||
                liveConfig?.footer?.copyrightAr ||
                `© ${new Date().getFullYear()} أكاديمية بوصلة (BOSLA Academy). جميع الحقوق محفوظة`}
            </p>
            <p>{liveConfig?.contact?.addressAr || 'القاهرة، جمهورية مصر العربية'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
