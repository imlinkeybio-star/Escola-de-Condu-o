import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { generateAiBroadcastContent } from '@/lib/server/gemini';
import { isAppOwnerEmail } from '@/lib/url-safety';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária.' },
        { status: 401 }
      );
    }

    if (!isAppOwnerEmail(user.email) || !user.emailVerified) {
      return NextResponse.json(
        { error: 'Acesso reservado exclusivamente ao dono da aplicação.' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      kind?: string;
      topic?: string;
    };

    const kind = typeof body.kind === 'string' ? body.kind.trim().slice(0, 40) : 'informative';
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 300) : '';

    if (topic.length < 3) {
      return NextResponse.json(
        { error: 'Indica um tema ou objetivo para a IA gerar a notificação/anúncio.' },
        { status: 400 }
      );
    }

    const draft = await generateAiBroadcastContent({ kind, topic });
    return NextResponse.json(draft);
  } catch (err) {
    console.error('Erro em /api/ai/generate-notification:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erro ao gerar notificação com a IA.',
      },
      { status: 500 }
    );
  }
}
