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
  Users,
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
  toggleUserDisabledStatus,
} from '@/lib/firestore-service';
import { SIGN_LABELS } from '@/components/TrafficSignDisplay';

export default function AdminPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<'salas' | 'utilizadores' | 'perguntas' | 'auditoria'>('salas');
  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Quick Admin Room Creation
  const [roomTitle, setRoomTitle] = useState('Campeonato Nacional Código de Estrada');
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
  const [legalRef, setLegalRef] = useState('Código de Estrada de Angola');
  const [signType, setSignType] = useState('none');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!user || !isAdmin) return;
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
  }, [user, isAdmin]);

  if (!loading && !isAdmin) {
    return (
      <AppShell title="Administração">
        <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-3">
          <Shield className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Acesso Restrito</h2>
          <p className="text-sm text-slate-400">
            Esta área é reservada exclusivamente aos administradores autorizados
            da plataforma.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold"
          >
            Voltar ao Dashboard
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
        title: roomTitle,
        maxParticipants: 200,
        totalQuestions: 10,
        timePerQuestion: 60,
        difficulty: roomDiff,
        category: roomCategory,
        isPublic: true,
        hostProfile: profile,
        isAdminUser: true,
      });
      setStatusMsg(`Sala "${created.title}" (${created.code}) criada com sucesso!`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao criar sala.');
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
        legalReference: legalRef,
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
      setStatusMsg('Pergunta adicionada ao banco oficial e registada na auditoria.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao guardar pergunta.');
    }
  };

  return (
    <AppShell title="Painel Administrativo">
      <div className="space-y-6">
        {/* Admin KPI Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">Salas Registadas</p>
            <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {rooms.length}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">Utilizadores</p>
            <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {usersList.length}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">Banco de Perguntas</p>
            <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-1">
              {bankItems.length}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-slate-400">Registos de Auditoria</p>
            <p className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1">
              {auditLogs.length}
            </p>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-sm text-emerald-200">
            {statusMsg}
          </div>
        )}

        {/* Admin Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit">
          {(
            [
              { id: 'salas', label: 'Competições & Salas' },
              { id: 'utilizadores', label: 'Utilizadores' },
              { id: 'perguntas', label: 'Banco de Perguntas' },
              { id: 'auditoria', label: 'Auditoria Imutável' },
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
            <form
              onSubmit={handleAdminCreateRoom}
              className="lg:col-span-5 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 h-fit"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-red-500" />
                Criar Concurso Oficial
              </h3>
              <input
                type="text"
                required
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
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
                      {c}
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
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermédio">Intermédio</option>
                  <option value="Avançado">Avançado</option>
                  <option value="Exame Oficial">Exame Oficial</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingRoom}
                className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer"
              >
                {creatingRoom
                  ? 'A gerar perguntas com IA...'
                  : 'Disponibilizar Sala'}
              </button>
            </form>

            <div className="lg:col-span-7 bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      Código {r.code} · {r.status} · {r.participantCount} alunos
                    </p>
                  </div>
                  <Link
                    href={`/sala/${r.roomId}`}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white shrink-0"
                  >
                    Abrir
                  </Link>
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
                        <span className="text-xs text-red-400 ml-2">
                          (Desativado)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 font-mono-tabular">
                      {u.totalPoints} pts · {u.wins} vitórias · {u.gamesPlayed}{' '}
                      jogos
                    </p>
                  </div>
                </div>
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
                      Reativar
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      Desativar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'perguntas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddQuestion}
              className="lg:col-span-5 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookPlus className="w-4 h-4 text-red-500" />
                Adicionar Pergunta Oficial
              </h3>
              <textarea
                required
                rows={2}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Enunciado da pergunta..."
                className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="Opção A"
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="Opção B"
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder="Opção C"
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <input
                  required
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder="Opção D"
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={correctIdx}
                  onChange={(e) => setCorrectIdx(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  <option value={0}>Correta: A</option>
                  <option value={1}>Correta: B</option>
                  <option value={2}>Correta: C</option>
                  <option value={3}>Correta: D</option>
                </select>
                <select
                  value={signType}
                  onChange={(e) => setSignType(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                >
                  <option value="none">Sem Sinal Visual</option>
                  {Object.entries(SIGN_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                required
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explicação pedagógica..."
                className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <input
                required
                value={legalRef}
                onChange={(e) => setLegalRef(e.target.value)}
                placeholder="Referência legal verificável"
                className="w-full px-3 py-2 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Guardar no Banco Oficial
              </button>
            </form>

            <div className="lg:col-span-7 bg-[#111520] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
              {bankItems.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center">
                  Sem perguntas manuais no banco. As salas geram perguntas
                  dinamicamente via IA Gemini.
                </p>
              ) : (
                bankItems.map((item) => (
                  <div key={item.id} className="p-4 space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {item.questionText}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.category} · {item.legalReference}
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
                Sem registos de auditoria até ao momento.
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
      </div>
    </AppShell>
  );
}
