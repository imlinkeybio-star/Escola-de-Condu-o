'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Lock,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
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
  ParticipantStatus,
  RoomAnswer,
  RoomParticipant,
  RoomQuestion,
  RoomRevealedAnswer,
} from '@/lib/types';
import {
  advancePlayerQuestion,
  fetchServerTimeOffsetMs,
  finishPlayerCompetition,
  joinCompetitionRoom,
  revealAndScorePlayerRound,
  startPlayerGame,
  submitPlayerAnswer,
} from '@/lib/firestore-service';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useVoiceExaminer } from '@/hooks/useVoiceExaminer';
import { TrafficSignDisplay } from './TrafficSignDisplay';
import { toUserFriendlyError } from '@/lib/error-messages';
import {
  formatNumberLocale,
  tFormat,
  translateCategory,
  translateDifficulty,
} from '@/lib/i18n';
import examinerImg from '@/src/assets/images/virtual_examiner_angola_1795615139196.jpg';
import trophyImg from '@/src/assets/images/trophy_gold_emblem_1795615139789.jpg';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function LiveCompetitionArena({ roomId }: { roomId: string }) {
  const { user, profile, privateInfo } = useAuth();
  const { language, dict } = useLanguage();

  const getParticipantStatusLabel = (
    status?: ParticipantStatus
  ): {
    label: string;
    className: string;
  } => {
    switch (status) {
      case 'FINISHED':
        return {
          label: dict.arena.statusFinished,
          className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'PLAYING':
      case 'ANSWER_REVEAL':
        return {
          label: dict.arena.statusPlaying,
          className: 'bg-red-500/15 text-red-300 border-red-500/30',
        };
      default:
        return {
          label: dict.arena.statusWaiting,
          className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
    }
  };
  const [room, setRoom] = useState<CompetitionRoom | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [currentQuestionState, setCurrentQuestionState] =
    useState<RoomQuestion | null>(null);
  const [myAnswerState, setMyAnswerState] = useState<RoomAnswer | null>(null);
  const [revealedState, setRevealedState] = useState<RoomRevealedAnswer | null>(
    null
  );
  const [allQuestions, setAllQuestions] = useState<RoomQuestion[]>([]);
  const [allRevealed, setAllRevealed] = useState<
    Record<number, RoomRevealedAnswer>
  >({});
  const [allMyAnswers, setAllMyAnswers] = useState<Record<number, RoomAnswer>>(
    {}
  );

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [revealTickState, setRevealTickState] = useState<{
    qIndex: number;
    left: number;
  }>({ qIndex: -1, left: 8 });
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<
    'idle' | 'generating' | 'completed' | 'failed'
  >('idle');
  const [advancing, setAdvancing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const startingLockRef = useRef(false);
  const revealTriggeredForRef = useRef<number>(-1);
  const advanceTriggeredForRef = useRef<number>(-1);
  const spokenQuestionRef = useRef<string>('');
  const spokenRevealRef = useRef<string>('');
  const spokenFinishRef = useRef<boolean>(false);

  const {
    voiceEnabled,
    toggleVoice,
    isSpeaking,
    isLoadingAudio,
    speak,
  } = useVoiceExaminer(privateInfo?.voiceEnabled ?? true);

  useEffect(() => {
    void fetchServerTimeOffsetMs().then(setServerOffsetMs);
  }, []);

  useEffect(() => {
    if (!user || !profile || !roomId) return;
    void joinCompetitionRoom(roomId, profile).catch((err) => {
      setErrorMsg(toUserFriendlyError(err, dict.arena.joinError));
    });
  }, [user, profile, roomId, dict.arena.joinError]);

  useEffect(() => {
    if (!user || !roomId) return;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setErrorMsg(dict.arena.roomNotFound);
          return;
        }
        setRoom(snap.data() as CompetitionRoom);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`)
    );
    return () => unsub();
  }, [user, roomId, dict.arena.roomNotFound]);

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

  const myParticipant = participants.find((p) => p.uid === user?.uid) || null;
  const myStatus: ParticipantStatus = myParticipant?.status || 'WAITING';
  const qIndex = myParticipant?.currentQuestionIndex ?? -1;
  const finishedCount = Math.max(
    typeof room?.finishedCount === 'number' ? room.finishedCount : 0,
    participants.filter((p) => p.status === 'FINISHED').length
  );
  const isRoomClosed =
    room?.status === 'FINISHED' || finishedCount >= 100;

  // Listen to this player's current AI-generated question
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const qDocId = `${user.uid}_${qIndex}`;
    const qPath = `rooms/${roomId}/player_questions/${qDocId}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId, 'player_questions', qDocId),
      (snap) => {
        setCurrentQuestionState(
          snap.exists() ? (snap.data() as RoomQuestion) : null
        );
      },
      (err) => handleFirestoreError(err, OperationType.GET, qPath)
    );
    return () => unsub();
  }, [user, roomId, qIndex]);

  // Listen to this player's answer for current round
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const ansId = `${qIndex}_${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId, 'answers', ansId),
      (snap) => {
        setMyAnswerState(snap.exists() ? (snap.data() as RoomAnswer) : null);
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/answers/${ansId}`)
    );
    return () => unsub();
  }, [user, roomId, qIndex]);

  // Listen to this player's revealed answer for current round
  useEffect(() => {
    if (!user || !roomId || qIndex < 0) return;
    const rDocId = `${user.uid}_${qIndex}`;
    const rPath = `rooms/${roomId}/player_revealed/${rDocId}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId, 'player_revealed', rDocId),
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
  const myAnswer =
    qIndex >= 0 && myAnswerState?.questionIndex === qIndex
      ? myAnswerState
      : null;
  const revealed =
    qIndex >= 0 && revealedState?.questionIndex === qIndex
      ? revealedState
      : null;

  // Authoritative countdown ticker during player's PLAYING state
  useEffect(() => {
    if (
      myStatus !== 'PLAYING' ||
      isRoomClosed ||
      !myParticipant?.questionEndsAtMs
    ) {
      return;
    }
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(timerId);
  }, [myStatus, isRoomClosed, myParticipant?.questionEndsAtMs]);

  const remainingSeconds =
    myStatus === 'PLAYING' && !isRoomClosed && myParticipant?.questionEndsAtMs
      ? Math.max(
          0,
          Math.ceil(
            (myParticipant.questionEndsAtMs - (nowMs + serverOffsetMs)) / 1000
          )
        )
      : 0;

  // Auto-reveal & score when player timer expires (or right after answering)
  useEffect(() => {
    if (
      !room ||
      !myParticipant ||
      myStatus !== 'PLAYING' ||
      isRoomClosed ||
      !currentQuestion ||
      qIndex < 0
    ) {
      return;
    }

    const serverNow = Date.now() + serverOffsetMs;
    const expired =
      myParticipant.questionEndsAtMs !== undefined &&
      serverNow >= myParticipant.questionEndsAtMs;
    const shouldReveal = Boolean(myAnswer) || expired;

    if (shouldReveal && revealTriggeredForRef.current !== qIndex) {
      revealTriggeredForRef.current = qIndex;
      void revealAndScorePlayerRound({
        room,
        participant: myParticipant,
        question: currentQuestion,
      });
    }
  }, [
    room,
    myParticipant,
    myStatus,
    isRoomClosed,
    currentQuestion,
    qIndex,
    myAnswer,
    remainingSeconds,
    serverOffsetMs,
  ]);

  // Voice Examiner narration on new question
  useEffect(() => {
    if (myStatus !== 'PLAYING' || isRoomClosed || !currentQuestion || !room) {
      return;
    }
    const key = `${room.roomId}_${currentQuestion.questionIndex}`;
    if (spokenQuestionRef.current === key) return;
    spokenQuestionRef.current = key;

    const narration = tFormat(dict.arena.speechQuestion, {
      idx: currentQuestion.questionIndex + 1,
      total: room.totalQuestions,
      text: currentQuestion.questionText,
      a: currentQuestion.options[0],
      b: currentQuestion.options[1],
      c: currentQuestion.options[2],
      d: currentQuestion.options[3],
    });
    void speak(narration);
  }, [myStatus, isRoomClosed, room, currentQuestion, speak, dict.arena.speechQuestion]);

  // Voice Examiner narration on answer reveal
  useEffect(() => {
    if (
      myStatus !== 'ANSWER_REVEAL' ||
      isRoomClosed ||
      !revealed ||
      !currentQuestion ||
      !room
    ) {
      return;
    }
    const key = `${room.roomId}_reveal_${revealed.questionIndex}`;
    if (spokenRevealRef.current === key) return;
    spokenRevealRef.current = key;

    const correctLetter = OPTION_LETTERS[revealed.correctIndex] || 'A';
    const correctText = currentQuestion.options[revealed.correctIndex] || '';
    const narration = tFormat(dict.arena.speechReveal, {
      letter: correctLetter,
      text: correctText,
      explanation: revealed.explanation,
    });
    void speak(narration);
  }, [myStatus, isRoomClosed, room, revealed, currentQuestion, speak, dict.arena.speechReveal]);

  // Advance to next question or finish ONLY for this player
  const handleAdvanceRound = useCallback(async () => {
    if (!room || !profile || !myParticipant || advancing) return;
    if (myParticipant.status !== 'ANSWER_REVEAL') return;
    if (advanceTriggeredForRef.current === qIndex) return;
    advanceTriggeredForRef.current = qIndex;
    setAdvancing(true);
    setErrorMsg(null);

    try {
      const nextIndex = qIndex + 1;
      if (nextIndex < room.totalQuestions) {
        await advancePlayerQuestion(room, nextIndex);
      } else {
        await finishPlayerCompetition({ room, profile });
      }
    } catch (err) {
      advanceTriggeredForRef.current = -1;
      setErrorMsg(toUserFriendlyError(err, dict.arena.advanceError));
    } finally {
      setAdvancing(false);
    }
  }, [room, profile, myParticipant, advancing, qIndex, dict.arena.advanceError]);

  // 8-second auto-advance countdown during ANSWER_REVEAL
  useEffect(() => {
    if (myStatus !== 'ANSWER_REVEAL' || isRoomClosed) return;
    let left = 8;
    const id = setInterval(() => {
      left -= 1;
      setRevealTickState({ qIndex, left: Math.max(0, left) });
      if (left <= 0) {
        clearInterval(id);
        void handleAdvanceRound();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [myStatus, isRoomClosed, qIndex, handleAdvanceRound]);

  const revealCountdown =
    myStatus === 'ANSWER_REVEAL' && revealTickState.qIndex === qIndex
      ? revealTickState.left
      : 8;

  // Load this student's educational review when their participation finishes or room hits 100 finishers
  useEffect(() => {
    if (!room || !user || (!isRoomClosed && myStatus !== 'FINISHED')) return;

    if (myStatus === 'FINISHED' && !spokenFinishRef.current && myParticipant) {
      spokenFinishRef.current = true;
      void speak(
        tFormat(dict.arena.speechFinish, {
          name: myParticipant.displayName,
          score: myParticipant.score,
          correct: myParticipant.correctCount,
        })
      );
    }

    const loadMyReview = async () => {
      try {
        const [qSnaps, rSnaps, aSnaps] = await Promise.all([
          getDocs(
            query(
              collection(db, 'rooms', room.roomId, 'player_questions'),
              where('uid', '==', user.uid)
            )
          ),
          getDocs(
            query(
              collection(db, 'rooms', room.roomId, 'player_revealed'),
              where('uid', '==', user.uid)
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
          if (a.uid === user.uid) {
            ansMap[a.questionIndex] = a;
          }
        });
        setAllMyAnswers(ansMap);
      } catch (err) {
        console.warn('Erro ao carregar revisão pessoal:', err);
      }
    };

    void loadMyReview();
  }, [room, user, myStatus, isRoomClosed, myParticipant, speak, dict.arena.speechFinish]);

  const handleStartMyGame = async () => {
    if (!room || starting || startingLockRef.current || isRoomClosed) return;
    startingLockRef.current = true;
    setStarting(true);
    setGenerationStatus('generating');
    setErrorMsg(null);
    revealTriggeredForRef.current = -1;
    advanceTriggeredForRef.current = -1;
    try {
      await startPlayerGame(room);
      setGenerationStatus('completed');
    } catch (err) {
      setGenerationStatus('failed');
      setErrorMsg(toUserFriendlyError(err, dict.arena.startError));
    } finally {
      startingLockRef.current = false;
      setStarting(false);
    }
  };

  const handleSelectOption = async (idx: number) => {
    if (
      !room ||
      !user ||
      !profile ||
      !myParticipant ||
      !currentQuestion ||
      myStatus !== 'PLAYING' ||
      isRoomClosed ||
      myAnswer ||
      submitting ||
      remainingSeconds <= 0
    ) {
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await submitPlayerAnswer({
        roomId: room.roomId,
        questionIndex: currentQuestion.questionIndex,
        uid: user.uid,
        displayName: profile.displayName,
        selectedIndex: idx,
      });
    } catch (err) {
      setErrorMsg(toUserFriendlyError(err, dict.arena.submitError));
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
    const narration = tFormat(dict.arena.speechRepeat, {
      idx: currentQuestion.questionIndex + 1,
      text: currentQuestion.questionText,
      a: currentQuestion.options[0],
      b: currentQuestion.options[1],
      c: currentQuestion.options[2],
      d: currentQuestion.options[3],
    });
    void speak(narration, true);
  };

  if (!user || !profile) {
    return (
      <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">
          {dict.arena.loginTitle}
        </h2>
        <p className="text-sm text-slate-400">
          {dict.arena.loginDesc}
        </p>
        <Link
          href={`/entrar?next=/sala/${roomId}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
        >
          {dict.arena.loginBtn}
        </Link>
      </div>
    );
  }

  if (errorMsg && !room) {
    return (
      <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
        <XCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">{dict.arena.unavailableTitle}</h2>
        <p className="text-sm text-slate-400">{errorMsg}</p>
        <Link
          href="/salas"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {dict.arena.backToRooms}
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

  const myRank = participants.findIndex((p) => p.uid === user.uid) + 1;
  const showFinishedOrClosedView = myStatus === 'FINISHED' || isRoomClosed;
  const myAccuracy =
    myParticipant && room.totalQuestions > 0
      ? Math.round((myParticipant.correctCount / room.totalQuestions) * 100)
      : 0;

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Top Arena Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111520] border border-white/[0.08] rounded-2xl px-4 py-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/salas"
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-300 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
              {isRoomClosed ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-300 tabular-nums">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  {tFormat(dict.arena.rankingClosed, { count: finishedCount })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {tFormat(dict.arena.rankingLive, { count: finishedCount })}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {tFormat(dict.arena.codeLabel, { code: room.code })}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {room.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleVoice}
            aria-label={voiceEnabled ? dict.arena.muteVoice : dict.arena.unmuteVoice}
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
              {voiceEnabled ? dict.arena.voiceOn : dict.arena.voiceOff}
            </span>
          </button>

          {myStatus === 'PLAYING' && !isRoomClosed && (
            <div
              className={`min-h-[40px] px-3.5 rounded-xl flex items-center gap-2 font-mono-tabular font-bold text-base border ${
                remainingSeconds <= 10
                  ? 'bg-red-600/25 border-red-500 text-red-400'
                  : 'bg-[#171C2B] border-white/15 text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-red-500" />
              <span>00:{String(remainingSeconds).padStart(2, '0')}</span>
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
            {dict.common.close}
          </button>
        </div>
      )}

      {/* Main Split Grid: Stage (Left 8 cols) + Live Room Ranking (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT STAGE */}
        <div className="lg:col-span-8 space-y-5">
          {/* VIEW 1: PLAYER FINISHED OR ROOM REACHED 100 FINISHERS */}
          {showFinishedOrClosedView && (
            <div className="space-y-6">
              <div className="bg-[#111520] border border-amber-500/30 rounded-2xl p-6 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border border-amber-400/40">
                  <Image
                    src={trophyImg}
                    alt={dict.arena.shellTitle}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400 tabular-nums">
                    {isRoomClosed
                      ? tFormat(dict.arena.competitionClosed, { count: finishedCount })
                      : tFormat(dict.arena.yourProofEnded, { count: finishedCount })}
                  </p>
                  <h3 className="font-display text-2xl sm:text-4xl font-extrabold text-white break-words">
                    {myStatus === 'FINISHED'
                      ? tFormat(dict.arena.youScored, {
                          score: formatNumberLocale(language, myParticipant?.score ?? 0),
                        })
                      : dict.arena.roomRankingClosed}
                  </h3>
                  <p className="text-sm text-slate-300 max-w-xl mx-auto">
                    {isRoomClosed
                      ? finishedCount >= 100
                        ? dict.arena.closed100Msg
                        : tFormat(dict.arena.closedWithCountMsg, { count: finishedCount })
                      : dict.arena.closedForYouMsg}
                  </p>
                </div>

                {myParticipant && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06]">
                      <p className="text-xs text-slate-400">{dict.arena.scoreLabel}</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-amber-400 mt-1">
                        {formatNumberLocale(language, myParticipant.score)} {dict.common.pts}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06]">
                      <p className="text-xs text-slate-400">{dict.arena.currentRankLabel}</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-white mt-1">
                        #{myRank > 0 ? myRank : '-'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06]">
                      <p className="text-xs text-slate-400">{dict.arena.rightWrongLabel}</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-emerald-400 mt-1">
                        {myParticipant.correctCount}/{myParticipant.wrongCount}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06]">
                      <p className="text-xs text-slate-400">{dict.arena.accuracyLabel}</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-sky-400 mt-1">
                        {myAccuracy}%
                      </p>
                    </div>
                  </div>
                )}

                {participants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {participants.slice(0, 3).map((p, idx) => (
                      <div
                        key={p.uid}
                        className={`p-3.5 rounded-xl border text-center space-y-1 ${
                          idx === 0
                            ? 'bg-amber-500/15 border-amber-400/50'
                            : idx === 1
                              ? 'bg-slate-400/10 border-slate-400/30'
                              : 'bg-orange-700/15 border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>{tFormat(dict.arena.placeOrdinal, { n: idx + 1 })}</span>
                        </div>
                        <p className="text-sm font-bold text-white truncate">
                          {p.displayName}
                        </p>
                        <p className="font-mono-tabular text-base font-extrabold text-amber-400">
                          {formatNumberLocale(language, p.score)} {dict.common.pts}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href="/salas"
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
                  >
                    {dict.arena.exploreOtherRooms}
                  </Link>
                  <Link
                    href="/ranking"
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
                  >
                    {dict.arena.viewGlobalRanking}
                  </Link>
                </div>
              </div>

              {allQuestions.length > 0 && (
                <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
                  <h4 className="text-lg font-bold text-white">
                    {dict.arena.reviewHeading}
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
                                {ok ? dict.arena.correctTag : dict.arena.wrongTag}
                              </span>
                            )}
                          </div>
                          {rev && (
                            <>
                              <p className="text-xs text-emerald-300">
                                {dict.arena.officialCorrectPrefix} {OPTION_LETTERS[rev.correctIndex]}.{' '}
                                {q.options[rev.correctIndex]}
                              </p>
                              <p className="text-xs text-slate-300">
                                {rev.explanation}
                              </p>
                              <p className="text-xs text-slate-500">
                                {rev.legalReference}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: WAITING FOR THIS STUDENT TO START */}
          {!showFinishedOrClosedView && myStatus === 'WAITING' && (
            <div className="space-y-5">
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-amber-500/30 shrink-0 bg-black">
                    <Image
                      src={trophyImg}
                      alt={dict.arena.shellTitle}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      {tFormat(dict.arena.waitingSubtitle, {
                        diff: translateDifficulty(language, room.difficulty),
                        cat: translateCategory(language, room.category),
                      })}
                    </p>
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      {room.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {room.description || dict.salas.defaultRoomDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.08] text-center">
                  <div>
                    <p className="text-xs text-slate-400">{dict.arena.aiQuestionsLabel}</p>
                    <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                      {room.totalQuestions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{dict.arena.timePerQLabel}</p>
                    <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                      {room.timePerQuestion}s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{dict.arena.pointsPerCorrectLabel}</p>
                    <p className="font-display text-2xl font-bold text-amber-400 tabular-nums mt-0.5">
                      +{room.pointsPerCorrect}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{dict.arena.finalistsLabel}</p>
                    <p className="font-display text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">
                      {finishedCount}/100
                    </p>
                  </div>
                </div>
              </div>

              {/* Waiting Participants & Share */}
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-red-500" />
                    <span>
                      {tFormat(dict.arena.studentsInRoom, {
                        count: participants.length,
                        max: room.maxParticipants,
                      })}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedCode ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {dict.arena.linkCopied}
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        {dict.arena.invitePeers}
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => {
                    const st = getParticipantStatusLabel(p.status);
                    return (
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
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[110px]">
                          {p.displayName}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Start Box */}
              <div className="bg-[#111520] border border-red-500/40 rounded-2xl p-6 text-center space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  {dict.landing.angolaHighwayCode}
                </div>
                <h4 className="text-xl font-bold text-white">
                  {dict.arena.readyHeading}
                </h4>
                <p className="text-sm text-slate-300 max-w-lg mx-auto">
                  {tFormat(dict.arena.readyDesc, { count: room.totalQuestions })}
                </p>
                <button
                  onClick={handleStartMyGame}
                  disabled={starting}
                  className="w-full sm:w-auto min-h-[50px] px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {starting ? dict.arena.generatingAiBtn : dict.arena.startMyGameBtn}
                </button>
                {generationStatus === 'failed' && errorMsg && (
                  <p className="text-xs text-red-300 font-medium break-words">
                    {errorMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: PLAYER PLAYING */}
          {!showFinishedOrClosedView &&
            myStatus === 'PLAYING' &&
            currentQuestion && (
              <motion.div
                key={`q-${currentQuestion.questionIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-5"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {tFormat(dict.arena.qProgress, {
                      current: currentQuestion.questionIndex + 1,
                      total: room.totalQuestions,
                      cat: translateCategory(language, currentQuestion.category),
                    })}
                  </span>
                  <span className="font-mono-tabular text-amber-400">
                    {tFormat(dict.arena.finalistsShort, { count: finishedCount })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[#161B29] border border-white/[0.06] rounded-2xl p-4">
                  <div className="sm:col-span-4 flex items-center gap-3 sm:flex-col sm:text-center">
                    <div className="relative w-16 h-20 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <Image
                        src={examinerImg}
                        alt={dict.arena.examinerAiLabel}
                        fill
                        sizes="(max-width: 640px) 64px, 112px"
                        className="object-cover"
                      />
                    </div>
                    <div className="sm:space-y-1">
                      <p className="text-xs font-semibold text-white">
                        {dict.arena.examinerAiLabel}
                      </p>
                      <button
                        onClick={repeatCurrentQuestion}
                        disabled={isLoadingAudio}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium cursor-pointer whitespace-nowrap mt-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {isSpeaking ? dict.arena.speakingBtn : dict.arena.repeatQBtn}
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

                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = myAnswer?.selectedIndex === idx;
                    const locked = Boolean(myAnswer) || remainingSeconds <= 0;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={locked || submitting}
                        className={`w-full min-h-[56px] px-4 py-3.5 rounded-xl border text-start flex items-center gap-3.5 transition-all cursor-pointer disabled:cursor-default min-w-0 ${
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
                        <span className="text-sm sm:text-base font-medium leading-snug break-words min-w-0 flex-1">
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
                      ? tFormat(dict.arena.answerRecorded, {
                          letter: OPTION_LETTERS[myAnswer.selectedIndex],
                        })
                      : dict.arena.chooseBeforeTimer}
                  </span>
                </div>
              </motion.div>
            )}

          {/* VIEW 4: PLAYER ANSWER REVEAL */}
          {!showFinishedOrClosedView &&
            myStatus === 'ANSWER_REVEAL' &&
            currentQuestion &&
            revealed && (
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
                          {tFormat(dict.arena.correctAnswerHeading, {
                            pts: room.pointsPerCorrect,
                          })}
                        </h3>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-red-600/30">
                          <XCircle className="w-8 h-8" />
                        </div>
                        <h3 className="font-display text-3xl font-extrabold text-red-400">
                          {myAnswer
                            ? dict.arena.wrongAnswerHeading
                            : dict.arena.timeUpHeading}
                        </h3>
                      </>
                    )}
                    <p className="text-xs text-slate-300">
                      {dict.arena.officialAnswerLabel}{' '}
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
                      {dict.arena.aiExplanationHeading}
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {revealed.explanation}
                    </p>
                    <p className="text-xs text-slate-400 pt-1">
                      {tFormat(dict.arena.legalRefLabel, {
                        ref: revealed.legalReference,
                      })}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-300 font-medium">
                      {tFormat(dict.arena.qCompleted, {
                        current: qIndex + 1,
                        total: room.totalQuestions,
                      })}
                    </span>

                    <button
                      onClick={handleAdvanceRound}
                      disabled={advancing}
                      className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {qIndex + 1 < room.totalQuestions
                          ? tFormat(dict.arena.nextQCountdown, { sec: revealCountdown })
                          : tFormat(dict.arena.viewResultsCountdown, { sec: revealCountdown })}
                      </span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
        </div>

        {/* RIGHT SIDEBAR: LIVE ROOM RANKING */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {dict.arena.roomRankingHeading}
                </h3>
              </div>
              <span className="text-xs text-amber-400 font-mono-tabular font-semibold">
                {tFormat(dict.arena.finalistsShort, { count: finishedCount })}
              </span>
            </div>

            <div className="space-y-2 max-h-[440px] overflow-y-auto pe-1">
              {participants.map((p, idx) => {
                const isMe = p.uid === user.uid;
                const st = getParticipantStatusLabel(p.status);
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
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {p.displayName}
                        </p>
                        <p className="text-[10px] text-slate-400">{st.label}</p>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-xs sm:text-sm font-bold text-amber-400 shrink-0">
                      {formatNumberLocale(language, p.score)} {dict.common.pts}
                    </span>
                  </div>
                );
              })}
            </div>

            {myParticipant && (
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400">{dict.arena.yourScoreLabel}</p>
                  <p className="text-base font-bold text-amber-400 font-mono-tabular">
                    {formatNumberLocale(language, myParticipant.score)} {dict.common.pts}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-slate-400">{dict.arena.currentRankLabel}</p>
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
              <span>{dict.arena.roomRulesHeading}</span>
            </div>
            <p>
              {dict.arena.roomCodeText}{' '}
              <button
                onClick={handleCopyInvite}
                className="font-mono-tabular font-bold text-white inline-flex items-center gap-1 hover:text-red-400 cursor-pointer"
              >
                {room.code}
                <Copy className="w-3 h-3" />
              </button>
            </p>
            <p>
              {dict.arena.roomRulesDesc}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
