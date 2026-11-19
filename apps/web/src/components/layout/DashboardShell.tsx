'use client';

import {
  BookOpen,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { NotificationBell } from '@/components/community/NotificationBell';
import { useAuth } from '@/lib/auth-context';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: string | number;
}

/**
 * Full-Viewport Bento App Dashboard Shell (RTL Arabic):
 * - Start-side dedicated #0F1A4A sidebar with luminous #EEF0FF active pill & bottom CTA card
 * - Minimal integrated Top Workspace Bar (Greeting, Search Pill, Quick Actions, Notification Bell, Avatar, Logout)
 * - Clean mobile slide-over drawer with Escape key focus restoration
 */
export function DashboardShell({
  portalBadge,
  portalTitle,
  portalSubtitle,
  navItems,
  headerActions,
  sidebarFooter,
  sidebarCtaLabel,
  sidebarCtaHref,
  onSidebarCtaClick,
  searchPlaceholder = 'ابحث في البوابة...',
  searchValue,
  onSearchChange,
  onSearchTrigger,
  children,
}: {
  portalBadge: string;
  portalTitle: string;
  portalSubtitle?: string;
  navItems: DashboardNavItem[];
  headerActions?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  sidebarCtaLabel?: string;
  sidebarCtaHref?: string;
  onSidebarCtaClick?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onSearchTrigger?: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeDrawer = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => toggleBtnRef.current?.focus());
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchTrigger) {
      onSearchTrigger();
      return;
    }
    const q = (searchValue ?? localSearch).trim();
    if (q) {
      router.push(`/courses?search=${encodeURIComponent(q)}`);
    }
  };

  const displayInitial = user?.fullName?.trim()?.slice(0, 1) || 'ب';

  return (
    <div className="min-h-dvh bg-[#070D2B] text-[#EEF0FF]">
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-[#050A2A]/80 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        {/* Dedicated Full-Height Dashboard Sidebar (Start edge / Right in RTL) */}
        <aside
          id="dashboard-sidebar-nav"
          className={
            mobileOpen
              ? 'fixed inset-y-0 start-0 z-50 flex w-[min(86vw,272px)] flex-col justify-between overflow-y-auto border-e border-[#22307A] bg-[#0F1A4A] p-4 text-[#EEF0FF] lg:sticky lg:top-0 lg:h-dvh lg:w-[264px] lg:shrink-0 lg:z-auto'
              : 'hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[264px] lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-y-auto border-e border-[#22307A] bg-[#0F1A4A] p-4 text-[#EEF0FF]'
          }
        >
          <div className="space-y-4">
            {/* Brand Lockup Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#22307A]">
              <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/45 bg-[#18266E] p-1.5 shadow-md">
                  <img
                    src="/images/brand/bosla-logo.webp"
                    alt="شعار بوصلة"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#EEF0FF] group-hover:text-[#8CA2FF] transition-colors">
                    أكاديمية بوصلة
                  </p>
                  <p className="truncate text-[11px] font-bold text-[#A9B1E0]">
                    {portalBadge}
                  </p>
                </div>
              </Link>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeDrawer}
                aria-label="إغلاق قائمة البوابة"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF] lg:hidden cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Primary Sidebar Nav with Luminous Off-White Active Pill */}
            <nav aria-label={portalBadge} className={`flex flex-col ${navItems.length > 8 ? 'gap-0.5' : 'gap-1'}`}>
              {navItems.map((item) => {
                const classes = `group flex ${
                  navItems.length > 8 ? 'min-h-[42px] lg:min-h-[36px] py-2 lg:py-1.5' : 'min-h-[42px] py-2'
                } w-full items-center justify-between gap-2 rounded-2xl px-3.5 text-xs sm:text-[13px] font-bold transition-all cursor-pointer ${
                  item.active
                    ? 'bg-[#EEF0FF] text-[#0B1440] font-extrabold shadow-[0_8px_22px_rgba(7,13,43,0.45)]'
                    : 'text-[#A9B1E0] hover:bg-[#18266E]/65 hover:text-[#EEF0FF]'
                }`;

                const inner = (
                  <>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`shrink-0 ${
                          item.active
                            ? 'text-[#4A43D9]'
                            : 'text-[#A9B1E0] group-hover:text-[#8CA2FF]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          item.active
                            ? 'bg-[#4A43D9] text-[#FFFFFF]'
                            : 'border border-[#22307A] bg-[#0B1440] text-[#A9B1E0]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={classes}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      item.onClick?.();
                    }}
                    className={classes}
                  >
                    {inner}
                  </button>
                );
              })}
            </nav>

            {/* Utility Links: Return to Storefront + Switch Portal + Sign Out */}
            <div className="border-t border-[#22307A] pt-3 space-y-1 text-xs">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3.5 py-2 font-bold text-[#A9B1E0] hover:bg-[#18266E]/60 hover:text-[#EEF0FF] transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-[#8CA2FF]" />
                <span>الموقع الرئيسي</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3.5 py-2 font-bold text-[#FF9CAA] hover:bg-[#18266E]/60 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Bottom Promo / Spotlight Card */}
          <div className="mt-5 space-y-3">
            {sidebarFooter && (
              <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs text-[#A9B1E0]">
                {sidebarFooter}
              </div>
            )}

            {(sidebarCtaLabel || sidebarCtaHref || onSidebarCtaClick) && (
              <div className="rounded-2xl border border-[#2C3E99] bg-gradient-to-b from-[#1B286D] to-[#111B4E] p-4 text-center space-y-3">
                <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF0FF]/15 text-[#F5B94A]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold leading-relaxed text-[#EEF0FF]">
                  {user?.role === 'ADMIN'
                    ? 'أدر المحتوى والبرامج والمدربين من مكان واحد'
                    : 'استكمل رحلتك التطبيقية الآن مع نخبة المدربين'}
                </p>
                {onSidebarCtaClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onSidebarCtaClick();
                    }}
                    className="w-full rounded-xl bg-[#EEF0FF] px-3 py-2.5 text-xs font-extrabold text-[#0B1440] shadow-md transition-colors hover:bg-[#FFFFFF] cursor-pointer"
                  >
                    {sidebarCtaLabel || 'إجراء سريع'}
                  </button>
                ) : (
                  <Link
                    href={sidebarCtaHref || '/courses'}
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#EEF0FF] px-3 py-2.5 text-xs font-extrabold text-[#0B1440] shadow-md transition-colors hover:bg-[#FFFFFF]"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{sidebarCtaLabel || 'تصفح الكورسات'}</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Workspace Stage */}
        <div className="min-w-0 flex-1 flex flex-col">
          {/* Top Integrated Workspace Header */}
          <header className="sticky top-0 z-30 border-b border-[#22307A]/70 bg-[#070D2B]/90 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Greeting + Mobile Menu Trigger */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  ref={toggleBtnRef}
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-expanded={mobileOpen}
                  aria-controls="dashboard-sidebar-nav"
                  aria-label="فتح قائمة البوابة"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] hover:border-[#8CA2FF] lg:hidden cursor-pointer"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-[#EEF0FF] truncate">
                    {portalTitle}
                  </h1>
                  {portalSubtitle && (
                    <p className="text-xs text-[#A9B1E0] truncate mt-0.5">{portalSubtitle}</p>
                  )}
                </div>
              </div>

              {/* Search Pill + Portal Actions + Bell + User Avatar + Logout */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <form
                  onSubmit={handleSearchSubmit}
                  className="hidden md:flex relative items-center"
                  role="search"
                  aria-label="بحث سريع في البوابة"
                >
                  <Search className="pointer-events-none absolute start-3 h-4 w-4 text-[#A9B1E0]" />
                  <input
                    type="search"
                    value={searchValue ?? localSearch}
                    onChange={(e) => {
                      if (onSearchChange) onSearchChange(e.target.value);
                      else setLocalSearch(e.target.value);
                    }}
                    onClick={() => {
                      if (!onSearchChange && onSearchTrigger) onSearchTrigger();
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="h-10 w-44 xl:w-56 rounded-xl border border-[#22307A] bg-[#0F1A4A] ps-9 pe-3 text-xs font-semibold text-[#EEF0FF] placeholder:text-[#A9B1E0]/75 focus:border-[#8CA2FF] focus:outline-none"
                  />
                </form>

                {headerActions && <div className="flex flex-wrap items-center gap-2">{headerActions}</div>}

                <NotificationBell darkSurface />

                <Link
                  href="/student/settings"
                  aria-label="الملف الشخصي والإعدادات"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#7C95FF] bg-[#18266E] text-sm font-extrabold text-[#EEF0FF] hover:border-[#EEF0FF] transition-colors"
                >
                  {displayInitial}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="تسجيل الخروج"
                  title="تسجيل الخروج"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#FF9CAA]/60 hover:text-[#FF9CAA] transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Main Dashboard Content Area */}
          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
