'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { toUserFriendlyError } from '@/lib/error-messages';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: toUserFriendlyError(
        error,
        'Ocorreu um erro inesperado na aplicação. Tenta recarregar a página.'
      ),
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary capturou erro:', error);
  }

  render() {
    if (this.state.hasError) {
      const friendly = toUserFriendlyError(
        this.state.message,
        'Ocorreu uma falha de sincronização. Atualiza a página e tenta novamente.'
      );
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#12161F] border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Ocorreu um contratempo
            </h2>
            <p className="text-sm text-zinc-400 break-words">{friendly}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
