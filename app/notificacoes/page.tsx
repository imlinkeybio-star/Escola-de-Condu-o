'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  ExternalLink,
  Megaphone,
  Sparkles,
  Video,
  Volume2,
} from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { BroadcastItem, NotificationItem } from '@/lib/types';
import {
  extractYouTubeEmbedUrl,
  isInternalPath,
  sanitizeSafeUrl,
} from '@/lib/url-safety';

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

function formatDate(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Agora';
  return new Date(ms).toLocaleString('pt-AO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificacoesPage() {
  const { user, isOwner } = useAuth();
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [personal, setPersonal] = useState<NotificationItem[]>([]);
  const [tab, setTab] = useState<'all' | 'broadcasts' | 'personal'>('all');

  useEffect(() => {
    if (!user) return;
    const bq = query(
      collection(db, 'broadcasts'),
      where('active', '==', true),
      limit(40)
    );
    const unsubB = onSnapshot(
      bq,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as BroadcastItem), id: d.id }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setBroadcasts(list);
      },
      () => {}
    );

    const nq = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      limit(40)
    );
    const unsubN = onSnapshot(
      nq,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as NotificationItem) }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setPersonal(list);
      },
      () => {}
    );

    return () => {
      unsubB();
      unsubN();
    };
  }, [user]);

  const markRead = async (n: NotificationItem) => {
    if (!n.id || n.read) return;
    await updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(
      () => {}
    );
  };

  if (!user) {
    return (
      <AppShell title="Notificações">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-300">
            Inicia sessão para veres as notificações e comunicados em tempo
            real.
          </p>
          <Link
            href="/entrar"
            className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            Entrar
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Central de Notificações">
      <div className="space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold text-white">
              Notificações & Comunicados em Tempo Real
            </h2>
            <p className="text-xs text-slate-400">
              Avisos informativos, links úteis e anúncios oficiais publicados na
              plataforma.
            </p>
          </div>
          {isOwner && (
            <Link
              href="/dono-anuncios"
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Megaphone className="w-4 h-4" />
              Gerir Anúncios & Notificações
            </Link>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'broadcasts', label: `Avisos & Anúncios (${broadcasts.length})` },
              { id: 'personal', label: `Pessoais (${personal.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Global Owner / AI Broadcasts */}
        {(tab === 'all' || tab === 'broadcasts') && (
          <div className="space-y-3">
            {broadcasts.length === 0 && tab === 'broadcasts' ? (
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center text-sm text-slate-400">
                Sem comunicados ou anúncios ativos neste momento.
              </div>
            ) : (
              broadcasts.map((b) => {
                const safeLink = sanitizeSafeUrl(b.linkUrl);
                const safeMedia = sanitizeSafeUrl(b.mediaUrl);
                const ytEmbed =
                  b.kind === 'ad_video'
                    ? extractYouTubeEmbedUrl(safeMedia)
                    : null;

                return (
                  <div
                    key={b.id}
                    className="bg-[#111520] border border-amber-500/25 rounded-2xl p-4 sm:p-5 space-y-3 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        {b.kind === 'ad_audio' ? (
                          <Volume2 className="w-4 h-4 shrink-0" />
                        ) : b.kind === 'ad_video' ? (
                          <Video className="w-4 h-4 shrink-0" />
                        ) : b.aiGenerated ? (
                          <Sparkles className="w-4 h-4 shrink-0" />
                        ) : (
                          <Megaphone className="w-4 h-4 shrink-0" />
                        )}
                        <span className="uppercase tracking-wider">
                          {b.kind === 'ad_audio'
                            ? 'Áudio'
                            : b.kind === 'ad_video'
                              ? 'Vídeo'
                              : b.kind === 'ad_banner'
                                ? 'Anúncio'
                                : b.kind === 'link'
                                  ? 'Link Oficial'
                                  : 'Informativa'}
                          {b.aiGenerated ? ' · Gerado por IA' : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono-tabular">
                        {formatDate(b.createdAt)}
                      </span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base font-bold text-white break-words">
                        {b.title}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed break-words">
                        {b.body}
                      </p>
                    </div>

                    {b.kind === 'ad_audio' && safeMedia && (
                      <audio
                        src={safeMedia}
                        controls
                        className="w-full max-w-md h-10"
                      />
                    )}

                    {b.kind === 'ad_video' && safeMedia && (
                      <div className="w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
                        {ytEmbed ? (
                          <iframe
                            src={ytEmbed}
                            title={b.title}
                            className="w-full h-full"
                            allow="encrypted-media"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={safeMedia}
                            controls
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )}

                    {safeLink && (
                      <div>
                        {isInternalPath(safeLink) ? (
                          <Link
                            href={safeLink}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                          >
                            <span>{b.linkLabel || 'Aceder Agora'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <a
                            href={safeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                          >
                            <span>{b.linkLabel || 'Abrir Link Externo'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Personal Notifications */}
        {(tab === 'all' || tab === 'personal') && (
          <div className="space-y-3">
            {personal.length === 0 &&
              (tab === 'personal' || broadcasts.length === 0) && (
                <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-300 font-semibold">
                    Nenhuma notificação encontrada
                  </p>
                  <p className="text-xs text-slate-400">
                    Novos avisos e notificações em tempo real aparecerão aqui
                    automaticamente.
                  </p>
                </div>
              )}

            {personal.map((n) => {
              const safeLink = sanitizeSafeUrl(n.linkUrl);
              return (
                <div
                  key={n.id}
                  onClick={() => void markRead(n)}
                  className={`rounded-2xl p-4 sm:p-5 border space-y-2 transition-colors ${
                    n.read
                      ? 'bg-[#111520] border-white/[0.08]'
                      : 'bg-[#161C2C] border-red-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white break-words">
                      {n.title}
                    </p>
                    <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 break-words">
                    {n.body}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {n.roomId && (
                      <Link
                        href={`/sala/${n.roomId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                      >
                        Abrir Sala
                      </Link>
                    )}
                    {safeLink &&
                      (isInternalPath(safeLink) ? (
                        <Link
                          href={safeLink}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
                        >
                          {n.linkLabel || 'Abrir'}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <a
                          href={safeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
                        >
                          {n.linkLabel || 'Abrir Link'}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
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
