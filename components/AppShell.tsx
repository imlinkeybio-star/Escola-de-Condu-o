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
  Car,
  History,
  Home,
  LogOut,
  Menu,
  Radio,
  Settings,
  Shield,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { NotificationItem } from '@/lib/types';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  hideBottomNav?: boolean;
}

export function AppShell({
  children,
  title,
  hideBottomNav = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isAdmin, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as NotificationItem) }))
        );
      },
      () => {
        // Silent if index building or offline
      }
    );
    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read && n.id);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, 'notifications', n.id!), { read: true }).catch(() => {})
      )
    );
  };

  const navItems = [
    { href: '/dashboard', label: 'Início', icon: Home },
    { href: '/salas', label: 'Salas ao Vivo', icon: Radio },
    { href: '/ranking', label: 'Ranking', icon: Trophy },
    { href: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
    { href: '/historico', label: 'Histórico', icon: History },
    { href: '/conquistas', label: 'Conquistas', icon: Award },
    { href: '/regras', label: 'Regras de Trânsito', icon: BookOpen },
    { href: '/perfil', label: 'Meu Perfil', icon: User },
    { href: '/definicoes', label: 'Definições', icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ href: '/admin', label: 'Administração', icon: Shield });
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

  return (
    <div className="min-h-screen bg-[#07090F] text-slate-100 flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0D101A] border-r border-white/[0.08] z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/[0.08]">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-display text-lg font-extrabold tracking-wide text-white block leading-none whitespace-nowrap">
                ESCOLA DE CONDUÇÃO
              </span>
              <span className="text-[11px] font-bold tracking-widest text-red-500 uppercase">
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
                <span>{item.label}</span>
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
                <p className="text-xs text-amber-400 font-mono-tabular">
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
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Compact 56px mobile, 64px desktop) */}
        <header className="sticky top-0 z-20 h-14 lg:h-16 bg-[#07090F]/90 backdrop-blur-md border-b border-white/[0.08] px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/[0.06] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base lg:text-lg font-bold text-white truncate">
              {title || 'Escola de Condução Live'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen((p) => !p);
                      if (!notifOpen && unreadCount > 0) void markAllRead();
                    }}
                    aria-label="Notificações"
                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] relative cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-[#121622] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-white/[0.08]">
                        <span className="text-xs font-semibold text-white">
                          Notificações
                        </span>
                        <button
                          onClick={() => setNotifOpen(false)}
                          className="text-slate-400 hover:text-white p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          Sem notificações recentes.
                        </p>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-1.5">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                setNotifOpen(false);
                                if (n.roomId) router.push(`/sala/${n.roomId}`);
                              }}
                              className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] cursor-pointer"
                            >
                              <p className="text-xs font-semibold text-white">
                                {n.title}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {n.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* Page Viewport */}
        <main
          className={`flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-5 lg:py-7 ${
            hideBottomNav ? 'pb-8' : 'pb-24 lg:pb-8'
          }`}
        >
          {children}
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
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                  <Car className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-lg font-bold text-white">
                  ESCOLA DE CONDUÇÃO
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
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
                    <span>{item.label}</span>
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
