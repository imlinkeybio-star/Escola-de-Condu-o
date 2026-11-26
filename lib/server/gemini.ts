import { GoogleGenAI, Type } from '@google/genai';

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
}): Promise<GeneratedQuestionRaw[]> {
  const ai = getAIClient();
  const count = Math.min(Math.max(params.count, 1), 25);
  const seed = params.playerSeed || `${Date.now()}_${Math.random()}`;
  const selectedThemes = shufflePickThemes(seed);

  const systemInstruction = `És uma examinadora oficial de condução em Angola para a plataforma ESCOLA DE CONDUÇÃO LIVE.
Gera exatamente ${count} perguntas inéditas e aleatórias de exame teórico de condução em português utilizado em Angola (português claro, formal e educativo, ex: "peões", "passadeira", "rotunda", "carta de condução", "Código de Estrada").

REGRAS RIGOROSAS DE VERACIDADE LEGAL (ANGOLA):
1. Baseia-te exclusivamente na legislação rodoviária e no Código de Estrada de Angola (Decreto-Lei n.º 5/08, Regulamento de Sinalização de Trânsito e normas da DTSER / Viação e Trânsito) e na Convenção de Viena aplicável em Angola.
2. NUNCA inventes números de artigos específicos, valores exatos de coimas em Kwanzas ou prazos numéricos se não tiveres 100% de certeza. Quando explicares regras legais, refere o princípio ou diploma aplicável do Código de Estrada de Angola (ex: "Código de Estrada de Angola (Decreto-Lei n.º 5/08) — Regras de Prioridade").
3. Cada pergunta deve ter exatamente 4 opções totalmente distintas, realistas e sem prefixos (A/B/C/D), apenas 1 resposta inequívoca e correta, e uma explicação pedagógica completa.
4. Para o campo "signType", escolhe o sinal mais adequado desta lista exata: ${VALID_SIGN_TYPES.join(', ')}. Usa um sinal específico sempre que a pergunta envolver sinalização ou manobra associada, ou "none" para perguntas puramente teóricas (documentação, primeiros socorros, mecânica).
5. Se usares um sinal de trânsito específico, garante que o enunciado e a resposta correta correspondem fielmente ao significado desse sinal em Angola.
6. Garante máxima variedade e originalidade em relação a outras sessões (usa cenários práticos variados em Angola: vias urbanas, rotundas, estradas nacionais, chuva, condução noturna).`;

  const prompt = `Sessão aleatória única: ${seed}.
Cria ${count} perguntas novas e variadas para a sala "${params.roomTitle}".
Nível de dificuldade: ${params.difficulty}.
Categoria principal solicitada: ${params.category}.
Subtemas prioritários para esta ronda aleatória:
- ${selectedThemes.join('\n- ')}
Se a categoria solicitada for específica (diferente de "Geral"), foca a maioria das perguntas nessa categoria mantendo cenários originais e distintos.`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        questionText: {
          type: Type.STRING,
          description: 'Enunciado claro da pergunta em português de Angola.',
        },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Exatamente 4 opções de resposta curtas, distintas e reais.',
        },
        correctIndex: {
          type: Type.INTEGER,
          description: 'Índice da resposta correta (0, 1, 2 ou 3).',
        },
        explanation: {
          type: Type.STRING,
          description: 'Explicação educativa clara baseada no Código de Estrada de Angola.',
        },
        legalReference: {
          type: Type.STRING,
          description:
            'Referência legal verificável em Angola (ex: Código de Estrada de Angola — Decreto-Lei n.º 5/08, Prioridade).',
        },
        category: {
          type: Type.STRING,
          description: 'Categoria temática da pergunta.',
        },
        signType: {
          type: Type.STRING,
          description: `Identificador do sinal visual da lista permitida: ${VALID_SIGN_TYPES.join(', ')}`,
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
          : `${prompt}\nATENÇÃO: Garante exatamente ${count} objetos completos com 4 opções distintas não vazias e explicação detalhada.`,
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
        questionText.length < 10 ||
        uniqueOpts.length < 4 ||
        correctIndex < 0 ||
        explanation.length < 10 ||
        legalReference.length < 4
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

export async function generateCompetitionSummary(params: {
  roomTitle: string;
  winnerName: string;
  winnerScore: number;
  participantCount: number;
  totalQuestions: number;
  topTopics: string[];
}): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Cria um resumo final motivador e educativo (máximo 90 palavras) em português de Angola para a competição "${params.roomTitle}".
Vencedor: ${params.winnerName} com ${params.winnerScore} pontos.
Total de participantes: ${params.participantCount}. Total de perguntas: ${params.totalQuestions}.
Temas abordados: ${params.topTopics.join(', ')}.
Dá os parabéns ao pódio e reforça uma mensagem prática de segurança rodoviária em Angola.`,
  });
  return (
    response.text?.trim() ||
    `Parabéns a ${params.winnerName} pela vitória com ${params.winnerScore} pontos! Continuem a praticar o Código de Estrada para estradas mais seguras em Angola.`
  ).slice(0, 1800);
}

export async function askVirtualExaminer(question: string): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: question,
    config: {
      systemInstruction: `És a Examinadora Virtual da Escola de Condução Live em Angola.
Responde às dúvidas dos alunos sobre o Código de Estrada de Angola, sinalização rodoviária, prioridades, condução defensiva e preparação para o exame teórico.
Regras:
- Responde em português de Angola, de forma clara, estruturada e pedagógica (máximo 200 palavras).
- Nunca inventes números exatos de artigos legais ou valores de coimas sem certeza verificável; quando não houver confirmação exata, explica a regra prática e recomenda consulta do exemplar oficial do Código de Estrada de Angola.`,
    },
  });
  return (
    response.text?.trim() ||
    'Não foi possível processar a dúvida neste momento. Tenta reformular a pergunta.'
  );
}

// In-memory LRU cache for synthesized TTS WAV audio (max 80 entries)
const ttsCache = new Map<string, string>();

export async function synthesizePortugueseSpeech(
  text: string
): Promise<{ audioBase64: string; mimeType: string; provider: string }> {
  const cleanText = text.trim().slice(0, 600);
  if (!cleanText) {
    throw new Error('Texto vazio para síntese de voz.');
  }

  const cached = ttsCache.get(cleanText);
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
    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cloudTtsKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: cleanText },
            voice: {
              languageCode: 'pt-PT',
              name: 'pt-PT-Wavenet-A',
              ssmlGender: 'FEMALE',
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.02,
            },
          }),
        }
      );
      if (res.ok) {
        const json = (await res.json()) as { audioContent?: string };
        if (json.audioContent) {
          cacheTts(cleanText, json.audioContent);
          return {
            audioBase64: json.audioContent,
            mimeType: 'audio/mp3',
            provider: 'google-cloud-tts',
          };
        }
      }
    } catch (err) {
      console.warn('Cloud TTS falhou, a usar Gemini TTS:', err);
    }
  }

  // 2. Built-in Gemini TTS (gemini-3.8-flash-lite-tts) returning WAV
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanText,
            speechMetadata: {
              style:
                'Examinadora de condução em Angola, voz feminina clara, profissional e acolhedora em português',
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
  if (!base64Audio) {
    throw new Error('Não foi possível gerar o áudio da examinadora virtual.');
  }

  cacheTts(cleanText, base64Audio);
  return {
    audioBase64: base64Audio,
    mimeType: 'audio/wav',
    provider: 'gemini-tts',
  };
}

function cacheTts(key: string, value: string) {
  if (ttsCache.size >= 80) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) ttsCache.delete(firstKey);
  }
  ttsCache.set(key, value);
}
