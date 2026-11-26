'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Crown, Medal, Trophy } from 'lucide-react';
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
import {
  CompetitionRoom,
  getCurrentWeekKey,
  RankingEntry,
  RoomParticipant,
} from '@/lib/types';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

export default function RankingPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'global' | 'weekly' | 'room'>('global');
  const [globalList, setGlobalList] = useState<RankingEntry[]>([]);
  const [weeklyList, setWeeklyList] = useState<RankingEntry[]>([]);
  const [rooms, setRooms] = useState<CompetitionRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>(
    []
  );

  // Global Ranking
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'global_rankings'),
      where('points', '>=', 0),
      orderBy('points', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setGlobalList(snap.docs.map((d) => d.data() as RankingEntry)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'global_rankings')
    );
    return () => unsub();
  }, [user]);

  // Weekly Ranking
  useEffect(() => {
    if (!user) return;
    const weekKey = getCurrentWeekKey();
    const q = query(
      collection(db, 'weekly_rankings'),
      where('weekKey', '==', weekKey),
      where('points', '>=', 0),
      orderBy('points', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setWeeklyList(snap.docs.map((d) => d.data() as RankingEntry)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'weekly_rankings')
    );
    return () => unsub();
  }, [user]);

  // Available Rooms for "Ranking da Sala"
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CompetitionRoom);
        setRooms(list);
        if (list.length > 0 && !selectedRoomId) {
          setSelectedRoomId(list[0].roomId);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'rooms')
    );
    return () => unsub();
  }, [user, selectedRoomId]);

  useEffect(() => {
    if (!user || !selectedRoomId) return;
    const q = query(
      collection(db, 'rooms', selectedRoomId, 'participants'),
      where('roomId', '==', selectedRoomId),
      orderBy('score', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setRoomParticipants(snap.docs.map((d) => d.data() as RoomParticipant)),
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `rooms/${selectedRoomId}/participants`
        )
    );
    return () => unsub();
  }, [user, selectedRoomId]);

  const activeRows =
    tab === 'global'
      ? globalList.map((e) => ({
          uid: e.uid,
          name: e.displayName,
          photoURL: e.photoURL,
          points: e.points,
          meta: `${e.wins} vitórias · ${e.accuracy}% acerto`,
        }))
      : tab === 'weekly'
        ? weeklyList.map((e) => ({
            uid: e.uid,
            name: e.displayName,
            photoURL: e.photoURL,
            points: e.points,
            meta: `${e.wins} vitórias · ${e.gamesPlayed} jogos`,
          }))
        : roomParticipants.map((p) => ({
            uid: p.uid,
            name: p.displayName,
            photoURL: p.photoURL,
            points: p.score,
            meta: `${p.correctCount} certas · ${p.wrongCount} erradas`,
          }));

  const myIdx = activeRows.findIndex((r) => r.uid === user?.uid);
  const myRow = myIdx >= 0 ? activeRows[myIdx] : null;

  return (
    <AppShell title="Classificação e Rankings">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <Trophy className="w-7 h-7 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-extrabold text-white break-words">
                Ranking Oficial Angola
              </h2>
              <p className="text-xs text-slate-400">
                Atualização em tempo real por pontuação, vitórias e precisão.
              </p>
            </div>
          </div>

          {/* 3 Ranking Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
            {(
              [
                { id: 'global', label: 'Geral' },
                { id: 'weekly', label: 'Semanal' },
                { id: 'room', label: 'Na Sala' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'room' && rooms.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <label className="text-xs font-medium text-slate-400 shrink-0">
              Selecionar Sala:
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full sm:w-auto max-w-full min-h-[40px] px-3 rounded-xl bg-[#111520] border border-white/15 text-sm text-white truncate"
            >
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>
                  {r.title} ({r.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Top 3 Podium Cards */}
        {activeRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeRows.slice(0, 3).map((row, idx) => (
              <div
                key={row.uid}
                className={`rounded-2xl p-5 border flex items-center gap-4 ${
                  idx === 0
                    ? 'bg-gradient-to-br from-amber-500/20 to-[#111520] border-amber-400/50'
                    : idx === 1
                      ? 'bg-[#111520] border-slate-400/35'
                      : 'bg-[#111520] border-orange-500/35'
                }`}
              >
                <div className="relative">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white/20">
                    <Image
                      src={row.photoURL || defaultAvatarImg}
                      alt={row.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span
                    className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${
                      idx === 0
                        ? 'bg-amber-400 text-black'
                        : idx === 1
                          ? 'bg-slate-300 text-black'
                          : 'bg-orange-400 text-black'
                    }`}
                  >
                    {idx + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {idx === 0 ? (
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Medal className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <p className="text-sm font-bold text-white truncate">
                      {row.name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{row.meta}</p>
                  <p className="font-mono-tabular text-lg font-extrabold text-amber-400 mt-1">
                    {row.points} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Leaderboard List */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl overflow-hidden">
          {activeRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Ainda não existem registos nesta classificação. Participa numa
              competição para estrear a tabela!
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {activeRows.map((row, idx) => {
                const isMe = row.uid === user?.uid;
                return (
                  <div
                    key={row.uid}
                    className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 ${
                      isMe ? 'bg-red-600/15' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-7 text-center font-mono-tabular text-sm font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10">
                        <Image
                          src={row.photoURL || defaultAvatarImg}
                          alt={row.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {row.name}
                        </p>
                        <p className="text-xs text-slate-400">{row.meta}</p>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-sm sm:text-base font-bold text-amber-400 shrink-0">
                      {row.points} pts
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinned Current User Rank Summary */}
        {profile && (
          <div className="bg-[#161B29] border border-red-500/35 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/20">
                <Image
                  src={profile.photoURL || defaultAvatarImg}
                  alt={profile.displayName}
                  fill
                  sizes="44px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <p className="text-xs text-slate-400">A tua pontuação</p>
                <p className="font-mono-tabular text-lg font-extrabold text-amber-400">
                  {myRow ? myRow.points : profile.totalPoints} pts
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Posição</p>
              <p className="font-mono-tabular text-lg font-extrabold text-white">
                {myIdx >= 0 ? `#${myIdx + 1}` : 'Sem classificação'}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
