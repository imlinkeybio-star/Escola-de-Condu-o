'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  Mail,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { updateUserProfileDetails } from '@/lib/firestore-service';

export function AccountSecurityCard() {
  const { user, privateInfo, refreshProfile, markTotpVerified } = useAuth();

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Reset password states
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');

  // TOTP (Google Authenticator) states
  const [setupLoading, setSetupLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [pendingSealedSecret, setPendingSealedSecret] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [disableOtpInput, setDisableOtpInput] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [totpSuccess, setTotpSuccess] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!user) return null;

  const hasPasswordProvider = user.providerData.some(
    (p) => p.providerId === 'password'
  );
  const isTotpEnabled = Boolean(
    privateInfo?.totpEnabled && privateInfo?.totpSealedSecret
  );

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('A confirmação da palavra-passe não coincide.');
      return;
    }
    if (!user.email) {
      setPwError('A tua conta não tem um email associado.');
      return;
    }

    setPwLoading(true);
    try {
      if (hasPasswordProvider) {
        if (!currentPassword) {
          setPwError('Insere a tua palavra-passe atual para confirmar.');
          setPwLoading(false);
          return;
        }
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPassword);
        setPwSuccess('Palavra-passe atualizada com sucesso!');
      } else {
        const cred = EmailAuthProvider.credential(user.email, newPassword);
        try {
          await linkWithCredential(user, cred);
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code || '';
          if (code === 'auth/requires-recent-login') {
            await reauthenticateWithPopup(user, googleProvider);
            await linkWithCredential(user, cred);
          } else {
            throw err;
          }
        }
        setPwSuccess(
          'Palavra-passe definida! Agora também podes entrar com email e palavra-passe.'
        );
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setPwError('A palavra-passe atual está incorreta.');
      } else if (code === 'auth/weak-password') {
        setPwError('A nova palavra-passe é demasiado fraca (mínimo 6 caracteres).');
      } else if (code === 'auth/requires-recent-login') {
        setPwError(
          'Por segurança, termina a sessão e volta a entrar antes de alterar a palavra-passe.'
        );
      } else {
        setPwError(
          err instanceof Error
            ? err.message
            : 'Não foi possível alterar a palavra-passe.'
        );
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    setResetErr('');
    setResetMsg('');
    if (!user.email) {
      setResetErr('Nenhum email associado à conta.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetMsg(
        `Enviámos um link de redefinição de palavra-passe para ${user.email}.`
      );
    } catch (err) {
      setResetErr(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o email de redefinição.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleStartTotpSetup = async () => {
    setTotpError('');
    setTotpSuccess('');
    setSetupLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = (await res.json()) as {
        qrDataUrl?: string;
        manualKey?: string;
        pendingSealedSecret?: string;
        error?: string;
      };
      if (!res.ok || !data.qrDataUrl || !data.pendingSealedSecret) {
        throw new Error(
          data.error || 'Erro ao gerar QR Code do Google Authenticator.'
        );
      }
      setQrDataUrl(data.qrDataUrl);
      setManualKey(data.manualKey || '');
      setPendingSealedSecret(data.pendingSealedSecret);
      setOtpInput('');
    } catch (err) {
      setTotpError(
        err instanceof Error ? err.message : 'Erro ao iniciar 2FA.'
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    setTotpSuccess('');
    setTotpBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: 'enable',
          code: otpInput,
          sealedSecret: pendingSealedSecret,
        }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        sealedTotpSecret?: string;
        error?: string;
      };
      if (!res.ok || !data.verified || !data.sealedTotpSecret) {
        throw new Error(data.error || 'Código OTP inválido.');
      }

      await updateUserProfileDetails(user.uid, {
        totpEnabled: true,
        totpSealedSecret: data.sealedTotpSecret,
      });
      markTotpVerified(true);
      await refreshProfile();
      setQrDataUrl('');
      setManualKey('');
      setPendingSealedSecret('');
      setOtpInput('');
      setTotpSuccess(
        'Autenticação em 2 Fatores (Google Authenticator) ativada com sucesso!'
      );
    } catch (err) {
      setTotpError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o código OTP.'
      );
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateInfo?.totpSealedSecret) return;
    setTotpError('');
    setTotpSuccess('');
    setTotpBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: 'disable',
          code: disableOtpInput,
          sealedSecret: privateInfo.totpSealedSecret,
        }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        error?: string;
      };
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'Código OTP inválido.');
      }

      await updateUserProfileDetails(user.uid, {
        totpEnabled: false,
        totpSealedSecret: null,
      });
      markTotpVerified(false);
      await refreshProfile();
      setDisableOtpInput('');
      setTotpSuccess('Google Authenticator desativado.');
    } catch (err) {
      setTotpError(
        err instanceof Error
          ? err.message
          : 'Não foi possível desativar o Google Authenticator.'
      );
    } finally {
      setTotpBusy(false);
    }
  };

  const handleCopyManualKey = async () => {
    if (!manualKey) return;
    try {
      await navigator.clipboard.writeText(manualKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="space-y-5 min-w-0">
      {/* Password Edit & Reset Card */}
      <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">
                {hasPasswordProvider
                  ? 'Editar Palavra-Passe'
                  : 'Definir Palavra-Passe'}
              </h3>
              <p className="text-xs text-slate-400">
                {hasPasswordProvider
                  ? 'Atualiza a tua palavra-passe de acesso com segurança.'
                  : 'Entraste com Google — define uma palavra-passe para também acederes por email.'}
              </p>
            </div>
          </div>
          <Link
            href="/entrar?reset=1"
            className="text-xs font-semibold text-red-400 hover:text-red-300 whitespace-nowrap"
          >
            Página de Reset
          </Link>
        </div>

        {pwError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
            {pwSuccess}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-3">
          {hasPasswordProvider && (
            <div>
              <label className="text-xs text-slate-300 font-medium">
                Palavra-passe atual
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1 focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-medium">
                Nova palavra-passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium">
                Confirmar nova palavra-passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repete a nova palavra-passe"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwLoading}
              className="min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-4 h-4 shrink-0" />
              {pwLoading
                ? 'A guardar...'
                : hasPasswordProvider
                  ? 'Atualizar Palavra-Passe'
                  : 'Definir Palavra-Passe'}
            </button>

            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={resetLoading || !user.email}
              className="min-h-[44px] px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Mail className="w-4 h-4 shrink-0 text-amber-400" />
              {resetLoading
                ? 'A enviar...'
                : 'Enviar Email de Reset de Password'}
            </button>
          </div>
        </form>

        {resetErr && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
            {resetErr}
          </div>
        )}
        {resetMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
            {resetMsg}
          </div>
        )}
      </div>

      {/* Google Authenticator OTP Card */}
      <div className="bg-[#111520] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">
                OTP via Google Authenticator (2FA)
              </h3>
              <p className="text-xs text-slate-400">
                Protege a tua conta com códigos temporários de 6 dígitos (TOTP).
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${
              isTotpEnabled ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {isTotpEnabled ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                Ativo
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                Inativo
              </>
            )}
          </span>
        </div>

        {totpError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
            {totpError}
          </div>
        )}
        {totpSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
            {totpSuccess}
          </div>
        )}

        {isTotpEnabled ? (
          <form
            onSubmit={handleDisableTotp}
            className="bg-[#090C14] border border-white/10 rounded-xl p-4 space-y-3"
          >
            <p className="text-xs text-slate-300 leading-relaxed">
              O Google Authenticator está ativo. Sempre que iniciares sessão num
              novo navegador, será pedido o código OTP de 6 dígitos. Para
              desativar, confirma com o código atual da aplicação:
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={disableOtpInput}
                onChange={(e) =>
                  setDisableOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Código OTP (6 dígitos)"
                className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#111520] border border-white/15 text-sm font-mono-tabular tracking-widest text-white focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={totpBusy || disableOtpInput.length !== 6}
                className="min-h-[42px] px-4 rounded-xl bg-red-600/25 hover:bg-red-600/40 border border-red-500/40 disabled:opacity-50 text-red-200 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {totpBusy ? 'A validar...' : 'Desativar 2FA'}
              </button>
            </div>
          </form>
        ) : !qrDataUrl ? (
          <button
            type="button"
            onClick={handleStartTotpSetup}
            disabled={setupLoading}
            className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            {setupLoading
              ? 'A gerar código QR...'
              : 'Configurar Google Authenticator'}
          </button>
        ) : (
          <form
            onSubmit={handleEnableTotp}
            className="bg-[#090C14] border border-white/10 rounded-xl p-4 space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="bg-white p-2 rounded-xl shrink-0">
                <Image
                  src={qrDataUrl}
                  alt="Código QR Google Authenticator"
                  width={168}
                  height={168}
                  className="w-40 h-40 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-2.5 flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-white">
                  1. Lê o QR Code no Google Authenticator
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Abre a app Google Authenticator no teu telemóvel, toca em
                  &ldquo;+&rdquo; e lê este código QR (ou copia a chave manual
                  abaixo).
                </p>
                {manualKey && (
                  <div className="flex items-center gap-2 bg-[#111520] border border-white/10 rounded-lg px-2.5 py-2 min-w-0">
                    <code className="text-[11px] font-mono-tabular text-amber-300 truncate flex-1">
                      {manualKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyManualKey}
                      className="text-xs font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white block">
                2. Insere o código de 6 dígitos gerado pela app
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) =>
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#111520] border border-white/15 text-base font-mono-tabular tracking-[0.35em] text-center text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={totpBusy || otpInput.length !== 6}
                  className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {totpBusy ? 'A verificar...' : 'Confirmar e Ativar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
