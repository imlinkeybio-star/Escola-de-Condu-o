'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  Edit3,
  FileText,
  Film,
  Flag,
  FolderOpen,
  Forward,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Pin,
  PinOff,
  Reply,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SmilePlus,
  Star,
  Trash2,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { UserProfile } from '@/lib/types';
import {
  CHAT_REACTION_EMOJIS,
  ChatAttachmentCategory,
  ChatEnhancementMode,
  ChatFavoriteRecord,
  ChatMemberState,
  ChatMessage,
  ChatNotificationRecord,
  ChatPresence,
  ChatReplySnapshot,
  ChatRoom,
  ChatSendMode,
  UploadProgressState,
} from '@/lib/chat-types';
import {
  categorizeChatFile,
  createOrOpenDirectChat,
  deleteChatMessageForAll,
  deleteChatMessageForMe,
  enqueueOfflineTextMessage,
  ensureChatPresence,
  formatFileSize,
  loadOfflineChatQueue,
  markChatMessagesReadAndDelivered,
  markChatNotificationsReadForChat,
  QueuedTextMessage,
  removeOfflineChatQueueItem,
  searchAuthorizedChatsMessages,
  sendChatMessage,
  setTypingIndicator,
  toggleBlockUser,
  toggleFavoriteMessage,
  toggleMessageReaction,
  togglePinChatMessage,
  triggerOriginalFileDownload,
  updateChatPresence,
  updateMyChatMemberPrefs,
  uploadChatFileChunked,
  editChatMessage,
} from '@/lib/chat-service';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';
import { ChatComposer } from './ChatComposer';
import { ChatMediaMessage } from './ChatMediaMessage';
import { OriginalImageViewer } from './OriginalImageViewer';
import { LiveImageEnhancerModal } from './LiveImageEnhancerModal';
import {
  ChatMediaGalleryModal,
  GlobalChatSearchModal,
} from './ChatGalleryAndSearchModal';
import {
  CreateGroupModal,
  ForwardMessageModal,
  GroupInfoModal,
  ReportMessageModal,
} from './ChatGroupModals';

type RailTab =
  | 'chats'
  | 'contacts'
  | 'groups'
  | 'files'
  | 'favorites'
  | 'settings';

function formatClockTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatLastSeen(ms?: number): string {
  if (!ms) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return new Date(ms).toLocaleDateString();
}

export function LiveChatWorkspace() {
  const { user, profile } = useAuth();
  const { dict, fmt } = useLanguage();

  const [railTab, setRailTab] = useState<RailTab>('chats');
  const [railFilter, setRailFilter] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, ChatPresence>>(
    {}
  );
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [myMembersByChat, setMyMembersByChat] = useState<
    Record<string, ChatMemberState>
  >({});
  const [chatNotifications, setChatNotifications] = useState<
    ChatNotificationRecord[]
  >([]);
  const [favorites, setFavorites] = useState<ChatFavoriteRecord[]>([]);

  const [activeChatId, setActiveChatId] = useState<string>('');
  const [activeMembers, setActiveMembers] = useState<
    Record<string, ChatMemberState>
  >({});
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [messageLimit, setMessageLimit] = useState(40);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Offline & local optimistic failed/pending messages
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<QueuedTextMessage[]>([]);
  const [failedLocalMsgs, setFailedLocalMsgs] = useState<ChatMessage[]>([]);

  // Composer state
  const [replyingTo, setReplyingTo] = useState<ChatReplySnapshot | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [uploads, setUploads] = useState<UploadProgressState[]>([]);
  const uploadAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const uploadRetryRef = useRef<
    Map<
      string,
      {
        chat: ChatRoom;
        file: File;
        sendMode: ChatSendMode;
        fileId?: string;
        caption: string;
      }
    >
  >(new Map());

  // Message UI interactions
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string>('');
  const [openReactMsgId, setOpenReactMsgId] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const touchStartRef = useRef<{
    msg: ChatMessage;
    x: number;
    y: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [viewerImageId, setViewerImageId] = useState<string>('');
  const [enhancerMsg, setEnhancerMsg] = useState<ChatMessage | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);

  // Files tab state (global authorized attachments across chats)
  const [filesTabCat, setFilesTabCat] =
    useState<ChatAttachmentCategory>('image');
  const [globalFilesList, setGlobalFilesList] = useState<
    Array<{ message: ChatMessage; chat: ChatRoom }>
  >([]);
  const [loadingGlobalFiles, setLoadingGlobalFiles] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Network online/offline listeners + load queue
  useEffect(() => {
    if (!user) return;
    setOfflineQueue(loadOfflineChatQueue(user.uid));
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [user]);

  // Presence registration & heartbeat
  useEffect(() => {
    if (!user) return;
    void ensureChatPresence(user.uid);

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void updateChatPresence(user.uid, {
          online: true,
          lastSeenAtMs: Date.now(),
        });
      }
    }, 45000);

    const onVisibility = () => {
      void updateChatPresence(user.uid, {
        online: document.visibilityState === 'visible',
        lastSeenAtMs: Date.now(),
      });
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      void updateChatPresence(user.uid, {
        online: false,
        lastSeenAtMs: Date.now(),
      });
    };
  }, [user]);

  // Subscribe to Users, Presence, Chats, Notifications, Favorites
  useEffect(() => {
    if (!user) return;

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(150)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => !u.disabled);
        setUsers(list);
      }
    );

    const unsubPresence = onSnapshot(
      query(collection(db, 'chat_presence'), limit(150)),
      (snap) => {
        const map: Record<string, ChatPresence> = {};
        snap.docs.forEach((d) => {
          const p = d.data() as ChatPresence;
          map[p.uid] = p;
        });
        setPresenceMap(map);
      }
    );

    const unsubChats = onSnapshot(
      query(
        collection(db, 'chats'),
        where('memberIds', 'array-contains', user.uid),
        limit(100)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatRoom)
          .sort((a, b) => (b.lastMessageAtMs || 0) - (a.lastMessageAtMs || 0));
        setChats(list);
      }
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'chat_notifications'),
        where('recipientUid', '==', user.uid),
        limit(120)
      ),
      (snap) => {
        setChatNotifications(
          snap.docs.map((d) => d.data() as ChatNotificationRecord)
        );
      }
    );

    const unsubFavs = onSnapshot(
      query(collection(db, 'users', user.uid, 'chat_favorites'), limit(100)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatFavoriteRecord)
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setFavorites(list);
      }
    );

    return () => {
      unsubUsers();
      unsubPresence();
      unsubChats();
      unsubNotifs();
      unsubFavs();
    };
  }, [user]);

  // Keep user's own member state for each chat (pinned, muted)
  useEffect(() => {
    if (!user || chats.length === 0) return;
    const unsubs = chats.slice(0, 30).map((c) =>
      onSnapshot(
        query(
          collection(db, 'chats', c.chatId, 'members'),
          where('uid', '==', user.uid)
        ),
        (snap) => {
          snap.docs.forEach((d) => {
            const ms = d.data() as ChatMemberState;
            setMyMembersByChat((prev) => ({ ...prev, [c.chatId]: ms }));
          });
        }
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, chats]);

  const usersByUid = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    if (profile) map[profile.uid] = profile;
    return map;
  }, [users, profile]);

  const myPresence = user ? presenceMap[user.uid] : undefined;
  const blockedSet = useMemo(
    () => new Set(myPresence?.blockedUids || []),
    [myPresence]
  );

  const unreadByChatId = useMemo(() => {
    const map: Record<string, number> = {};
    chatNotifications.forEach((n) => {
      if (!n.read) {
        map[n.chatId] = (map[n.chatId] || 0) + 1;
      }
    });
    return map;
  }, [chatNotifications]);

  const favoriteIdsSet = useMemo(
    () => new Set(favorites.map((f) => `${f.chatId}_${f.messageId}`)),
    [favorites]
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.chatId === activeChatId) || null,
    [chats, activeChatId]
  );

  const getDirectPartnerUid = useCallback(
    (chat: ChatRoom): string => {
      if (!user) return '';
      return chat.memberIds.find((u) => u !== user.uid) || user.uid;
    },
    [user]
  );

  const getChatDisplayMeta = useCallback(
    (chat: ChatRoom) => {
      if (chat.type === 'group') {
        return {
          title: chat.title || 'Grupo',
          avatar: chat.photoURL || defaultAvatarImg,
          isOnline: false,
          subtitle: fmt(dict.chat.membersCount, { count: chat.memberIds.length }),
          isBlocked: false,
          partnerUid: '',
        };
      }
      const partnerUid = getDirectPartnerUid(chat);
      const partner = usersByUid[partnerUid];
      const pres = presenceMap[partnerUid];
      const freshOnline =
        Boolean(pres?.online) &&
        !pres?.hideOnline &&
        Date.now() - (pres?.lastSeenAtMs || 0) < 120000;
      const lastSeenTxt =
        !pres?.hideLastSeen && pres?.lastSeenAtMs
          ? `${dict.chat.lastSeenPrefix} ${formatLastSeen(pres.lastSeenAtMs)}`
          : dict.chat.offline;

      return {
        title: partner?.displayName || dict.common.studentDefault,
        avatar: partner?.photoURL || defaultAvatarImg,
        isOnline: freshOnline,
        subtitle: freshOnline ? dict.chat.online : lastSeenTxt,
        isBlocked: blockedSet.has(partnerUid),
        partnerUid,
      };
    },
    [
      getDirectPartnerUid,
      usersByUid,
      presenceMap,
      blockedSet,
      dict.chat,
      dict.common.studentDefault,
      fmt,
    ]
  );

  // Active Chat subscriptions: members & paginated messages
  useEffect(() => {
    if (!user || !activeChatId) {
      setActiveMembers({});
      setServerMessages([]);
      return;
    }

    setLoadingMessages(true);
    const unsubMembers = onSnapshot(
      collection(db, 'chats', activeChatId, 'members'),
      (snap) => {
        const mMap: Record<string, ChatMemberState> = {};
        snap.docs.forEach((d) => {
          const ms = d.data() as ChatMemberState;
          mMap[ms.uid] = ms;
        });
        setActiveMembers(mMap);
      }
    );

    const unsubMsgs = onSnapshot(
      query(
        collection(db, 'chats', activeChatId, 'messages'),
        orderBy('createdAtMs', 'desc'),
        limit(messageLimit)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatMessage)
          .filter((m) => !(m.deletedForUids || []).includes(user.uid))
          .reverse();
        setServerMessages(list);
        setLoadingMessages(false);
        void markChatMessagesReadAndDelivered(activeChatId, user.uid, list);
        void markChatNotificationsReadForChat(user.uid, activeChatId);
      },
      () => {
        setLoadingMessages(false);
      }
    );

    return () => {
      unsubMembers();
      unsubMsgs();
    };
  }, [user, activeChatId, messageLimit]);

  // Auto-flush offline queue when online
  useEffect(() => {
    if (!user || !profile || !isOnline || offlineQueue.length === 0) return;
    let active = true;

    const flushQueue = async () => {
      for (const item of offlineQueue) {
        if (!active) break;
        const targetChat = chats.find((c) => c.chatId === item.chatId);
        if (!targetChat) continue;
        try {
          await sendChatMessage({
            chat: targetChat,
            sender: profile,
            type: 'text',
            text: item.text,
            replyTo: item.replyTo,
            clientNonce: item.clientNonce,
          });
          const remaining = removeOfflineChatQueueItem(
            user.uid,
            item.clientNonce
          );
          if (active) setOfflineQueue(remaining);
        } catch {
          // Stop flush and retry next online cycle
          break;
        }
      }
    };

    void flushQueue();
    return () => {
      active = false;
    };
  }, [user, profile, isOnline, offlineQueue, chats]);

  // Global Files tab fetch
  useEffect(() => {
    if (!user || railTab !== 'files' || chats.length === 0) return;
    let active = true;
    setLoadingGlobalFiles(true);
    searchAuthorizedChatsMessages({
      chats,
      currentUid: user.uid,
      queryText: '',
      dateFilter: 'all',
      fileTypeFilter: filesTabCat,
      participantUid: '',
      targetChatId: '',
    })
      .then((res) => {
        if (!active) return;
        setGlobalFilesList(res);
        setLoadingGlobalFiles(false);
      })
      .catch(() => {
        if (active) setLoadingGlobalFiles(false);
      });
    return () => {
      active = false;
    };
  }, [user, railTab, filesTabCat, chats]);

  // Typing users in active chat
  const typingNames = useMemo(() => {
    if (!user) return [];
    const now = Date.now();
    return Object.values(activeMembers)
      .filter(
        (m) =>
          m.uid !== user.uid &&
          m.typingAtMs > now - 4500 &&
          !blockedSet.has(m.uid)
      )
      .map((m) => usersByUid[m.uid]?.displayName || dict.common.studentDefault);
  }, [activeMembers, user, blockedSet, usersByUid, dict.common.studentDefault]);

  // Merge server messages with any offline queued or failed local messages for active chat
  const displayedMessages = useMemo(() => {
    if (!activeChatId || !user || !profile) return [];
    const nonces = new Set(
      serverMessages.map((m) => m.clientNonce).filter(Boolean)
    );
    const localQueued: ChatMessage[] = offlineQueue
      .filter(
        (q) => q.chatId === activeChatId && !nonces.has(q.clientNonce)
      )
      .map((q) => ({
        messageId: `local_${q.clientNonce}`,
        chatId: q.chatId,
        senderUid: user.uid,
        senderName: profile.displayName,
        type: 'text',
        text: q.text,
        replyTo: q.replyTo,
        clientNonce: q.clientNonce,
        createdAtMs: q.createdAtMs,
        localStatus: 'pending',
      }));

    const localFailed = failedLocalMsgs.filter(
      (f) => f.chatId === activeChatId && !nonces.has(f.clientNonce)
    );

    return [...serverMessages, ...localQueued, ...localFailed].sort(
      (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)
    );
  }, [serverMessages, offlineQueue, failedLocalMsgs, activeChatId, user, profile]);

  const activeImageMessages = useMemo(
    () =>
      displayedMessages.filter(
        (m) => !m.deletedForAll && m.attachment?.category === 'image'
      ),
    [displayedMessages]
  );

  // Scroll smoothly when message count increases
  const msgCount = displayedMessages.length;
  useEffect(() => {
    if (msgCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgCount, activeChatId]);

  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMessageLimit(40);
    setReplyingTo(null);
    setEditingMessage(null);
    setOpenMenuMsgId('');
    setOpenReactMsgId('');
    if (user) {
      void markChatNotificationsReadForChat(user.uid, chatId);
    }
  };

  const handleStartDirectWith = async (target: UserProfile) => {
    if (!profile) return;
    try {
      const room = await createOrOpenDirectChat(profile, target);
      setRailTab('chats');
      handleOpenChat(room.chatId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao abrir conversa.');
    }
  };

  const handleSendText = async (text: string) => {
    if (!activeChat || !profile || !user) return;
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const replySnap = replyingTo || undefined;
    setReplyingTo(null);

    if (!isOnline) {
      const nextQ = enqueueOfflineTextMessage(user.uid, {
        clientNonce: nonce,
        chatId: activeChat.chatId,
        text,
        replyTo: replySnap,
        createdAtMs: Date.now(),
      });
      setOfflineQueue(nextQ);
      showToast(dict.chat.offlineQueuedMsg);
      return;
    }

    try {
      await sendChatMessage({
        chat: activeChat,
        sender: profile,
        type: 'text',
        text,
        replyTo: replySnap,
        clientNonce: nonce,
      });
      setFailedLocalMsgs((prev) =>
        prev.filter((m) => m.clientNonce !== nonce)
      );
    } catch (err) {
      const offline =
        typeof navigator !== 'undefined' && !navigator.onLine;
      if (offline) {
        const nextQ = enqueueOfflineTextMessage(user.uid, {
          clientNonce: nonce,
          chatId: activeChat.chatId,
          text,
          replyTo: replySnap,
          createdAtMs: Date.now(),
        });
        setOfflineQueue(nextQ);
        showToast(dict.chat.offlineQueuedMsg);
      } else {
        setFailedLocalMsgs((prev) => [
          ...prev,
          {
            messageId: `fail_${nonce}`,
            chatId: activeChat.chatId,
            senderUid: user.uid,
            senderName: profile.displayName,
            type: 'text',
            text,
            replyTo: replySnap,
            clientNonce: nonce,
            createdAtMs: Date.now(),
            localStatus: 'failed',
            localError: err instanceof Error ? err.message : 'Erro ao enviar',
          },
        ]);
      }
    }
  };

  const handleRetryFailedMessage = async (msg: ChatMessage) => {
    if (!activeChat || !profile) return;
    setFailedLocalMsgs((prev) =>
      prev.filter((m) => m.messageId !== msg.messageId)
    );
    try {
      await sendChatMessage({
        chat: activeChat,
        sender: profile,
        type: 'text',
        text: msg.text,
        replyTo: msg.replyTo,
        clientNonce: msg.clientNonce,
      });
    } catch {
      setFailedLocalMsgs((prev) => [...prev, msg]);
    }
  };

  const handleSaveEdit = async (messageId: string, nextText: string) => {
    if (!activeChat) return;
    await editChatMessage(activeChat.chatId, messageId, nextText);
    setEditingMessage(null);
  };

  const runSingleFileUpload = useCallback(
    async (params: {
      taskId: string;
      chat: ChatRoom;
      file: File;
      sendMode: ChatSendMode;
      existingFileId?: string;
      caption: string;
      isEnhanced?: boolean;
      originalFileId?: string;
      enhancementMode?: ChatEnhancementMode;
    }) => {
      if (!profile) return;
      const controller = new AbortController();
      uploadAbortersRef.current.set(params.taskId, controller);
      const stableFileId =
        params.existingFileId ||
        `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      uploadRetryRef.current.set(params.taskId, {
        chat: params.chat,
        file: params.file,
        sendMode: params.sendMode,
        fileId: stableFileId,
        caption: params.caption,
      });

      const upsertUpload = (next: UploadProgressState) => {
        setUploads((prev) => {
          const exists = prev.some((u) => u.taskId === next.taskId);
          return exists
            ? prev.map((u) => (u.taskId === next.taskId ? next : u))
            : [...prev, next];
        });
      };

      try {
        const attachment = await uploadChatFileChunked({
          chatId: params.chat.chatId,
          senderUid: profile.uid,
          file: params.file,
          sendMode: params.sendMode,
          existingFileId: stableFileId,
          taskId: params.taskId,
          isEnhanced: params.isEnhanced,
          originalFileId: params.originalFileId,
          enhancementMode: params.enhancementMode,
          signal: controller.signal,
          onProgress: upsertUpload,
        });

        const cat = categorizeChatFile(attachment.mimeType, attachment.fileName);
        const msgType =
          cat === 'image'
            ? 'image'
            : cat === 'video'
              ? 'video'
              : cat === 'audio'
                ? 'audio'
                : 'file';

        await sendChatMessage({
          chat: params.chat,
          sender: profile,
          type: msgType,
          text: params.caption,
          attachment,
        });

        setUploads((prev) => prev.filter((u) => u.taskId !== params.taskId));
        uploadAbortersRef.current.delete(params.taskId);
        uploadRetryRef.current.delete(params.taskId);
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        upsertUpload({
          taskId: params.taskId,
          chatId: params.chat.chatId,
          fileName: params.file.name,
          sizeBytes: params.file.size,
          sendMode: params.sendMode,
          uploadedChunks: 0,
          totalChunks: 1,
          percent: 0,
          status: isAbort ? 'cancelled' : 'failed',
          error: isAbort
            ? undefined
            : err instanceof Error
              ? err.message
              : 'Falha no envio',
          canResume: true,
        });
      }
    },
    [profile]
  );

  const handleSendFiles = async (
    files: File[],
    sendMode: ChatSendMode,
    caption: string
  ) => {
    if (!activeChat) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const taskId = `up_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      await runSingleFileUpload({
        taskId,
        chat: activeChat,
        file: f,
        sendMode,
        caption: i === 0 ? caption : '',
      });
    }
  };

  const handleCancelUpload = (taskId: string) => {
    uploadAbortersRef.current.get(taskId)?.abort();
    uploadAbortersRef.current.delete(taskId);
  };

  const handleRetryUpload = (taskId: string) => {
    const payload = uploadRetryRef.current.get(taskId);
    if (!payload) return;
    void runSingleFileUpload({
      taskId,
      chat: payload.chat,
      file: payload.file,
      sendMode: payload.sendMode,
      existingFileId: payload.fileId,
      caption: payload.caption,
    });
  };

  const handleSendEnhancedCopy = async (
    enhancedFile: File,
    originalFileId: string,
    mode: ChatEnhancementMode
  ) => {
    if (!activeChat) return;
    const taskId = `enh_${Date.now()}`;
    await runSingleFileUpload({
      taskId,
      chat: activeChat,
      file: enhancedFile,
      sendMode: 'original',
      caption: '',
      isEnhanced: true,
      originalFileId,
      enhancementMode: mode,
    });
    showToast(dict.chat.saveEnhancedCopySuccess);
  };

  // Filtered chats sorted with pinned first
  const visibleChats = useMemo(() => {
    const q = railFilter.trim().toLowerCase();
    return [...chats]
      .filter((c) => {
        if (railTab === 'groups' && c.type !== 'group') return false;
        if (!q) return true;
        const meta = getChatDisplayMeta(c);
        return (
          meta.title.toLowerCase().includes(q) ||
          (c.lastMessagePreview || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aPin = myMembersByChat[a.chatId]?.pinned ? 1 : 0;
        const bPin = myMembersByChat[b.chatId]?.pinned ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        return (b.lastMessageAtMs || 0) - (a.lastMessageAtMs || 0);
      });
  }, [chats, railTab, railFilter, getChatDisplayMeta, myMembersByChat]);

  const visibleContacts = useMemo(() => {
    if (!user) return [];
    const q = railFilter.trim().toLowerCase();
    return users
      .filter((u) => u.uid !== user.uid)
      .filter((u) => {
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.tier.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aOn =
          presenceMap[a.uid]?.online &&
          !presenceMap[a.uid]?.hideOnline &&
          Date.now() - (presenceMap[a.uid]?.lastSeenAtMs || 0) < 120000
            ? 1
            : 0;
        const bOn =
          presenceMap[b.uid]?.online &&
          !presenceMap[b.uid]?.hideOnline &&
          Date.now() - (presenceMap[b.uid]?.lastSeenAtMs || 0) < 120000
            ? 1
            : 0;
        if (aOn !== bOn) return bOn - aOn;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [users, user, railFilter, presenceMap]);

  if (!user || !profile) {
    return (
      <div className="max-w-lg mx-auto my-8 bg-[#090D16] border border-[#22C55E]/25 rounded-3xl p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#22C55E] flex items-center justify-center mx-auto">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#22C55E]">
            {dict.chat.brandTitle}
          </p>
          <h2 className="text-xl font-extrabold text-white">
            {dict.chat.guestTitle}
          </h2>
          <p className="text-sm text-slate-400">{dict.chat.guestDesc}</p>
        </div>
        <Link
          href="/entrar"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FACC15] hover:bg-yellow-300 text-black text-sm font-extrabold"
        >
          {dict.chat.guestBtn}
        </Link>
      </div>
    );
  }

  const activeMeta = activeChat ? getChatDisplayMeta(activeChat) : null;
  const isActiveAdmin =
    activeChat &&
    (activeChat.adminIds.includes(user.uid) ||
      activeChat.createdBy === user.uid);
  const myActiveMember = activeChat ? activeMembers[user.uid] : undefined;
  const pinnedMessage = activeChat?.pinnedMessageId
    ? displayedMessages.find((m) => m.messageId === activeChat.pinnedMessageId)
    : null;

  const railTabs: Array<{
    id: RailTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'chats', label: dict.chat.tabChats, icon: MessageSquare },
    { id: 'contacts', label: dict.chat.tabContacts, icon: Users },
    { id: 'groups', label: dict.chat.tabGroups, icon: UserCheck },
    { id: 'files', label: dict.chat.tabFiles, icon: FolderOpen },
    { id: 'favorites', label: dict.chat.tabFavorites, icon: Star },
    { id: 'settings', label: dict.chat.tabSettings, icon: Settings },
  ];

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-6.2rem)] min-h-[540px] flex rounded-2xl overflow-hidden bg-[#05070B] border border-white/10 shadow-2xl relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 end-4 z-[80] px-4 py-2.5 rounded-xl bg-[#0B1410] border border-[#22C55E]/50 text-xs font-bold text-[#22C55E] shadow-xl flex items-center gap-2"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT RAIL (List / Navigation) */}
      <aside
        className={`${
          activeChatId ? 'hidden md:flex' : 'flex'
        } w-full md:w-[340px] lg:w-[370px] shrink-0 flex-col bg-[#080B12] border-e border-white/[0.08]`}
      >
        {/* LIVE CHAT Header */}
        <div className="p-3.5 border-b border-white/[0.08] bg-[#05070B] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_10px_#22C55E]" />
                <h2 className="font-display text-base font-black tracking-wide text-white">
                  LIVE <span className="text-[#22C55E]">CHAT</span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {dict.chat.slogan}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(true)}
                title={dict.chat.globalSearchTitle}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-[#FACC15]/20 text-[#FACC15] flex items-center justify-center cursor-pointer transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                title={dict.chat.newGroupBtn}
                className="w-9 h-9 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center cursor-pointer transition-colors"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRailTab('contacts')}
                title={dict.chat.newDirectBtn}
                className="w-9 h-9 rounded-xl bg-[#FACC15] hover:bg-yellow-300 text-black flex items-center justify-center cursor-pointer transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {(railTab === 'chats' ||
            railTab === 'contacts' ||
            railTab === 'groups') && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={railFilter}
                onChange={(e) => setRailFilter(e.target.value)}
                placeholder={dict.chat.searchPlaceholder}
                className="w-full ps-8 pe-3 py-2 rounded-xl bg-[#0D1320] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
              />
            </div>
          )}

          {/* 6 Section Navigation Strip */}
          <div className="grid grid-cols-3 gap-1">
            {railTabs.map((t) => {
              const Icon = t.icon;
              const active = railTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRailTab(t.id)}
                  className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#22C55E] text-black'
                      : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-2 text-[11px] font-semibold text-amber-200">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>{dict.chat.offlineQueuedMsg}</span>
          </div>
        )}

        {/* Left Rail Dynamic Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {(railTab === 'chats' || railTab === 'groups') && (
            <>
              {visibleChats.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-white">
                    {dict.chat.noChatsTitle}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dict.chat.noChatsSub}
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRailTab('contacts')}
                      className="px-3 py-1.5 rounded-xl bg-[#22C55E] text-black text-xs font-extrabold cursor-pointer"
                    >
                      {dict.chat.tabContacts}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateGroupOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#FACC15] text-black text-xs font-extrabold cursor-pointer"
                    >
                      {dict.chat.newGroupBtn}
                    </button>
                  </div>
                </div>
              ) : (
                visibleChats.map((c) => {
                  const meta = getChatDisplayMeta(c);
                  const unread = unreadByChatId[c.chatId] || 0;
                  const mem = myMembersByChat[c.chatId];
                  const selected = c.chatId === activeChatId;
                  return (
                    <button
                      key={c.chatId}
                      type="button"
                      onClick={() => handleOpenChat(c.chatId)}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-3 text-start transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#22C55E]/15 border border-[#22C55E]/40'
                          : 'hover:bg-white/[0.05] border border-transparent'
                      }`}
                    >
                      <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/15 shrink-0">
                        <Image
                          src={meta.avatar}
                          alt={meta.title}
                          fill
                          sizes="44px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {meta.isOnline && (
                          <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-[#22C55E] ring-2 ring-[#080B12]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {meta.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {formatClockTime(c.lastMessageAtMs)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-slate-400 truncate">
                            {c.lastMessagePreview || meta.subtitle}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {mem?.pinned && (
                              <Pin className="w-3 h-3 text-[#FACC15]" />
                            )}
                            {mem?.muted && (
                              <BellOff className="w-3 h-3 text-slate-500" />
                            )}
                            {unread > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#22C55E] text-black text-[10px] font-black flex items-center justify-center tabular-nums">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </>
          )}

          {railTab === 'contacts' && (
            <div className="space-y-1.5">
              {visibleContacts.map((u) => {
                const pres = presenceMap[u.uid];
                const on =
                  Boolean(pres?.online) &&
                  !pres?.hideOnline &&
                  Date.now() - (pres?.lastSeenAtMs || 0) < 120000;
                const isBlocked = blockedSet.has(u.uid);
                return (
                  <div
                    key={u.uid}
                    className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/15 shrink-0">
                        <Image
                          src={u.photoURL || defaultAvatarImg}
                          alt={u.displayName}
                          fill
                          sizes="40px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {on && (
                          <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#080B12]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {u.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {isBlocked
                            ? dict.chat.blockUserBtn
                            : on
                              ? dict.chat.online
                              : `${u.tier} · ${u.totalPoints} ${dict.common.pts}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleStartDirectWith(u)}
                      className="px-3 py-1.5 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 border border-[#22C55E]/35 text-[#22C55E] text-[11px] font-extrabold cursor-pointer shrink-0"
                    >
                      {dict.chat.openChatBtn}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {railTab === 'files' && (
            <div className="space-y-3 p-1">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'image', label: dict.chat.galleryPhotos, icon: ImageIcon },
                    { id: 'video', label: dict.chat.galleryVideos, icon: Film },
                    { id: 'document', label: dict.chat.galleryDocs, icon: FileText },
                    { id: 'audio', label: dict.chat.galleryAudios, icon: Mic },
                    { id: 'other', label: dict.chat.galleryOthers, icon: FolderOpen },
                  ] as const
                ).map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFilesTabCat(cat.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        filesTabCat === cat.id
                          ? 'bg-[#FACC15] text-black'
                          : 'bg-white/[0.05] text-slate-300'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {loadingGlobalFiles ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#22C55E] mx-auto" />
                </div>
              ) : globalFilesList.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">
                  {dict.chat.galleryEmpty}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {globalFilesList.map(({ message, chat }) => (
                    <div
                      key={`${chat.chatId}-${message.messageId}`}
                      className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenChat(chat.chatId)}
                        className="min-w-0 text-start flex-1 cursor-pointer"
                      >
                        <p className="text-xs font-bold text-white truncate">
                          {message.attachment?.fileName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {getChatDisplayMeta(chat).title} ·{' '}
                          {message.attachment
                            ? formatFileSize(message.attachment.sizeBytes)
                            : ''}
                        </p>
                      </button>
                      {message.attachment && (
                        <button
                          type="button"
                          onClick={() =>
                            void triggerOriginalFileDownload(
                              chat.chatId,
                              message.attachment!
                            )
                          }
                          title={dict.chat.downloadOriginalAction}
                          className="p-1.5 rounded-lg bg-[#22C55E]/15 text-[#22C55E] hover:bg-[#22C55E]/25 cursor-pointer shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {railTab === 'favorites' && (
            <div className="space-y-2 p-1">
              {favorites.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Star className="w-7 h-7 text-[#FACC15]/50 mx-auto" />
                  <p className="text-xs text-slate-400">
                    {dict.chat.favoritesEmpty}
                  </p>
                </div>
              ) : (
                favorites.map((fav) => (
                  <div
                    key={fav.favoriteId}
                    className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#22C55E] truncate">
                        {fav.chatTitle} · {fav.senderName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void toggleFavoriteMessage(
                            user.uid,
                            fav.chatTitle,
                            {
                              messageId: fav.messageId,
                              chatId: fav.chatId,
                              senderUid: '',
                              senderName: fav.senderName,
                              type: fav.type,
                              text: fav.previewText,
                              createdAtMs: fav.createdAtMs,
                            },
                            true
                          )
                        }
                        className="text-slate-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-white break-words">
                      {fav.previewText}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenChat(fav.chatId)}
                      className="text-[11px] font-bold text-[#FACC15] hover:underline cursor-pointer"
                    >
                      {dict.chat.openConversationBtn}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {railTab === 'settings' && (
            <div className="p-2 space-y-4">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#22C55E]">
                  {dict.chat.settingsPrivacyTitle}
                </p>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-200 cursor-pointer">
                  <span>{dict.chat.hideOnlineLabel}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(myPresence?.hideOnline)}
                    onChange={(e) =>
                      void updateChatPresence(user.uid, {
                        hideOnline: e.target.checked,
                      })
                    }
                    className="accent-[#22C55E] w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-200 cursor-pointer">
                  <span>{dict.chat.hideLastSeenLabel}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(myPresence?.hideLastSeen)}
                    onChange={(e) =>
                      void updateChatPresence(user.uid, {
                        hideLastSeen: e.target.checked,
                      })
                    }
                    className="accent-[#22C55E] w-4 h-4"
                  />
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#FACC15]">
                  {dict.chat.settingsNotifTitle}
                </p>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-200 cursor-pointer">
                  <span>{dict.chat.notifAllLabel}</span>
                  <input
                    type="checkbox"
                    checked={myPresence?.notificationsEnabled ?? true}
                    onChange={(e) =>
                      void updateChatPresence(user.uid, {
                        notificationsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#22C55E] w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-200 cursor-pointer">
                  <span>{dict.chat.notifGroupsLabel}</span>
                  <input
                    type="checkbox"
                    checked={myPresence?.groupNotificationsEnabled ?? true}
                    onChange={(e) =>
                      void updateChatPresence(user.uid, {
                        groupNotificationsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#22C55E] w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-200 cursor-pointer">
                  <span>{dict.chat.showPreviewsLabel}</span>
                  <input
                    type="checkbox"
                    checked={myPresence?.showPreviews ?? true}
                    onChange={(e) =>
                      void updateChatPresence(user.uid, {
                        showPreviews: e.target.checked,
                      })
                    }
                    className="accent-[#22C55E] w-4 h-4"
                  />
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                  {dict.chat.blockedUsersTitle}
                </p>
                {(myPresence?.blockedUids || []).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {dict.chat.noBlockedUsers}
                  </p>
                ) : (
                  (myPresence?.blockedUids || []).map((bUid) => (
                    <div
                      key={bUid}
                      className="flex items-center justify-between gap-2 text-xs py-1"
                    >
                      <span className="text-white truncate">
                        {usersByUid[bUid]?.displayName || bUid.slice(0, 10)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void toggleBlockUser(user.uid, bUid, false)
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#22C55E]/15 text-[#22C55E] font-bold cursor-pointer"
                      >
                        {dict.chat.unblockUserBtn}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT CONVERSATION WORKSPACE */}
      <section
        className={`${
          activeChatId ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col min-w-0 bg-[#05070B]`}
      >
        {!activeChat || !activeMeta ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#22C55E]" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="font-display text-xl font-black text-white">
                LIVE <span className="text-[#22C55E]">CHAT</span>
              </h3>
              <p className="text-xs font-bold text-[#FACC15]">
                {dict.chat.slogan}
              </p>
              <p className="text-xs text-slate-400 pt-1">
                {dict.chat.selectChatPrompt}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#22C55E] text-black text-xs font-extrabold cursor-pointer"
              >
                {dict.chat.newGroupBtn}
              </button>
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white text-xs font-bold cursor-pointer"
              >
                {dict.chat.globalSearchTitle}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Conversation Header */}
            <header className="px-3 sm:px-4 py-2.5 border-b border-white/[0.08] bg-[#080C15] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveChatId('')}
                  className="md:hidden w-9 h-9 rounded-xl bg-white/[0.06] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/15 shrink-0">
                  <Image
                    src={activeMeta.avatar}
                    alt={activeMeta.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {activeMeta.isOnline && (
                    <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#080C15]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {activeMeta.title}
                  </p>
                  <p className="text-[11px] text-[#22C55E] font-medium truncate">
                    {typingNames.length > 0
                      ? `${typingNames[0]} · ${dict.chat.typing}`
                      : activeMeta.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  title={dict.chat.galleryTitle}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateMyChatMemberPrefs(activeChat.chatId, user.uid, {
                      muted: !myActiveMember?.muted,
                    })
                  }
                  title={
                    myActiveMember?.muted
                      ? dict.chat.unmuteChatBtn
                      : dict.chat.muteChatBtn
                  }
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  {myActiveMember?.muted ? (
                    <BellOff className="w-4 h-4 text-[#FACC15]" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </button>
                {activeChat.type === 'group' ? (
                  <button
                    type="button"
                    onClick={() => setGroupInfoOpen(true)}
                    title={dict.chat.groupInfoTitle}
                    className="w-9 h-9 rounded-xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#22C55E] flex items-center justify-center cursor-pointer"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleBlockUser(
                        user.uid,
                        activeMeta.partnerUid,
                        !activeMeta.isBlocked
                      )
                    }
                    title={
                      activeMeta.isBlocked
                        ? dict.chat.unblockUserBtn
                        : dict.chat.blockUserBtn
                    }
                    className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer ${
                      activeMeta.isBlocked
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-white/[0.05] hover:bg-red-500/15 text-slate-200 hover:text-red-300'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}
              </div>
            </header>

            {/* Pinned Message Sticky Bar */}
            {activeChat.pinnedMessageId && (
              <div className="px-4 py-2 bg-[#141A10] border-b border-[#FACC15]/25 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <Pin className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                  <span className="font-bold text-[#FACC15] shrink-0">
                    {dict.chat.pinnedBannerLabel}:
                  </span>
                  <span className="text-slate-200 truncate">
                    {activeChat.pinnedPreviewText ||
                      pinnedMessage?.text ||
                      '...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (pinnedMessage) {
                      void togglePinChatMessage(
                        activeChat,
                        profile,
                        pinnedMessage,
                        false
                      );
                    }
                  }}
                  className="text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer shrink-0"
                >
                  {dict.chat.unpinBtn}
                </button>
              </div>
            )}

            {/* Message Thread */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 space-y-2.5 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.06),transparent_55%)]"
              onClick={() => {
                setOpenMenuMsgId('');
                setOpenReactMsgId('');
              }}
            >
              {serverMessages.length >= messageLimit && (
                <div className="text-center pb-2">
                  <button
                    type="button"
                    onClick={() => setMessageLimit((l) => l + 40)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    {loadingMessages
                      ? dict.chat.loadingOlder
                      : dict.chat.loadOlderBtn}
                  </button>
                </div>
              )}

              {displayedMessages.map((msg) => {
                const isOwn = msg.senderUid === user.uid;
                const isFav = favoriteIdsSet.has(
                  `${msg.chatId}_${msg.messageId}`
                );
                const otherRead = (msg.readByUids || []).some(
                  (u) => u !== user.uid
                );
                const otherDelivered = (msg.deliveredToUids || []).some(
                  (u) => u !== user.uid
                );
                const canDeleteAll =
                  !msg.deletedForAll && (isOwn || Boolean(isActiveAdmin));

                return (
                  <motion.div
                    key={msg.messageId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    onTouchStart={(e) => {
                      if (msg.deletedForAll) return;
                      const t = e.touches[0];
                      touchStartRef.current = {
                        msg,
                        x: t.clientX,
                        y: t.clientY,
                      };
                    }}
                    onTouchEnd={(e) => {
                      const start = touchStartRef.current;
                      touchStartRef.current = null;
                      if (!start || msg.deletedForAll) return;
                      const t = e.changedTouches[0];
                      const dx = t.clientX - start.x;
                      const dy = Math.abs(t.clientY - start.y);
                      if (dx > 55 && dy < 40) {
                        setReplyingTo({
                          messageId: msg.messageId,
                          senderUid: msg.senderUid,
                          senderName: msg.senderName,
                          type: msg.type,
                          previewText:
                            msg.attachment?.fileName ||
                            msg.text.slice(0, 120) ||
                            msg.type,
                        });
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                          navigator.vibrate(12);
                        }
                      }
                    }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`group relative max-w-[88%] sm:max-w-[74%] rounded-2xl px-3.5 py-2.5 border ${
                        isOwn
                          ? 'bg-[#0F2318] border-[#22C55E]/30 text-white'
                          : 'bg-[#0D121E] border-white/10 text-slate-100'
                      }`}
                    >
                      {/* Sender Name in Groups */}
                      {activeChat.type === 'group' && !isOwn && (
                        <p className="text-[11px] font-extrabold text-[#22C55E] mb-1">
                          {msg.senderName}
                        </p>
                      )}

                      {/* Forwarded Tag */}
                      {msg.forwardedFrom && !msg.deletedForAll && (
                        <p className="text-[10px] italic text-[#FACC15] flex items-center gap-1 mb-1">
                          <Forward className="w-3 h-3" />
                          {dict.chat.forwardedTag} ·{' '}
                          {msg.forwardedFrom.originalSenderName}
                        </p>
                      )}

                      {/* Reply Quote */}
                      {msg.replyTo && !msg.deletedForAll && (
                        <div className="mb-1.5 ps-2.5 py-1 rounded-lg bg-black/35 border-s-2 border-[#FACC15] text-[11px]">
                          <p className="font-bold text-[#FACC15]">
                            {msg.replyTo.senderName}
                          </p>
                          <p className="text-slate-300 truncate">
                            {msg.replyTo.previewText}
                          </p>
                        </div>
                      )}

                      {/* Deleted Placeholder OR Real Content */}
                      {msg.deletedForAll ? (
                        <p className="text-xs italic text-slate-400">
                          {dict.chat.deletedForAllText}
                        </p>
                      ) : (
                        <>
                          {msg.attachment && (
                            <div className="mb-1.5">
                              <ChatMediaMessage
                                chatId={activeChat.chatId}
                                message={msg}
                                onOpenImage={(m) => setViewerImageId(m.messageId)}
                                onOpenEnhancer={(m) => setEnhancerMsg(m)}
                              />
                            </div>
                          )}

                          {msg.text && (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {msg.text}
                            </p>
                          )}
                        </>
                      )}

                      {/* Reactions */}
                      {!msg.deletedForAll &&
                        msg.reactions &&
                        Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(msg.reactions).map(
                              ([emoji, uids]) => {
                                if (!uids || uids.length === 0) return null;
                                const mine = uids.includes(user.uid);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() =>
                                      void toggleMessageReaction(
                                        activeChat.chatId,
                                        msg.messageId,
                                        user.uid,
                                        emoji
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] border cursor-pointer ${
                                      mine
                                        ? 'bg-[#22C55E]/20 border-[#22C55E]/50 text-white'
                                        : 'bg-black/35 border-white/10 text-slate-300'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-bold tabular-nums">
                                      {uids.length}
                                    </span>
                                  </button>
                                );
                              }
                            )}
                          </div>
                        )}

                      {/* Footer: timestamp, edited, read receipts, action buttons */}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
                        {msg.pinned && (
                          <Pin className="w-3 h-3 text-[#FACC15]" />
                        )}
                        {isFav && (
                          <Star className="w-3 h-3 text-[#FACC15] fill-[#FACC15]" />
                        )}
                        {msg.editedAtMs && !msg.deletedForAll && (
                          <span>{dict.chat.editedTag}</span>
                        )}
                        <span className="tabular-nums">
                          {formatClockTime(msg.createdAtMs)}
                        </span>

                        {isOwn && !msg.deletedForAll && (
                          <>
                            {msg.localStatus === 'pending' ? (
                              <Clock className="w-3 h-3 text-[#FACC15]" />
                            ) : msg.localStatus === 'failed' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRetryFailedMessage(msg)
                                }
                                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-bold cursor-pointer"
                              >
                                <AlertCircle className="w-3 h-3" />
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            ) : otherRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                            ) : otherDelivered ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </>
                        )}

                        {!msg.deletedForAll && !msg.localStatus && (
                          <div
                            className="flex items-center gap-0.5 ms-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenReactMsgId(
                                  openReactMsgId === msg.messageId
                                    ? ''
                                    : msg.messageId
                                );
                                setOpenMenuMsgId('');
                              }}
                              className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                            >
                              <SmilePlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMsgId(
                                  openMenuMsgId === msg.messageId
                                    ? ''
                                    : msg.messageId
                                );
                                setOpenReactMsgId('');
                              }}
                              className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Quick Emoji Picker Popover */}
                      {openReactMsgId === msg.messageId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute bottom-full mb-1.5 ${
                            isOwn ? 'end-0' : 'start-0'
                          } z-30 px-2 py-1.5 rounded-2xl bg-[#0B0F19] border border-white/15 shadow-2xl flex items-center gap-1`}
                        >
                          {CHAT_REACTION_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => {
                                setOpenReactMsgId('');
                                void toggleMessageReaction(
                                  activeChat.chatId,
                                  msg.messageId,
                                  user.uid,
                                  em
                                );
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-white/10 text-base flex items-center justify-center cursor-pointer"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Context Menu */}
                      {openMenuMsgId === msg.messageId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute bottom-full mb-1.5 ${
                            isOwn ? 'end-0' : 'start-0'
                          } z-30 w-52 rounded-2xl bg-[#0B0F19] border border-white/15 shadow-2xl p-1.5 space-y-0.5 text-xs`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuMsgId('');
                              setReplyingTo({
                                messageId: msg.messageId,
                                senderUid: msg.senderUid,
                                senderName: msg.senderName,
                                type: msg.type,
                                previewText:
                                  msg.attachment?.fileName ||
                                  msg.text.slice(0, 120) ||
                                  msg.type,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5 text-[#22C55E]" />
                            {dict.chat.replyAction}
                          </button>

                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMsgId('');
                                void navigator.clipboard?.writeText(msg.text);
                                showToast(dict.chat.copiedToast);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-300" />
                              {dict.chat.copyAction}
                            </button>
                          )}

                          {isOwn && msg.type === 'text' && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMsgId('');
                                setEditingMessage(msg);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#FACC15]" />
                              {dict.chat.editAction}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuMsgId('');
                              setForwardMsg(msg);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                          >
                            <Forward className="w-3.5 h-3.5 text-[#FACC15]" />
                            {dict.chat.forwardAction}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuMsgId('');
                              void togglePinChatMessage(
                                activeChat,
                                profile,
                                msg,
                                !msg.pinned
                              );
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                          >
                            {msg.pinned ? (
                              <PinOff className="w-3.5 h-3.5 text-[#FACC15]" />
                            ) : (
                              <Pin className="w-3.5 h-3.5 text-[#FACC15]" />
                            )}
                            {msg.pinned
                              ? dict.chat.unpinAction
                              : dict.chat.pinAction}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuMsgId('');
                              void toggleFavoriteMessage(
                                user.uid,
                                activeMeta.title,
                                msg,
                                isFav
                              );
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5 text-[#FACC15]" />
                            {isFav
                              ? dict.chat.unfavoriteAction
                              : dict.chat.favoriteAction}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuMsgId('');
                              void deleteChatMessageForMe(
                                activeChat.chatId,
                                msg.messageId,
                                user.uid
                              );
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-500/15 flex items-center gap-2 text-red-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {dict.chat.deleteMeAction}
                          </button>

                          {canDeleteAll && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMsgId('');
                                void deleteChatMessageForAll(
                                  activeChat.chatId,
                                  msg.messageId
                                );
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-500/20 flex items-center gap-2 text-red-400 font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {dict.chat.deleteAllAction}
                            </button>
                          )}

                          {!isOwn && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMsgId('');
                                setReportMsg(msg);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-500/15 flex items-center gap-2 text-red-300 cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              {dict.chat.reportAction}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <ChatComposer
              disabled={activeMeta.isBlocked}
              blockedNotice={
                activeMeta.isBlocked ? dict.chat.blockedBanner : undefined
              }
              replyingTo={replyingTo}
              editingMessage={editingMessage}
              uploads={uploads.filter((u) => u.chatId === activeChat.chatId)}
              onClearReply={() => setReplyingTo(null)}
              onClearEdit={() => setEditingMessage(null)}
              onTypingChange={(typing) =>
                void setTypingIndicator(activeChat.chatId, user.uid, typing)
              }
              onSendText={handleSendText}
              onSaveEdit={handleSaveEdit}
              onSendFiles={handleSendFiles}
              onCancelUpload={handleCancelUpload}
              onRetryUpload={handleRetryUpload}
            />
          </>
        )}
      </section>

      {/* MODALS */}
      {viewerImageId && activeChat && activeImageMessages.length > 0 && (
        <OriginalImageViewer
          chatId={activeChat.chatId}
          imageMessages={activeImageMessages}
          initialMessageId={viewerImageId}
          onClose={() => setViewerImageId('')}
          onForward={(m) => {
            setViewerImageId('');
            setForwardMsg(m);
          }}
          onOpenEnhancer={(m) => {
            setViewerImageId('');
            setEnhancerMsg(m);
          }}
        />
      )}

      {enhancerMsg?.attachment && activeChat && (
        <LiveImageEnhancerModal
          chatId={activeChat.chatId}
          attachment={enhancerMsg.attachment}
          onClose={() => setEnhancerMsg(null)}
          onSendEnhancedCopy={handleSendEnhancedCopy}
        />
      )}

      {galleryOpen && activeChat && (
        <ChatMediaGalleryModal
          chatId={activeChat.chatId}
          messages={displayedMessages}
          onClose={() => setGalleryOpen(false)}
          onOpenImage={(m) => {
            setGalleryOpen(false);
            setViewerImageId(m.messageId);
          }}
          onOpenEnhancer={(m) => {
            setGalleryOpen(false);
            setEnhancerMsg(m);
          }}
        />
      )}

      {globalSearchOpen && (
        <GlobalChatSearchModal
          chats={chats}
          usersByUid={usersByUid}
          currentUid={user.uid}
          onClose={() => setGlobalSearchOpen(false)}
          onSelectChat={(id) => handleOpenChat(id)}
        />
      )}

      {createGroupOpen && (
        <CreateGroupModal
          currentUser={profile}
          users={users}
          onClose={() => setCreateGroupOpen(false)}
          onCreated={(room) => {
            setRailTab('groups');
            handleOpenChat(room.chatId);
          }}
        />
      )}

      {groupInfoOpen && activeChat && activeChat.type === 'group' && (
        <GroupInfoModal
          chat={activeChat}
          currentUser={profile}
          myMemberState={myActiveMember}
          users={users}
          usersByUid={usersByUid}
          onClose={() => setGroupInfoOpen(false)}
          onLeftGroup={() => setActiveChatId('')}
        />
      )}

      {forwardMsg && (
        <ForwardMessageModal
          sourceMessage={forwardMsg}
          chats={chats}
          currentUser={profile}
          usersByUid={usersByUid}
          onClose={() => setForwardMsg(null)}
          onForwarded={(targetId) => handleOpenChat(targetId)}
        />
      )}

      {reportMsg && (
        <ReportMessageModal
          message={reportMsg}
          reporterUid={user.uid}
          onClose={() => setReportMsg(null)}
          onSubmitted={() => showToast(dict.chat.reportSentToast)}
        />
      )}
    </div>
  );
}
