'use client';

import React from 'react';
import { SignType } from '@/lib/types';
import { useLanguage } from '@/components/LanguageProvider';
import { translateSignLabel } from '@/lib/i18n';

interface TrafficSignDisplayProps {
  signType: SignType | string;
  size?: 'sm' | 'md' | 'lg';
}

export const SIGN_LABELS: Record<string, string> = {
  lombas: 'Lombas na via',
  passagem_peoes: 'Passagem de peões',
  stop: 'Paragem obrigatória (STOP)',
  cedencia_passagem: 'Cedência de passagem',
  proibido_ultrapassar: 'Proibido ultrapassar',
  velocidade_60: 'Velocidade máxima 60 km/h',
  velocidade_50: 'Velocidade máxima 50 km/h',
  velocidade_80: 'Velocidade máxima 80 km/h',
  curva_perigosa: 'Curva perigosa à direita',
  sentido_proibido: 'Sentido proibido',
  rotunda: 'Rotunda / Circulação giratória',
  cruzamento: 'Cruzamento ou entroncamento',
  estacionamento_proibido: 'Estacionamento proibido',
  piso_escorregadio: 'Pavimento escorregadio',
  trabalhos_via: 'Trabalhos na via',
  semaforos: 'Aproximação de semáforos',
};

export function TrafficSignDisplay({
  signType,
  size = 'lg',
}: TrafficSignDisplayProps) {
  const { language } = useLanguage();
  if (!signType || signType === 'none') return null;

  const dims =
    size === 'sm'
      ? 'w-16 h-16 p-2 rounded-xl'
      : size === 'md'
        ? 'w-28 h-28 p-3 rounded-2xl'
        : 'w-40 h-40 sm:w-44 sm:h-44 p-4 rounded-2xl';

  const renderGraphic = () => {
    switch (signType) {
      case 'lombas':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <path
              d="M28 82 Q38 82 43 72 Q49 62 55 72 Q60 80 65 72 Q71 62 77 72 Q82 82 92 82 L92 85 L28 85 Z"
              fill="#111827"
            />
          </svg>
        );
      case 'passagem_peoes':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <circle cx="58" cy="44" r="5" fill="#111827" />
            <path
              d="M57 50 L53 66 L45 80 M57 52 L65 65 L69 79 M47 58 L67 56"
              stroke="#111827"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
            <rect x="34" y="83" width="12" height="4" fill="#111827" />
            <rect x="54" y="83" width="12" height="4" fill="#111827" />
            <rect x="74" y="83" width="12" height="4" fill="#111827" />
          </svg>
        );
      case 'curva_perigosa':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <path
              d="M46 84 L46 62 Q46 52 60 50 L72 48"
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="78,47 66,39 67,56" fill="#111827" />
          </svg>
        );
      case 'cruzamento':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <path
              d="M45 48 L75 78 M75 48 L45 78"
              stroke="#111827"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'piso_escorregadio':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <rect x="44" y="42" width="32" height="14" rx="4" fill="#111827" />
            <path
              d="M45 62 C38 70 55 76 46 85 M74 62 C66 70 83 76 74 85"
              stroke="#111827"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'trabalhos_via':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FEF08A"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <circle cx="52" cy="46" r="5" fill="#111827" />
            <path
              d="M52 52 L48 70 L42 84 M52 55 L64 68 L74 80"
              stroke="#111827"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="68,84 86,84 78,72" fill="#111827" />
          </svg>
        );
      case 'semaforos':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="60,8 112,96 8,96"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <rect x="52" y="38" width="16" height="44" rx="3" fill="#111827" />
            <circle cx="60" cy="47" r="4.5" fill="#DC2626" />
            <circle cx="60" cy="60" r="4.5" fill="#F59E0B" />
            <circle cx="60" cy="73" r="4.5" fill="#16A34A" />
          </svg>
        );
      case 'cedencia_passagem':
        return (
          <svg viewBox="0 0 120 105" className="w-full h-full">
            <polygon
              points="8,12 112,12 60,98"
              fill="#FFFFFF"
              stroke="#DC2626"
              strokeWidth="11"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'stop':
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <polygon
              points="38,8 82,8 112,38 112,82 82,112 38,112 8,82 8,38"
              fill="#DC2626"
              stroke="#FFFFFF"
              strokeWidth="4"
            />
            <text
              x="60"
              y="70"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="28"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              STOP
            </text>
          </svg>
        );
      case 'proibido_ultrapassar':
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="50" fill="#FFFFFF" stroke="#DC2626" strokeWidth="11" />
            <rect x="28" y="48" width="24" height="20" rx="4" fill="#DC2626" />
            <rect x="66" y="48" width="24" height="20" rx="4" fill="#111827" />
          </svg>
        );
      case 'velocidade_50':
      case 'velocidade_60':
      case 'velocidade_80': {
        const limitVal =
          signType === 'velocidade_50'
            ? '50'
            : signType === 'velocidade_80'
              ? '80'
              : '60';
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="50" fill="#FFFFFF" stroke="#DC2626" strokeWidth="11" />
            <text
              x="60"
              y="74"
              textAnchor="middle"
              fill="#111827"
              fontSize="44"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              {limitVal}
            </text>
          </svg>
        );
      }
      case 'sentido_proibido':
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="52" fill="#DC2626" />
            <rect x="22" y="50" width="76" height="20" rx="2" fill="#FFFFFF" />
          </svg>
        );
      case 'estacionamento_proibido':
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="50" fill="#1D4ED8" stroke="#DC2626" strokeWidth="11" />
            <line x1="25" y1="25" x2="95" y2="95" stroke="#DC2626" strokeWidth="11" />
          </svg>
        );
      case 'rotunda':
        return (
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="52" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="4" />
            <circle
              cx="60"
              cy="60"
              r="24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeDasharray="34 14"
            />
            <polygon points="60,26 70,38 54,40" fill="#FFFFFF" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`${dims} bg-white shadow-xl flex items-center justify-center shrink-0 mx-auto border-2 border-slate-200`}
      role="img"
      aria-label={translateSignLabel(language, signType)}
    >
      {renderGraphic()}
    </div>
  );
}
