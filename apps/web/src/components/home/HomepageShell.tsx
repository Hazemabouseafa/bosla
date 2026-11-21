'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Pause,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDefaultDashboardForUser } from '@/lib/labels';

const INTRO_ANCHORS = [
  { href: '#about-bosla', label: 'تعرّف على بوصلة' },
  { href: '#philosophy', label: 'الفلسفة التطبيقية' },
  { href: '#fields', label: 'مجالات الأثر' },
  { href: '#contact', label: 'تواصل معنا' },
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);
  const primaryDash = getDefaultDashboardForUser(user);

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
    <div className="bosla-home-scope flex min-h-screen flex-col bg-[#050A24] text-[#EEF0FF]">
      <a
        href="#main-content"
        className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[90] focus:rounded-lg focus:bg-[#7C95FF] focus:px-4 focus:py-2.5 focus:font-semibold focus:text-[#070D2B]"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      {/* Scoped Editorial Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#8CA2FF]/15 bg-[#050A24]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 shrink-0">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="شعار أكاديمية بوصلة"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold text-[#EEF0FF] transition-colors group-hover:text-[#8CA2FF]">
                أكاديمية بوصلة
              </span>
              <span dir="ltr" className="text-[11px] font-medium tracking-wide text-[#A9B1E0]">
                BOSLA Academy
              </span>
            </span>
          </Link>

          <nav aria-label="أقسام الصفحة التعريفية" className="hidden lg:flex items-center gap-7">
            {INTRO_ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="bosla-home-link py-2 text-sm font-medium text-[#C2CAF2] hover:text-[#EEF0FF]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleMotion}
              aria-pressed={motionPaused}
              aria-label={motionPaused ? 'تشغيل المؤثرات الحركية' : 'إيقاف المؤثرات الحركية'}
              title={motionPaused ? 'تشغيل الحركة' : 'تقليل الحركة'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#A9B1E0] transition-colors hover:border-[#8CA2FF] hover:text-[#EEF0FF] cursor-pointer"
            >
              {motionPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>

            {!user && (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-[#C2CAF2] transition-colors hover:text-[#EEF0FF]"
                >
                  <Lock className="h-3.5 w-3.5 text-[#8CA2FF]" />
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#7C95FF] px-4 text-sm font-bold text-[#070D2B] transition-colors hover:bg-[#93A8FF]"
                >
                  <span>إنشاء حساب</span>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </>
            )}

            {user && requiresPasskeyEnrollment && (
              <Link
                href="/security/passkey-setup"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#F5B94A]/50 bg-[#F5B94A]/15 px-4 text-sm font-bold text-[#F5B94A] transition-colors hover:bg-[#F5B94A]/25"
              >
                <ShieldCheck className="h-4 w-4" />
                استكمال تفعيل الحساب
              </Link>
            )}

            {isUnlocked && user && (
              <>
                <Link
                  href={primaryDash.href}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#EEF0FF] px-4 text-sm font-bold text-[#070D2B] transition-colors hover:bg-white"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  دخول البوابة
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="تسجيل الخروج"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#FF9CAA] transition-colors hover:border-[#FF9CAA]/50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={onToggleMotion}
              aria-pressed={motionPaused}
              aria-label={motionPaused ? 'تشغيل المؤثرات الحركية' : 'إيقاف المؤثرات الحركية'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#A9B1E0]"
            >
              {motionPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="home-mobile-drawer"
              aria-label="فتح قائمة التنقل"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#8CA2FF]/25 bg-[#0B1440] text-[#EEF0FF]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={closeMenu}
            className="absolute inset-0 bg-[#050A24]/85 backdrop-blur-sm"
          />
          <aside
            id="home-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة بوصلة التعريفية"
            className="relative flex h-full w-[min(86vw,340px)] flex-col justify-between border-e border-[#8CA2FF]/20 bg-[#070D2B] p-5 text-[#EEF0FF]"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#8CA2FF]/15 pb-4">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/images/brand/bosla-logo.webp"
                    alt="شعار أكاديمية بوصلة"
                    width={34}
                    height={34}
                    className="h-8 w-8 object-contain"
                  />
                  <span className="font-bold text-sm">أكاديمية بوصلة</span>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeMenu}
                  aria-label="إغلاق القائمة"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#EEF0FF]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {INTRO_ANCHORS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] items-center justify-between rounded-xl px-3.5 text-sm font-semibold text-[#C2CAF2] hover:bg-[#0F1A4A] hover:text-[#EEF0FF]"
                  >
                    <span>{item.label}</span>
                    <ArrowLeft className="h-4 w-4 text-[#8CA2FF]" />
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-2.5 border-t border-[#8CA2FF]/15 pt-4">
              {!user ? (
                <>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#7C95FF] px-4 text-sm font-bold text-[#070D2B]"
                  >
                    إنشاء حساب
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#8CA2FF]/25 bg-[#0B1440] px-4 text-sm font-semibold text-[#EEF0FF]"
                  >
                    تسجيل الدخول
                  </Link>
                </>
              ) : requiresPasskeyEnrollment ? (
                <Link
                  href="/security/passkey-setup"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5B94A] px-4 text-sm font-bold text-[#070D2B]"
                >
                  استكمال تفعيل الحساب
                </Link>
              ) : (
                <>
                  <Link
                    href={primaryDash.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#EEF0FF] px-4 text-sm font-bold text-[#070D2B]"
                  >
                    دخول البوابة
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#FF9CAA]/35 text-sm font-semibold text-[#FF9CAA]"
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

      {/* Signature Architectural Footer — Zero Excluded Catalog/Pricing Links */}
      <footer className="relative overflow-hidden border-t border-[#8CA2FF]/15 bg-[#050A24] text-[#C2CAF2]">
        <div className="mx-auto max-w-7xl px-4 pt-14 pb-8 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/images/brand/bosla-logo.webp"
                  alt="شعار أكاديمية بوصلة الرسمي"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                />
                <div>
                  <p className="text-lg font-bold text-[#EEF0FF]">أكاديمية بوصلة</p>
                  <p className="text-xs font-medium text-[#8CA2FF]">من الطالب إلى المدير — BOSLA Academy</p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-[1.85] text-[#A9B1E0]">
                معهد تطبيقي يربط بين الفهم العلمي المتعمق والقدرة على إدارة التشغيل واتخاذ القرار في المزارع وشركات الإنتاج الحيواني والداجني والطب البيطري.
              </p>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8CA2FF]">استكشف الأكاديمية</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#about-bosla" className="inline-block py-1 transition-colors hover:text-[#EEF0FF]">
                    تعرّف على بوصلة
                  </a>
                </li>
                <li>
                  <a href="#philosophy" className="inline-block py-1 transition-colors hover:text-[#EEF0FF]">
                    المعرفة والأثر العملي
                  </a>
                </li>
                <li>
                  <a href="#fields" className="inline-block py-1 transition-colors hover:text-[#EEF0FF]">
                    مجالات التخصص والقطاع
                  </a>
                </li>
                <li>
                  <a href="#contact" className="inline-block py-1 transition-colors hover:text-[#EEF0FF]">
                    تواصل معنا
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8CA2FF]">الحساب والاتصال والضوابط</p>
              <ul className="space-y-2 text-sm">
                {!user ? (
                  <>
                    <li>
                      <Link href="/login" className="inline-block py-1 text-[#EEF0FF] font-semibold hover:text-[#8CA2FF]">
                        تسجيل الدخول
                      </Link>
                    </li>
                    <li>
                      <Link href="/register" className="inline-block py-1 text-[#EEF0FF] font-semibold hover:text-[#8CA2FF]">
                        إنشاء حساب
                      </Link>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link href={primaryDash.href} className="inline-block py-1 text-[#EEF0FF] font-semibold hover:text-[#8CA2FF]">
                      دخول البوابة التعليمية
                    </Link>
                  </li>
                )}
                <li>
                  <a
                    href="https://wa.me/201001226683"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block py-1 text-[#77E2B5] hover:underline"
                  >
                    واتساب رسمي: +20 100 122 6683
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

          {/* Grounded Closing Row */}
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[#8CA2FF]/15 pt-6 text-xs text-[#A9B1E0] sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} أكاديمية بوصلة — BOSLA Academy. جميع الحقوق محفوظة.</p>
            <p>القاهرة، جمهورية مصر العربية</p>
          </div>
        </div>

        {/* Monumental Architectural Wordmark anchored safely at the floor */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none border-t border-[#8CA2FF]/10 bg-[#070D2B]/65 py-6 text-center overflow-hidden"
        >
          <p className="bosla-display-font mx-auto max-w-7xl px-4 text-[clamp(2.5rem,7.5vw,6.75rem)] leading-[1.2] text-[#EEF0FF]/[0.11]">
            أكاديمية بوصلة
          </p>
        </div>
      </footer>
    </div>
  );
}
