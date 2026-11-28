import { Timestamp } from 'firebase/firestore';

export type ChatType = 'direct' | 'group';

export type ChatGroupCategory =
  | 'turma'
  | 'instrutores'
  | 'administracao'
  | 'comunicados'
  | 'duvidas'
  | 'aulas';

export type ChatMessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

export type ChatAttachmentCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export type ChatSendMode = 'quick' | 'original';

export type ChatEnhancementMode = 'natural' | 'hd' | 'advanced';

export const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024; // 20 MB real browser + chunked Firestore cap
export const CHAT_CHUNK_RAW_BYTES = 450 * 1024; // ~600 KB base64 per chunk (< 1 MB Firestore doc limit)

export const CHAT_REACTION_EMOJIS = [
  '❤️',
  '👍',
  '😂',
  '😮',
  '😢',
  '🔥',
  '👏',
] as const;

export interface ChatAttachmentMeta {
  fileId: string;
  fileName: string;
  mimeType: string;
  extension: string;
  category: ChatAttachmentCategory;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  sendMode: ChatSendMode;
  chunkCount: number;
  sha256: string;
  previewDataUrl?: string; // Lightweight inline thumbnail only; original bytes always untouched in chunks
  isEnhanced?: boolean;
  originalFileId?: string;
  enhancementMode?: ChatEnhancementMode;
}

export interface ChatReplySnapshot {
  messageId: string;
  senderUid: string;
  senderName: string;
  type: ChatMessageType;
  previewText: string;
}

export interface ChatForwardSnapshot {
  originalChatId: string;
  originalMessageId: string;
  originalSenderName: string;
}

export interface ChatRoom {
  chatId: string;
  type: ChatType;
  directPairKey?: string;
  title?: string;
  description?: string;
  photoURL?: string;
  groupCategory?: ChatGroupCategory;
  memberIds: string[];
  adminIds: string[];
  createdBy: string;
  pinnedMessageId?: string;
  pinnedPreviewText?: string;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageType?: ChatMessageType;
  lastMessageSenderUid?: string;
  lastMessageSenderName?: string;
  lastMessageAtMs?: number;
  lastMessageAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMemberState {
  uid: string;
  chatId: string;
  role: 'owner' | 'admin' | 'member';
  muted: boolean;
  pinned: boolean;
  unreadCount: number;
  lastReadAtMs: number;
  lastDeliveredAtMs: number;
  typingAtMs: number;
  joinedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  type: ChatMessageType;
  text: string;
  replyTo?: ChatReplySnapshot;
  forwardedFrom?: ChatForwardSnapshot;
  reactions?: Record<string, string[]>;
  attachment?: ChatAttachmentMeta;
  deliveredToUids?: string[];
  readByUids?: string[];
  editedAtMs?: number;
  deletedForAll?: boolean;
  deletedForUids?: string[];
  pinned?: boolean;
  clientNonce?: string;
  createdAtMs: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  // Client-only optimistic/offline states
  localStatus?: 'pending' | 'failed';
  localError?: string;
}

export interface ChatFileManifest {
  fileId: string;
  chatId: string;
  senderUid: string;
  fileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  chunkCount: number;
  sha256: string;
  completed: boolean;
  createdAt?: Timestamp | null;
}

export interface ChatFileChunk {
  chunkId: string;
  fileId: string;
  chatId: string;
  senderUid: string;
  chunkIndex: number;
  dataBase64: string;
  createdAt?: Timestamp | null;
}

export interface ChatPresence {
  uid: string;
  online: boolean;
  lastSeenAtMs: number;
  hideOnline: boolean;
  hideLastSeen: boolean;
  blockedUids: string[];
  notificationsEnabled: boolean;
  groupNotificationsEnabled: boolean;
  showPreviews: boolean;
  updatedAt?: Timestamp | null;
}

export interface ChatFavoriteRecord {
  favoriteId: string;
  uid: string;
  chatId: string;
  chatTitle: string;
  messageId: string;
  senderName: string;
  type: ChatMessageType;
  previewText: string;
  attachmentName?: string;
  createdAtMs: number;
  savedAt?: Timestamp | null;
}

export interface ChatNotificationRecord {
  notifId: string;
  recipientUid: string;
  chatId: string;
  messageId?: string;
  type: 'message' | 'reply' | 'mention' | 'file' | 'group_join' | 'pinned';
  senderUid: string;
  senderName: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: Timestamp | null;
}

export interface ChatReportRecord {
  reportId: string;
  reporterUid: string;
  chatId: string;
  messageId: string;
  reportedUid: string;
  fileId?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed';
  createdAt?: Timestamp | null;
}

export interface UploadProgressState {
  taskId: string;
  chatId: string;
  fileName: string;
  sizeBytes: number;
  sendMode: ChatSendMode;
  uploadedChunks: number;
  totalChunks: number;
  percent: number;
  status: 'hashing' | 'uploading' | 'cancelled' | 'failed' | 'completed';
  error?: string;
  canResume?: boolean;
}
