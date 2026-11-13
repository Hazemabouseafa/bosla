'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/primitives';

const PUBLIC_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/courses', label: 'الكورسات' },
  { href: '/learning-paths', label: 'المسارات' },
  { href: '/diplomas', label: 'الدبلومات' },
  { href: '/instructors', label: 'المدربون' },
  { href: '/pricing', label: 'العضويات' },
  { href: '/about', label: 'عن بوصلة' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-bosla-line bg-white/95 backdrop-blur-md">
      <a
        href="#main-content"
        className="visually-hidden focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-xl focus:bg-bosla-amber focus:px-4 focus:py-2 focus:font-bold focus:text-bosla-ink"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-bosla-navy via-bosla-primary to-bosla-purple p-2 shadow-sm">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="شعار أكاديمية بوصلة"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-bosla-navy sm:text-lg">
              أكاديمية بوصلة
            </span>
            <span className="text-xs font-semibold text-bosla-muted">
              من الطالب إلى المدير
            </span>
          </span>
        </Link>

        <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-1">
          {PUBLIC_LINKS.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                  active
                    ? 'bg-indigo-50 text-bosla-primary'
                    : 'text-bosla-ink hover:bg-indigo-50/70 hover:text-bosla-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          {!user && (
            <>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  تسجيل الدخول
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="gold" size="sm">
                  ابدأ رحلتك الآن
                </Button>
              </Link>
            </>
          )}

          {user && requiresPasskeyEnrollment && (
            <Link href="/security/passkey-setup">
              <Button variant="gold" size="sm">
                <ShieldCheck className="h-4 w-4" />
                تأمين الحساب بـ Passkey
              </Button>
            </Link>
          )}

          {user && !requiresPasskeyEnrollment && (
            <>
              {user.role === 'ADMIN' && (
                <Link href="/admin">
                  <Button variant="navy" size="sm">
                    <LayoutDashboard className="h-4 w-4" />
                    لوحة الإدارة
                  </Button>
                </Link>
              )}
              {(user.role === 'INSTRUCTOR' || user.role === 'ADMIN') && (
                <Link href="/instructor">
                  <Button variant="outline" size="sm">
                    <BookOpen className="h-4 w-4" />
                    بوابة المدرب
                  </Button>
                </Link>
              )}
              <Link href="/student">
                <Button variant="primary" size="sm">
                  <GraduationCap className="h-4 w-4" />
                  تعلمي ({user.fullName.split(' ')[0]})
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-bosla-line text-bosla-ink lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="فتح القائمة"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-bosla-line bg-white px-4 py-4 lg:hidden">
          <nav aria-label="قائمة الجوال" className="flex flex-col gap-1.5 mb-4">
            {PUBLIC_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-bold text-bosla-ink hover:bg-indigo-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-bosla-line pt-3">
            {!user ? (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">
                    تسجيل الدخول
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button variant="gold" className="w-full">
                    إنشاء حساب جديد
                  </Button>
                </Link>
              </>
            ) : (
              <>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)}>
                    <Button variant="navy" className="w-full">
                      لوحة الإدارة
                    </Button>
                  </Link>
                )}
                {(user.role === 'INSTRUCTOR' || user.role === 'ADMIN') && (
                  <Link href="/instructor" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">
                      بوابة المدرب
                    </Button>
                  </Link>
                )}
                <Link
                  href={requiresPasskeyEnrollment ? '/security/passkey-setup' : '/student'}
                  onClick={() => setMobileOpen(false)}
                >
                  <Button variant="primary" className="w-full">
                    {requiresPasskeyEnrollment ? 'استكمال Passkey' : 'بوابتي التعليمية'}
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
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-bosla-line bg-bosla-navy text-indigo-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="BOSLA Academy"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl bg-white/10 p-1.5 object-contain"
            />
            <div>
              <p className="text-lg font-extrabold text-white">أكاديمية بوصلة — BOSLA</p>
              <p className="text-xs text-indigo-200">من الطالب إلى المدير — التعليم البيطري والداجني التطبيقي</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-indigo-200 max-w-lg">
            أول منصة تعليمية وتطبيقية متخصصة في الثروة الحيوانية والداجنة والطب البيطري والإدارة التجارية في العالم العربي، تربط الدراسة الجامعية بمتطلبات المزارع والشركات الفعلية.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold">
            <a
              href="https://www.facebook.com/BoslaAgri"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-indigo-400/30 bg-white/10 px-3.5 py-2 text-white hover:bg-white/20"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/bosla_career/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-indigo-400/30 bg-white/10 px-3.5 py-2 text-white hover:bg-white/20"
            >
              Instagram
            </a>
            <a
              href="https://wa.me/201001226683"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-emerald-400/40 bg-bosla-success/20 px-3.5 py-2 text-emerald-100 hover:bg-bosla-success/30"
            >
              تواصل واتساب مباشر
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-white mb-3">التعلم والأكاديمية</h3>
          <ul className="space-y-2 text-sm text-indigo-200">
            <li><Link href="/courses" className="hover:text-white">الكورسات التدريبية</Link></li>
            <li><Link href="/learning-paths" className="hover:text-white">المسارات المهنية</Link></li>
            <li><Link href="/diplomas" className="hover:text-white">الدبلومات المتخصصة</Link></li>
            <li><Link href="/pricing" className="hover:text-white">خطط العضوية الشهرية والسنوية</Link></li>
            <li><Link href="/instructors" className="hover:text-white">نخبة المدربين والخبراء</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-white mb-3">الثقة والدعم</h3>
          <ul className="space-y-2 text-sm text-indigo-200">
            <li><Link href="/certificates/verify" className="hover:text-white inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> التحقق من الشهادات</Link></li>
            <li><Link href="/recovery" className="hover:text-white inline-flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> استرداد الحساب بدون OTP</Link></li>
            <li><Link href="/contact" className="hover:text-white">التدريب المؤسسي للشركات B2B</Link></li>
            <li><Link href="/about" className="hover:text-white">عن أكاديمية بوصلة</Link></li>
            <li><Link href="/privacy" className="hover:text-white">سياسة الخصوصية</Link></li>
            <li><Link href="/terms" className="hover:text-white">الشروط والأحكام</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-indigo-200 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} أكاديمية بوصلة — BOSLA Academy. جميع الحقوق محفوظة.</p>
          <p>بث فيديو مشفر ومستضاف ذاتياً • توثيق Passkey FIDO2 بدون OTP</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
