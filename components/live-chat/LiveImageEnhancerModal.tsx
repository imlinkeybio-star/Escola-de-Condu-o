'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Download,
  Loader2,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { ChatAttachmentMeta, ChatEnhancementMode } from '@/lib/chat-types';
import { fetchOriginalFileBlob, formatFileSize } from '@/lib/chat-service';
import { enhanceImageBlobInBrowser } from '@/lib/image-enhancer';
import { useLanguage } from '@/components/LanguageProvider';
import { toUserFriendlyError } from '@/lib/error-messages';

interface LiveImageEnhancerModalProps {
  chatId: string;
  attachment: ChatAttachmentMeta;
  onClose: () => void;
  onSendEnhancedCopy: (
    enhancedFile: File,
    originalFileId: string,
    mode: ChatEnhancementMode
  ) => Promise<void>;
}

export function LiveImageEnhancerModal({
  chatId,
  attachment,
  onClose,
  onSendEnhancedCopy,
}: LiveImageEnhancerModalProps) {
  const { dict } = useLanguage();
  const [mode, setMode] = useState<ChatEnhancementMode>('hd');
  const [sliderPct, setSliderPct] = useState(55);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string>('');
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);
  const [enhancedDims, setEnhancedDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [enhancedKey, setEnhancedKey] = useState('');
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetKey = `${attachment.fileId}:${mode}`;
  const processing =
    !errorMsg && (!originalBlob || enhancedKey !== targetKey);

  useEffect(() => {
    let active = true;

    fetchOriginalFileBlob(chatId, attachment.fileId, attachment.mimeType)
      .then(({ url, blob }) => {
        if (!active) return;
        setErrorMsg('');
        setOriginalUrl(url);
        setOriginalBlob(blob);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(
          toUserFriendlyError(err, 'Não foi possível carregar a imagem original.')
        );
      });

    return () => {
      active = false;
    };
  }, [chatId, attachment.fileId, attachment.mimeType]);

  useEffect(() => {
    if (!originalBlob) return;
    let active = true;
    let createdObjectUrl = '';

    enhanceImageBlobInBrowser(originalBlob, attachment.fileName, mode)
      .then((res) => {
        if (!active) {
          URL.revokeObjectURL(res.objectUrl);
          return;
        }
        createdObjectUrl = res.objectUrl;
        setErrorMsg('');
        setEnhancedUrl(res.objectUrl);
        setEnhancedFile(res.enhancedFile);
        setEnhancedDims({ width: res.width, height: res.height });
        setEnhancedKey(`${attachment.fileId}:${mode}`);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(
          toUserFriendlyError(err, 'Não foi possível melhorar a imagem.')
        );
      });

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [originalBlob, attachment.fileId, attachment.fileName, mode]);

  const handleDownloadUrl = (url: string, fileName: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendEnhanced = async () => {
    if (!enhancedFile || sending) return;
    setSending(true);
    setErrorMsg('');
    try {
      await onSendEnhancedCopy(enhancedFile, attachment.fileId, mode);
      setSentNotice(true);
    } catch (err) {
      setErrorMsg(
        toUserFriendlyError(err, 'Não foi possível enviar a imagem melhorada.')
      );
    } finally {
      setSending(false);
    }
  };

  const modes: Array<{ id: ChatEnhancementMode; label: string }> = [
    { id: 'natural', label: dict.chat.modeNatural },
    { id: 'hd', label: dict.chat.modeHd },
    { id: 'advanced', label: dict.chat.modeAdvanced },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="w-full max-w-4xl max-h-[94dvh] flex flex-col bg-[#080B12] border border-[#22C55E]/35 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[11px] font-extrabold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                {dict.chat.enhancerTitle}
              </span>
              {enhancedDims && (
                <span className="text-[11px] text-slate-400 font-mono-tabular hidden sm:inline">
                  {enhancedDims.width} × {enhancedDims.height} px ·{' '}
                  {formatFileSize(attachment.sizeBytes)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {dict.chat.enhancerSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-4 py-2.5 bg-[#0D121E] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === m.id
                    ? 'bg-[#22C55E] text-black shadow-sm shadow-[#22C55E]/30'
                    : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FACC15]" />
            <span>
              {dict.chat.beforeLabel} / {dict.chat.afterLabel}
            </span>
          </div>
        </div>

        {/* Before / After Interactive Slider Stage */}
        <div className="flex-1 min-h-[260px] sm:min-h-[380px] relative bg-[#04060A] flex items-center justify-center overflow-hidden p-3 select-none">
          {errorMsg ? (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 max-w-md text-center">
              {errorMsg}
            </div>
          ) : processing || !originalUrl || !enhancedUrl ? (
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
              <p className="text-xs font-semibold">
                {dict.chat.processingEnhancement}
              </p>
            </div>
          ) : (
            <div className="relative w-full h-full max-h-[58dvh] flex items-center justify-center">
              <div className="relative inline-block max-w-full max-h-[56dvh] rounded-xl overflow-hidden border border-white/10">
                {/* Base: Enhanced layer */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enhancedUrl}
                  alt={dict.chat.afterLabel}
                  className="block max-w-full max-h-[56dvh] object-contain"
                />

                {/* Overlay clipped: Original layer */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalUrl}
                    alt={dict.chat.beforeLabel}
                    className="block w-full h-full object-contain"
                  />
                </div>

                {/* Vertical divider line */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-[#FACC15] shadow-[0_0_8px_rgba(250,204,21,0.8)] pointer-events-none"
                  style={{ left: `${sliderPct}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#FACC15] text-black flex items-center justify-center shadow-lg text-[10px] font-black">
                    ⇄
                  </div>
                </div>

                {/* Corner labels */}
                <span className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[10px] font-bold text-slate-200 pointer-events-none">
                  {dict.chat.beforeLabel}
                </span>
                <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-[#22C55E]/90 text-[10px] font-extrabold text-black pointer-events-none">
                  {dict.chat.afterLabel}
                </span>

                {/* Transparent range slider over image */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderPct}
                  onChange={(e) => setSliderPct(Number(e.target.value))}
                  aria-label={`${dict.chat.beforeLabel} / ${dict.chat.afterLabel}`}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status notice */}
        {sentNotice && (
          <div className="px-4 py-2 bg-[#22C55E]/15 border-t border-[#22C55E]/35 text-xs text-[#22C55E] font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{dict.chat.saveEnhancedCopySuccess}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#05070B] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!originalUrl}
              onClick={() =>
                handleDownloadUrl(originalUrl, attachment.fileName)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {dict.chat.downloadOrigBtn}
            </button>
            <button
              type="button"
              disabled={!enhancedUrl || !enhancedFile || processing}
              onClick={() =>
                enhancedFile &&
                handleDownloadUrl(enhancedUrl, enhancedFile.name)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/40 disabled:opacity-40 text-xs font-bold text-[#22C55E] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {dict.chat.downloadEnhancedBtn}
            </button>
          </div>

          <button
            type="button"
            disabled={!enhancedFile || processing || sending}
            onClick={() => void handleSendEnhanced()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-yellow-300 disabled:opacity-40 text-black text-xs font-extrabold cursor-pointer shadow-md shadow-[#FACC15]/20"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {dict.chat.sendEnhancedCopyBtn}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
