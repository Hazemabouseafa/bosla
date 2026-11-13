'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { apiFetch, formatDurationSeconds } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { VideoChunkUploader } from '@/components/instructor/VideoChunkUploader';
import { Badge, Button, Card } from '@/components/ui/primitives';

export default function InstructorVideosPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const list = await apiFetch<any[]>('/instructor/videos');
      setVideos(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/instructor/videos');
      return;
    }
    if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
      router.replace('/student');
      return;
    }
    void loadVideos();
  }, [authLoading, user, router]);

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/instructor" className="text-xs font-extrabold text-bosla-primary hover:underline">
              ← العودة إلى بوابة المدرب
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-bosla-ink">
              مكتبة الفيديوهات المستضافة ذاتياً (HLS)
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadVideos()}>
            <RefreshCw className="h-4 w-4" />
            تحديث حالة المعالجة
          </Button>
        </div>

        <VideoChunkUploader onUploaded={() => void loadVideos()} />

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-bosla-ink">
            الفيديوهات المرفوعة ({videos.length})
          </h2>
          {loading ? (
            <p className="text-xs text-bosla-muted">جاري التحميل...</p>
          ) : videos.length === 0 ? (
            <p className="text-xs text-bosla-muted">لم ترفع أي فيديو بعد.</p>
          ) : (
            <div className="space-y-3">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bosla-line p-4"
                >
                  <div>
                    <p className="text-sm font-extrabold text-bosla-ink">{v.titleAr}</p>
                    <p className="text-xs text-bosla-muted mt-0.5">
                      الملف: {v.originalFilename} • المدة:{' '}
                      {formatDurationSeconds(v.durationSeconds || 0)} •{' '}
                      الجودات:{' '}
                      {Array.isArray(v.qualities) && v.qualities.length > 0
                        ? v.qualities.map((q: any) => q.name).join(' / ')
                        : 'قيد التحليل'}
                    </p>
                    <p dir="ltr" className="font-mono text-[11px] text-slate-400 mt-0.5">
                      ID: {v.id}
                    </p>
                  </div>
                  <Badge
                    tone={
                      v.status === 'READY'
                        ? 'success'
                        : v.status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {v.status === 'READY'
                      ? 'جاهز للبث HLS'
                      : v.status === 'FAILED'
                      ? 'فشل التحويل'
                      : `قيد التحويل ${v.processingProgress ?? 0}%`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
