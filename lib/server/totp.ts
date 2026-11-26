import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecretBase32(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildOtpAuthUri(accountLabel: string, secretBase32: string): string {
  const issuer = 'Escola de Conducao Live';
  const label = `${issuer}:${accountLabel}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function generateHotp(secretBuf: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(
  secretBase32: string,
  rawCode: string,
  windowSteps = 1
): boolean {
  const normalized = rawCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const secretBuf = decodeBase32(secretBase32);
  if (secretBuf.length < 10) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const codeBuf = Buffer.from(normalized, 'utf8');

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = generateHotp(secretBuf, currentStep + delta);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      candidateBuf.length === codeBuf.length &&
      crypto.timingSafeEqual(candidateBuf, codeBuf)
    ) {
      return true;
    }
  }

  return false;
}
