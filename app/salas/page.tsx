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

function SalasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isAdmin, isOwner } = useAuth();

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
  const [title, setTitle] = useState('Concurso Código de Estrada Luanda');
  const [description, setDescription] = useState(
    'Perguntas 100% geradas em tempo real pela IA com base no Código de Estrada de Angola. Ranking aberto até 100 finalistas.'
  );
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
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao criar sala de competição.'
      );
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
      setError('Nenhuma sala encontrada com esse código.');
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
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível eliminar a sala.'
      );
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
    <AppShell title="Salas de Competição ao Vivo">
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 min-w-0">
          <form onSubmit={handleJoinByCode} className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder="Entrar por código (ex: A7K92B)"
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular uppercase focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Procurar
            </button>
          </form>

          <button
            onClick={() => setShowCreate(true)}
            className="w-full md:w-auto min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Criar Nova Sala (IA)
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
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'Abertas / Em Direto' },
              { id: 'finished', label: 'Concluídas' },
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
              Sem salas nesta categoria
            </h3>
            <p className="text-sm text-slate-400">
              Cria uma nova sala e a Inteligência Artificial prepara
              automaticamente as perguntas sobre o Código de Estrada de Angola.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer"
            >
              Criar Sala Agora
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
                        {r.code} · {r.difficulty}
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          closed ? 'text-slate-400' : 'text-emerald-400'
                        }`}
                      >
                        {closed
                          ? `Encerrada (${fin}/100 finalistas)`
                          : `Aberta · ${fin}/100 finalistas`}
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
                        {r.participantCount} alunos · {fin}/100 concluíram
                      </span>
                      <span>
                        {r.totalQuestions} perguntas · {r.timePerQuestion}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sala/${r.roomId}`}
                        className="flex-1 min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-w-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span className="truncate">
                          {closed ? 'Ver Ranking Final' : 'Entrar na Sala'}
                        </span>
                      </Link>
                      {(r.hostId === user?.uid || isAdmin || isOwner) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoom(r)}
                          aria-label={`Eliminar sala ${r.title}`}
                          title="Eliminar sala"
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
                    Nova Competição com IA Gemini
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Nome da Competição
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
                    Descrição
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
                      Categoria
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
                    >
                      {QUESTION_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      Dificuldade
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) =>
                        setDifficulty(e.target.value as DifficultyLevel)
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
                    >
                      <option value="Iniciante">Iniciante</option>
                      <option value="Intermédio">Intermédio</option>
                      <option value="Avançado">Avançado</option>
                      <option value="Exame Oficial">Exame Oficial</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 min-w-0">
                    <label className="text-xs font-medium text-slate-300">
                      Perguntas
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
                      Tempo (seg)
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
                      Máx. Alunos
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
                  Cada aluno recebe perguntas aleatórias geradas 100% em tempo
                  real pela IA com base no Código de Estrada de Angola. A sala
                  mantém o ranking ativo até 100 pessoas finalizarem.
                </p>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm cursor-pointer"
                >
                  {creating
                    ? 'A criar sala ao vivo...'
                    : 'Criar Sala (Perguntas IA em Tempo Real)'}
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
                    Eliminar Sala
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
                Tens a certeza que queres eliminar a sala{' '}
                <strong className="text-white">{confirmDeleteRoom.title}</strong>{' '}
                ({confirmDeleteRoom.code})? Esta ação remove a sala da lista ao
                vivo e não pode ser revertida.
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRoom(null)}
                  disabled={Boolean(deletingRoomId)}
                  className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteRoom}
                  disabled={Boolean(deletingRoomId)}
                  className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingRoomId ? 'A eliminar...' : 'Confirmar Eliminação'}
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
