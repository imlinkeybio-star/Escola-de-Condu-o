'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Eye,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  Maximize2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  Video,
  Volume2,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import {
  FacebookStyleAdCard,
  FullscreenVideoAdModal,
} from '@/components/FacebookAdUnit';
import { StaffPermissionsManager } from '@/components/StaffPermissionsManager';
import { BroadcastItem, BroadcastKind } from '@/lib/types';
import {
  createOwnerBroadcast,
  deleteOwnerBroadcast,
  toggleOwnerBroadcastActive,
} from '@/lib/firestore-service';
import {
  APP_OWNER_EMAIL,
  APP_OWNER_USERNAME,
  sanitizeSafeUrl,
} from '@/lib/url-safety';

const KIND_OPTIONS: Array<{ value: BroadcastKind; label: string; desc: string }> = [
  {
    value: 'informative',
    label: 'Notificação Informativa',
    desc: 'Aviso pedagógico, novidade ou alerta oficial.',
  },
  {
    value: 'link',
    label: 'Notificação com Link Clicável',
    desc: 'Direciona alunos para uma página interna ou site externo.',
  },
  {
    value: 'ad_banner',
    label: 'Anúncio Banner Facebook (10s / 15min)',
    desc: 'Cartão patrocinado no estilo Facebook abaixo da barra superior.',
  },
  {
    value: 'ad_audio',
    label: 'Anúncio de Áudio (MP3 ou Voz IA)',
    desc: 'Reprodutor de áudio ou locução automática em português.',
  },
  {
    value: 'ad_video',
    label: 'Anúncio de Vídeo em Tela Inteira (Modelo Facebook)',
    desc: 'Reprodução em tela cheia com pré-visualização limpa e sem definições ou spoilers do site de origem.',
  },
];

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

export default function DonoAnunciosPage() {
  const { user, isOwner, canAnnounce, loading } = useAuth();
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [section, setSection] = useState<'anuncios' | 'permissoes'>('anuncios');

  // Form states
  const [kind, setKind] = useState<BroadcastKind>('ad_banner');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('Saber Mais');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showInBanner, setShowInBanner] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [aiGenerated, setAiGenerated] = useState(false);

  const [generatingAi, setGeneratingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [previewModalAd, setPreviewModalAd] = useState<BroadcastItem | null>(
    null
  );

  const canAccess = isOwner || canAnnounce;

  useEffect(() => {
    if (!user || !canAccess) return;
    const q = query(collection(db, 'broadcasts'), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as BroadcastItem), id: d.id }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setBroadcasts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'broadcasts')
    );
    return () => unsub();
  }, [user, canAccess]);

  if (!loading && !canAccess) {
    return (
      <AppShell title="Área Reservada a Anúncios">
        <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-3 max-w-lg mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">
            Acesso Restrito
          </h2>
          <p className="text-sm text-slate-400">
            Apenas {APP_OWNER_EMAIL} e utilizadores com permissão para anunciar
            podem aceder a esta tela reservada.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleGenerateAi = async () => {
    setError('');
    setFeedback('');
    if (topic.trim().length < 3) {
      setError('Escreve um tema ou ideia curta para a IA redigir o anúncio/notificação.');
      return;
    }
    setGeneratingAi(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Sessão expirada.');
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/ai/generate-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ kind, topic }),
      });
      const json = (await res.json()) as {
        title?: string;
        body?: string;
        suggestedLinkLabel?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar com IA.');
      setTitle(json.title || '');
      setBody(json.body || '');
      if (json.suggestedLinkLabel) setLinkLabel(json.suggestedLinkLabel);
      setAiGenerated(true);
      setFeedback('Texto gerado com IA em tempo real! Revê os campos e clica em Publicar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar com IA.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    setSaving(true);
    try {
      const created = await createOwnerBroadcast({
        kind,
        title,
        body,
        linkUrl: linkUrl.trim() || undefined,
        linkLabel: linkUrl.trim() ? linkLabel.trim() || 'Abrir Link' : undefined,
        mediaUrl: mediaUrl.trim() || undefined,
        aiGenerated,
        active: true,
        showInBanner,
        durationSeconds,
        cooldownMinutes,
      });
      setTitle('');
      setBody('');
      setTopic('');
      setLinkUrl('');
      setMediaUrl('');
      setAiGenerated(false);
      setFeedback(`Publicado em tempo real: "${created.title}"!`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao publicar anúncio/notificação.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestLiveBanner = (item: BroadcastItem) => {
    window.dispatchEvent(new CustomEvent('escola:preview-ad', { detail: item }));
    setFeedback(`A pré-visualizar "${item.title}" no topo abaixo da topbar (${item.durationSeconds}s).`);
  };

  const draftPreviewAd: BroadcastItem = {
    id: 'draft_preview',
    kind,
    title: title.trim() || 'Aprende o Código de Estrada com Simulados ao Vivo',
    body:
      body.trim() ||
      'Prepara-te para o exame oficial de condução em Angola com perguntas geradas em tempo real.',
    linkUrl: linkUrl.trim() || undefined,
    linkLabel: linkLabel.trim() || 'Saber Mais',
    mediaUrl: mediaUrl.trim() || undefined,
    aiGenerated,
    active: true,
    showInBanner,
    durationSeconds,
    cooldownMinutes,
    createdByUid: user?.uid || 'owner',
    createdByEmail: user?.email || APP_OWNER_EMAIL,
    createdAt: null,
    updatedAt: null,
  };

  return (
    <AppShell title={isOwner ? 'Anúncios & Notificações (Dono)' : 'Anúncios & Notificações'}>
      {previewModalAd && (
        <FullscreenVideoAdModal
          ad={previewModalAd}
          isPreview
          onClose={() => setPreviewModalAd(null)}
        />
      )}
      <div className="space-y-6 min-w-0">
        <div className="bg-[#111520] border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              {isOwner
                ? `Área Reservada ao Dono da App · @${APP_OWNER_USERNAME}`
                : 'Área Reservada · Equipa Autorizada a Anunciar'}
            </p>
            <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">
              Gestão de Notificações IA & Anúncios Multimédia
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Os anúncios ativos aparecem no topo abaixo da topbar durante 10s,
              com intervalo de 15 minutos entre exibições e botão X para os
              alunos fecharem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {isOwner && (
              <Link
                href="/permissoes"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Emails & Permissões
              </Link>
            )}
            <Link
              href="/notificacoes"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold whitespace-nowrap"
            >
              Ver Mural dos Alunos
            </Link>
          </div>
        </div>

        {isOwner && (
          <div className="flex flex-wrap gap-1.5 p-1 bg-[#111520] border border-white/[0.08] rounded-xl w-fit max-w-full">
            <button
              type="button"
              onClick={() => setSection('anuncios')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                section === 'anuncios'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Anúncios & Notificações
            </button>
            <button
              type="button"
              onClick={() => setSection('permissoes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                section === 'permissoes'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Gerir Emails Permitidos
            </button>
          </div>
        )}

        {isOwner && section === 'permissoes' ? (
          <StaffPermissionsManager />
        ) : (
          <>
            {feedback && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs sm:text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Creation Form */}
          <form
            onSubmit={handlePublish}
            className="lg:col-span-6 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 min-w-0"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-red-500" />
              Criar Nova Notificação ou Anúncio
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Tipo de Comunicação
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as BroadcastKind)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
              >
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                {KIND_OPTIONS.find((o) => o.value === kind)?.desc}
              </p>
            </div>

            {/* AI Drafting Box */}
            <div className="p-3.5 rounded-xl bg-[#161B29] border border-amber-500/25 space-y-2.5">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Gerar Conteúdo em Tempo Real com IA Gemini
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: Promover aulas práticas de condução em Luanda"
                  className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={generatingAi}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generatingAi ? 'A gerar...' : 'Gerar com IA'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Título
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título claro da notificação ou anúncio"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Mensagem / Texto
              </label>
              <textarea
                required
                rows={3}
                minLength={2}
                maxLength={600}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Texto informativo ou promocional..."
                className="w-full p-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Link Clicável (opcional)
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://... ou /salas"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Texto do Botão do Link
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Saber Mais"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
              </div>
            </div>

            {(kind === 'ad_audio' || kind === 'ad_video' || kind === 'ad_banner') && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  {kind === 'ad_audio' ? (
                    <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                  ) : kind === 'ad_banner' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-red-400" />
                  )}
                  {kind === 'ad_audio'
                    ? 'URL do Áudio MP3/WAV (deixa vazio para usar Voz IA Portuguesa)'
                    : kind === 'ad_banner'
                      ? 'URL da Imagem do Banner (opcional)'
                      : 'URL do Vídeo (exibido em tela inteira sem mostrar o site de origem)'}
                </label>
                <input
                  type="text"
                  required={kind === 'ad_video'}
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder={
                    kind === 'ad_audio'
                      ? 'https://exemplo.com/audio.mp3 (opcional)'
                      : kind === 'ad_banner'
                        ? 'https://exemplo.com/imagem-anuncio.jpg (opcional)'
                        : 'https://... (MP4 direto ou link do vídeo)'
                  }
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-xs text-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Duração por Anúncio (seg)
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Intervalo entre Ads (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white font-mono-tabular"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={showInBanner}
                onChange={(e) => setShowInBanner(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              <span>
                Exibir automaticamente no topo abaixo da topbar (telas
                principais e jogo)
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {(kind === 'ad_video' || kind === 'ad_banner') && (
                <button
                  type="button"
                  onClick={() =>
                    kind === 'ad_video'
                      ? setPreviewModalAd(draftPreviewAd)
                      : handleTestLiveBanner(draftPreviewAd)
                  }
                  className="min-h-[48px] px-4 rounded-xl bg-[#1877F2]/20 hover:bg-[#1877F2]/30 border border-[#1877F2]/50 text-sky-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Maximize2 className="w-4 h-4" />
                  {kind === 'ad_video'
                    ? 'Pré-visualizar Tela Cheia'
                    : 'Pré-visualizar no Topo'}
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-[48px] px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
              >
                {saving
                  ? 'A publicar em tempo real...'
                  : 'Publicar Notificação / Anúncio Agora'}
              </button>
            </div>
          </form>

          {/* Live Facebook Preview + Active & Past Broadcasts List */}
          <div className="lg:col-span-6 space-y-5 min-w-0">
            {(kind === 'ad_banner' || kind === 'ad_video') && (
              <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Pré-visualização (Modelo Facebook)
                  </h3>
                  {kind === 'ad_video' && (
                    <button
                      type="button"
                      onClick={() => setPreviewModalAd(draftPreviewAd)}
                      className="px-3 py-1.5 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Abrir Tela Inteira
                    </button>
                  )}
                </div>
                <FacebookStyleAdCard
                  ad={draftPreviewAd}
                  onOpenFullscreen={(ad) => setPreviewModalAd(ad)}
                />
              </div>
            )}

            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Publicações Definidas ({broadcasts.length})
              </h3>
            </div>

            {broadcasts.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Ainda não definiste nenhum anúncio ou notificação.
              </p>
            ) : (
              <div className="space-y-3">
                {broadcasts.map((item) => {
                  const safeLink = sanitizeSafeUrl(item.linkUrl);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border space-y-2.5 ${
                        item.active
                          ? 'bg-[#161B29] border-white/10'
                          : 'bg-[#0C0F18] border-white/[0.04] opacity-65'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            {item.kind} · {item.durationSeconds}s /{' '}
                            {item.cooldownMinutes}min
                            {item.aiGenerated ? ' · IA' : ''}
                          </span>
                          <p className="text-sm font-bold text-white break-words mt-0.5">
                            {item.title}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                            item.active
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {item.active ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 break-words">
                        {item.body}
                      </p>

                      {safeLink && (
                        <p className="text-[11px] text-sky-400 inline-flex items-center gap-1 break-all">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {safeLink}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.kind === 'ad_video' && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalAd(item)}
                            className="px-3 py-1.5 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Tela Cheia
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTestLiveBanner(item)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Testar {item.durationSeconds}s
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void toggleOwnerBroadcastActive(
                              item.id,
                              !item.active
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          {item.active ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              Ativar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteOwnerBroadcast(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/35 text-red-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Apagar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
