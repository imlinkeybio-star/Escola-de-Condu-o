'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Info,
  Medal,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  CompetitionRoom,
  RoomAnswer,
  RoomParticipant,
  RoomQuestion,
  RoomRevealedAnswer,
} from '@/lib/types';
import {
  fetchServerTimeOffsetMs,
  finishCompetitionRoom,
  joinCompetitionRoom,
  recordMyCompetitionResult,
  revealCompetitionRound,
  scoreParticipantForRound,
  startCompetitionRound,
  submitPlayerAnswer,
} from '@/lib/firestore-service';
import { useAuth } from './AuthProvider';
import { useVoiceExaminer } from '@/hooks/useVoiceExaminer';
import { TrafficSignDisplay } from './TrafficSignDisplay';
import examinerImg from '@/src/assets/images/virtual_examiner_angola_1795615139196.jpg';
import trophyImg from '@/src/assets/images/trophy_gold_emblem_1795615139789.jpg';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function LiveCompetitionArena({ roomId }: { roomId: string }) {
  const { user, profile, privateInfo, isAdmin } = useAuth();
  const [room, setRoom] = useState<CompetitionRoom | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [currentQuestionState, setCurrentQuestionState] = useState<RoomQuestion | null>(null);
  const [roundAnswersState, setRoundAnswersState] = useState<RoomAnswer[]>([]);
  const [revealedState, setRevealedState] = useState<RoomRevealedAnswer | null>(null);
  const [allQuestions, setAllQuestions] = useState<RoomQuestion[]>([]);
  const [allRevealed, setAllRevealed] = useState<Record<number, RoomRevealedAnswer>>({});
  const [allMyAnswers, setAllMyAnswers] = useState<Record<number, RoomAnswer>>({});

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [revealTickState, setRevealTickState] = useState<{ qIndex: number; left: number }>({
    qIndex: -1,
    left: 8,
  });
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const revealTriggeredForRef = useRef<number>(-1);
  const advanceTriggeredForRef = useRef<number>(-1);
  const spokenQuestionRef = useRef<string>('');
  const spokenRevealRef = useRef<string>('');
  const spokenFinishRef = useRef<boolean>(false);
  const finalizedRef = useRef<boolean>(false);

  const {
    voiceEnabled,
    toggleVoice,
    isSpeaking,
    isLoadingAudio,
    speak,
  } = useVoiceExaminer(privateInfo?.voiceEnabled ?? true);

  // Sync authoritative server clock offset on mount
  useEffect(() => {
    void fetchServerTimeOffsetMs().then(setServerOffsetMs);
  }, []);

  // Join room automatically once profile is loaded
  useEffect(() => {
    if (!user || !profile || !roomId) return;
    void joinCompetitionRoom(roomId, profile).catch((err) => {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao entrar na sala.'
      );
    });
  }, [user, profile, roomId]);

  // Listen to room document
  useEffect(() => {
    if (!user || !roomId) return;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setErrorMsg('Sala de competição não encontrada.');
          return;
        }
        setRoom(snap.data() as CompetitionRoom);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`)
    );
    return () => unsub();
  }, [user, roomId]);

  // Listen to participants sorted by score descending
  useEffect(() => {
    if (!user || !roomId) return;
    const q = query(
      collection(db, 'rooms', roomId, 'participants'),
      where('roomId', '==', roomId),
      orderBy('score', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data() as RoomParticipant));
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `rooms/${roomId}/participants`
        )
    );
    return () => unsub();
  }, [user, roomId]);

  const qIndex = room?.currentQuestionIndex ?? -1;

  // Listen to current public question
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const qPath = `rooms/${roomId}/questions/${qIndex}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId, 'questions', String(qIndex)),
      (snap) => {
        setCurrentQuestionState(
          snap.exists() ? (snap.data() as RoomQuestion) : null
        );
      },
      (err) => handleFirestoreError(err, OperationType.GET, qPath)
    );
    return () => unsub();
  }, [user, roomId, qIndex]);

  // Listen to answers for the active round
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const q = query(
      collection(db, 'rooms', roomId, 'answers'),
      where('roomId', '==', roomId),
      where('questionIndex', '==', qIndex)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRoundAnswersState(snap.docs.map((d) => d.data() as RoomAnswer));
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/answers`)
    );
    return () => unsub();
  }, [user, roomId, qIndex]);

  // Listen to revealed answer for current round
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const rPath = `rooms/${roomId}/revealed/${qIndex}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId, 'revealed', String(qIndex)),
      (snap) => {
        setRevealedState(
          snap.exists() ? (snap.data() as RoomRevealedAnswer) : null
        );
      },
      (err) => handleFirestoreError(err, OperationType.GET, rPath)
    );
    return () => unsub();
  }, [user, roomId, qIndex]);

  const currentQuestion =
    qIndex >= 0 && currentQuestionState?.questionIndex === qIndex
      ? currentQuestionState
      : null;
  const roundAnswers = useMemo(
    () =>
      qIndex >= 0
        ? roundAnswersState.filter((a) => a.questionIndex === qIndex)
        : [],
    [roundAnswersState, qIndex]
  );
  const revealed =
    qIndex >= 0 && revealedState?.questionIndex === qIndex
      ? revealedState
      : null;

  const isHost = Boolean(user && room && room.hostId === user.uid);
  const myAnswer = useMemo(
    () => roundAnswers.find((a) => a.uid === user?.uid) || null,
    [roundAnswers, user?.uid]
  );

  // Authoritative countdown ticker during PLAYING
  useEffect(() => {
    if (room?.status !== 'PLAYING' || !room.questionEndsAtMs) return;
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(timerId);
  }, [room?.status, room?.questionEndsAtMs]);

  const remainingSeconds =
    room?.status === 'PLAYING' && room.questionEndsAtMs
      ? Math.max(
          0,
          Math.ceil((room.questionEndsAtMs - (nowMs + serverOffsetMs)) / 1000)
        )
      : 0;

  // Auto-reveal when server timer expires or all participants answered
  useEffect(() => {
    if (
      !room ||
      room.status !== 'PLAYING' ||
      !currentQuestion ||
      qIndex < 0
    ) {
      return;
    }

    const allAnswered =
      participants.length > 0 && roundAnswers.length >= participants.length;
    const serverNow = Date.now() + serverOffsetMs;
    const expiredForHost =
      room.questionEndsAtMs !== undefined && serverNow >= room.questionEndsAtMs;
    const expiredForFallback =
      room.questionEndsAtMs !== undefined &&
      serverNow >= room.questionEndsAtMs + 3500;

    const shouldTrigger =
      ((isHost || isAdmin) && (allAnswered || expiredForHost)) ||
      (!isHost && expiredForFallback);

    if (shouldTrigger && revealTriggeredForRef.current !== qIndex) {
      revealTriggeredForRef.current = qIndex;
      void revealCompetitionRound({
        room,
        question: currentQuestion,
        allAnswered,
      });
    }
  }, [
    room,
    currentQuestion,
    qIndex,
    participants.length,
    roundAnswers.length,
    remainingSeconds,
    serverOffsetMs,
    isHost,
    isAdmin,
  ]);

  // Score current participant atomically once revealed arrives
  useEffect(() => {
    if (!room || !revealed || !user || room.status !== 'ANSWER_REVEAL') return;
    const me = participants.find((p) => p.uid === user.uid);
    if (!me || me.lastScoredQuestionIndex >= revealed.questionIndex) return;

    void scoreParticipantForRound({
      roomId: room.roomId,
      uid: user.uid,
      questionIndex: revealed.questionIndex,
      correctIndex: revealed.correctIndex,
      pointsPerCorrect: room.pointsPerCorrect,
    });
  }, [room, revealed, user, participants]);

  // Voice Examiner automatic narration on new question
  useEffect(() => {
    if (room?.status !== 'PLAYING' || !currentQuestion) return;
    const key = `${room.roomId}_${currentQuestion.questionIndex}`;
    if (spokenQuestionRef.current === key) return;
    spokenQuestionRef.current = key;

    const narration = `Pergunta ${currentQuestion.questionIndex + 1} de ${room.totalQuestions}. ${currentQuestion.questionText}. Opção A: ${currentQuestion.options[0]}. Opção B: ${currentQuestion.options[1]}. Opção C: ${currentQuestion.options[2]}. Opção D: ${currentQuestion.options[3]}.`;
    void speak(narration);
  }, [room?.status, room?.roomId, room?.totalQuestions, currentQuestion, speak]);

  // Voice Examiner narration on answer reveal
  useEffect(() => {
    if (room?.status !== 'ANSWER_REVEAL' || !revealed || !currentQuestion) return;
    const key = `${room.roomId}_reveal_${revealed.questionIndex}`;
    if (spokenRevealRef.current === key) return;
    spokenRevealRef.current = key;

    const correctLetter = OPTION_LETTERS[revealed.correctIndex] || 'A';
    const correctText = currentQuestion.options[revealed.correctIndex] || '';
    const narration = `Tempo terminado! A resposta correta é a opção ${correctLetter}: ${correctText}. ${revealed.explanation}`;
    void speak(narration);
  }, [room?.status, room?.roomId, revealed, currentQuestion, speak]);

  // Auto-advance countdown during ANSWER_REVEAL (8s) for autonomous AI host flow
  const handleAdvanceRound = useCallback(async () => {
    if (!room || (!isHost && !isAdmin)) return;
    if (advanceTriggeredForRef.current === qIndex) return;
    advanceTriggeredForRef.current = qIndex;

    const nextIndex = qIndex + 1;
    if (nextIndex < room.totalQuestions) {
      await startCompetitionRound(room.roomId, nextIndex, room.timePerQuestion);
    } else {
      const qSnaps = await getDocs(
        query(
          collection(db, 'rooms', room.roomId, 'questions'),
          where('roomId', '==', room.roomId)
        )
      );
      const cats = Array.from(
        new Set(
          qSnaps.docs.map((d) => String(d.data().category || 'Código de Estrada'))
        )
      );
      await finishCompetitionRoom({ room, participants, categories: cats });
    }
  }, [room, isHost, isAdmin, qIndex, participants]);

  useEffect(() => {
    if (room?.status !== 'ANSWER_REVEAL') return;
    let left = 8;
    const id = setInterval(() => {
      left -= 1;
      setRevealTickState({ qIndex, left: Math.max(0, left) });
      if (left <= 0) {
        clearInterval(id);
        if (isHost || isAdmin) {
          void handleAdvanceRound();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [room?.status, qIndex, isHost, isAdmin, handleAdvanceRound]);

  const revealCountdown =
    room?.status === 'ANSWER_REVEAL' && revealTickState.qIndex === qIndex
      ? revealTickState.left
      : 8;

  // Load final educational review & persist results when FINISHED
  useEffect(() => {
    if (!room || room.status !== 'FINISHED' || !profile) return;

    if (!finalizedRef.current) {
      finalizedRef.current = true;
      void recordMyCompetitionResult({ room, participants, profile });
    }

    if (!spokenFinishRef.current && participants.length > 0) {
      spokenFinishRef.current = true;
      const winner = participants[0];
      void speak(
        `Competição concluída! O vencedor é ${winner.displayName} com ${winner.score} pontos. Parabéns a todos os participantes!`
      );
    }

    const loadReview = async () => {
      const [qSnaps, rSnaps, aSnaps] = await Promise.all([
        getDocs(
          query(
            collection(db, 'rooms', room.roomId, 'questions'),
            where('roomId', '==', room.roomId)
          )
        ),
        getDocs(
          query(
            collection(db, 'rooms', room.roomId, 'revealed'),
            where('roomId', '==', room.roomId)
          )
        ),
        getDocs(
          query(
            collection(db, 'rooms', room.roomId, 'answers'),
            where('roomId', '==', room.roomId)
          )
        ),
      ]);
      const qs = qSnaps.docs
        .map((d) => d.data() as RoomQuestion)
        .sort((a, b) => a.questionIndex - b.questionIndex);
      setAllQuestions(qs);

      const revMap: Record<number, RoomRevealedAnswer> = {};
      rSnaps.docs.forEach((d) => {
        const r = d.data() as RoomRevealedAnswer;
        revMap[r.questionIndex] = r;
      });
      setAllRevealed(revMap);

      const ansMap: Record<number, RoomAnswer> = {};
      aSnaps.docs.forEach((d) => {
        const a = d.data() as RoomAnswer;
        if (a.uid === profile.uid) {
          ansMap[a.questionIndex] = a;
        }
      });
      setAllMyAnswers(ansMap);
    };

    void loadReview();
  }, [room, participants, profile, speak]);

  const handleStartCompetition = async () => {
    if (!room || (!isHost && !isAdmin)) return;
    setStarting(true);
    setErrorMsg(null);
    try {
      await startCompetitionRound(room.roomId, 0, room.timePerQuestion);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao iniciar competição.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleSelectOption = async (idx: number) => {
    if (
      !room ||
      !user ||
      !profile ||
      !currentQuestion ||
      room.status !== 'PLAYING' ||
      myAnswer ||
      submitting ||
      remainingSeconds <= 0
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await submitPlayerAnswer({
        roomId: room.roomId,
        questionIndex: currentQuestion.questionIndex,
        uid: user.uid,
        displayName: profile.displayName,
        selectedIndex: idx,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível registar a resposta.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}/sala/${room.roomId}`;
    void navigator.clipboard.writeText(url);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const repeatCurrentQuestion = () => {
    if (!currentQuestion || !room) return;
    const narration = `Pergunta ${currentQuestion.questionIndex + 1}. ${currentQuestion.questionText}. Opção A: ${currentQuestion.options[0]}. Opção B: ${currentQuestion.options[1]}. Opção C: ${currentQuestion.options[2]}. Opção D: ${currentQuestion.options[3]}.`;
    void speak(narration, true);
  };

  if (!user || !profile) {
    return (
      <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">
          Inicia sessão para entrar na competição ao vivo
        </h2>
        <p className="text-sm text-slate-400">
          Precisas de uma conta ativa para sincronizar as respostas e pontuar no
          ranking.
        </p>
        <Link
          href={`/entrar?next=/sala/${roomId}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
        >
          Entrar na Plataforma
        </Link>
      </div>
    );
  }

  if (errorMsg && !room) {
    return (
      <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
        <XCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Sala Indisponível</h2>
        <p className="text-sm text-slate-400">{errorMsg}</p>
        <Link
          href="/salas"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar às Salas
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
        <div className="lg:col-span-8 h-96 bg-[#111520] rounded-2xl border border-white/[0.06]" />
        <div className="lg:col-span-4 h-96 bg-[#111520] rounded-2xl border border-white/[0.06]" />
      </div>
    );
  }

  const myParticipant = participants.find((p) => p.uid === user.uid);
  const myRank = participants.findIndex((p) => p.uid === user.uid) + 1;
  const correctInRoundCount = revealed
    ? roundAnswers.filter((a) => a.selectedIndex === revealed.correctIndex).length
    : 0;

  return (
    <div className="space-y-5">
      {/* Top Arena Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111520] border border-white/[0.08] rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/salas"
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                EM DIRECTO
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">Código {room.code}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {room.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              voiceEnabled
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-white/[0.04] border-white/10 text-slate-400'
            }`}
          >
            {voiceEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {voiceEnabled ? 'Voz Ativa' : 'Voz Muda'}
            </span>
          </button>

          {room.status === 'PLAYING' && (
            <div
              className={`min-h-[40px] px-3.5 rounded-xl flex items-center gap-2 font-mono-tabular font-bold text-base border ${
                remainingSeconds <= 10
                  ? 'bg-red-600/25 border-red-500 text-red-400'
                  : 'bg-[#171C2B] border-white/15 text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-red-500" />
              <span>
                00:{String(remainingSeconds).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-sm text-red-200 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Split Grid: Stage (Left 8 cols) + Live Room Ranking (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT STAGE */}
        <div className="lg:col-span-8 space-y-5">
          {/* STATE: WAITING / STARTING */}
          {(room.status === 'WAITING' || room.status === 'STARTING') && (
            <div className="space-y-5">
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-amber-500/30 shrink-0 bg-black">
                    <Image
                      src={trophyImg}
                      alt="Troféu Concurso"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Concurso Atual · {room.difficulty}
                    </p>
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      {room.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {room.description ||
                        'Teste os teus conhecimentos e mostra que és um condutor responsável!'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/[0.08] text-center">
                  <div>
                    <p className="text-xs text-slate-400">Perguntas</p>
                    <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                      {room.totalQuestions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tempo por pergunta</p>
                    <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                      {room.timePerQuestion}s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Pontos por acerto</p>
                    <p className="font-display text-2xl font-bold text-amber-400 tabular-nums mt-0.5">
                      +{room.pointsPerCorrect}
                    </p>
                  </div>
                </div>
              </div>

              {/* Online Participants Strip */}
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-red-500" />
                    <span>
                      Participantes Online ({participants.length} /{' '}
                      {room.maxParticipants})
                    </span>
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedCode ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Link Copiado
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        Convidar Colegas
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#171C2B] border border-white/[0.06]"
                    >
                      <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                        <Image
                          src={p.photoURL || defaultAvatarImg}
                          alt={p.displayName}
                          fill
                          sizes="24px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                        {p.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Waiting Countdown Box */}
              <div className="bg-[#111520] border border-red-500/40 rounded-2xl p-6 text-center space-y-4">
                <p className="text-sm font-medium text-slate-300">
                  Aguarda o início do jogo...
                </p>
                <div className="w-28 h-28 rounded-full border-4 border-red-600/80 mx-auto flex items-center justify-center bg-[#090C14]">
                  <span className="font-mono-tabular text-3xl font-bold text-white">
                    00:00
                  </span>
                </div>
                {isHost || isAdmin ? (
                  <button
                    onClick={handleStartCompetition}
                    disabled={starting}
                    className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {starting
                      ? 'A iniciar concurso...'
                      : 'Iniciar Competição Agora'}
                  </button>
                ) : (
                  <div className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-sm font-semibold">
                    O jogo começa em breve! Mantém-te neste ecrã.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATE: PLAYING */}
          {room.status === 'PLAYING' && currentQuestion && (
            <motion.div
              key={`q-${currentQuestion.questionIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-5"
            >
              {/* Question Header + Examiner Portrait */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Pergunta {currentQuestion.questionIndex + 1} de{' '}
                  {room.totalQuestions} · {currentQuestion.category}
                </span>
                <span className="font-mono-tabular">
                  {roundAnswers.length}/{participants.length} responderam
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[#161B29] border border-white/[0.06] rounded-2xl p-4">
                <div className="sm:col-span-4 flex items-center gap-3 sm:flex-col sm:text-center">
                  <div className="relative w-16 h-20 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <Image
                      src={examinerImg}
                      alt="Examinadora Virtual"
                      fill
                      sizes="(max-width: 640px) 64px, 112px"
                      className="object-cover"
                    />
                  </div>
                  <div className="sm:space-y-1">
                    <p className="text-xs font-semibold text-white">
                      Examinadora IA
                    </p>
                    <button
                      onClick={repeatCurrentQuestion}
                      disabled={isLoadingAudio}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium cursor-pointer whitespace-nowrap mt-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {isSpeaking ? 'A falar...' : 'Repetir Pergunta'}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-8 space-y-3">
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                    {currentQuestion.questionText}
                  </h3>
                  {currentQuestion.signType &&
                    currentQuestion.signType !== 'none' && (
                      <div className="pt-1">
                        <TrafficSignDisplay
                          signType={currentQuestion.signType}
                          size="lg"
                        />
                      </div>
                    )}
                </div>
              </div>

              {/* 4 Answer Buttons (Thumb-Friendly >= 56px height) */}
              <div className="space-y-2.5">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = myAnswer?.selectedIndex === idx;
                  const locked = Boolean(myAnswer) || remainingSeconds <= 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={locked || submitting}
                      className={`w-full min-h-[56px] px-4 py-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer disabled:cursor-default ${
                        isSelected
                          ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/20'
                          : locked
                            ? 'bg-[#151A27] border-white/[0.06] text-slate-400 opacity-75'
                            : 'bg-[#151A27] border-white/10 text-slate-100 hover:border-red-500/60 hover:bg-[#1A2133] active:scale-[0.99]'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                          isSelected
                            ? 'bg-white text-red-600 border-white'
                            : 'border-white/25 text-slate-300'
                        }`}
                      >
                        {OPTION_LETTERS[idx]}
                      </span>
                      <span className="text-sm sm:text-base font-medium leading-snug">
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  {myAnswer
                    ? `Resposta (${OPTION_LETTERS[myAnswer.selectedIndex]}) registada no servidor! A aguardar os outros participantes.`
                    : 'Responde com atenção antes do fim do tempo!'}
                </span>
                {(isHost || isAdmin) && remainingSeconds > 0 && (
                  <button
                    onClick={() =>
                      revealCompetitionRound({
                        room,
                        question: currentQuestion,
                        allAnswered: true,
                      })
                    }
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Encerrar ronda agora
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STATE: ANSWER_REVEAL */}
          {room.status === 'ANSWER_REVEAL' && currentQuestion && revealed && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`reveal-${revealed.questionIndex}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`rounded-2xl border p-5 sm:p-7 space-y-5 relative overflow-hidden ${
                  myAnswer?.selectedIndex === revealed.correctIndex
                    ? 'bg-gradient-to-b from-emerald-950/70 to-[#111520] border-emerald-500/40'
                    : 'bg-gradient-to-b from-red-950/70 to-[#111520] border-red-500/40'
                }`}
              >
                <div className="text-center space-y-2">
                  {myAnswer?.selectedIndex === revealed.correctIndex ? (
                    <>
                      <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-display text-3xl font-extrabold text-emerald-400">
                        Resposta Correta! +{room.pointsPerCorrect} Pontos
                      </h3>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-red-600/30">
                        <XCircle className="w-8 h-8" />
                      </div>
                      <h3 className="font-display text-3xl font-extrabold text-red-400">
                        {myAnswer ? 'Resposta Errada! 0 Pontos' : 'Tempo Esgotado! 0 Pontos'}
                      </h3>
                    </>
                  )}
                  <p className="text-xs text-slate-300">
                    Resposta oficial:{' '}
                    <strong className="text-white">
                      {OPTION_LETTERS[revealed.correctIndex]}.{' '}
                      {currentQuestion.options[revealed.correctIndex]}
                    </strong>
                  </p>
                </div>

                {currentQuestion.signType &&
                  currentQuestion.signType !== 'none' && (
                    <TrafficSignDisplay
                      signType={currentQuestion.signType}
                      size="md"
                    />
                  )}

                <div className="bg-[#0B0E17]/90 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Explicação da Examinadora IA
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {revealed.explanation}
                  </p>
                  <p className="text-xs text-slate-400 pt-1">
                    Referência: {revealed.legalReference}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-300 font-medium">
                    Acertaram: {correctInRoundCount} de {participants.length}{' '}
                    participantes (
                    {participants.length > 0
                      ? Math.round(
                          (correctInRoundCount / participants.length) * 100
                        )
                      : 0}
                    %)
                  </span>

                  {isHost || isAdmin ? (
                    <button
                      onClick={handleAdvanceRound}
                      className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {qIndex + 1 < room.totalQuestions
                          ? `Próxima Pergunta (${revealCountdown}s)`
                          : `Ver Pódio Final (${revealCountdown}s)`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-amber-300 font-semibold font-mono-tabular">
                      Próxima pergunta em {revealCountdown}s...
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* STATE: FINISHED */}
          {room.status === 'FINISHED' && (
            <div className="space-y-6">
              <div className="bg-[#111520] border border-amber-500/30 rounded-2xl p-6 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border border-amber-400/40">
                  <Image
                    src={trophyImg}
                    alt="Vencedor"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                    Competição Concluída
                  </p>
                  <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-1">
                    {participants[0]?.displayName || 'Vencedor'} é o Campeão!
                  </h3>
                </div>

                {/* Top 3 Podium Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {participants.slice(0, 3).map((p, idx) => (
                    <div
                      key={p.uid}
                      className={`p-4 rounded-xl border text-center space-y-2 ${
                        idx === 0
                          ? 'bg-amber-500/15 border-amber-400/50'
                          : idx === 1
                            ? 'bg-slate-400/10 border-slate-400/30'
                            : 'bg-orange-700/15 border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                        {idx === 0 ? (
                          <Crown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Medal className="w-4 h-4 text-slate-300" />
                        )}
                        <span>{idx + 1}.º Lugar</span>
                      </div>
                      <p className="text-sm font-bold text-white truncate">
                        {p.displayName}
                      </p>
                      <p className="font-mono-tabular text-lg font-extrabold text-amber-400">
                        {p.score} pts
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.correctCount} certas · {p.wrongCount} erradas
                      </p>
                    </div>
                  ))}
                </div>

                {room.aiSummary && (
                  <div className="bg-[#0B0E17] border border-white/10 rounded-xl p-4 text-left space-y-1.5">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Resumo da Examinadora IA
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {room.aiSummary}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href="/salas"
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
                  >
                    Nova Competição
                  </Link>
                  <Link
                    href="/ranking"
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
                  >
                    Ver Ranking Geral
                  </Link>
                </div>
              </div>

              {/* Educational Review of All Questions */}
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                <h4 className="text-lg font-bold text-white">
                  Resumo Educativo das Perguntas
                </h4>
                <div className="space-y-3">
                  {allQuestions.map((q) => {
                    const rev = allRevealed[q.questionIndex];
                    const ans = allMyAnswers[q.questionIndex];
                    const ok =
                      rev && ans && ans.selectedIndex === rev.correctIndex;
                    return (
                      <div
                        key={q.questionIndex}
                        className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {q.questionIndex + 1}. {q.questionText}
                          </p>
                          {rev && (
                            <span
                              className={`text-xs font-bold shrink-0 ${
                                ok ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {ok ? 'Acertou' : 'Errou'}
                            </span>
                          )}
                        </div>
                        {rev && (
                          <>
                            <p className="text-xs text-emerald-300">
                              Correta: {OPTION_LETTERS[rev.correctIndex]}.{' '}
                              {q.options[rev.correctIndex]}
                            </p>
                            <p className="text-xs text-slate-400">
                              {rev.explanation}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: LIVE ROOM RANKING */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Ranking da Sala
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono-tabular">
                {participants.length} ativos
              </span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {participants.map((p, idx) => {
                const isMe = p.uid === user.uid;
                return (
                  <div
                    key={p.uid}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
                      isMe
                        ? 'bg-red-600/15 border-red-500/40'
                        : idx === 0
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-[#161B29] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0
                            ? 'bg-amber-400 text-black'
                            : idx === 1
                              ? 'bg-slate-300 text-black'
                              : idx === 2
                                ? 'bg-orange-400 text-black'
                                : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0">
                        <Image
                          src={p.photoURL || defaultAvatarImg}
                          alt={p.displayName}
                          fill
                          sizes="28px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">
                        {p.displayName}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs sm:text-sm font-bold text-amber-400 shrink-0">
                      {p.score} pts
                    </span>
                  </div>
                );
              })}
            </div>

            {myParticipant && (
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400">A tua pontuação</p>
                  <p className="text-base font-bold text-amber-400 font-mono-tabular">
                    {myParticipant.score} pts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">Posição atual</p>
                  <p className="text-base font-bold text-white font-mono-tabular">
                    #{myRank > 0 ? myRank : '-'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-white font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sincronização Autoritativa</span>
            </div>
            <p>
              Código da sala:{' '}
              <button
                onClick={handleCopyInvite}
                className="font-mono-tabular font-bold text-white inline-flex items-center gap-1 hover:text-red-400 cursor-pointer"
              >
                {room.code}
                <Copy className="w-3 h-3" />
              </button>
            </p>
            <p>
              O temporizador e a verificação de respostas são controlados
              exclusivamente no servidor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
