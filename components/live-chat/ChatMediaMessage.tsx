'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  Maximize2,
  Mic,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ChatMessage } from '@/lib/chat-types';
import {
  fetchOriginalFileBlob,
  formatFileSize,
  triggerOriginalFileDownload,
} from '@/lib/chat-service';
import { useLanguage } from '@/components/LanguageProvider';

interface ChatMediaMessageProps {
  chatId: string;
  message: ChatMessage;
  onOpenImage: (msg: ChatMessage) => void;
  onOpenEnhancer: (msg: ChatMessage) => void;
}

function formatSecs(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ChatMediaMessage({
  chatId,
  message,
  onOpenImage,
  onOpenEnhancer,
}: ChatMediaMessageProps) {
  const { dict } = useLanguage();
  const attachment = message.attachment;

  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [blobError, setBlobError] = useState('');

  // Audio / Video controls state (distinct from Video Ads!)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(attachment?.durationSec || 0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [muted, setMuted] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!attachment) return;
    if (attachment.category === 'image' && !attachment.previewDataUrl) {
      let active = true;
      fetchOriginalFileBlob(chatId, attachment.fileId, attachment.mimeType)
        .then(({ url }) => {
          if (!active) return;
          setBlobUrl(url);
          setLoadingBlob(false);
        })
        .catch(() => {
          if (active) setLoadingBlob(false);
        });
      return () => {
        active = false;
      };
    }
  }, [chatId, attachment]);

  if (!attachment) return null;

  const ensureMediaLoaded = async (): Promise<string | null> => {
    if (blobUrl) return blobUrl;
    setLoadingBlob(true);
    setBlobError('');
    try {
      const { url } = await fetchOriginalFileBlob(
        chatId,
        attachment.fileId,
        attachment.mimeType
      );
      setBlobUrl(url);
      setLoadingBlob(false);
      return url;
    } catch (err) {
      setBlobError(
        err instanceof Error ? err.message : 'Erro ao carregar ficheiro.'
      );
      setLoadingBlob(false);
      return null;
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await triggerOriginalFileDownload(chatId, attachment);
    } finally {
      setDownloading(false);
    }
  };

  if (attachment.category === 'image') {
    const displaySrc = blobUrl || attachment.previewDataUrl || '';
    return (
      <div className="space-y-1.5 min-w-[200px] max-w-[320px]">
        <div
          onClick={() => onOpenImage(message)}
          className="relative rounded-xl overflow-hidden bg-black/50 border border-white/10 cursor-pointer group"
        >
          {displaySrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displaySrc}
              alt={attachment.fileName}
              className="w-full max-h-64 object-cover group-hover:scale-[1.01] transition-transform"
            />
          ) : (
            <div className="h-44 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#22C55E]" />
            </div>
          )}

          <div className="absolute top-2 start-2 flex flex-wrap gap-1">
            <span className="px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[10px] font-bold text-white">
              {attachment.isEnhanced
                ? dict.chat.enhancedCopyBadge
                : attachment.sendMode === 'original'
                  ? dict.chat.originalFileBadge
                  : dict.chat.quickSendBadge}
            </span>
          </div>
          {loadingBlob && (
            <div className="absolute bottom-2 end-2 w-6 h-6 rounded-full bg-black/75 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22C55E]" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-300">
          <span className="truncate max-w-[140px]">
            {attachment.width && attachment.height
              ? `${attachment.width}×${attachment.height} · `
              : ''}
            {formatFileSize(attachment.sizeBytes)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenEnhancer(message)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FACC15]/15 hover:bg-[#FACC15]/25 border border-[#FACC15]/35 text-[#FACC15] text-[10px] font-bold cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              HD
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              title={dict.chat.downloadOriginalAction}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/35 text-[#22C55E] text-[10px] font-bold cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {attachment.extension.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (attachment.category === 'audio') {
    const toggleAudioPlay = async () => {
      const url = await ensureMediaLoaded();
      if (!url) return;
      const el = audioRef.current;
      if (!el) return;
      if (!el.src || el.src !== url) {
        el.src = url;
      }
      el.playbackRate = speed;
      if (el.paused) {
        await el.play().catch(() => {});
        setPlaying(true);
      } else {
        el.pause();
        setPlaying(false);
      }
    };

    const cycleSpeed = () => {
      const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
      setSpeed(next);
      if (audioRef.current) audioRef.current.playbackRate = next;
    };

    const progressRatio =
      durationSec > 0 ? Math.min(1, currentSec / durationSec) : 0;

    return (
      <div className="w-full min-w-[230px] max-w-[310px] p-2.5 rounded-xl bg-black/45 border border-white/10 space-y-2">
        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration)) {
              setDurationSec(e.currentTarget.duration);
            }
          }}
          onEnded={() => {
            setPlaying(false);
            setCurrentSec(0);
          }}
        />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void toggleAudioPlay()}
            aria-label={playing ? dict.ads.pauseBtn : dict.ads.playBtn}
            className="w-9 h-9 rounded-full bg-[#22C55E] hover:bg-emerald-400 text-black flex items-center justify-center shrink-0 cursor-pointer"
          >
            {loadingBlob ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ms-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            {/* Reactive bar visual + seekable scrubber */}
            <div className="flex items-end gap-0.5 h-5">
              {Array.from({ length: 24 }).map((_, i) => {
                const activeBar = i / 24 <= progressRatio;
                const barH = 35 + ((i * 29 + 17) % 65);
                return (
                  <span
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      activeBar ? 'bg-[#22C55E]' : 'bg-white/20'
                    }`}
                    style={{ height: `${barH}%` }}
                  />
                );
              })}
            </div>
            <input
              type="range"
              min={0}
              max={durationSec || 1}
              step={0.1}
              value={currentSec}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCurrentSec(val);
                if (audioRef.current) audioRef.current.currentTime = val;
              }}
              className="w-full h-1 accent-[#22C55E] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={cycleSpeed}
            className="px-2 py-1 rounded-lg bg-[#FACC15]/15 border border-[#FACC15]/30 text-[10px] font-extrabold text-[#FACC15] cursor-pointer shrink-0"
          >
            {speed}x
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1 truncate">
            <Mic className="w-3 h-3 text-[#22C55E]" />
            {formatSecs(currentSec)} / {formatSecs(durationSec)} ·{' '}
            {formatFileSize(attachment.sizeBytes)}
          </span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="inline-flex items-center gap-1 text-[#22C55E] hover:underline font-bold cursor-pointer"
          >
            <Download className="w-3 h-3" />
            {attachment.extension.toUpperCase()}
          </button>
        </div>
        {blobError && (
          <p className="text-[10px] text-red-400">{blobError}</p>
        )}
      </div>
    );
  }

  if (attachment.category === 'video') {
    const loadAndPlayVideo = async () => {
      const url = await ensureMediaLoaded();
      if (!url) return;
      const el = videoRef.current;
      if (!el) return;
      if (!el.src || el.src !== url) el.src = url;
      el.playbackRate = speed;
      if (el.paused) {
        await el.play().catch(() => {});
        setPlaying(true);
      } else {
        el.pause();
        setPlaying(false);
      }
    };

    const cycleSpeed = () => {
      const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
      setSpeed(next);
      if (videoRef.current) videoRef.current.playbackRate = next;
    };

    return (
      <>
        <div className="w-full min-w-[220px] max-w-[320px] rounded-xl overflow-hidden bg-black/70 border border-white/10 space-y-1.5 p-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              src={blobUrl || undefined}
              muted={muted}
              playsInline
              onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) {
                  setDurationSec(e.currentTarget.duration);
                }
              }}
              onEnded={() => setPlaying(false)}
              className="w-full h-full object-contain"
            />
            {!playing && (
              <button
                type="button"
                onClick={() => void loadAndPlayVideo()}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 hover:bg-black/30 transition-colors cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-[#22C55E] text-black flex items-center justify-center shadow-lg">
                  {loadingBlob ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 ms-0.5" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-white mt-1.5 px-2 truncate max-w-[90%]">
                  {attachment.fileName}
                </span>
              </button>
            )}
          </div>

          {/* Full user controls for chat video messages */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void loadAndPlayVideo()}
              className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center cursor-pointer"
            >
              {playing ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={durationSec || 1}
              step={0.1}
              value={currentSec}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCurrentSec(v);
                if (videoRef.current) videoRef.current.currentTime = v;
              }}
              className="flex-1 h-1 accent-[#22C55E] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => {
                setMuted((m) => !m);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
              className="w-7 h-7 rounded-lg bg-white/[0.08] text-slate-200 flex items-center justify-center cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-1 rounded-md bg-white/[0.08] text-[10px] font-bold text-[#FACC15] cursor-pointer"
            >
              {speed}x
            </button>
            <button
              type="button"
              onClick={() => {
                void ensureMediaLoaded().then((u) => {
                  if (u) setVideoModalOpen(true);
                });
              }}
              className="w-7 h-7 rounded-lg bg-white/[0.08] text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Film className="w-3 h-3 text-[#22C55E]" />
              {formatSecs(currentSec)} / {formatSecs(durationSec)} ·{' '}
              {formatFileSize(attachment.sizeBytes)}
            </span>
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-1 text-[#22C55E] font-bold hover:underline cursor-pointer"
            >
              <Download className="w-3 h-3" />
              {dict.chat.downloadOrigBtn}
            </button>
          </div>
        </div>

        {videoModalOpen && blobUrl && (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col p-4">
            <div className="flex items-center justify-between pb-3">
              <span className="text-sm font-bold text-white truncate">
                {attachment.fileName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22C55E] text-black text-xs font-extrabold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {dict.chat.downloadOriginalAction}
                </button>
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-0">
              <video
                src={blobUrl}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-xl"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Document or Archive / Other file
  const extUpper = attachment.extension.toUpperCase();
  const isSheet = ['XLS', 'XLSX', 'CSV'].includes(extUpper);
  const isArchive = ['ZIP', 'RAR', '7Z'].includes(extUpper);
  const IconComp = isSheet
    ? FileSpreadsheet
    : isArchive
      ? FileArchive
      : FileText;

  return (
    <div className="w-full min-w-[220px] max-w-[320px] p-3 rounded-xl bg-black/50 border border-white/10 space-y-2">
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]/35 text-[#FACC15] flex flex-col items-center justify-center shrink-0">
          <IconComp className="w-4 h-4" />
          <span className="text-[8px] font-black leading-none mt-0.5">
            {extUpper.slice(0, 4)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white break-all line-clamp-2">
            {attachment.fileName}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {formatFileSize(attachment.sizeBytes)} ·{' '}
            <span className="text-[#22C55E] font-semibold">
              {attachment.sendMode === 'original'
                ? dict.chat.originalFileBadge
                : dict.chat.quickSendBadge}
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="w-full py-2 px-3 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/35 text-[#22C55E] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
      >
        {downloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {dict.chat.downloadOriginalAction}
      </button>
    </div>
  );
}
