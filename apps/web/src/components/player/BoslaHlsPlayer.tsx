'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  Captions,
  CheckCircle2,
  Gauge,
  Loader2,
  Maximize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { apiFetch, API_BASE_URL, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/primitives';

interface PlaybackSessionResponse {
  sessionToken: string;
  lessonId: string;
  masterPlaylistUrl: string;
  expiresInSeconds: number;
  watermark: {
    fullName: string;
    identifier: string;
    sessionShortId: string;
  };
}

interface CaptionTrackItem {
  id: string;
  languageCode: string;
  labelAr: string;
  format: string;
  isDefault: boolean;
  status: string;
  vttEndpointUrl: string;
}

interface ReadinessResponse {
  lessonId: string;
  hasVideo: boolean;
  videoAssetId?: string;
  status: string;
  readyForPlayback: boolean;
  masterPlaylistExists?: boolean;
  durationSeconds?: number;
  availableQualities?: string[];
  failureReason?: string | null;
  stageLabelAr: string;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;
const MAX_AUTO_RECOVERY_ATTEMPTS = 3;

export function BoslaHlsPlayer({
  lessonId,
  videoAssetId,
  initialVideoStatus,
  canRetranscode = false,
  initialWatchedSeconds = 0,
  durationSeconds = 0,
  seekToSeconds = null,
  seekTriggerKey = 0,
  onProgressSaved,
  onTimeChange,
}: {
  lessonId: string;
  videoAssetId?: string | null;
  initialVideoStatus?: string | null;
  canRetranscode?: boolean;
  initialWatchedSeconds?: number;
  durationSeconds?: number;
  seekToSeconds?: number | null;
  seekTriggerKey?: number;
  onProgressSaved?: (payload: any) => void;
  onTimeChange?: (currentSeconds: number, totalDurationSeconds: number) => void;
}) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [session, setSession] = useState<PlaybackSessionResponse | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveringMessage, setRecoveringMessage] = useState<string | null>(null);
  const [retranscoding, setRetranscoding] = useState(false);

  // Readiness state (distinguishes "اكتمل الرفع" vs "جاهز للتشغيل")
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const resolvedVideoAssetId = readiness?.videoAssetId || videoAssetId || null;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialWatchedSeconds);
  const [totalDuration, setTotalDuration] = useState(durationSeconds);
  const [wmPos, setWmPos] = useState<{ top: string; right: string }>({
    top: '14%',
    right: '10%',
  });

  // Quality selector state (-1 = Auto)
  const [levels, setLevels] = useState<Array<{ index: number; height: number; bitrate: number }>>(
    [],
  );
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [activeAutoHeight, setActiveAutoHeight] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<'none' | 'quality' | 'speed' | 'captions'>('none');

  // Playback speed state
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // Subtitles / Captions state
  const [captions, setCaptions] = useState<CaptionTrackItem[]>([]);
  const [activeCaptionId, setActiveCaptionId] = useState<string | 'off'>('off');

  // Resume prompt banner
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(initialWatchedSeconds >= 10);

  const watchedRef = useRef<number>(initialWatchedSeconds);
  const savedPositionRef = useRef<number>(initialWatchedSeconds);
  const progressSeqRef = useRef<number>(Date.now());
  const watchAccumulatedRef = useRef<number>(0);
  const lastTickEpochRef = useRef<number>(Date.now());
  const rebufferCountRef = useRef<number>(0);
  const recoveryAttemptsRef = useRef<number>(0);
  const clientSessionIdRef = useRef<string>(
    `ps_${lessonId}_${Math.random().toString(36).slice(2, 10)}`,
  );

  // Load persisted player preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedSpeed = Number(window.localStorage.getItem('bosla_player_speed') || '1');
    if (SPEED_OPTIONS.includes(savedSpeed as any)) {
      setPlaybackRate(savedSpeed);
    }
    const savedCaptionLang = window.localStorage.getItem('bosla_player_caption_lang');
    if (savedCaptionLang === 'off') {
      setActiveCaptionId('off');
    }
  }, []);

  const syncProgress = useCallback(
    async (completed = false, overridePos?: number) => {
      if (!user) return;
      const vid = videoRef.current;
      const currentPos =
        overridePos !== undefined ? overridePos : Math.floor(vid?.currentTime ?? 0);
      watchedRef.current = Math.max(watchedRef.current, currentPos);
      savedPositionRef.current = currentPos;
      progressSeqRef.current += 1;

      try {
        const res = await apiFetch<any>(`/learning/lessons/${lessonId}/progress`, {
          method: 'POST',
          body: JSON.stringify({
            watchedSeconds: watchedRef.current,
            lastPositionSeconds: currentPos,
            isCompleted: completed,
            sequenceNumber: progressSeqRef.current,
          }),
        });
        onProgressSaved?.(res);
      } catch {
        // Silent background progress sync
      }
    },
    [lessonId, onProgressSaved, user],
  );

  const syncAnalyticsHeartbeat = useCallback(
    async (completed = false) => {
      if (!user) return;
      const vid = videoRef.current;
      const currentPos = Math.floor(vid?.currentTime ?? 0);
      const activeLevelObj = levels.find((l) => l.index === selectedLevel);
      const qualityLabel =
        selectedLevel === -1
          ? activeAutoHeight
            ? `auto (${activeAutoHeight}p)`
            : 'auto'
          : activeLevelObj
          ? `${activeLevelObj.height}p`
          : 'auto';

      try {
        await apiFetch(`/learning/lessons/${lessonId}/analytics/heartbeat`, {
          method: 'POST',
          body: JSON.stringify({
            sessionId: clientSessionIdRef.current,
            watchDurationSeconds: Math.max(1, Math.floor(watchAccumulatedRef.current)),
            maxPositionSeconds: Math.max(watchedRef.current, currentPos),
            lastPositionSeconds: currentPos,
            selectedQuality: qualityLabel,
            playbackRate,
            rebufferCount: rebufferCountRef.current,
            completed,
            deviceType:
              typeof window !== 'undefined' && window.innerWidth < 768 ? 'MOBILE' : 'DESKTOP',
          }),
        });
      } catch {
        // Silent background analytics
      }
    },
    [lessonId, levels, selectedLevel, activeAutoHeight, playbackRate, user],
  );

  const refreshPlaybackToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshed = await apiFetch<{
        sessionToken: string;
        masterPlaylistUrl: string;
      }>(`/lessons/${lessonId}/playback-session/refresh`, {
        method: 'POST',
      });
      if (refreshed?.sessionToken) {
        sessionTokenRef.current = refreshed.sessionToken;
        setSession((prev) =>
          prev
            ? {
                ...prev,
                sessionToken: refreshed.sessionToken,
                masterPlaylistUrl: refreshed.masterPlaylistUrl,
              }
            : prev,
        );
        return refreshed.sessionToken;
      }
    } catch {
      // Fall back to existing token or full session re-creation
    }
    return null;
  }, [lessonId]);

  const checkReadiness = useCallback(async (): Promise<ReadinessResponse | null> => {
    try {
      const raw = await apiFetch<ReadinessResponse & { playbackReady?: boolean }>(
        `/learning/lessons/${lessonId}/playback-readiness`,
      );
      const res: ReadinessResponse = {
        ...raw,
        readyForPlayback: Boolean(
          raw.readyForPlayback ?? raw.playbackReady ?? raw.status === 'READY',
        ),
      };
      setReadiness(res);
      if (res.durationSeconds && res.durationSeconds > 0) {
        setTotalDuration(res.durationSeconds);
      }
      return res;
    } catch {
      return null;
    }
  }, [lessonId]);

  const initializePlayer = useCallback(
    async (resumePositionSeconds?: number) => {
      setLoading(true);
      setError(null);
      setRecoveringMessage(null);
      recoveryAttemptsRef.current = 0;

      if (resumePositionSeconds !== undefined && resumePositionSeconds > 0) {
        savedPositionRef.current = resumePositionSeconds;
      }

      // Step 1: Verify video readiness before attempting playback
      const readyState = await checkReadiness();
      if (readyState && !readyState.readyForPlayback) {
        setLoading(false);
        if (readyState.status === 'FAILED') {
          setError(
            readyState.failureReason ||
              'تعذر تجهيز ملف الفيديو للتشغيل التكيفي. يمكنك إعادة تجهيز الفيديو أو رفع نسخة بديلة.',
          );
        }
        return;
      }

      // Step 2: Issue signed playback session & load captions
      try {
        const [playbackRes, captionsRes] = await Promise.all([
          apiFetch<PlaybackSessionResponse>(`/lessons/${lessonId}/playback-session`, {
            method: 'POST',
          }),
          apiFetch<{ items: CaptionTrackItem[] }>(`/learning/lessons/${lessonId}/captions`).catch(
            () => ({ items: [] }),
          ),
        ]);

        setSession(playbackRes);
        sessionTokenRef.current = playbackRes.sessionToken;

        const readyCaptions = (captionsRes.items ?? []).filter((c) => c.status === 'READY');
        setCaptions(readyCaptions);
        const savedCaptionLang =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('bosla_player_caption_lang')
            : null;
        if (savedCaptionLang && savedCaptionLang !== 'off') {
          const match = readyCaptions.find((c) => c.languageCode === savedCaptionLang);
          if (match) setActiveCaptionId(match.id);
        } else if (savedCaptionLang !== 'off') {
          const defTrack = readyCaptions.find((c) => c.isDefault) ?? readyCaptions[0];
          if (defTrack) setActiveCaptionId(defTrack.id);
        }

        const videoEl = videoRef.current;
        if (!videoEl) return;

        const targetStartPos =
          resumePositionSeconds !== undefined
            ? resumePositionSeconds
            : savedPositionRef.current > 0
            ? savedPositionRef.current
            : initialWatchedSeconds;

        const fullMasterUrl = `${API_BASE_URL}${playbackRes.masterPlaylistUrl}`;

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            capLevelToPlayerSize: true,
            maxBufferLength: 30,
            backBufferLength: 30,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
            fragLoadingMaxRetry: 4,
            xhrSetup: (xhr) => {
              const tok = sessionTokenRef.current || playbackRes.sessionToken;
              xhr.setRequestHeader('X-Playback-Session', tok);
            },
          });
          hlsRef.current = hls;
          hls.loadSource(fullMasterUrl);
          hls.attachMedia(videoEl);

          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            const parsedLevels = (data.levels ?? []).map((lvl, idx) => ({
              index: idx,
              height: lvl.height || 0,
              bitrate: lvl.bitrate || 0,
            }));
            setLevels(parsedLevels);
            setSelectedLevel(-1);

            if (targetStartPos > 0) {
              videoEl.currentTime = targetStartPos;
            }
            const savedSpeed =
              typeof window !== 'undefined'
                ? Number(window.localStorage.getItem('bosla_player_speed') || '1')
                : 1;
            if (SPEED_OPTIONS.includes(savedSpeed as any)) {
              videoEl.playbackRate = savedSpeed;
            }
            setRecoveringMessage(null);
            setLoading(false);
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
            const lvl = hls.levels?.[data.level];
            if (lvl?.height) {
              setActiveAutoHeight(lvl.height);
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;

            const currentPos = Math.floor(
              videoRef.current?.currentTime || savedPositionRef.current || 0,
            );
            savedPositionRef.current = currentPos;

            if (recoveryAttemptsRef.current < MAX_AUTO_RECOVERY_ATTEMPTS) {
              recoveryAttemptsRef.current += 1;
              const attempt = recoveryAttemptsRef.current;

              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                setRecoveringMessage(
                  `جارٍ استعادة اتصال البث التلقائي (محاولة ${formatNumber(attempt)} من ${formatNumber(
                    MAX_AUTO_RECOVERY_ATTEMPTS,
                  )})...`,
                );
                void refreshPlaybackToken().finally(() => {
                  if (hlsRef.current) {
                    hlsRef.current.startLoad(currentPos > 0 ? currentPos : -1);
                  }
                });
                return;
              }

              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                setRecoveringMessage(
                  `جارٍ معالجة تدفق الوسائط تلقائياً (محاولة ${formatNumber(attempt)} من ${formatNumber(
                    MAX_AUTO_RECOVERY_ATTEMPTS,
                  )})...`,
                );
                hls.recoverMediaError();
                return;
              }
            }

            // Bounded recovery exhausted -> surface structured in-player recovery overlay
            setRecoveringMessage(null);
            setLoading(false);
            setError(
              'تعذر استمرار البث التكيفي بعد عدة محاولات تلقائية. يمكنك إعادة محاولة التشغيل من نفس الموضع فوراً.',
            );
          });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = fullMasterUrl;
          videoEl.addEventListener(
            'loadedmetadata',
            () => {
              if (targetStartPos > 0) {
                videoEl.currentTime = targetStartPos;
              }
              setLoading(false);
            },
            { once: true },
          );
        } else {
          setError('متصفحك الحالي لا يدعم تشغيل البث التكيفي HLS.');
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'تعذر بدء جلسة تشغيل الفيديو المحمية.');
        setLoading(false);
      }
    },
    [checkReadiness, initialWatchedSeconds, lessonId, refreshPlaybackToken],
  );

  useEffect(() => {
    watchedRef.current = initialWatchedSeconds;
    savedPositionRef.current = initialWatchedSeconds;
    setCurrentTime(initialWatchedSeconds);
    setShowResumeBanner(initialWatchedSeconds >= 10);
    clientSessionIdRef.current = `ps_${lessonId}_${Math.random().toString(36).slice(2, 10)}`;
    watchAccumulatedRef.current = 0;
    rebufferCountRef.current = 0;

    void initializePlayer(initialWatchedSeconds);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [lessonId, initialWatchedSeconds, initializePlayer]);

  // Poll readiness automatically while video is UPLOADED_QUEUED or PROCESSING
  useEffect(() => {
    const status = readiness?.status || initialVideoStatus;
    if (
      readiness?.readyForPlayback ||
      (status !== 'UPLOADED_QUEUED' && status !== 'PROCESSING' && status !== 'INITIATED')
    ) {
      return;
    }

    const timer = window.setInterval(async () => {
      const updated = await checkReadiness();
      if (updated?.readyForPlayback) {
        window.clearInterval(timer);
        void initializePlayer(savedPositionRef.current);
      } else if (updated?.status === 'FAILED') {
        window.clearInterval(timer);
        setError(
          updated.failureReason || 'تعذر تجهيز الفيديو للتشغيل. يمكنك الضغط على إعادة تجهيز الفيديو.',
        );
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [readiness?.status, readiness?.readyForPlayback, initialVideoStatus, checkReadiness, initializePlayer]);

  const handleManualRetry = async () => {
    const pos = Math.floor(videoRef.current?.currentTime || savedPositionRef.current || 0);
    await initializePlayer(pos);
  };

  const handleRetranscode = async () => {
    if (!resolvedVideoAssetId || retranscoding) return;
    setRetranscoding(true);
    setError(null);
    try {
      await apiFetch(`/instructor/videos/${resolvedVideoAssetId}/retranscode`, {
        method: 'POST',
      });
      await checkReadiness();
    } catch (err: any) {
      setError(err?.message || 'تعذر بدء إعادة تجهيز الفيديو.');
    } finally {
      setRetranscoding(false);
    }
  };

  // Dynamic watermark movement + periodic token refresh
  useEffect(() => {
    if (!session) return;

    const wmTimer = window.setInterval(() => {
      const top = 12 + Math.floor(Math.random() * 64);
      const right = 8 + Math.floor(Math.random() * 64);
      setWmPos({ top: `${top}%`, right: `${right}%` });
    }, 14000);

    const refreshTimer = window.setInterval(() => {
      void refreshPlaybackToken();
    }, 240000);

    const progressTimer = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const now = Date.now();
        const deltaSec = Math.min(15, Math.max(1, Math.round((now - lastTickEpochRef.current) / 1000)));
        watchAccumulatedRef.current += deltaSec;
        lastTickEpochRef.current = now;
        void syncProgress(false);
        void syncAnalyticsHeartbeat(false);
      }
    }, 10000);

    return () => {
      window.clearInterval(wmTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(progressTimer);
    };
  }, [session, refreshPlaybackToken, syncProgress, syncAnalyticsHeartbeat]);

  // External timestamp deep-link seek
  useEffect(() => {
    if (seekToSeconds === null || seekToSeconds === undefined || seekToSeconds < 0) {
      return;
    }
    const vid = videoRef.current;
    if (!vid) return;

    const applySeek = () => {
      const bounded =
        vid.duration && !Number.isNaN(vid.duration)
          ? Math.min(seekToSeconds, Math.max(0, Math.floor(vid.duration - 1)))
          : seekToSeconds;
      vid.currentTime = bounded;
      savedPositionRef.current = bounded;
      setCurrentTime(bounded);
      setShowResumeBanner(false);
      void vid.play().catch(() => {});
    };

    if (vid.readyState >= 1) {
      applySeek();
    } else {
      vid.addEventListener('loadedmetadata', applySeek, { once: true });
      return () => vid.removeEventListener('loadedmetadata', applySeek);
    }
  }, [seekToSeconds, seekTriggerKey, loading]);

  // Synchronize HTML5 <track> element mode with activeCaptionId
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !vid.textTracks) return;
    for (let i = 0; i < vid.textTracks.length; i += 1) {
      const track = vid.textTracks[i];
      if (!track) continue;
      const matchingCaption = captions[i];
      if (matchingCaption && matchingCaption.id === activeCaptionId) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }
  }, [activeCaptionId, captions, loading]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      lastTickEpochRef.current = Date.now();
      void vid.play();
    } else {
      vid.pause();
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const handleQualityChange = (levelIndex: number) => {
    setSelectedLevel(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
    setOpenMenu('none');
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bosla_player_speed', String(rate));
    }
    setOpenMenu('none');
  };

  const handleCaptionChange = (captionId: string | 'off', langCode?: string) => {
    setActiveCaptionId(captionId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bosla_player_caption_lang', langCode || 'off');
    }
    setOpenMenu('none');
  };

  const handleRestartFromBeginning = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    savedPositionRef.current = 0;
    setCurrentTime(0);
    setShowResumeBanner(false);
    void syncProgress(false, 0);
    void vid.play().catch(() => {});
  };

  const toggleFullscreen = () => {
    const el = containerRef.current ?? videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${formatNumber(m)}:${r < 10 ? formatNumber(0) : ''}${formatNumber(r)}`;
  };

  const currentQualityLabel =
    selectedLevel === -1
      ? activeAutoHeight
        ? `تلقائي (${formatNumber(activeAutoHeight)}p)`
        : 'تلقائي'
      : `${formatNumber(levels.find((l) => l.index === selectedLevel)?.height ?? 720)}p`;

  const isProcessingStage =
    readiness &&
    !readiness.readyForPlayback &&
    (readiness.status === 'UPLOADED_QUEUED' ||
      readiness.status === 'PROCESSING' ||
      readiness.status === 'INITIATED');

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl select-none"
    >
      <div className="relative aspect-video w-full bg-slate-950">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          crossOrigin="use-credentials"
          onPlay={() => {
            lastTickEpochRef.current = Date.now();
            setIsPlaying(true);
            setRecoveringMessage(null);
          }}
          onWaiting={() => {
            rebufferCountRef.current += 1;
          }}
          onPause={() => {
            setIsPlaying(false);
            void syncProgress(false);
            void syncAnalyticsHeartbeat(false);
          }}
          onTimeUpdate={() => {
            const vid = videoRef.current;
            if (!vid) return;
            const nowSec = Math.floor(vid.currentTime);
            const durSec =
              vid.duration && !Number.isNaN(vid.duration)
                ? Math.floor(vid.duration)
                : totalDuration;
            setCurrentTime(nowSec);
            savedPositionRef.current = nowSec;
            if (vid.duration && !Number.isNaN(vid.duration)) {
              setTotalDuration(durSec);
            }
            onTimeChange?.(nowSec, durSec);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setShowResumeBanner(false);
            void syncProgress(true, 0);
            void syncAnalyticsHeartbeat(true);
          }}
        >
          {captions.map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={`${API_BASE_URL}${track.vttEndpointUrl}`}
              srcLang={track.languageCode}
              label={track.labelAr}
              default={track.id === activeCaptionId}
            />
          ))}
        </video>

        {/* Stage 1: Video Uploaded / Transcoding in progress (Prevent premature playback) */}
        {isProcessingStage && (
          <div
            data-testid="player-processing-stage"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/95 px-6 text-center"
          >
            <Loader2 className="h-9 w-9 animate-spin text-[#8CA2FF]" />
            <div className="space-y-1 max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-300">
                اكتمل الرفع — جارٍ التجهيز للتشغيل
              </span>
              <h3 className="text-base font-extrabold text-white pt-1">
                {readiness?.stageLabelAr || 'اكتمل الرفع وجارٍ تجهيز الجودات التكيفية...'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                يتم الآن تحويل الفيديو إلى بث تكيفي متعدد الجودات (HLS) واستخراج مدة الدرس تلقائياً. سيبدأ التشغيل فور جاهزية المصدر.
              </p>
            </div>
          </div>
        )}

        {/* Loading / Auto-Recovering Overlay */}
        {(loading || recoveringMessage) && !isProcessingStage && !error && (
          <div className="absolute inset-0 z-25 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-4 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#8CA2FF]" />
            <span className="text-sm font-semibold text-slate-200">
              {recoveringMessage || 'جاري تهيئة البث الآمن...'}
            </span>
          </div>
        )}

        {/* Structured In-Player Error & Recovery Overlay (keeps <video> mounted and preserves currentTime) */}
        {error && (
          <div
            data-testid="player-error-overlay"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/92 px-6 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-extrabold text-white">
                تعذر تشغيل البث التكيفي حالياً
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
              {savedPositionRef.current > 0 && (
                <p className="text-[11px] font-semibold text-[#8CA2FF] tabular-nums">
                  تم حفظ موضع المشاهدة عند الدقيقة {formatTime(savedPositionRef.current)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="player-retry-btn"
                onClick={() => void handleManualRetry()}
              >
                <RefreshCw className="h-4 w-4" />
                إعادة محاولة التشغيل
              </Button>
              {canRetranscode && resolvedVideoAssetId && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="player-retranscode-btn"
                  disabled={retranscoding}
                  onClick={() => void handleRetranscode()}
                >
                  <Wrench className="h-4 w-4" />
                  {retranscoding ? 'جارٍ إعادة التجهيز...' : 'إعادة تجهيز الفيديو'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Resume Watching Prompt Banner */}
        {!loading && !error && !isProcessingStage && showResumeBanner && initialWatchedSeconds >= 10 && (
          <div
            data-testid="resume-watching-banner"
            className="absolute top-3 right-3 left-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#8CA2FF]/35 bg-[#070D2B]/90 px-3.5 py-2 text-xs backdrop-blur-md"
          >
            <span className="font-semibold text-[#EEF0FF] tabular-nums">
              تم استئناف الدرس من الدقيقة {formatTime(initialWatchedSeconds)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="resume-continue-btn"
                onClick={() => {
                  setShowResumeBanner(false);
                  void videoRef.current?.play().catch(() => {});
                }}
                className="rounded-lg bg-[#27389A] px-2.5 py-1 font-extrabold text-white hover:bg-[#3145B8]"
              >
                متابعة من حيث توقفت
              </button>
              <button
                type="button"
                data-testid="resume-restart-btn"
                onClick={handleRestartFromBeginning}
                className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 font-bold text-slate-200 hover:bg-white/20"
              >
                <RotateCcw className="h-3 w-3" />
                البدء من البداية
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Anti-Screen-Recording Watermark Overlay */}
        {session?.watermark && !error && !isProcessingStage && (
          <div
            aria-hidden="true"
            style={{ top: wmPos.top, right: wmPos.right }}
            className="pointer-events-none absolute z-10 rounded-lg bg-slate-950/35 px-2.5 py-1 text-[11px] font-semibold text-white/45 backdrop-blur-[1px] transition-all duration-700"
          >
            <span>{session.watermark.fullName}</span>
            <span className="mx-1.5">•</span>
            <span dir="ltr">{session.watermark.identifier}</span>
            <span className="mx-1.5">•</span>
            <span dir="ltr">#{session.watermark.sessionShortId}</span>
          </div>
        )}
      </div>

      {/* Custom Accessible Arabic RTL Control Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={Boolean(isProcessingStage)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900 text-white hover:bg-indigo-800 disabled:opacity-40"
            aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <span className="text-slate-300 font-semibold tabular-nums">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="flex flex-1 items-center px-2">
          <input
            type="range"
            min={0}
            max={Math.max(totalDuration, 1)}
            value={Math.min(currentTime, Math.max(totalDuration, 1))}
            onChange={(e) => {
              const next = Number(e.target.value);
              setCurrentTime(next);
              savedPositionRef.current = next;
              if (videoRef.current) {
                videoRef.current.currentTime = next;
              }
            }}
            aria-label="شريط تقدم الفيديو"
            className="h-1.5 w-full cursor-pointer accent-amber-500"
          />
        </div>

        <div className="relative flex items-center gap-1.5">
          {/* Subtitles / Captions Selector */}
          {captions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                data-testid="player-captions-btn"
                onClick={() => setOpenMenu((m) => (m === 'captions' ? 'none' : 'captions'))}
                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-bold transition-colors ${
                  activeCaptionId !== 'off'
                    ? 'bg-indigo-900/90 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                aria-label="الترجمة والنصوص"
              >
                <Captions className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {activeCaptionId === 'off'
                    ? 'الترجمة: إيقاف'
                    : captions.find((c) => c.id === activeCaptionId)?.labelAr || 'الترجمة'}
                </span>
              </button>
              {openMenu === 'captions' && (
                <div
                  data-testid="player-captions-menu"
                  className="absolute bottom-10 left-0 z-30 min-w-[160px] rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"
                >
                  <button
                    type="button"
                    onClick={() => handleCaptionChange('off', 'off')}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs font-semibold ${
                      activeCaptionId === 'off'
                        ? 'bg-indigo-900 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>إيقاف الترجمة</span>
                  </button>
                  {captions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCaptionChange(c.id, c.languageCode)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs font-semibold ${
                        activeCaptionId === c.id
                          ? 'bg-indigo-900 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{c.labelAr}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Playback Speed Selector */}
          <div className="relative">
            <button
              type="button"
              data-testid="player-speed-btn"
              onClick={() => setOpenMenu((m) => (m === 'speed' ? 'none' : 'speed'))}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-2.5 font-bold text-slate-200 hover:bg-slate-700 tabular-nums"
              aria-label="سرعة التشغيل"
            >
              <Gauge className="h-3.5 w-3.5 text-amber-400" />
              <span dir="ltr">{playbackRate}x</span>
            </button>
            {openMenu === 'speed' && (
              <div
                data-testid="player-speed-menu"
                className="absolute bottom-10 left-0 z-30 min-w-[110px] rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"
              >
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSpeedChange(rate)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums ${
                      playbackRate === rate
                        ? 'bg-indigo-900 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span dir="ltr">{rate}x</span>
                    {rate === 1 && <span className="text-[10px] text-slate-400">عادي</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality Selector */}
          <div className="relative">
            <button
              type="button"
              data-testid="player-quality-btn"
              onClick={() => setOpenMenu((m) => (m === 'quality' ? 'none' : 'quality'))}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-2.5 font-bold text-slate-200 hover:bg-slate-700 tabular-nums"
              aria-label="جودة الفيديو"
            >
              <Settings className="h-3.5 w-3.5 text-[#8CA2FF]" />
              <span>{currentQualityLabel}</span>
            </button>
            {openMenu === 'quality' && (
              <div
                data-testid="player-quality-menu"
                className="absolute bottom-10 left-0 z-30 min-w-[150px] rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => handleQualityChange(-1)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs font-bold ${
                    selectedLevel === -1
                      ? 'bg-indigo-900 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>تلقائي (Auto)</span>
                </button>
                {levels.map((lvl) => (
                  <button
                    key={lvl.index}
                    type="button"
                    onClick={() => handleQualityChange(lvl.index)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs font-bold tabular-nums ${
                      selectedLevel === lvl.index
                        ? 'bg-indigo-900 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span dir="ltr">{lvl.height}p</span>
                    <span className="text-[10px] text-slate-400" dir="ltr">
                      {Math.round(lvl.bitrate / 1000)} kbps
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void syncProgress(true, 0);
              void syncAnalyticsHeartbeat(true);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            تحديد كمكتمل
          </Button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            aria-label="ملء الشاشة"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
