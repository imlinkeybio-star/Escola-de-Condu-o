import { GoogleGenAI, Type } from '@google/genai';
import {
  LanguageCode,
  LANGUAGE_META_MAP,
  normalizeLanguageCode,
} from '@/lib/i18n/types';

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeneratedQuestionRaw {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  legalReference: string;
  category: string;
  signType: string;
}

const VALID_SIGN_TYPES = [
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

export async function generateAngolaDrivingQuestions(params: {
  count: number;
  difficulty: string;
  category: string;
  roomTitle: string;
  playerSeed?: string;
  language?: LanguageCode;
}): Promise<GeneratedQuestionRaw[]> {
  const ai = getAIClient();
  const count = Math.min(Math.max(params.count, 1), 25);
  const seed = params.playerSeed || `${Date.now()}_${Math.random()}`;
  const selectedThemes = shufflePickThemes(seed);
  const langCode = normalizeLanguageCode(params.language);
  const langMeta = LANGUAGE_META_MAP[langCode];

  const systemInstruction = `You are an official driving examiner in Angola for the platform ESCOLA DE CONDUÇÃO LIVE.
Generate exactly ${count} original and randomized driving theory exam questions written STRICTLY in ${langMeta.aiLanguageName} (${langMeta.bcp47}).
Every visible text field ("questionText", all 4 "options", "explanation", "legalReference", and "category") MUST be written naturally, clearly, and accurately in ${langMeta.aiLanguageName}.

STRICT LEGAL ACCURACY RULES (ANGOLA HIGHWAY CODE):
1. Base all legal facts exclusively on Angolan road traffic legislation and the Angola Highway Code (Decreto-Lei n.º 5/08, Traffic Signs Regulation, DTSER / Viação e Trânsito rules, and the Vienna Convention applicable in Angola).
2. NEVER invent exact article numbers, fine amounts in Kwanzas, or numerical thresholds unless 100% certain. Cite the applicable principle or statute in ${langMeta.aiLanguageName} (referencing Decree-Law No. 5/08 / Angola Highway Code appropriately).
3. Each question must have exactly 4 completely distinct, realistic options without prefixes (no A/B/C/D), exactly 1 unambiguous correct answer, and a complete educational explanation.
4. For the "signType" field, choose the exact identifier from this canonical list (do NOT translate signType): ${VALID_SIGN_TYPES.join(', ')}. Use a specific sign whenever the question involves traffic signage or a related maneuver, or "none" for purely theoretical questions.
5. Whenever using a specific traffic sign, make sure the question and correct answer match its exact official meaning in Angola.
6. Maximize variety across sessions (urban roads, roundabouts, national highways, rain, night driving in Angola).`;

  const prompt = `Unique random session: ${seed}.
Target output language: ${langMeta.aiLanguageName} (${langMeta.bcp47}).
Create ${count} fresh and varied questions for room "${params.roomTitle}".
Difficulty level: ${params.difficulty}.
Primary requested category: ${params.category}.
Priority subtopics for this random round:
- ${selectedThemes.join('\n- ')}
If a specific category is requested (other than general/Geral), focus most questions on that topic while keeping original scenarios.`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        questionText: {
          type: Type.STRING,
          description: `Clear question prompt written in ${langMeta.aiLanguageName}.`,
        },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: `Exactly 4 short, distinct, realistic answer choices in ${langMeta.aiLanguageName}.`,
        },
        correctIndex: {
          type: Type.INTEGER,
          description: 'Zero-based index of the correct answer (0, 1, 2, or 3).',
        },
        explanation: {
          type: Type.STRING,
          description: `Clear educational explanation based on Angola Highway Code in ${langMeta.aiLanguageName}.`,
        },
        legalReference: {
          type: Type.STRING,
          description: `Verifiable Angolan legal reference written in ${langMeta.aiLanguageName}.`,
        },
        category: {
          type: Type.STRING,
          description: `Thematic category label in ${langMeta.aiLanguageName}.`,
        },
        signType: {
          type: Type.STRING,
          description: `Canonical visual sign ID from the allowed list: ${VALID_SIGN_TYPES.join(', ')}`,
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
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        attempt === 0
          ? prompt
          : `${prompt}\nIMPORTANT: Return exactly ${count} complete items in ${langMeta.aiLanguageName} with 4 distinct non-empty options and full explanation.`,
      config: {
        systemInstruction,
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    const validated: GeneratedQuestionRaw[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const q = item as Partial<GeneratedQuestionRaw>;
      const questionText = String(q.questionText ?? '').trim().slice(0, 480);
      const rawOpts = Array.isArray(q.options)
        ? q.options.map((o) => String(o ?? '').trim().slice(0, 180)).filter(Boolean)
        : [];
      const uniqueOpts = Array.from(new Set(rawOpts));
      const explanation = String(q.explanation ?? '').trim().slice(0, 1400);
      const legalReference = String(q.legalReference ?? '').trim().slice(0, 280);
      const category = String(q.category ?? params.category).trim().slice(0, 75);
      const correctIndex =
        typeof q.correctIndex === 'number' &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
          ? q.correctIndex
          : -1;

      if (
        questionText.length < 4 ||
        uniqueOpts.length < 4 ||
        correctIndex < 0 ||
        explanation.length < 6 ||
        legalReference.length < 3
      ) {
        continue;
      }

      const safeSign = VALID_SIGN_TYPES.includes(
        q.signType as (typeof VALID_SIGN_TYPES)[number]
      )
        ? (q.signType as string)
        : 'none';

      validated.push({
        questionText,
        options: uniqueOpts.slice(0, 4),
        correctIndex,
        explanation,
        legalReference,
        category: category || params.category,
        signType: safeSign,
      });

      if (validated.length >= count) break;
    }

    if (validated.length === count) {
      return validated;
    }
  }

  throw new Error(
    'A IA não conseguiu gerar o conjunto completo de perguntas em tempo real. Tenta novamente.'
  );
}

const TEXT_FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-4-hydrogen',
] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateTextWithFallback(params: {
  systemInstruction: string;
  prompt: string;
  jsonMode?: boolean;
}): Promise<string> {
  // 1. Prefer OpenAI (GPT_API_KEY / GPT_MODEL) when configured
  const hasGptKey =
    Boolean(process.env.GPT_API_KEY?.trim()) &&
    process.env.GPT_API_KEY?.trim() !== 'MY_GPT_API_KEY';

  if (hasGptKey) {
    try {
      const { callOpenAITextCompletion } = await import('./openai');
      return await callOpenAITextCompletion({
        systemInstruction: params.systemInstruction,
        prompt: params.prompt,
        jsonMode: params.jsonMode,
      });
    } catch (err) {
      console.warn('OpenAI text request failed, falling back to Gemini:', err);
    }
  }

  // 2. Fallback to Gemini model cascade with retry
  const ai = getAIClient();
  let lastErr: unknown = null;
  for (const model of TEXT_FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        });
        const text = response.text?.trim();
        if (text) return text;
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await delay(350);
      }
    }
  }

  console.error('All AI providers failed for text generation:', lastErr);
  throw new Error(
    'O serviço inteligente está com muita procura neste momento. Tenta novamente dentro de alguns segundos.'
  );
}

export async function generateCompetitionSummary(params: {
  roomTitle: string;
  winnerName: string;
  winnerScore: number;
  participantCount: number;
  totalQuestions: number;
  topTopics: string[];
  language?: LanguageCode;
}): Promise<string> {
  const langMeta = LANGUAGE_META_MAP[normalizeLanguageCode(params.language)];
  const fallbackSummary = `${params.winnerName} (${params.winnerScore} pts) — ${params.roomTitle}`;

  try {
    const text = await generateTextWithFallback({
      systemInstruction: `You are the official driving examiner of Escola de Condução Live in Angola. Write concisely in ${langMeta.aiLanguageName} (${langMeta.bcp47}).`,
      prompt: `Create a motivating and educational final summary (max 90 words) written strictly in ${langMeta.aiLanguageName} (${langMeta.bcp47}) for the driving quiz competition "${params.roomTitle}".
Winner: ${params.winnerName} with ${params.winnerScore} points.
Participants: ${params.participantCount}. Total questions: ${params.totalQuestions}.
Topics covered: ${params.topTopics.join(', ')}.
Congratulate the podium and reinforce a practical road safety message for Angola.`,
    });
    return (text || fallbackSummary).slice(0, 1800);
  } catch {
    return fallbackSummary;
  }
}

export async function askVirtualExaminer(
  question: string,
  language: LanguageCode = 'pt'
): Promise<string> {
  const langMeta = LANGUAGE_META_MAP[normalizeLanguageCode(language)];
  return await generateTextWithFallback({
    systemInstruction: `You are the Virtual Driving Examiner of Escola de Condução Live in Angola.
Answer students' questions about the Angola Highway Code, road signage, right-of-way priorities, defensive driving, and official exam preparation.
Rules:
- Respond STRICTLY in ${langMeta.aiLanguageName} (${langMeta.bcp47}), clearly, structured, and pedagogically (maximum 200 words).
- Never invent exact article numbers or fine amounts unless verifiably certain; otherwise explain the practical official rule under the Angola Highway Code (Decree-Law No. 5/08).`,
    prompt: question,
  });
}

export async function generateAiBroadcastContent(params: {
  kind: string;
  topic: string;
  language?: LanguageCode;
}): Promise<{ title: string; body: string; suggestedLinkLabel: string }> {
  const langMeta = LANGUAGE_META_MAP[normalizeLanguageCode(params.language)];
  const rawJson = await generateTextWithFallback({
    systemInstruction: `You are the official copywriter for Escola de Condução Live in Angola. Write clearly and engagingly in ${langMeta.aiLanguageName}. Always reply strictly with a JSON object containing keys: "title", "body", "suggestedLinkLabel".`,
    prompt: `Create an announcement/ad STRICTLY in ${langMeta.aiLanguageName} (${langMeta.bcp47}) for the driving school quiz platform Escola de Condução Live (Angola).
Communication type: ${params.kind}
Topic / goal defined by the app owner: ${params.topic}

Rules:
- Short, clear, engaging title in ${langMeta.aiLanguageName} (max 80 characters).
- Informative and persuasive body suitable for driving students in Angola in ${langMeta.aiLanguageName} (max 240 characters).
- Short clickable button label in ${langMeta.aiLanguageName} (max 28 characters).`,
    jsonMode: true,
  });

  let parsed: { title?: string; body?: string; suggestedLinkLabel?: string } = {};
  try {
    parsed = JSON.parse(rawJson) as {
      title?: string;
      body?: string;
      suggestedLinkLabel?: string;
    };
  } catch {
    throw new Error('Não foi possível estruturar o anúncio automático. Tenta novamente.');
  }

  if (!parsed.title || !parsed.body) {
    throw new Error('Não foi possível gerar o conteúdo do anúncio. Tenta novamente.');
  }
  return {
    title: parsed.title.trim().slice(0, 110),
    body: parsed.body.trim().slice(0, 500),
    suggestedLinkLabel: (parsed.suggestedLinkLabel || 'Saber mais').trim().slice(0, 40),
  };
}

// In-memory LRU cache for synthesized TTS audio scoped by language (max 100 entries)
const ttsCache = new Map<string, string>();

export async function synthesizeSpeech(
  text: string,
  language: LanguageCode = 'pt'
): Promise<{ audioBase64: string; mimeType: string; provider: string }> {
  const cleanText = text.trim().slice(0, 600);
  if (!cleanText) {
    throw new Error('Texto vazio para síntese de voz.');
  }

  const langCode = normalizeLanguageCode(language);
  const langMeta = LANGUAGE_META_MAP[langCode];
  const cacheKey = `${langCode}::${cleanText}`;

  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return {
      audioBase64: cached,
      mimeType: cached.startsWith('SUQz') || cached.startsWith('//') ? 'audio/mp3' : 'audio/wav',
      provider: 'cache',
    };
  }

  // 1. Prefer Google Cloud Text-to-Speech when GOOGLE_CLOUD_TTS_API_KEY is configured
  const cloudTtsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY?.trim();
  if (cloudTtsKey) {
    const attemptCloudTts = async (withVoiceName: boolean) => {
      const voicePayload: Record<string, string> = {
        languageCode: langMeta.ttsLanguageCode,
        ssmlGender: 'FEMALE',
      };
      if (withVoiceName && langMeta.ttsVoiceName) {
        voicePayload.name = langMeta.ttsVoiceName;
      }
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cloudTtsKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: cleanText },
            voice: voicePayload,
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.0,
            },
          }),
        }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { audioContent?: string };
      return json.audioContent ?? null;
    };

    try {
      const audioContent =
        (await attemptCloudTts(true)) || (await attemptCloudTts(false));
      if (audioContent) {
        cacheTts(cacheKey, audioContent);
        return {
          audioBase64: audioContent,
          mimeType: 'audio/mp3',
          provider: 'google-cloud-tts',
        };
      }
    } catch (err) {
      console.warn('Cloud TTS falhou, a tentar alternativa:', err);
    }
  }

  // 2. Try OpenAI TTS if GPT_API_KEY is configured
  try {
    const { callOpenAISpeech } = await import('./openai');
    const openaiAudio = await callOpenAISpeech(cleanText);
    if (openaiAudio) {
      cacheTts(cacheKey, openaiAudio.audioBase64);
      return openaiAudio;
    }
  } catch (err) {
    console.warn('OpenAI TTS falhou, a tentar Gemini TTS:', err);
  }

  // 3. Built-in Gemini TTS (gemini-3.8-flash-lite-tts) with retry
  if (process.env.GEMINI_API_KEY?.trim()) {
    const ai = getAIClient();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: `Official driving school examiner, clear, professional, warm female voice speaking natively in ${langMeta.aiLanguageName}`,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          cacheTts(cacheKey, base64Audio);
          return {
            audioBase64: base64Audio,
            mimeType: 'audio/wav',
            provider: 'gemini-tts',
          };
        }
      } catch (err) {
        console.warn(`Gemini TTS attempt ${attempt + 1} failed:`, err);
        if (attempt === 0) await delay(350);
      }
    }
  }

  throw new Error('Voz de alta definição temporariamente indisponível. A usar a voz do dispositivo.');
}

export async function synthesizePortugueseSpeech(text: string) {
  return synthesizeSpeech(text, 'pt');
}

function cacheTts(key: string, value: string) {
  if (ttsCache.size >= 100) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) ttsCache.delete(firstKey);
  }
  ttsCache.set(key, value);
}
