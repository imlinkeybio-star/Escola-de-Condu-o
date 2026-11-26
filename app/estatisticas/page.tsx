'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Flame, Target, Trophy } from 'lucide-react';
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
import { UserResult } from '@/lib/types';

export default function EstatisticasPage() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<UserResult[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      orderBy('finishedAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setResults(snap.docs.map((d) => d.data() as UserResult)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'results')
    );
    return () => unsub();
  }, [user]);

  const accuracy =
    profile && profile.totalAnswers > 0
      ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
      : 0;
  const winRate =
    profile && profile.gamesPlayed > 0
      ? Math.round((profile.wins / profile.gamesPlayed) * 100)
      : 0;
  const avgScore =
    profile && profile.gamesPlayed > 0
      ? Math.round(profile.totalPoints / profile.gamesPlayed)
      : 0;

  return (
    <AppShell title="Estatísticas Pessoais">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <p className="text-xs text-slate-400">Taxa de Acerto Global</p>
            <p className="font-mono-tabular text-3xl font-extrabold text-white">
              {accuracy}%
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <p className="text-xs text-slate-400">Taxa de Vitórias</p>
            <p className="font-mono-tabular text-3xl font-extrabold text-amber-400">
              {winRate}%
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2">
            <CheckCircle2 className="w-5 h-5 text-sky-400" />
            <p className="text-xs text-slate-400">Média por Concurso</p>
            <p className="font-mono-tabular text-3xl font-extrabold text-white">
              {avgScore} pts
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2">
            <Flame className="w-5 h-5 text-red-500" />
            <p className="text-xs text-slate-400">Melhor Sequência</p>
            <p className="font-mono-tabular text-3xl font-extrabold text-red-400">
              {profile?.bestStreak ?? 0}
            </p>
          </div>
        </div>

        {/* Performance Trend Bars */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-red-500" />
              <h3 className="text-base font-bold text-white">
                Evolução de Precisão Recente
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Últimas {results.length} competições
            </span>
          </div>

          {results.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-400">
                Conclui pelo menos uma competição para visualizar o teu gráfico
                de evolução.
              </p>
              <Link
                href="/salas"
                className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold"
              >
                Participar Agora
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.resultId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[65%]">
                      {r.roomTitle}
                    </span>
                    <span className="font-mono-tabular text-slate-300">
                      {r.accuracy}% · {r.score} pts ({r.rank}.º lugar)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#1B2234] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        r.accuracy >= 80
                          ? 'bg-emerald-500'
                          : r.accuracy >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(4, r.accuracy)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
