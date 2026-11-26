'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Megaphone,
  Pause,
  Play,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { BroadcastItem } from '@/lib/types';
import { isInternalPath, sanitizeSafeUrl } from '@/lib/url-safety';
import {
  FacebookStyleAdCard,
  FullscreenVideoAdModal,
} from './FacebookAdUnit';

const LS_LAST_SHOWN = 'escola_ad_last_shown_at';
const LS_CURSOR = 'escola_ad_cursor';
const LS_ACTIVE_AD = 'escola_ad_active_window';

interface StoredActiveWindow {
  id: string;
  expiresAtMs: number;
}

function getKindBadge(kind: BroadcastItem['kind']): string {
  switch (kind) {
    case 'ad_audio':
      return 'Anúncio Áudio';
    case 'ad_video':
      return 'Anúncio Vídeo';
    case 'ad_banner':
      return 'Anúncio';
    case 'link':
      return 'Destaque';
    default:
      return 'Aviso';
  }
}

export function AdBroadcastBanner({
  broadcasts,
}: {
  broadcasts: BroadcastItem[];
}) {
  const bannerPool = useMemo(
    () => broadcasts.filter((b) => b.active && b.showInBanner),
    [broadcasts]
  );
  const [activeAd, setActiveAd] = useState<BroadcastItem | null>(null);
  const [previewVideoAd, setPreviewVideoAd] = useState<BroadcastItem | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAllMedia = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setAudioPlaying(false);
  }, []);

  const dismissAd = useCallback(() => {
    stopAllMedia();
    try {
      localStorage.setItem(LS_LAST_SHOWN, String(Date.now()));
      localStorage.removeItem(LS_ACTIVE_AD);
    } catch {
      // Ignore storage errors
    }
    setActiveAd(null);
  }, [stopAllMedia]);

  // Listen for owner instant preview events (timed banner/fullscreen OR manual fullscreen preview)
  useEffect(() => {
    const onPreview = (ev: Event) => {
      const custom = ev as CustomEvent<BroadcastItem>;
      if (!custom.detail) return;
      stopAllMedia();
      const dur = Math.min(Math.max(custom.detail.durationSeconds || 10, 5), 60);
      try {
        localStorage.setItem(
          LS_ACTIVE_AD,
          JSON.stringify({
            id: custom.detail.id,
            expiresAtMs: Date.now() + dur * 1000,
          })
        );
      } catch {
        // Ignore
      }
      setActiveAd(custom.detail);
      setSecondsLeft(dur);
    };

    const onFullscreenPreview = (ev: Event) => {
      const custom = ev as CustomEvent<BroadcastItem>;
      if (!custom.detail) return;
      stopAllMedia();
      setPreviewVideoAd(custom.detail);
    };

    window.addEventListener('escola:preview-ad', onPreview);
    window.addEventListener('escola:preview-fullscreen-video', onFullscreenPreview);
    return () => {
      window.removeEventListener('escola:preview-ad', onPreview);
      window.removeEventListener(
        'escola:preview-fullscreen-video',
        onFullscreenPreview
      );
    };
  }, [stopAllMedia]);

  // Schedule ad selection respecting duration & 15-minute cooldown
  useEffect(() => {
    if (bannerPool.length === 0) return;

    const evaluateSchedule = () => {
      try {
        const rawActive = localStorage.getItem(LS_ACTIVE_AD);
        if (rawActive) {
          const parsed = JSON.parse(rawActive) as StoredActiveWindow;
          const remaining = Math.ceil((parsed.expiresAtMs - Date.now()) / 1000);
          if (remaining > 0) {
            const match = bannerPool.find((b) => b.id === parsed.id);
            if (match) {
              setActiveAd(match);
              setSecondsLeft(remaining);
              return;
            }
          } else {
            localStorage.removeItem(LS_ACTIVE_AD);
            localStorage.setItem(LS_LAST_SHOWN, String(Date.now()));
          }
        }

        const lastShownMs = Number(localStorage.getItem(LS_LAST_SHOWN) || '0');
        const cursor = Number(localStorage.getItem(LS_CURSOR) || '0');
        const nextAd = bannerPool[cursor % bannerPool.length];
        const cooldownMs = Math.max(nextAd.cooldownMinutes || 15, 1) * 60 * 1000;

        if (lastShownMs === 0 || Date.now() - lastShownMs >= cooldownMs) {
          const dur = Math.min(Math.max(nextAd.durationSeconds || 10, 5), 60);
          const expiresAtMs = Date.now() + dur * 1000;
          localStorage.setItem(
            LS_ACTIVE_AD,
            JSON.stringify({ id: nextAd.id, expiresAtMs })
          );
          localStorage.setItem(LS_CURSOR, String((cursor + 1) % bannerPool.length));
          setActiveAd(nextAd);
          setSecondsLeft(dur);
        }
      } catch {
        // Ignore localStorage restrictions
      }
    };

    const initId = setTimeout(evaluateSchedule, 0);
    const pollId = setInterval(evaluateSchedule, 15000);
    return () => {
      clearTimeout(initId);
      clearInterval(pollId);
    };
  }, [bannerPool]);

  // 1-second countdown ticker while a scheduled ad is visible
  useEffect(() => {
    if (!activeAd) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          dismissAd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeAd, dismissAd]);

  useEffect(() => {
    return () => stopAllMedia();
  }, [stopAllMedia]);

  const handleToggleTtsAudio = async () => {
    if (!activeAd) return;
    if (audioPlaying && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      setAudioPlaying(false);
      return;
    }
    setAudioLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          text: `${activeAd.title}. ${activeAd.body}`,
        }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        audioBase64?: string;
        mimeType?: string;
      };
      if (!json.audioBase64) return;
      const audio = new Audio(
        `data:${json.mimeType || 'audio/wav'};base64,${json.audioBase64}`
      );
      ttsAudioRef.current = audio;
      audio.onended = () => setAudioPlaying(false);
      audio.onerror = () => setAudioPlaying(false);
      setAudioPlaying(true);
      await audio.play();
    } catch {
      setAudioPlaying(false);
    } finally {
      setAudioLoading(false);
    }
  };

  // Manual full-screen preview takes precedence if open
  if (previewVideoAd) {
    return (
      <FullscreenVideoAdModal
        ad={previewVideoAd}
        isPreview
        onClose={() => setPreviewVideoAd(null)}
      />
    );
  }

  if (!activeAd) return null;

  const totalDur = Math.min(Math.max(activeAd.durationSeconds || 10, 5), 60);

  // Video ads open directly in full screen with zero host settings or spoilers
  if (activeAd.kind === 'ad_video') {
    return (
      <FullscreenVideoAdModal
        ad={activeAd}
        secondsLeft={secondsLeft}
        totalDuration={totalDur}
        onClose={dismissAd}
      />
    );
  }

  // Banner ads use the Facebook Sponsored Ad format below the topbar
  if (activeAd.kind === 'ad_banner') {
    return (
      <div
        role="region"
        aria-label="Anúncio Patrocinado"
        className="w-full bg-[#090D16] border-b border-white/[0.08] py-3 px-3 sm:px-6 lg:px-8 z-10"
      >
        <div className="max-w-3xl mx-auto">
          <FacebookStyleAdCard
            ad={activeAd}
            compact
            secondsLeft={secondsLeft}
            totalDuration={totalDur}
            onDismiss={dismissAd}
          />
        </div>
      </div>
    );
  }

  // Informative, Link, and Audio ads remain sleek compact strips below topbar
  const safeLink = sanitizeSafeUrl(activeAd.linkUrl);
  const safeMedia = sanitizeSafeUrl(activeAd.mediaUrl);
  const progressPct = Math.max(0, Math.min(100, (secondsLeft / totalDur) * 100));

  return (
    <div
      role="region"
      aria-label="Anúncio ou Notificação"
      className="w-full bg-[#111626] border-b border-amber-500/30 shadow-lg z-10 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            {activeAd.kind === 'ad_audio' ? (
              <Volume2 className="w-4 h-4" />
            ) : activeAd.aiGenerated ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Megaphone className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                {getKindBadge(activeAd.kind)}
                {activeAd.aiGenerated ? ' · IA' : ''}
              </span>
              <span className="font-mono-tabular text-[10px] text-slate-400">
                {secondsLeft}s
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">
              {activeAd.title}
            </p>
            <p className="text-xs text-slate-300 line-clamp-2 break-words">
              {activeAd.body}
            </p>
          </div>
        </div>

        {activeAd.kind === 'ad_audio' && (
          <div className="flex items-center gap-2 shrink-0 max-w-full">
            {safeMedia ? (
              <audio
                ref={audioElRef}
                src={safeMedia}
                controls
                className="h-8 max-w-[220px] sm:max-w-[260px]"
              />
            ) : (
              <button
                type="button"
                onClick={handleToggleTtsAudio}
                disabled={audioLoading}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {audioPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {audioLoading
                  ? 'A carregar...'
                  : audioPlaying
                    ? 'Pausar Áudio'
                    : 'Ouvir Áudio'}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 shrink-0">
          {safeLink &&
            (isInternalPath(safeLink) ? (
              <Link
                href={safeLink}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>{activeAd.linkLabel || 'Abrir'}</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>{activeAd.linkLabel || 'Abrir Link'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}

          <button
            type="button"
            onClick={dismissAd}
            aria-label="Fechar anúncio"
            title="Fechar anúncio"
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-0.5 w-full bg-white/10">
        <div
          className="h-full bg-amber-400 transition-all duration-1000 linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
