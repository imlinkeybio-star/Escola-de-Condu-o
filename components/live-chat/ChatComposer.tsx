'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FileCheck2,
  Loader2,
  Mic,
  Paperclip,
  RefreshCw,
  Send,
  Smile,
  Square,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';
import {
  ChatMessage,
  ChatReplySnapshot,
  ChatSendMode,
  MAX_CHAT_FILE_BYTES,
  UploadProgressState,
} from '@/lib/chat-types';
import { formatFileSize } from '@/lib/chat-service';
import { useLanguage } from '@/components/LanguageProvider';

const QUICK_EMOJIS = [
  '❤️',
  '👍',
  '😂',
  '😮',
  '😢',
  '🔥',
  '👏',
  '🚗',
  '🚦',
  '🛑',
  '⚠️',
  '✅',
  '🏆',
  '📚',
];

interface ChatComposerProps {
  disabled: boolean;
  blockedNotice?: string;
  replyingTo: ChatReplySnapshot | null;
  editingMessage: ChatMessage | null;
  uploads: UploadProgressState[];
  onClearReply: () => void;
  onClearEdit: () => void;
  onTypingChange: (typing: boolean) => void;
  onSendText: (text: string) => Promise<void>;
  onSaveEdit: (messageId: string, nextText: string) => Promise<void>;
  onSendFiles: (
    files: File[],
    sendMode: ChatSendMode,
    caption: string
  ) => Promise<void>;
  onCancelUpload: (taskId: string) => void;
  onRetryUpload: (taskId: string) => void;
}

export function ChatComposer({
  disabled,
  blockedNotice,
  replyingTo,
  editingMessage,
  uploads,
  onClearReply,
  onClearEdit,
  onTypingChange,
  onSendText,
  onSaveEdit,
  onSendFiles,
  onCancelUpload,
  onRetryUpload,
}: ChatComposerProps) {
  const { dict, fmt } = useLanguage();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Attachment staging modal (Envio Rápido vs Ficheiro Original)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedError, setStagedError] = useState('');
  const [sendMode, setSendMode] = useState<ChatSendMode>('original');
  const [caption, setCaption] = useState('');

  // Voice recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudioFile, setRecordedAudioFile] = useState<File | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncedEditId, setSyncedEditId] = useState<string | null>(null);
  const currentEditId = editingMessage?.messageId || null;
  if (currentEditId !== syncedEditId) {
    setSyncedEditId(currentEditId);
    if (editingMessage) {
      setText(editingMessage.text);
    }
  }

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [recordedPreviewUrl]);

  const handleTextChange = (val: string) => {
    setText(val);
    onTypingChange(val.trim().length > 0);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 2500);
  };

  const handleSubmitText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    onTypingChange(false);
    try {
      if (editingMessage) {
        await onSaveEdit(editingMessage.messageId, trimmed);
        onClearEdit();
      } else {
        await onSendText(trimmed);
      }
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;

    const oversized = selected.find((f) => f.size > MAX_CHAT_FILE_BYTES);
    if (oversized) {
      setStagedError(
        `${oversized.name}: ${formatFileSize(oversized.size)} (${dict.chat.maxSizeNote})`
      );
    } else {
      setStagedError('');
    }
    const valid = selected.filter(
      (f) => f.size > 0 && f.size <= MAX_CHAT_FILE_BYTES
    );
    if (valid.length > 0) {
      setStagedFiles(valid);
      setSendMode('original');
      setCaption('');
    }
  };

  const confirmSendStagedFiles = async () => {
    if (stagedFiles.length === 0) return;
    const filesToSend = stagedFiles;
    const modeToUse = sendMode;
    const capToUse = caption;
    setStagedFiles([]);
    setCaption('');
    await onSendFiles(filesToSend, modeToUse, capToUse);
  };

  const startVoiceRecording = async () => {
    if (disabled || recording) return;
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: preferredMime });
      recordedChunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          const ext = (mr.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          const file = new File([blob], `voz_${Date.now()}.${ext}`, {
            type: mr.mimeType || 'audio/webm',
          });
          setRecordedAudioFile(file);
          setRecordedPreviewUrl(URL.createObjectURL(blob));
        }
      };

      mediaRecorderRef.current = mr;
      mr.start(250);
      setRecordSeconds(0);
      setRecording(true);
    } catch {
      setVoiceError('Microfone indisponível ou sem permissão.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const discardVoiceNote = () => {
    if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
    setRecordedAudioFile(null);
    setRecordedPreviewUrl('');
  };

  const sendVoiceNote = async () => {
    if (!recordedAudioFile) return;
    const file = recordedAudioFile;
    discardVoiceNote();
    await onSendFiles([file], 'original', '');
  };

  const visibleUploads = uploads.filter((u) => u.status !== 'completed');

  return (
    <div className="border-t border-white/[0.08] bg-[#070A12] p-2.5 sm:p-3 space-y-2">
      {/* Blocked banner */}
      {blockedNotice && (
        <div className="px-3 py-2 rounded-xl bg-red-950/50 border border-red-500/35 text-xs text-red-200">
          {blockedNotice}
        </div>
      )}

      {/* Upload errors / file size warnings */}
      {(stagedError || voiceError) && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>{stagedError || voiceError}</span>
          <button
            type="button"
            onClick={() => {
              setStagedError('');
              setVoiceError('');
            }}
            className="text-amber-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Upload Progress Bars */}
      {visibleUploads.length > 0 && (
        <div className="space-y-1.5">
          {visibleUploads.map((up) => (
            <div
              key={up.taskId}
              className="px-3 py-2 rounded-xl bg-[#0E1320] border border-white/10 space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white truncate">
                  {up.fileName} · {formatFileSize(up.sizeBytes)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono-tabular font-bold ${
                      up.status === 'failed' || up.status === 'cancelled'
                        ? 'text-amber-400'
                        : 'text-[#22C55E]'
                    }`}
                  >
                    {up.status === 'failed'
                      ? dict.chat.failedStatus
                      : up.status === 'cancelled'
                        ? dict.common.cancel
                        : `${up.percent}%`}
                  </span>
                  {(up.status === 'uploading' || up.status === 'hashing') && (
                    <button
                      type="button"
                      onClick={() => onCancelUpload(up.taskId)}
                      title={dict.chat.cancelUploadBtn}
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {(up.status === 'failed' || up.status === 'cancelled') &&
                    up.canResume && (
                      <button
                        type="button"
                        onClick={() => onRetryUpload(up.taskId)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FACC15] text-black text-[10px] font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {dict.chat.retryBtn}
                      </button>
                    )}
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#22C55E] transition-all"
                  style={{ width: `${up.percent}%` }}
                />
              </div>
              {up.error && (
                <p className="text-[10px] text-red-400">{up.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply or Edit Banner */}
      {(replyingTo || editingMessage) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#101624] border-s-4 border-[#22C55E] text-xs">
          <div className="min-w-0">
            <p className="font-bold text-[#22C55E] truncate">
              {editingMessage
                ? dict.chat.editingBanner
                : fmt(dict.chat.replyingBanner, {
                    name: replyingTo?.senderName || '',
                  })}
            </p>
            <p className="text-slate-300 truncate">
              {editingMessage
                ? editingMessage.text
                : replyingTo?.previewText || ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (editingMessage) {
                onClearEdit();
                setText('');
              } else {
                onClearReply();
              }
            }}
            aria-label={dict.chat.cancelReply}
            className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recorded Voice Preview Before Send */}
      {recordedAudioFile && recordedPreviewUrl && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0F172A] border border-[#22C55E]/35">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Mic className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {dict.chat.voicePreviewTitle}
            </span>
            <audio src={recordedPreviewUrl} controls className="h-8 max-w-[200px]" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discardVoiceNote}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-red-500/20 text-xs text-red-300 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {dict.chat.discardVoiceBtn}
            </button>
            <button
              type="button"
              onClick={() => void sendVoiceNote()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22C55E] hover:bg-emerald-400 text-black text-xs font-extrabold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {dict.chat.sendVoiceBtn}
            </button>
          </div>
        </div>
      )}

      {/* Recording live bar OR standard input row */}
      {recording ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-red-950/40 border border-red-500/40">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-white">
              {dict.chat.recordingLabel}
            </span>
            <span className="text-xs font-mono-tabular font-bold text-[#FACC15]">
              {Math.floor(recordSeconds / 60)}:
              {String(recordSeconds % 60).padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={stopVoiceRecording}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            {dict.chat.stopRecordingBtn}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSubmitText(e)}
          className="relative flex items-end gap-1.5 sm:gap-2"
        >
          {emojiOpen && (
            <div className="absolute bottom-14 start-0 z-30 p-2.5 rounded-2xl bg-[#111726] border border-white/15 shadow-2xl flex flex-wrap gap-1.5 max-w-[260px]">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    handleTextChange(`${text}${em}`);
                    setEmojiOpen(false);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-lg flex items-center justify-center cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label={dict.chat.emojiBtn}
            className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 text-slate-300 hover:text-[#FACC15] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
            onChange={handlePickFiles}
            className="hidden"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            aria-label={dict.chat.attachFileBtn}
            title={dict.chat.attachFileBtn}
            className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 text-slate-300 hover:text-[#22C55E] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            rows={1}
            disabled={disabled}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmitText();
              }
            }}
            placeholder={dict.chat.messagePlaceholder}
            className="flex-1 min-h-[42px] max-h-32 px-3.5 py-2.5 rounded-xl bg-[#0D121E] border border-white/10 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:border-[#22C55E] disabled:opacity-50"
          />

          {text.trim().length > 0 || editingMessage ? (
            <button
              type="submit"
              disabled={disabled || sending || text.trim().length === 0}
              aria-label={dict.chat.sendBtn}
              className="w-10 h-10 rounded-xl bg-[#22C55E] hover:bg-emerald-400 disabled:opacity-40 text-black flex items-center justify-center shrink-0 cursor-pointer shadow-md shadow-[#22C55E]/25"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void startVoiceRecording()}
              aria-label={dict.chat.recordVoiceBtn}
              title={dict.chat.recordVoiceBtn}
              className="w-10 h-10 rounded-xl bg-[#FACC15] hover:bg-yellow-300 disabled:opacity-40 text-black flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      )}

      {/* File Send Mode Choice Modal: Quick Send vs Original File */}
      {stagedFiles.length > 0 && (
        <div className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B0F19] border border-[#22C55E]/35 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#22C55E]" />
                <h3 className="text-base font-bold text-white">
                  {dict.chat.sendFileTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStagedFiles([])}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {stagedFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-semibold text-white truncate">
                    {f.name}
                  </span>
                  <span className="text-[#22C55E] font-mono-tabular shrink-0">
                    {formatFileSize(f.size)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSendMode('quick')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer space-y-1 ${
                  sendMode === 'quick'
                    ? 'bg-[#FACC15]/15 border-[#FACC15] text-white'
                    : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#FACC15]">
                  <Zap className="w-3.5 h-3.5" />
                  {dict.chat.sendQuickTitle}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {dict.chat.sendQuickDesc}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSendMode('original')}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer space-y-1 ${
                  sendMode === 'original'
                    ? 'bg-[#22C55E]/15 border-[#22C55E] text-white'
                    : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#22C55E]">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  {dict.chat.sendOriginalTitle}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {dict.chat.sendOriginalDesc}
                </p>
              </button>
            </div>

            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={dict.chat.messagePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#060910] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                {dict.chat.maxSizeNote}
              </span>
              <button
                type="button"
                onClick={() => void confirmSendStagedFiles()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E] hover:bg-emerald-400 text-black text-xs font-extrabold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {dict.chat.sendNowBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
