'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Flame, Target, Trophy } from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { AppShell } from '@/components/AppShell';
import {
  LiveAnswerBreakdownBar,
  LiveTrendSvgChart,
} from '@/components/LivePerformanceCharts';
import { UserResult } from '@/lib/types';
import { formatNumberLocale, tFormat } from '@/lib/i18n';

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

export default function EstatisticasPage() {
  const { user, profile } = useAuth();
  const { language, dict } = useLanguage();
  const [results, setResults] = useState<UserResult[]>([]);

  useEffect(() => {
    if (!user) return;
    // Query without orderBy so composite index status never blocks live real-time updates
    const q = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      limit(40)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserResult)
          .sort((a, b) => toMillis(b.finishedAt) - toMillis(a.finishedAt));
        setResults(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'results')
    );
    return () => unsub();
  }, [user]);

  const totalAnswers = profile?.totalAnswers ?? 0;
  const correctAnswers = profile?.correctAnswers ?? 0;
  const gamesPlayed = profile?.gamesPlayed ?? results.length;
  const totalPoints = profile?.totalPoints ?? 0;
  const wins = profile?.wins ?? 0;

  const accuracy =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const avgScore =
    gamesPlayed > 0 ? Math.round(totalPoints / gamesPlayed) : 0;

  return (
    <AppShell title={dict.stats.guestTitle}>
      <div className="space-y-6 min-w-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-2 min-w-0">
            <Target className="w-5 h-5 text-emerald-400" />
            <p className="text-xs text-slate-400">{dict.dashboard.accuracyRate}</p>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-white">
              {accuracy}%
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-2 min-w-0">
            <Trophy className="w-5 h-5 text-amber-400" />
            <p className="text-xs text-slate-400">{dict.stats.winRate}</p>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-amber-400">
              {winRate}%
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-2 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-sky-400" />
            <p className="text-xs text-slate-400">{dict.stats.avgPerQuiz}</p>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-white">
              {formatNumberLocale(language, avgScore)} {dict.common.pts}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-2 min-w-0">
            <Flame className="w-5 h-5 text-red-500" />
            <p className="text-xs text-slate-400">{dict.stats.bestStreak}</p>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-red-400">
              {profile?.bestStreak ?? 0}
            </p>
          </div>
        </div>

        {/* Live Answer Distribution Card */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white">
              {dict.stats.realDistributionTitle}
            </h3>
            <span className="font-mono-tabular text-xs text-amber-400 font-bold">
              {tFormat(dict.stats.totalPtsGames, {
                pts: formatNumberLocale(language, totalPoints),
                games: gamesPlayed,
              })}
            </span>
          </div>
          <LiveAnswerBreakdownBar
            correctAnswers={correctAnswers}
            totalAnswers={totalAnswers}
          />
        </div>

        {/* Interactive Real-Time SVG Performance Chart */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-red-500 shrink-0" />
              <h3 className="text-base font-bold text-white">
                {dict.stats.evolutionChartTitle}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono-tabular">
              {tFormat(dict.stats.registeredCompetitions, { count: results.length })}
            </span>
          </div>

          <LiveTrendSvgChart results={results} height={200} />

          {results.length === 0 ? (
            <div className="pt-2 text-center">
              <Link
                href="/salas"
                className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold"
              >
                {dict.stats.participateNow}
              </Link>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              {results.slice(0, 10).map((r) => (
                <div key={r.resultId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-200 font-medium truncate min-w-0">
                      {r.roomTitle}
                    </span>
                    <span className="font-mono-tabular text-slate-300 shrink-0">
                      {r.accuracy}% · {formatNumberLocale(language, r.score)} {dict.common.pts} (#{r.rank})
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#1B2234] overflow-hidden">
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
