'use client';

import React from 'react';
import { AppShell } from '@/components/AppShell';
import { useLanguage } from '@/components/LanguageProvider';
import { LiveChatWorkspace } from '@/components/live-chat/LiveChatWorkspace';

export default function LiveChatPage() {
  const { dict } = useLanguage();

  return (
    <AppShell title={dict.chat.shellTitle}>
      <LiveChatWorkspace />
    </AppShell>
  );
}
