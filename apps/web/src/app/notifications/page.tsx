'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { NotificationItem } from '@/components/community/types';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadNotifications = useCallback(
    async (cursor?: string) => {
      if (!user) return;
      if (!cursor) setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '25' });
        if (cursor) params.set('cursor', cursor);
        const res = await apiFetch<{
          items: NotificationItem[];
          unreadCount: number;
          nextCursor: string | null;
        }>(`/notifications?${params.toString()}`);
        setItems((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setUnreadCount(res.unreadCount);
        setNextCursor(res.nextCursor);
      } catch (err: any) {
        pushToast(err?.message || 'تعذر تحميل الإشعارات', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, pushToast],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/notifications');
      return;
    }
    void loadNotifications();
  }, [authLoading, user, router, loadNotifications]);

  const handleOpen = async (item: NotificationItem) => {
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
    router.push(item.actionUrl || '/student');
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
    <PublicPageLayout>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="info">التنبيهات والتفاعل</Badge>
            <h1 className="mt-2 text-2xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <Bell className="h-6 w-6 text-[#8CA2FF]" />
              مركز الإشعارات ({unreadCount} غير مقروء)
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => void handleMarkAllRead()}>
                <CheckCheck className="h-4 w-4" />
                تحديد الكل كمقروء
              </Button>
            )}
            <Link href="/student/settings">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
                إعدادات الإشعارات
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-bold text-bosla-muted">
            جاري تحميل الإشعارات...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="لا توجد إشعارات حتى الآن"
            description="ستصلك هنا إشعارات فورية عند إجابة المدرب أو اعتماد إجابة لسؤالك في الدرس أو مجتمع الكورس."
            action={
              <Link href="/courses">
                <Button variant="primary">استعراض الكورسات</Button>
              </Link>
            }
          />
        ) : (
          <Card className="divide-y divide-[#22307A] overflow-hidden">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleOpen(item)}
                className={`w-full text-start p-5 hover:bg-[#18266E] transition-colors cursor-pointer ${
                  !item.isRead ? 'bg-[#18266E]/65' : 'bg-[#0F1A4A]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-bosla-ink flex items-center gap-2">
                    {!item.isRead && (
                      <span className="h-2.5 w-2.5 rounded-full bg-bosla-primary" />
                    )}
                    {item.titleAr}
                  </p>
                  <span className="text-xs text-bosla-muted">
                    {new Date(item.createdAt).toLocaleString('ar-EG')}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-bosla-muted">{item.bodyAr}</p>
              </button>
            ))}
          </Card>
        )}

        {nextCursor && (
          <div className="text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                void loadNotifications(nextCursor);
              }}
            >
              {loadingMore ? 'جاري التحميل...' : 'عرض إشعارات أقدم'}
            </Button>
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
