'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlatformUsersStats, UserProfile } from '@/lib/types';
import { useLanguage } from './LanguageProvider';
import { formatNumberLocale, tFormat } from '@/lib/i18n';

const GOAL_USERS = 5_000_000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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

export function PlatformUsersTracker() {
  const { dict, language } = useLanguage();
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeSegment, setActiveSegment] = useState<
    'registered' | 'remaining' | 'deleted' | 'offline'
  >('registered');

  useEffect(() => {
    const usersQuery = query(
      collection(db, 'users'),
      where('disabled', '==', false)
    );
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        setRegisteredUsers(snap.docs.map((d) => d.data() as UserProfile));
        setNowMs(Date.now());
      },
      () => {
        // Non-blocking fallback
      }
    );

    const unsubStats = onSnapshot(
      doc(db, 'platform_stats', 'users_summary'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformUsersStats;
          setDeletedCount(Math.max(0, Number(data.deletedCount || 0)));
        } else {
          setDeletedCount(0);
        }
      },
      () => {
        // Non-blocking fallback
      }
    );

    const tick = setInterval(() => setNowMs(Date.now()), 60000);
    return () => {
      unsubUsers();
      unsubStats();
      clearInterval(tick);
    };
  }, []);

  const stats = useMemo(() => {
    const registeredCount = registeredUsers.length;
    const offline3DaysCount = registeredUsers.filter((u) => {
      const lastSeen =
        toMillis(u.lastActiveAt) ||
        toMillis(u.updatedAt) ||
        toMillis(u.createdAt);
      if (!lastSeen) return false;
      return nowMs - lastSeen >= THREE_DAYS_MS;
    }).length;
    const activeRecentCount = Math.max(0, registeredCount - offline3DaysCount);
    const remainingCount = Math.max(0, GOAL_USERS - registeredCount);
    const goalPct = Math.min(100, (registeredCount / GOAL_USERS) * 100);

    return {
      registeredCount,
      activeRecentCount,
      offline3DaysCount,
      deletedCount,
      remainingCount,
      goalPct,
    };
  }, [registeredUsers, deletedCount, nowMs]);

  const fmt = (n: number) => formatNumberLocale(language, n);

  // Visual bar widths toward 5M goal (ensure small non-zero counts stay clearly visible)
  const totalForScale =
    stats.registeredCount + stats.deletedCount + stats.remainingCount || GOAL_USERS;
  const regBarPct =
    stats.registeredCount > 0
      ? Math.max(2, (stats.registeredCount / totalForScale) * 100)
      : 0;
  const offlineBarPct =
    stats.offline3DaysCount > 0
      ? Math.max(1.5, (stats.offline3DaysCount / totalForScale) * 100)
      : 0;
  const delBarPct =
    stats.deletedCount > 0
      ? Math.max(1.5, (stats.deletedCount / totalForScale) * 100)
      : 0;
  const remBarPct = Math.max(
    0,
    100 - Math.min(95, regBarPct + offlineBarPct + delBarPct)
  );

  // SVG Activity Chart (Registered vs Offline 3d vs Deleted on real community scale)
  const communityTotal = Math.max(1, stats.registeredCount + stats.deletedCount);
  const svgWidth = 420;
  const rows = [
    {
      key: 'registered' as const,
      label: dict.tracker.registeredUsers,
      count: stats.registeredCount,
      color: '#22C55E',
      pctOfBase: (stats.registeredCount / GOAL_USERS) * 100,
      barRatio: stats.registeredCount / communityTotal,
    },
    {
      key: 'offline' as const,
      label: dict.tracker.offline3d,
      count: stats.offline3DaysCount,
      color: '#64748B',
      pctOfBase:
        stats.registeredCount > 0
          ? (stats.offline3DaysCount / stats.registeredCount) * 100
          : 0,
      barRatio: stats.offline3DaysCount / communityTotal,
    },
    {
      key: 'deleted' as const,
      label: dict.tracker.deletedAccounts,
      count: stats.deletedCount,
      color: '#EF4444',
      pctOfBase: (stats.deletedCount / communityTotal) * 100,
      barRatio: stats.deletedCount / communityTotal,
    },
    {
      key: 'remaining' as const,
      label: dict.tracker.remaining5m,
      count: stats.remainingCount,
      color: '#F97316',
      pctOfBase: (stats.remainingCount / GOAL_USERS) * 100,
      barRatio: stats.remainingCount / GOAL_USERS,
    },
  ];

  const activeItem = rows.find((r) => r.key === activeSegment) || rows[0];

  return (
    <section
      aria-label={dict.tracker.ariaLabel}
      className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-5 min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">
              {dict.tracker.title}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {dict.tracker.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 font-mono-tabular shrink-0">
          <div className="text-start sm:text-end">
            <p className="text-sm font-extrabold text-emerald-400">
              {fmt(stats.registeredCount)} / {fmt(GOAL_USERS)}
            </p>
            <p className="text-[11px] text-slate-400">
              {tFormat(dict.tracker.metaReached, {
                pct: stats.goalPct.toFixed(4),
              })}
            </p>
          </div>
          <Link
            href="/utilizadores"
            className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
          >
            {dict.tracker.viewUsersPrizes}
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </Link>
        </div>
      </div>

      {/* Main 5M Goal Stacked Progress Bar */}
      <div className="space-y-2">
        <div className="h-5 w-full rounded-xl bg-[#090C14] border border-white/10 overflow-hidden flex p-0.5 gap-0.5">
          {regBarPct > 0 && (
            <div
              title={`${dict.tracker.registeredUsers}: ${fmt(stats.registeredCount)}`}
              onClick={() => setActiveSegment('registered')}
              className="h-full rounded-s-lg bg-[#22C55E] transition-all duration-700 cursor-pointer"
              style={{ width: `${regBarPct}%` }}
            />
          )}
          {offlineBarPct > 0 && (
            <div
              title={`${dict.tracker.offline3d}: ${fmt(stats.offline3DaysCount)}`}
              onClick={() => setActiveSegment('offline')}
              className="h-full bg-[#64748B] transition-all duration-700 cursor-pointer"
              style={{ width: `${offlineBarPct}%` }}
            />
          )}
          {delBarPct > 0 && (
            <div
              title={`${dict.tracker.deletedAccounts}: ${fmt(stats.deletedCount)}`}
              onClick={() => setActiveSegment('deleted')}
              className="h-full bg-[#EF4444] transition-all duration-700 cursor-pointer"
              style={{ width: `${delBarPct}%` }}
            />
          )}
          <div
            title={`${dict.tracker.remaining5m}: ${fmt(stats.remainingCount)}`}
            onClick={() => setActiveSegment('remaining')}
            className="h-full rounded-e-lg bg-[#F97316] transition-all duration-700 cursor-pointer flex-1"
            style={{ width: `${remBarPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-500">
          <span>0</span>
          <span>1.25M</span>
          <span>2.5M</span>
          <span>3.75M</span>
          <span className="text-orange-400 font-bold">{dict.tracker.meta5m}</span>
        </div>
      </div>

      {/* Real-Time Graphical SVG Chart + 4 KPI Readouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-7 bg-[#0B0E17] border border-white/[0.06] rounded-xl p-3.5 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white truncate">
              {activeItem.label}
            </span>
            <span
              className="font-mono-tabular font-bold shrink-0"
              style={{ color: activeItem.color }}
            >
              {fmt(activeItem.count)}
            </span>
          </div>

          <div dir="ltr">
            <svg
              viewBox={`0 0 ${svgWidth} 124`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={dict.tracker.chartAria}
            >
            {rows.map((row, idx) => {
              const y = 8 + idx * 29;
              const trackW = 240;
              const fillW =
                row.count > 0 ? Math.max(6, Math.round(row.barRatio * trackW)) : 0;
              const isSelected = row.key === activeSegment;
              return (
                <g
                  key={row.key}
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveSegment(row.key)}
                  onClick={() => setActiveSegment(row.key)}
                >
                  <text
                    x={0}
                    y={y + 13}
                    fill={isSelected ? '#F8FAFC' : '#94A3B8'}
                    fontSize="10.5"
                    fontWeight={isSelected ? '700' : '500'}
                  >
                    {row.label}
                  </text>
                  <rect
                    x={124}
                    y={y + 2}
                    width={trackW}
                    height={14}
                    rx={4}
                    fill="rgba(255,255,255,0.06)"
                  />
                  {fillW > 0 && (
                    <rect
                      x={124}
                      y={y + 2}
                      width={fillW}
                      height={14}
                      rx={4}
                      fill={row.color}
                      opacity={isSelected ? 1 : 0.82}
                    />
                  )}
                  <text
                    x={svgWidth}
                    y={y + 13}
                    textAnchor="end"
                    fill={row.color}
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {fmt(row.count)}
                  </text>
                </g>
              );
            })}
            </svg>
          </div>
        </div>

        {/* 4 Exact Color Legend Cards */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-2.5 min-w-0">
          <div className="bg-[#0B0E17] border border-emerald-500/25 rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#22C55E] shrink-0" />
              <span className="truncate">{dict.tracker.registeredCard}</span>
            </div>
            <p className="font-mono-tabular text-lg font-extrabold text-[#22C55E] mt-1 truncate">
              {fmt(stats.registeredCount)}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {tFormat(dict.tracker.activeRecent, {
                count: fmt(stats.activeRecentCount),
              })}
            </p>
          </div>

          <div className="bg-[#0B0E17] border border-orange-500/25 rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F97316] shrink-0" />
              <span className="truncate">{dict.tracker.remainingCard}</span>
            </div>
            <p className="font-mono-tabular text-lg font-extrabold text-[#F97316] mt-1 truncate">
              {fmt(stats.remainingCount)}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {dict.tracker.upTo5m}
            </p>
          </div>

          <div className="bg-[#0B0E17] border border-red-500/25 rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] shrink-0" />
              <span className="truncate">{dict.tracker.deletedCard}</span>
            </div>
            <p className="font-mono-tabular text-lg font-extrabold text-[#EF4444] mt-1 truncate">
              {fmt(stats.deletedCount)}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {dict.tracker.removedAccounts}
            </p>
          </div>

          <div className="bg-[#0B0E17] border border-slate-500/25 rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#64748B] shrink-0" />
              <span className="truncate">{dict.tracker.offlineCard}</span>
            </div>
            <p className="font-mono-tabular text-lg font-extrabold text-slate-300 mt-1 truncate">
              {fmt(stats.offline3DaysCount)}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {dict.tracker.noActivity72h}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
