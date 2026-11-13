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
  onProgressSaved,
}: {
  lessonId: string;
  initialWatchedSeconds?: number;
  durationSeconds?: number;
  onProgressSaved?: (res: any) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAtRef = useRef<number>(0);

  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [levels, setLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      if (initialWatchedSeconds > 3 && video.duration > initialWatchedSeconds + 2) {
        video.currentTime = initialWatchedSeconds;
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
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setError('حدث انقطاع مؤقت في البث التكيفي. أعد تحديث المشغل.');
        }
      });
      return () => {
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
      setError('المتصفح الحالي لا يدعم تشغيل بث HLS.');
    }
  }, [manifestUrl, initialWatchedSeconds]);

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

  const handleTimeUpdate = () => {
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
      <div className="aspect-video w-full rounded-2xl bg-bosla-navy/95 text-white flex items-center justify-center text-sm font-bold">
        جاري تهيئة البث المشفر...
      </div>
    );
  }

  if (error) {
    return <AlertBanner tone="danger">{error}</AlertBanner>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-bosla-navy/30 bg-black shadow-lg">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onTimeUpdate={handleTimeUpdate}
          onPause={() => void persistProgress(false)}
          onEnded={() => void persistProgress(true)}
          className="aspect-video w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bosla-line bg-white px-4 py-2.5 text-xs">
        <Badge tone="success">بث HLS محمي برمز جلسة</Badge>

        <div className="flex flex-wrap items-center gap-4">
          {levels.length > 0 && (
            <label className="inline-flex items-center gap-1.5 font-bold text-bosla-ink">
              <Settings2 className="h-3.5 w-3.5 text-bosla-primary" />
              الجودة:
              <select
                aria-label="جودة الفيديو"
                value={currentLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
                className="rounded-lg border border-bosla-line bg-bosla-bg px-2 py-1 text-xs font-bold"
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

          <label className="inline-flex items-center gap-1.5 font-bold text-bosla-ink">
            <Gauge className="h-3.5 w-3.5 text-bosla-primary" />
            السرعة:
            <select
              aria-label="سرعة التشغيل"
              value={playbackRate}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="rounded-lg border border-bosla-line bg-bosla-bg px-2 py-1 text-xs font-bold"
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
