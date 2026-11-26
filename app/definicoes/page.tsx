'use client';

import React, { useState } from 'react';
import { Bell, Check, HelpCircle, Volume2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { AccountSecurityCard } from '@/components/AccountSecurityCard';
import { updateUserProfileDetails } from '@/lib/firestore-service';
import { useVoiceExaminer } from '@/hooks/useVoiceExaminer';

export default function DefinicoesPage() {
  const { user, privateInfo, refreshProfile } = useAuth();
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
    <AppShell title="Definições & Suporte">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-white">
            Preferências da Plataforma
          </h2>

          <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Volume2 className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Examinadora Virtual por Voz
                </p>
                <p className="text-xs text-slate-400">
                  Lê perguntas, opções e explicações em português durante o
                  concurso.
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
              {voiceEnabled ? 'Ativa' : 'Desativada'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Bell className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Notificações de Competições
                </p>
                <p className="text-xs text-slate-400">
                  Alertas quando novas salas oficiais forem disponibilizadas.
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
              {notificationsEnabled ? 'Ativas' : 'Desativadas'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!user}
              className="min-h-[44px] px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 shrink-0" />
              {saved ? 'Preferências Guardadas!' : 'Guardar Preferências'}
            </button>

            <button
              onClick={() =>
                speak(
                  'Olá! Sou a examinadora virtual da Escola de Condução Live. Boa sorte na tua próxima competição!',
                  true
                )
              }
              className="min-h-[44px] px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold cursor-pointer text-center"
            >
              {isSpeaking ? 'A reproduzir áudio...' : 'Testar Voz Portuguesa'}
            </button>
          </div>
        </div>

        <AccountSecurityCard />

        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <HelpCircle className="w-5 h-5 text-red-500" />
            <h3>Suporte ao Aluno</h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Para dúvidas sobre regras de trânsito em Angola, consulta a secção{' '}
            <strong className="text-white">Regras de Trânsito</strong> onde a
            Examinadora Virtual IA responde em tempo real.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
