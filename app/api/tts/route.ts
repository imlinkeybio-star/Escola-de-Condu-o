import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { synthesizeSpeech } from '@/lib/server/gemini';
import { normalizeLanguageCode } from '@/lib/i18n/types';
import { toUserFriendlyError } from '@/lib/error-messages';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária para síntese de voz.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { text?: string; language?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json(
        { error: 'Texto obrigatório para gerar voz.' },
        { status: 400 }
      );
    }

    const language = normalizeLanguageCode(body.language);
    const audio = await synthesizeSpeech(text, language);
    return NextResponse.json(audio);
  } catch (err) {
    console.error('Erro em /api/tts:', err);
    return NextResponse.json(
      {
        error: toUserFriendlyError(
          err,
          'Voz de alta definição temporariamente ocupada. A usar a voz do navegador.'
        ),
      },
      { status: 503 }
    );
  }
}
