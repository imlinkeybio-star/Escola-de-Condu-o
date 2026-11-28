'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Megaphone,
  MessageSquareText,
  Sparkles,
  Trash2,
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
import { useLanguage } from '@/components/LanguageProvider';
import { AppShell } from '@/components/AppShell';
import {
  FacebookStyleAdCard,
  FullscreenVideoAdModal,
} from '@/components/FacebookAdUnit';
import { BroadcastItem, NotificationItem } from '@/lib/types';
import { ChatNotificationRecord } from '@/lib/chat-types';
import {
  clearAllUserNotifications,
  markUserNotificationsAndBroadcastsRead,
} from '@/lib/firestore-service';
import {
  markAllChatNotificationsRead,
  markChatNotificationReadById,
} from '@/lib/chat-service';
import { isInternalPath, sanitizeSafeUrl } from '@/lib/url-safety';
import { formatDateLocale, tFormat } from '@/lib/i18n';

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

export default function NotificacoesPage() {
  const router = useRouter();
  const { user, privateInfo, isOwner, canAnnounce } = useAuth();
  const { language, dict } = useLanguage();

  const formatDate = (ts: unknown): string => {
    const ms = toMillis(ts);
    if (!ms) return dict.common.recent;
    return formatDateLocale(language, ms, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [personal, setPersonal] = useState<NotificationItem[]>([]);
  const [chatNotifs, setChatNotifs] = useState<ChatNotificationRecord[]>([]);
  const [tab, setTab] = useState<'all' | 'broadcasts' | 'personal'>('all');
  const [previewVideo, setPreviewVideo] = useState<BroadcastItem | null>(null);
  const [optimisticReadAtMs, setOptimisticReadAtMs] = useState(0);
  const [optimisticClearedAtMs, setOptimisticClearedAtMs] = useState(0);
  const [busyAction, setBusyAction] = useState<'read' | 'clear' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');

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

    const cq = query(
      collection(db, 'chat_notifications'),
      where('recipientUid', '==', user.uid),
      limit(60)
    );
    const unsubC = onSnapshot(
      cq,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatNotificationRecord)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setChatNotifs(list);
      },
      () => {}
    );

    return () => {
      unsubB();
      unsubN();
      unsubC();
    };
  }, [user]);

  const clearedBeforeMs = Math.max(
    privateInfo?.notificationsClearedBeforeMs ?? 0,
    optimisticClearedAtMs
  );
  const broadcastsReadAtMs = Math.max(
    privateInfo?.broadcastsReadAtMs ?? 0,
    optimisticReadAtMs,
    clearedBeforeMs
  );

  const visibleBroadcasts = broadcasts.filter((b) => {
    const ms = toMillis(b.createdAt);
    return ms === 0 || ms > clearedBeforeMs;
  });

  const visiblePersonal = personal.filter((n) => {
    const ms = toMillis(n.createdAt);
    return ms === 0 || ms > clearedBeforeMs;
  });

  const visibleChatNotifs = chatNotifs.filter((n) => {
    const ms = toMillis(n.createdAt);
    return ms === 0 || ms > clearedBeforeMs;
  });

  const unreadPersonalCount =
    visiblePersonal.filter((n) => !n.read).length +
    visibleChatNotifs.filter((n) => !n.read).length;
  const unreadBroadcastCount = visibleBroadcasts.filter((b) => {
    const latestMs = Math.max(toMillis(b.createdAt), toMillis(b.updatedAt));
    return latestMs === 0 ? broadcastsReadAtMs === 0 : latestMs > broadcastsReadAtMs;
  }).length;
  const totalUnread = unreadPersonalCount + unreadBroadcastCount;

  const markRead = async (n: NotificationItem) => {
    if (!n.id || n.read) return;
    setPersonal((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
    );
    await updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(
      () => {}
    );
  };

  const markChatNotifRead = async (cn: ChatNotificationRecord) => {
    if (!cn.notifId || cn.read) return;
    setChatNotifs((prev) =>
      prev.map((item) =>
        item.notifId === cn.notifId ? { ...item, read: true } : item
      )
    );
    await markChatNotificationReadById(cn.notifId);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setBusyAction('read');
    setFeedbackMsg('');
    const nowMs = Date.now();
    setOptimisticReadAtMs(nowMs);
    const unreadIds = visiblePersonal
      .filter((n) => !n.read && n.id)
      .map((n) => n.id!);
    setPersonal((prev) => prev.map((n) => ({ ...n, read: true })));
    setChatNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all([
        markUserNotificationsAndBroadcastsRead(user.uid, unreadIds),
        markAllChatNotificationsRead(user.uid),
      ]);
      setFeedbackMsg(dict.notifications.markedAllFeedback);
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    setBusyAction('clear');
    setFeedbackMsg('');
    const nowMs = Date.now();
    setOptimisticClearedAtMs(nowMs);
    setOptimisticReadAtMs(nowMs);
    setPersonal([]);
    setChatNotifs([]);
    try {
      await Promise.all([
        clearAllUserNotifications(user.uid),
        markAllChatNotificationsRead(user.uid),
      ]);
      setFeedbackMsg(dict.notifications.clearedAllFeedback);
    } finally {
      setBusyAction(null);
    }
  };

  if (!user) {
    return (
      <AppShell title={dict.notifications.shellTitle}>
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-300">
            {dict.notifications.guestDesc}
          </p>
          <Link
            href="/entrar"
            className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            {dict.common.enter}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={dict.notifications.shellTitleLogged}>
      {previewVideo && (
        <FullscreenVideoAdModal
          ad={previewVideo}
          isPreview
          onClose={() => setPreviewVideo(null)}
        />
      )}

      <div className="w-full max-w-full overflow-x-clip space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white break-words">
              {dict.notifications.headerTitle}
            </h2>
            <p className="text-xs text-slate-400 break-words">
              {dict.notifications.headerSub}
            </p>
          </div>
          {(isOwner || canAnnounce) && (
            <Link
              href="/dono-anuncios"
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Megaphone className="w-4 h-4 shrink-0" />
              {dict.notifications.manageAdsBtn}
            </Link>
          )}
        </div>

        {/* User Actions Bar: Mark All Read + Clear All Notifications */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#111520] border border-white/[0.08] rounded-2xl p-3 min-w-0">
          <div className="text-xs text-slate-300 min-w-0">
            {totalUnread > 0 ? (
              <span className="font-semibold text-amber-400 font-mono-tabular">
                {totalUnread === 1
                  ? dict.notifications.unreadSingle
                  : tFormat(dict.notifications.unreadPlural, { count: totalUnread })}
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold">
                {dict.notifications.allReadLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalUnread > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={busyAction !== null}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/35 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                {busyAction === 'read'
                  ? dict.notifications.markingRead
                  : dict.notifications.markAllRead}
              </button>
            )}

            {(visibleBroadcasts.length > 0 ||
              visiblePersonal.length > 0 ||
              visibleChatNotifs.length > 0) && (
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={busyAction !== null}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/35 text-red-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                {busyAction === 'clear'
                  ? dict.notifications.clearingAll
                  : dict.notifications.clearAll}
              </button>
            )}
          </div>
        </div>

        {feedbackMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
            {feedbackMsg}
          </div>
        )}

        {/* Filter Tabs — strictly bounded within viewport width */}
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-full sm:w-auto max-w-full">
          {(
            [
              { id: 'all', label: dict.notifications.tabAll },
              {
                id: 'broadcasts',
                label:
                  unreadBroadcastCount > 0
                    ? tFormat(dict.notifications.tabBroadcastsUnread, {
                        count: unreadBroadcastCount,
                      })
                    : dict.notifications.tabBroadcasts,
              },
              {
                id: 'personal',
                label:
                  unreadPersonalCount > 0
                    ? tFormat(dict.notifications.tabPersonalUnread, {
                        count: unreadPersonalCount,
                      })
                    : dict.notifications.tabPersonal,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-2.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer truncate text-center ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Empty State when cleared */}
        {visibleBroadcasts.length === 0 &&
          visiblePersonal.length === 0 &&
          visibleChatNotifs.length === 0 &&
          tab === 'all' && (
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300 font-semibold">
                {dict.notifications.emptyAllTitle}
              </p>
              <p className="text-xs text-slate-400">
                {dict.notifications.emptyAllSub}
              </p>
            </div>
          )}

        {/* Global Owner / AI Broadcasts */}
        {(tab === 'all' || tab === 'broadcasts') && (
          <div className="space-y-4 min-w-0">
            {visibleBroadcasts.length === 0 && tab === 'broadcasts' ? (
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center text-sm text-slate-400">
                {dict.notifications.emptyBroadcasts}
              </div>
            ) : (
              visibleBroadcasts.map((b) => {
                if (b.kind === 'ad_banner' || b.kind === 'ad_video') {
                  return (
                    <div key={b.id} className="w-full max-w-2xl min-w-0">
                      <FacebookStyleAdCard
                        ad={b}
                        onOpenFullscreen={(ad) => setPreviewVideo(ad)}
                      />
                    </div>
                  );
                }

                const safeLink = sanitizeSafeUrl(b.linkUrl);
                const safeMedia = sanitizeSafeUrl(b.mediaUrl);

                return (
                  <div
                    key={b.id}
                    className="bg-[#111520] border border-amber-500/25 rounded-2xl p-4 sm:p-5 space-y-3 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400 min-w-0">
                        {b.kind === 'ad_audio' ? (
                          <Volume2 className="w-4 h-4 shrink-0" />
                        ) : b.aiGenerated ? (
                          <Sparkles className="w-4 h-4 shrink-0" />
                        ) : (
                          <Megaphone className="w-4 h-4 shrink-0" />
                        )}
                        <span className="uppercase tracking-wider truncate">
                          {b.kind === 'ad_audio'
                            ? dict.notifications.kindAudio
                            : b.kind === 'link'
                              ? dict.notifications.kindLink
                              : dict.notifications.kindInfo}
                          {b.aiGenerated ? dict.notifications.generatedByAi : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0">
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
                        className="w-full max-w-full sm:max-w-md h-10"
                      />
                    )}

                    {safeLink && (
                      <div>
                        {isInternalPath(safeLink) ? (
                          <Link
                            href={safeLink}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                          >
                            <span>{b.linkLabel || dict.notifications.accessNow}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <a
                            href={safeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                          >
                            <span>{b.linkLabel || dict.notifications.openExternalLink}</span>
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

        {/* Personal & SMS Notifications */}
        {(tab === 'all' || tab === 'personal') && (
          <div className="space-y-3 min-w-0">
            {visiblePersonal.length === 0 &&
              visibleChatNotifs.length === 0 &&
              tab === 'personal' && (
                <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-300 font-semibold">
                    {dict.notifications.emptyPersonalTitle}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dict.notifications.emptyAllSub}
                  </p>
                </div>
              )}

            {visibleChatNotifs.map((cn) => (
              <div
                key={cn.notifId}
                onClick={() => {
                  void markChatNotifRead(cn);
                  router.push(`/chat?chatId=${encodeURIComponent(cn.chatId)}`);
                }}
                className={`rounded-2xl p-4 sm:p-5 border space-y-2 transition-colors min-w-0 cursor-pointer ${
                  cn.read
                    ? 'bg-[#111520] border-white/[0.08]'
                    : 'bg-[#121D18] border-[#22C55E]/45'
                }`}
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#22C55E]/15 border border-[#22C55E]/30 text-[10px] font-bold uppercase tracking-wider text-[#22C55E] shrink-0">
                      <MessageSquareText className="w-3 h-3" />
                      LIVE CHAT · SMS
                    </span>
                    <p className="text-sm font-bold text-white break-words min-w-0 truncate">
                      {cn.title}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0">
                    {formatDate(cn.createdAt)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 break-words">
                  {cn.body}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!cn.read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void markChatNotifRead(cn);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      {dict.notifications.markReadBtn}
                    </button>
                  )}
                  <Link
                    href={`/chat?chatId=${encodeURIComponent(cn.chatId)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void markChatNotifRead(cn);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-xs font-bold text-black"
                  >
                    <MessageSquareText className="w-3.5 h-3.5" />
                    {dict.common.open} · {dict.nav.liveChat}
                  </Link>
                </div>
              </div>
            ))}

            {visiblePersonal.map((n) => {
              const safeLink = sanitizeSafeUrl(n.linkUrl);
              return (
                <div
                  key={n.id}
                  onClick={() => void markRead(n)}
                  className={`rounded-2xl p-4 sm:p-5 border space-y-2 transition-colors min-w-0 cursor-pointer ${
                    n.read
                      ? 'bg-[#111520] border-white/[0.08]'
                      : 'bg-[#161C2C] border-red-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <p className="text-sm font-bold text-white break-words min-w-0">
                      {n.title}
                    </p>
                    <span className="text-[11px] text-slate-400 font-mono-tabular shrink-0">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 break-words">
                    {n.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!n.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void markRead(n);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        {dict.notifications.markReadBtn}
                      </button>
                    )}
                    {n.roomId && (
                      <Link
                        href={`/sala/${n.roomId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                      >
                        {dict.notifications.openRoomBtn}
                      </Link>
                    )}
                    {safeLink &&
                      (isInternalPath(safeLink) ? (
                        <Link
                          href={safeLink}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
                        >
                          {n.linkLabel || dict.common.open}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <a
                          href={safeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
                        >
                          {n.linkLabel || dict.common.openLink}
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
