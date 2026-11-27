'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Globe, HelpCircle, Volume2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { AppShell } from '@/components/AppShell';
import { AccountSecurityCard } from '@/components/AccountSecurityCard';
import { updateUserProfileDetails } from '@/lib/firestore-service';
import { useVoiceExaminer } from '@/hooks/useVoiceExaminer';
import { tFormat } from '@/lib/i18n';

export default function DefinicoesPage() {
  const { user, privateInfo, refreshProfile } = useAuth();
  const { dict, meta } = useLanguage();
  const [voiceOverride, setVoiceOverride] = useState<boolean | null>(null);
  const [notifOverride, setNotifOverride] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const { speak, isSpeaking } = useVoiceExaminer(true);

  const voiceEnabled = voiceOverride ?? privateInfo?.voiceEnabled ?? true;
  const notificationsEnabled =
    notifOverride ?? privateInfo?.notificationsEnabled ?? true;

  const handleSave = async () => {
    if (!user) return;
    await updateUserProfileDetails(user.uid, {
      voiceEnabled,
      notificationsEnabled,
    });
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AppShell title={dict.definicoes.shellTitle}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-white">
            {dict.definicoes.preferencesTitle}
          </h2>

          <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Volume2 className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {dict.definicoes.voiceTitle}
                </p>
                <p className="text-xs text-slate-400">
                  {dict.definicoes.voiceDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVoiceOverride(!voiceEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 whitespace-nowrap ${
                voiceEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {voiceEnabled
                ? dict.definicoes.activeLabel
                : dict.definicoes.disabledLabel}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Bell className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {dict.definicoes.notifTitle}
                </p>
                <p className="text-xs text-slate-400">
                  {dict.definicoes.notifDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotifOverride(!notificationsEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 whitespace-nowrap ${
                notificationsEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {notificationsEnabled
                ? dict.definicoes.activePluralLabel
                : dict.definicoes.disabledPluralLabel}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!user}
              className="min-h-[44px] px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 shrink-0" />
              {saved
                ? dict.definicoes.preferencesSaved
                : dict.definicoes.savePreferences}
            </button>

            <button
              onClick={() => speak(dict.definicoes.voiceTestSample, true)}
              className="min-h-[44px] px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold cursor-pointer text-center"
            >
              {isSpeaking
                ? dict.definicoes.speakingAudio
                : dict.definicoes.testVoiceBtn}
            </button>
          </div>
        </div>

        {/* Dedicated link card to the single language page (/idiomas) */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Globe className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">
                {dict.definicoes.languageCardTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {tFormat(dict.definicoes.languageCardDesc, {
                  name: meta.nativeName,
                })}
              </p>
            </div>
          </div>
          <Link
            href="/idiomas"
            className="min-h-[42px] px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
          >
            <Globe className="w-4 h-4 shrink-0" />
            {dict.definicoes.openLanguagesBtn}
          </Link>
        </div>

        <AccountSecurityCard />

        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <HelpCircle className="w-5 h-5 text-red-500 shrink-0" />
            <h3>{dict.definicoes.supportTitle}</h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            {dict.definicoes.supportDesc}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
