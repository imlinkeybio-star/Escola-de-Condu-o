'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Ban,
  BookPlus,
  CheckCircle2,
  ClipboardList,
  PlusCircle,
  Shield,
  Trash2,
  Users,
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
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import {
  AuditLog,
  CompetitionRoom,
  DifficultyLevel,
  QUESTION_CATEGORIES,
  QuestionBankItem,
  UserProfile,
} from '@/lib/types';
import {
  createCompetitionRoom,
  createQuestionBankEntry,
  deleteCompetitionRoom,
  toggleUserDisabledStatus,
} from '@/lib/firestore-service';
import { SIGN_LABELS } from '@/components/TrafficSignDisplay';
import { useLanguage } from '@/components/LanguageProvider';
import {
  formatNumberLocale,
  tFormat,
  translateCategory,
  translateDifficulty,
  translateRoomStatus,
  translateSignLabel,
} from '@/lib/i18n';
import { APP_OWNER_EMAIL } from '@/lib/url-safety';

export default function AdminPage() {
  const { user, profile, isAdmin, isOwner, canViewReserved, canAnnounce, loading } =
    useAuth();
  const { language, dict } = useLanguage();
  const [tab, setTab] = useState<'salas' | 'utilizadores' | 'perguntas' | 'auditoria'>('salas');
  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Quick Admin Room Creation
  const [roomTitle, setRoomTitle] = useState('');
  const [roomCategory, setRoomCategory] = useState('Geral');
  const [roomDiff, setRoomDiff] = useState<DifficultyLevel>('Exame Oficial');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Question Bank Form
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [legalRef, setLegalRef] = useState('');
  const [signType, setSignType] = useState('none');
  const [statusMsg, setStatusMsg] = useState('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] =
    useState<CompetitionRoom | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const canAccessAdminPage = isOwner || isAdmin || canViewReserved;
  const canMutateAdmin = isOwner || isAdmin;

  useEffect(() => {
    if (!user || !canAccessAdminPage) return;
    const unsubRooms = onSnapshot(
      query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(25)),
      (snap) => setRooms(snap.docs.map((d) => d.data() as CompetitionRoom)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'rooms')
    );
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('disabled', 'in', [false, true]), limit(50)),
      (snap) => setUsersList(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    const unsubBank = onSnapshot(
      query(collection(db, 'question_bank'), orderBy('createdAt', 'desc'), limit(30)),
      (snap) =>
        setBankItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as QuestionBankItem) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'question_bank')
    );
    const unsubAudit = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(40)),
      (snap) =>
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLog) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
    );
    return () => {
      unsubRooms();
      unsubUsers();
      unsubBank();
      unsubAudit();
    };
  }, [user, canAccessAdminPage]);

  if (!loading && !canAccessAdminPage) {
    return (
      <AppShell title={dict.nav.admin}>
        <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-3">
          <Shield className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">{dict.admin.restrictedTitle}</h2>
          <p className="text-sm text-slate-400">
            {tFormat(dict.admin.restrictedDesc, { owner: APP_OWNER_EMAIL })}
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold"
          >
            {dict.permissoes.backDashboard}
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleAdminCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreatingRoom(true);
    setStatusMsg('');
    try {
      const created = await createCompetitionRoom({
        title: roomTitle.trim() || dict.admin.defaultRoomTitle,
        maxParticipants: 200,
        totalQuestions: 10,
        timePerQuestion: 60,
        difficulty: roomDiff,
        category: roomCategory,
        isPublic: true,
        hostProfile: profile,
        isAdminUser: true,
      });
      setStatusMsg(
        tFormat(dict.admin.roomCreatedMsg, {
          title: created.title,
          code: created.code,
        })
      );
      setRoomTitle('');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : dict.admin.roomCreateErr);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    try {
      await createQuestionBankEntry({
        questionText: qText,
        options: [optA, optB, optC, optD],
        correctIndex: correctIdx,
        explanation,
        legalReference: legalRef.trim() || dict.admin.defaultLegalRef,
        category: roomCategory,
        difficulty: roomDiff,
        signType,
        active: true,
      });
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setExplanation('');
      setStatusMsg(dict.admin.questionAddedMsg);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : dict.admin.questionSaveErr);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!confirmDeleteRoom) return;
    setDeletingRoomId(confirmDeleteRoom.roomId);
    setStatusMsg('');
    try {
      await deleteCompetitionRoom(confirmDeleteRoom.roomId, true);
      setStatusMsg(
        tFormat(dict.admin.roomDeletedMsg, { title: confirmDeleteRoom.title })
      );
      setConfirmDeleteRoom(null);
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : dict.admin.roomDeleteErr
      );
    } finally {
      setDeletingRoomId(null);
    }
  };

  return (
    <AppShell title={dict.admin.shellTitle}>
      <div className="space-y-6">
        {/* Admin KPI Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">{dict.admin.roomsCount}</p>
            <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {formatNumberLocale(language, rooms.length)}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">{dict.admin.usersCount}</p>
            <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {formatNumberLocale(language, usersList.length)}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">{dict.admin.questionBankCount}</p>
            <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-1">
              {formatNumberLocale(language, bankItems.length)}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">{dict.admin.auditLogsCount}</p>
            <p className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1">
              {formatNumberLocale(language, auditLogs.length)}
            </p>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-sm text-emerald-200">
            {statusMsg}
          </div>
        )}

        {/* Read-Only Banner for View-Only Staff */}
        {!canMutateAdmin && canAccessAdminPage && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 text-xs sm:text-sm text-sky-200">
            <strong>{dict.admin.viewOnlyBannerTitle}</strong>{' '}
            {dict.admin.viewOnlyBannerDesc}
          </div>
        )}

        {/* Owner & Authorized Staff Shortcuts */}
        {(isOwner || canAnnounce) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {isOwner ? dict.admin.ownerControlLabel : dict.admin.adPermLabel}
              </p>
              <p className="text-sm font-semibold text-white">
                {isOwner
                  ? dict.admin.ownerShortcutTitle
                  : dict.admin.staffShortcutTitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {isOwner && (
                <Link
                  href="/permissoes"
                  className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-bold text-center whitespace-nowrap"
                >
                  {dict.donoAnuncios.emailsPermBtn}
                </Link>
              )}
              <Link
                href="/dono-anuncios"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold text-center whitespace-nowrap"
              >
                {dict.admin.openAdsPanelBtn}
              </Link>
            </div>
          </div>
        )}

        {/* Admin Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
          {(
            [
              { id: 'salas', label: dict.admin.tabRooms },
              { id: 'utilizadores', label: dict.admin.tabUsers },
              { id: 'perguntas', label: dict.admin.tabQuestions },
              { id: 'auditoria', label: dict.admin.tabAudit },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'salas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {canMutateAdmin && (
              <form
                onSubmit={handleAdminCreateRoom}
                className="lg:col-span-5 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 h-fit"
              >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-red-500" />
                {dict.admin.createOfficialRoom}
              </h3>
              <input
                type="text"
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder={dict.admin.defaultRoomTitle}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={roomCategory}
                  onChange={(e) => setRoomCategory(e.target.value)}
                  className="min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  {QUESTION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {translateCategory(language, c)}
                    </option>
                  ))}
                </select>
                <select
                  value={roomDiff}
                  onChange={(e) =>
                    setRoomDiff(e.target.value as DifficultyLevel)
                  }
                  className="min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  <option value="Iniciante">
                    {translateDifficulty(language, 'Iniciante')}
                  </option>
                  <option value="Intermédio">
                    {translateDifficulty(language, 'Intermédio')}
                  </option>
                  <option value="Avançado">
                    {translateDifficulty(language, 'Avançado')}
                  </option>
                  <option value="Exame Oficial">
                    {translateDifficulty(language, 'Exame Oficial')}
                  </option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingRoom}
                className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer"
              >
                {creatingRoom
                  ? dict.admin.creatingRoom
                  : dict.admin.makeRoomAvailable}
              </button>
            </form>
            )}

            <div
              className={`${
                canMutateAdmin ? 'lg:col-span-7' : 'lg:col-span-12'
              } bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]`}
            >
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tFormat(dict.admin.roomMeta, {
                        code: r.code,
                        status: translateRoomStatus(language, r.status),
                        participants: r.participantCount,
                        fin: r.finishedCount ?? 0,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/sala/${r.roomId}`}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                    >
                      {dict.admin.openRoom}
                    </Link>
                    {canMutateAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRoom(r)}
                        aria-label={`${dict.admin.deleteRoom} ${r.title}`}
                        className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/35 text-xs font-semibold text-red-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {dict.admin.deleteRoom}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'utilizadores' && (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
            {usersList.map((u) => (
              <div
                key={u.uid}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {u.displayName}{' '}
                      {u.disabled && (
                        <span className="text-xs text-red-400 ms-2">
                          {dict.admin.disabledTag}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 font-mono-tabular">
                      {tFormat(dict.admin.userStatsMeta, {
                        pts: formatNumberLocale(language, u.totalPoints),
                        wins: formatNumberLocale(language, u.wins),
                        games: formatNumberLocale(language, u.gamesPlayed),
                      })}
                    </p>
                  </div>
                </div>
                {canMutateAdmin && (
                  <button
                    onClick={() =>
                      toggleUserDisabledStatus(u.uid, !u.disabled)
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      u.disabled
                        ? 'bg-emerald-600/20 text-emerald-300'
                        : 'bg-red-600/20 text-red-300'
                    }`}
                  >
                  {u.disabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {dict.admin.reactivateUser}
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      {dict.admin.disableUser}
                    </>
                  )}
                </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'perguntas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {canMutateAdmin && (
            <form
              onSubmit={handleAddQuestion}
              className="lg:col-span-5 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookPlus className="w-4 h-4 text-red-500" />
                {dict.admin.addQuestionTitle}
              </h3>
              <textarea
                required
                rows={2}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder={dict.admin.questionPromptPlaceholder}
                className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder={tFormat(dict.admin.optPlaceholder, { letter: 'A' })}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder={tFormat(dict.admin.optPlaceholder, { letter: 'B' })}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder={tFormat(dict.admin.optPlaceholder, { letter: 'C' })}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder={tFormat(dict.admin.optPlaceholder, { letter: 'D' })}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={correctIdx}
                  onChange={(e) => setCorrectIdx(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  <option value={0}>
                    {tFormat(dict.admin.correctOptionPrefix, { letter: 'A' })}
                  </option>
                  <option value={1}>
                    {tFormat(dict.admin.correctOptionPrefix, { letter: 'B' })}
                  </option>
                  <option value={2}>
                    {tFormat(dict.admin.correctOptionPrefix, { letter: 'C' })}
                  </option>
                  <option value={3}>
                    {tFormat(dict.admin.correctOptionPrefix, { letter: 'D' })}
                  </option>
                </select>
                <select
                  value={signType}
                  onChange={(e) => setSignType(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  <option value="none">{dict.admin.noVisualSign}</option>
                  {Object.keys(SIGN_LABELS).map((k) => (
                    <option key={k} value={k}>
                      {translateSignLabel(language, k)}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                required
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={dict.admin.explanationPlaceholder}
                className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <input
                value={legalRef}
                onChange={(e) => setLegalRef(e.target.value)}
                placeholder={dict.admin.legalRefPlaceholder}
                className="w-full px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                {dict.admin.saveQuestionBtn}
              </button>
            </form>
            )}

            <div
              className={`${
                canMutateAdmin ? 'lg:col-span-7' : 'lg:col-span-12'
              } bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]`}
            >
              {bankItems.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center">
                  {dict.admin.emptyQuestions}
                </p>
              ) : (
                bankItems.map((item) => (
                  <div key={item.id} className="p-4 space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {item.questionText}
                    </p>
                    <p className="text-xs text-slate-400">
                      {translateCategory(language, item.category)} · {item.legalReference}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'auditoria' && (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
            {auditLogs.length === 0 ? (
              <p className="p-6 text-xs text-slate-400 text-center">
                {dict.admin.emptyAudit}
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 flex items-start gap-3 text-xs"
                >
                  <ClipboardList className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">
                      {log.action} · {log.actorEmail}
                    </p>
                    <p className="text-slate-400 mt-0.5">{log.details}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {confirmDeleteRoom && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111520] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {dict.admin.deleteModalTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRoom(null)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                {tFormat(dict.admin.deleteModalBody, {
                  title: confirmDeleteRoom.title,
                  code: confirmDeleteRoom.code,
                })}
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRoom(null)}
                  disabled={Boolean(deletingRoomId)}
                  className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  {dict.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteRoom}
                  disabled={Boolean(deletingRoomId)}
                  className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingRoomId ? dict.common.deleting : dict.admin.confirmDeleteBtn}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
