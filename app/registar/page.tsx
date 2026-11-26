'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Car, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ANGOLA_PROVINCES } from '@/lib/types';

export default function RegistarPage() {
  const router = useRouter();
  const { registerWithEmail, signInWithGoogle } = useAuth();

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
      setError('O nome de utilizador deve ter pelo menos 2 caracteres.');
      return;
    }
    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
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
        setError(
          'O registo por email/palavra-passe ainda não está ativado na Consola Firebase (Authentication > Sign-in method > Email/Password). Podes criar conta imediatamente clicando em "Registar com Google".'
        );
      } else if (code === 'auth/email-already-in-use') {
        setError('Este email já está registado. Tenta iniciar sessão.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Erro ao criar conta.'
        );
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
      setError(
        err instanceof Error ? err.message : 'Erro ao registar com Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111520] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold text-white">
            Criar Conta de Aluno
          </h1>
          <p className="text-sm text-slate-400">
            Compete com alunos de todo o país e prepara-te para o exame oficial.
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
          Registar com Google
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>ou com email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Nome de Utilizador
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Gilberto Spranger"
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@exemplo.ao"
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Palavra-passe (mín. 6 caracteres)
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
                Escola de Condução
              </label>
              <input
                type="text"
                maxLength={120}
                value={drivingSchool}
                onChange={(e) => setDrivingSchool(e.target.value)}
                placeholder="Opcional"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Província
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
            {loading ? 'A criar conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Já tens conta?{' '}
          <Link
            href="/entrar"
            className="text-red-400 hover:text-red-300 font-semibold"
          >
            Iniciar Sessão
          </Link>
        </p>
      </div>
    </div>
  );
}
