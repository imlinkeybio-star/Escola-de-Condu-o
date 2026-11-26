import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { generateAngolaDrivingQuestions } from '@/lib/server/gemini';
import { sealQuestionAnswer } from '@/lib/server/crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária para gerar perguntas.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      roomId?: string;
      count?: number;
      difficulty?: string;
      category?: string;
      roomTitle?: string;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    if (!roomId || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
      return NextResponse.json(
        { error: 'Identificador de sala inválido.' },
        { status: 400 }
      );
    }

    const count =
      typeof body.count === 'number' && body.count >= 1 && body.count <= 25
        ? Math.floor(body.count)
        : 10;
    const difficulty =
      typeof body.difficulty === 'string' && body.difficulty.trim()
        ? body.difficulty.trim().slice(0, 40)
        : 'Intermédio';
    const category =
      typeof body.category === 'string' && body.category.trim()
        ? body.category.trim().slice(0, 60)
        : 'Geral';
    const roomTitle =
      typeof body.roomTitle === 'string' && body.roomTitle.trim()
        ? body.roomTitle.trim().slice(0, 100)
        : 'Concurso Código de Estrada';

    const generated = await generateAngolaDrivingQuestions({
      count,
      difficulty,
      category,
      roomTitle,
    });

    const sealedQuestions = generated.map((q, questionIndex) => {
      const { sealedPayload, answerCommitment } = sealQuestionAnswer({
        roomId,
        questionIndex,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        legalReference: q.legalReference,
      });

      return {
        roomId,
        questionIndex,
        questionText: q.questionText,
        options: q.options,
        category: q.category,
        difficulty,
        signType: q.signType,
        sealedPayload,
        answerCommitment,
      };
    });

    return NextResponse.json({ questions: sealedQuestions });
  } catch (err) {
    console.error('Erro em /api/ai/generate-questions:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erro ao gerar perguntas com a IA.',
      },
      { status: 500 }
    );
  }
}
