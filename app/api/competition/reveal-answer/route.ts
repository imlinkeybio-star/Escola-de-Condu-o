import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import {
  signRevealProof,
  unsealQuestionAnswer,
  verifyRoundToken,
} from '@/lib/server/crypto';
import firebaseConfig from '../../../../firebase-applet-config.json';

async function hasSubmittedAnswerInFirestore(params: {
  roomId: string;
  questionIndex: number;
  uid: string;
  authHeader: string;
}): Promise<boolean> {
  const answerDocId = `${params.questionIndex}_${params.uid}`;
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/rooms/${encodeURIComponent(params.roomId)}/answers/${encodeURIComponent(answerDocId)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: params.authHeader },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const questionIndex =
      typeof body.questionIndex === 'number' ? Math.floor(body.questionIndex) : -1;
    const roundToken = typeof body.roundToken === 'string' ? body.roundToken : '';
    const sealedPayload =
      typeof body.sealedPayload === 'string' ? body.sealedPayload : '';

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
      tokenData.uid !== user.uid ||
      tokenData.questionIndex !== questionIndex
    ) {
      return NextResponse.json(
        { error: 'Token de ronda inválido ou adulterado.' },
        { status: 403 }
      );
    }

    const now = Date.now();
    if (now < tokenData.questionEndsAtMs - 1500) {
      const authHeader = req.headers.get('authorization') || '';
      const answerExists = await hasSubmittedAnswerInFirestore({
        roomId,
        questionIndex,
        uid: user.uid,
        authHeader,
      });
      if (!answerExists) {
        return NextResponse.json(
          {
            error: 'Responde primeiro ou aguarda o fim do temporizador oficial.',
            remainingMs: tokenData.questionEndsAtMs - now,
          },
          { status: 403 }
        );
      }
    }

    const unsealed = unsealQuestionAnswer(sealedPayload);
    if (
      unsealed.roomId !== roomId ||
      unsealed.uid !== user.uid ||
      unsealed.questionIndex !== questionIndex
    ) {
      return NextResponse.json(
        { error: 'A pergunta selada não corresponde a este jogador ou ronda.' },
        { status: 403 }
      );
    }

    const revealProof = signRevealProof(
      roomId,
      user.uid,
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
