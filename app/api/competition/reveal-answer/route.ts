import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import {
  signRevealProof,
  unsealQuestionAnswer,
  verifyRoundToken,
} from '@/lib/server/crypto';

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
      roomId?: string;
      questionIndex?: number;
      roundToken?: string;
      sealedPayload?: string;
      allAnswered?: boolean;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const questionIndex =
      typeof body.questionIndex === 'number' ? Math.floor(body.questionIndex) : -1;
    const roundToken = typeof body.roundToken === 'string' ? body.roundToken : '';
    const sealedPayload =
      typeof body.sealedPayload === 'string' ? body.sealedPayload : '';
    const allAnswered = Boolean(body.allAnswered);

    if (!roomId || questionIndex < 0 || !roundToken || !sealedPayload) {
      return NextResponse.json(
        { error: 'Dados incompletos para revelação da resposta.' },
        { status: 400 }
      );
    }

    const tokenData = verifyRoundToken(roundToken);
    if (
      !tokenData ||
      tokenData.roomId !== roomId ||
      tokenData.questionIndex !== questionIndex
    ) {
      return NextResponse.json(
        { error: 'Token de ronda inválido ou adulterado.' },
        { status: 403 }
      );
    }

    // Server authoritative clock check: do not unseal before round expires unless all participants answered
    const now = Date.now();
    if (!allAnswered && now < tokenData.questionEndsAtMs - 1500) {
      return NextResponse.json(
        {
          error: 'O temporizador oficial da pergunta ainda não terminou.',
          remainingMs: tokenData.questionEndsAtMs - now,
        },
        { status: 403 }
      );
    }

    const unsealed = unsealQuestionAnswer(sealedPayload);
    if (
      unsealed.roomId !== roomId ||
      unsealed.questionIndex !== questionIndex
    ) {
      return NextResponse.json(
        { error: 'A pergunta selada não corresponde a esta ronda.' },
        { status: 403 }
      );
    }

    const revealProof = signRevealProof(
      roomId,
      questionIndex,
      unsealed.correctIndex
    );

    return NextResponse.json({
      correctIndex: unsealed.correctIndex,
      explanation: unsealed.explanation,
      legalReference: unsealed.legalReference,
      revealProof,
    });
  } catch (err) {
    console.error('Erro em /api/competition/reveal-answer:', err);
    return NextResponse.json(
      { error: 'Falha ao revelar resposta no servidor.' },
      { status: 500 }
    );
  }
}
