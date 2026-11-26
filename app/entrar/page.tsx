'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound, LogIn, Mail } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const { signInWithGoogle, signInWithEmail, resetPassword } = useAuth();

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
        setError(
          'O login por email/palavra-passe ainda não está ativado na Consola Firebase (Authentication > Sign-in method > Email/Password). Usa o botão "Entrar com Google" abaixo.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Email ou palavra-passe incorretos.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Erro ao iniciar sessão.'
        );
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
      setError('Indica o teu email para recuperar a palavra-passe.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setInfo(
        'Enviámos um link de recuperação para o teu email. Verifica a caixa de entrada.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o email de recuperação.'
      );
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
      setError(
        err instanceof Error ? err.message : 'Erro ao entrar com Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="bg-white/95 rounded-xl px-2.5 py-1 shadow-sm ring-1 ring-white/15 flex items-center justify-center">
            <Image
              src="/assets/aistudio/favicon_14076ff5.png"
              alt="Escola de Condução Live"
              width={72}
              height={48}
              className="h-10 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold text-white">
            {resetMode ? 'Recuperar Palavra-Passe' : 'Entrar na Plataforma'}
          </h1>
          <p className="text-sm text-slate-400">
            {resetMode
              ? 'Insere o teu email para receberes instruções de recuperação.'
              : 'Acede às salas ao vivo e acompanha a tua pontuação.'}
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
          Entrar com Google
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>ou com email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {resetMode ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aluno@exemplo.ao"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              Enviar Email de Recuperação
            </button>
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-xs text-slate-400 hover:text-white py-1 cursor-pointer"
            >
              Voltar ao Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aluno@exemplo.ao"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Palavra-passe
                </label>
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Esqueceste a palavra-passe?
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
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400">
          Ainda não tens conta?{' '}
          <Link
            href="/registar"
            className="text-red-400 hover:text-red-300 font-semibold"
          >
            Registar-se gratuitamente
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
