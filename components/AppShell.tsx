'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  ExternalLink,
  History,
  Home,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { BroadcastItem, NotificationItem } from '@/lib/types';
import { AdBroadcastBanner } from './AdBroadcastBanner';
import {
  clearAllUserNotifications,
  markUserNotificationsAndBroadcastsRead,
} from '@/lib/firestore-service';
import { isInternalPath, sanitizeSafeUrl } from '@/lib/url-safety';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  hideBottomNav?: boolean;
}

function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function AppShell({
  children,
  title,
  hideBottomNav = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    profile,
    privateInfo,
    isAdmin,
    isOwner,
    canViewReserved,
    canAnnounce,
    totpChecking,
    totpRequired,
    markTotpVerified,
    logout,
  } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [optimisticReadAtMs, setOptimisticReadAtMs] = useState(0);
  const [optimisticClearedAtMs, setOptimisticClearedAtMs] = useState(0);
  const [clearingNotifs, setClearingNotifs] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    if (!user) return;
    // Query without orderBy to avoid composite-index delays; sort client-side
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      limit(20)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as NotificationItem) }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
          );
        setNotifications(list.slice(0, 15));
      },
      () => {
        // Non-blocking fallback
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'broadcasts'),
      where('active', '==', true),
      limit(25)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as BroadcastItem), id: d.id }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
          );
        setBroadcasts(list);
      },
      () => {
        // Non-blocking fallback
      }
    );
    return () => unsub();
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

  const visibleNotifications = notifications.filter((n) => {
    const ms = getTimestampMillis(n.createdAt);
    return ms === 0 || ms > clearedBeforeMs;
  });
  const visibleBroadcasts = broadcasts.filter((b) => {
    const ms = getTimestampMillis(b.createdAt);
    return ms === 0 || ms > clearedBeforeMs;
  });

  const unreadPersonalCount = visibleNotifications.filter((n) => !n.read).length;
  const unreadBroadcastCount = visibleBroadcasts.filter((b) => {
    const latestMs = Math.max(
      getTimestampMillis(b.createdAt),
      getTimestampMillis(b.updatedAt)
    );
    return latestMs === 0 ? broadcastsReadAtMs === 0 : latestMs > broadcastsReadAtMs;
  }).length;
  const totalAlertBadge = unreadPersonalCount + unreadBroadcastCount;

  const markAllRead = async () => {
    if (!user) return;
    const nowMs = Date.now();
    setOptimisticReadAtMs(nowMs);
    const unreadIds = visibleNotifications
      .filter((n) => !n.read && n.id)
      .map((n) => n.id!);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markUserNotificationsAndBroadcastsRead(user.uid, unreadIds);
  };

  const handleClearAllNotifications = async () => {
    if (!user || clearingNotifs) return;
    setClearingNotifs(true);
    const nowMs = Date.now();
    setOptimisticClearedAtMs(nowMs);
    setOptimisticReadAtMs(nowMs);
    setNotifications([]);
    try {
      await clearAllUserNotifications(user.uid);
    } finally {
      setClearingNotifs(false);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Início', icon: Home },
    { href: '/salas', label: 'Salas ao Vivo', icon: Radio },
    { href: '/ranking', label: 'Ranking', icon: Trophy },
    { href: '/utilizadores', label: 'Utilizadores & Prêmios', icon: Users },
    { href: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
    { href: '/historico', label: 'Histórico', icon: History },
    { href: '/notificacoes', label: 'Notificações', icon: Bell },
    { href: '/conquistas', label: 'Conquistas', icon: Award },
    { href: '/regras', label: 'Regras de Trânsito', icon: BookOpen },
    { href: '/perfil', label: 'Meu Perfil', icon: User },
    { href: '/definicoes', label: 'Definições', icon: Settings },
  ];

  if (isOwner || canAnnounce) {
    navItems.push({
      href: '/dono-anuncios',
      label: isOwner ? 'Anúncios & Notif. (Dono)' : 'Anúncios & Notif.',
      icon: Megaphone,
    });
  }

  if (isOwner || isAdmin || canViewReserved) {
    navItems.push({ href: '/admin', label: 'Administração', icon: Shield });
  }

  if (isOwner) {
    navItems.push({
      href: '/permissoes',
      label: 'Permissões & Equipa',
      icon: KeyRound,
    });
  }

  const mobileTabs = [
    { href: '/dashboard', label: 'Início', icon: Home },
    { href: '/salas', label: 'Salas', icon: Radio },
    { href: '/ranking', label: 'Ranking', icon: Trophy },
    { href: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
    { href: '/perfil', label: 'Perfil', icon: User },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleVerifyOtpGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !privateInfo?.totpSealedSecret) return;
    setOtpError('');
    setOtpSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: 'verify',
          code: otpCode,
          sealedSecret: privateInfo.totpSealedSecret,
        }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        error?: string;
      };
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'Código OTP inválido.');
      }
      setOtpCode('');
      markTotpVerified(true);
    } catch (err) {
      setOtpError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o código OTP.'
      );
    } finally {
      setOtpSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#07090F] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0D101A] border-r border-white/[0.08] z-30">
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/[0.08]">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="bg-white/95 rounded-xl px-1.5 py-0.5 shadow-sm ring-1 ring-white/15 shrink-0 flex items-center justify-center">
              <Image
                src="/assets/aistudio/favicon_14076ff5.png"
                alt="Escola de Condução Live"
                width={54}
                height={36}
                className="h-8 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <span className="font-display text-base font-extrabold tracking-wide text-white block leading-none whitespace-nowrap truncate">
                ESCOLA DE CONDUÇÃO
              </span>
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                LIVE ANGOLA
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-3 border-t border-white/[0.08] space-y-2">
            <Link
              href="/perfil"
              className="flex items-center gap-3 p-2.5 rounded-xl bg-[#131826] hover:bg-[#192033] transition-colors"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/15 shrink-0">
                <Image
                  src={profile?.photoURL || defaultAvatarImg}
                  alt={profile?.displayName || 'Condutor'}
                  fill
                  sizes="36px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.displayName || user.displayName || 'Aluno'}
                </p>
                <p className="text-xs text-amber-400 font-mono-tabular truncate">
                  {profile?.totalPoints ?? 0} pts · {profile?.tier || 'Aprendiz'}
                </p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Terminar Sessão
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 max-w-full pt-14 lg:pt-16">
        {/* Fixed Top Bar on Scroll (56px mobile, 64px desktop) */}
        <header className="fixed top-0 left-0 right-0 lg:left-64 z-30 h-14 lg:h-16 bg-[#07090F]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/[0.06] cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">
              {title || 'Escola de Condução Live'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {user ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => {
                      const nextOpen = !notifOpen;
                      setNotifOpen(nextOpen);
                      if (nextOpen && totalAlertBadge > 0) {
                        void markAllRead();
                      }
                    }}
                    aria-label="Notificações"
                    className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] relative cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                    {totalAlertBadge > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                        {totalAlertBadge > 9 ? '9+' : totalAlertBadge}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setNotifOpen(false)}
                      />
                      <div className="fixed left-3 right-3 top-[60px] sm:left-auto sm:right-6 sm:top-[68px] sm:w-[24rem] max-h-[min(32rem,calc(100dvh-5rem))] flex flex-col overflow-hidden bg-[#121622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                        <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-white/[0.08] shrink-0">
                          <span className="text-xs font-semibold text-white truncate">
                            Notificações & Avisos
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {(visibleBroadcasts.length > 0 ||
                              visibleNotifications.length > 0) && (
                              <button
                                type="button"
                                onClick={() => void handleClearAllNotifications()}
                                disabled={clearingNotifs}
                                title="Limpar todas as notificações"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-red-600/25 text-[11px] font-semibold text-slate-300 hover:text-red-200 cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" />
                                Limpar
                              </button>
                            )}
                            <Link
                              href="/notificacoes"
                              onClick={() => setNotifOpen(false)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-400 hover:text-red-300 whitespace-nowrap"
                            >
                              Ver todas
                            </Link>
                            <button
                              type="button"
                              onClick={() => setNotifOpen(false)}
                              aria-label="Fechar notificações"
                              className="text-slate-400 hover:text-white p-1 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {visibleBroadcasts.length === 0 &&
                        visibleNotifications.length === 0 ? (
                          <div className="py-6 text-center space-y-1.5">
                            <CheckCheck className="w-6 h-6 text-emerald-400 mx-auto" />
                            <p className="text-xs text-slate-400">
                              Sem notificações pendentes.
                            </p>
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                            {visibleBroadcasts.slice(0, 5).map((b) => {
                              const safeLink = sanitizeSafeUrl(b.linkUrl);
                              return (
                                <div
                                  key={b.id}
                                  className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 min-w-0"
                                >
                                  <p className="text-xs font-bold text-white break-words">
                                    {b.title}
                                  </p>
                                  <p className="text-xs text-slate-300 break-words">
                                    {b.body}
                                  </p>
                                  {safeLink &&
                                    (isInternalPath(safeLink) ? (
                                      <Link
                                        href={safeLink}
                                        onClick={() => setNotifOpen(false)}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline pt-0.5"
                                      >
                                        {b.linkLabel || 'Abrir'}
                                        <ExternalLink className="w-3 h-3" />
                                      </Link>
                                    ) : (
                                      <a
                                        href={safeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline pt-0.5"
                                      >
                                        {b.linkLabel || 'Abrir Link'}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    ))}
                                </div>
                              );
                            })}

                            {visibleNotifications.map((n) => {
                              const safeLink = sanitizeSafeUrl(n.linkUrl);
                              return (
                                <div
                                  key={n.id}
                                  onClick={() => {
                                    if (n.roomId) {
                                      setNotifOpen(false);
                                      router.push(`/sala/${n.roomId}`);
                                    }
                                  }}
                                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] cursor-pointer space-y-1 min-w-0"
                                >
                                  <p className="text-xs font-semibold text-white break-words">
                                    {n.title}
                                  </p>
                                  <p className="text-xs text-slate-400 break-words">
                                    {n.body}
                                  </p>
                                  {safeLink &&
                                    (isInternalPath(safeLink) ? (
                                      <Link
                                        href={safeLink}
                                        onClick={() => setNotifOpen(false)}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 hover:underline"
                                      >
                                        {n.linkLabel || 'Abrir'}
                                        <ExternalLink className="w-3 h-3" />
                                      </Link>
                                    ) : (
                                      <a
                                        href={safeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 hover:underline"
                                      >
                                        {n.linkLabel || 'Abrir Link'}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <Link
                  href="/salas"
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Entrar em Sala
                </Link>

                <Link
                  href="/perfil"
                  className="lg:hidden relative w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0"
                >
                  <Image
                    src={profile?.photoURL || defaultAvatarImg}
                    alt={profile?.displayName || 'Perfil'}
                    fill
                    sizes="36px"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </Link>
              </>
            ) : (
              <Link
                href="/entrar"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Entrar
              </Link>
            )}
          </div>
        </header>

        {/* Top-of-App Ad & Owner Notification Banner directly below Topbar (10s duration, 15min cooldown, X dismiss) */}
        {user && !totpRequired && !totpChecking && (
          <AdBroadcastBanner broadcasts={broadcasts} />
        )}

        {/* Page Viewport */}
        <main
          className={`flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-5 lg:py-7 min-w-0 ${
            hideBottomNav ? 'pb-8' : 'pb-24 lg:pb-8'
          }`}
        >
          {user && totpChecking ? (
            <div className="max-w-md mx-auto bg-[#111520] border border-white/[0.08] rounded-2xl p-8 text-center space-y-3 my-8">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto animate-pulse" />
              <p className="text-sm font-semibold text-white">
                A verificar sessão de segurança 2FA...
              </p>
            </div>
          ) : user && totpRequired ? (
            <div className="max-w-md mx-auto bg-[#111520] border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-5 my-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Verificação Google Authenticator
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A tua conta ({user.email}) está protegida com OTP. Insere o
                  código de 6 dígitos da app Google Authenticator para
                  continuar.
                </p>
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
                  {otpError}
                </div>
              )}

              <form onSubmit={handleVerifyOtpGate} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full min-h-[50px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-xl font-mono-tabular tracking-[0.45em] text-center text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={otpSubmitting || otpCode.length !== 6}
                  className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
                >
                  {otpSubmitting ? 'A verificar...' : 'Confirmar Código OTP'}
                </button>
              </form>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[42px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Terminar Sessão
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Slide-Out Drawer for secondary routes */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0D101A] border-r border-white/10 h-full flex flex-col z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-white/95 rounded-xl px-1.5 py-0.5 shadow-sm ring-1 ring-white/15 flex items-center justify-center shrink-0">
                  <Image
                    src="/assets/aistudio/favicon_14076ff5.png"
                    alt="Escola de Condução Live"
                    width={54}
                    height={36}
                    className="h-8 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="font-display text-base font-bold text-white truncate">
                  ESCOLA DE CONDUÇÃO
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium min-h-[44px] ${
                      active
                        ? 'bg-red-600 text-white'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/[0.05] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Terminar Sessão
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      {!hideBottomNav && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#0D101A]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-5 items-center px-1">
          {mobileTabs.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl transition-colors ${
                  active ? 'text-red-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
