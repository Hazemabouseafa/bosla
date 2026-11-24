'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileVideo,
  Loader2,
  RefreshCw,
  UploadCloud,
  Wrench,
  XCircle,
} from 'lucide-react';
import { apiFetch, API_BASE_URL, ensureCsrfToken, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
} from '@/components/ui/primitives';

const CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB chunks for reliable resumable progress

export interface UploadedVideoReadyMeta {
  videoAssetId: string;
  titleAr: string;
  filename: string;
  durationSeconds: number;
  status: string;
}

interface UploadQueueItem {
  localId: string;
  file: File;
  titleAr: string;
  stage:
    | 'PENDING'
    | 'UPLOADING'
    | 'UPLOADED_PROCESSING'
    | 'READY'
    | 'FAILED'
    | 'CANCELLED';
  uploadPercent: number;
  sessionId?: string;
  videoAssetId?: string;
  durationSeconds?: number;
  availableQualities?: string[];
  errorMessage?: string;
}

function formatFileSizeAr(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ك.ب`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} ميجابايت`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
}

export function VideoChunkUploader({
  onCompleted,
  onUploaded,
  onBatchItemReady,
  allowMultiple = true,
  compact = false,
}: {
  onCompleted?: (videoAssetId?: string, meta?: UploadedVideoReadyMeta) => void;
  onUploaded?: () => void;
  onBatchItemReady?: (meta: UploadedVideoReadyMeta) => void;
  allowMultiple?: boolean;
  compact?: boolean;
}) {
  const { pushToast } = useAuth();
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const notifiedReadyIdsRef = useRef<Set<string>>(new Set());

  const hasActiveUploads = queue.some((item) => item.stage === 'UPLOADING');

  // Protect against accidental page navigation while chunks are actively uploading
  useEffect(() => {
    if (!hasActiveUploads) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        'يوجد رفع فيديو جارٍ حالياً. مغادرة الصفحة ستؤدي إلى إيقاف استكمال رفع الأجزاء المتبقية.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActiveUploads]);

  // Poll post-upload HLS processing status until READY or FAILED
  useEffect(() => {
    const processingItems = queue.filter(
      (item) => item.stage === 'UPLOADED_PROCESSING' && item.videoAssetId,
    );
    if (processingItems.length === 0) return;

    const timer = window.setInterval(async () => {
      for (const item of processingItems) {
        if (!item.videoAssetId) continue;
        try {
          const diag = await apiFetch<{
            videoAssetId: string;
            status: string;
            playbackReady?: boolean;
            readyForPlayback?: boolean;
            durationSeconds: number;
            availableQualities: string[];
            failureReason: string | null;
          }>(`/instructor/videos/${item.videoAssetId}/diagnostics`);

          const isReady =
            diag.status === 'READY' &&
            (diag.playbackReady !== false && diag.readyForPlayback !== false);

          if (isReady) {
            setQueue((prev) =>
              prev.map((q) =>
                q.localId === item.localId
                  ? {
                      ...q,
                      stage: 'READY',
                      durationSeconds: diag.durationSeconds,
                      availableQualities: diag.availableQualities,
                    }
                  : q,
              ),
            );

            if (!notifiedReadyIdsRef.current.has(item.localId)) {
              notifiedReadyIdsRef.current.add(item.localId);
              const meta: UploadedVideoReadyMeta = {
                videoAssetId: item.videoAssetId,
                titleAr: item.titleAr,
                filename: item.file.name,
                durationSeconds: diag.durationSeconds || 0,
                status: 'READY',
              };
              onBatchItemReady?.(meta);
              onCompleted?.(item.videoAssetId, meta);
              onUploaded?.();
            }
          } else if (diag.status === 'FAILED') {
            setQueue((prev) =>
              prev.map((q) =>
                q.localId === item.localId
                  ? {
                      ...q,
                      stage: 'FAILED',
                      errorMessage:
                        diag.failureReason ||
                        'تعذر تحويل الفيديو إلى بث تكيفي HLS. يمكنك الضغط على إعادة تجهيز الفيديو.',
                    }
                  : q,
              ),
            );
          }
        } catch {
          // Keep polling quietly
        }
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [queue, onBatchItemReady, onCompleted]);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const additions: UploadQueueItem[] = files.map((file, idx) => ({
      localId: `vq_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      file,
      titleAr: stripExtension(file.name) || `درس فيديو ${queue.length + idx + 1}`,
      stage: 'PENDING',
      uploadPercent: 0,
    }));

    setQueue((prev) => (allowMultiple ? [...prev, ...additions] : additions.slice(0, 1)));
  };

  const uploadSingleItem = async (item: UploadQueueItem) => {
    cancelledIdsRef.current.delete(item.localId);
    setQueue((prev) =>
      prev.map((q) =>
        q.localId === item.localId
          ? { ...q, stage: 'UPLOADING', uploadPercent: 1, errorMessage: undefined }
          : q,
      ),
    );

    try {
      const totalChunks = Math.max(1, Math.ceil(item.file.size / CHUNK_SIZE_BYTES));
      const cleanTitle =
        item.titleAr.trim() || stripExtension(item.file.name) || 'درس فيديو';
      const initRes = await apiFetch<{
        sessionId: string;
        totalChunks?: number;
        videoAsset?: { id: string };
      }>('/instructor/videos/uploads/initiate', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: cleanTitle,
          filename: item.file.name,
          mimeType: item.file.type || 'video/mp4',
          totalBytes: item.file.size,
          chunkSizeBytes: CHUNK_SIZE_BYTES,
        }),
      });

      const sessionId = initRes.sessionId ?? (initRes as any).session?.id;

      setQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId ? { ...q, sessionId } : q,
        ),
      );

      const csrf = await ensureCsrfToken();

      for (let idx = 0; idx < totalChunks; idx += 1) {
        if (cancelledIdsRef.current.has(item.localId)) {
          return;
        }

        const start = idx * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, item.file.size);
        const slice = item.file.slice(start, end);

        const chunkRes = await fetch(
          `${API_BASE_URL}/instructor/videos/uploads/${sessionId}/chunk?chunkIndex=${idx}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Chunk-Index': String(idx),
              ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
            },
            body: slice,
          },
        );

        if (!chunkRes.ok) {
          throw new Error(`تعذر رفع الجزء رقم ${idx + 1} من الملف (${chunkRes.status})`);
        }

        const pct = Math.min(98, Math.round(((idx + 1) / totalChunks) * 95));
        setQueue((prev) =>
          prev.map((q) => (q.localId === item.localId ? { ...q, uploadPercent: pct } : q)),
        );
      }

      if (cancelledIdsRef.current.has(item.localId)) {
        return;
      }

      const completeRes = await apiFetch<{
        id?: string;
        videoAssetId?: string;
        status: string;
        durationSeconds?: number;
      }>(`/instructor/videos/uploads/${sessionId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ titleAr: cleanTitle }),
      });

      const resolvedAssetId = completeRes.id ?? completeRes.videoAssetId;

      // Strictly distinguish "اكتمل الرفع" (UPLOADED_PROCESSING) from "جاهز للتشغيل" (READY)
      setQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId
            ? {
                ...q,
                videoAssetId: resolvedAssetId,
                uploadPercent: 100,
                durationSeconds: completeRes.durationSeconds,
                stage:
                  completeRes.status === 'READY' ? 'READY' : 'UPLOADED_PROCESSING',
              }
            : q,
        ),
      );

      if (
        completeRes.status === 'READY' &&
        resolvedAssetId &&
        !notifiedReadyIdsRef.current.has(item.localId)
      ) {
        notifiedReadyIdsRef.current.add(item.localId);
        const meta: UploadedVideoReadyMeta = {
          videoAssetId: resolvedAssetId,
          titleAr: cleanTitle,
          filename: item.file.name,
          durationSeconds: completeRes.durationSeconds || 0,
          status: 'READY',
        };
        onBatchItemReady?.(meta);
        onCompleted?.(resolvedAssetId, meta);
        onUploaded?.();
      }

      pushToast(
        `اكتمل رفع "${item.titleAr}" وجارٍ تجهيز الجودات واستخراج المدة تلقائياً`,
        'info',
      );
    } catch (err: any) {
      if (cancelledIdsRef.current.has(item.localId)) return;
      setQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId
            ? {
                ...q,
                stage: 'FAILED',
                errorMessage: err?.message || 'حدث خطأ أثناء رفع ملف الفيديو.',
              }
            : q,
        ),
      );
      pushToast(err?.message || 'فشل رفع الفيديو', 'error');
    }
  };

  const handleStartUploadQueue = async () => {
    const pending = queue.filter((q) => q.stage === 'PENDING' || q.stage === 'FAILED');
    if (pending.length === 0 || isRunningQueue) return;
    setIsRunningQueue(true);
    try {
      for (const item of pending) {
        if (cancelledIdsRef.current.has(item.localId)) continue;
        await uploadSingleItem(item);
      }
    } finally {
      setIsRunningQueue(false);
    }
  };

  const handleCancelItem = async (item: UploadQueueItem) => {
    cancelledIdsRef.current.add(item.localId);
    setQueue((prev) =>
      prev.map((q) =>
        q.localId === item.localId
          ? { ...q, stage: 'CANCELLED', errorMessage: 'تم إلغاء الرفع بواسطة المستخدم.' }
          : q,
      ),
    );
    if (item.sessionId) {
      try {
        await apiFetch(`/instructor/videos/uploads/${item.sessionId}/cancel`, {
          method: 'POST',
        });
      } catch {
        // Non-fatal cleanup
      }
    }
  };

  const handleRetranscodeItem = async (item: UploadQueueItem) => {
    if (!item.videoAssetId) return;
    setQueue((prev) =>
      prev.map((q) =>
        q.localId === item.localId
          ? { ...q, stage: 'UPLOADED_PROCESSING', errorMessage: undefined }
          : q,
      ),
    );
    try {
      await apiFetch(`/instructor/videos/${item.videoAssetId}/retranscode`, {
        method: 'POST',
      });
      pushToast('تم بدء إعادة تجهيز الفيديو بجودات HLS متعددة', 'info');
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId
            ? {
                ...q,
                stage: 'FAILED',
                errorMessage: err?.message || 'تعذر إعادة تجهيز الفيديو.',
              }
            : q,
        ),
      );
    }
  };

  const pendingOrFailedCount = queue.filter(
    (q) => q.stage === 'PENDING' || q.stage === 'FAILED',
  ).length;

  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-slate-100">
            {allowMultiple
              ? 'رفع الفيديوهات دفعة واحدة أو منفردة (تجهيز البث التكيفي HLS)'
              : 'رفع فيديو جديد مجزأ (Chunked Resumable Upload)'}
          </h3>
        </div>
        {queue.length > 0 && (
          <Badge tone="info">
            {formatNumber(queue.filter((q) => q.stage === 'READY').length)} /{' '}
            {formatNumber(queue.length)} جاهز للتشغيل
          </Badge>
        )}
      </div>

      {hasActiveUploads && (
        <div className="mb-3" data-testid="active-upload-warning">
          <AlertBanner tone="warning" title="تنبيه: جاري رفع ملفات الفيديو الآن">
            يرجى عدم إغلاق هذه الصفحة أو تحديث المتصفح حتى يكتمل شريط الرفع وتنتقل الحالة إلى «اكتمل الرفع».
          </AlertBanner>
        </div>
      )}

      <div className="space-y-4">
        <Field
          label={
            allowMultiple
              ? 'اختر ملف فيديو واحد أو عدة ملفات فيديو (MP4 / WebM / MOV)'
              : 'اختر ملف الفيديو (MP4 / WebM / MOV)'
          }
          hint="يتم رفع كل فيديو على أجزاء متتالية، ثم تحويله تلقائياً إلى بث تكيفي واستخراج مدة الدرس."
        >
          <input
            id="vid-file"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            multiple={allowMultiple}
            data-testid="video-chunk-file-input"
            disabled={isRunningQueue}
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="block w-full text-xs text-indigo-100 file:ml-3 file:rounded-xl file:border-0 file:bg-indigo-950 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-indigo-100 hover:file:bg-indigo-900"
          />
        </Field>

        {queue.length > 0 && (
          <div className="space-y-3" data-testid="video-upload-queue">
            {queue.map((item, idx) => (
              <div
                key={item.localId}
                data-testid={`video-queue-item-${idx}`}
                className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileVideo className="h-4 w-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={item.titleAr}
                        disabled={item.stage !== 'PENDING' && item.stage !== 'FAILED'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQueue((prev) =>
                            prev.map((q) =>
                              q.localId === item.localId ? { ...q, titleAr: val } : q,
                            ),
                          );
                        }}
                        aria-label={`عنوان الفيديو ${idx + 1}`}
                        className={`${inputClassName} h-8 py-1 text-xs font-bold`}
                      />
                      <p className="mt-1 text-[11px] text-slate-400 truncate tabular-nums">
                        الملف: <span dir="ltr">{item.file.name}</span> • الحجم:{' '}
                        {formatFileSizeAr(item.file.size)}
                        {item.durationSeconds && item.durationSeconds > 0 ? (
                          <> • المدة المستخرجة: {formatNumber(item.durationSeconds)} ثانية</>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* Distinct Status Badges: Uploading vs Uploaded/Processing vs Ready for Playback */}
                  <div className="shrink-0">
                    {item.stage === 'PENDING' && <Badge tone="neutral">في انتظار الرفع</Badge>}
                    {item.stage === 'UPLOADING' && (
                      <Badge tone="info">
                        جارٍ الرفع ({formatNumber(item.uploadPercent)}%)
                      </Badge>
                    )}
                    {item.stage === 'UPLOADED_PROCESSING' && (
                      <span data-testid="status-uploaded-processing">
                        <Badge tone="warning">
                          <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
                          اكتمل الرفع — جارٍ التجهيز للتشغيل
                        </Badge>
                      </span>
                    )}
                    {item.stage === 'READY' && (
                      <span data-testid="status-ready-for-playback">
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3 inline ml-1" />
                          جاهز للتشغيل
                        </Badge>
                      </span>
                    )}
                    {item.stage === 'FAILED' && (
                      <span data-testid="status-upload-failed">
                        <Badge tone="danger">
                          <AlertTriangle className="h-3 w-3 inline ml-1" />
                          تعذر التجهيز
                        </Badge>
                      </span>
                    )}
                    {item.stage === 'CANCELLED' && <Badge tone="neutral">تم الإلغاء</Badge>}
                  </div>
                </div>

                {/* Progress Bar */}
                {(item.stage === 'UPLOADING' ||
                  item.stage === 'UPLOADED_PROCESSING' ||
                  item.stage === 'READY') && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.stage === 'READY'
                            ? 'bg-emerald-500'
                            : item.stage === 'UPLOADED_PROCESSING'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${item.uploadPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {item.stage === 'UPLOADING' &&
                          'المرحلة 1 من 2: رفع أجزاء الملف إلى الخادم...'}
                        {item.stage === 'UPLOADED_PROCESSING' &&
                          'المرحلة 2 من 2: اكتمل الرفع وجارٍ تحويل الفيديو إلى بث تكيفي HLS واستخراج المدة...'}
                        {item.stage === 'READY' &&
                          `اكتمل التجهيز بنجاح وأصبح الفيديو جاهزاً للتشغيل (${
                            (item.availableQualities ?? ['360p', '720p']).join(' / ')
                          })`}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatNumber(item.uploadPercent)}%
                      </span>
                    </div>
                  </div>
                )}

                {item.errorMessage && (
                  <p className="text-xs font-semibold text-rose-400">{item.errorMessage}</p>
                )}

                {/* Per-Item Recovery Actions: Cancel / Retry / Re-transcode */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {item.stage === 'UPLOADING' && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      data-testid={`cancel-upload-btn-${idx}`}
                      onClick={() => void handleCancelItem(item)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      إلغاء الرفع
                    </Button>
                  )}

                  {(item.stage === 'FAILED' || item.stage === 'CANCELLED') && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid={`retry-upload-btn-${idx}`}
                      disabled={isRunningQueue}
                      onClick={() => void uploadSingleItem(item)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      إعادة محاولة الرفع
                    </Button>
                  )}

                  {item.videoAssetId &&
                    (item.stage === 'FAILED' || item.stage === 'READY') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`retranscode-btn-${idx}`}
                        onClick={() => void handleRetranscodeItem(item)}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        إعادة تجهيز البث (Re-transcode)
                      </Button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="primary"
            data-testid="start-video-upload-btn"
            disabled={isRunningQueue || pendingOrFailedCount === 0}
            onClick={() => void handleStartUploadQueue()}
          >
            {isRunningQueue ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري رفع وتجهيز الفيديوهات...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                {pendingOrFailedCount > 1
                  ? `بدء رفع وتجهيز (${formatNumber(pendingOrFailedCount)}) فيديوهات`
                  : 'بدء رفع وتجهيز الفيديو'}
              </>
            )}
          </Button>

          {queue.length > 0 && !isRunningQueue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setQueue([])}
            >
              مسح القائمة
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
