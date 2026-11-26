import Link from 'next/link';
import { Home, Radio } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#07090F] text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111520] border border-white/10 rounded-2xl p-8 text-center space-y-5">
        <div className="font-display text-5xl font-extrabold text-red-500">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">
            Página não encontrada
          </h1>
          <p className="text-sm text-slate-400">
            O endereço que procuras não existe ou foi movido.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            Página Inicial
          </Link>
          <Link
            href="/salas"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors"
          >
            <Radio className="w-4 h-4" />
            Salas ao Vivo
          </Link>
        </div>
      </div>
    </div>
  );
}
