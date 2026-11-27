'use client';

import React, { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { LiveCompetitionArena } from '@/components/LiveCompetitionArena';
import { useLanguage } from '@/components/LanguageProvider';

export default function SalaPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { dict } = useLanguage();
  return (
    <AppShell title={dict.arena.shellTitle} hideBottomNav>
      <LiveCompetitionArena roomId={roomId} />
    </AppShell>
  );
}
