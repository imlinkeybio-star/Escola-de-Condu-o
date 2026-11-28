'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  MailPlus,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { StaffPermission } from '@/lib/types';
import {
  deleteStaffPermission,
  upsertStaffPermission,
} from '@/lib/firestore-service';
import { APP_OWNER_EMAIL } from '@/lib/url-safety';
import { useLanguage } from './LanguageProvider';
import { tFormat } from '@/lib/i18n';
import { toUserFriendlyError } from '@/lib/error-messages';

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

export function StaffPermissionsManager() {
  const { user, isOwner } = useAuth();
  const { dict } = useLanguage();
  const [list, setList] = useState<StaffPermission[]>([]);

  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [canViewReserved, setCanViewReserved] = useState(true);
  const [canAdmin, setCanAdmin] = useState(false);
  const [canAnnounce, setCanAnnounce] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(
    null
  );
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !isOwner) return;
    const q = query(collection(db, 'staff_permissions'), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as StaffPermission)
          .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
        setList(items);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'staff_permissions')
    );
    return () => unsub();
  }, [user, isOwner]);

  if (!user || !isOwner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');

    if (!canViewReserved && !canAdmin && !canAnnounce) {
      setError(dict.permissoes.saveErr);
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertStaffPermission({
        email,
        label,
        canViewReserved,
        canAdmin,
        canAnnounce,
        active: true,
      });
      setEmail('');
      setLabel('');
      setCanViewReserved(true);
      setCanAdmin(false);
      setCanAnnounce(false);
      setFeedback(
        tFormat(dict.permissoes.managerUpdatedMsg, { email: saved.email })
      );
    } catch (err) {
      setError(toUserFriendlyError(err, dict.permissoes.saveErr));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleField = async (
    item: StaffPermission,
    field: 'canViewReserved' | 'canAdmin' | 'canAnnounce' | 'active'
  ) => {
    setError('');
    setFeedback('');
    try {
      await upsertStaffPermission({
        email: item.email,
        label: item.label,
        canViewReserved:
          field === 'canViewReserved'
            ? !item.canViewReserved
            : item.canViewReserved,
        canAdmin: field === 'canAdmin' ? !item.canAdmin : item.canAdmin,
        canAnnounce:
          field === 'canAnnounce' ? !item.canAnnounce : item.canAnnounce,
        active: field === 'active' ? !item.active : item.active,
      });
    } catch (err) {
      setError(toUserFriendlyError(err, dict.permissoes.updateErr));
    }
  };

  const handleRemove = async (targetEmail: string) => {
    setError('');
    setFeedback('');
    try {
      await deleteStaffPermission(targetEmail);
      setConfirmRemoveEmail(null);
      setFeedback(
        tFormat(dict.permissoes.managerRemovedMsg, { email: targetEmail })
      );
    } catch (err) {
      setError(toUserFriendlyError(err, dict.permissoes.removeErr));
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="break-words">{feedback}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs sm:text-sm text-red-200 break-words">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add / Update Allowed Email Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 min-w-0"
        >
          <div className="flex items-center gap-2">
            <MailPlus className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="text-base font-bold text-white">
              {dict.permissoes.formTitle}
            </h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {tFormat(dict.permissoes.formDesc, { owner: APP_OWNER_EMAIL })}
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {dict.permissoes.emailLabel}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={dict.permissoes.emailPlaceholder}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {dict.permissoes.roleLabel}
            </label>
            <input
              type="text"
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={dict.permissoes.rolePlaceholder}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#090C14] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-slate-300">
              {dict.permissoes.permsHeading}
            </p>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#090C14] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={canViewReserved}
                onChange={(e) => setCanViewReserved(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-amber-500 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  {dict.permissoes.permViewTitle}
                </span>
                <span className="text-[11px] text-slate-400">
                  {dict.permissoes.permViewDesc}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#090C14] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={canAdmin}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCanAdmin(checked);
                  if (checked) setCanViewReserved(true);
                }}
                className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  {dict.permissoes.permAdminTitle}
                </span>
                <span className="text-[11px] text-slate-400">
                  {dict.permissoes.permAdminDesc}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#090C14] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={canAnnounce}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCanAnnounce(checked);
                  if (checked) setCanViewReserved(true);
                }}
                className="w-4 h-4 mt-0.5 accent-emerald-500 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  {dict.permissoes.permAnnounceTitle}
                </span>
                <span className="text-[11px] text-slate-400">
                  {dict.permissoes.permAnnounceDesc}
                </span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            {saving ? dict.common.saving : dict.permissoes.addUpdateBtn}
          </button>
        </form>

        {/* Delegated Users List */}
        <div className="lg:col-span-7 bg-[#111520] border border-white/[0.08] rounded-2xl p-5 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white">
              {tFormat(dict.permissoes.listTitle, { count: list.length })}
            </h3>
            <span className="text-[11px] font-semibold text-amber-400 whitespace-nowrap">
              {tFormat(dict.permissoes.ownerTag, { owner: APP_OWNER_EMAIL })}
            </span>
          </div>

          {list.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-white/10 rounded-xl px-4">
              <Shield className="w-7 h-7 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                {dict.permissoes.emptyTitle}
              </p>
              <p className="text-xs text-slate-400">
                {tFormat(dict.permissoes.emptyDesc, { owner: APP_OWNER_EMAIL })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((item) => (
                <div
                  key={item.email}
                  className={`p-4 rounded-xl border space-y-3 min-w-0 ${
                    item.active
                      ? 'bg-[#161B29] border-white/10'
                      : 'bg-[#0C0F18] border-white/[0.05] opacity-65'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white break-all">
                        {item.email}
                      </p>
                      {item.label && (
                        <p className="text-xs text-amber-300 mt-0.5">
                          {item.label}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleField(item, 'active')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                          item.active
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {item.active ? (
                          <>
                            <PlayCircle className="w-3 h-3" />
                            {dict.permissoes.activeBtn}
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3 h-3" />
                            {dict.permissoes.suspendedBtn}
                          </>
                        )}
                      </button>

                      {confirmRemoveEmail === item.email ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleRemove(item.email)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {dict.common.confirm}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveEmail(null)}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveEmail(item.email)}
                          aria-label={item.email}
                          className="p-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/30 text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Permission Toggles */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleField(item, 'canViewReserved')
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                        item.canViewReserved
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-200'
                          : 'bg-[#090C14] border-white/10 text-slate-400'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      {dict.permissoes.toggleView}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleToggleField(item, 'canAdmin')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                        item.canAdmin
                          ? 'bg-red-500/20 border-red-500/40 text-red-200'
                          : 'bg-[#090C14] border-white/10 text-slate-400'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {dict.permissoes.toggleAdmin}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleField(item, 'canAnnounce')
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                        item.canAnnounce
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                          : 'bg-[#090C14] border-white/10 text-slate-400'
                      }`}
                    >
                      <Megaphone className="w-3 h-3" />
                      {dict.permissoes.toggleAnnounce}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
