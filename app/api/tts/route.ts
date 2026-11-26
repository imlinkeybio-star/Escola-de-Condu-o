import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { synthesizePortugueseSpeech } from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária para síntese de voz.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { text?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json(
        { error: 'Texto obrigatório para gerar voz.' },
        { status: 400 }
      );
    }

    const audio = await synthesizePortugueseSpeech(text);
    return NextResponse.json(audio);
  } catch (err) {
    console.error('Erro em /api/tts:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erro na síntese de voz em português.',
      },
      { status: 500 }
    );
  }
}
