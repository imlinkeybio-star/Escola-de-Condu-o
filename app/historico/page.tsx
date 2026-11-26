'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, History, Trophy } from 'lucide-react';
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

export default function HistoricoPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<UserResult[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      orderBy('finishedAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setResults(snap.docs.map((d) => d.data() as UserResult));
        setLoadedUid(user.uid);
      },
      (err) => {
        setLoadedUid(user.uid);
        handleFirestoreError(err, OperationType.LIST, 'results');
      }
    );
    return () => unsub();
  }, [user]);

  const loading = Boolean(user) && loadedUid !== user?.uid;

  return (
    <AppShell title="Histórico de Competições">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">
              As Tuas Competições
            </h2>
            <p className="text-xs text-slate-400">
              Consulta resultados anteriores e revê as explicações das perguntas.
            </p>
          </div>
          <Link
            href="/salas"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold whitespace-nowrap"
          >
            Nova Competição
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl bg-[#111520] animate-pulse" />
            <div className="h-20 rounded-2xl bg-[#111520] animate-pulse" />
          </div>
        ) : results.length === 0 ? (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
            <History className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">
              Ainda não participaste em competições concluídas
            </h3>
            <p className="text-xs text-slate-400">
              Entra numa sala ao vivo para registar o teu primeiro resultado
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
            {results.map((r) => (
              <Link
                key={r.resultId}
                href={`/resultado/${r.roomId}`}
                className="flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      r.isWinner
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-bold text-white truncate">
                      {r.roomTitle}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.rank}.º de {r.totalParticipants} · {r.correctCount}/
                      {r.totalQuestions} certas · {r.accuracy}% acerto
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono-tabular text-base font-extrabold text-amber-400">
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
