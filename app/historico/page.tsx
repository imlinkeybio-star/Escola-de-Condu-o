'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Crown, History, Radio, Trophy } from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { CompetitionRoom, UserResult } from '@/lib/types';

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function formatWhen(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Recente';
  return new Date(ms).toLocaleString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoricoPage() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<UserResult[]>([]);
  const [myCreatedRooms, setMyCreatedRooms] = useState<CompetitionRoom[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'wins' | 'created'>('all');

  useEffect(() => {
    if (!user) return;
    // Strictly scoped to the account owner (uid == user.uid) without composite index dependencies
    const rq = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      limit(100)
    );
    const unsubR = onSnapshot(
      rq,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserResult)
          .filter((item) => item.uid === user.uid)
          .sort((a, b) => toMillis(b.finishedAt) - toMillis(a.finishedAt));
        setResults(list);
        setLoadedUid(user.uid);
      },
      (err) => {
        setLoadedUid(user.uid);
        handleFirestoreError(err, OperationType.LIST, 'results');
      }
    );

    const hq = query(
      collection(db, 'rooms'),
      where('hostId', '==', user.uid),
      limit(50)
    );
    const unsubH = onSnapshot(
      hq,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as CompetitionRoom)
          .filter((r) => r.hostId === user.uid)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setMyCreatedRooms(list);
      },
      () => {}
    );

    return () => {
      unsubR();
      unsubH();
    };
  }, [user]);

  const loading = Boolean(user) && loadedUid !== user?.uid;

  if (!user) {
    return (
      <AppShell title="Histórico Completo">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <History className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-300">
            Inicia sessão para consultares o teu histórico pessoal completo em
            tempo real.
          </p>
          <Link
            href="/entrar"
            className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            Entrar
          </Link>
        </div>
      </AppShell>
    );
  }

  const winsList = results.filter((r) => r.isWinner);
  const displayedResults = tab === 'wins' ? winsList : results;

  return (
    <AppShell title="Histórico Completo da Conta">
      <div className="space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold text-white">
              O Teu Histórico Completo
            </h2>
            <p className="text-xs text-slate-400">
              Registos exclusivos da conta de{' '}
              <strong className="text-slate-200">
                {profile?.displayName || user.email}
              </strong>{' '}
              atualizados em tempo real.
            </p>
          </div>
          <Link
            href="/salas"
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Nova Competição
          </Link>
        </div>

        {/* Account Owner Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-slate-400">Competições</p>
            <p className="font-mono-tabular text-xl font-bold text-white">
              {results.length}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-slate-400">Vitórias</p>
            <p className="font-mono-tabular text-xl font-bold text-amber-400">
              {winsList.length}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-slate-400">Pontos Acumulados</p>
            <p className="font-mono-tabular text-xl font-bold text-emerald-400">
              {profile?.totalPoints ?? 0}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-slate-400">Salas Criadas</p>
            <p className="font-mono-tabular text-xl font-bold text-sky-400">
              {myCreatedRooms.length}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
          {(
            [
              { id: 'all', label: `Participações (${results.length})` },
              { id: 'wins', label: `Vitórias (${winsList.length})` },
              { id: 'created', label: `Salas Criadas (${myCreatedRooms.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl bg-[#111520] animate-pulse" />
            <div className="h-20 rounded-2xl bg-[#111520] animate-pulse" />
          </div>
        ) : tab === 'created' ? (
          myCreatedRooms.length === 0 ? (
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center space-y-3">
              <Radio className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300">
                Ainda não criaste nenhuma sala com esta conta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myCreatedRooms.map((rm) => (
                <Link
                  key={rm.roomId}
                  href={`/sala/${rm.roomId}`}
                  className="flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-bold text-white truncate">
                      {rm.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Código {rm.code} · {rm.participantCount} alunos ·{' '}
                      {rm.finishedCount ?? 0}/100 finalistas ·{' '}
                      {formatWhen(rm.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </Link>
              ))}
            </div>
          )
        ) : displayedResults.length === 0 ? (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
            <History className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">
              Sem competições nesta vista
            </h3>
            <p className="text-xs text-slate-400">
              Entra numa sala ao vivo para registar o teu próximo resultado
              oficial.
            </p>
            <Link
              href="/salas"
              className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold"
            >
              Ver Salas ao Vivo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedResults.map((r) => (
              <Link
                key={r.resultId}
                href={`/resultado/${r.roomId}`}
                className="flex items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      r.isWinner
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    {r.isWinner ? (
                      <Crown className="w-5 h-5" />
                    ) : (
                      <Trophy className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-bold text-white truncate">
                      {r.roomTitle}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 break-words">
                      {r.rank}.º de {r.totalParticipants} · {r.correctCount} certas ·{' '}
                      {r.wrongCount} erradas · {r.accuracy}% ·{' '}
                      {formatWhen(r.finishedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="font-mono-tabular text-sm sm:text-base font-extrabold text-amber-400 whitespace-nowrap">
                    {r.score} pts
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
