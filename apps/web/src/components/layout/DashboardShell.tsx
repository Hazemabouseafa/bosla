'use client';

import {
  BookOpen,
  Compass,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { NotificationBell } from '@/components/community/NotificationBell';
import { useAuth } from '@/lib/auth-context';
import { DashboardAccordionNav, DashboardThemeToggle } from './DashboardAccordionNav';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: string | number;
  group?: string;
  children?: DashboardNavItem[];
}

/**
 * Full-Viewport Bento App Dashboard Shell (RTL Arabic):
 * - Start-side dedicated #0F1A4A sidebar (or flat administrative control rail in variant="admin")
 * - Integrated Workspace Header + clean mobile slide-over drawer with Escape key focus restoration
 */
export function DashboardShell({
  portalBadge,
  portalTitle,
  portalSubtitle,
  breadcrumbLabel,
  variant = 'default',
  navItems,
  headerActions,
  sidebarFooter,
  sidebarCtaLabel,
  sidebarCtaHref,
  onSidebarCtaClick,
  searchPlaceholder = 'بحث في البوابة',
  searchValue,
  onSearchChange,
  onSearchTrigger,
  children,
}: {
  portalBadge: string;
  portalTitle: string;
  portalSubtitle?: string;
  breadcrumbLabel?: string;
  variant?: 'default' | 'admin';
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
  const isAdminVariant = variant === 'admin';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const sidebarCollapseKey = `bosla_sidebar_collapsed_${isAdminVariant ? 'admin' : 'portal'}`;

  useEffect(() => {
    try {
      setDesktopCollapsed(localStorage.getItem(sidebarCollapseKey) === 'true');
    } catch {
      setDesktopCollapsed(false);
    }
  }, [sidebarCollapseKey]);

  const toggleDesktopCollapse = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(sidebarCollapseKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
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
    <div
      className={`bosla-dash-root min-h-dvh ${
        isAdminVariant ? 'bosla-admin-scope bg-[#050A24] text-[#EEF0FF]' : 'bg-[#070D2B] text-[#EEF0FF]'
      }`}
    >
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-[#050A24]/80 backdrop-blur-md lg:hidden"
        />
      )}

      <div className={`mx-auto flex min-h-dvh ${isAdminVariant ? 'max-w-[1720px]' : 'max-w-[1640px]'}`}>
        {/* Dedicated Full-Height Academy Sidebar (Start edge / Right in RTL) */}
        <aside
          id="dashboard-sidebar-nav"
          className={
            mobileOpen
              ? `bosla-dash-sidebar fixed inset-y-0 start-0 z-50 flex w-[min(86vw,276px)] flex-col justify-between overflow-y-auto border-e border-[#8CA2FF]/15 ${
                  isAdminVariant ? 'bg-[#070D2B]' : 'bg-[#0B1440]/95 backdrop-blur-xl'
                } p-3.5 text-[#EEF0FF] lg:sticky lg:top-0 lg:h-dvh ${
                  desktopCollapsed ? 'lg:w-[76px]' : 'lg:w-[276px]'
                } lg:shrink-0 lg:z-auto`
              : `bosla-dash-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-dvh ${
                  desktopCollapsed ? 'lg:w-[76px]' : 'lg:w-[276px]'
                } lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-y-auto border-e border-[#8CA2FF]/15 ${
                  isAdminVariant ? 'bg-[#070D2B]' : 'bg-[#0B1440]/95'
                } p-3.5 text-[#EEF0FF] transition-[width] duration-200`
          }
        >
          <div className="space-y-4">
            {/* Brand Lockup Header */}
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#8CA2FF]/15">
              <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
                <span className="bosla-dash-brand-badge inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] p-1.5 shadow-[inset_0_1px_0_rgba(238,240,255,0.08)]">
                  <img
                    src="/images/brand/bosla-logo.webp"
                    alt="شعار بوصلة"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                {!desktopCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#EEF0FF] group-hover:text-[#8CA2FF] transition-colors">
                      أكاديمية بوصلة
                    </p>
                    <p className="truncate text-[11px] font-medium text-[#A9B1E0]">
                      {portalBadge}
                    </p>
                  </div>
                )}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleDesktopCollapse}
                  aria-label={desktopCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                  title={desktopCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
                  className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF] cursor-pointer"
                >
                  {desktopCollapsed ? (
                    <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeDrawer}
                  aria-label="إغلاق قائمة البوابة"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#8CA2FF] hover:text-[#EEF0FF] lg:hidden cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Primary Collapsible 2-Level Accordion Sidebar Nav */}
            <DashboardAccordionNav
              portalBadge={portalBadge}
              storageKey={`bosla_sidebar_open_${isAdminVariant ? 'admin' : portalBadge}`}
              navItems={navItems}
              isAdminVariant={isAdminVariant}
              collapsed={desktopCollapsed}
              onSelectItem={() => setMobileOpen(false)}
            />

            {/* Utility Links: Return to Storefront + Sign Out */}
            <div className="border-t border-[#8CA2FF]/15 pt-3 space-y-1 text-xs">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-[#A9B1E0] hover:bg-[#18266E]/55 hover:text-[#EEF0FF] transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-[#8CA2FF]" />
                <span>الموقع الرئيسي</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-[#FF9CAA] hover:bg-[#18266E]/55 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Bottom Footer Info & Non-Admin Spotlight Promo */}
          <div className="mt-5 space-y-3">
            {sidebarFooter && (
              <div className="rounded-xl border border-[#8CA2FF]/15 bg-[#0F1A4A]/85 p-3 text-xs text-[#A9B1E0]">
                {sidebarFooter}
              </div>
            )}

            {!isAdminVariant && (sidebarCtaLabel || sidebarCtaHref || onSidebarCtaClick) && (
              <div className="bosla-liquid-glass rounded-xl p-4 text-center space-y-3">
                <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] text-[#8CA2FF]">
                  <Compass className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium leading-relaxed text-[#A9B1E0]">
                  {user?.role === 'ADMIN'
                    ? 'إدارة المحتوى والبرامج والمدربين'
                    : 'استكمال المسارات والكورسات التطبيقية'}
                </p>
                {onSidebarCtaClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onSidebarCtaClick();
                    }}
                    className="w-full rounded-lg bg-[#EEF0FF] px-3 py-2 text-xs font-semibold text-[#070D2B] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-colors hover:bg-[#FFFFFF] cursor-pointer"
                  >
                    {sidebarCtaLabel || 'إجراء سريع'}
                  </button>
                ) : (
                  <Link
                    href={sidebarCtaHref || '/courses'}
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#EEF0FF] px-3 py-2 text-xs font-semibold text-[#070D2B] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-colors hover:bg-[#FFFFFF]"
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
          <header
            className={`bosla-dash-header sticky top-0 z-30 border-b border-[#8CA2FF]/16 ${
              isAdminVariant ? 'bg-[#070D2B]/95 backdrop-blur-md' : 'bg-[#070D2B]/90 backdrop-blur-xl'
            } px-4 py-3 sm:px-6 lg:px-8`}
          >
            <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
              {/* Page Context Title + Mobile Menu Trigger */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  ref={toggleBtnRef}
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-expanded={mobileOpen}
                  aria-controls="dashboard-sidebar-nav"
                  aria-label="فتح قائمة البوابة"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#EEF0FF] hover:border-[#8CA2FF] lg:hidden cursor-pointer"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  {breadcrumbLabel && (
                    <p className="text-[11px] font-semibold text-[#8CA2FF] truncate">
                      {breadcrumbLabel}
                    </p>
                  )}
                  <h1 className="text-base sm:text-xl font-bold text-[#EEF0FF] truncate">
                    {portalTitle}
                  </h1>
                  {portalSubtitle && (
                    <p className="hidden sm:block text-xs text-[#A9B1E0] truncate mt-0.5">{portalSubtitle}</p>
                  )}
                </div>
              </div>

              {/* Search Input + Portal Actions + Bell + User Avatar + Logout */}
              <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 sm:gap-2">
                {!onSearchTrigger && (
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
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="h-10 w-32 2xl:w-44 rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A]/90 ps-9 pe-3 text-xs font-medium text-[#EEF0FF] placeholder:text-[#A9B1E0]/75 focus:border-[#8CA2FF] focus:outline-none"
                    />
                  </form>
                )}

                {headerActions && <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5">{headerActions}</div>}

                <DashboardThemeToggle />

                <NotificationBell darkSurface />

                <Link
                  href="/student/settings"
                  aria-label="الملف الشخصي والإعدادات"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8CA2FF]/50 bg-[#18266E] text-sm font-semibold text-[#EEF0FF] hover:border-[#EEF0FF] transition-colors"
                >
                  {displayInitial}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="تسجيل الخروج"
                  title="تسجيل الخروج"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0] hover:border-[#FF9CAA]/60 hover:text-[#FF9CAA] transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Main Dashboard Content Area */}
          <main id="main-content" className="min-w-0 w-full flex-1 overflow-x-clip px-4 py-5 sm:px-6 lg:px-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
