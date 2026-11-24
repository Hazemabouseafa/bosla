'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Download,
  Lock,
  RefreshCw,
  Sparkles,
  Subtitles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { apiFetch, formatDurationSeconds } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { VideoChunkUploader } from '@/components/instructor/VideoChunkUploader';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

export default function InstructorVideosPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Caption management modal state (strictly WebVTT subtitles — zero searchable transcripts)
  const [captionVideo, setCaptionVideo] = useState<any | null>(null);
  const [captionTracks, setCaptionTracks] = useState<any[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [langCode, setLangCode] = useState('ar');
  const [labelAr, setLabelAr] = useState('العربية');
  const [isDefaultTrack, setIsDefaultTrack] = useState(true);
  const [vttContent, setVttContent] = useState(
    'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nمرحباً بكم في محاضرة أكاديمية بوصلة\n',
  );
  const [savingCaption, setSavingCaption] = useState(false);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const list = await apiFetch<any[]>('/instructor/videos');
      setVideos(list);
    } finally {
      setLoading(false);
    }
  };

  const loadCaptionsForVideo = async (videoId: string) => {
    setCaptionsLoading(true);
    try {
      const list = await apiFetch<any[]>(`/instructor/videos/${encodeURIComponent(videoId)}/captions`);
      setCaptionTracks(Array.isArray(list) ? list : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل مسارات الترجمة', 'error');
    } finally {
      setCaptionsLoading(false);
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

  const handleToggleDownloadable = async (v: any) => {
    try {
      const nextVal = !v.isDownloadable;
      await apiFetch(`/instructor/videos/${encodeURIComponent(v.id)}/download-policy`, {
        method: 'PATCH',
        body: JSON.stringify({ isDownloadable: nextVal }),
      });
      pushToast(
        nextVal
          ? 'تم السماح بتنزيل ملف الفيديو للمتدربين المسجلين'
          : 'تم قفل تنزيل ملف الفيديو والاكتفاء بالبث المشفّر',
        'info',
      );
      await loadVideos();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث صلاحية التحميل', 'error');
    }
  };

  const handleOpenCaptionsModal = (v: any) => {
    setCaptionVideo(v);
    void loadCaptionsForVideo(v.id);
  };

  const handleSaveManualVtt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captionVideo) return;
    setSavingCaption(true);
    try {
      await apiFetch(`/instructor/videos/${encodeURIComponent(captionVideo.id)}/captions`, {
        method: 'POST',
        body: JSON.stringify({
          language: langCode.trim(),
          labelAr: labelAr.trim(),
          vttContent,
          isDefault: isDefaultTrack,
          isPublished: true,
        }),
      });
      pushToast('تم حفظ ونشر مسار الترجمة WebVTT بنجاح', 'success');
      await loadCaptionsForVideo(captionVideo.id);
    } catch (err: any) {
      pushToast(err?.message || 'تحقق من صيغة ملف WebVTT', 'error');
    } finally {
      setSavingCaption(false);
    }
  };

  const handleTriggerAutoCaption = async () => {
    if (!captionVideo) return;
    setSavingCaption(true);
    try {
      const created = await apiFetch<any>(
        `/instructor/videos/${encodeURIComponent(captionVideo.id)}/captions/auto-generate`,
        {
          method: 'POST',
          body: JSON.stringify({
            language: langCode.trim() || 'ar',
            labelAr: labelAr.trim() || 'العربية (تلقائي)',
          }),
        },
      );
      if (created?.status === 'BLOCKED') {
        pushToast('التوليد التلقائي متوقف لعدم تفعيل محرك Whisper المحلي — يمكنك رفع ملف WebVTT يدوياً', 'info');
      } else {
        pushToast('تم إدراج مهمة توليد الترجمة التلقائية في طابور المعالجة المحلي', 'success');
      }
      await loadCaptionsForVideo(captionVideo.id);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر بدء التوليد التلقائي', 'error');
    } finally {
      setSavingCaption(false);
    }
  };

  const handleDeleteCaption = async (lang: string) => {
    if (!captionVideo) return;
    try {
      await apiFetch(
        `/instructor/videos/${encodeURIComponent(captionVideo.id)}/captions/${encodeURIComponent(lang)}`,
        { method: 'DELETE' },
      );
      pushToast('تم حذف مسار الترجمة', 'info');
      await loadCaptionsForVideo(captionVideo.id);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الترجمة', 'error');
    }
  };

  const handleVttFileSelect = async (file: File) => {
    const text = await file.text();
    setVttContent(text);
  };

  const navItems: DashboardNavItem[] = [
    { id: 'overview', label: 'كورساتي والمجتمعات', icon: <Compass className="h-4 w-4" />, href: '/instructor' },
    {
      id: 'videos',
      label: 'مكتبة الفيديوهات',
      icon: <Video className="h-4 w-4" />,
      href: '/instructor/videos',
      active: true,
    },
  ];

  return (
    <DashboardShell
      portalBadge="بوابة المدرب"
      portalTitle="مكتبة الفيديوهات والرفع والترجمات"
      portalSubtitle="رفع الفيديوهات وتجهيزها للبث التكيفي متعدد الجودات وإدارة الترجمات المصاحبة وصلاحيات التنزيل"
      navItems={navItems}
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Link href="/instructor">
            <Button variant="outline" size="sm">
              ← العودة إلى بوابة المدرب
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void loadVideos()}>
            <RefreshCw className="h-4 w-4" />
            تحديث حالة المعالجة
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <VideoChunkUploader onUploaded={() => void loadVideos()} />

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#EEF0FF]">
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
                      {formatDurationSeconds(v.durationSeconds || 0)} • الجودات:{' '}
                      {Array.isArray(v.qualities) && v.qualities.length > 0
                        ? v.qualities.map((q: any) => q.name || q.label).join(' / ')
                        : 'قيد التحليل'}
                    </p>
                    <p dir="ltr" className="font-mono text-[11px] text-bosla-muted mt-0.5">
                      ID: {v.id}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleDownloadable(v)}
                    >
                      {v.isDownloadable ? (
                        <>
                          <Download className="h-3.5 w-3.5 text-[#77E2B5]" />
                          التحميل مسموح
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          محمي من التحميل
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCaptionsModal(v)}
                    >
                      <Subtitles className="h-3.5 w-3.5 text-[#C084FC]" />
                      الترجمات (WebVTT)
                    </Button>

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
                        ? 'جاهز للعرض'
                        : v.status === 'FAILED'
                          ? 'فشل التجهيز'
                          : `قيد التجهيز ${v.processingProgress ?? 0}%`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <NativeModal
          open={Boolean(captionVideo)}
          onClose={() => setCaptionVideo(null)}
          title={`إدارة الترجمة المصاحبة (WebVTT) — ${captionVideo?.titleAr || ''}`}
        >
          <div className="space-y-4">
            <AlertBanner tone="info">
              تُعرض ملفات WebVTT داخل مشغّل الفيديو كترجمة متزامنة فقط (Subtitles) مع حماية الروابط بتوقيع مؤقت، ولا يتم فهرستها كنصوص قابلة للبحث العام.
            </AlertBanner>

            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#EEF0FF]">
                المسارات المسجّلة ({captionTracks.length})
              </p>
              {captionsLoading ? (
                <p className="text-xs text-[#A9B1E0]">جاري التحميل...</p>
              ) : captionTracks.length === 0 ? (
                <p className="text-xs text-[#A9B1E0]">لا توجد ملفات ترجمة مضافة لهذا الفيديو بعد.</p>
              ) : (
                <div className="space-y-2">
                  {captionTracks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#EEF0FF]">{t.labelAr}</span>
                          <code dir="ltr" className="text-[#8CA2FF]">
                            ({t.language})
                          </code>
                          {t.isDefault && <Badge tone="purple">افتراضي</Badge>}
                          <Badge
                            tone={
                              t.status === 'READY'
                                ? 'success'
                                : t.status === 'BLOCKED'
                                  ? 'warning'
                                  : t.status === 'FAILED'
                                    ? 'danger'
                                    : 'info'
                            }
                          >
                            {t.status === 'READY'
                              ? `جاهز (${t.cueCount} مقطع)`
                              : t.status === 'BLOCKED'
                                ? 'متوقف (يتطلب محرك محلي)'
                                : t.status === 'FAILED'
                                  ? 'فشل التوليد'
                                  : 'قيد المعالجة'}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCaption(t.language)}
                          className="inline-flex items-center gap-1 text-[#FF9CAA] hover:underline font-bold"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      </div>
                      {t.errorMessageAr && (
                        <p className="text-[11px] text-[#F5B94A] leading-relaxed">
                          {t.errorMessageAr}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveManualVtt} className="space-y-3 border-t border-[#22307A] pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="رمز اللغة (مثل ar أو en)" required>
                  <input
                    dir="ltr"
                    className={inputClassName}
                    value={langCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLangCode(val);
                      if (val === 'en') setLabelAr('English');
                      if (val === 'ar') setLabelAr('العربية');
                    }}
                    required
                  />
                </Field>
                <Field label="اسم اللغة الظاهر للمتدرب" required>
                  <input
                    className={inputClassName}
                    value={labelAr}
                    onChange={(e) => setLabelAr(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="inline-flex items-center gap-2 text-[#EEF0FF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefaultTrack}
                    onChange={(e) => setIsDefaultTrack(e.target.checked)}
                  />
                  <span>تعيين كلغة ترجمة افتراضية عند بدء الدرس</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-[#22307A] bg-[#0F1A4A] px-3 py-1.5 font-bold text-[#8CA2FF] hover:border-[#8CA2FF]">
                  <Upload className="h-3.5 w-3.5" />
                  استيراد ملف .vtt من جهازك
                  <input
                    type="file"
                    accept=".vtt,text/vtt"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleVttFileSelect(f);
                    }}
                  />
                </label>
              </div>

              <Field label="محتوى ملف WebVTT القياسي" required>
                <textarea
                  dir="ltr"
                  rows={6}
                  className={`${textareaClassName} font-mono text-xs`}
                  value={vttContent}
                  onChange={(e) => setVttContent(e.target.value)}
                  required
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingCaption}
                  onClick={() => void handleTriggerAutoCaption()}
                >
                  <Sparkles className="h-4 w-4 text-[#C084FC]" />
                  توليد تلقائي محلي (Whisper CLI)
                </Button>

                <Button type="submit" variant="primary" disabled={savingCaption}>
                  {savingCaption ? 'جاري الحفظ...' : 'حفظ ونشر ملف WebVTT'}
                </Button>
              </div>
            </form>
          </div>
        </NativeModal>
      </div>
    </DashboardShell>
  );
}
