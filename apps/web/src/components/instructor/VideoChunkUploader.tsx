'use client';

import React, { useRef, useState } from 'react';
import { CheckCircle2, Pause, Play, UploadCloud } from 'lucide-react';
import { apiFetch, uploadBinaryChunk } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export function VideoChunkUploader({
  courseId,
  compact = false,
  onUploaded,
}: {
  courseId?: string;
  compact?: boolean;
  onUploaded?: (asset: any) => void;
}) {
  const { pushToast } = useAuth();
  const [titleAr, setTitleAr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAsset, setCompletedAsset] = useState<any | null>(null);

  const pausedRef = useRef(false);
  const sessionRef = useRef<{ sessionId: string; totalChunks: number; chunkSize: number } | null>(
    null,
  );
  const nextChunkRef = useRef(0);

  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks (>= 64KB schema minimum)

  const runUploadLoop = async (
    targetFile: File,
    sessionId: string,
    totalChunks: number,
    chunkSize: number,
    startIndex: number,
  ) => {
    for (let idx = startIndex; idx < totalChunks; idx++) {
      if (pausedRef.current) {
        nextChunkRef.current = idx;
        setStatusText(`تم إيقاف الرفع مؤقتاً عند الجزء ${idx} من ${totalChunks}`);
        return;
      }
      const start = idx * chunkSize;
      const end = Math.min(start + chunkSize, targetFile.size);
      const blob = targetFile.slice(start, end);
      await uploadBinaryChunk({ sessionId, chunkIndex: idx, chunk: blob });
      const pct = Math.round(((idx + 1) / totalChunks) * 100);
      setProgress(pct);
      setStatusText(`تم رفع ${pct}% (${idx + 1} / ${totalChunks})`);
      nextChunkRef.current = idx + 1;
    }

    setStatusText('جاري إتمام الرفع وإدراج الفيديو للمعالجة...');
    const asset = await apiFetch<any>(
      `/instructor/videos/uploads/${sessionId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ titleAr: titleAr.trim() || targetFile.name }),
      },
    );
    setCompletedAsset(asset);
    sessionRef.current = null;
    nextChunkRef.current = 0;
    setStatusText('تم رفع الفيديو بنجاح! جاري تجهيزه في الخلفية بعدة جودات.');
    pushToast('تم رفع الفيديو وإدخاله للتجهيز بنجاح', 'success');
    onUploaded?.(asset);
  };

  const startOrResume = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!file) {
      setError('اختر ملف فيديو أولاً');
      return;
    }
    if (!titleAr.trim()) {
      setError('أدخل عنواناً واضحاً للفيديو');
      return;
    }
    setError(null);
    pausedRef.current = false;
    setPaused(false);
    setUploading(true);
    setCompletedAsset(null);

    try {
      if (sessionRef.current) {
        const status = await apiFetch<{ receivedChunks: number[] }>(
          `/instructor/videos/uploads/${sessionRef.current.sessionId}`,
        );
        const received = new Set(status.receivedChunks || []);
        let resumeFrom = 0;
        while (received.has(resumeFrom) && resumeFrom < sessionRef.current.totalChunks) {
          resumeFrom++;
        }
        await runUploadLoop(
          file,
          sessionRef.current.sessionId,
          sessionRef.current.totalChunks,
          sessionRef.current.chunkSize,
          resumeFrom,
        );
      } else {
        setProgress(0);
        const init = await apiFetch<{
          sessionId: string;
          totalChunks: number;
          chunkSizeBytes: number;
        }>('/instructor/videos/uploads/initiate', {
          method: 'POST',
          body: JSON.stringify({
            courseId: courseId || null,
            titleAr: titleAr.trim(),
            filename: file.name,
            mimeType: file.type || 'video/mp4',
            totalBytes: file.size,
            chunkSizeBytes: CHUNK_SIZE,
          }),
        });
        sessionRef.current = {
          sessionId: init.sessionId,
          totalChunks: init.totalChunks,
          chunkSize: init.chunkSizeBytes,
        };
        await runUploadLoop(
          file,
          init.sessionId,
          init.totalChunks,
          init.chunkSizeBytes,
          0,
        );
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء رفع الفيديو. يمكنك الاستئناف مرة أخرى.');
    } finally {
      if (!pausedRef.current) {
        setUploading(false);
      }
    }
  };

  const pauseUpload = () => {
    pausedRef.current = true;
    setPaused(true);
    setUploading(false);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <UploadCloud className="h-5 w-5 text-[#8CA2FF]" />
        <h3 className="text-lg font-extrabold text-[#EEF0FF]">
          رفع فيديو تعليمي جديد
        </h3>
      </div>

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {completedAsset && (
        <AlertBanner tone="success">
          <span className="inline-flex items-center gap-1.5 font-extrabold">
            <CheckCircle2 className="h-4 w-4" />
            الفيديو مسجل برقم: <code dir="ltr">{completedAsset.id}</code>
          </span>
        </AlertBanner>
      )}

      <form onSubmit={startOrResume} className="space-y-4">
        <div className={compact ? 'grid gap-4 grid-cols-1' : 'grid gap-4 sm:grid-cols-2'}>
          <Field id="vid-title" label="عنوان الفيديو التعليمي" required>
            <input
              id="vid-title"
              className={inputClassName}
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="مثال: الدرس 1 — أساسيات التهوية النفقية"
              required
            />
          </Field>
          <Field id="vid-file" label="ملف الفيديو (MP4 / MOV / WebM)" required>
            <input
              id="vid-file"
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              onChange={(e) => {
                const picked = e.target.files?.[0] || null;
                setFile(picked);
                sessionRef.current = null;
                setProgress(0);
                if (picked && !titleAr) {
                  setTitleAr(picked.name.replace(/\.[^.]+$/, ''));
                }
              }}
              className={`${inputClassName} py-2`}
            />
          </Field>
        </div>

        {(uploading || progress > 0) && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-bosla-muted">
              <span>{statusText}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-bosla-bg border border-bosla-line">
              <div
                className="h-full rounded-full bg-bosla-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!uploading && (
            <Button type="submit" variant="primary" disabled={!file}>
              {paused ? (
                <>
                  <Play className="h-4 w-4" />
                  استئناف الرفع
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  بدء الرفع المجزأ ({file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '0 MB'})
                </>
              )}
            </Button>
          )}
          {uploading && (
            <Button type="button" variant="outline" onClick={pauseUpload}>
              <Pause className="h-4 w-4" />
              إيقاف مؤقت
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
