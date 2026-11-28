'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Forward,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ChatMessage } from '@/lib/chat-types';
import {
  fetchOriginalFileBlob,
  formatFileSize,
  triggerOriginalFileDownload,
} from '@/lib/chat-service';
import { useLanguage } from '@/components/LanguageProvider';

interface OriginalImageViewerProps {
  chatId: string;
  imageMessages: ChatMessage[];
  initialMessageId: string;
  onClose: () => void;
  onForward: (msg: ChatMessage) => void;
  onOpenEnhancer: (msg: ChatMessage) => void;
}

export function OriginalImageViewer({
  chatId,
  imageMessages,
  initialMessageId,
  onClose,
  onForward,
  onOpenEnhancer,
}: OriginalImageViewerProps) {
  const { dict } = useLanguage();
  const [index, setIndex] = useState(() => {
    const found = imageMessages.findIndex(
      (m) => m.messageId === initialMessageId
    );
    return found >= 0 ? found : 0;
  });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [loadedOriginal, setLoadedOriginal] = useState<{
    fileId: string;
    url: string;
  }>({ fileId: '', url: '' });
  const [fetchDoneFileId, setFetchDoneFileId] = useState('');

  const currentMsg = imageMessages[index] ?? imageMessages[0];
  const attachment = currentMsg?.attachment;
  const originalUrl =
    attachment && loadedOriginal.fileId === attachment.fileId
      ? loadedOriginal.url
      : attachment?.previewDataUrl || '';
  const loadingOriginal = Boolean(
    attachment && fetchDoneFileId !== attachment.fileId
  );

  useEffect(() => {
    if (!attachment) return;
    let active = true;
    const targetFileId = attachment.fileId;

    fetchOriginalFileBlob(chatId, targetFileId, attachment.mimeType)
      .then(({ url }) => {
        if (!active) return;
        setLoadedOriginal({ fileId: targetFileId, url });
        setFetchDoneFileId(targetFileId);
      })
      .catch(() => {
        if (!active) return;
        setFetchDoneFileId(targetFileId);
      });

    return () => {
      active = false;
    };
  }, [chatId, attachment]);

  if (!currentMsg || !attachment) return null;

  const hasPrev = index > 0;
  const hasNext = index < imageMessages.length - 1;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div className="fixed inset-0 z-[65] bg-black/95 backdrop-blur-md flex flex-col">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#05070B]/95 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {attachment.fileName}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {currentMsg.senderName} ·{' '}
            {attachment.width && attachment.height
              ? `${attachment.width}×${attachment.height}px · `
              : ''}
            {formatFileSize(attachment.sizeBytes)} ·{' '}
            <span className="text-[#22C55E] font-semibold">
              {attachment.isEnhanced
                ? dict.chat.enhancedCopyBadge
                : dict.chat.originalFileBadge}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.5).toFixed(2))))}
            title={dict.chat.zoomOut}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono-tabular text-slate-300 min-w-[44px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(2))))}
            title={dict.chat.zoomIn}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title={dict.chat.resetZoom}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-red-500/30 text-white flex items-center justify-center cursor-pointer ms-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden p-4 select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {hasPrev && (
          <button
            type="button"
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label={dict.chat.prevPhoto}
            className="absolute start-3 z-20 w-10 h-10 rounded-full bg-black/70 border border-white/15 text-white hover:bg-[#22C55E] hover:text-black flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <motion.div
          key={currentMsg.messageId}
          initial={{ opacity: 0.4, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative max-w-full max-h-full flex items-center justify-center"
        >
          {originalUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={originalUrl}
              alt={attachment.fileName}
              draggable={false}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
              }}
              className="max-w-full max-h-[76dvh] object-contain rounded-lg transition-transform duration-150"
            />
          ) : (
            <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
          )}

          {loadingOriginal && originalUrl && (
            <div className="absolute bottom-3 px-3 py-1 rounded-full bg-black/80 border border-white/15 text-[11px] text-slate-200 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-[#22C55E]" />
              <span>{dict.common.loading}</span>
            </div>
          )}
        </motion.div>

        {hasNext && (
          <button
            type="button"
            onClick={() => {
              setIndex((i) => Math.min(imageMessages.length - 1, i + 1));
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label={dict.chat.nextPhoto}
            className="absolute end-3 z-20 w-10 h-10 rounded-full bg-black/70 border border-white/15 text-white hover:bg-[#22C55E] hover:text-black flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#05070B]/95 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-400">
          {index + 1} / {imageMessages.length}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onForward(currentMsg)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white cursor-pointer"
          >
            <Forward className="w-3.5 h-3.5" />
            {dict.chat.forwardAction}
          </button>
          <button
            type="button"
            onClick={() => void triggerOriginalFileDownload(chatId, attachment)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-400 text-xs font-extrabold text-black cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {dict.chat.downloadOriginalAction}
          </button>
          <button
            type="button"
            onClick={() => onOpenEnhancer(currentMsg)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FACC15] hover:bg-yellow-300 text-xs font-extrabold text-black cursor-pointer shadow-sm shadow-[#FACC15]/25"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {dict.chat.enhanceImageAction}
          </button>
        </div>
      </div>
    </div>
  );
}
