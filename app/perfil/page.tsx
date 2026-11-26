'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Award,
  Check,
  Edit3,
  Flame,
  Settings,
  Star,
  Trophy,
} from 'lucide-react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import {
  LiveAnswerBreakdownBar,
  LiveTrendSvgChart,
} from '@/components/LivePerformanceCharts';
import {
  AchievementRecord,
  ACHIEVEMENTS_CATALOG,
  ANGOLA_PROVINCES,
  UserResult,
} from '@/lib/types';
import { updateUserProfileDetails } from '@/lib/firestore-service';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

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

export default function PerfilPage() {
  const { user, profile, privateInfo, refreshProfile } = useAuth();
  const [tab, setTab] = useState<'desempenho' | 'conquistas'>('desempenho');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [drivingSchool, setDrivingSchool] = useState('');
  const [province, setProvince] = useState('Luanda');
  const [saving, setSaving] = useState(false);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);

  useEffect(() => {
    if (!user) return;
    const aq = query(
      collection(db, 'achievements'),
      where('uid', '==', user.uid)
    );
    const unsubA = onSnapshot(
      aq,
      (snap) =>
        setAchievements(snap.docs.map((d) => d.data() as AchievementRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'achievements')
    );

    const rq = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      limit(20)
    );
    const unsubR = onSnapshot(
      rq,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserResult)
          .sort((a, b) => toMillis(b.finishedAt) - toMillis(a.finishedAt));
        setResults(list);
      },
      () => {}
    );

    return () => {
      unsubA();
      unsubR();
    };
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfileDetails(user.uid, {
        displayName,
        drivingSchool,
        province,
      });
      await refreshProfile();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) {
    return (
      <AppShell title="Meu Perfil">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center">
          <Link
            href="/entrar"
            className="inline-block px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            Entrar para ver perfil
          </Link>
        </div>
      </AppShell>
    );
  }

  const accuracy =
    profile.totalAnswers > 0
      ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
      : 0;
  const avgPoints =
    profile.gamesPlayed > 0
      ? Math.round(profile.totalPoints / profile.gamesPlayed)
      : 0;
  const unlockedSet = new Set(achievements.map((a) => a.achievementId));

  // SVG circular gauge geometry
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (accuracy / 100) * circumference;

  return (
    <AppShell title="Meu Perfil">
      <div className="max-w-4xl mx-auto space-y-6 min-w-0">
        {/* Profile Header Card */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 text-center space-y-4 relative min-w-0">
          <Link
            href="/definicoes"
            aria-label="Definições"
            className="absolute top-4 right-4 min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-300"
          >
            <Settings className="w-4 h-4" />
          </Link>

          <div className="relative w-24 h-24 mx-auto">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-amber-400/60">
              <Image
                src={profile.photoURL || defaultAvatarImg}
                alt={profile.displayName}
                fill
                sizes="96px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              onClick={() => {
                setDisplayName(profile.displayName);
                setDrivingSchool(privateInfo?.drivingSchool || '');
                setProvince(privateInfo?.province || 'Luanda');
                setEditing((p) => !p);
              }}
              aria-label="Editar perfil"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center border-2 border-[#111520] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white break-words">
              {profile.displayName}
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-1">
              {profile.tier} · {privateInfo?.province || 'Luanda'}
            </p>
            {privateInfo?.drivingSchool && (
              <p className="text-xs text-slate-400 mt-0.5 break-words">
                {privateInfo.drivingSchool}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md mx-auto pt-2">
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Star className="w-4 h-4 text-amber-400 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.totalPoints}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Pontos</p>
            </div>
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Trophy className="w-4 h-4 text-amber-400 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.wins}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Vitórias</p>
            </div>
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Flame className="w-4 h-4 text-red-500 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.currentStreak}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Sequência</p>
            </div>
          </div>

          {editing && (
            <form
              onSubmit={handleSave}
              className="max-w-md mx-auto pt-4 border-t border-white/[0.08] space-y-3 text-left"
            >
              <div>
                <label className="text-xs text-slate-400">Nome</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Escola de Condução
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={drivingSchool}
                    onChange={(e) => setDrivingSchool(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Província</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {saving ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </form>
          )}
        </div>

        {/* Profile Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#111520] border border-white/[0.08] rounded-xl">
          <button
            onClick={() => setTab('desempenho')}
            className={`py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              tab === 'desempenho'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Meu Desempenho
          </button>
          <button
            onClick={() => setTab('conquistas')}
            className={`py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              tab === 'conquistas'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Conquistas ({achievements.length})
          </button>
        </div>

        {tab === 'desempenho' ? (
          <div className="space-y-5">
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-around gap-6">
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 110 110">
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="#1E2536"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="#22C55E"
                    strokeWidth="10"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="font-mono-tabular text-2xl font-extrabold text-white block">
                    {accuracy}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Taxa de Acerto
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 sm:gap-6 text-center sm:text-left">
                <div>
                  <p className="text-xs text-slate-400">Total de Jogos</p>
                  <p className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
                    {profile.gamesPlayed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Média de Pontos</p>
                  <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-0.5">
                    {avgPoints} pts
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Respostas Certas</p>
                  <p className="font-mono-tabular text-xl font-bold text-emerald-400 mt-0.5">
                    {profile.correctAnswers}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Melhor Sequência</p>
                  <p className="font-mono-tabular text-xl font-bold text-red-400 mt-0.5">
                    {profile.bestStreak}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
              <h3 className="text-base font-bold text-white">
                Progresso em Tempo Real
              </h3>
              <LiveAnswerBreakdownBar
                correctAnswers={profile.correctAnswers}
                totalAnswers={profile.totalAnswers}
              />
              <LiveTrendSvgChart results={results} height={170} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENTS_CATALOG.map((ach) => {
              const unlocked = unlockedSet.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                    unlocked
                      ? 'bg-[#111520] border-amber-400/40'
                      : 'bg-[#0C0F18] border-white/[0.05] opacity-55'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {ach.title}
                    </p>
                    <p className="text-xs text-slate-400">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
