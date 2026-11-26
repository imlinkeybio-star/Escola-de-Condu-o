import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { signRoundToken } from '@/lib/server/crypto';

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
      timePerQuestion?: number;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const questionIndex =
      typeof body.questionIndex === 'number' ? Math.floor(body.questionIndex) : -1;
    const timePerQuestion =
      typeof body.timePerQuestion === 'number' &&
      body.timePerQuestion >= 10 &&
      body.timePerQuestion <= 180
        ? Math.floor(body.timePerQuestion)
        : 60;

    if (!roomId || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId) || questionIndex < 0) {
      return NextResponse.json(
        { error: 'Parâmetros de ronda inválidos.' },
        { status: 400 }
      );
    }

    const questionStartedAtMs = Date.now();
    const questionEndsAtMs = questionStartedAtMs + timePerQuestion * 1000;
    const roundToken = signRoundToken({
      roomId,
      uid: user.uid,
      questionIndex,
      questionStartedAtMs,
      questionEndsAtMs,
    });

    return NextResponse.json({
      questionStartedAtMs,
      questionEndsAtMs,
      roundToken,
      serverNowMs: questionStartedAtMs,
    });
  } catch (err) {
    console.error('Erro em /api/competition/start-round:', err);
    return NextResponse.json(
      { error: 'Falha ao iniciar temporizador autoritativo.' },
      { status: 500 }
    );
  }
}
