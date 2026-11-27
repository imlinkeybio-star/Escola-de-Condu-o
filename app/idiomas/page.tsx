'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/i18n';
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  Languages,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';

export default function IdiomasPage() {
  const { user } = useAuth();
  const { language, setLanguage, dict, fmt } = useLanguage();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelect = (code: LanguageCode, nativeName: string) => {
    setLanguage(code);
    setFeedback(fmt(dict.languagesPage.selectedFeedback, { name: nativeName }));
  };

  return (
    <AppShell title={dict.languagesPage.shellTitle} hideBottomNav={!user}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#12192B] via-[#0F1524] to-[#0B0F1A] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Globe className="h-4 w-4" />
                <span>{dict.languagesPage.eyebrow}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {dict.languagesPage.heading}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {dict.languagesPage.subtitle}
              </p>
            </div>

            <Link
              href={user ? '/dashboard' : '/'}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>
                {user ? dict.languagesPage.backToDashboard : dict.languagesPage.backToHome}
              </span>
            </Link>
          </div>

          {feedback && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{feedback}</span>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SUPPORTED_LANGUAGES.map((item, idx) => {
            const isSelected = item.code === language;
            return (
              <motion.button
                key={item.code}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => handleSelect(item.code, item.nativeName)}
                aria-pressed={isSelected}
                dir={item.dir}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-start transition min-h-[132px] ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                    : 'border-white/10 bg-[#0F1524] hover:border-white/25 hover:bg-[#141C30]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-extrabold tracking-wider ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/5 text-slate-300 group-hover:bg-white/10'
                    }`}
                  >
                    {item.shortCode}
                  </span>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {dict.languagesPage.activeBadge}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono uppercase text-slate-500">
                      {item.bcp47}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-lg font-bold text-white leading-snug">
                    {item.nativeName}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.regionLabel}</p>
                </div>
              </motion.button>
            );
          })}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0F1524] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Volume2 className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {dict.languagesPage.aiVoiceNote}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0F1524] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <Languages className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {dict.languagesPage.rtlNote}
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
