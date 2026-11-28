'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { ANGOLA_PROVINCES } from '@/lib/types';
import { toUserFriendlyError } from '@/lib/error-messages';

export default function RegistarPage() {
  const router = useRouter();
  const { registerWithEmail, signInWithGoogle } = useAuth();
  const { dict } = useLanguage();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [drivingSchool, setDrivingSchool] = useState('');
  const [province, setProvince] = useState('Luanda');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (displayName.trim().length < 2) {
      setError(dict.auth.usernameTooShort);
      return;
    }
    if (password.length < 6) {
      setError(dict.auth.passwordMin6);
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({
        email,
        password,
        displayName,
        drivingSchool,
        province,
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(dict.auth.emailNotEnabledRegister);
      } else if (code === 'auth/email-already-in-use') {
        setError(dict.auth.emailInUse);
      } else {
        setError(toUserFriendlyError(err, dict.auth.registerError));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      setError(toUserFriendlyError(err, dict.auth.googleRegisterError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {dict.common.back}
            </Link>
            <Link
              href="/idiomas"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              {dict.nav.idiomas}
            </Link>
          </div>
          <Image
            src="/assets/aistudio/favicon_14076ff5.png"
            alt={dict.common.brandName}
            width={72}
            height={48}
            className="h-10 w-auto object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold text-white">
            {dict.auth.createAccountTitle}
          </h1>
          <p className="text-sm text-slate-400">
            {dict.auth.createAccountSubtitle}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 leading-relaxed">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          {dict.auth.registerWithGoogle}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>{dict.auth.orWithEmail}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {dict.auth.usernameLabel}
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={dict.auth.usernamePlaceholder}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {dict.auth.emailLabel}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={dict.auth.emailPlaceholder}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {dict.auth.passwordMinLabel}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                {dict.auth.drivingSchoolLabel}
              </label>
              <input
                type="text"
                maxLength={120}
                value={drivingSchool}
                onChange={(e) => setDrivingSchool(e.target.value)}
                placeholder={dict.auth.optionalPlaceholder}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                {dict.auth.provinceLabel}
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              >
                {ANGOLA_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? dict.auth.creatingAccount : dict.auth.createAccountBtn}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          {dict.auth.alreadyHaveAccount}{' '}
          <Link
            href="/entrar"
            className="text-red-400 hover:text-red-300 font-semibold"
          >
            {dict.auth.signInLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
