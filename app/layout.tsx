import type { Metadata } from 'next';
import {
  Barlow_Condensed,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow-condensed',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Escola de Condução Live',
  description:
    'Plataforma multijogador em tempo real de competições sobre condução, Código de Estrada de Angola e segurança rodoviária com examinadora virtual por IA.',
  openGraph: {
    title: 'Escola de Condução Live',
    description:
      'Plataforma multijogador em tempo real de competições sobre condução, Código de Estrada de Angola e segurança rodoviária com examinadora virtual por IA.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Escola de Condução Live',
    description:
      'Plataforma multijogador em tempo real de competições sobre condução, Código de Estrada de Angola e segurança rodoviária com examinadora virtual por IA.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-AO"
      className={`${barlowCondensed.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body suppressHydrationWarning className="min-h-screen bg-[#07090F] text-slate-50">
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
