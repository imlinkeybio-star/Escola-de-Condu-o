import { createRemoteJWKSet, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import firebaseConfig from '../../firebase-applet-config.json';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export async function verifyFirebaseRequest(
  req: NextRequest
): Promise<VerifiedFirebaseUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      audience: firebaseConfig.projectId,
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: Boolean(payload.email_verified),
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

export async function hasServerStaffPermission(
  req: NextRequest,
  user: VerifiedFirebaseUser,
  permissionKey: 'canViewReserved' | 'canAdmin' | 'canAnnounce'
): Promise<boolean> {
  if (!user.email || !user.emailVerified) return false;
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return false;

  const emailKey = user.email.trim().toLowerCase();
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(dbId)}/documents/staff_permissions/${encodeURIComponent(
    emailKey
  )}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      fields?: Record<string, { booleanValue?: boolean }>;
    };
    const isActive = data.fields?.active?.booleanValue === true;
    const hasPerm = data.fields?.[permissionKey]?.booleanValue === true;
    return isActive && hasPerm;
  } catch {
    return false;
  }
}
