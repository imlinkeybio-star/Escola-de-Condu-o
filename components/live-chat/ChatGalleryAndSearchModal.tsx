'use client';

import React, { useState } from 'react';
import {
  Download,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Mic,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ChatAttachmentCategory,
  ChatMessage,
  ChatRoom,
} from '@/lib/chat-types';
import {
  formatFileSize,
  searchAuthorizedChatsMessages,
  triggerOriginalFileDownload,
} from '@/lib/chat-service';
import { UserProfile } from '@/lib/types';
import { useLanguage } from '@/components/LanguageProvider';

interface ChatMediaGalleryModalProps {
  chatId: string;
  messages: ChatMessage[];
  onClose: () => void;
  onOpenImage: (msg: ChatMessage) => void;
  onOpenEnhancer: (msg: ChatMessage) => void;
}

export function ChatMediaGalleryModal({
  chatId,
  messages,
  onClose,
  onOpenImage,
  onOpenEnhancer,
}: ChatMediaGalleryModalProps) {
  const { dict } = useLanguage();
  const [tab, setTab] = useState<ChatAttachmentCategory>('image');

  const attachmentMessages = messages.filter(
    (m) => !m.deletedForAll && Boolean(m.attachment)
  );
  const filtered = attachmentMessages.filter(
    (m) => m.attachment?.category === tab
  );

  const tabs: Array<{
    id: ChatAttachmentCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'image', label: dict.chat.galleryPhotos, icon: ImageIcon },
    { id: 'video', label: dict.chat.galleryVideos, icon: Film },
    { id: 'document', label: dict.chat.galleryDocs, icon: FileText },
    { id: 'audio', label: dict.chat.galleryAudios, icon: Mic },
    { id: 'other', label: dict.chat.galleryOthers, icon: FolderOpen },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[88dvh] flex flex-col bg-[#0B0F19] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-white">
            {dict.chat.galleryTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-white/[0.08] flex flex-wrap gap-1.5 bg-[#090D16]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const count = attachmentMessages.filter(
              (m) => m.attachment?.category === t.id
            ).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'bg-[#22C55E] text-black'
                    : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                <span className="opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {dict.chat.galleryEmpty}
            </div>
          ) : tab === 'image' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((msg) => (
                <div
                  key={msg.messageId}
                  className="rounded-xl overflow-hidden bg-black/50 border border-white/10 flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenImage(msg);
                    }}
                    className="aspect-square w-full bg-black overflow-hidden cursor-pointer relative"
                  >
                    {msg.attachment?.previewDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={msg.attachment.previewDataUrl}
                        alt={msg.attachment.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </button>
                  <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-300 truncate">
                      {formatFileSize(msg.attachment!.sizeBytes)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEnhancer(msg);
                        }}
                        className="p-1 rounded-md bg-[#FACC15]/15 text-[#FACC15] cursor-pointer"
                        title={dict.chat.enhanceImageAction}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void triggerOriginalFileDownload(chatId, msg.attachment!)
                        }
                        className="p-1 rounded-md bg-[#22C55E]/15 text-[#22C55E] cursor-pointer"
                        title={dict.chat.downloadOriginalAction}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((msg) => (
                <div
                  key={msg.messageId}
                  className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {msg.attachment!.fileName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {msg.senderName} ·{' '}
                      {formatFileSize(msg.attachment!.sizeBytes)} ·{' '}
                      {new Date(msg.createdAtMs).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void triggerOriginalFileDownload(chatId, msg.attachment!)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22C55E] text-black text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {dict.chat.downloadOrigBtn}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GlobalChatSearchModalProps {
  chats: ChatRoom[];
  usersByUid: Record<string, UserProfile>;
  currentUid: string;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

export function GlobalChatSearchModal({
  chats,
  usersByUid,
  currentUid,
  onClose,
  onSelectChat,
}: GlobalChatSearchModalProps) {
  const { dict } = useLanguage();
  const [queryText, setQueryText] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>(
    'all'
  );
  const [fileTypeFilter, setFileTypeFilter] = useState<
    'all' | ChatAttachmentCategory
  >('all');
  const [participantUid, setParticipantUid] = useState('');
  const [targetChatId, setTargetChatId] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<
    Array<{ message: ChatMessage; chat: ChatRoom }>
  >([]);
  const [hasSearched, setHasSearched] = useState(false);

  const participantOptions = Array.from(
    new Set(chats.flatMap((c) => c.memberIds))
  ).map((uid) => ({
    uid,
    name: usersByUid[uid]?.displayName || uid.slice(0, 8),
  }));

  const getChatTitle = (c: ChatRoom) => {
    if (c.type === 'group') return c.title || 'Grupo';
    const otherUid = c.memberIds.find((u) => u !== currentUid) || currentUid;
    return usersByUid[otherUid]?.displayName || dict.common.studentDefault;
  };

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setHasSearched(true);
    try {
      const list = await searchAuthorizedChatsMessages({
        chats,
        currentUid,
        queryText,
        dateFilter,
        fileTypeFilter,
        participantUid,
        targetChatId,
      });
      setResults(list);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[90dvh] flex flex-col bg-[#0B0F19] border border-[#FACC15]/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#FACC15]" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              {dict.chat.globalSearchTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleRunSearch(e)}
          className="p-4 border-b border-white/[0.08] bg-[#080C15] space-y-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder={dict.chat.globalSearchPlaceholder}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#05070B] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 rounded-xl bg-[#FACC15] hover:bg-yellow-300 text-black text-xs font-extrabold cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {dict.common.search}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value as 'all' | 'today' | '7d' | '30d'
                )
              }
              className="px-2.5 py-2 rounded-xl bg-[#05070B] border border-white/10 text-xs text-slate-200"
            >
              <option value="all">{dict.chat.filterDateAll}</option>
              <option value="today">{dict.chat.filterDateToday}</option>
              <option value="7d">{dict.chat.filterDate7d}</option>
              <option value="30d">{dict.chat.filterDate30d}</option>
            </select>

            <select
              value={fileTypeFilter}
              onChange={(e) =>
                setFileTypeFilter(
                  e.target.value as 'all' | ChatAttachmentCategory
                )
              }
              className="px-2.5 py-2 rounded-xl bg-[#05070B] border border-white/10 text-xs text-slate-200"
            >
              <option value="all">{dict.chat.filterAllTypes}</option>
              <option value="image">{dict.chat.galleryPhotos}</option>
              <option value="video">{dict.chat.galleryVideos}</option>
              <option value="document">{dict.chat.galleryDocs}</option>
              <option value="audio">{dict.chat.galleryAudios}</option>
              <option value="other">{dict.chat.galleryOthers}</option>
            </select>

            <select
              value={participantUid}
              onChange={(e) => setParticipantUid(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-[#05070B] border border-white/10 text-xs text-slate-200"
            >
              <option value="">{dict.chat.filterAllParticipants}</option>
              {participantOptions.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={targetChatId}
              onChange={(e) => setTargetChatId(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-[#05070B] border border-white/10 text-xs text-slate-200"
            >
              <option value="">{dict.chat.filterAllChats}</option>
              {chats.map((c) => (
                <option key={c.chatId} value={c.chatId}>
                  {getChatTitle(c)}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {!hasSearched ? (
            <div className="py-10 text-center text-xs text-slate-400">
              {dict.chat.globalSearchPlaceholder}
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              {dict.chat.searchEmpty}
            </div>
          ) : (
            results.map(({ message, chat }) => (
              <div
                key={`${chat.chatId}-${message.messageId}`}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-[#22C55E] font-bold">
                    <span className="truncate">{getChatTitle(chat)}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 truncate">
                      {message.senderName}
                    </span>
                  </div>
                  <p className="text-xs text-white mt-0.5 line-clamp-2 break-words">
                    {message.attachment
                      ? `📎 ${message.attachment.fileName} ${message.text}`
                      : message.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectChat(chat.chatId);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/35 text-[#22C55E] text-xs font-bold cursor-pointer shrink-0"
                >
                  {dict.chat.jumpToMessage}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
