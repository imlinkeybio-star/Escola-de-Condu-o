'use client';

import React from 'react';
import Link from 'next/link';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { StaffPermissionsManager } from '@/components/StaffPermissionsManager';
import { APP_OWNER_EMAIL, APP_OWNER_USERNAME } from '@/lib/url-safety';

export default function PermissoesPage() {
  const { isOwner, loading } = useAuth();

  if (!loading && !isOwner) {
    return (
      <AppShell title="Permissões Reservadas">
        <div className="bg-[#111520] border border-red-500/30 rounded-2xl p-8 text-center space-y-3 max-w-lg mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">
            Acesso Exclusivo do Proprietário
          </h2>
          <p className="text-sm text-slate-400">
            Apenas o proprietário principal ({APP_OWNER_EMAIL}) pode adicionar
            ou gerir emails autorizados a ver outras telas, administrar e
            anunciar.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Permissões & Equipa (Dono)">
      <div className="space-y-6 min-w-0">
        <div className="bg-[#111520] border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              Controlo Exclusivo · @{APP_OWNER_USERNAME}
            </p>
            <h2 className="font-display text-2xl font-extrabold text-white mt-1">
              Gestão de Emails & Permissões Reservadas
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Define quem pode visualizar telas reservadas, administrar
              competições/utilizadores e publicar anúncios ou notificações IA.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold whitespace-nowrap"
            >
              Ir para Administração
            </Link>
            <Link
              href="/dono-anuncios"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold whitespace-nowrap"
            >
              Ir para Anúncios
            </Link>
          </div>
        </div>

        <StaffPermissionsManager />
      </div>
    </AppShell>
  );
}
