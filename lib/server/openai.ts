import {
  LanguageCode,
  LANGUAGE_META_MAP,
  normalizeLanguageCode,
} from '../i18n/types';

export interface GeneratedQuestionRaw {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  legalReference: string;
  category: string;
  signType: string;
}

export const VALID_SIGN_TYPES = [
  'none',
  'lombas',
  'passagem_peoes',
  'stop',
  'cedencia_passagem',
  'proibido_ultrapassar',
  'velocidade_60',
  'velocidade_50',
  'velocidade_80',
  'curva_perigosa',
  'sentido_proibido',
  'rotunda',
  'cruzamento',
  'estacionamento_proibido',
  'piso_escorregadio',
  'trabalhos_via',
  'semaforos',
] as const;

const ANGOLA_TRAFFIC_THEMES = [
  'Sinalização vertical de perigo, proibição e obrigação segundo o Regulamento de Sinalização de Trânsito em Angola',
  'Regras de prioridade em cruzamentos, entroncamentos, rotundas e veículos prioritários (Decreto-Lei n.º 5/08)',
  'Limites de velocidade dentro e fora das localidades, vias rápidas e condução defensiva em Angola',
  'Manobras de ultrapassagem, mudança de direção, inversão de marcha e cedência de passagem a peões nas passadeiras',
  'Paragem, estacionamento, iluminação obrigatória, triângulo de pré-sinalização e colete refletor',
  'Documentação obrigatória do condutor e do veículo (Carta de Condução, Livrete, Seguro Obrigatório, inspeção e normas da DTSER / Viação e Trânsito)',
  'Álcool, fadiga, uso do cinto de segurança, transporte de menores, uso do telemóvel e responsabilidade rodoviária',
  'Condições adversas (chuva intensa, piso escorregadio, nevoeiro, obras na via) e distância de segurança',
  'Primeiros socorros em sinistros rodoviários e sinalização do local do acidente em Angola',
  'Manutenção preventiva, travões, pneus, luzes e segurança mecânica básica',
];

export class OpenAIQuestionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'OPENAI_ERROR') {
    super(message);
    this.name = 'OpenAIQuestionError';
    this.status = status;
    this.code = code;
  }
}

function shufflePickThemes(seedSource: string): string[] {
  let hash = 0;
  for (let i = 0; i < seedSource.length; i++) {
    hash = (hash * 31 + seedSource.charCodeAt(i)) >>> 0;
  }
  const pool = [...ANGOLA_TRAFFIC_THEMES];
  for (let i = pool.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 5);
}

function getOpenAIConfig(): { apiKey: string; model: string; baseUrl: string } {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY') {
    throw new OpenAIQuestionError(
      'OPENAI_API_KEY não configurada no servidor. Configura OPENAI_API_KEY para gerar perguntas ao vivo.',
      503,
      'MISSING_OPENAI_KEY'
    );
  }
  const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return { apiKey, model, baseUrl };
}

function supportsTemperature(model: string): boolean {
  const m = model.toLowerCase();
  return !/^o\d/.test(m) && !m.startsWith('gpt-5');
}

function extractQuestionsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const rec = parsed as Record<string, unknown>;
    if (Array.isArray(rec.questions)) return rec.questions;
    if (Array.isArray(rec.items)) return rec.items;
    if (Array.isArray(rec.data)) return rec.data;
  }
  return [];
}

/**
 * Validates and normalizes OpenAI-returned questions strictly so every document
 * satisfies `isValidRoomQuestion` in `firestore.rules`.
 */
export function validateGeneratedQuestionsPayload(
  rawJson: unknown,
  count: number,
  fallbackCategory: string
): GeneratedQuestionRaw[] {
  const rawList = extractQuestionsArray(rawJson);
  const safeFallbackCat =
    fallbackCategory.trim().slice(0, 75).length >= 2
      ? fallbackCategory.trim().slice(0, 75)
      : 'Geral';

  const seenPrompts = new Set<string>();
  const validated: GeneratedQuestionRaw[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Partial<GeneratedQuestionRaw>;

    const questionText = String(q.questionText ?? '').trim().slice(0, 480);
    const normalizedPrompt = questionText.toLowerCase();
    if (questionText.length < 5 || seenPrompts.has(normalizedPrompt)) continue;

    if (!Array.isArray(q.options)) continue;
    const cleanOpts = q.options
      .map((o) => String(o ?? '').trim().replace(/\s+/g, ' ').slice(0, 180))
      .filter((o) => o.length >= 1);

    // Ensure 4 distinct options while keeping track of the right option text
    const correctIndexRaw =
      typeof q.correctIndex === 'number' &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
        ? q.correctIndex
        : -1;
    if (correctIndexRaw < 0 || cleanOpts.length < 4) continue;

    const intendedCorrectText = cleanOpts[correctIndexRaw];
    const uniqueOpts: string[] = [];
    for (const opt of cleanOpts) {
      if (!uniqueOpts.some((u) => u.toLowerCase() === opt.toLowerCase())) {
        uniqueOpts.push(opt);
      }
      if (uniqueOpts.length === 4) break;
    }
    if (uniqueOpts.length !== 4) continue;

    const finalCorrectIndex = uniqueOpts.findIndex(
      (u) => u.toLowerCase() === intendedCorrectText.toLowerCase()
    );
    if (finalCorrectIndex < 0 || finalCorrectIndex > 3) continue;

    const explanation = String(q.explanation ?? '').trim().slice(0, 900);
    const legalReference = String(q.legalReference ?? '').trim().slice(0, 240);
    const rawCat = String(q.category ?? '').trim().slice(0, 75);
    const category = rawCat.length >= 2 ? rawCat : safeFallbackCat;

    if (explanation.length < 6 || legalReference.length < 3) continue;

    const safeSign = VALID_SIGN_TYPES.includes(
      q.signType as (typeof VALID_SIGN_TYPES)[number]
    )
      ? (q.signType as string)
      : 'none';

    seenPrompts.add(normalizedPrompt);
    validated.push({
      questionText,
      options: uniqueOpts,
      correctIndex: finalCorrectIndex,
      explanation,
      legalReference,
      category,
      signType: safeSign,
    });

    if (validated.length >= count) break;
  }

  return validated;
}

async function callOpenAIChatCompletions(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  useStructuredSchema: boolean;
  timeoutMs?: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 28000);

  try {
    const bodyPayload: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.prompt },
      ],
      response_format: params.useStructuredSchema
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'angola_driving_questions',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  questions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        questionText: { type: 'string' },
                        options: {
                          type: 'array',
                          items: { type: 'string' },
                          minItems: 4,
                          maxItems: 4,
                        },
                        correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
                        explanation: { type: 'string' },
                        legalReference: { type: 'string' },
                        category: { type: 'string' },
                        signType: {
                          type: 'string',
                          enum: [...VALID_SIGN_TYPES],
                        },
                      },
                      required: [
                        'questionText',
                        'options',
                        'correctIndex',
                        'explanation',
                        'legalReference',
                        'category',
                        'signType',
                      ],
                    },
                  },
                },
                required: ['questions'],
              },
            },
          }
        : { type: 'json_object' },
    };

    if (supportsTemperature(params.model)) {
      bodyPayload.temperature = 0.85;
    }

    const response = await fetch(`${params.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errMessage = '';
      let errCode = '';
      try {
        const parsedErr = JSON.parse(errText) as {
          error?: { message?: string; code?: string; type?: string };
        };
        errMessage = parsedErr.error?.message || '';
        errCode = parsedErr.error?.code || parsedErr.error?.type || '';
      } catch {
        errMessage = errText.slice(0, 220);
      }

      if (response.status === 401 || response.status === 403) {
        throw new OpenAIQuestionError(
          'Chave OpenAI inválida ou sem permissão no servidor.',
          502,
          errCode || 'OPENAI_AUTH_ERROR'
        );
      }
      if (response.status === 429) {
        throw new OpenAIQuestionError(
          'Limite de pedidos ou quota OpenAI excedida. Aguarda alguns segundos e tenta novamente.',
          429,
          errCode || 'OPENAI_RATE_LIMIT'
        );
      }
      if (response.status >= 500) {
        throw new OpenAIQuestionError(
          'O serviço OpenAI está temporariamente sobrecarregado. Tenta novamente em instantes.',
          503,
          errCode || 'OPENAI_UNAVAILABLE'
        );
      }
      throw new OpenAIQuestionError(
        errMessage || `OpenAI respondeu com estado HTTP ${response.status}.`,
        502,
        errCode || 'OPENAI_BAD_RESPONSE'
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new OpenAIQuestionError(
        'OpenAI devolveu uma resposta vazia ao gerar perguntas.',
        502,
        'OPENAI_EMPTY_CONTENT'
      );
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new OpenAIQuestionError(
        'OpenAI devolveu JSON inválido ao gerar perguntas.',
        502,
        'OPENAI_INVALID_JSON'
      );
    }
  } catch (err) {
    if (err instanceof OpenAIQuestionError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OpenAIQuestionError(
        'Tempo limite excedido ao comunicar com a OpenAI. Tenta novamente.',
        504,
        'OPENAI_TIMEOUT'
      );
    }
    throw new OpenAIQuestionError(
      err instanceof Error ? err.message : 'Falha de rede ao contactar OpenAI.',
      502,
      'OPENAI_NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function generateAngolaDrivingQuestionsWithOpenAI(params: {
  count: number;
  difficulty: string;
  category: string;
  roomTitle: string;
  playerSeed?: string;
  language?: LanguageCode;
}): Promise<{ questions: GeneratedQuestionRaw[]; model: string }> {
  const { apiKey, model, baseUrl } = getOpenAIConfig();
  const count = Math.min(Math.max(Math.round(params.count), 1), 25);
  const seed = params.playerSeed || `${Date.now()}_${Math.random()}`;
  const selectedThemes = shufflePickThemes(seed);
  const langCode = normalizeLanguageCode(params.language);
  const langMeta = LANGUAGE_META_MAP[langCode];

  const systemInstruction = `You are an official driving examiner in Angola for the platform ESCOLA DE CONDUÇÃO LIVE.
Generate a JSON object {"questions": [...]} containing EXACTLY ${count} original, randomized driving theory exam questions written STRICTLY in ${langMeta.aiLanguageName} (${langMeta.bcp47}).
Every visible text field ("questionText", all 4 "options", "explanation", "legalReference", and "category") MUST be written naturally, clearly, and accurately in ${langMeta.aiLanguageName}.

STRICT LEGAL ACCURACY RULES (ANGOLA HIGHWAY CODE):
1. Base all legal facts exclusively on Angolan road traffic legislation and the Angola Highway Code (Decreto-Lei n.º 5/08, Traffic Signs Regulation, DTSER / Viação e Trânsito rules, and the Vienna Convention applicable in Angola).
2. NEVER invent exact article numbers, fine amounts in Kwanzas, or numerical thresholds unless 100% certain. Cite the applicable principle or statute in ${langMeta.aiLanguageName} (referencing Decree-Law No. 5/08 / Angola Highway Code appropriately).
3. Every question MUST have:
   - "questionText": between 15 and 420 characters.
   - "options": array of EXACTLY 4 distinct non-empty strings (no A/B/C/D prefixes), max 160 chars each.
   - "correctIndex": integer 0, 1, 2, or 3 pointing to the single unambiguous correct answer.
   - "explanation": educational explanation between 20 and 800 characters.
   - "legalReference": legal citation between 5 and 200 characters.
   - "category": topic label between 3 and 60 characters.
   - "signType": exact canonical identifier from [${VALID_SIGN_TYPES.join(', ')}] (NEVER translate signType).
4. Maximize difficulty calibration (${params.difficulty}) and variety across urban roads, roundabouts, national highways, rain, and night driving in Angola.`;

  const prompt = `Unique random session: ${seed}.
Target output language: ${langMeta.aiLanguageName} (${langMeta.bcp47}).
Room: "${params.roomTitle}".
Difficulty level: ${params.difficulty}.
Primary requested category: ${params.category}.
Priority subtopics for this random round:
- ${selectedThemes.join('\n- ')}
Return JSON matching {"questions": [...]} with exactly ${count} valid questions.`;

  // Try structured json_schema first, then up to 1 fallback/retry using json_object if schema rejected
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const useStructured = attempt === 0;
    try {
      const parsed = await callOpenAIChatCompletions({
        apiKey,
        baseUrl,
        model,
        systemInstruction,
        prompt:
          attempt === 0
            ? prompt
            : `${prompt}\nIMPORTANT: Return strictly valid JSON object {"questions": [...]} with ALL ${count} distinct questions, 4 distinct non-empty options each, and integer correctIndex 0..3.`,
        useStructuredSchema: useStructured,
      });

      const validated = validateGeneratedQuestionsPayload(
        parsed,
        count,
        params.category
      );
      if (validated.length === count) {
        return { questions: validated, model };
      }
      lastError = new OpenAIQuestionError(
        `OpenAI devolveu ${validated.length} de ${count} perguntas válidas. Tenta novamente.`,
        502,
        'OPENAI_INCOMPLETE_SET'
      );
    } catch (err) {
      if (err instanceof OpenAIQuestionError) {
        // Do not retry auth or rate-limit errors in a tight loop
        if (err.status === 401 || err.status === 403 || err.status === 429) {
          throw err;
        }
        lastError = err;
      } else {
        lastError =
          err instanceof Error
            ? err
            : new OpenAIQuestionError('Erro desconhecido na OpenAI.', 502);
      }
    }
  }

  throw (
    lastError ||
    new OpenAIQuestionError(
      'Não foi possível gerar o conjunto completo de perguntas com a OpenAI. Tenta novamente.',
      502,
      'OPENAI_GENERATION_FAILED'
    )
  );
}
