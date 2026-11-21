'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch, formatDateTime } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { NotificationItem } from './types';

export function NotificationBell({
  darkSurface = false,
}: {
  darkSurface?: boolean;
}) {
  const { user, pushToast } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{
        items: NotificationItem[];
        unreadCount: number;
      }>('/notifications?limit=10');
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silent failure keeps header lightweight on background checks
    }
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const onFocus = () => void loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (evt: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(evt.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!user) return null;

  const handleOpenItem = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.isRead) {
      try {
        await apiFetch(`/notifications/${item.id}/read`, { method: 'POST' });
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // Proceed with navigation
      }
    }
    router.push(item.actionUrl || '/notifications');
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      pushToast('تم تحديد جميع الإشعارات كمقروءة', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الإشعارات', 'error');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void loadNotifications();
        }}
        aria-label={`الإشعارات (${unreadCount} غير مقروء)`}
        aria-expanded={open}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
          darkSurface
            ? 'border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] hover:border-[#8CA2FF] hover:bg-[#18266E]'
            : 'border-[#22307A] bg-[#0B1440] text-[#EEF0FF] hover:border-[#8CA2FF] hover:bg-[#18266E]'
        }`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#FF9CAA] px-1 text-[10px] font-extrabold text-[#070D2B] shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#22307A] bg-[#0F1A4A] text-[#EEF0FF] shadow-blue-card z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#22307A] bg-[#0B1440] px-4 py-3">
            <span className="text-xs font-extrabold text-[#EEF0FF]">
              الإشعارات ({unreadCount} جديد)
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#8CA2FF] hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#22307A]">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#A9B1E0]">
                لا توجد إشعارات جديدة حاليًا.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleOpenItem(item)}
                  className={`w-full text-start px-4 py-3 hover:bg-[#18266E] transition-colors cursor-pointer ${
                    !item.isRead ? 'bg-[#18266E]/70' : 'bg-[#0F1A4A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-extrabold text-[#EEF0FF]">
                      {item.titleAr}
                    </p>
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[#8CA2FF] shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#A9B1E0] line-clamp-2">
                    {item.bodyAr}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-[#A9B1E0]/80">
                    {formatDateTime(item.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#22307A] bg-[#0B1440] px-4 py-2.5 flex items-center justify-between text-xs">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="font-extrabold text-[#8CA2FF] hover:underline"
            >
              عرض كل الإشعارات
            </Link>
            <Link
              href="/student/settings"
              onClick={() => setOpen(false)}
              className="font-bold text-[#A9B1E0] hover:text-[#EEF0FF]"
            >
              تفضيلات الإشعارات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
