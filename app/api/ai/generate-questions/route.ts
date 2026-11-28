import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import {
  generateAngolaDrivingQuestionsWithOpenAI,
  OpenAIQuestionError,
} from '@/lib/server/openai';
import { sealQuestionAnswer } from '@/lib/server/crypto';
import { normalizeLanguageCode } from '@/lib/i18n/types';
import { toUserFriendlyError } from '@/lib/error-messages';

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
      language?: string;
      generationRequestId?: string;
    };

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    if (!roomId || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
      return NextResponse.json(
        { error: 'Identificador de sala inválido.' },
        { status: 400 }
      );
    }

    const count =
      typeof body.count === 'number' &&
      Number.isFinite(body.count) &&
      body.count >= 1 &&
      body.count <= 25
        ? Math.floor(body.count)
        : 10;

    const rawDifficulty =
      typeof body.difficulty === 'string' ? body.difficulty.trim() : '';
    const difficulty =
      rawDifficulty.length >= 2 ? rawDifficulty.slice(0, 40) : 'Intermédio';

    const rawCategory =
      typeof body.category === 'string' ? body.category.trim() : '';
    const category =
      rawCategory.length >= 2 ? rawCategory.slice(0, 60) : 'Geral';

    const roomTitle =
      typeof body.roomTitle === 'string' && body.roomTitle.trim().length >= 2
        ? body.roomTitle.trim().slice(0, 100)
        : 'Concurso Código de Estrada';

    const generationRequestId =
      typeof body.generationRequestId === 'string' &&
      /^[a-zA-Z0-9_-]{4,80}$/.test(body.generationRequestId.trim())
        ? body.generationRequestId.trim()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const language = normalizeLanguageCode(body.language);
    const playerSeed = `${roomId}_${user.uid}_${generationRequestId}`;

    const { questions: generated, model } =
      await generateAngolaDrivingQuestionsWithOpenAI({
        count,
        difficulty,
        category,
        roomTitle,
        playerSeed,
        language,
      });

    const sealedQuestions = generated.map((q, questionIndex) => {
      const safeCategory =
        q.category.trim().length >= 2 ? q.category.trim().slice(0, 75) : category;
      const safeQuestionText = q.questionText.trim().slice(0, 480);
      const safeOptions = q.options
        .slice(0, 4)
        .map((opt) => opt.trim().slice(0, 180));

      const { sealedPayload, answerCommitment } = sealQuestionAnswer({
        roomId,
        uid: user.uid,
        questionIndex,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        legalReference: q.legalReference,
      });

      return {
        roomId,
        uid: user.uid,
        questionIndex,
        questionText: safeQuestionText,
        options: safeOptions,
        category: safeCategory,
        difficulty,
        signType: q.signType,
        sealedPayload,
        answerCommitment,
      };
    });

    return NextResponse.json({
      questions: sealedQuestions,
      provider: 'openai',
      model,
      generationRequestId,
    });
  } catch (err) {
    console.error('Erro em /api/ai/generate-questions:', err);
    if (err instanceof OpenAIQuestionError) {
      return NextResponse.json(
        { error: toUserFriendlyError(err.message), code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      {
        error: toUserFriendlyError(
          err,
          'Não foi possível gerar as perguntas agora. Tenta novamente dentro de instantes.'
        ),
      },
      { status: 503 }
    );
  }
}
