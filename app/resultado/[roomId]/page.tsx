'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Trophy, XCircle } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import {
  CompetitionRoom,
  RoomAnswer,
  RoomParticipant,
  RoomQuestion,
  RoomRevealedAnswer,
} from '@/lib/types';
import { formatNumberLocale, tFormat } from '@/lib/i18n';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function ResultadoPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { user } = useAuth();
  const { language, dict } = useLanguage();
  const [room, setRoom] = useState<CompetitionRoom | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [questions, setQuestions] = useState<RoomQuestion[]>([]);
  const [revealedMap, setRevealedMap] = useState<
    Record<number, RoomRevealedAnswer>
  >({});
  const [myAnswers, setMyAnswers] = useState<Record<number, RoomAnswer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !roomId) return;
    const load = async () => {
      try {
        const [roomSnap, partSnaps, pqSnaps, prSnaps, aSnaps] =
          await Promise.all([
            getDoc(doc(db, 'rooms', roomId)),
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'participants'),
                where('roomId', '==', roomId),
                orderBy('score', 'desc')
              )
            ),
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'player_questions'),
                where('uid', '==', user.uid)
              )
            ),
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'player_revealed'),
                where('uid', '==', user.uid)
              )
            ),
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'answers'),
                where('roomId', '==', roomId)
              )
            ),
          ]);

        let qDocs = pqSnaps.docs;
        let rDocs = prSnaps.docs;
        if (qDocs.length === 0) {
          const [legacyQ, legacyR] = await Promise.all([
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'questions'),
                where('roomId', '==', roomId)
              )
            ),
            getDocs(
              query(
                collection(db, 'rooms', roomId, 'revealed'),
                where('roomId', '==', roomId)
              )
            ),
          ]);
          qDocs = legacyQ.docs;
          rDocs = legacyR.docs;
        }

        if (roomSnap.exists()) setRoom(roomSnap.data() as CompetitionRoom);
        setParticipants(partSnaps.docs.map((d) => d.data() as RoomParticipant));
        setQuestions(
          qDocs
            .map((d) => d.data() as RoomQuestion)
            .sort((a, b) => a.questionIndex - b.questionIndex)
        );
        const rMap: Record<number, RoomRevealedAnswer> = {};
        rDocs.forEach((d) => {
          const item = d.data() as RoomRevealedAnswer;
          rMap[item.questionIndex] = item;
        });
        setRevealedMap(rMap);

        const aMap: Record<number, RoomAnswer> = {};
        aSnaps.docs.forEach((d) => {
          const item = d.data() as RoomAnswer;
          if (item.uid === user.uid) aMap[item.questionIndex] = item;
        });
        setMyAnswers(aMap);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user, roomId]);

  return (
    <AppShell title={dict.results.shellTitle}>
      {loading ? (
        <div className="h-64 bg-[#111520] rounded-2xl animate-pulse" />
      ) : !room ? (
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-300">{dict.results.notFound}</p>
        </div>
      ) : (
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/historico"
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {dict.results.backToHistory}
            </Link>
            <span className="text-xs font-mono-tabular text-slate-400">
              {tFormat(dict.results.roomCodeLabel, {
                code: room.code,
                fin: Math.max(
                  room.finishedCount ?? 0,
                  participants.filter((p) => p.status === 'FINISHED').length
                ),
              })}
            </span>
          </div>

          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
              <h2 className="text-xl font-bold text-white break-words min-w-0">
                {room.title}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {participants.slice(0, 3).map((p, idx) => (
                <div
                  key={p.uid}
                  className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06] flex items-center justify-between gap-3 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-amber-400 font-bold">
                      {tFormat(dict.arena.placeOrdinal, { n: idx + 1 })}
                    </p>
                    <p className="text-sm font-bold text-white truncate">
                      {p.displayName}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-bold text-amber-400 shrink-0">
                    {formatNumberLocale(language, p.score)} {dict.common.pts}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {dict.results.detailHeading}
            </h3>
            <div className="space-y-3">
              {questions.map((q) => {
                const rev = revealedMap[q.questionIndex];
                const ans = myAnswers[q.questionIndex];
                const ok = rev && ans && ans.selectedIndex === rev.correctIndex;
                return (
                  <div
                    key={q.questionIndex}
                    className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        {q.questionIndex + 1}. {q.questionText}
                      </p>
                      {rev &&
                        (ok ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                        ))}
                    </div>
                    {rev && (
                      <>
                        <p className="text-xs text-emerald-400">
                          {dict.results.correctPrefix} {LETTERS[rev.correctIndex]}.{' '}
                          {q.options[rev.correctIndex]}
                        </p>
                        <p className="text-xs text-slate-300">
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
    </AppShell>
  );
}
