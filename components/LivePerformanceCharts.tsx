'use client';

import React, { useState } from 'react';
import { UserResult } from '@/lib/types';

export function LiveTrendSvgChart({
  results,
  height = 180,
}: {
  results: UserResult[];
  height?: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Display chronological oldest -> newest (left -> right), up to last 12 games
  const series = [...results].slice(0, 12).reverse();

  if (series.length === 0) {
    return (
      <div className="rounded-xl bg-[#0B0E17] border border-white/[0.06] p-6 text-center text-xs text-slate-400">
        Joga uma competição para veres a evolução real da tua pontuação e taxa
        de acerto aqui em tempo real.
      </div>
    );
  }

  const width = 560;
  const padX = 28;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const maxScore = Math.max(100, ...series.map((s) => s.score));

  const points = series.map((item, i) => {
    const x =
      series.length === 1
        ? width / 2
        : padX + (i / (series.length - 1)) * chartW;
    const scoreY = padY + chartH - (item.score / maxScore) * chartH;
    const accY = padY + chartH - (item.accuracy / 100) * chartH;
    return { x, scoreY, accY, item, index: i };
  });

  const accPath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.accY.toFixed(1)}`)
    .join(' ');

  const accArea =
    points.length > 1
      ? `${accPath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + chartH).toFixed(1)} Z`
      : '';

  const barW = Math.min(26, Math.max(10, chartW / Math.max(series.length * 1.8, 2)));
  const selected =
    activeIndex !== null && points[activeIndex]
      ? points[activeIndex]
      : points[points.length - 1];

  return (
    <div className="space-y-3 min-w-0">
      {/* Live Inspected Point Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0B0E17] border border-white/[0.06] rounded-xl px-3.5 py-2.5">
        <span className="font-semibold text-white truncate max-w-full sm:max-w-[55%]">
          {selected.item.roomTitle}
        </span>
        <div className="flex items-center gap-3 font-mono-tabular shrink-0">
          <span className="text-amber-400 font-bold">
            {selected.item.score} pts
          </span>
          <span className="text-emerald-400 font-bold">
            {selected.item.accuracy}% acerto
          </span>
          <span className="text-slate-400">{selected.item.rank}.º lugar</span>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Gráfico em tempo real de pontuação e precisão"
        >
          <defs>
            <linearGradient id="accAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + chartH * (1 - t);
            return (
              <g key={t}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                />
                <text
                  x={4}
                  y={y + 3}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {Math.round(t * 100)}%
                </text>
              </g>
            );
          })}

          {/* Accuracy Area */}
          {accArea && <path d={accArea} fill="url(#accAreaGrad)" />}

          {/* Score Bars */}
          {points.map((p) => {
            const barH = Math.max(4, padY + chartH - p.scoreY);
            const isActive = selected.index === p.index;
            return (
              <rect
                key={`bar-${p.index}`}
                x={p.x - barW / 2}
                y={p.scoreY}
                width={barW}
                height={barH}
                rx={4}
                fill={isActive ? '#F59E0B' : 'rgba(245, 158, 11, 0.35)'}
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setActiveIndex(p.index)}
                onClick={() => setActiveIndex(p.index)}
              />
            );
          })}

          {/* Accuracy Line */}
          {points.length > 1 && (
            <path
              d={accPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Nodes */}
          {points.map((p) => {
            const isActive = selected.index === p.index;
            return (
              <g
                key={`pt-${p.index}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(p.index)}
                onClick={() => setActiveIndex(p.index)}
              >
                <circle
                  cx={p.x}
                  cy={p.accY}
                  r={isActive ? 6 : 4}
                  fill="#10B981"
                  stroke="#07090F"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={height - 4}
                  textAnchor="middle"
                  fill={isActive ? '#F8FAFC' : '#64748B'}
                  fontSize="9"
                  fontFamily="monospace"
                >
                  J{p.index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
            Pontuação (pts)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Precisão (%)
          </span>
        </div>
        <span>Toca numa barra para ver detalhes</span>
      </div>
    </div>
  );
}

export function LiveAnswerBreakdownBar({
  correctAnswers,
  totalAnswers,
}: {
  correctAnswers: number;
  totalAnswers: number;
}) {
  const wrongAnswers = Math.max(0, totalAnswers - correctAnswers);
  const correctPct =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const wrongPct = totalAnswers > 0 ? 100 - correctPct : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-400 font-semibold font-mono-tabular">
          {correctAnswers} Certas ({correctPct}%)
        </span>
        <span className="text-red-400 font-semibold font-mono-tabular">
          {wrongAnswers} Erradas ({wrongPct}%)
        </span>
      </div>
      <div className="h-3.5 w-full rounded-full bg-[#1B2234] overflow-hidden flex">
        {totalAnswers > 0 ? (
          <>
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${correctPct}%` }}
            />
            <div
              className="h-full bg-red-500/80 transition-all duration-500"
              style={{ width: `${wrongPct}%` }}
            />
          </>
        ) : (
          <div className="h-full w-full bg-white/[0.04]" />
        )}
      </div>
      <p className="text-[11px] text-slate-400 font-mono-tabular">
        Total de respostas registadas em tempo real: {totalAnswers}
      </p>
    </div>
  );
}
