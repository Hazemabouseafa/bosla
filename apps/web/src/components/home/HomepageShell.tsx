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
  { href: '#courses-showcase', label: 'الكورسات' },
  { href: '#methodology', label: 'الأركان التشغيلية' },
  { href: '#partners', label: 'شركاؤنا' },
  { href: '#partner-apply', label: 'انضم كشريك' },
  { href: '#contact', label: 'التواصل' },
];

export function HomepageShell({
  motionPaused,
  onToggleMotion,
  children,
}: {
  motionPaused: boolean;
  onToggleMotion: () => void;
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

  const handleAnchorNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string, closeDrawer = false) => {
    if (!href.startsWith('#')) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    if (closeDrawer) setMobileOpen(false);
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 64);
    const reduced =
      motionPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 36);
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

  return (
    <div className="bosla-public-scope bosla-home-scope flex min-h-screen flex-col bg-[#050A24] text-[#EEF0FF]">
      <a
        href="#main-content"
        className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[90] focus:rounded-lg focus:bg-[#6B21A8] focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      {/* Fixed Translucent Navigation Rail */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[height,background-color,border-color,box-shadow] duration-300 ${
          scrolled
            ? 'h-[62px] border-b border-[#C084FC]/22 bg-[#050A24]/94 backdrop-blur-xl shadow-[0_10px_32px_-12px_rgba(2,5,22,0.85)]'
            : 'h-[72px] border-b border-[#8CA2FF]/12 bg-gradient-to-b from-[#050A24]/90 to-[#050A24]/25 backdrop-blur-md'
        }`}
        style={{ paddingInline: 'clamp(16px, 4vw, 52px)' }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1360px] items-center justify-between gap-4">
          <Link href="/" className="group inline-flex items-center gap-2.5 shrink-0">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="شعار أكاديمية بوصلة الرسمي"
              width={36}
              height={36}
              className="h-[28px] md:h-[32px] w-auto object-contain"
            />
            <span className="text-base font-bold text-[#EEF0FF] transition-colors group-hover:text-[#C084FC] bosla-display-font">
              بوصلة
            </span>
            <small className="hidden xl:inline-block border-s border-[#22307A] ps-2.5 text-xs font-medium text-[#A9B1E0]">
              أكاديمية الطب البيطري والإنتاج
            </small>
          </Link>

          {/* Desktop Center Anchors & Public Courses Route */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden lg:flex items-center gap-1 rounded-full border border-[#8CA2FF]/16 bg-[#070D2B]/80 px-2 py-1 backdrop-blur-md"
          >
            {HOME_ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorNav(e, item.href)}
                className="rounded-full px-3.5 py-1.5 text-[0.84rem] font-semibold text-[#C2CAF2] transition-colors hover:bg-[#6B21A8]/22 hover:text-[#EEF0FF] whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
            <span className="mx-1 h-4 w-px bg-[#22307A]" aria-hidden="true" />
            <Link
              href="/courses"
              className="rounded-full px-3.5 py-1.5 text-[0.84rem] font-bold text-[#C084FC] transition-colors hover:bg-[#6B21A8]/25 hover:text-[#E9D5FF] whitespace-nowrap"
            >
              جميع الكورسات
            </Link>
          </nav>

          {/* Right Auth & Accessibility Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleMotion}
              aria-label={motionPaused ? 'تشغيل المؤثرات الحركية' : 'تقليل المؤثرات الحركية'}
              title={motionPaused ? 'تشغيل الحركة' : 'تقليل الحركة'}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#8CA2FF]/25 bg-[#070D2B]/75 text-[#C2CAF2] transition-colors hover:border-[#C084FC] hover:text-[#C084FC] cursor-pointer"
            >
              {motionPaused ? (
                <Play className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>

            {!user && (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#8CA2FF]/28 bg-[#070D2B]/80 px-3.5 md:px-4 text-xs md:text-[0.875rem] font-semibold text-[#EEF0FF] transition-colors hover:border-[#C084FC] hover:bg-[#0F1A4A] whitespace-nowrap"
                >
                  دخول المتدربين
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#C084FC]/40 bg-[#6B21A8] px-3.5 md:px-4 text-xs md:text-[0.875rem] font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87] whitespace-nowrap"
                >
                  ابدأ التأهيل
                </Link>
              </>
            )}

            {user && requiresPasskeyEnrollment && (
              <Link
                href="/security/passkey-setup"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C084FC]/45 bg-[#6B21A8]/20 px-3.5 md:px-4 text-xs md:text-sm font-bold text-[#E9D5FF] transition-colors hover:bg-[#6B21A8]/35 whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                <span>استكمال التفعيل</span>
              </Link>
            )}

            {isUnlocked && user && (
              <>
                <Link
                  href={primaryDash.href}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C084FC]/40 bg-[#6B21A8] px-3.5 md:px-4 text-xs md:text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] whitespace-nowrap"
                >
                  <LayoutDashboard className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
                  <span>دخول البوابة</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="تسجيل الخروج"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#070D2B]/70 text-[#FF9CAA] transition-colors hover:border-[#FF9CAA]/55 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
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
              className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#070D2B]/80 text-[#EEF0FF] cursor-pointer"
            >
              <Menu className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
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
            className="absolute inset-0 bg-[#050A24]/85 backdrop-blur-sm"
          />
          <aside
            id="home-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل السريع"
            className="relative flex h-full w-[min(86vw,340px)] flex-col justify-between border-e border-[#22307A] bg-[#070D2B] p-5 text-[#EEF0FF]"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#22307A] pb-4">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/images/brand/bosla-logo.webp"
                    alt="شعار أكاديمية بوصلة"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="font-bold text-sm bosla-display-font">أكاديمية بوصلة</span>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeMenu}
                  aria-label="إغلاق القائمة"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#22307A] bg-[#0B1440] text-[#EEF0FF]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <nav aria-label="قائمة الجوال" className="flex flex-col divide-y divide-[#22307A] border-y border-[#22307A]">
                {HOME_ANCHORS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleAnchorNav(e, item.href, true)}
                    className="flex min-h-[48px] items-center justify-between px-2 text-sm font-semibold text-[#C2CAF2] hover:bg-[#0F1A4A] hover:text-[#EEF0FF]"
                  >
                    <span>{item.label}</span>
                    <ArrowLeft className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
                  </a>
                ))}
                <Link
                  href="/courses"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[48px] items-center justify-between px-2 text-sm font-bold text-[#C084FC] hover:bg-[#0F1A4A]"
                >
                  <span>كتالوج الكورسات الكامل</span>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
              </nav>

              <button
                type="button"
                onClick={() => {
                  onToggleMotion();
                  setMobileOpen(false);
                }}
                className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-[#22307A] bg-[#0B1440] px-3.5 text-xs font-semibold text-[#C2CAF2]"
              >
                <span>{motionPaused ? 'تشغيل المؤثرات الحركية' : 'وضع تقليل الحركة'}</span>
                {motionPaused ? (
                  <Play className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
                ) : (
                  <Pause className="h-4 w-4 text-[#C084FC]" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="space-y-2.5 border-t border-[#22307A] pt-4">
              {!user ? (
                <>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#6B21A8] px-4 text-sm font-bold text-white"
                  >
                    إنشاء حساب جديد
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-lg border border-[#8CA2FF]/35 bg-[#0B1440] px-4 text-sm font-semibold text-[#EEF0FF]"
                  >
                    تسجيل الدخول
                  </Link>
                </>
              ) : requiresPasskeyEnrollment ? (
                <Link
                  href="/security/passkey-setup"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#6B21A8] px-4 text-sm font-bold text-white"
                >
                  استكمال تفعيل الحساب
                </Link>
              ) : (
                <>
                  <Link
                    href={primaryDash.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#6B21A8] px-4 text-sm font-bold text-white"
                  >
                    دخول البوابة
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#FF9CAA]/35 text-sm font-semibold text-[#FF9CAA]"
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

      {/* Architectural Horizon Footer */}
      <footer className="border-t border-[#22307A] bg-[#050A24] text-[#C2CAF2]">
        <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-9">
          <div className="grid gap-10 border-b border-[#22307A] pb-12 md:grid-cols-12">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/images/brand/bosla-logo.webp"
                  alt="شعار أكاديمية بوصلة الرسمي"
                  width={42}
                  height={42}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="text-base font-bold text-[#EEF0FF] bosla-display-font">أكاديمية بوصلة</p>
                  <p className="text-xs font-medium text-[#C084FC]">
                    <bdi>BOSLA Academy</bdi> — التعليم التطبيقي والقيادة الميدانية
                  </p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-[1.8] text-[#A9B1E0]">
                منظومة إعداد وتأهيل تطبيقي متخصصة في الطب البيطري وإنتاج الدواجن والثروة الحيوانية وتغذية الحيوان والإدارة التجارية للأجريبيزنس.
              </p>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-bold text-[#C084FC]">أقسام الأكاديمية</p>
              <ul className="space-y-2 text-sm">
                {HOME_ANCHORS.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="inline-block py-1 transition-colors hover:text-[#EEF0FF]">
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/courses" className="inline-block py-1 font-semibold text-[#C084FC] hover:underline">
                    جميع الكورسات المعتمدة
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-bold text-[#C084FC]">البوابة والاتصال</p>
              <ul className="space-y-2 text-sm">
                {!user ? (
                  <>
                    <li>
                      <Link href="/login" className="inline-block py-1 font-semibold text-[#EEF0FF] hover:text-[#C084FC]">
                        تسجيل الدخول للأعضاء
                      </Link>
                    </li>
                    <li>
                      <Link href="/register" className="inline-block py-1 font-semibold text-[#C084FC] hover:underline">
                        إنشاء حساب جديد
                      </Link>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link href={primaryDash.href} className="inline-block py-1 font-semibold text-[#EEF0FF] hover:text-[#C084FC]">
                      دخول البوابة التعليمية
                    </Link>
                  </li>
                )}
                <li>
                  <a
                    href="https://wa.me/201001226683"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 py-1 text-[#77E2B5] hover:underline"
                  >
                    <span>واتساب:</span>
                    <span dir="ltr" className="tabular-nums">+20 100 122 6683</span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@boslaagri.com"
                    className="inline-block py-1 hover:text-[#EEF0FF]"
                    dir="ltr"
                  >
                    support@boslaagri.com
                  </a>
                </li>
                <li className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#A9B1E0]">
                  <Link href="/terms" className="hover:text-[#EEF0FF] underline-offset-4 hover:underline">
                    الشروط والأحكام
                  </Link>
                  <Link href="/privacy" className="hover:text-[#EEF0FF] underline-offset-4 hover:underline">
                    سياسة الخصوصية
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 pt-6 text-xs text-[#A9B1E0] sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} أكاديمية بوصلة (<bdi>BOSLA Academy</bdi>). جميع الحقوق محفوظة</p>
            <p>القاهرة، جمهورية مصر العربية</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
