'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Lock, Users } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { AppShell } from '@/components/AppShell';
import { AchievementRecord, ACHIEVEMENTS_CATALOG } from '@/lib/types';
import { translateAchievement } from '@/lib/i18n';

export default function ConquistasPage() {
  const { user } = useAuth();
  const { language, dict } = useLanguage();
  const [unlocked, setUnlocked] = useState<AchievementRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'achievements'),
      where('uid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setUnlocked(snap.docs.map((d) => d.data() as AchievementRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'achievements')
    );
    return () => unsub();
  }, [user]);

  const unlockedSet = new Set(unlocked.map((a) => a.achievementId));

  return (
    <AppShell title={dict.achievements.shellTitle}>
      <div className="space-y-6">
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold text-white">
              {dict.achievements.heading}
            </h2>
            <p className="text-sm text-slate-400">
              {dict.achievements.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/utilizadores"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-amber-400" />
              {dict.achievements.communityPrizesBtn}
            </Link>
            <div className="text-end">
              <p className="font-mono-tabular text-2xl font-extrabold text-amber-400">
                {unlocked.length}/{ACHIEVEMENTS_CATALOG.length}
              </p>
              <p className="text-xs text-slate-400">{dict.achievements.unlockedLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENTS_CATALOG.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);
            const translated = translateAchievement(
              language,
              ach.id,
              ach.title,
              ach.description
            );
            const tierBorder =
              ach.tier === 'gold'
                ? 'border-amber-400/50'
                : ach.tier === 'silver'
                  ? 'border-slate-300/40'
                  : 'border-orange-500/40';
            return (
              <div
                key={ach.id}
                className={`rounded-2xl p-5 border space-y-3 ${
                  isUnlocked
                    ? `bg-[#111520] ${tierBorder}`
                    : 'bg-[#0C0F18] border-white/[0.05] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isUnlocked
                        ? ach.tier === 'gold'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-400/20 text-slate-200'
                        : 'bg-white/[0.05] text-slate-500'
                    }`}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      {dict.achievements.unlockedBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                      {dict.achievements.lockedBadge}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">
                    {translated.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {translated.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
