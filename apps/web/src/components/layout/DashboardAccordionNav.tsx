'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import type { DashboardNavItem } from './DashboardShell';

export interface DashboardAccordionGroup {
  id: string;
  label: string;
  items: DashboardNavItem[];
}

export function DashboardThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const sync = () => {
      try {
        const stored = localStorage.getItem('bosla_dashboard_theme');
        const next = stored === 'light' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.dataset.boslaDashTheme = next;
      } catch {
        setTheme('dark');
      }
    };
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bosla_dashboard_theme') sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('bosla_dashboard_theme', next);
    } catch {
      // Ignore storage quota / privacy mode error
    }
    document.documentElement.dataset.boslaDashTheme = next;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === 'light'}
      aria-label={theme === 'light' ? 'التبديل إلى الوضع الليلي' : 'التبديل إلى الوضع النهاري'}
      title={theme === 'light' ? 'التبديل إلى الوضع الليلي' : 'التبديل إلى الوضع النهاري'}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#8CA2FF]/25 bg-[#0F1A4A] px-3 text-xs font-semibold text-[#EEF0FF] hover:border-[#8CA2FF] transition-colors cursor-pointer"
    >
      {theme === 'light' ? (
        <>
          <Moon className="h-4 w-4 text-[#1536B5]" aria-hidden="true" />
          <span className="hidden sm:inline">داكن</span>
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 text-[#F5B94A]" aria-hidden="true" />
          <span className="hidden sm:inline">نهاري</span>
        </>
      )}
    </button>
  );
}

export function DashboardAccordionNav({
  portalBadge,
  storageKey,
  navItems,
  isAdminVariant,
  collapsed = false,
  onSelectItem,
}: {
  portalBadge: string;
  storageKey: string;
  navItems: DashboardNavItem[];
  isAdminVariant: boolean;
  collapsed?: boolean;
  onSelectItem?: () => void;
}) {
  const baseId = useId();

  // Build ordered 2-level groups preserving item order
  const groupedStructure = useMemo(() => {
    const groups: DashboardAccordionGroup[] = [];
    const ungrouped: DashboardNavItem[] = [];
    const groupIndexByLabel = new Map<string, number>();

    for (const item of navItems) {
      if (item.children && item.children.length > 0) {
        groups.push({ id: item.id, label: item.label, items: item.children });
        continue;
      }
      if (item.group) {
        const existingIdx = groupIndexByLabel.get(item.group);
        if (existingIdx !== undefined) {
          groups[existingIdx]!.items.push(item);
        } else {
          groupIndexByLabel.set(item.group, groups.length);
          groups.push({ id: `grp-${item.group}`, label: item.group, items: [item] });
        }
      } else {
        ungrouped.push(item);
      }
    }

    return { groups, ungrouped };
  }, [navItems]);

  const activeGroupIds = useMemo(
    () =>
      groupedStructure.groups
        .filter((g) => g.items.some((child) => Boolean(child.active)))
        .map((g) => g.id),
    [groupedStructure],
  );

  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore saved open groups + auto-open active parent on mount / navigation change
  useEffect(() => {
    let saved: string[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) saved = parsed.filter((x) => typeof x === 'string');
      }
    } catch {
      saved = [];
    }

    const merged = new Set<string>(
      saved.length > 0
        ? saved
        : groupedStructure.groups.slice(0, 2).map((g) => g.id),
    );
    for (const actId of activeGroupIds) {
      merged.add(actId);
    }

    setOpenGroups(Array.from(merged));
    setHydrated(true);
  }, [storageKey, groupedStructure.groups, activeGroupIds]);

  // Keep active parent group expanded whenever route/history transitions
  useEffect(() => {
    if (!hydrated || activeGroupIds.length === 0) return;
    setOpenGroups((prev) => {
      const missing = activeGroupIds.filter((id) => !prev.includes(id));
      if (missing.length === 0) return prev;
      const next = [...prev, ...missing];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [hydrated, activeGroupIds, storageKey]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const isOpen = prev.includes(groupId);
      const next = isOpen ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const renderLeafItem = (item: DashboardNavItem) => {
    const activeClass = isAdminVariant
      ? 'bg-[#1536B5]/20 text-[#EEF0FF] border-s-[3px] border-[#4A1FB0] font-semibold'
      : 'bg-[#EEF0FF] text-[#070D2B] font-semibold shadow-[0_8px_20px_-10px_rgba(238,240,255,0.45)]';

    const idleClass = isAdminVariant
      ? 'border-s-[3px] border-transparent font-medium text-[#A9B1E0] hover:bg-[#0D1746] hover:text-[#EEF0FF]'
      : 'font-medium text-[#A9B1E0] hover:bg-[#18266E]/60 hover:text-[#EEF0FF]';

    const classes = `group relative flex min-h-[40px] py-2 w-full items-center justify-between gap-2 ${
      isAdminVariant ? 'rounded-e-xl' : 'rounded-xl'
    } ${collapsed ? 'px-2 justify-center' : 'px-3'} text-xs sm:text-[13px] transition-[color,background-color,border-color] duration-150 cursor-pointer ${
      item.active ? activeClass : idleClass
    }`;

    const content = (
      <>
        <span className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
          <span
            className={`inline-flex w-4 shrink-0 items-center justify-center ${
              item.active
                ? isAdminVariant
                  ? 'text-[#8CA2FF]'
                  : 'text-[#070D2B]'
                : 'text-[#A9B1E0] group-hover:text-[#8CA2FF]'
            }`}
          >
            {item.icon}
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </span>
        {!collapsed && item.badge !== undefined && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
              item.active
                ? isAdminVariant
                  ? 'bg-[#1536B5]/30 text-[#EEF0FF]'
                  : 'bg-[#070D2B]/10 text-[#070D2B]'
                : 'border border-[#8CA2FF]/20 bg-[#0F1A4A] text-[#A9B1E0]'
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
          aria-current={item.active ? 'page' : undefined}
          title={collapsed ? item.label : undefined}
          onClick={() => onSelectItem?.()}
          className={classes}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        aria-current={item.active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        onClick={() => {
          onSelectItem?.();
          item.onClick?.();
        }}
        className={classes}
      >
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={portalBadge} className="flex flex-col gap-1.5">
      {groupedStructure.ungrouped.length > 0 && (
        <div className="space-y-1">{groupedStructure.ungrouped.map(renderLeafItem)}</div>
      )}

      {groupedStructure.groups.map((grp) => {
        const isOpen = collapsed ? false : openGroups.includes(grp.id);
        const hasActiveChild = grp.items.some((c) => Boolean(c.active));
        const panelId = `${baseId}-${grp.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        if (collapsed) {
          return (
            <div key={grp.id} className="space-y-1 border-t border-[#8CA2FF]/12 pt-1.5">
              {grp.items.map(renderLeafItem)}
            </div>
          );
        }

        return (
          <div key={grp.id} className="rounded-xl border border-[#8CA2FF]/12 bg-[#09123A]/55 overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleGroup(grp.id)}
              className={`flex min-h-[40px] w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                hasActiveChild
                  ? 'text-[#EEF0FF] bg-[#1536B5]/18'
                  : 'text-[#C2CAF2] hover:bg-[#0F1A4A]/80 hover:text-[#EEF0FF]'
              }`}
            >
              <span className="truncate">{grp.label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="rounded bg-[#0F1A4A] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#8CA2FF]">
                  {grp.items.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[#8CA2FF] transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </span>
            </button>

            <div
              id={panelId}
              hidden={!isOpen}
              className="px-1.5 pb-1.5 pt-0.5 space-y-0.5"
            >
              {grp.items.map(renderLeafItem)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
