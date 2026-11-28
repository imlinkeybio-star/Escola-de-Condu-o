'use client';

import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  Flag,
  Forward,
  Loader2,
  LogOut,
  Pin,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ChatGroupCategory,
  ChatMemberState,
  ChatMessage,
  ChatRoom,
} from '@/lib/chat-types';
import {
  addGroupMembers,
  createGroupChat,
  fetchOriginalFileBlob,
  removeGroupMember,
  sendChatMessage,
  submitChatReport,
  toggleGroupMemberAdmin,
  updateGroupChatDetails,
  updateMyChatMemberPrefs,
  uploadChatFileChunked,
} from '@/lib/chat-service';
import { UserProfile } from '@/lib/types';
import { useLanguage } from '@/components/LanguageProvider';
import { toUserFriendlyError } from '@/lib/error-messages';

interface CreateGroupModalProps {
  currentUser: UserProfile;
  users: UserProfile[];
  onClose: () => void;
  onCreated: (room: ChatRoom) => void;
}

export function CreateGroupModal({
  currentUser,
  users,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const { dict } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChatGroupCategory>('turma');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const candidates = users.filter((u) => u.uid !== currentUser.uid && !u.disabled);

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const room = await createGroupChat({
        creator: currentUser,
        title,
        description,
        groupCategory: category,
        memberUids: selectedUids,
      });
      onCreated(room);
      onClose();
    } catch (err) {
      setError(toUserFriendlyError(err, 'Não foi possível criar o grupo.'));
    } finally {
      setSubmitting(false);
    }
  };

  const categories: Array<{ id: ChatGroupCategory; label: string }> = [
    { id: 'turma', label: dict.chat.catTurma },
    { id: 'instrutores', label: dict.chat.catInstrutores },
    { id: 'administracao', label: dict.chat.catAdministracao },
    { id: 'comunicados', label: dict.chat.catComunicados },
    { id: 'duvidas', label: dict.chat.catDuvidas },
    { id: 'aulas', label: dict.chat.catAulas },
  ];

  return (
    <div className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-lg max-h-[90dvh] flex flex-col bg-[#0B0F19] border border-[#22C55E]/35 rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              {dict.chat.createGroupTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {dict.chat.groupNameLabel}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={dict.chat.groupNamePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#05070B] border border-white/15 text-sm text-white focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {dict.chat.groupDescLabel}
            </label>
            <input
              type="text"
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#05070B] border border-white/15 text-sm text-white focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {dict.chat.groupCategoryLabel}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    category === cat.id
                      ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                      : 'bg-white/[0.03] border-white/10 text-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              {dict.chat.selectMembersLabel} ({selectedUids.length})
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1">
              {candidates.map((u) => {
                const picked = selectedUids.includes(u.uid);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => toggleUid(u.uid)}
                    className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
                      picked
                        ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="font-semibold truncate">
                      {u.displayName} · {u.tier}
                    </span>
                    {picked && <Check className="w-4 h-4 text-[#22C55E] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/10 bg-[#05070B] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs font-semibold text-slate-300 cursor-pointer"
          >
            {dict.common.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting || title.trim().length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-yellow-300 disabled:opacity-40 text-black text-xs font-extrabold cursor-pointer"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {dict.chat.createGroupSubmit}
          </button>
        </div>
      </form>
    </div>
  );
}

interface GroupInfoModalProps {
  chat: ChatRoom;
  currentUser: UserProfile;
  myMemberState?: ChatMemberState;
  users: UserProfile[];
  usersByUid: Record<string, UserProfile>;
  onClose: () => void;
  onLeftGroup: () => void;
}

export function GroupInfoModal({
  chat,
  currentUser,
  myMemberState,
  users,
  usersByUid,
  onClose,
  onLeftGroup,
}: GroupInfoModalProps) {
  const { dict, fmt } = useLanguage();
  const isAdmin =
    chat.adminIds.includes(currentUser.uid) ||
    chat.createdBy === currentUser.uid;
  const [title, setTitle] = useState(chat.title || '');
  const [description, setDescription] = useState(chat.description || '');
  const [saving, setSaving] = useState(false);
  const [addingUid, setAddingUid] = useState('');

  const nonMembers = users.filter(
    (u) => !u.disabled && !chat.memberIds.includes(u.uid)
  );

  const handleSaveInfo = async () => {
    if (!isAdmin || title.trim().length < 2) return;
    setSaving(true);
    try {
      await updateGroupChatDetails(chat.chatId, { title, description });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!addingUid) return;
    await addGroupMembers(
      chat,
      currentUser.displayName,
      currentUser.uid,
      [addingUid]
    );
    setAddingUid('');
  };

  const handleLeave = async () => {
    await removeGroupMember(chat.chatId, currentUser.uid);
    onLeftGroup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col bg-[#0B0F19] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-white">
            {dict.chat.groupInfoTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {isAdmin ? (
            <div className="space-y-2.5 p-3 rounded-xl bg-black/40 border border-white/10">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#05070B] border border-white/15 text-sm font-bold text-white"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={dict.chat.groupDescLabel}
                className="w-full px-3 py-2 rounded-xl bg-[#05070B] border border-white/15 text-xs text-slate-200"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveInfo()}
                className="px-3.5 py-1.5 rounded-xl bg-[#22C55E] text-black text-xs font-extrabold cursor-pointer"
              >
                {saving ? dict.common.saving : dict.common.save}
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-black/40 border border-white/10">
              <p className="text-sm font-bold text-white">{chat.title}</p>
              {chat.description && (
                <p className="text-xs text-slate-400 mt-1">{chat.description}</p>
              )}
            </div>
          )}

          {/* Member Preferences */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void updateMyChatMemberPrefs(chat.chatId, currentUser.uid, {
                  muted: !myMemberState?.muted,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white cursor-pointer"
            >
              {myMemberState?.muted ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-[#22C55E]" />
                  {dict.chat.unmuteChatBtn}
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-[#FACC15]" />
                  {dict.chat.muteChatBtn}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                void updateMyChatMemberPrefs(chat.chatId, currentUser.uid, {
                  pinned: !myMemberState?.pinned,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5 text-[#22C55E]" />
              {myMemberState?.pinned
                ? dict.chat.unpinChatBtn
                : dict.chat.pinChatBtn}
            </button>
          </div>

          {/* Add member for admins */}
          {isAdmin && nonMembers.length > 0 && (
            <div className="flex gap-2">
              <select
                value={addingUid}
                onChange={(e) => setAddingUid(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-[#05070B] border border-white/15 text-xs text-white"
              >
                <option value="">{dict.chat.addMemberBtn}...</option>
                {nonMembers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addingUid}
                onClick={() => void handleAddMember()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FACC15] disabled:opacity-40 text-black text-xs font-extrabold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {dict.common.confirm}
              </button>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">
              {fmt(dict.chat.membersCount, { count: chat.memberIds.length })}
            </p>
            {chat.memberIds.map((uid) => {
              const u = usersByUid[uid];
              const memAdmin = chat.adminIds.includes(uid) || chat.createdBy === uid;
              return (
                <div
                  key={uid}
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">
                      {u?.displayName || uid.slice(0, 10)}{' '}
                      {uid === currentUser.uid ? `(${dict.common.you})` : ''}
                    </p>
                    {memAdmin && (
                      <span className="text-[10px] font-bold text-[#22C55E]">
                        Admin
                      </span>
                    )}
                  </div>
                  {isAdmin && uid !== currentUser.uid && uid !== chat.createdBy && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void toggleGroupMemberAdmin(chat.chatId, uid, !memAdmin)
                        }
                        title={
                          memAdmin
                            ? dict.chat.removeAdminBtn
                            : dict.chat.makeAdminBtn
                        }
                        className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-[#FACC15]/20 text-[#FACC15] cursor-pointer"
                      >
                        {memAdmin ? (
                          <ShieldOff className="w-3.5 h-3.5" />
                        ) : (
                          <Shield className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeGroupMember(chat.chatId, uid)}
                        title={dict.chat.removeMemberBtn}
                        className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-red-500/20 text-red-400 cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/10 bg-[#05070B] flex items-center justify-between">
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-xs font-bold text-red-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {dict.chat.leaveGroupBtn}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] text-xs font-semibold text-white cursor-pointer"
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ForwardMessageModalProps {
  sourceMessage: ChatMessage;
  chats: ChatRoom[];
  currentUser: UserProfile;
  usersByUid: Record<string, UserProfile>;
  onClose: () => void;
  onForwarded: (targetChatId: string) => void;
}

export function ForwardMessageModal({
  sourceMessage,
  chats,
  currentUser,
  usersByUid,
  onClose,
  onForwarded,
}: ForwardMessageModalProps) {
  const { dict } = useLanguage();
  const [forwardingId, setForwardingId] = useState('');

  const getChatLabel = (c: ChatRoom) => {
    if (c.type === 'group') return c.title || 'Grupo';
    const otherUid =
      c.memberIds.find((u) => u !== currentUser.uid) || currentUser.uid;
    return usersByUid[otherUid]?.displayName || dict.common.studentDefault;
  };

  const handleForward = async (targetChat: ChatRoom) => {
    if (forwardingId) return;
    setForwardingId(targetChat.chatId);
    try {
      let nextAttachment = sourceMessage.attachment;
      // Copy original lossless chunks into destination chat so target members have Firestore rule access
      if (
        sourceMessage.attachment &&
        targetChat.chatId !== sourceMessage.chatId
      ) {
        const { blob } = await fetchOriginalFileBlob(
          sourceMessage.chatId,
          sourceMessage.attachment.fileId,
          sourceMessage.attachment.mimeType
        );
        const clonedFile = new File(
          [blob],
          sourceMessage.attachment.fileName,
          { type: sourceMessage.attachment.mimeType }
        );
        nextAttachment = await uploadChatFileChunked({
          chatId: targetChat.chatId,
          senderUid: currentUser.uid,
          file: clonedFile,
          sendMode: sourceMessage.attachment.sendMode,
          taskId: `fwd_${Date.now()}`,
          isEnhanced: sourceMessage.attachment.isEnhanced,
          originalFileId: sourceMessage.attachment.originalFileId,
          enhancementMode: sourceMessage.attachment.enhancementMode,
        });
      }

      await sendChatMessage({
        chat: targetChat,
        sender: currentUser,
        type: sourceMessage.type,
        text: sourceMessage.text,
        attachment: nextAttachment,
        forwardedFrom: {
          originalChatId: sourceMessage.chatId,
          originalMessageId: sourceMessage.messageId,
          originalSenderName: sourceMessage.senderName,
        },
      });
      onForwarded(targetChat.chatId);
      onClose();
    } finally {
      setForwardingId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0B0F19] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/10 bg-[#05070B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Forward className="w-4 h-4 text-[#FACC15]" />
            <h3 className="text-sm font-bold text-white">
              {dict.chat.forwardTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60dvh] overflow-y-auto">
          <p className="text-xs text-slate-400 mb-2">
            {dict.chat.forwardSelectChat}
          </p>
          {chats.map((c) => (
            <button
              key={c.chatId}
              type="button"
              disabled={Boolean(forwardingId)}
              onClick={() => void handleForward(c)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#22C55E]/15 border border-white/10 hover:border-[#22C55E]/40 flex items-center justify-between text-xs font-bold text-white cursor-pointer"
            >
              <span className="truncate">{getChatLabel(c)}</span>
              {forwardingId === c.chatId ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#22C55E]" />
              ) : (
                <Forward className="w-3.5 h-3.5 text-[#FACC15]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ReportMessageModalProps {
  message: ChatMessage;
  reporterUid: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ReportMessageModal({
  message,
  reporterUid,
  onClose,
  onSubmitted,
}: ReportMessageModalProps) {
  const { dict } = useLanguage();
  const [reason, setReason] = useState('Conteúdo impróprio');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitChatReport({
        reporterUid,
        chatId: message.chatId,
        messageId: message.messageId,
        reportedUid: message.senderUid,
        fileId: message.attachment?.fileId,
        reason,
        details,
      });
      onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md bg-[#0B0F19] border border-red-500/35 rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">
              {dict.chat.reportTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            {dict.chat.reportReasonLabel}
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#05070B] border border-white/15 text-sm text-white"
          >
            <option value="Conteúdo impróprio">Conteúdo impróprio</option>
            <option value="Spam ou fraude">Spam ou fraude</option>
            <option value="Assédio ou ofensa">Assédio ou ofensa</option>
            <option value="Ficheiro suspeito">Ficheiro suspeito</option>
          </select>
        </div>

        <textarea
          rows={3}
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={dict.chat.reportDetailsPlaceholder}
          className="w-full px-3 py-2 rounded-xl bg-[#05070B] border border-white/15 text-xs text-white"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.06] text-xs font-semibold text-slate-300 cursor-pointer"
          >
            {dict.common.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
          >
            {submitting ? dict.common.saving : dict.chat.submitReportBtn}
          </button>
        </div>
      </form>
    </div>
  );
}
