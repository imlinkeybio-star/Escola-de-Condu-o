'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { googleProvider } from '@/lib/firebase';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { tFormat } from '@/lib/i18n';
import {
  deleteUserAccountData,
  factoryResetUserAccount,
  updateUserProfileDetails,
} from '@/lib/firestore-service';
import { toUserFriendlyError } from '@/lib/error-messages';

export default function ZonaRiscoPage() {
  const router = useRouter();
  const { user, privateInfo, refreshProfile, markTotpVerified, logout } =
    useAuth();
  const { dict } = useLanguage();

  // Inline TOTP setup if user hasn't enabled Google Authenticator yet
  const [setupLoading, setSetupLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [pendingSealedSecret, setPendingSealedSecret] = useState('');
  const [setupOtpInput, setSetupOtpInput] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Factory reset states (protected by Google Authenticator OTP)
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [factoryOtp, setFactoryOtp] = useState('');
  const [factoryBusy, setFactoryBusy] = useState(false);
  const [factoryError, setFactoryError] = useState('');
  const [factorySuccess, setFactorySuccess] = useState('');

  // Permanent deletion states (protected by Google Authenticator OTP)
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) {
    return (
      <AppShell title={dict.security.riskZonePageTitle}>
        <div className="max-w-md mx-auto bg-[#111520] border border-white/10 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm text-slate-300">{dict.common.enter}</p>
          <Link
            href="/entrar"
            className="inline-block px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
          >
            {dict.common.enter}
          </Link>
        </div>
      </AppShell>
    );
  }

  const hasPasswordProvider = user.providerData.some(
    (p) => p.providerId === 'password'
  );
  const isTotpEnabled = Boolean(
    privateInfo?.totpEnabled && privateInfo?.totpSealedSecret
  );

  const verifyGoogleAuthenticatorOtp = async (code: string): Promise<void> => {
    if (!privateInfo?.totpSealedSecret) {
      throw new Error(dict.security.totpRequiredBannerDesc);
    }
    const cleanCode = code.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      throw new Error(dict.security.otpRequiredErr);
    }
    const idToken = await user.getIdToken();
    const res = await fetch('/api/auth/totp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        mode: 'verify',
        code: cleanCode,
        sealedSecret: privateInfo.totpSealedSecret,
      }),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      error?: string;
    };
    if (!res.ok || !data.verified) {
      throw new Error(data.error || dict.security.otpInvalidErr);
    }
  };

  const handleStartTotpSetup = async () => {
    setSetupError('');
    setSetupSuccess('');
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
        throw new Error(data.error || dict.security.otpQrErr);
      }
      setQrDataUrl(data.qrDataUrl);
      setManualKey(data.manualKey || '');
      setPendingSealedSecret(data.pendingSealedSecret);
      setSetupOtpInput('');
    } catch (err) {
      setSetupError(toUserFriendlyError(err, dict.security.otpStartErr));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupSuccess('');
    setSetupBusy(true);
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
          code: setupOtpInput,
          sealedSecret: pendingSealedSecret,
        }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        sealedTotpSecret?: string;
        error?: string;
      };
      if (!res.ok || !data.verified || !data.sealedTotpSecret) {
        throw new Error(data.error || dict.security.otpInvalidErr);
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
      setSetupOtpInput('');
      setSetupSuccess(dict.security.otpEnabledSuccess);
    } catch (err) {
      setSetupError(toUserFriendlyError(err, dict.otpGate.verifyError));
    } finally {
      setSetupBusy(false);
    }
  };

  const handleCopyManualKey = async () => {
    if (!manualKey) return;
    try {
      await navigator.clipboard.writeText(manualKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactoryError('');
    setFactorySuccess('');

    const normalizedInput = resetConfirmText.trim().toUpperCase();
    const expectedWord = dict.security.factoryWord.trim().toUpperCase();
    if (normalizedInput !== expectedWord && normalizedInput !== 'ZERAR') {
      setFactoryError(dict.security.factoryMismatchErr);
      return;
    }

    setFactoryBusy(true);
    try {
      // Mandatory Google Authenticator verification BEFORE resetting account data
      await verifyGoogleAuthenticatorOtp(factoryOtp);
      await factoryResetUserAccount(user.uid);
      await refreshProfile();
      setResetConfirmText('');
      setFactoryOtp('');
      setFactorySuccess(dict.security.factorySuccessMsg);
    } catch (err) {
      setFactoryError(toUserFriendlyError(err, dict.security.factoryErrMsg));
    } finally {
      setFactoryBusy(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    const normalizedInput = deleteConfirmText.trim().toUpperCase();
    const expectedWord = dict.security.deleteWord.trim().toUpperCase();
    if (normalizedInput !== expectedWord && normalizedInput !== 'ELIMINAR') {
      setDeleteError(dict.security.deleteMismatchErr);
      return;
    }
    if (hasPasswordProvider && !deletePassword) {
      setDeleteError(dict.security.deletePwRequired);
      return;
    }

    setDeleteBusy(true);
    try {
      // 1. Mandatory Google Authenticator OTP verification BEFORE account deletion
      await verifyGoogleAuthenticatorOtp(deleteOtp);

      // 2. Reauthenticate Firebase Auth session BEFORE deleting user Firestore docs
      const hasGoogle = user.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      if (hasPasswordProvider && user.email && deletePassword) {
        const cred = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, cred);
      } else if (hasGoogle) {
        await reauthenticateWithPopup(user, googleProvider);
      }

      // 3. Delete Firestore user records & Firebase Auth account
      await deleteUserAccountData(user.uid);
      await deleteUser(user);
      await logout().catch(() => {});
      router.push('/');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setDeleteError(dict.security.wrongPwErr);
      } else if (code === 'auth/requires-recent-login') {
        setDeleteError(dict.security.deleteRecentLogin);
      } else if (code === 'auth/popup-closed-by-user') {
        setDeleteError(dict.security.deleteGoogleCancelled);
      } else {
        setDeleteError(toUserFriendlyError(err, dict.security.deleteErrMsg));
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AppShell title={dict.security.riskZonePageTitle}>
      <div className="max-w-2xl mx-auto space-y-5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/definicoes"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {dict.security.backToSettingsBtn}
          </Link>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isTotpEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {isTotpEnabled ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                2FA · {dict.security.activeBadge}
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                2FA · {dict.security.inactiveBadge}
              </>
            )}
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <h2 className="font-display text-xl font-extrabold text-white">
              {dict.security.riskZonePageTitle}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {dict.security.riskZonePageDesc}
          </p>
        </div>

        {setupError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
            {setupError}
          </div>
        )}
        {setupSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
            {setupSuccess}
          </div>
        )}

        {/* Mandatory Google Authenticator Setup Gate if not enabled yet */}
        {!isTotpEnabled ? (
          <div className="bg-[#111520] border border-amber-500/35 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {dict.security.totpRequiredBannerTitle}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {dict.security.totpRequiredBannerDesc}
                </p>
              </div>
            </div>

            {!qrDataUrl ? (
              <button
                type="button"
                onClick={handleStartTotpSetup}
                disabled={setupLoading}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                {setupLoading
                  ? dict.security.generatingQrBtn
                  : dict.security.setup2faBtn}
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
                      alt={dict.security.otpTitle}
                      width={168}
                      height={168}
                      className="w-40 h-40 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-2.5 flex-1 min-w-0 text-start">
                    <p className="text-xs font-bold text-white">
                      {dict.security.step1Title}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {dict.security.step1Desc}
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
                          {copiedKey
                            ? dict.security.copiedLabel
                            : dict.security.copyLabel}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    {dict.security.step2Title}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={setupOtpInput}
                      onChange={(e) =>
                        setSetupOtpInput(
                          e.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      placeholder="000000"
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#111520] border border-white/15 text-base font-mono-tabular tracking-[0.35em] text-center text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={setupBusy || setupOtpInput.length !== 6}
                      className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold cursor-pointer whitespace-nowrap"
                    >
                      {setupBusy
                        ? dict.otpGate.verifyingBtn
                        : dict.security.confirmActivateBtn}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Factory Reset Card (Zeroes account WITHOUT deleting login) */}
            <div className="bg-[#111520] border border-amber-500/30 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white">
                    {dict.security.factoryTitle}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {dict.security.factoryDesc}
                  </p>
                </div>
              </div>

              {factoryError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
                  {factoryError}
                </div>
              )}
              {factorySuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 break-words">
                  {factorySuccess}
                </div>
              )}

              <form onSubmit={handleFactoryReset} className="space-y-3 pt-2 border-t border-white/[0.08]">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {tFormat(dict.security.factoryPrompt, {
                      word: dict.security.factoryWord,
                    })}
                  </label>
                  <input
                    type="text"
                    required
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder={dict.security.factoryWord}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white uppercase font-mono-tabular focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {dict.security.otpInputLabel}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={factoryOtp}
                      onChange={(e) =>
                        setFactoryOtp(
                          e.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      placeholder="000000"
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-base font-mono-tabular tracking-[0.35em] text-center text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={factoryBusy || factoryOtp.length !== 6}
                      className="min-h-[44px] px-5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
                    >
                      {factoryBusy
                        ? dict.security.factoryBusyBtn
                        : dict.security.factoryConfirmBtn}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* 2. Permanent Account Deletion Card */}
            <div className="bg-[#111520] border border-red-500/35 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-red-300">
                    {dict.security.deleteTitle}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {dict.security.deleteDesc}
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
                  {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteAccount} className="space-y-3 pt-2 border-t border-white/[0.08]">
                {hasPasswordProvider && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      {dict.security.deletePwLabel}
                    </label>
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {tFormat(dict.security.deletePrompt, {
                      word: dict.security.deleteWord,
                    })}
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={dict.security.deleteWord}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white uppercase font-mono-tabular focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {dict.security.otpInputLabel}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={deleteOtp}
                      onChange={(e) =>
                        setDeleteOtp(
                          e.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      placeholder="000000"
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#090C14] border border-white/15 text-base font-mono-tabular tracking-[0.35em] text-center text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={deleteBusy || deleteOtp.length !== 6}
                      className="min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
                    >
                      {deleteBusy
                        ? dict.security.deleteBusyBtn
                        : dict.security.deleteConfirmBtn}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
