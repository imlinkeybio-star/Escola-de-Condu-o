'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Award,
  Globe,
  LogIn,
  Play,
  Radio,
  ShieldCheck,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { findRoomByCode } from '@/lib/firestore-service';
import heroCarImg from '@/src/assets/images/hero_angola_highway_car_1795615139713.jpg';
import examinerImg from '@/src/assets/images/virtual_examiner_angola_1795615139196.jpg';
import trophyImg from '@/src/assets/images/trophy_gold_emblem_1795615139789.jpg';

export default function HomePage() {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const { dict, meta } = useLanguage();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode.trim()) return;
    if (!user) {
      router.push(`/entrar?code=${encodeURIComponent(joinCode.trim().toUpperCase())}`);
      return;
    }
    setJoining(true);
    try {
      const room = await findRoomByCode(joinCode);
      if (!room) {
        setJoinError(dict.landing.noPublicRoomFound);
      } else {
        router.push(`/sala/${room.roomId}`);
      }
    } catch {
      setJoinError(dict.landing.roomSearchError);
    } finally {
      setJoining(false);
    }
  };

  const handleEnterGame = async () => {
    if (user) {
      router.push('/dashboard');
      return;
    }
    router.push('/entrar');
  };

  return (
    <div className="min-h-screen bg-[#07090F] text-slate-50 flex flex-col w-full max-w-full overflow-x-clip pt-16">
      {/* Fixed Top Bar on Scroll (3 zones) */}
      <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/[0.08] bg-[#07090F]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <Link
            href="/"
            className="flex items-center gap-3 whitespace-nowrap shrink-0"
          >
            <div className="bg-white/95 rounded-xl px-2 py-0.5 shadow-sm ring-1 ring-white/15 flex items-center justify-center">
              <Image
                src="/assets/aistudio/favicon_14076ff5.png"
                alt={dict.common.brandName}
                width={60}
                height={40}
                className="h-9 w-auto object-contain"
                priority
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display text-lg sm:text-xl font-extrabold tracking-wide text-white hidden sm:inline uppercase">
              {dict.common.brandName}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <Link
              href="/salas"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {dict.nav.salas}
            </Link>
            <Link
              href="/ranking"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {dict.nav.rankingsNav}
            </Link>
            <Link
              href="/regras"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {dict.nav.highwayCode}
            </Link>
            <Link
              href="/conquistas"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {dict.nav.conquistas}
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/idiomas"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{meta.shortCode}</span>
              <span className="hidden sm:inline text-slate-400">· {dict.nav.idiomas}</span>
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {dict.landing.goToDashboard}
              </Link>
            ) : (
              <Link
                href="/entrar"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {dict.common.enter}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0">
          <Image
            src={heroCarImg}
            alt={dict.common.brandName}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090F] via-[#07090F]/75 to-[#07090F]/45" />
          <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[#07090F] via-[#07090F]/70 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-amber-400">
                  {dict.landing.tagline}
                </p>
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[0.95] text-balance uppercase">
                  {dict.common.brandShort}{' '}
                  <span className="inline-block px-3 py-0.5 bg-red-600 text-white rounded-xl ms-1">
                    LIVE
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-slate-200 max-w-2xl pt-2">
                  {dict.landing.heroDesc}
                </p>
              </div>

              {/* Primary & Secondary CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  onClick={handleEnterGame}
                  className="min-h-[52px] px-7 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base inline-flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {dict.landing.enterGame}
                </button>
                {!user && (
                  <>
                    <Link
                      href="/registar"
                      className="min-h-[52px] px-6 py-3.5 rounded-xl bg-[#111520]/90 hover:bg-[#192033] border border-white/15 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      {dict.landing.registerFree}
                    </Link>
                    <button
                      onClick={() => signInWithGoogle().then(() => router.push('/dashboard')).catch(() => {})}
                      className="min-h-[52px] px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <LogIn className="w-4 h-4" />
                      {dict.landing.signInGoogle}
                    </button>
                  </>
                )}
              </div>

              {/* Quick Invite Code Join */}
              <form
                onSubmit={handleQuickJoin}
                className="max-w-md pt-2 space-y-2"
              >
                <label className="block text-xs font-medium text-slate-300">
                  {dict.landing.invitePrompt}
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={dict.landing.invitePlaceholder}
                    maxLength={12}
                    className="flex-1 min-w-0 min-h-[46px] px-4 rounded-xl bg-[#0D111C]/90 border border-white/15 text-white font-mono-tabular uppercase placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={joining}
                    className="min-h-[46px] px-5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{joining ? dict.landing.joining : dict.common.enter}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {joinError && (
                  <p className="text-xs text-red-400">{joinError}</p>
                )}
              </form>
            </motion.div>

            {/* Right Visual Showcase Card */}
            <div className="lg:col-span-5">
              <div className="bg-[#111520]/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/30 shrink-0">
                    <Image
                      src={trophyImg}
                      alt={dict.landing.simultaneousTitle}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      {dict.landing.simultaneousTitle}
                    </p>
                    <h2 className="text-xl font-bold text-white">
                      {dict.landing.angolaHighwayCode}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {dict.landing.simultaneousMeta}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#171C2B] border border-white/[0.06]">
                  <div className="relative w-14 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                    <Image
                      src={examinerImg}
                      alt={dict.landing.examinerTitle}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">
                      {dict.landing.examinerTitle}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      {dict.landing.examinerDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
            <Radio className="w-6 h-6 text-red-500" />
            <h3 className="text-base font-bold text-white">
              {dict.landing.pillar1Title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {dict.landing.pillar1Desc}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
            <Volume2 className="w-6 h-6 text-sky-400" />
            <h3 className="text-base font-bold text-white">
              {dict.landing.pillar2Title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {dict.landing.pillar2Desc}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {dict.landing.pillar3Title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {dict.landing.pillar3Desc}
            </p>
          </div>
          <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
            <Award className="w-6 h-6 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {dict.landing.pillar4Title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {dict.landing.pillar4Desc}
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-white/[0.08] py-6 px-4 text-center text-xs text-slate-500">
        {dict.landing.footer}
      </footer>
    </div>
  );
}
