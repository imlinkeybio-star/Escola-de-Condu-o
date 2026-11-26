import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { sealTotpSecret } from '@/lib/server/crypto';
import { buildOtpAuthUri, generateTotpSecretBase32 } from '@/lib/server/totp';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyFirebaseRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Autenticação necessária.' },
        { status: 401 }
      );
    }

    const secretBase32 = generateTotpSecretBase32();
    const accountLabel = user.email || user.uid;
    const otpauthUri = buildOtpAuthUri(accountLabel, secretBase32);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
      width: 240,
      margin: 2,
      color: {
        dark: '#07090F',
        light: '#FFFFFF',
      },
    });
    const pendingSealedSecret = sealTotpSecret(user.uid, secretBase32);

    return NextResponse.json({
      qrDataUrl,
      manualKey: secretBase32,
      otpauthUri,
      pendingSealedSecret,
    });
  } catch (err) {
    console.error('Erro em /api/auth/totp/setup:', err);
    return NextResponse.json(
      { error: 'Erro ao gerar chave Google Authenticator.' },
      { status: 500 }
    );
  }
}
