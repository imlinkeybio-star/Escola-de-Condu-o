import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import {
  sealTotpSecret,
  signTotpCookieValue,
  unsealTotpSecret,
} from '@/lib/server/crypto';
import { TOTP_COOKIE_NAME, verifyTotpCode } from '@/lib/server/totp';

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
      code?: string;
      sealedSecret?: string;
      mode?: 'enable' | 'verify' | 'disable';
    };

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const sealedSecret =
      typeof body.sealedSecret === 'string' ? body.sealedSecret.trim() : '';
    const mode = body.mode || 'verify';

    if (!/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { error: 'Insere o código OTP de 6 dígitos do Google Authenticator.' },
        { status: 400 }
      );
    }

    if (!sealedSecret) {
      return NextResponse.json(
        { error: 'Configuração 2FA não encontrada.' },
        { status: 400 }
      );
    }

    let unsealed;
    try {
      unsealed = unsealTotpSecret(sealedSecret);
    } catch {
      return NextResponse.json(
        { error: 'Chave 2FA inválida ou expirada. Gera uma nova configuração.' },
        { status: 400 }
      );
    }

    if (unsealed.uid !== user.uid) {
      return NextResponse.json(
        { error: 'Esta chave 2FA não pertence à tua conta.' },
        { status: 403 }
      );
    }

    if (
      mode === 'enable' &&
      Date.now() - unsealed.issuedAtMs > 20 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: 'O QR Code expirou. Gera um novo código QR.' },
        { status: 400 }
      );
    }

    const ok = verifyTotpCode(unsealed.secretBase32, code, 1);
    if (!ok) {
      return NextResponse.json(
        { error: 'Código OTP inválido ou expirado. Verifica a hora do telemóvel e tenta novamente.' },
        { status: 401 }
      );
    }

    if (mode === 'disable') {
      const res = NextResponse.json({
        verified: true,
        totpEnabled: false,
      });
      res.headers.append(
        'Set-Cookie',
        `${TOTP_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
      );
      return res;
    }

    const persistentSealedSecret = sealTotpSecret(
      user.uid,
      unsealed.secretBase32
    );
    const cookieVal = signTotpCookieValue(user.uid, 12 * 3600 * 1000);
    const res = NextResponse.json({
      verified: true,
      totpEnabled: true,
      sealedTotpSecret: persistentSealedSecret,
    });
    res.headers.append(
      'Set-Cookie',
      `${TOTP_COOKIE_NAME}=${cookieVal}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${12 * 3600}`
    );
    return res;
  } catch (err) {
    console.error('Erro em /api/auth/totp/verify:', err);
    return NextResponse.json(
      { error: 'Erro ao validar código Google Authenticator.' },
      { status: 500 }
    );
  }
}
