import { NextRequest, NextResponse } from 'next/server';
import {
  hasServerStaffPermission,
  verifyFirebaseRequest,
} from '@/lib/server/auth';
import { generateAiBroadcastContent } from '@/lib/server/gemini';
import { isAppOwnerEmail } from '@/lib/url-safety';
import { normalizeLanguageCode } from '@/lib/i18n/types';
import { toUserFriendlyError } from '@/lib/error-messages';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária.' },
        { status: 401 }
      );
    }

    const isOwner = Boolean(isAppOwnerEmail(user.email) && user.emailVerified);
    const canDelegatedAnnounce =
      isOwner || (await hasServerStaffPermission(req, user, 'canAnnounce'));

    if (!canDelegatedAnnounce) {
      return NextResponse.json(
        { error: 'Acesso reservado ao dono da aplicação ou emails autorizados a anunciar.' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      kind?: string;
      topic?: string;
      language?: string;
    };

    const kind = typeof body.kind === 'string' ? body.kind.trim().slice(0, 40) : 'informative';
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 300) : '';
    const language = normalizeLanguageCode(body.language);

    if (topic.length < 3) {
      return NextResponse.json(
        { error: 'Indica um tema ou objetivo para a IA gerar a notificação/anúncio.' },
        { status: 400 }
      );
    }

    const draft = await generateAiBroadcastContent({ kind, topic, language });
    return NextResponse.json(draft);
  } catch (err) {
    console.error('Erro em /api/ai/generate-notification:', err);
    return NextResponse.json(
      {
        error: toUserFriendlyError(
          err,
          'Não foi possível gerar o conteúdo agora. Tenta novamente dentro de instantes.'
        ),
      },
      { status: 503 }
    );
  }
}
