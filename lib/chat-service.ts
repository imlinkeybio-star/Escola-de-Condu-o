import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  CHAT_CHUNK_RAW_BYTES,
  ChatAttachmentCategory,
  ChatAttachmentMeta,
  ChatEnhancementMode,
  ChatFavoriteRecord,
  ChatFileChunk,
  ChatFileManifest,
  ChatForwardSnapshot,
  ChatGroupCategory,
  ChatMemberState,
  ChatMessage,
  ChatMessageType,
  ChatPresence,
  ChatReplySnapshot,
  ChatRoom,
  ChatSendMode,
  MAX_CHAT_FILE_BYTES,
  UploadProgressState,
} from './chat-types';
import { UserProfile } from './types';
import { sanitizeAvatarPhotoUrl } from './url-safety';

function safeId(raw: string, maxLen = 120): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen) || 'id';
}

export function buildDirectChatId(uidA: string, uidB: string): string {
  const sorted = [safeId(uidA, 58), safeId(uidB, 58)].sort();
  return `direct_${sorted[0]}_${sorted[1]}`;
}

export function buildDirectPairKey(uidA: string, uidB: string): string {
  const sorted = [safeId(uidA, 58), safeId(uidB, 58)].sort();
  return `${sorted[0]}__${sorted[1]}`;
}

export function getFileExtension(fileName: string): string {
  const clean = fileName.trim();
  const idx = clean.lastIndexOf('.');
  if (idx <= 0 || idx === clean.length - 1) return 'bin';
  return clean.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'bin';
}

export function categorizeChatFile(
  mimeType: string,
  fileName: string
): ChatAttachmentCategory {
  const mime = (mimeType || '').toLowerCase();
  const ext = getFileExtension(fileName);

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    mime.startsWith('text/') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(
      ext
    )
  ) {
    return 'document';
  }
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, i + step);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function splitBufferIntoChunks(
  bytes: Uint8Array,
  chunkSize = CHAT_CHUNK_RAW_BYTES
): Uint8Array[] {
  const safeSize = Math.max(1024, chunkSize);
  if (bytes.length === 0) return [new Uint8Array(0)];
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += safeSize) {
    chunks.push(bytes.subarray(offset, offset + safeSize));
  }
  return chunks;
}

export function reassembleChunks(
  chunks: Array<{ chunkIndex: number; dataBase64: string }>
): Uint8Array {
  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const decodedParts = ordered.map((c) => base64ToBytes(c.dataBase64));
  const totalBytes = decodedParts.reduce((acc, part) => acc + part.length, 0);
  const merged = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const part of decodedParts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return merged;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback only for exotic environments lacking crypto.subtle
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16).padStart(8, '0')}_${bytes.length}`;
}

export async function probeImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(blob);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  } catch {
    return null;
  }
}

export async function probeMediaDuration(blob: Blob): Promise<number | undefined> {
  if (typeof document === 'undefined') return undefined;
  const isVideo = blob.type.startsWith('video/');
  const isAudio = blob.type.startsWith('audio/');
  if (!isVideo && !isAudio) return undefined;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    const cleanup = () => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
    };
    el.onloadedmetadata = () => {
      const dur =
        Number.isFinite(el.duration) && el.duration > 0
          ? Math.round(el.duration)
          : undefined;
      cleanup();
      resolve(dur);
    };
    el.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    el.src = url;
  });
}

/**
 * Generates an optional lightweight display thumbnail ONLY for fast inline rendering.
 * Original bytes remain untouched in `file_chunks`.
 */
export async function createTinyImagePreviewDataUrl(
  blob: Blob
): Promise<string | undefined> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return undefined;
  }
  try {
    const bmp = await createImageBitmap(blob);
    try {
      const maxEdge = 420;
      const scale =
        Math.max(bmp.width, bmp.height) > maxEdge
          ? maxEdge / Math.max(bmp.width, bmp.height)
          : 1;
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(bmp, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      return dataUrl.length <= 65000 ? dataUrl : undefined;
    } finally {
      bmp.close();
    }
  } catch {
    return undefined;
  }
}

// =========================================================================
// Presence & Privacy Settings
// =========================================================================

export async function ensureChatPresence(uid: string): Promise<ChatPresence> {
  const ref = doc(db, 'chat_presence', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as ChatPresence;
    await updateDoc(ref, {
      online: true,
      lastSeenAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    return data;
  }
  const initial: ChatPresence = {
    uid,
    online: true,
    lastSeenAtMs: Date.now(),
    hideOnline: false,
    hideLastSeen: false,
    blockedUids: [],
    notificationsEnabled: true,
    groupNotificationsEnabled: true,
    showPreviews: true,
  };
  await setDoc(ref, {
    ...initial,
    updatedAt: serverTimestamp(),
  });
  return initial;
}

export async function updateChatPresence(
  uid: string,
  patch: Partial<
    Pick<
      ChatPresence,
      | 'online'
      | 'lastSeenAtMs'
      | 'hideOnline'
      | 'hideLastSeen'
      | 'notificationsEnabled'
      | 'groupNotificationsEnabled'
      | 'showPreviews'
    >
  >
): Promise<void> {
  const ref = doc(db, 'chat_presence', uid);
  try {
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chat_presence/${uid}`);
  }
}

export async function toggleBlockUser(
  uid: string,
  targetUid: string,
  block: boolean
): Promise<void> {
  if (!uid || !targetUid || uid === targetUid) return;
  const ref = doc(db, 'chat_presence', uid);
  try {
    await updateDoc(ref, {
      blockedUids: block ? arrayUnion(targetUid) : arrayRemove(targetUid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chat_presence/${uid}`);
  }
}

// =========================================================================
// Direct & Group Conversations
// =========================================================================

export async function createOrOpenDirectChat(
  currentUser: UserProfile,
  targetUser: UserProfile
): Promise<ChatRoom> {
  if (currentUser.uid === targetUser.uid) {
    throw new Error('Não podes iniciar uma conversa privada contigo mesmo.');
  }
  const chatId = buildDirectChatId(currentUser.uid, targetUser.uid);
  const directPairKey = buildDirectPairKey(currentUser.uid, targetUser.uid);
  const chatRef = doc(db, 'chats', chatId);
  const existing = await getDoc(chatRef);

  if (existing.exists()) {
    const room = existing.data() as ChatRoom;
    // Ensure member doc exists for caller
    const myMemberRef = doc(db, 'chats', chatId, 'members', currentUser.uid);
    const myMem = await getDoc(myMemberRef);
    if (!myMem.exists()) {
      await setDoc(myMemberRef, {
        uid: currentUser.uid,
        chatId,
        role: 'member',
        muted: false,
        pinned: false,
        unreadCount: 0,
        lastReadAtMs: Date.now(),
        lastDeliveredAtMs: Date.now(),
        typingAtMs: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return room;
  }

  const members = [currentUser.uid, targetUser.uid].sort();
  const roomPayload: Record<string, unknown> = {
    chatId,
    type: 'direct',
    directPairKey,
    memberIds: members,
    adminIds: [],
    createdBy: currentUser.uid,
    lastMessageAtMs: Date.now(),
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(chatRef, roomPayload);
    for (const uid of members) {
      batch.set(doc(db, 'chats', chatId, 'members', uid), {
        uid,
        chatId,
        role: 'member',
        muted: false,
        pinned: false,
        unreadCount: 0,
        lastReadAtMs: Date.now(),
        lastDeliveredAtMs: Date.now(),
        typingAtMs: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}`);
  }

  const snap = await getDoc(chatRef);
  return snap.data() as ChatRoom;
}

export async function createGroupChat(params: {
  creator: UserProfile;
  title: string;
  description?: string;
  photoURL?: string;
  groupCategory: ChatGroupCategory;
  memberUids: string[];
}): Promise<ChatRoom> {
  const cleanTitle = params.title.trim().slice(0, 80);
  if (cleanTitle.length < 2) {
    throw new Error('O nome do grupo deve ter pelo menos 2 caracteres.');
  }
  const uniqueMembers = Array.from(
    new Set([params.creator.uid, ...params.memberUids.filter(Boolean)])
  ).slice(0, 150);

  const chatId = safeId(
    `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    120
  );
  const safePhoto = params.photoURL
    ? sanitizeAvatarPhotoUrl(params.photoURL)
    : null;

  const roomPayload: Record<string, unknown> = {
    chatId,
    type: 'group',
    title: cleanTitle,
    groupCategory: params.groupCategory,
    memberIds: uniqueMembers,
    adminIds: [params.creator.uid],
    createdBy: params.creator.uid,
    lastMessagePreview: cleanTitle,
    lastMessageType: 'text',
    lastMessageSenderUid: params.creator.uid,
    lastMessageSenderName: params.creator.displayName.slice(0, 60),
    lastMessageAtMs: Date.now(),
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.description?.trim()) {
    roomPayload.description = params.description.trim().slice(0, 240);
  }
  if (safePhoto) {
    roomPayload.photoURL = safePhoto;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'chats', chatId), roomPayload);
    for (const uid of uniqueMembers) {
      batch.set(doc(db, 'chats', chatId, 'members', uid), {
        uid,
        chatId,
        role: uid === params.creator.uid ? 'owner' : 'member',
        muted: false,
        pinned: false,
        unreadCount: uid === params.creator.uid ? 0 : 1,
        lastReadAtMs: uid === params.creator.uid ? Date.now() : 0,
        lastDeliveredAtMs: Date.now(),
        typingAtMs: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (uid !== params.creator.uid) {
        const notifId = safeId(`cn_${Date.now()}_${uid.slice(0, 12)}`, 120);
        batch.set(doc(db, 'chat_notifications', notifId), {
          notifId,
          recipientUid: uid,
          chatId,
          type: 'group_join',
          senderUid: params.creator.uid,
          senderName: params.creator.displayName.slice(0, 60),
          title: cleanTitle,
          body: `${params.creator.displayName} adicionou-te ao grupo ${cleanTitle}.`.slice(
            0,
            240
          ),
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}`);
  }

  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.data() as ChatRoom;
}

export async function updateGroupChatDetails(
  chatId: string,
  patch: { title?: string; description?: string; photoURL?: string; groupCategory?: ChatGroupCategory }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 80);
    if (t.length < 2) throw new Error('Nome do grupo inválido.');
    payload.title = t;
  }
  if (patch.description !== undefined) {
    payload.description = patch.description.trim().slice(0, 240);
  }
  if (patch.groupCategory !== undefined) {
    payload.groupCategory = patch.groupCategory;
  }
  if (patch.photoURL !== undefined) {
    const safe = sanitizeAvatarPhotoUrl(patch.photoURL);
    if (safe) payload.photoURL = safe;
  }
  try {
    await updateDoc(doc(db, 'chats', chatId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function addGroupMembers(
  chat: ChatRoom,
  actorName: string,
  actorUid: string,
  newUids: string[]
): Promise<void> {
  const filtered = newUids.filter((u) => u && !chat.memberIds.includes(u));
  if (filtered.length === 0) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'chats', chat.chatId), {
    memberIds: arrayUnion(...filtered),
    updatedAt: serverTimestamp(),
  });
  for (const uid of filtered) {
    batch.set(doc(db, 'chats', chat.chatId, 'members', uid), {
      uid,
      chatId: chat.chatId,
      role: 'member',
      muted: false,
      pinned: false,
      unreadCount: 1,
      lastReadAtMs: 0,
      lastDeliveredAtMs: Date.now(),
      typingAtMs: 0,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const notifId = safeId(`cn_${Date.now()}_${uid.slice(0, 12)}`, 120);
    batch.set(doc(db, 'chat_notifications', notifId), {
      notifId,
      recipientUid: uid,
      chatId: chat.chatId,
      type: 'group_join',
      senderUid: actorUid,
      senderName: actorName.slice(0, 60),
      title: (chat.title || 'Grupo').slice(0, 100),
      body: `${actorName} adicionou-te ao grupo ${chat.title || ''}.`.slice(0, 240),
      read: false,
      createdAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chat.chatId}`);
  }
}

export async function removeGroupMember(
  chatId: string,
  targetUid: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'chats', chatId), {
    memberIds: arrayRemove(targetUid),
    adminIds: arrayRemove(targetUid),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'chats', chatId, 'members', targetUid));
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function toggleGroupMemberAdmin(
  chatId: string,
  targetUid: string,
  makeAdmin: boolean
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'chats', chatId), {
    adminIds: makeAdmin ? arrayUnion(targetUid) : arrayRemove(targetUid),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'chats', chatId, 'members', targetUid), {
    role: makeAdmin ? 'admin' : 'member',
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function updateMyChatMemberPrefs(
  chatId: string,
  uid: string,
  patch: Partial<Pick<ChatMemberState, 'muted' | 'pinned'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'members', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/members/${uid}`);
  }
}

export async function setTypingIndicator(
  chatId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'members', uid), {
      typingAtMs: isTyping ? Date.now() : 0,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking UI hint
  }
}

export async function markChatMessagesReadAndDelivered(
  chatId: string,
  uid: string,
  messages: ChatMessage[]
): Promise<void> {
  const nowMs = Date.now();
  const toMark = messages.filter(
    (m) =>
      m.senderUid !== uid &&
      !m.localStatus &&
      (!(m.readByUids || []).includes(uid) || !(m.deliveredToUids || []).includes(uid))
  );

  const memberRef = doc(db, 'chats', chatId, 'members', uid);
  await updateDoc(memberRef, {
    unreadCount: 0,
    lastReadAtMs: nowMs,
    lastDeliveredAtMs: nowMs,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  if (toMark.length === 0) return;

  const batch = writeBatch(db);
  for (const m of toMark.slice(-20)) {
    batch.update(doc(db, 'chats', chatId, 'messages', m.messageId), {
      deliveredToUids: arrayUnion(uid),
      readByUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit().catch(() => {});
}

// =========================================================================
// Chunked Lossless Original File Storage (Participant-Scoped)
// =========================================================================

const objectUrlCache = new Map<string, { url: string; blob: Blob }>();

export async function uploadChatFileChunked(params: {
  chatId: string;
  senderUid: string;
  file: File;
  sendMode: ChatSendMode;
  existingFileId?: string;
  taskId: string;
  isEnhanced?: boolean;
  originalFileId?: string;
  enhancementMode?: ChatEnhancementMode;
  signal?: AbortSignal;
  onProgress?: (state: UploadProgressState) => void;
}): Promise<ChatAttachmentMeta> {
  const { chatId, senderUid, file, sendMode, signal, onProgress } = params;
  if (file.size <= 0) {
    throw new Error('O ficheiro selecionado está vazio.');
  }
  if (file.size > MAX_CHAT_FILE_BYTES) {
    throw new Error(
      `O ficheiro excede o limite real de ${formatFileSize(MAX_CHAT_FILE_BYTES)} (${formatFileSize(file.size)}).`
    );
  }

  const fileId =
    params.existingFileId ||
    safeId(`file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 120);
  const extension = getFileExtension(file.name);
  const mimeType = file.type || 'application/octet-stream';
  const category = categorizeChatFile(mimeType, file.name);

  onProgress?.({
    taskId: params.taskId,
    chatId,
    fileName: file.name,
    sizeBytes: file.size,
    sendMode,
    uploadedChunks: 0,
    totalChunks: 1,
    percent: 2,
    status: 'hashing',
  });

  const arrayBuf = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

  const rawBytes = new Uint8Array(arrayBuf);
  const sha256 = await computeSha256Hex(rawBytes);
  const chunks = splitBufferIntoChunks(rawBytes, CHAT_CHUNK_RAW_BYTES);
  const totalChunks = chunks.length;

  // Probe optional metadata without altering original bytes
  const [dims, durationSec, previewDataUrl] = await Promise.all([
    category === 'image' ? probeImageDimensions(file) : Promise.resolve(null),
    category === 'audio' || category === 'video'
      ? probeMediaDuration(file)
      : Promise.resolve(undefined),
    category === 'image'
      ? createTinyImagePreviewDataUrl(file)
      : Promise.resolve(undefined),
  ]);

  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

  const manifestRef = doc(db, 'chats', chatId, 'file_manifests', fileId);
  const existingManifest = await getDoc(manifestRef);
  if (!existingManifest.exists()) {
    const manifest: ChatFileManifest = {
      fileId,
      chatId,
      senderUid,
      fileName: file.name.slice(0, 180),
      mimeType: mimeType.slice(0, 120),
      extension,
      sizeBytes: file.size,
      chunkCount: totalChunks,
      sha256,
      completed: false,
    };
    await setDoc(manifestRef, {
      ...manifest,
      createdAt: serverTimestamp(),
    });
  }

  // Resume support: skip already uploaded chunks if retrying an interrupted upload
  const alreadyUploaded = new Set<number>();
  if (params.existingFileId) {
    const existingChunksSnap = await getDocs(
      query(
        collection(db, 'chats', chatId, 'file_chunks'),
        where('fileId', '==', fileId)
      )
    );
    existingChunksSnap.docs.forEach((d) => {
      const data = d.data() as Partial<ChatFileChunk>;
      if (typeof data.chunkIndex === 'number') {
        alreadyUploaded.add(data.chunkIndex);
      }
    });
  }

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      throw new DOMException('Cancelled', 'AbortError');
    }
    if (!alreadyUploaded.has(i)) {
      const chunkId = `${fileId}_${i}`;
      const dataBase64 = bytesToBase64(chunks[i]);
      const chunkPayload: Omit<ChatFileChunk, 'createdAt'> = {
        chunkId,
        fileId,
        chatId,
        senderUid,
        chunkIndex: i,
        dataBase64,
      };
      await setDoc(doc(db, 'chats', chatId, 'file_chunks', chunkId), {
        ...chunkPayload,
        createdAt: serverTimestamp(),
      });
    }

    const doneCount = i + 1;
    onProgress?.({
      taskId: params.taskId,
      chatId,
      fileName: file.name,
      sizeBytes: file.size,
      sendMode,
      uploadedChunks: doneCount,
      totalChunks,
      percent: Math.min(99, Math.round((doneCount / totalChunks) * 100)),
      status: 'uploading',
    });
  }

  await updateDoc(manifestRef, { completed: true }).catch(() => {});

  // Pre-cache exact local ObjectURL so sender immediately sees original quality without refetching
  const exactBlob = new Blob([rawBytes], { type: mimeType });
  const localUrl = URL.createObjectURL(exactBlob);
  objectUrlCache.set(`${chatId}:${fileId}`, { url: localUrl, blob: exactBlob });

  onProgress?.({
    taskId: params.taskId,
    chatId,
    fileName: file.name,
    sizeBytes: file.size,
    sendMode,
    uploadedChunks: totalChunks,
    totalChunks,
    percent: 100,
    status: 'completed',
  });

  const attachment: ChatAttachmentMeta = {
    fileId,
    fileName: file.name.slice(0, 180),
    mimeType: mimeType.slice(0, 120),
    extension,
    category,
    sizeBytes: file.size,
    sendMode,
    chunkCount: totalChunks,
    sha256,
  };
  if (dims) {
    attachment.width = dims.width;
    attachment.height = dims.height;
  }
  if (durationSec !== undefined) {
    attachment.durationSec = durationSec;
  }
  if (previewDataUrl) {
    attachment.previewDataUrl = previewDataUrl;
  }
  if (params.isEnhanced) {
    attachment.isEnhanced = true;
  }
  if (params.originalFileId) {
    attachment.originalFileId = params.originalFileId;
  }
  if (params.enhancementMode) {
    attachment.enhancementMode = params.enhancementMode;
  }
  return attachment;
}

export async function fetchOriginalFileBlob(
  chatId: string,
  fileId: string,
  mimeType: string
): Promise<{ url: string; blob: Blob }> {
  const cacheKey = `${chatId}:${fileId}`;
  const cached = objectUrlCache.get(cacheKey);
  if (cached) return cached;

  const chunksSnap = await getDocs(
    query(
      collection(db, 'chats', chatId, 'file_chunks'),
      where('fileId', '==', fileId)
    )
  );
  if (chunksSnap.empty) {
    throw new Error('Os blocos originais deste ficheiro não estão disponíveis.');
  }

  const chunkDocs = chunksSnap.docs.map((d) => d.data() as ChatFileChunk);
  const bytes = reassembleChunks(chunkDocs);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], {
    type: mimeType || 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);

  if (objectUrlCache.size >= 40) {
    const oldestKey = objectUrlCache.keys().next().value;
    if (oldestKey) {
      const entry = objectUrlCache.get(oldestKey);
      if (entry) URL.revokeObjectURL(entry.url);
      objectUrlCache.delete(oldestKey);
    }
  }
  objectUrlCache.set(cacheKey, { url, blob });
  return { url, blob };
}

export async function triggerOriginalFileDownload(
  chatId: string,
  attachment: ChatAttachmentMeta
): Promise<void> {
  const { url } = await fetchOriginalFileBlob(
    chatId,
    attachment.fileId,
    attachment.mimeType
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// =========================================================================
// Messaging, Reactions, Replies, Edits, Deletions, Pins, Favorites
// =========================================================================

export function buildLastMessagePreviewText(
  type: ChatMessageType,
  text: string,
  attachment?: ChatAttachmentMeta
): string {
  if (type === 'image') return `📷 ${attachment?.fileName || text || 'Fotografia'}`.slice(0, 120);
  if (type === 'video') return `🎥 ${attachment?.fileName || text || 'Vídeo'}`.slice(0, 120);
  if (type === 'audio') return `🎤 ${attachment?.fileName || text || 'Mensagem de voz'}`.slice(0, 120);
  if (type === 'file') return `📄 ${attachment?.fileName || text || 'Documento'}`.slice(0, 120);
  return text.trim().slice(0, 120) || 'Mensagem';
}

export async function sendChatMessage(params: {
  chat: ChatRoom;
  sender: UserProfile;
  type: ChatMessageType;
  text: string;
  replyTo?: ChatReplySnapshot;
  forwardedFrom?: ChatForwardSnapshot;
  attachment?: ChatAttachmentMeta;
  clientNonce?: string;
}): Promise<ChatMessage> {
  const { chat, sender, type, text, replyTo, forwardedFrom, attachment } = params;
  const cleanText = text.trim().slice(0, 4000);
  if (!cleanText && !attachment) {
    throw new Error('Escreve uma mensagem ou anexa um ficheiro.');
  }

  const nonce =
    params.clientNonce ||
    safeId(`${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, 80);
  const messageId = safeId(`msg_${nonce}`, 120);
  const nowMs = Date.now();

  const msgPayload: Record<string, unknown> = {
    messageId,
    chatId: chat.chatId,
    senderUid: sender.uid,
    senderName: sender.displayName.slice(0, 60),
    type,
    text: cleanText,
    reactions: {},
    deliveredToUids: [sender.uid],
    readByUids: [sender.uid],
    deletedForAll: false,
    deletedForUids: [],
    pinned: false,
    clientNonce: nonce,
    createdAtMs: nowMs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (sender.photoURL) {
    const safePic = sanitizeAvatarPhotoUrl(sender.photoURL);
    if (safePic) msgPayload.senderPhotoURL = safePic;
  }
  if (replyTo) msgPayload.replyTo = replyTo;
  if (forwardedFrom) msgPayload.forwardedFrom = forwardedFrom;
  if (attachment) msgPayload.attachment = attachment;

  const previewText = buildLastMessagePreviewText(type, cleanText, attachment);
  const recipients = chat.memberIds.filter((uid) => uid !== sender.uid);

  const batch = writeBatch(db);
  batch.set(doc(db, 'chats', chat.chatId, 'messages', messageId), msgPayload);
  batch.update(doc(db, 'chats', chat.chatId), {
    lastMessageId: messageId,
    lastMessagePreview: previewText,
    lastMessageType: type,
    lastMessageSenderUid: sender.uid,
    lastMessageSenderName: sender.displayName.slice(0, 60),
    lastMessageAtMs: nowMs,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update sender's own read cursor
  batch.update(doc(db, 'chats', chat.chatId, 'members', sender.uid), {
    unreadCount: 0,
    lastReadAtMs: nowMs,
    typingAtMs: 0,
    updatedAt: serverTimestamp(),
  });

  // Notify recipients (chat notification record)
  for (const rUid of recipients.slice(0, 35)) {
    const notifId = safeId(`cn_${nowMs}_${rUid.slice(0, 12)}_${nonce.slice(0, 8)}`, 120);
    const notifType = replyTo
      ? 'reply'
      : attachment
        ? 'file'
        : 'message';
    batch.set(doc(db, 'chat_notifications', notifId), {
      notifId,
      recipientUid: rUid,
      chatId: chat.chatId,
      messageId,
      type: notifType,
      senderUid: sender.uid,
      senderName: sender.displayName.slice(0, 60),
      title:
        chat.type === 'group'
          ? `${sender.displayName} · ${chat.title || 'Grupo'}`.slice(0, 100)
          : sender.displayName.slice(0, 100),
      body: previewText.slice(0, 240),
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chats/${chat.chatId}/messages/${messageId}`);
  }

  return {
    ...(msgPayload as unknown as ChatMessage),
    createdAt: null,
    updatedAt: null,
  };
}

export async function editChatMessage(
  chatId: string,
  messageId: string,
  nextText: string
): Promise<void> {
  const clean = nextText.trim().slice(0, 4000);
  if (!clean) throw new Error('A mensagem editada não pode ficar vazia.');
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      text: clean,
      editedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function deleteChatMessageForMe(
  chatId: string,
  messageId: string,
  uid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      deletedForUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function deleteChatMessageForAll(
  chatId: string,
  messageId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      deletedForAll: true,
      text: '',
      pinned: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function toggleMessageReaction(
  chatId: string,
  messageId: string,
  uid: string,
  emoji: string
): Promise<void> {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const data = snap.data() as ChatMessage;
  const reactions = { ...(data.reactions || {}) };
  const currentUsers = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
  if (currentUsers.includes(uid)) {
    const next = currentUsers.filter((u) => u !== uid);
    if (next.length === 0) delete reactions[emoji];
    else reactions[emoji] = next;
  } else {
    reactions[emoji] = [...currentUsers, uid].slice(0, 200);
  }
  try {
    await updateDoc(msgRef, {
      reactions,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function togglePinChatMessage(
  chat: ChatRoom,
  actor: UserProfile,
  message: ChatMessage,
  pin: boolean
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'chats', chat.chatId, 'messages', message.messageId), {
    pinned: pin,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'chats', chat.chatId), {
    pinnedMessageId: pin ? message.messageId : '',
    pinnedPreviewText: pin
      ? buildLastMessagePreviewText(message.type, message.text, message.attachment)
      : '',
    updatedAt: serverTimestamp(),
  });
  if (pin) {
    const recipients = chat.memberIds.filter((uid) => uid !== actor.uid);
    const nowMs = Date.now();
    for (const rUid of recipients.slice(0, 25)) {
      const notifId = safeId(`cn_pin_${nowMs}_${rUid.slice(0, 10)}`, 120);
      batch.set(doc(db, 'chat_notifications', notifId), {
        notifId,
        recipientUid: rUid,
        chatId: chat.chatId,
        messageId: message.messageId,
        type: 'pinned',
        senderUid: actor.uid,
        senderName: actor.displayName.slice(0, 60),
        title: (chat.title || actor.displayName).slice(0, 100),
        body: buildLastMessagePreviewText(
          message.type,
          message.text,
          message.attachment
        ).slice(0, 240),
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chat.chatId}`);
  }
}

export async function toggleFavoriteMessage(
  uid: string,
  chatTitle: string,
  message: ChatMessage,
  currentlyFavorited: boolean
): Promise<void> {
  const favoriteId = safeId(`${message.chatId}_${message.messageId}`, 180);
  const favRef = doc(db, 'users', uid, 'chat_favorites', favoriteId);
  try {
    if (currentlyFavorited) {
      await deleteDoc(favRef);
    } else {
      const record: Omit<ChatFavoriteRecord, 'savedAt'> = {
        favoriteId,
        uid,
        chatId: message.chatId,
        chatTitle: chatTitle.slice(0, 100),
        messageId: message.messageId,
        senderName: message.senderName.slice(0, 60),
        type: message.type,
        previewText: buildLastMessagePreviewText(
          message.type,
          message.text,
          message.attachment
        ).slice(0, 240),
        createdAtMs: message.createdAtMs,
      };
      if (message.attachment?.fileName) {
        record.attachmentName = message.attachment.fileName.slice(0, 180);
      }
      await setDoc(favRef, {
        ...record,
        savedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/chat_favorites/${favoriteId}`);
  }
}

export async function submitChatReport(params: {
  reporterUid: string;
  chatId: string;
  messageId: string;
  reportedUid: string;
  fileId?: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const reportId = safeId(
    `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    120
  );
  const payload: Record<string, unknown> = {
    reportId,
    reporterUid: params.reporterUid,
    chatId: params.chatId,
    messageId: params.messageId,
    reportedUid: params.reportedUid,
    reason: params.reason.trim().slice(0, 120),
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  if (params.fileId) payload.fileId = params.fileId;
  if (params.details?.trim()) payload.details = params.details.trim().slice(0, 500);

  try {
    await setDoc(doc(db, 'chat_reports', reportId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `chat_reports/${reportId}`);
  }
}

export async function markChatNotificationsReadForChat(
  uid: string,
  chatId: string
): Promise<void> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'chat_notifications'),
        where('recipientUid', '==', uid),
        where('chatId', '==', chatId),
        where('read', '==', false),
        limit(30)
      )
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch {
    // Fallback query without composite index
    try {
      const snap = await getDocs(
        query(
          collection(db, 'chat_notifications'),
          where('recipientUid', '==', uid),
          limit(50)
        )
      );
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach((d) => {
        const data = d.data() as { chatId?: string; read?: boolean };
        if (data.chatId === chatId && data.read === false) {
          batch.update(d.ref, { read: true });
          count++;
        }
      });
      if (count > 0) await batch.commit();
    } catch {
      // Non-blocking
    }
  }
}

// =========================================================================
// Global Scoped Search Across Authorized Chats Only
// =========================================================================

export async function searchAuthorizedChatsMessages(params: {
  chats: ChatRoom[];
  currentUid: string;
  queryText: string;
  dateFilter: 'all' | 'today' | '7d' | '30d';
  fileTypeFilter: 'all' | ChatAttachmentCategory;
  participantUid: string;
  targetChatId: string;
}): Promise<Array<{ message: ChatMessage; chat: ChatRoom }>> {
  const qLower = params.queryText.trim().toLowerCase();
  const targetChats = params.targetChatId
    ? params.chats.filter((c) => c.chatId === params.targetChatId)
    : params.chats;

  const now = Date.now();
  const minCreatedAtMs =
    params.dateFilter === 'today'
      ? now - 24 * 3600 * 1000
      : params.dateFilter === '7d'
        ? now - 7 * 24 * 3600 * 1000
        : params.dateFilter === '30d'
          ? now - 30 * 24 * 3600 * 1000
          : 0;

  const results: Array<{ message: ChatMessage; chat: ChatRoom }> = [];

  await Promise.all(
    targetChats.slice(0, 25).map(async (chat) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'chats', chat.chatId, 'messages'),
            orderBy('createdAtMs', 'desc'),
            limit(80)
          )
        );
        snap.docs.forEach((d) => {
          const m = d.data() as ChatMessage;
          if (m.deletedForAll) return;
          if ((m.deletedForUids || []).includes(params.currentUid)) return;
          if (minCreatedAtMs > 0 && (m.createdAtMs || 0) < minCreatedAtMs) return;
          if (params.participantUid && m.senderUid !== params.participantUid) return;
          if (params.fileTypeFilter !== 'all') {
            if (!m.attachment || m.attachment.category !== params.fileTypeFilter) {
              return;
            }
          }
          if (qLower) {
            const hay = `${m.text || ''} ${m.attachment?.fileName || ''} ${m.senderName || ''}`.toLowerCase();
            if (!hay.includes(qLower)) return;
          }
          results.push({ message: m, chat });
        });
      } catch {
        // Skip inaccessible or empty
      }
    })
  );

  return results.sort((a, b) => (b.message.createdAtMs || 0) - (a.message.createdAtMs || 0));
}

// =========================================================================
// Offline Outbound Text Message Queue (Idempotent via clientNonce)
// =========================================================================

export interface QueuedTextMessage {
  clientNonce: string;
  chatId: string;
  text: string;
  replyTo?: ChatReplySnapshot;
  createdAtMs: number;
}

function getQueueKey(uid: string): string {
  return `ecl_chat_offline_q_${safeId(uid, 64)}`;
}

export function loadOfflineChatQueue(uid: string): QueuedTextMessage[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(getQueueKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedTextMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineChatQueue(uid: string, list: QueuedTextMessage[]): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(getQueueKey(uid), JSON.stringify(list.slice(-40)));
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueueOfflineTextMessage(
  uid: string,
  item: QueuedTextMessage
): QueuedTextMessage[] {
  const current = loadOfflineChatQueue(uid);
  if (current.some((x) => x.clientNonce === item.clientNonce)) return current;
  const next = [...current, item];
  saveOfflineChatQueue(uid, next);
  return next;
}

export function removeOfflineChatQueueItem(
  uid: string,
  clientNonce: string
): QueuedTextMessage[] {
  const next = loadOfflineChatQueue(uid).filter((x) => x.clientNonce !== clientNonce);
  saveOfflineChatQueue(uid, next);
  return next;
}
