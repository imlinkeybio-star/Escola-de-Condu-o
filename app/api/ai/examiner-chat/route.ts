import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { askVirtualExaminer } from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária para consultar a examinadora.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { question?: string };
    const question =
      typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
    if (question.length < 3) {
      return NextResponse.json(
        { error: 'Escreve uma pergunta válida sobre condução.' },
        { status: 400 }
      );
    }

    const answer = await askVirtualExaminer(question);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error('Erro em /api/ai/examiner-chat:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erro ao consultar a examinadora virtual.',
      },
      { status: 500 }
    );
  }
}
