import crypto from 'node:crypto';

declare global {
  var __escolaRuntimeSecret: Buffer | undefined;
}

function getMasterKey(): Buffer {
  const envSecret =
    process.env.SERVER_SIGNING_SECRET ||
    process.env.GPT_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (envSecret && envSecret.trim().length > 0) {
    return crypto
      .createHmac('sha256', envSecret.trim())
      .update('escola-conducao-live-master-key-v1')
      .digest();
  }
  if (!globalThis.__escolaRuntimeSecret) {
    globalThis.__escolaRuntimeSecret = crypto.randomBytes(32);
  }
  return globalThis.__escolaRuntimeSecret;
}

export interface SealedAnswerData {
  roomId: string;
  uid: string;
  questionIndex: number;
  correctIndex: number;
  explanation: string;
  legalReference: string;
  salt: string;
}

export function sealQuestionAnswer(data: Omit<SealedAnswerData, 'salt'>): {
  sealedPayload: string;
  answerCommitment: string;
} {
  const salt = crypto.randomBytes(16).toString('hex');
  const fullData: SealedAnswerData = { ...data, salt };
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(fullData), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const sealedPayload = Buffer.concat([iv, authTag, encrypted]).toString('base64');
  const answerCommitment = crypto
    .createHash('sha256')
    .update(
      `${data.roomId}:${data.uid}:${data.questionIndex}:${data.correctIndex}:${salt}`
    )
    .digest('hex');

  return { sealedPayload, answerCommitment };
}

export function unsealQuestionAnswer(sealedPayload: string): SealedAnswerData {
  const raw = Buffer.from(sealedPayload, 'base64');
  if (raw.length < 29) {
    throw new Error('Payload selado inválido.');
  }
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as SealedAnswerData;
}

export interface RoundTokenPayload {
  roomId: string;
  uid: string;
  questionIndex: number;
  questionStartedAtMs: number;
  questionEndsAtMs: number;
}

export function signRoundToken(payload: RoundTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getMasterKey())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyRoundToken(token: string): RoundTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getMasterKey())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }
  try {
    return JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as RoundTokenPayload;
  } catch {
    return null;
  }
}

export function signRevealProof(
  roomId: string,
  uid: string,
  questionIndex: number,
  correctIndex: number
): string {
  return crypto
    .createHmac('sha256', getMasterKey())
    .update(`reveal:${roomId}:${uid}:${questionIndex}:${correctIndex}`)
    .digest('hex');
}

export interface SealedTotpPayload {
  uid: string;
  secretBase32: string;
  issuedAtMs: number;
}

export function sealTotpSecret(uid: string, secretBase32: string): string {
  const payload: SealedTotpPayload = {
    uid,
    secretBase32,
    issuedAtMs: Date.now(),
  };
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function unsealTotpSecret(sealed: string): SealedTotpPayload {
  const raw = Buffer.from(sealed, 'base64');
  if (raw.length < 29) {
    throw new Error('Segredo 2FA selado inválido.');
  }
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as SealedTotpPayload;
}

export function signTotpCookieValue(uid: string, ttlMs = 12 * 3600 * 1000): string {
  const exp = Date.now() + ttlMs;
  const encoded = Buffer.from(JSON.stringify({ uid, exp }), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getMasterKey())
    .update(`totp_cookie:${encoded}`)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyTotpCookieValue(
  cookieVal: string | undefined,
  expectedUid: string
): boolean {
  if (!cookieVal) return false;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getMasterKey())
    .update(`totp_cookie:${encoded}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as { uid?: string; exp?: number };
    return (
      parsed.uid === expectedUid &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Date.now()
    );
  } catch {
    return false;
  }
}
