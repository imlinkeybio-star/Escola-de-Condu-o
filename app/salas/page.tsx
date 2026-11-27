'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Play,
  PlusCircle,
  Radio,
  Search,
  Sparkles,
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
import { useLanguage } from '@/components/LanguageProvider';
import { AppShell } from '@/components/AppShell';
import {
  CompetitionRoom,
  DifficultyLevel,
  QUESTION_CATEGORIES,
} from '@/lib/types';
import {
  createCompetitionRoom,
  deleteCompetitionRoom,
  findRoomByCode,
} from '@/lib/firestore-service';
import {
  tFormat,
  translateCategory,
  translateDifficulty,
} from '@/lib/i18n';

const DIFFICULTIES: DifficultyLevel[] = [
  'Iniciante',
  'Intermédio',
  'Avançado',
  'Exame Oficial',
];

function SalasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isAdmin, isOwner } = useAuth();
  const { dict, language } = useLanguage();

  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [searchCode, setSearchCode] = useState('');
  const [showCreate, setShowCreate] = useState(
    searchParams.get('criar') === '1'
  );
  const [creating, setCreating] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] =
    useState<CompetitionRoom | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Create form state
  const [title, setTitle] = useState(dict.salas.defaultRoomTitle);
  const [description, setDescription] = useState(dict.salas.defaultRoomDesc);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(200);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Intermédio');
  const [category, setCategory] = useState('Geral');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRooms(snap.docs.map((d) => d.data() as CompetitionRoom));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'rooms')
    );
    return () => unsub();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');
    setCreating(true);
    try {
      const room = await createCompetitionRoom({
        title,
        description,
        totalQuestions,
        timePerQuestion,
        maxParticipants,
        difficulty,
        category,
        isPublic: true,
        hostProfile: profile,
      });
      setShowCreate(false);
      router.push(`/sala/${room.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.salas.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!searchCode.trim()) return;
    const found = await findRoomByCode(searchCode);
    if (!found) {
      setError(dict.salas.codeNotFound);
      return;
    }
    router.push(`/sala/${found.roomId}`);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!confirmDeleteRoom) return;
    setError('');
    setDeletingRoomId(confirmDeleteRoom.roomId);
    try {
      await deleteCompetitionRoom(confirmDeleteRoom.roomId, isAdmin || isOwner);
      setConfirmDeleteRoom(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.salas.deleteError);
    } finally {
      setDeletingRoomId(null);
    }
  };

  const isRoomFinished = (r: CompetitionRoom) =>
    r.status === 'FINISHED' || (r.finishedCount ?? 0) >= 100;

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'active') return !isRoomFinished(r);
    if (filter === 'finished') return isRoomFinished(r);
    return true;
  });

  return (
    <AppShell title={dict.salas.shellTitle}>
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 min-w-0">
          <form onSubmit={handleJoinByCode} className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder={dict.salas.searchPlaceholder}
                className="w-full min-h-[44px] ps-10 pe-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular uppercase focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {dict.salas.searchBtn}
            </button>
          </form>

          <button
            onClick={() => setShowCreate(true)}
            className="w-full md:w-auto min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            {dict.salas.createNewBtn}
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-sm text-red-200 break-words">
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
          {(
            [
              { id: 'all', label: dict.salas.filterAll },
              { id: 'active', label: dict.salas.filterActive },
              { id: 'finished', label: dict.salas.filterFinished },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === t.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Rooms Grid */}
        {filteredRooms.length === 0 ? (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
            <Radio className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">
              {dict.salas.emptyTitle}
            </h3>
            <p className="text-sm text-slate-400">{dict.salas.emptyDesc}</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer"
            >
              {dict.salas.createNowBtn}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((r) => {
              const closed = isRoomFinished(r);
              const fin = r.finishedCount ?? 0;
              return (
                <div
                  key={r.roomId}
                  className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between space-y-4 min-w-0"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <span className="font-mono-tabular text-slate-400">
                        {r.code} · {translateDifficulty(language, r.difficulty)}
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          closed ? 'text-slate-400' : 'text-emerald-400'
                        }`}
                      >
                        {closed
                          ? tFormat(dict.salas.closedStatus, { fin })
                          : tFormat(dict.salas.openStatus, { fin })}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-snug break-words">
                      {r.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 break-words">
                      {r.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-300 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {tFormat(dict.salas.completedSuffix, {
                          count: r.participantCount,
                          fin,
                        })}
                      </span>
                      <span>
                        {tFormat(dict.salas.questionsDuration, {
                          q: r.totalQuestions,
                          s: r.timePerQuestion,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sala/${r.roomId}`}
                        className="flex-1 min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-w-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span className="truncate">
                          {closed
                            ? dict.salas.finalRankingBtn
                            : dict.salas.enterRoomBtn}
                        </span>
                      </Link>
                      {(r.hostId === user?.uid || isAdmin || isOwner) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoom(r)}
                          aria-label={tFormat(dict.salas.deleteRoomAria, {
                            title: r.title,
                          })}
                          title={dict.salas.deleteRoomTitle}
                          className="min-w-[42px] min-h-[42px] px-3 rounded-xl bg-red-600/15 hover:bg-red-600/30 border border-red-500/30 text-red-300 flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Room Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111520] border border-white/15 rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">
                    {dict.salas.modalTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  aria-label={dict.common.close}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    {dict.salas.roomNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    {dict.salas.roomDescLabel}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      {dict.salas.categoryLabel}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
                    >
                      {QUESTION_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {translateCategory(language, c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      {dict.salas.difficultyLabel}
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) =>
                        setDifficulty(e.target.value as DifficultyLevel)
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {translateDifficulty(language, d)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      {dict.salas.questionsLabel}
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={25}
                      value={totalQuestions}
                      onChange={(e) =>
                        setTotalQuestions(Number(e.target.value))
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular"
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      {dict.salas.timeSecLabel}
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={120}
                      value={timePerQuestion}
                      onChange={(e) =>
                        setTimePerQuestion(Number(e.target.value))
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular"
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      {dict.salas.maxStudentsLabel}
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={1000}
                      value={maxParticipants}
                      onChange={(e) =>
                        setMaxParticipants(Number(e.target.value))
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-400 bg-[#090C14] border border-white/10 rounded-xl p-3">
                  {dict.salas.aiDisclaimer}
                </p>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm cursor-pointer"
                >
                  {creating
                    ? dict.salas.creatingRoomBtn
                    : dict.salas.createRoomSubmit}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Delete Room Confirmation Modal */}
        {confirmDeleteRoom && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111520] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {dict.salas.deleteModalTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRoom(null)}
                  aria-label={dict.common.close}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                {tFormat(dict.salas.deleteModalBody, {
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
                  {deletingRoomId
                    ? dict.common.deleting
                    : dict.salas.confirmDeleteBtn}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function SalasPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F]" />}>
      <SalasContent />
    </Suspense>
  );
}
