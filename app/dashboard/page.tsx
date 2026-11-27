'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Megaphone,
  Play,
  PlusCircle,
  Radio,
  Trophy,
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
import { LiveTrendSvgChart } from '@/components/LivePerformanceCharts';
import {
  FacebookStyleAdCard,
  FullscreenVideoAdModal,
} from '@/components/FacebookAdUnit';
import { PlatformUsersTracker } from '@/components/PlatformUsersTracker';
import { BroadcastItem, CompetitionRoom, UserResult } from '@/lib/types';
import { findRoomByCode } from '@/lib/firestore-service';
import { isInternalPath, sanitizeSafeUrl } from '@/lib/url-safety';
import heroCarImg from '@/src/assets/images/hero_angola_highway_car_1795615139713.jpg';
import trophyImg from '@/src/assets/images/trophy_gold_emblem_1795615139789.jpg';

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

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [inlineAds, setInlineAds] = useState<BroadcastItem[]>([]);
  const [dismissedInlineId, setDismissedInlineId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<BroadcastItem | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(6)
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

  useEffect(() => {
    if (!user) return;
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

    const bq = query(
      collection(db, 'broadcasts'),
      where('active', '==', true),
      limit(10)
    );
    const unsubB = onSnapshot(
      bq,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as BroadcastItem), id: d.id }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setInlineAds(list);
      },
      () => {}
    );

    return () => {
      unsubR();
      unsubB();
    };
  }, [user]);

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    if (!codeInput.trim()) return;
    const room = await findRoomByCode(codeInput);
    if (!room) {
      setCodeError('Código não encontrado.');
      return;
    }
    router.push(`/sala/${room.roomId}`);
  };

  const featuredRoom =
    rooms.find(
      (r) => r.status !== 'FINISHED' && (r.finishedCount ?? 0) < 100
    ) ||
    rooms[0] ||
    null;

  const accuracy =
    profile && profile.totalAnswers > 0
      ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
      : 0;

  const inlineSpotlight =
    inlineAds.find((a) => a.id !== dismissedInlineId) || null;
  const inlineSafeLink = sanitizeSafeUrl(inlineSpotlight?.linkUrl);

  if (!loading && !user) {
    return (
      <AppShell title="Dashboard">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">
            Inicia sessão para acederes ao teu painel
          </h2>
          <p className="text-sm text-slate-400">
            Entra ou cria uma conta para participar em competições ao vivo.
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

  const featuredFinCount = featuredRoom?.finishedCount ?? 0;
  const featuredClosed =
    featuredRoom &&
    (featuredRoom.status === 'FINISHED' || featuredFinCount >= 100);

  return (
    <AppShell title="Dashboard Principal">
      {previewVideo && (
        <FullscreenVideoAdModal
          ad={previewVideo}
          isPreview
          onClose={() => setPreviewVideo(null)}
        />
      )}
      <div className="space-y-6 min-w-0">
        {/* Hero Banner */}
        <section className="relative rounded-2xl overflow-hidden border border-white/10 min-h-[200px] sm:min-h-[240px] flex items-end">
          <Image
            src={heroCarImg}
            alt="Condução Segura Começa com Conhecimento"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07090F] via-[#07090F]/75 to-transparent" />
          <div className="relative p-5 sm:p-8 max-w-2xl space-y-3 min-w-0 w-full">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Escola de Condução Live
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight text-balance">
              Condução Segura Começa com Conhecimento!
            </h2>
            <p className="text-sm text-slate-300">
              Olá, {profile?.displayName || 'Condutor'}. Prepara-te com exames
              simultâneos do Código de Estrada de Angola.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/salas?criar=1"
                className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                Criar Sala ao Vivo
              </Link>
              <Link
                href="/salas"
                className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Radio className="w-4 h-4 shrink-0" />
                Ver Salas Disponíveis
              </Link>
            </div>
          </div>
        </section>

        {/* Live KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">Pontos Totais</p>
            <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-1">
              {profile?.totalPoints ?? 0}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">Vitórias</p>
            <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {profile?.wins ?? 0}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">Taxa de Acerto</p>
            <p className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1">
              {accuracy}%
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 min-w-0">
            <p className="text-xs text-slate-400 truncate">Jogos / Sequência</p>
            <p className="font-mono-tabular text-2xl font-bold text-red-400 mt-1">
              {profile?.gamesPlayed ?? 0}{' '}
              <span className="text-sm text-slate-400">
                ({profile?.currentStreak ?? 0})
              </span>
            </p>
          </div>
        </section>

        {/* Real-Time 5M Users Community Growth Progress Bar & Charts */}
        <PlatformUsersTracker />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Featured Live Room + Real-Time Chart + Join by Code */}
          <div className="lg:col-span-7 space-y-5 min-w-0">
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2 min-w-0">
                  <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="truncate">Sala de Competição em Destaque</span>
                </h3>
                <Link
                  href="/salas"
                  className="text-xs text-red-400 hover:text-red-300 font-semibold whitespace-nowrap shrink-0"
                >
                  Ver todas
                </Link>
              </div>

              {featuredRoom ? (
                <div className="bg-[#161B29] border border-white/[0.06] rounded-xl p-4 space-y-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-400 truncate">
                        {featuredRoom.category} · {featuredRoom.difficulty} ·{' '}
                        <span className="font-mono-tabular text-white">
                          {featuredRoom.code}
                        </span>
                      </p>
                      <h4 className="text-lg font-bold text-white mt-0.5 break-words">
                        {featuredRoom.title}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 font-mono-tabular ${
                        featuredClosed ? 'text-slate-300' : 'text-emerald-400'
                      }`}
                    >
                      {featuredClosed
                        ? `Encerrada · ${featuredFinCount}/100`
                        : `Aberta · ${featuredFinCount}/100`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-400 shrink-0" />
                      {featuredRoom.participantCount} alunos ·{' '}
                      {featuredFinCount}/100 finalistas
                    </span>
                    <span className="font-mono-tabular">
                      {featuredRoom.totalQuestions} perguntas ·{' '}
                      {featuredRoom.timePerQuestion}s
                    </span>
                  </div>
                  <Link
                    href={`/sala/${featuredRoom.roomId}`}
                    className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {featuredClosed ? 'Ver Resultados' : 'Entrar na Sala'}
                  </Link>
                </div>
              ) : (
                <div className="bg-[#161B29] border border-white/[0.06] rounded-xl p-6 text-center space-y-3">
                  <p className="text-sm text-slate-300">
                    Ainda não há salas públicas ativas neste momento.
                  </p>
                  <Link
                    href="/salas?criar=1"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Criar Primeira Sala com IA
                  </Link>
                </div>
              )}
            </div>

            {/* Real-Time Progress Chart on Dashboard */}
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2 min-w-0">
                  <BarChart3 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="truncate">Desempenho em Tempo Real</span>
                </h3>
                <Link
                  href="/estatisticas"
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold whitespace-nowrap shrink-0"
                >
                  Detalhes
                </Link>
              </div>
              <LiveTrendSvgChart results={results} height={160} />
            </div>

            {/* Join via Code */}
            <form
              onSubmit={handleJoinCode}
              className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3 min-w-0"
            >
              <label className="block text-sm font-bold text-white">
                Entrar com Código de Convite
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Insere o código da sala..."
                  className="flex-1 min-w-0 min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular uppercase focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {codeError && <p className="text-xs text-red-400">{codeError}</p>}
            </form>
          </div>

          {/* Quick Navigation Menu Rows + Non-Intrusive Inline Ad Card */}
          <div className="lg:col-span-5 space-y-3 min-w-0">
            <Link
              href="/salas"
              className="flex items-center justify-between p-4 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Minhas Salas
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    Participe dos próximos jogos ao vivo
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
            </Link>

            <Link
              href="/estatisticas"
              className="flex items-center justify-between p-4 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Estatísticas
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    Veja o seu progresso e taxa de acerto
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
            </Link>

            <Link
              href="/regras"
              className="flex items-center justify-between p-4 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Regras de Trânsito
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    Aprenda sinais e pergunte à IA
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
            </Link>

            <Link
              href="/definicoes"
              className="flex items-center justify-between p-4 rounded-2xl bg-[#111520] hover:bg-[#171C2B] border border-white/[0.08] transition-colors gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Definições & Suporte
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    Voz IA, preferências e apoio ao aluno
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
            </Link>

            {/* Non-intrusive inline announcement/ad spotlight */}
            {inlineSpotlight &&
              (inlineSpotlight.kind === 'ad_banner' ||
              inlineSpotlight.kind === 'ad_video' ? (
                <FacebookStyleAdCard
                  ad={inlineSpotlight}
                  compact
                  onDismiss={() => setDismissedInlineId(inlineSpotlight.id)}
                  onOpenFullscreen={(ad) => setPreviewVideo(ad)}
                />
              ) : (
                <div className="rounded-2xl bg-[#111626] border border-amber-500/30 p-4 space-y-2 relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setDismissedInlineId(inlineSpotlight.id)}
                    aria-label="Fechar destaque"
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 pr-8">
                    <Megaphone className="w-3.5 h-3.5 shrink-0" />
                    <span>Comunicado Oficial</span>
                  </div>
                  <p className="text-sm font-bold text-white pr-6 break-words">
                    {inlineSpotlight.title}
                  </p>
                  <p className="text-xs text-slate-300 break-words">
                    {inlineSpotlight.body}
                  </p>
                  {inlineSafeLink &&
                    (isInternalPath(inlineSafeLink) ? (
                      <Link
                        href={inlineSafeLink}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
                      >
                        {inlineSpotlight.linkLabel || 'Ver Detalhes'}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <a
                        href={inlineSafeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
                      >
                        {inlineSpotlight.linkLabel || 'Abrir Link'}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                </div>
              ))}

            {/* Bottom Road Safety Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-red-950/70 to-[#111520] border border-red-500/30 p-4 flex items-center gap-4 min-w-0">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-amber-400/30">
                <Image
                  src={trophyImg}
                  alt="Segurança Rodoviária"
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-bold text-white leading-tight">
                  Juntos por uma estrada mais segura!
                </p>
                <p className="text-xs text-slate-300">
                  Educação rodoviária interativa em Angola.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
