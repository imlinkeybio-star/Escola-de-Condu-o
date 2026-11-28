'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Globe, KeyRound, LogIn, Mail } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { toUserFriendlyError } from '@/lib/error-messages';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const { signInWithGoogle, signInWithEmail, resetPassword } = useAuth();
  const { dict } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(
    searchParams.get('reset') === '1'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.push(nextPath);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(dict.auth.emailNotEnabledLogin);
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError(dict.auth.invalidCredentials);
      } else {
        setError(toUserFriendlyError(err, dict.auth.loginError));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError(dict.auth.resetEmailRequired);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setInfo(dict.auth.resetEmailSent);
    } catch (err) {
      setError(toUserFriendlyError(err, dict.auth.resetEmailError));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push(nextPath);
    } catch (err) {
      setError(toUserFriendlyError(err, dict.auth.googleError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
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
            {resetMode ? dict.auth.resetTitle : dict.auth.loginTitle}
          </h1>
          <p className="text-sm text-slate-400">
            {resetMode ? dict.auth.resetSubtitle : dict.auth.loginSubtitle}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 leading-relaxed">
            {error}
          </div>
        )}
        {info && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 leading-relaxed">
            {info}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          {dict.landing.signInGoogle}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>{dict.auth.orWithEmail}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {resetMode ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                {dict.auth.emailLabel}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.auth.emailPlaceholder}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              {dict.auth.sendRecoveryEmail}
            </button>
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-xs text-slate-400 hover:text-white py-1 cursor-pointer"
            >
              {dict.auth.backToLogin}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                {dict.auth.emailLabel}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.auth.emailPlaceholder}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-300">
                  {dict.auth.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                >
                  {dict.auth.forgotPassword}
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              {loading ? dict.auth.loggingIn : dict.common.enter}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400">
          {dict.auth.noAccountYet}{' '}
          <Link
            href="/registar"
            className="text-red-400 hover:text-red-300 font-semibold"
          >
            {dict.auth.registerFreeLink}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F]" />}>
      <LoginFormContent />
    </Suspense>
  );
}
