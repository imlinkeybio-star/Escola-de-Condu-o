'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BookOpen, Send, Sparkles } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { AppShell } from '@/components/AppShell';
import { SIGN_LABELS, TrafficSignDisplay } from '@/components/TrafficSignDisplay';
import { useAuth } from '@/components/AuthProvider';
import examinerImg from '@/src/assets/images/virtual_examiner_angola_1795615139196.jpg';

const SIGN_KEYS = Object.keys(SIGN_LABELS);

const CORE_RULES = [
  {
    title: 'Prioridade à Direita',
    body: 'Nos cruzamentos e entroncamentos não sinalizados, o condutor deve ceder a passagem aos veículos que se apresentem pela sua direita, salvo veículos prioritários em marcha de urgência.',
  },
  {
    title: 'Circulação em Rotundas',
    body: 'Ao entrar numa rotunda, deve ceder-se a passagem aos veículos que já circulam no interior da mesma. Sinalize sempre a mudança de direção antes de sair.',
  },
  {
    title: 'Limites de Velocidade Gerais',
    body: 'Dentro das localidades em Angola, respeite a sinalização local e a velocidade máxima urbana aplicável a automóveis ligeiros (habitualmente 60 km/h salvo indicação inferior). Reduza sempre próximo de escolas e passadeiras.',
  },
  {
    title: 'Documentação Obrigatória',
    body: 'O condutor deve fazer-se acompanhar da Carta de Condução válida, Bilhete de Identidade, Livrete / Título de Registo de Propriedade do veículo e Seguro Automóvel Obrigatório.',
  },
];

export default function RegrasPage() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setError('');
    setAsking(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Inicia sessão para consultar a Examinadora Virtual IA.');
        return;
      }
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/ai/examiner-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'Erro ao consultar IA.');
      setAnswer(json.answer || '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao comunicar com a IA.'
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <AppShell title="Regras de Trânsito & Código de Estrada">
      <div className="space-y-6">
        {/* Interactive AI Examiner Study Assistant */}
        <section className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-16 rounded-xl overflow-hidden border border-white/15 shrink-0">
              <Image
                src={examinerImg}
                alt="Examinadora Virtual"
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Tutora Oficial IA
              </p>
              <h2 className="text-lg font-bold text-white">
                Tira Dúvidas sobre o Código de Estrada de Angola
              </h2>
            </div>
          </div>

          <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-2.5 min-w-0">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Quem tem prioridade numa rotunda em Angola?"
              className="flex-1 min-w-0 min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={asking || !user}
              className="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              {asking ? 'A analisar...' : 'Perguntar à IA'}
            </button>
          </form>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {answer && (
            <div className="p-4 rounded-xl bg-[#161B29] border border-white/10 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {answer}
            </div>
          )}
        </section>

        {/* Core Rules Summary */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CORE_RULES.map((rule) => (
            <div
              key={rule.title}
              className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2"
            >
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <BookOpen className="w-4 h-4 text-red-500" />
                <span>{rule.title}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {rule.body}
              </p>
            </div>
          ))}
        </section>

        {/* Traffic Signs Gallery */}
        <section className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">
            Sinais de Trânsito Essenciais
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {SIGN_KEYS.map((key) => (
              <div
                key={key}
                className="p-4 rounded-xl bg-[#161B29] border border-white/[0.06] flex flex-col items-center text-center gap-3"
              >
                <TrafficSignDisplay signType={key} size="sm" />
                <p className="text-xs font-semibold text-slate-200">
                  {SIGN_LABELS[key]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
