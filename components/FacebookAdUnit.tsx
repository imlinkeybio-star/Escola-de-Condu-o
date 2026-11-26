'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BadgeCheck,
  ExternalLink,
  Globe,
  Maximize2,
  Megaphone,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BroadcastItem } from '@/lib/types';
import {
  getSafeLinkHostLabel,
  isInternalPath,
  parseCleanVideoSource,
  sanitizeSafeUrl,
} from '@/lib/url-safety';

interface CleanShieldedVideoProps {
  mediaUrl?: string | null;
  title: string;
  playing: boolean;
  muted: boolean;
  fullscreen?: boolean;
  onTogglePlay?: () => void;
}

/**
 * Renders video playback cleanly without revealing host branding, YouTube/Vimeo
 * settings menus, channel headers, or external watch-page spoilers.
 */
export function CleanShieldedVideo({
  mediaUrl,
  title,
  playing,
  muted,
  fullscreen = false,
  onTogglePlay,
}: CleanShieldedVideoProps) {
  const source = parseCleanVideoSource(mediaUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [veilVisible, setVeilVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVeilVisible(false), 950);
    return () => clearTimeout(id);
  }, [mediaUrl]);

  // Control native <video>
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !source || source.kind !== 'direct') return;
    vid.muted = muted;
    if (playing) {
      void vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [playing, muted, source]);

  // Control YouTube / Vimeo iframes via postMessage (no host controls needed)
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
      sendYt(playing ? 'playVideo' : 'pauseVideo');
      sendYt(muted ? 'mute' : 'unMute');
      if (!muted) sendYt('setVolume', [100]);
    } else if (source.kind === 'vimeo') {
      const sendVimeo = (method: string, value?: unknown) => {
        frame.contentWindow?.postMessage(
          JSON.stringify({ method, value }),
          '*'
        );
      };
      sendVimeo(playing ? 'play' : 'pause');
      sendVimeo('setVolume', muted ? 0 : 1);
    }
  }, [playing, muted, source]);

  if (!source) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090C14] text-slate-300 p-6 text-center gap-2">
        <Megaphone className="w-8 h-8 text-amber-400" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black select-none"
      onClick={onTogglePlay}
    >
      {source.kind === 'direct' ? (
        <video
          ref={videoRef}
          src={source.embedUrl}
          autoPlay={playing}
          muted={muted}
          loop
          playsInline
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className={`w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
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
              className="pointer-events-none select-none border-0 w-full h-full scale-[1.18]"
            />
            {/* Edge matte masks hide any host top title bar or bottom logo watermark */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black via-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black via-black/80 to-transparent" />
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
            A preparar anúncio em vídeo...
          </p>
        </div>
      )}

      {/* Custom Pause Shield hides host "More videos" suggestions when paused */}
      {!playing && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-16 h-16 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-2xl">
            <Play className="w-7 h-7 fill-white ml-1" />
          </div>
          <span className="text-xs font-bold text-white tracking-wide">
            Vídeo em pausa — Clica para retomar
          </span>
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
 * Full-screen Facebook-style video ad modal with zero external host settings/spoilers.
 */
export function FullscreenVideoAdModal({
  ad,
  secondsLeft,
  totalDuration,
  isPreview = false,
  onClose,
}: FullscreenVideoAdModalProps) {
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);

  const safeLink = sanitizeSafeUrl(ad.linkUrl);
  const hostLabel = getSafeLinkHostLabel(ad.linkUrl);
  const progressPct =
    typeof secondsLeft === 'number' && typeof totalDuration === 'number' && totalDuration > 0
      ? Math.max(0, Math.min(100, (secondsLeft / totalDuration) * 100))
      : null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleTogglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Anúncio em vídeo: ${ad.title}`}
      className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-black flex flex-col overflow-hidden"
    >
      {/* Full-viewport shielded video canvas */}
      <div className="relative flex-1 w-full h-full min-h-0 flex items-center justify-center bg-black">
        <CleanShieldedVideo
          mediaUrl={ad.mediaUrl}
          title={ad.title}
          playing={playing}
          muted={muted}
          fullscreen
          onTogglePlay={handleTogglePlay}
        />

        {/* Facebook-style Floating Sponsor Top Bar */}
        <div className="absolute inset-x-0 top-0 z-20 p-3 sm:p-5 bg-gradient-to-b from-black/90 via-black/55 to-transparent flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white p-1 shrink-0 ring-2 ring-[#1877F2]/60 flex items-center justify-center overflow-hidden">
              <Image
                src="/assets/aistudio/favicon_14076ff5.png"
                alt="Escola de Condução Live"
                width={36}
                height={28}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">
                  Escola de Condução Live
                </span>
                <BadgeCheck className="w-4 h-4 text-[#1877F2] shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>Patrocinado</span>
                <span aria-hidden="true">·</span>
                <Globe className="w-3 h-3 text-slate-300 shrink-0" />
                {isPreview ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-semibold">
                      Pré-visualização
                    </span>
                  </>
                ) : (
                  typeof secondsLeft === 'number' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-amber-300">
                        {secondsLeft}s
                      </span>
                    </>
                  )
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar anúncio em tela inteira"
            title="Fechar anúncio"
            className="min-w-[44px] min-h-[44px] px-3 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center gap-1.5 text-xs font-bold backdrop-blur-md cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        </div>

        {/* Facebook-style Bottom Ad Copy, Custom Media Controls & Blue CTA Bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-6 bg-gradient-to-t from-black via-black/85 to-transparent space-y-3">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400">
                {hostLabel}
              </p>
              <h2 className="text-base sm:text-xl font-bold text-white leading-snug break-words">
                {ad.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl break-words">
                {ad.body}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
              >
                {playing ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                {playing ? 'Pausar' : 'Reproduzir'}
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md cursor-pointer ${
                  muted
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                {muted ? 'Ativar Som' : 'Som Ativo'}
              </button>

              {safeLink &&
                (isInternalPath(safeLink) ? (
                  <Link
                    href={safeLink}
                    onClick={onClose}
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>{ad.linkLabel || 'Saber Mais'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <a
                    href={safeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>{ad.linkLabel || 'Saber Mais'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
            </div>
          </div>

          {progressPct !== null && (
            <div className="max-w-5xl mx-auto h-1 w-full bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1877F2] transition-all duration-1000 linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
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
 * Facebook Feed Sponsored Ad format for Banner (`ad_banner`) & Video (`ad_video`).
 */
export function FacebookStyleAdCard({
  ad,
  compact = false,
  secondsLeft,
  totalDuration,
  onDismiss,
  onOpenFullscreen,
}: FacebookStyleAdCardProps) {
  const [imgError, setImgError] = useState(false);
  const safeLink = sanitizeSafeUrl(ad.linkUrl);
  const safeMedia = sanitizeSafeUrl(ad.mediaUrl);
  const hostLabel = getSafeLinkHostLabel(ad.linkUrl);
  const isVideo = ad.kind === 'ad_video';
  const progressPct =
    typeof secondsLeft === 'number' && typeof totalDuration === 'number' && totalDuration > 0
      ? Math.max(0, Math.min(100, (secondsLeft / totalDuration) * 100))
      : null;

  return (
    <article
      aria-label={`Anúncio patrocinado: ${ad.title}`}
      className="bg-[#141925] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl min-w-0"
    >
      {/* Facebook Sponsored Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-white p-1 shrink-0 ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
            <Image
              src="/assets/aistudio/favicon_14076ff5.png"
              alt="Escola de Condução Live"
              width={36}
              height={28}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white truncate">
                Escola de Condução Live
              </span>
              <BadgeCheck className="w-4 h-4 text-[#1877F2] shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Patrocinado</span>
              <span aria-hidden="true">·</span>
              <Globe className="w-3 h-3 shrink-0" />
              {ad.aiGenerated && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Sparkles className="w-3 h-3" />
                    IA
                  </span>
                </>
              )}
              {typeof secondsLeft === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-amber-300 font-semibold">
                    {secondsLeft}s
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar anúncio"
            title="Fechar anúncio"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Facebook Primary Ad Copy */}
      <div className="px-4 pb-3">
        <p
          className={`text-sm text-slate-200 leading-relaxed break-words ${
            compact ? 'line-clamp-2' : ''
          }`}
        >
          {ad.body}
        </p>
      </div>

      {/* Facebook Edge-to-Edge Creative Media */}
      {isVideo ? (
        <div
          className={`relative w-full bg-black overflow-hidden group cursor-pointer ${
            compact ? 'aspect-[21/9] max-h-56' : 'aspect-video max-h-96'
          }`}
          onClick={() => onOpenFullscreen?.(ad)}
        >
          {safeMedia ? (
            <CleanShieldedVideo
              mediaUrl={safeMedia}
              title={ad.title}
              playing
              muted
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0F172A] via-[#172554] to-[#090C14] flex items-center justify-center p-6">
              <p className="text-base font-bold text-white text-center">
                {ad.title}
              </p>
            </div>
          )}

          {/* Clean Facebook Watch Play / Fullscreen Preview Trigger */}
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors flex items-center justify-center z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullscreen?.(ad);
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#1877F2]/95 hover:bg-[#166FE5] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-2xl cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              Ver em Tela Inteira
            </button>
          </div>
        </div>
      ) : safeMedia && !imgError ? (
        <div
          className={`relative w-full bg-[#090C14] overflow-hidden ${
            compact ? 'h-36 sm:h-44' : 'aspect-[16/9] max-h-80'
          }`}
        >
          <Image
            src={safeMedia}
            alt={ad.title}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div
          className={`relative w-full bg-gradient-to-br from-[#132247] via-[#1B2A4A] to-[#0E1320] px-5 ${
            compact ? 'py-4' : 'py-8'
          } flex items-center justify-between gap-4 border-y border-white/[0.06]`}
        >
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold tracking-wider text-sky-300 uppercase">
              Campanha Oficial
            </p>
            <p className="font-display text-lg sm:text-2xl font-extrabold text-white leading-snug break-words">
              {ad.title}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6 text-[#1877F2]" />
          </div>
        </div>
      )}

      {/* Facebook Link & Headline Action Footer */}
      <div className="px-4 py-3 bg-[#1B2233] border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400 truncate">
            {hostLabel}
          </p>
          <p className="text-sm font-bold text-white truncate">{ad.title}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isVideo && onOpenFullscreen && (
            <button
              type="button"
              onClick={() => onOpenFullscreen(ad)}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Tela Inteira
            </button>
          )}

          {safeLink &&
            (isInternalPath(safeLink) ? (
              <Link
                href={safeLink}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{ad.linkLabel || 'Saber Mais'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{ad.linkLabel || 'Saber Mais'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ))}
        </div>
      </div>

      {progressPct !== null && (
        <div className="h-0.5 w-full bg-white/10">
          <div
            className="h-full bg-[#1877F2] transition-all duration-1000 linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </article>
  );
}
