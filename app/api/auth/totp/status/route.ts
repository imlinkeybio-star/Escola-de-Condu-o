import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '@/lib/server/auth';
import { verifyTotpCookieValue } from '@/lib/server/crypto';
import { TOTP_COOKIE_NAME } from '../verify/route';

export async function GET(req: NextRequest) {
  const user = await verifyFirebaseRequest(req);
  if (!user) {
    return NextResponse.json({ verified: false }, { status: 401 });
  }
  const cookieVal = req.cookies.get(TOTP_COOKIE_NAME)?.value;
  const verified = verifyTotpCookieValue(cookieVal, user.uid);
  return NextResponse.json({ verified });
}

export async function DELETE() {
  const res = NextResponse.json({ cleared: true });
  res.headers.append(
    'Set-Cookie',
    `${TOTP_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
  return res;
}
