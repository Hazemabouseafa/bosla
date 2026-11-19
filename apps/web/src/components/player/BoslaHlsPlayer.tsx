'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Gauge, Settings2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AlertBanner, Badge } from '@/components/ui/primitives';

export function BoslaHlsPlayer({
  lessonId,
  initialWatchedSeconds = 0,
  durationSeconds = 0,
  seekToSeconds = null,
  seekTriggerKey = 0,
  onTimeChange,
  onProgressSaved,
}: {
  lessonId: string;
  initialWatchedSeconds?: number;
  durationSeconds?: number;
  seekToSeconds?: number | null;
  seekTriggerKey?: number;
  onTimeChange?: (currentSeconds: number, durationSeconds: number) => void;
  onProgressSaved?: (res: any) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAtRef = useRef<number>(0);
  const pendingSeekRef = useRef<number | null>(seekToSeconds);
  const initialWatchedSecondsRef = useRef<number>(initialWatchedSeconds);
  const initialSeekAppliedRef = useRef<boolean>(false);

  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [levels, setLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialWatchedSecondsRef.current = initialWatchedSeconds;
  }, [initialWatchedSeconds]);

  useEffect(() => {
    initialSeekAppliedRef.current = false;
    let active = true;
    setLoading(true);
    setError(null);
    setManifestUrl(null);
    setLevels([]);

    apiFetch<{ manifestUrl: string }>(`/lessons/${lessonId}/playback-session`, {
      method: 'POST',
    })
      .then((res) => {
        if (!active) return;
        setManifestUrl(res.manifestUrl);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'تعذر بدء جلسة البث المحمي لهذا الدرس.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lessonId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !manifestUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const seekInitial = () => {
      const requestedSeek = pendingSeekRef.current;
      if (typeof requestedSeek === 'number' && Number.isFinite(requestedSeek) && requestedSeek >= 0) {
        const clamped =
          video.duration && Number.isFinite(video.duration)
            ? Math.min(requestedSeek, Math.max(video.duration - 0.5, 0))
            : requestedSeek;
        video.currentTime = clamped;
        pendingSeekRef.current = null;
        initialSeekAppliedRef.current = true;
        return;
      }
      const resumeAt = initialWatchedSecondsRef.current;
      if (
        !initialSeekAppliedRef.current &&
        resumeAt > 3 &&
        video.duration > resumeAt + 2
      ) {
        video.currentTime = resumeAt;
        initialSeekAppliedRef.current = true;
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        const mapped = (data.levels ?? []).map((lvl, index) => ({
          index,
          label: lvl.height ? `${lvl.height}p` : `جودة ${index + 1}`,
        }));
        setLevels(mapped);
        seekInitial();
      });
      video.addEventListener('loadedmetadata', seekInitial);
      video.addEventListener('loadeddata', seekInitial);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setError('حدث انقطاع مؤقت في البث التكيفي. أعد تحديث المشغل.');
        }
      });
      return () => {
        video.removeEventListener('loadedmetadata', seekInitial);
        video.removeEventListener('loadeddata', seekInitial);
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = manifestUrl;
      video.addEventListener('loadedmetadata', seekInitial, { once: true });
      return () => {
        video.removeEventListener('loadedmetadata', seekInitial);
      };
    } else {
      setError('المتصفح الحالي لا يدعم تشغيل هذا الفيديو.');
    }
  }, [manifestUrl]);

  const persistProgress = async (completed = false) => {
    const video = videoRef.current;
    if (!video) return;
    const watched = Math.floor(video.currentTime || 0);
    const dur = Math.max(Math.floor(video.duration || durationSeconds || 60), 1);
    try {
      const res = await apiFetch(`/learning/lessons/${lessonId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          watchedSeconds: completed ? dur : watched,
          durationSeconds: dur,
          isCompleted: completed,
        }),
      });
      onProgressSaved?.(res);
    } catch {
      // Non-fatal progress save
    }
  };

  useEffect(() => {
    pendingSeekRef.current = seekToSeconds;
    const video = videoRef.current;
    if (
      video &&
      typeof seekToSeconds === 'number' &&
      Number.isFinite(seekToSeconds) &&
      seekToSeconds >= 0 &&
      video.readyState >= 1
    ) {
      const clamped =
        video.duration && Number.isFinite(video.duration)
          ? Math.min(seekToSeconds, Math.max(video.duration - 0.5, 0))
          : seekToSeconds;
      video.currentTime = clamped;
      void video.play().catch(() => {});
      pendingSeekRef.current = null;
    }
  }, [seekToSeconds, seekTriggerKey]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      onTimeChange?.(
        video.currentTime || 0,
        video.duration || durationSeconds || 0,
      );
    }
    const now = Date.now();
    if (now - lastSavedAtRef.current > 10_000) {
      lastSavedAtRef.current = now;
      void persistProgress(false);
    }
  };

  const handleLevelChange = (idx: number) => {
    setCurrentLevel(idx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  if (loading) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-bosla-navy text-white flex flex-col items-center justify-center gap-3 text-sm font-bold border border-bosla-primary/25">
        <span className="h-7 w-7 rounded-full border-2 border-bosla-primary border-t-transparent animate-spin" />
        <span>جاري تهيئة البث المشفر...</span>
      </div>
    );
  }

  if (error) {
    return <AlertBanner tone="danger">{error}</AlertBanner>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-[#22307A] bg-[#0B1440] shadow-blue-card">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onTimeUpdate={handleTimeUpdate}
          onPause={() => void persistProgress(false)}
          onEnded={() => void persistProgress(true)}
          className="aspect-video w-full accent-[#7C95FF]"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#22307A] bg-[#0F1A4A] px-4 py-2.5 text-xs">
        <Badge tone="success">مشاهدة محمية وعالية الجودة</Badge>

        <div className="flex flex-wrap items-center gap-4">
          {levels.length > 0 && (
            <label className="inline-flex items-center gap-1.5 font-bold text-[#EEF0FF]">
              <Settings2 className="h-3.5 w-3.5 text-[#8CA2FF]" />
              الجودة:
              <select
                aria-label="جودة الفيديو"
                value={currentLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
                className="rounded-lg border border-[#22307A] bg-[#0B1440] px-2 py-1 text-xs font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
              >
                <option value={-1}>تلقائي (متكيف)</option>
                {levels.map((lvl) => (
                  <option key={lvl.index} value={lvl.index}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="inline-flex items-center gap-1.5 font-bold text-[#EEF0FF]">
            <Gauge className="h-3.5 w-3.5 text-[#8CA2FF]" />
            السرعة:
            <select
              aria-label="سرعة التشغيل"
              value={playbackRate}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="rounded-lg border border-[#22307A] bg-[#0B1440] px-2 py-1 text-xs font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
            >
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
