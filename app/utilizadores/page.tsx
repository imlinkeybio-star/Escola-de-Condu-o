'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpDown,
  Award,
  CheckCircle2,
  Compass,
  Crown,
  Gauge,
  Medal,
  Radio,
  Search,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import {
  AchievementRecord,
  computeDriverTier,
  DriverTier,
  UserProfile,
} from '@/lib/types';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

type TierFilter = 'Todos' | DriverTier;
type SortOption = 'points' | 'prizes' | 'wins' | 'name';

const TIER_FILTERS: TierFilter[] = [
  'Todos',
  'Mestre da Estrada',
  'Especialista',
  'Condutor',
  'Aprendiz',
];

const TIER_WEIGHT: Record<'gold' | 'silver' | 'bronze', number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

function getTierIcon(tier: DriverTier) {
  switch (tier) {
    case 'Mestre da Estrada':
      return <Crown className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'Especialista':
      return <Shield className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'Condutor':
      return <Gauge className="w-4 h-4 text-sky-400 shrink-0" />;
    default:
      return <Compass className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

function getTierAccentClass(tier: DriverTier): string {
  switch (tier) {
    case 'Mestre da Estrada':
      return 'text-amber-400';
    case 'Especialista':
      return 'text-emerald-400';
    case 'Condutor':
      return 'text-sky-400';
    default:
      return 'text-slate-300';
  }
}

function getPrizeColor(tier: AchievementRecord['tier']): string {
  switch (tier) {
    case 'gold':
      return 'text-amber-300 border-amber-400/30 bg-amber-500/10';
    case 'silver':
      return 'text-slate-200 border-slate-300/25 bg-slate-400/10';
    default:
      return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
  }
}

function formatUnlockedDate(ts: unknown): string {
  if (!ts) return 'Conquistado';
  let ms = 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    ms = (ts as { toMillis: () => number }).toMillis();
  } else if (typeof (ts as { seconds?: number }).seconds === 'number') {
    ms = (ts as { seconds: number }).seconds * 1000;
  }
  if (!ms) return 'Conquistado';
  return new Date(ms).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function UtilizadoresPage() {
  const { user, loading, authReady } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('Todos');
  const [sortBy, setSortBy] = useState<SortOption>('points');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !user) return;
    const usersQ = query(
      collection(db, 'users'),
      where('disabled', '==', false)
    );
    const unsubUsers = onSnapshot(
      usersQ,
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
        setLoadingUsers(false);
        setLoadError('');
      },
      (err) => {
        setLoadingUsers(false);
        setLoadError('Não foi possível carregar a lista geral de utilizadores.');
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );

    const achievementsQ = query(
      collection(db, 'achievements'),
      where('tier', 'in', ['bronze', 'silver', 'gold'])
    );
    const unsubAchievements = onSnapshot(
      achievementsQ,
      (snap) => {
        setAchievements(snap.docs.map((d) => d.data() as AchievementRecord));
        setLoadingPrizes(false);
      },
      (err) => {
        setLoadingPrizes(false);
        handleFirestoreError(err, OperationType.LIST, 'achievements');
      }
    );

    return () => {
      unsubUsers();
      unsubAchievements();
    };
  }, [authReady, user]);

  const achievementsByUid = useMemo(() => {
    const map = new Map<string, AchievementRecord[]>();
    for (const ach of achievements) {
      if (!ach.uid) continue;
      const list = map.get(ach.uid) || [];
      list.push(ach);
      map.set(ach.uid, list);
    }
    for (const [uid, list] of map.entries()) {
      list.sort(
        (a, b) => (TIER_WEIGHT[b.tier] || 0) - (TIER_WEIGHT[a.tier] || 0)
      );
      map.set(uid, list);
    }
    return map;
  }, [achievements]);

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const level = u.tier || computeDriverTier(u.totalPoints || 0);
      const userAchievements = achievementsByUid.get(u.uid) || [];
      const accuracy =
        u.totalAnswers > 0
          ? Math.round((u.correctAnswers / u.totalAnswers) * 100)
          : 0;
      const prizeCount = userAchievements.length + (u.wins > 0 ? 1 : 0);
      return {
        ...u,
        level,
        userAchievements,
        accuracy,
        prizeCount,
      };
    });
  }, [users, achievementsByUid]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedUsers
      .filter((u) => {
        const matchesName =
          !q || (u.displayName || '').toLowerCase().includes(q);
        const matchesTier = tierFilter === 'Todos' || u.level === tierFilter;
        return matchesName && matchesTier;
      })
      .sort((a, b) => {
        if (sortBy === 'prizes') {
          if (b.userAchievements.length !== a.userAchievements.length) {
            return b.userAchievements.length - a.userAchievements.length;
          }
          if ((b.wins || 0) !== (a.wins || 0)) {
            return (b.wins || 0) - (a.wins || 0);
          }
          return (b.totalPoints || 0) - (a.totalPoints || 0);
        }
        if (sortBy === 'wins') {
          if ((b.wins || 0) !== (a.wins || 0)) {
            return (b.wins || 0) - (a.wins || 0);
          }
          return (b.totalPoints || 0) - (a.totalPoints || 0);
        }
        if (sortBy === 'name') {
          return (a.displayName || '').localeCompare(
            b.displayName || '',
            'pt'
          );
        }
        return (b.totalPoints || 0) - (a.totalPoints || 0);
      });
  }, [enrichedUsers, searchQuery, tierFilter, sortBy]);

  const summary = useMemo(() => {
    const totalUsers = enrichedUsers.length;
    const totalPrizes = achievements.length;
    const totalWins = enrichedUsers.reduce((acc, u) => acc + (u.wins || 0), 0);
    const eliteCount = enrichedUsers.filter(
      (u) => u.level === 'Mestre da Estrada' || u.level === 'Especialista'
    ).length;
    return { totalUsers, totalPrizes, totalWins, eliteCount };
  }, [enrichedUsers, achievements.length]);

  const selectedUser = useMemo(
    () => enrichedUsers.find((u) => u.uid === selectedUid) || null,
    [enrichedUsers, selectedUid]
  );

  const isLoading = loadingUsers || loadingPrizes;

  if (!loading && !user) {
    return (
      <AppShell title="Utilizadores & Prêmios">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">
            Inicia sessão para veres todos os utilizadores e prêmios
          </h2>
          <p className="text-sm text-slate-400">
            Entra ou cria uma conta para consultar o perfil, nível e troféus da comunidade.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/entrar"
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
            >
              Entrar
            </Link>
            <Link
              href="/registar"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
            >
              Registar-se
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Utilizadores & Prêmios">
      <div className="space-y-6">
        {/* Header Banner */}
        <section className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/25 text-red-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white text-balance">
                Todos os Utilizadores da Escola de Condução Live
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Perfis públicos, fotografia, nível de condução e prêmios
                conquistados por toda a comunidade em tempo real.
              </p>
            </div>
          </div>
          <Link
            href="/conquistas"
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Award className="w-4 h-4 text-amber-400" />
            Catálogo de Prêmios
          </Link>
        </section>

        {/* 4 Summary Metrics */}
        <section
          aria-label="Resumo geral de utilizadores e prêmios"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">
              Utilizadores Ativos
            </p>
            <p className="font-mono-tabular text-2xl font-extrabold text-white mt-1 tabular-nums">
              {summary.totalUsers.toLocaleString('pt-AO')}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">
              Prêmios Conquistados
            </p>
            <p className="font-mono-tabular text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">
              {summary.totalPrizes.toLocaleString('pt-AO')}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">
              Vitórias em Salas
            </p>
            <p className="font-mono-tabular text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">
              {summary.totalWins.toLocaleString('pt-AO')}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">
              Mestres & Especialistas
            </p>
            <p className="font-mono-tabular text-2xl font-extrabold text-sky-400 mt-1 tabular-nums">
              {summary.eliteCount.toLocaleString('pt-AO')}
            </p>
          </div>
        </section>

        {/* Search, Level Filter & Sort Controls */}
        <section className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 space-y-3 min-w-0">
          <div className="flex flex-col md:flex-row gap-3 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar utilizador por username..."
                aria-label="Pesquisar utilizador por username"
                className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-[#090C14] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Ordenar utilizadores"
                className="min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/10 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="points">Ordenar: Maior Pontuação</option>
                <option value="prizes">Ordenar: Mais Prêmios</option>
                <option value="wins">Ordenar: Mais Vitórias</option>
                <option value="name">Ordenar: Nome (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {TIER_FILTERS.map((tier) => {
              const active = tierFilter === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-red-600 text-white'
                      : 'bg-[#090C14] text-slate-300 border border-white/[0.08] hover:text-white hover:border-white/20'
                  }`}
                >
                  {tier}
                </button>
              );
            })}
          </div>
        </section>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-sm text-red-200">
            {loadError}
          </div>
        )}

        {/* Directory List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-white/[0.07] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-white/[0.08]" />
                    <div className="h-3 w-56 rounded bg-white/[0.06]" />
                  </div>
                </div>
                <div className="h-10 rounded-xl bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-base font-bold text-white">
                {users.length === 0
                  ? 'Nenhum utilizador encontrado ainda'
                  : 'Nenhum utilizador corresponde ao filtro'}
              </p>
              <p className="text-xs text-slate-400">
                {users.length === 0
                  ? 'Os utilizadores aparecem aqui automaticamente após entrarem na plataforma.'
                  : 'Tenta limpar a pesquisa ou selecionar outro nível de condução.'}
              </p>
            </div>
            {users.length === 0 ? (
              <Link
                href="/salas"
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white whitespace-nowrap"
              >
                <Radio className="w-4 h-4" />
                Ir para Salas ao Vivo
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTierFilter('Todos');
                }}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.map((u) => {
              const isMe = u.uid === user?.uid;
              return (
                <article
                  key={u.uid}
                  className={`bg-[#111520] border rounded-2xl p-5 flex flex-col justify-between gap-4 min-w-0 ${
                    isMe ? 'border-red-500/40' : 'border-white/[0.08]'
                  }`}
                >
                  {/* Top Row: Picture + Username + Level */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/15 shrink-0 bg-[#090C14]">
                        <Image
                          src={u.photoURL || defaultAvatarImg}
                          alt={u.displayName || 'Utilizador'}
                          fill
                          sizes="56px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-base font-bold text-white truncate">
                            {u.displayName || 'Condutor'}
                          </h3>
                          {isMe && (
                            <span className="text-[11px] font-semibold text-red-400 shrink-0">
                              (Tu)
                            </span>
                          )}
                        </div>

                        {/* Unboxed level + tabular stats metadata */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-1">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${getTierAccentClass(u.level)}`}
                          >
                            {getTierIcon(u.level)}
                            {u.level}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono-tabular text-amber-400 font-semibold tabular-nums">
                            {(u.totalPoints || 0).toLocaleString('pt-AO')} pts
                          </span>
                          <span className="text-slate-600" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono-tabular text-slate-400 tabular-nums">
                            {u.gamesPlayed || 0} jogos · {u.accuracy}% acerto
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedUid(u.uid)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Detalhes
                    </button>
                  </div>

                  {/* Divider + Prizes Section */}
                  <div className="pt-3 border-t border-white/[0.07] space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-300">
                        Prêmios & Troféus
                      </span>
                      <span className="font-mono-tabular text-slate-400 tabular-nums">
                        {u.userAchievements.length} conquistas
                        {u.wins > 0
                          ? ` · ${u.wins} ${u.wins === 1 ? 'vitória' : 'vitórias'}`
                          : ''}
                      </span>
                    </div>

                    {u.userAchievements.length === 0 && (u.wins || 0) === 0 ? (
                      <p className="text-xs text-slate-500">
                        Nenhum prêmio conquistado ainda.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {u.wins > 0 && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/35 bg-amber-500/10 text-xs font-semibold text-amber-300">
                            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-mono-tabular tabular-nums">
                              {u.wins}{' '}
                              {u.wins === 1
                                ? 'Troféu de 1.º Lugar'
                                : 'Troféus de 1.º Lugar'}
                            </span>
                          </div>
                        )}
                        {u.userAchievements.map((ach) => (
                          <div
                            key={`${u.uid}_${ach.achievementId}`}
                            title={ach.description}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getPrizeColor(ach.tier)}`}
                          >
                            {ach.tier === 'gold' ? (
                              <Award className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Medal className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{ach.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* User Prizes Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedUid(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111520] border border-white/15 rounded-2xl p-6 space-y-5 max-h-[88dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/20 shrink-0 bg-[#090C14]">
                  <Image
                    src={selectedUser.photoURL || defaultAvatarImg}
                    alt={selectedUser.displayName || 'Utilizador'}
                    fill
                    sizes="64px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-white truncate">
                    {selectedUser.displayName || 'Condutor'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    {getTierIcon(selectedUser.level)}
                    <span
                      className={`font-semibold ${getTierAccentClass(selectedUser.level)}`}
                    >
                      Nível: {selectedUser.level}
                    </span>
                  </div>
                  <p className="font-mono-tabular text-xs text-slate-400 mt-1 tabular-nums">
                    {(selectedUser.totalPoints || 0).toLocaleString('pt-AO')}{' '}
                    pts · {selectedUser.gamesPlayed || 0} jogos ·{' '}
                    {selectedUser.accuracy}% acerto · Melhor série:{' '}
                    {selectedUser.bestStreak || 0}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUid(null)}
                aria-label="Fechar detalhes do utilizador"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-4 border-t border-white/[0.08] space-y-3">
              <h4 className="text-sm font-bold text-white">
                Prêmios e Troféus Desbloqueados
              </h4>

              {selectedUser.wins > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        Vitórias em Salas ao Vivo
                      </p>
                      <p className="text-xs text-slate-300">
                        1.º lugar alcançado em competições oficiais.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-base font-extrabold text-amber-300 shrink-0 tabular-nums">
                    {selectedUser.wins}x
                  </span>
                </div>
              )}

              {selectedUser.userAchievements.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  Este utilizador ainda não desbloqueou medalhas no catálogo de
                  conquistas.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedUser.userAchievements.map((ach) => (
                    <div
                      key={`${selectedUser.uid}_detail_${ach.achievementId}`}
                      className="p-3.5 rounded-xl bg-[#090C14] border border-white/[0.08] flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Award
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            ach.tier === 'gold'
                              ? 'text-amber-400'
                              : ach.tier === 'silver'
                                ? 'text-slate-200'
                                : 'text-orange-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">
                            {ach.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ach.description}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {formatUnlockedDate(ach.unlockedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
