import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { generateCompetitionSummary } from '@/lib/server/gemini';
import { normalizeLanguageCode } from '@/lib/i18n/types';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      roomTitle?: string;
      winnerName?: string;
      winnerScore?: number;
      participantCount?: number;
      totalQuestions?: number;
      topTopics?: string[];
      language?: string;
    };

    const summary = await generateCompetitionSummary({
      roomTitle: String(body.roomTitle || 'Concurso Ao Vivo').slice(0, 100),
      winnerName: String(body.winnerName || 'Participante').slice(0, 60),
      winnerScore: Number(body.winnerScore || 0),
      participantCount: Number(body.participantCount || 1),
      totalQuestions: Number(body.totalQuestions || 10),
      topTopics: Array.isArray(body.topTopics)
        ? body.topTopics.slice(0, 6).map(String)
        : ['Código de Estrada'],
      language: normalizeLanguageCode(body.language),
    });

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Erro em /api/ai/competition-summary:', err);
    return NextResponse.json(
      { error: 'Falha ao gerar resumo final da competição.' },
      { status: 500 }
    );
  }
}
