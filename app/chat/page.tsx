'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useLanguage } from '@/components/LanguageProvider';
import { LiveChatWorkspace } from '@/components/live-chat/LiveChatWorkspace';

function ChatPageInner() {
  const { dict } = useLanguage();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId') || '';

  return (
    <AppShell title={dict.chat.shellTitle}>
      <LiveChatWorkspace initialChatId={chatId} />
    </AppShell>
  );
}

export default function LiveChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F]" />}>
      <ChatPageInner />
    </Suspense>
  );
}
