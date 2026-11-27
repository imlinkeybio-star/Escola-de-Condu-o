'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Lock,
  Mail,
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
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { tFormat } from '@/lib/i18n';
import {
  deleteUserAccountData,
  factoryResetUserAccount,
  updateUserProfileDetails,
} from '@/lib/firestore-service';

export function AccountSecurityCard() {
  const router = useRouter();
  const { user, privateInfo, refreshProfile, markTotpVerified, logout } = useAuth();
  const { dict } = useLanguage();

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

  // Factory reset states
  const [resetPanelOpen, setResetPanelOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [factoryBusy, setFactoryBusy] = useState(false);
  const [factoryError, setFactoryError] = useState('');
  const [factorySuccess, setFactorySuccess] = useState('');

  // Account deletion states
  const [deletePanelOpen, setDeletePanelOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      setPwError(dict.security.pwMin6Err);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(dict.security.pwMismatchErr);
      return;
    }
    if (!user.email) {
      setPwError(dict.security.noEmailErr);
      return;
    }

    setPwLoading(true);
    try {
      if (hasPasswordProvider) {
        if (!currentPassword) {
          setPwError(dict.security.currentPwReqErr);
          setPwLoading(false);
          return;
        }
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPassword);
        setPwSuccess(dict.security.pwUpdated);
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
        setPwSuccess(dict.security.pwSetSuccess);
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
        setPwError(dict.security.wrongPwErr);
      } else if (code === 'auth/weak-password') {
        setPwError(dict.security.weakPwErr);
      } else if (code === 'auth/requires-recent-login') {
        setPwError(dict.security.recentLoginErr);
      } else {
        setPwError(err instanceof Error ? err.message : dict.security.genericPwErr);
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    setResetErr('');
    setResetMsg('');
    if (!user.email) {
      setResetErr(dict.security.noEmailErr);
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetMsg(tFormat(dict.security.resetSentMsg, { email: user.email }));
    } catch (err) {
      setResetErr(
        err instanceof Error ? err.message : dict.security.resetErrMsg
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
        throw new Error(data.error || dict.security.otpQrErr);
      }
      setQrDataUrl(data.qrDataUrl);
      setManualKey(data.manualKey || '');
      setPendingSealedSecret(data.pendingSealedSecret);
      setOtpInput('');
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : dict.security.otpStartErr);
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
      setOtpInput('');
      setTotpSuccess(dict.security.otpEnabledSuccess);
    } catch (err) {
      setTotpError(
        err instanceof Error ? err.message : dict.otpGate.verifyError
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
        throw new Error(data.error || dict.security.otpInvalidErr);
      }

      await updateUserProfileDetails(user.uid, {
        totpEnabled: false,
        totpSealedSecret: null,
      });
      markTotpVerified(false);
      await refreshProfile();
      setDisableOtpInput('');
      setTotpSuccess(dict.security.otpDisabledSuccess);
    } catch (err) {
      setTotpError(
        err instanceof Error ? err.message : dict.security.otpDisableErr
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

  const handleFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
      await factoryResetUserAccount(user.uid);
      await refreshProfile();
      setResetConfirmText('');
      setResetPanelOpen(false);
      setFactorySuccess(dict.security.factorySuccessMsg);
    } catch (err) {
      setFactoryError(
        err instanceof Error ? err.message : dict.security.factoryErrMsg
      );
    } finally {
      setFactoryBusy(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setDeleteError('');
    const normalizedInput = deleteConfirmText.trim().toUpperCase();
    const expectedWord = dict.security.deleteWord.trim().toUpperCase();
    if (normalizedInput !== expectedWord && normalizedInput !== 'ELIMINAR') {
      setDeleteError(dict.security.deleteMismatchErr);
      return;
    }

    setDeleteBusy(true);
    try {
      // Reauthenticate BEFORE removing Firestore documents so Auth deleteUser never fails mid-way
      const hasGoogle = user.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      if (hasPasswordProvider && user.email && deletePassword) {
        const cred = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, cred);
      } else if (hasGoogle) {
        await reauthenticateWithPopup(user, googleProvider);
      } else if (hasPasswordProvider) {
        setDeleteError(dict.security.deletePwRequired);
        setDeleteBusy(false);
        return;
      }

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
        setDeleteError(
          err instanceof Error ? err.message : dict.security.deleteErrMsg
        );
      }
    } finally {
      setDeleteBusy(false);
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
                  ? dict.security.editPwTitle
                  : dict.security.setPwTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {hasPasswordProvider
                  ? dict.security.editPwDesc
                  : dict.security.setPwDesc}
              </p>
            </div>
          </div>
          <Link
            href="/entrar?reset=1"
            className="text-xs font-semibold text-red-400 hover:text-red-300 whitespace-nowrap"
          >
            {dict.security.resetPageLink}
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
                {dict.security.currentPwLabel}
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
                {dict.security.newPwLabel}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={dict.security.min6Placeholder}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white mt-1 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium">
                {dict.security.confirmPwLabel}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={dict.security.repeatPwPlaceholder}
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
                ? dict.common.saving
                : hasPasswordProvider
                  ? dict.security.updatePwBtn
                  : dict.security.setPwBtn}
            </button>

            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={resetLoading || !user.email}
              className="min-h-[44px] px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Mail className="w-4 h-4 shrink-0 text-amber-400" />
              {resetLoading
                ? dict.security.sendingBtn
                : dict.security.sendResetBtn}
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
                {dict.security.otpTitle}
              </h3>
              <p className="text-xs text-slate-400">{dict.security.otpDesc}</p>
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
                {dict.security.activeBadge}
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                {dict.security.inactiveBadge}
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
              {dict.security.otpActiveDesc}
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
                placeholder={dict.security.otpPlaceholder}
                className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#111520] border border-white/15 text-sm font-mono-tabular tracking-widest text-white focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={totpBusy || disableOtpInput.length !== 6}
                className="min-h-[42px] px-4 rounded-xl bg-red-600/25 hover:bg-red-600/40 border border-red-500/40 disabled:opacity-50 text-red-200 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {totpBusy
                  ? dict.security.validatingBtn
                  : dict.security.disable2faBtn}
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
                  {totpBusy
                    ? dict.otpGate.verifyingBtn
                    : dict.security.confirmActivateBtn}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Factory Reset & Permanent Account Deletion */}
      <div className="bg-[#111520] border border-red-500/25 rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">
              {dict.security.dangerTitle}
            </h3>
            <p className="text-xs text-slate-400">{dict.security.dangerDesc}</p>
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
        {deleteError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 break-words">
            {deleteError}
          </div>
        )}

        {/* Factory Reset Option */}
        <div className="p-4 rounded-xl bg-[#090C14] border border-white/10 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {dict.security.factoryTitle}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {dict.security.factoryDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setResetPanelOpen((p) => !p);
                setDeletePanelOpen(false);
                setFactoryError('');
              }}
              className="min-h-[40px] px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              {resetPanelOpen ? dict.common.cancel : dict.security.factoryBtn}
            </button>
          </div>

          {resetPanelOpen && (
            <form
              onSubmit={handleFactoryReset}
              className="pt-3 border-t border-white/[0.08] space-y-3"
            >
              <label className="block text-xs text-slate-300">
                {tFormat(dict.security.factoryPrompt, {
                  word: dict.security.factoryWord,
                })}
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  required
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder={dict.security.factoryWord}
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#111520] border border-white/15 text-sm text-white uppercase font-mono-tabular focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={factoryBusy}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {factoryBusy
                    ? dict.security.factoryBusyBtn
                    : dict.security.factoryConfirmBtn}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Delete Account Option */}
        <div className="p-4 rounded-xl bg-[#090C14] border border-red-500/25 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-300">
                {dict.security.deleteTitle}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {dict.security.deleteDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeletePanelOpen((p) => !p);
                setResetPanelOpen(false);
                setDeleteError('');
              }}
              className="min-h-[40px] px-4 rounded-xl bg-red-600/25 hover:bg-red-600/40 border border-red-500/40 text-red-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              {deletePanelOpen ? dict.common.cancel : dict.security.deleteBtn}
            </button>
          </div>

          {deletePanelOpen && (
            <form
              onSubmit={handleDeleteAccount}
              className="pt-3 border-t border-white/[0.08] space-y-3"
            >
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
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#111520] border border-white/15 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  {tFormat(dict.security.deletePrompt, {
                    word: dict.security.deleteWord,
                  })}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={dict.security.deleteWord}
                    className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#111520] border border-white/15 text-sm text-white uppercase font-mono-tabular focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={deleteBusy}
                    className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    {deleteBusy
                      ? dict.security.deleteBusyBtn
                      : dict.security.deleteConfirmBtn}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
