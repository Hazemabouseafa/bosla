'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Film,
  HardDrive,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { getVideoStatusMeta } from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Badge, Button, Card, SkeletonBlock } from '@/components/ui/primitives';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Centralized Admin Media Asset Manager:
 * - Lists every uploaded VideoAsset (HLS & raw uploads) with safe cleanup & force unlink
 * - Lists every uploaded Cover Image on VPS storage with usage map & safe cleanup
 */
export function AdminMediaControlPanel({ infrastructure }: { infrastructure?: any }) {
  const { pushToast } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoFilter, setVideoFilter] = useState('ALL');
  const [confirmVideoId, setConfirmVideoId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const [vids, imgs] = await Promise.all([
        apiFetch<any[]>('/admin/media/videos'),
        apiFetch<any[]>('/admin/media/images'),
      ]);
      setVideos(Array.isArray(vids) ? vids : []);
      setImages(Array.isArray(imgs) ? imgs : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل مكتبة الوسائط', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const handleDeleteVideo = async (videoId: string, force = false) => {
    try {
      await apiFetch(`/admin/media/videos/${videoId}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      });
      pushToast('تم حذف أصل الفيديو وملفاته من الخادم بنجاح', 'success');
      setConfirmVideoId(null);
      await loadMedia();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الفيديو', 'error');
    }
  };

  const handleDeleteImage = async (filename: string) => {
    try {
      await apiFetch(`/admin/media/images/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      pushToast('تم حذف ملف الصورة من الخادم', 'success');
      await loadMedia();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الصورة', 'error');
    }
  };

  const copyImageUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      pushToast('تم نسخ رابط الصورة لاستخدامه في أي كورس أو مسار', 'success');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      pushToast('انسخ الرابط يدوياً من المعاينة', 'info');
    }
  };

  const filteredVideos = videos.filter((v) =>
    videoFilter === 'ALL' ? true : v.status === videoFilter,
  );

  const disk = infrastructure?.disk;

  return (
    <div className="space-y-8">
      {/* Infrastructure & Storage Header */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border-[#22307A]">
          <p className="text-xs text-[#A9B1E0] flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-[#8CA2FF]" />
            المساحة المتاحة على القرص
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[#77E2B5]">
            {disk?.freeBytes ? formatBytes(disk.freeBytes) : 'مستقرة'}
          </p>
          {disk?.usedPercent !== undefined && (
            <p className="text-xs text-[#A9B1E0] mt-1">مستخدم {disk.usedPercent}% من السعة</p>
          )}
        </Card>
        <Card className="p-5 border-[#22307A]">
          <p className="text-xs text-[#A9B1E0] flex items-center gap-1.5">
            <Film className="h-4 w-4 text-[#8CA2FF]" />
            إجمالي الفيديوهات المرفوعة
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[#EEF0FF]">{videos.length}</p>
          <p className="text-xs text-[#A9B1E0] mt-1">
            جاهز للبث: {videos.filter((v) => v.status === 'READY').length} • متعثر:{' '}
            {videos.filter((v) => v.status === 'FAILED').length}
          </p>
        </Card>
        <Card className="p-5 border-[#22307A]">
          <p className="text-xs text-[#A9B1E0] flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-[#8CA2FF]" />
            صور الأغلفة المخزنة محلياً
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[#EEF0FF]">{images.length}</p>
          <p className="text-xs text-[#A9B1E0] mt-1">
            غير مستخدمة: {images.filter((i) => !i.inUse).length}
          </p>
        </Card>
      </div>

      {/* Cover Images Library */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#8CA2FF]" />
              مكتبة الصور المرفوعة من الجهاز ({images.length})
            </h2>
            <p className="text-xs text-[#A9B1E0] mt-0.5">
              استعرض الصور المرفوعة، انسخ روابطها، أو احذف الصور غير المرتبطة بأي كورس
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadMedia()}>
            <RefreshCw className="h-4 w-4" />
            تحديث المكتبة
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <SkeletonBlock className="h-52 w-full" />
            <SkeletonBlock className="h-52 w-full" />
            <SkeletonBlock className="h-52 w-full" />
          </div>
        ) : images.length === 0 ? (
          <AlertBanner tone="info">
            لا توجد صور مرفوعة من الجهاز حتى الآن. يمكنك الرفع مباشرة من لوحة تعديل أي كورس.
          </AlertBanner>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.filename}
                className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 space-y-3"
              >
                <img
                  src={img.url}
                  alt={img.filename}
                  className="h-36 w-full rounded-lg object-cover border border-[#22307A]"
                />
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span dir="ltr" className="font-mono text-[#A9B1E0] truncate">
                      {img.filename}
                    </span>
                    <Badge tone={img.inUse ? 'success' : 'neutral'}>
                      {img.inUse ? `مستخدم (${img.usedBy.length})` : 'غير مستخدم'}
                    </Badge>
                  </div>
                  <p className="text-[#A9B1E0] tabular-nums">
                    الحجم: {formatBytes(img.sizeBytes)} •{' '}
                    {formatDate(img.uploadedAt)}
                  </p>
                  {img.inUse && (
                    <p className="text-[#8CA2FF] truncate">{img.usedBy.join(' • ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => void copyImageUrl(img.url)}
                  >
                    {copiedUrl === img.url ? (
                      <Check className="h-3.5 w-3.5 text-[#77E2B5]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedUrl === img.url ? 'تم النسخ' : 'نسخ الرابط'}
                  </Button>
                  {!img.inUse && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDeleteImage(img.filename)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Video Assets Library */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <Film className="h-5 w-5 text-[#8CA2FF]" />
              جميع ملفات الفيديو والأصول التعليمية ({filteredVideos.length})
            </h2>
            <p className="text-xs text-[#A9B1E0] mt-0.5">
              إدارة الفيديوهات المرفوعة ومعالجة البث، وتنظيف الملفات المتعثرة أو غير المستخدمة
            </p>
          </div>
          <select
            aria-label="تصفية الفيديوهات حسب الحالة"
            value={videoFilter}
            onChange={(e) => setVideoFilter(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-xs font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="READY">جاهز للبث</option>
            <option value="PROCESSING">قيد المعالجة</option>
            <option value="UPLOADED">تم الرفع</option>
            <option value="FAILED">متعثر / فشل</option>
          </select>
        </div>

        {filteredVideos.length === 0 ? (
          <p className="text-sm text-[#A9B1E0]">لا توجد فيديوهات مطابقة للتصفية الحالية.</p>
        ) : (
          <div className="space-y-3 text-xs">
            {filteredVideos.map((v) => {
              const vMeta = getVideoStatusMeta(v.status);
              const linkedTotal = (v._count?.lessons ?? 0) + (v._count?.introForCourse ?? 0);
              const confirming = confirmVideoId === v.id;
              return (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-[#EEF0FF]">{v.titleAr}</span>
                      <Badge tone={vMeta.tone}>{vMeta.label}</Badge>
                      <Badge tone={linkedTotal > 0 ? 'info' : 'neutral'}>
                        {linkedTotal > 0 ? `مرتبط بـ ${linkedTotal} موضع` : 'غير مرتبط'}
                      </Badge>
                    </div>
                    <p className="text-[#A9B1E0]">
                      المدرب: {v.instructor?.fullName || 'غير محدد'} • الأصلي:{' '}
                      {formatBytes(v.sourceSizeBytes)} • HLS: {formatBytes(v.hlsTotalBytes)}
                    </p>
                    {v.processingError && (
                      <p className="text-[#FF9CAA]">سبب التعثر: {v.processingError}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {confirming ? (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDeleteVideo(v.id, true)}
                        >
                          {linkedTotal > 0 ? 'فك الارتباط والحذف نهائياً' : 'تأكيد الحذف نهائياً'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmVideoId(null)}
                        >
                          إلغاء
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmVideoId(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                        حذف من الخادم
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
