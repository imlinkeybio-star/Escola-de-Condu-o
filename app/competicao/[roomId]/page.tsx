'use client';

import React, { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { LiveCompetitionArena } from '@/components/LiveCompetitionArena';

export default function CompeticaoPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  return (
    <AppShell title="Competição ao Vivo" hideBottomNav>
      <LiveCompetitionArena roomId={roomId} />
    </AppShell>
  );
}
