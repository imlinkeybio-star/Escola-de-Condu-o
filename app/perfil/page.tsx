'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Award,
  Camera,
  Check,
  Edit3,
  Flame,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { AccountSecurityCard } from '@/components/AccountSecurityCard';
import {
  LiveAnswerBreakdownBar,
  LiveTrendSvgChart,
} from '@/components/LivePerformanceCharts';
import {
  AchievementRecord,
  ACHIEVEMENTS_CATALOG,
  ANGOLA_PROVINCES,
  UserResult,
} from '@/lib/types';
import { updateUserProfileDetails } from '@/lib/firestore-service';
import defaultAvatarImg from '@/src/assets/images/avatar_driver_default_1795615140872.jpg';

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

async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleciona um ficheiro de imagem válido (JPG, PNG ou WebP).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem original não pode exceder 8 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      el.src = objectUrl;
    });

    const targetSize = 160;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Navegador sem suporte a processamento de imagem.');

    // Center-crop square
    const minSide = Math.min(img.width, img.height);
    const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
    const sy = Math.max(0, Math.floor((img.height - minSide) / 2));
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

    let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 75000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    }
    if (dataUrl.length > 78000) {
      throw new Error('Imagem demasiado detalhada. Tenta uma foto mais simples.');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const PRESET_AVATARS = [
  { label: 'Logo Oficial', value: '/assets/aistudio/favicon_14076ff5.png' },
  {
    label: 'Condutor Estrada',
    value: 'https://picsum.photos/seed/condutor-angola/200/200',
  },
  {
    label: 'Luanda Noite',
    value: 'https://picsum.photos/seed/luanda-drive/200/200',
  },
];

export default function PerfilPage() {
  const { user, profile, privateInfo, refreshProfile } = useAuth();
  const [tab, setTab] = useState<'desempenho' | 'conquistas' | 'seguranca'>(
    'desempenho'
  );
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [drivingSchool, setDrivingSchool] = useState('');
  const [province, setProvince] = useState('Luanda');
  const [photoDraft, setPhotoDraft] = useState<string>('');
  const [photoTouched, setPhotoTouched] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);

  useEffect(() => {
    if (!user) return;
    const aq = query(
      collection(db, 'achievements'),
      where('uid', '==', user.uid)
    );
    const unsubA = onSnapshot(
      aq,
      (snap) =>
        setAchievements(snap.docs.map((d) => d.data() as AchievementRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'achievements')
    );

    const rq = query(
      collection(db, 'results'),
      where('uid', '==', user.uid),
      limit(20)
    );
    const unsubR = onSnapshot(
      rq,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserResult)
          .sort((a, b) => toMillis(b.finishedAt) - toMillis(a.finishedAt));
        setResults(list);
      },
      () => {}
    );

    return () => {
      unsubA();
      unsubR();
    };
  }, [user]);

  const openEditor = () => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setDrivingSchool(privateInfo?.drivingSchool || '');
    setProvince(privateInfo?.province || 'Luanda');
    setPhotoDraft(profile.photoURL || '');
    setPhotoTouched(false);
    setEditError('');
    setEditSuccess('');
    setEditing((p) => !p);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditError('');
    setPhotoBusy(true);
    try {
      const compressed = await compressAvatarFile(file);
      setPhotoDraft(compressed);
      setPhotoTouched(true);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Erro ao carregar foto.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEditError('');
    setEditSuccess('');
    setSaving(true);
    try {
      await updateUserProfileDetails(user.uid, {
        displayName,
        drivingSchool,
        province,
        ...(photoTouched
          ? { photoURL: photoDraft.trim() ? photoDraft.trim() : null }
          : {}),
      });

      // Keep Firebase Auth profile aligned when name changes or photo is a short HTTP URL
      try {
        const authUpdates: { displayName?: string; photoURL?: string | null } = {
          displayName: displayName.trim().slice(0, 60),
        };
        if (photoTouched) {
          if (!photoDraft.trim()) {
            authUpdates.photoURL = null;
          } else if (
            /^https?:\/\//i.test(photoDraft.trim()) &&
            photoDraft.trim().length <= 1500
          ) {
            authUpdates.photoURL = photoDraft.trim();
          }
        }
        await updateProfile(user, authUpdates);
      } catch {
        // Non-blocking Firebase Auth metadata sync
      }

      await refreshProfile();
      setEditing(false);
      setEditSuccess('Perfil e foto atualizados com sucesso!');
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : 'Não foi possível guardar as alterações.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) {
    return (
      <AppShell title="Meu Perfil">
        <div className="bg-[#111520] border border-white/10 rounded-2xl p-8 text-center">
          <Link
            href="/entrar"
            className="inline-block px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            Entrar para ver perfil
          </Link>
        </div>
      </AppShell>
    );
  }

  const accuracy =
    profile.totalAnswers > 0
      ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
      : 0;
  const avgPoints =
    profile.gamesPlayed > 0
      ? Math.round(profile.totalPoints / profile.gamesPlayed)
      : 0;
  const unlockedSet = new Set(achievements.map((a) => a.achievementId));

  // SVG circular gauge geometry
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (accuracy / 100) * circumference;

  const displayedPhoto = editing
    ? photoDraft || defaultAvatarImg
    : profile.photoURL || defaultAvatarImg;

  return (
    <AppShell title="Meu Perfil">
      <div className="max-w-4xl mx-auto space-y-6 min-w-0">
        {/* Profile Header Card */}
        <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 text-center space-y-4 relative min-w-0">
          <Link
            href="/definicoes"
            aria-label="Definições"
            className="absolute top-4 right-4 min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-300"
          >
            <Settings className="w-4 h-4" />
          </Link>

          <div className="relative w-24 h-24 mx-auto">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-amber-400/60 bg-[#090C14]">
              <Image
                src={displayedPhoto}
                alt={profile.displayName}
                fill
                sizes="96px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              type="button"
              onClick={openEditor}
              aria-label="Editar perfil e foto"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center border-2 border-[#111520] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white break-words">
              {profile.displayName}
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mt-1">
              {profile.tier} · {privateInfo?.province || 'Luanda'}
            </p>
            {privateInfo?.drivingSchool && (
              <p className="text-xs text-slate-400 mt-0.5 break-words">
                {privateInfo.drivingSchool}
              </p>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={openEditor}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editing ? 'Fechar Edição' : 'Editar Foto & Dados'}
              </button>
            </div>
          </div>

          {editSuccess && !editing && (
            <div className="max-w-md mx-auto p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200">
              {editSuccess}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md mx-auto pt-2">
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Star className="w-4 h-4 text-amber-400 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.totalPoints}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Pontos</p>
            </div>
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Trophy className="w-4 h-4 text-amber-400 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.wins}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Vitórias</p>
            </div>
            <div className="p-3 rounded-xl bg-[#161B29] min-w-0">
              <Flame className="w-4 h-4 text-red-500 mx-auto" />
              <p className="font-mono-tabular text-lg font-bold text-white mt-1">
                {profile.currentStreak}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Sequência</p>
            </div>
          </div>

          {editing && (
            <form
              onSubmit={handleSave}
              className="max-w-md mx-auto pt-4 border-t border-white/[0.08] space-y-4 text-left"
            >
              {editError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
                  {editError}
                </div>
              )}

              {/* Avatar Editor */}
              <div className="p-3.5 rounded-xl bg-[#090C14] border border-white/10 space-y-3">
                <p className="text-xs font-bold text-white">
                  Foto de Perfil (Picture)
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    {photoBusy ? 'A processar...' : 'Carregar do Dispositivo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>

                  {photoDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoDraft('');
                        setPhotoTouched(true);
                      }}
                      className="min-h-[38px] px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 text-xs font-semibold text-red-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover Foto
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setPhotoDraft(preset.value);
                        setPhotoTouched(true);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        photoDraft === preset.value
                          ? 'bg-red-600/25 border-red-500 text-white'
                          : 'bg-[#111520] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">
                    Ou link de imagem (https://...)
                  </label>
                  <input
                    type="text"
                    value={photoDraft.startsWith('data:') ? '' : photoDraft}
                    onChange={(e) => {
                      setPhotoDraft(e.target.value);
                      setPhotoTouched(true);
                    }}
                    placeholder={
                      photoDraft.startsWith('data:')
                        ? 'Foto carregada do dispositivo pronta a guardar'
                        : 'https://lh3.googleusercontent.com/...'
                    }
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#111520] border border-white/15 text-xs text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Nome</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Escola de Condução
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={drivingSchool}
                    onChange={(e) => setDrivingSchool(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Província</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1"
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving || photoBusy}
                className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {saving ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </form>
          )}
        </div>

        {/* Profile Tabs */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-[#111520] border border-white/[0.08] rounded-xl">
          <button
            onClick={() => setTab('desempenho')}
            className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer truncate ${
              tab === 'desempenho'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Desempenho
          </button>
          <button
            onClick={() => setTab('conquistas')}
            className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer truncate ${
              tab === 'conquistas'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Conquistas ({achievements.length})
          </button>
          <button
            onClick={() => setTab('seguranca')}
            className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 truncate ${
              tab === 'seguranca'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
            <span>Segurança</span>
          </button>
        </div>

        {tab === 'desempenho' ? (
          <div className="space-y-5">
            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-around gap-6">
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 110 110">
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="#1E2536"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="#22C55E"
                    strokeWidth="10"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="font-mono-tabular text-2xl font-extrabold text-white block">
                    {accuracy}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Taxa de Acerto
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 sm:gap-6 text-center sm:text-left">
                <div>
                  <p className="text-xs text-slate-400">Total de Jogos</p>
                  <p className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
                    {profile.gamesPlayed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Média de Pontos</p>
                  <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-0.5">
                    {avgPoints} pts
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Respostas Certas</p>
                  <p className="font-mono-tabular text-xl font-bold text-emerald-400 mt-0.5">
                    {profile.correctAnswers}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Melhor Sequência</p>
                  <p className="font-mono-tabular text-xl font-bold text-red-400 mt-0.5">
                    {profile.bestStreak}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
              <h3 className="text-base font-bold text-white">
                Progresso em Tempo Real
              </h3>
              <LiveAnswerBreakdownBar
                correctAnswers={profile.correctAnswers}
                totalAnswers={profile.totalAnswers}
              />
              <LiveTrendSvgChart results={results} height={170} />
            </div>
          </div>
        ) : tab === 'conquistas' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENTS_CATALOG.map((ach) => {
              const unlocked = unlockedSet.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                    unlocked
                      ? 'bg-[#111520] border-amber-400/40'
                      : 'bg-[#0C0F18] border-white/[0.05] opacity-55'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {ach.title}
                    </p>
                    <p className="text-xs text-slate-400">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <AccountSecurityCard />
        )}
      </div>
    </AppShell>
  );
}
