import assert from 'node:assert/strict';
import {
  clampAdDurationSeconds,
  getMinAdDurationSeconds,
  validateAdDurationSeconds,
} from '../lib/url-safety';
import { validateGeneratedQuestionsPayload } from '../lib/server/openai';
import { enhanceImageDataBuffer } from '../lib/image-enhancer';
import {
  base64ToBytes,
  buildDirectChatId,
  bytesToBase64,
  categorizeChatFile,
  computeSha256Hex,
  formatFileSize,
  reassembleChunks,
  splitBufferIntoChunks,
} from '../lib/chat-service';
import { toUserFriendlyError } from '../lib/error-messages';

async function run() {
  // 1) Ad Duration Hardening Checks (Part 1)
  assert.equal(getMinAdDurationSeconds(), 1);
  assert.equal(validateAdDurationSeconds('ad_banner', 8).valid, true);
  assert.equal(validateAdDurationSeconds('ad_banner', 9).valid, false);
  assert.equal(validateAdDurationSeconds('ad_banner', 0).valid, false);
  assert.equal(clampAdDurationSeconds('ad_banner', 12), 8);
  assert.equal(validateAdDurationSeconds('ad_video', 20).valid, true);
  assert.equal(validateAdDurationSeconds('ad_video', 21).valid, false);
  assert.equal(validateAdDurationSeconds('ad_video', 0).valid, false);
  assert.equal(clampAdDurationSeconds('ad_video', 35), 20);

  // 2) OpenAI Question Payload Validation Checks (Part 2)
  const validPayload = {
    questions: [
      {
        questionText: 'Qual é o limite máximo de velocidade dentro das localidades em Angola?',
        options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
        correctIndex: 2,
        explanation: 'Dentro das localidades a velocidade máxima geral é 60 km/h.',
        legalReference: 'Código de Estrada de Angola (Decreto-Lei n.º 5/08)',
        category: 'Velocidades',
        signType: 'velocidade_60',
      },
      {
        questionText: 'O que indica o sinal STOP num cruzamento?',
        options: ['Reduzir velocidade', 'Paragem obrigatória', 'Estacionar', 'Curva'],
        correctIndex: 1,
        explanation: 'Obriga a paragem total antes de entrar no cruzamento.',
        legalReference: 'Decreto-Lei n.º 5/08',
        category: 'Sinalização',
        signType: 'unknown_sign_xyz',
      },
    ],
  };

  const validated = validateGeneratedQuestionsPayload(validPayload, 2, 'Geral');
  assert.equal(validated.length, 2);
  assert.equal(validated[0].signType, 'velocidade_60');
  assert.equal(validated[1].signType, 'none');
  assert.equal(validateGeneratedQuestionsPayload({ questions: [] }, 2, 'Geral').length, 0);
  assert.equal(
    validateGeneratedQuestionsPayload(
      {
        questions: [
          {
            questionText: 'Inválida sem 4 opções',
            options: ['A', 'B'],
            correctIndex: 0,
            explanation: 'Explicação suficiente',
            legalReference: 'Decreto 5/08',
          },
        ],
      },
      2,
      'Geral'
    ).length,
    0
  );

  // 3) LIVE CHAT Lossless Chunking, Hashing, Categorization & Direct ID (Part 3)
  assert.equal(
    buildDirectChatId('user_b', 'user_a'),
    buildDirectChatId('user_a', 'user_b')
  );
  assert.equal(categorizeChatFile('image/png', 'foto.png'), 'image');
  assert.equal(categorizeChatFile('video/mp4', 'aula.mp4'), 'video');
  assert.equal(categorizeChatFile('audio/webm', 'voz.webm'), 'audio');
  assert.equal(categorizeChatFile('application/pdf', 'codigo.pdf'), 'document');
  assert.equal(categorizeChatFile('application/zip', 'pacote.zip'), 'other');
  assert.equal(formatFileSize(1024 * 1024), '1.00 MB');

  // 1.1 MB synthetic binary payload -> split across 3 chunks -> encode base64 -> reassemble -> compare SHA-256 byte-for-byte
  const rawBytes = new Uint8Array(1100 * 1024);
  for (let i = 0; i < rawBytes.length; i++) {
    rawBytes[i] = (i * 31 + 7) & 0xff;
  }
  const origHash = await computeSha256Hex(rawBytes);
  const parts = splitBufferIntoChunks(rawBytes);
  assert.equal(parts.length > 1, true);
  const encodedChunks = parts.map((p, chunkIndex) => ({
    chunkIndex,
    dataBase64: bytesToBase64(p),
  }));
  // Shuffle chunk order intentionally to confirm reassembleChunks sorts properly
  const reversed = [...encodedChunks].reverse();
  const rebuilt = reassembleChunks(reversed);
  assert.equal(rebuilt.length, rawBytes.length);
  const rebuiltHash = await computeSha256Hex(rebuilt);
  assert.equal(rebuiltHash, origHash);

  const sampleB64 = bytesToBase64(new Uint8Array([10, 20, 30, 255]));
  assert.deepEqual(Array.from(base64ToBytes(sampleB64)), [10, 20, 30, 255]);

  // 4) LIVE IMAGE ENHANCER Non-mutating Pipeline Checks (Part 3)
  const w = 4;
  const h = 4;
  const sourcePixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    sourcePixels[i * 4] = 80 + ((i * 11) % 120);
    sourcePixels[i * 4 + 1] = 70 + ((i * 17) % 130);
    sourcePixels[i * 4 + 2] = 60 + ((i * 19) % 140);
    sourcePixels[i * 4 + 3] = 200; // non-opaque alpha should stay preserved
  }
  const snapshotCopy = new Uint8ClampedArray(sourcePixels);

  for (const mode of ['natural', 'hd', 'advanced'] as const) {
    const out = enhanceImageDataBuffer(sourcePixels, w, h, mode);
    assert.equal(out.length, sourcePixels.length);
    // Input must never be mutated
    assert.deepEqual(Array.from(sourcePixels), Array.from(snapshotCopy));
    // Alpha channel must stay untouched
    for (let i = 0; i < w * h; i++) {
      assert.equal(out[i * 4 + 3], 200);
    }
  }

  // 5) User-Friendly Error Sanitization Checks
  const firestorePermJson = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    authInfo: { userId: 'abc', email: 'user@example.com' },
    operationType: 'write',
    path: 'rooms/sala_1/player_questions',
  });
  const friendlyPerm = toUserFriendlyError(new Error(firestorePermJson));
  assert.equal(friendlyPerm.includes('{'), false);
  assert.equal(friendlyPerm.includes('authInfo'), false);
  assert.equal(friendlyPerm.includes('operationType'), false);
  assert.equal(friendlyPerm.length > 10, true);

  const gemini503Json = JSON.stringify({
    error: {
      code: 503,
      message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
      status: 'UNAVAILABLE',
    },
  });
  const friendly503 = toUserFriendlyError(new Error(gemini503Json));
  assert.equal(friendly503.includes('{'), false);
  assert.equal(friendly503.includes('503'), false);
  assert.equal(friendly503.includes('UNAVAILABLE'), false);
  assert.equal(friendly503.length > 10, true);

  const cleanMsg = 'O código do Google Authenticator está incorreto.';
  assert.equal(toUserFriendlyError(cleanMsg), cleanMsg);

  console.log('ALL UNIT CHECKS PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
