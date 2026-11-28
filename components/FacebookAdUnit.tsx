'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BadgeCheck,
  ChevronRight,
  Info,
  Maximize2,
  Megaphone,
  Minimize2,
  Play,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BroadcastItem } from '@/lib/types';
import {
  clampAdDurationSeconds,
  isInternalPath,
  parseCleanVideoSource,
  sanitizeSafeUrl,
} from '@/lib/url-safety';
import { useLanguage } from './LanguageProvider';

const OFFICIAL_AD_ARTWORK =
  '/assets/aistudio/file_00000000fb7882109cedcd39cb72cba5_217ff234.png';
const OFFICIAL_BANNER_ARTWORK =
  '/assets/aistudio/file_000000005a5481f4b37d7ec08cde09f8_4000bbfd.png';
const BRAND_LOGO = '/assets/aistudio/favicon_14076ff5.png';
const MAX_VIDEO_AD_SECONDS = 20;

export interface ExactVideoTiming {
  currentSec: number;
  totalSec: number;
  remainingSec: number;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface CircularCountdownProps {
  remainingSec: number;
  totalSec: number;
  size?: 'sm' | 'lg';
}

function CircularCountdown({
  remainingSec,
  totalSec,
  size = 'lg',
}: CircularCountdownProps) {
  const safeTotal = Math.max(1, totalSec);
  const safeRem = Math.max(0, Math.min(safeTotal, remainingSec));
  const ratio = safeRem / safeTotal;
  const r = size === 'lg' ? 19 : 16;
  const box = size === 'lg' ? 46 : 40;
  const c = box / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - ratio);
  const displayNumber = String(Math.max(0, Math.ceil(safeRem))).padStart(2, '0');

  return (
    <div
      dir="ltr"
      className={`relative flex items-center justify-center rounded-full bg-black/70 backdrop-blur-md shadow-lg ${
        size === 'lg' ? 'w-[46px] h-[46px]' : 'w-[40px] h-[40px]'
      }`}
      aria-label={`${displayNumber}s`}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={size === 'lg' ? 3 : 2.5}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="#FACC15"
          strokeWidth={size === 'lg' ? 3 : 2.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-200 linear"
        />
      </svg>
      <span
        className={`absolute font-mono-tabular font-extrabold text-white leading-none ${
          size === 'lg' ? 'text-xs' : 'text-[11px]'
        }`}
      >
        {displayNumber}
      </span>
    </div>
  );
}

interface CleanShieldedVideoProps {
  mediaUrl?: string | null;
  title: string;
  muted: boolean;
  fullscreen?: boolean;
  maxDurationSeconds?: number;
  loopPreview?: boolean;
  onPlaybackActiveChange?: (active: boolean) => void;
  onMediaError?: (failed: boolean) => void;
  onExactTimingUpdate?: (timing: ExactVideoTiming) => void;
  onVideoEnded?: () => void;
}

/**
 * Renders continuous, unpausable video playback cleanly without revealing host
 * branding, YouTube/Vimeo settings menus, or progress scrubbers.
 */
export function CleanShieldedVideo({
  mediaUrl,
  title,
  muted,
  fullscreen = false,
  maxDurationSeconds = MAX_VIDEO_AD_SECONDS,
  loopPreview = false,
  onPlaybackActiveChange,
  onMediaError,
  onExactTimingUpdate,
  onVideoEnded,
}: CleanShieldedVideoProps) {
  const { dict } = useLanguage();
  const source = parseCleanVideoSource(mediaUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const endedRef = useRef(false);
  const [veilVisible, setVeilVisible] = useState(true);
  const [mediaLoadErrorUrl, setMediaLoadErrorUrl] = useState<string | null>(null);
  const mediaLoadError = mediaLoadErrorUrl === (mediaUrl || '');

  const effectiveCap = Math.min(Math.max(maxDurationSeconds, 1), MAX_VIDEO_AD_SECONDS);

  useEffect(() => {
    endedRef.current = false;
    onMediaError?.(false);
    const id = setTimeout(() => setVeilVisible(false), 900);
    return () => clearTimeout(id);
  }, [mediaUrl, onMediaError]);

  // Keep native <video> continuously playing and synced with mute state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !source || source.kind !== 'direct') return;
    vid.muted = muted;
    void vid.play().catch(() => {
      // Fallback: ensure muted autoplay if unmuted autoplay was blocked by browser
      if (!vid.muted) {
        vid.muted = true;
        void vid.play().catch(() => {});
      }
    });
  }, [muted, source]);

  // Control YouTube / Vimeo embeds cleanly via postMessage
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !frame.contentWindow || !source) return;

    if (source.kind === 'youtube') {
      const sendYt = (func: string, args: unknown[] = []) => {
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      };
      sendYt('playVideo');
      sendYt(muted ? 'mute' : 'unMute');
      if (!muted) sendYt('setVolume', [100]);
    } else if (source.kind === 'vimeo') {
      const sendVimeo = (method: string, value?: unknown) => {
        frame.contentWindow?.postMessage(
          JSON.stringify({ method, value }),
          '*'
        );
      };
      sendVimeo('play');
      sendVimeo('setVolume', muted ? 0 : 1);
    }
  }, [muted, source]);

  // Listen to YouTube infoDelivery when available to track exact video duration & stall state
  useEffect(() => {
    if (!source || source.kind !== 'youtube' || loopPreview) return;
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          info?: { currentTime?: number; duration?: number; playerState?: number };
        };
        if (parsed.event === 'infoDelivery' && parsed.info) {
          if (typeof parsed.info.playerState === 'number') {
            // 1 = playing, 3 = buffering
            if (parsed.info.playerState === 1) onPlaybackActiveChange?.(true);
            else if (parsed.info.playerState === 3) onPlaybackActiveChange?.(false);
          }
          const rawDur = parsed.info.duration;
          const rawCur = parsed.info.currentTime;
          if (typeof rawDur === 'number' && rawDur > 0 && typeof rawCur === 'number') {
            const totalSec = Math.min(rawDur, effectiveCap);
            const currentSec = Math.min(Math.max(rawCur, 0), totalSec);
            const remainingSec = Math.max(0, totalSec - currentSec);
            onExactTimingUpdate?.({ currentSec, totalSec, remainingSec });
            if (remainingSec <= 0.05 && !endedRef.current) {
              endedRef.current = true;
              onVideoEnded?.();
            }
          }
          if (parsed.info.playerState === 0 && !endedRef.current) {
            endedRef.current = true;
            onVideoEnded?.();
          }
        }
      } catch {
        // Ignore non-JSON iframe messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [source, effectiveCap, loopPreview, onExactTimingUpdate, onPlaybackActiveChange, onVideoEnded]);

  const handleDirectLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid || loopPreview) return;
    if (Number.isFinite(vid.duration) && vid.duration > 0) {
      const totalSec = Math.min(vid.duration, effectiveCap);
      onExactTimingUpdate?.({
        currentSec: 0,
        totalSec,
        remainingSec: totalSec,
      });
    }
  };

  const handleDirectTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const rawDur =
      Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : effectiveCap;
    const totalSec = Math.min(rawDur, effectiveCap);
    const currentSec = Math.min(Math.max(vid.currentTime, 0), totalSec);
    const remainingSec = Math.max(0, totalSec - currentSec);

    if (!loopPreview) {
      onExactTimingUpdate?.({ currentSec, totalSec, remainingSec });
      if (vid.currentTime >= totalSec - 0.05 && !endedRef.current) {
        endedRef.current = true;
        vid.pause();
        onVideoEnded?.();
      }
    } else if (vid.currentTime >= totalSec) {
      vid.currentTime = 0;
    }
  };

  const handleDirectEnded = () => {
    if (loopPreview) {
      const vid = videoRef.current;
      if (vid) {
        vid.currentTime = 0;
        void vid.play().catch(() => {});
      }
      return;
    }
    if (!endedRef.current) {
      endedRef.current = true;
      onVideoEnded?.();
    }
  };

  if (!source || mediaLoadError) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#090C14] text-slate-200 p-6 text-center gap-2 overflow-hidden">
        <Image
          src={OFFICIAL_AD_ARTWORK}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover opacity-35"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <Megaphone className="w-8 h-8 text-[#FACC15]" />
          <p className="text-sm font-bold text-white">{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {source.kind === 'direct' ? (
        <video
          ref={videoRef}
          src={source.embedUrl}
          autoPlay
          muted={muted}
          playsInline
          onLoadedMetadata={handleDirectLoadedMetadata}
          onTimeUpdate={handleDirectTimeUpdate}
          onPlaying={() => onPlaybackActiveChange?.(true)}
          onWaiting={() => onPlaybackActiveChange?.(false)}
          onStalled={() => onPlaybackActiveChange?.(false)}
          onEnded={handleDirectEnded}
          onError={() => {
            setMediaLoadErrorUrl(mediaUrl || '');
            onPlaybackActiveChange?.(false);
            onMediaError?.(true);
          }}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className={`w-full h-full pointer-events-none ${
            fullscreen ? 'object-contain' : 'object-cover'
          }`}
        />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          <div
            className={`relative overflow-hidden flex items-center justify-center ${
              fullscreen
                ? 'w-full max-w-[177.78dvh] aspect-video max-h-full'
                : 'w-full h-full'
            }`}
          >
            <iframe
              ref={iframeRef}
              src={source.embedUrl}
              title={title}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                onPlaybackActiveChange?.(true);
                if (source.kind === 'youtube' && iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    JSON.stringify({ event: 'listening', id: 'escola_ad_yt' }),
                    '*'
                  );
                }
              }}
              onError={() => {
                setMediaLoadError(true);
                onPlaybackActiveChange?.(false);
                onMediaError?.(true);
              }}
              className="pointer-events-none select-none border-0 w-full h-full scale-[1.18]"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black via-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black via-black/80 to-transparent" />
          </div>
        </div>
      )}

      {/* Brief startup veil prevents initial host watermark/title flash */}
      {veilVisible && source.kind !== 'direct' && (
        <div className="pointer-events-none absolute inset-0 bg-black flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            {dict.ads.preparingVideo}
          </p>
        </div>
      )}
    </div>
  );
}

interface FullscreenVideoAdModalProps {
  ad: BroadcastItem;
  secondsLeft?: number;
  totalDuration?: number;
  isPreview?: boolean;
  onClose: () => void;
}

/**
 * Full-screen video ad modal matching the official UI design:
 * - No pause button, no progress bar.
 * - Exact countdown timer & circular clock capped at max 20s.
 * - Pauses fallback clock while buffering/stalled, closes cleanly when finished.
 */
export function FullscreenVideoAdModal({
  ad,
  totalDuration,
  isPreview = false,
  onClose,
}: FullscreenVideoAdModalProps) {
  const { dict } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [browserFs, setBrowserFs] = useState(false);

  const capSeconds = clampAdDurationSeconds(
    'ad_video',
    totalDuration ?? ad.durationSeconds
  );

  const [timingState, setTimingState] = useState<
    ExactVideoTiming & { adId: string }
  >({
    adId: ad.id,
    currentSec: 0,
    totalSec: capSeconds,
    remainingSec: capSeconds,
  });

  const timing: ExactVideoTiming =
    timingState.adId === ad.id
      ? timingState
      : { currentSec: 0, totalSec: capSeconds, remainingSec: capSeconds };

  const hasNativeTimingRef = useRef(false);
  const isPlaybackActiveRef = useRef(true);
  const elapsedFallbackRef = useRef(0);
  const closedRef = useRef(false);

  const handleCloseSafe = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    closedRef.current = false;
    hasNativeTimingRef.current = false;
    isPlaybackActiveRef.current = true;
    elapsedFallbackRef.current = 0;
  }, [ad.id, capSeconds]);

  // Fallback timer runs only when native <video>/YouTube timing isn't driving it, and pauses on video stall/buffering
  useEffect(() => {
    let lastTick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      if (hasNativeTimingRef.current) return;
      if (!isPlaybackActiveRef.current) return;

      elapsedFallbackRef.current = Math.min(
        elapsedFallbackRef.current + delta,
        capSeconds
      );
      const remaining = Math.max(0, capSeconds - elapsedFallbackRef.current);
      setTimingState({
        adId: ad.id,
        currentSec: elapsedFallbackRef.current,
        totalSec: capSeconds,
        remainingSec: remaining,
      });
      if (remaining <= 0.05) {
        clearInterval(id);
        handleCloseSafe();
      }
    }, 200);
    return () => clearInterval(id);
  }, [ad.id, capSeconds, handleCloseSafe]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseSafe();
    };
    const onFsChange = () => {
      setBrowserFs(Boolean(document.fullscreenElement));
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [handleCloseSafe]);

  const handleExactTimingUpdate = useCallback(
    (next: ExactVideoTiming) => {
      hasNativeTimingRef.current = true;
      setTimingState({ adId: ad.id, ...next });
    },
    [ad.id]
  );

  const handlePlaybackActiveChange = useCallback((active: boolean) => {
    isPlaybackActiveRef.current = active;
  }, []);

  const handleMediaError = useCallback((failed: boolean) => {
    if (failed) {
      // Allow static artwork banner fallback to finish cleanly within cap
      isPlaybackActiveRef.current = true;
    }
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen permission errors inside sandboxed iframes
    }
  };

  const safeLink = sanitizeSafeUrl(ad.linkUrl);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${dict.ads.kindVideo}: ${ad.title}`}
      className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-black flex flex-col overflow-hidden"
    >
      <div className="relative flex-1 w-full h-full min-h-0 flex items-center justify-center bg-black">
        <CleanShieldedVideo
          mediaUrl={ad.mediaUrl}
          title={ad.title}
          muted={muted}
          fullscreen
          maxDurationSeconds={capSeconds}
          onPlaybackActiveChange={handlePlaybackActiveChange}
          onMediaError={handleMediaError}
          onExactTimingUpdate={handleExactTimingUpdate}
          onVideoEnded={handleCloseSafe}
        />

        {/* Top Atmospheric Scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-10" />

        {/* Top Bar matching reference UI: Brand Left + Skip Ad & Circular Countdown Right */}
        <div className="absolute inset-x-0 top-0 z-20 p-3.5 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-black/75 p-1 shrink-0 ring-2 ring-[#FACC15]/70 flex items-center justify-center overflow-hidden shadow-lg">
              <Image
                src={BRAND_LOGO}
                alt={dict.common.brandName}
                width={38}
                height={38}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-extrabold text-white truncate drop-shadow">
                  {dict.common.brandName}
                </span>
                <BadgeCheck className="w-4 h-4 text-[#1D9BF0] shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-200/90 mt-0.5">
                <span className="font-medium">{dict.ads.sponsored}</span>
                <span className="w-4 h-4 rounded-full bg-white/20 text-white inline-flex items-center justify-center shrink-0">
                  <Info className="w-2.5 h-2.5" />
                </span>
                {isPreview && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FACC15] font-bold">
                      {dict.ads.preview}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCloseSafe}
              aria-label={dict.ads.closeAdFullscreenAria}
              className="min-h-[40px] px-4 py-1.5 rounded-full bg-black/65 hover:bg-black/85 border border-white/25 text-white inline-flex items-center gap-2 text-xs sm:text-sm font-bold backdrop-blur-md cursor-pointer shadow-lg transition-colors"
            >
              <span>{dict.ads.skipAd}</span>
              <SkipForward className="w-4 h-4 fill-white rtl:rotate-180" />
            </button>

            <CircularCountdown
              remainingSec={timing.remainingSec}
              totalSec={timing.totalSec}
              size="lg"
            />
          </div>
        </div>

        {/* Bottom Scrim & Content Overlay (NO Pause button, NO Progress bar) */}
        <div className="absolute inset-x-0 bottom-0 z-20 pt-16 bg-gradient-to-t from-black via-black/85 to-transparent">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4 space-y-4">
            {/* Title, Copy & Prominent Yellow CTA */}
            <div className="flex flex-col items-center text-center space-y-2.5">
              <h2 className="font-display text-lg sm:text-2xl font-black text-white leading-tight break-words max-w-2xl drop-shadow">
                {ad.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl line-clamp-2 break-words">
                {ad.body}
              </p>

              {safeLink &&
                (isInternalPath(safeLink) ? (
                  <Link
                    href={safeLink}
                    onClick={handleCloseSafe}
                    className="mt-1 min-h-[48px] px-8 py-2.5 rounded-full bg-[#FACC15] hover:bg-[#FDE047] text-[#090C14] text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(250,204,21,0.35)] transition-transform active:scale-[0.98] whitespace-nowrap"
                  >
                    <span>{ad.linkLabel || dict.common.learnMore}</span>
                    <ChevronRight className="w-5 h-5 stroke-[2.75] rtl:rotate-180" />
                  </Link>
                ) : (
                  <a
                    href={safeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 min-h-[48px] px-8 py-2.5 rounded-full bg-[#FACC15] hover:bg-[#FDE047] text-[#090C14] text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(250,204,21,0.35)] transition-transform active:scale-[0.98] whitespace-nowrap"
                  >
                    <span>{ad.linkLabel || dict.common.learnMore}</span>
                    <ChevronRight className="w-5 h-5 stroke-[2.75] rtl:rotate-180" />
                  </a>
                ))}
            </div>

            {/* Bottom Controls Row: Exact Counter Left + Volume & Fullscreen Right (NO Pause, NO Progress Bar) */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div
                aria-label={dict.ads.exactCounterLabel}
                className="px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md inline-flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-white">
                  {formatClock(timing.currentSec)} / {formatClock(timing.totalSec)}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? dict.ads.unmuteBtn : dict.ads.soundOnBtn}
                  title={muted ? dict.ads.unmuteBtn : dict.ads.soundOnBtn}
                  className={`w-10 h-10 rounded-full inline-flex items-center justify-center backdrop-blur-md cursor-pointer transition-colors ${
                    muted
                      ? 'bg-[#FACC15] hover:bg-[#FDE047] text-[#090C14]'
                      : 'bg-black/60 hover:bg-black/80 border border-white/20 text-white'
                  }`}
                >
                  {muted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleToggleFullscreen()}
                  aria-label={dict.ads.toggleFullscreenAria}
                  title={dict.ads.toggleFullscreenAria}
                  className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white inline-flex items-center justify-center backdrop-blur-md cursor-pointer transition-colors"
                >
                  {browserFs ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Signature Static Lime-Green & Yellow Bottom Edge Accent (NOT a progress bar) */}
          <div
            aria-hidden="true"
            className="h-1.5 w-full bg-gradient-to-r from-[#22C55E] via-[#FACC15] to-[#22C55E]"
          />
        </div>
      </div>
    </div>
  );
}

interface FacebookStyleAdCardProps {
  ad: BroadcastItem;
  compact?: boolean;
  secondsLeft?: number;
  totalDuration?: number;
  onDismiss?: () => void;
  onOpenFullscreen?: (ad: BroadcastItem) => void;
}

/**
 * Official UI Sponsored Ad Card for Banner (`ad_banner`, max 8s) and inline Video (`ad_video`, max 20s) previews.
 * Matches the uploaded reference layout with no pause button and no progress bar.
 */
export function FacebookStyleAdCard({
  ad,
  compact = false,
  secondsLeft,
  totalDuration,
  onDismiss,
  onOpenFullscreen,
}: FacebookStyleAdCardProps) {
  const { dict } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const safeLink = sanitizeSafeUrl(ad.linkUrl);
  const safeMedia = sanitizeSafeUrl(ad.mediaUrl);
  const isVideo = ad.kind === 'ad_video';

  const maxTotal = clampAdDurationSeconds(
    ad.kind,
    totalDuration ?? ad.durationSeconds
  );
  const displayRemaining =
    typeof secondsLeft === 'number'
      ? Math.max(0, Math.min(secondsLeft, maxTotal))
      : maxTotal;

  return (
    <article
      aria-label={`${dict.ads.sponsored}: ${ad.title}`}
      className={`relative rounded-2xl overflow-hidden bg-[#070B14] border border-emerald-400/25 shadow-2xl min-w-0 flex flex-col justify-between ${
        compact ? 'min-h-[225px] sm:min-h-[250px]' : 'min-h-[320px] sm:min-h-[360px]'
      }`}
    >
      {/* Background Artwork / Continuous Video */}
      <div className="absolute inset-0 z-0">
        {isVideo && safeMedia ? (
          <CleanShieldedVideo
            mediaUrl={safeMedia}
            title={ad.title}
            muted
            loopPreview
            maxDurationSeconds={maxTotal}
          />
        ) : (
          <Image
            src={!isVideo && safeMedia && !imgError ? safeMedia : OFFICIAL_BANNER_ARTWORK}
            alt={ad.title}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover object-center"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        )}

        {/* Scrims for crisp readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/85 via-black/45 to-black/95" />
      </div>

      {/* Top Overlay: Brand + Verified Badge Left | Skip Ad + Circular Counter Right */}
      <div className="relative z-10 p-3.5 sm:p-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-black/75 p-1 shrink-0 ring-2 ring-[#FACC15]/60 flex items-center justify-center overflow-hidden shadow">
            <Image
              src={BRAND_LOGO}
              alt={dict.common.brandName}
              width={36}
              height={36}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-extrabold text-white truncate drop-shadow">
                {dict.common.brandName}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#1D9BF0] shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-200">
              <span>{dict.ads.sponsored}</span>
              <span className="w-3.5 h-3.5 rounded-full bg-white/20 text-white inline-flex items-center justify-center shrink-0">
                <Info className="w-2.5 h-2.5" />
              </span>
              {ad.aiGenerated && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-[#FACC15] font-semibold">
                    <Sparkles className="w-3 h-3" />
                    IA
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dict.ads.closeAdLabel}
              className="min-h-[34px] px-3 py-1 rounded-full bg-black/65 hover:bg-black/85 border border-white/25 text-white inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold backdrop-blur-md cursor-pointer shadow"
            >
              <span>{dict.ads.skipAd}</span>
              <SkipForward className="w-3.5 h-3.5 fill-white rtl:rotate-180" />
            </button>
          )}

          <CircularCountdown
            remainingSec={displayRemaining}
            totalSec={maxTotal}
            size="sm"
          />
        </div>
      </div>

      {/* Center / Lower Overlay: Headline, Copy & Yellow CTA */}
      <div className="relative z-10 px-4 sm:px-6 pb-4 pt-3 flex flex-col items-center text-center gap-2.5">
        <div className="max-w-xl space-y-1">
          <h3
            className={`font-display font-black text-white leading-snug break-words drop-shadow ${
              compact ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'
            }`}
          >
            {ad.title}
          </h3>
          <p
            className={`text-xs sm:text-sm text-slate-200 leading-relaxed break-words ${
              compact ? 'line-clamp-2' : 'line-clamp-3'
            }`}
          >
            {ad.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
          {safeLink &&
            (isInternalPath(safeLink) ? (
              <Link
                href={safeLink}
                className="min-h-[42px] px-6 py-2 rounded-full bg-[#FACC15] hover:bg-[#FDE047] text-[#090C14] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-[0_8px_22px_rgba(250,204,21,0.3)] whitespace-nowrap"
              >
                <span>{ad.linkLabel || dict.common.learnMore}</span>
                <ChevronRight className="w-4 h-4 stroke-[2.75] rtl:rotate-180" />
              </Link>
            ) : (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-6 py-2 rounded-full bg-[#FACC15] hover:bg-[#FDE047] text-[#090C14] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-[0_8px_22px_rgba(250,204,21,0.3)] whitespace-nowrap"
              >
                <span>{ad.linkLabel || dict.common.learnMore}</span>
                <ChevronRight className="w-4 h-4 stroke-[2.75] rtl:rotate-180" />
              </a>
            ))}

          {isVideo && onOpenFullscreen && (
            <button
              type="button"
              onClick={() => onOpenFullscreen(ad)}
              className="min-h-[42px] px-4 py-2 rounded-full bg-black/70 hover:bg-black/90 border border-white/25 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 backdrop-blur-md cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{dict.ads.previewFullscreenBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Signature Static Lime-Green & Yellow Bottom Edge Accent (NOT a progress bar) */}
      <div
        aria-hidden="true"
        className="relative z-10 h-1.5 w-full bg-gradient-to-r from-[#22C55E] via-[#FACC15] to-[#22C55E]"
      />
    </article>
  );
}
