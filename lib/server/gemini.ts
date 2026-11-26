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

export async function generateAngolaDrivingQuestions(params: {
  count: number;
  difficulty: string;
  category: string;
  roomTitle: string;
}): Promise<GeneratedQuestionRaw[]> {
  const ai = getAIClient();
  const count = Math.min(Math.max(params.count, 1), 25);

  const systemInstruction = `És uma examinadora oficial de condução em Angola para a plataforma ESCOLA DE CONDUÇÃO LIVE.
Gera exatamente ${count} perguntas de exame teórico de condução em português utilizado em Angola (português claro, formal e educativo, ex: "peões", "passadeira", "rotunda", "carta de condução", "Código de Estrada").

REGRAS RIGOROSAS DE VERACIDADE LEGAL:
1. Baseia-te exclusivamente em princípios reais do Código de Estrada de Angola (Decreto-Lei n.º 5/08 e normas da DTSER / Viação e Trânsito) e na Convenção de Viena sobre Sinalização Rodoviária aplicável em Angola.
2. NUNCA inventes números de artigos específicos, valores exatos de coimas em Kwanzas ou prazos numéricos se não tiveres 100% de certeza. Quando explicares regras legais, refere o princípio geral do Código de Estrada de Angola (ex: "Princípio da prioridade à direita — Código de Estrada de Angola" ou "Sinalização de Perigo — Código de Estrada de Angola").
3. Cada pergunta deve ter exatamente 4 opções distintas (sem prefixo A/B/C/D nas strings das opções), apenas 1 resposta inequívoca e correta, e uma explicação educativa clara e objetiva.
4. Para o campo "signType", escolhe o sinal mais adequado desta lista exata: ${VALID_SIGN_TYPES.join(', ')}. Usa um sinal específico sempre que a pergunta envolver sinalização ou manobra associada, ou "none" para perguntas puramente teóricas (documentação, primeiros socorros, mecânica).
5. Se usares um sinal de trânsito específico, certifica-te de que a pergunta e a resposta correta correspondem fielmente ao significado desse sinal!`;

  const prompt = `Cria ${count} perguntas variadas para o concurso "${params.roomTitle}".
Nível de dificuldade: ${params.difficulty}.
Categoria principal: ${params.category}.
Inclui uma mistura equilibrada de sinais de trânsito, prioridades, limites de velocidade, rotundas, ultrapassagens, condução defensiva e segurança rodoviária em Angola.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
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
              description: 'Exatamente 4 opções de resposta curtas e claras.',
            },
            correctIndex: {
              type: Type.INTEGER,
              description: 'Índice da resposta correta (0, 1, 2 ou 3).',
            },
            explanation: {
              type: Type.STRING,
              description: 'Explicação educativa clara para o aluno aprender.',
            },
            legalReference: {
              type: Type.STRING,
              description:
                'Referência geral verificável (ex: Código de Estrada de Angola — Regras de Prioridade). Sem inventar números de artigo.',
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
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as GeneratedQuestionRaw[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('A IA não devolveu perguntas válidas.');
  }

  return parsed.slice(0, count).map((q) => {
    const cleanOptions = Array.isArray(q.options)
      ? q.options.slice(0, 4).map((o) => String(o).trim().slice(0, 180))
      : ['Opção A', 'Opção B', 'Opção C', 'Opção D'];
    while (cleanOptions.length < 4) {
      cleanOptions.push(`Opção ${cleanOptions.length + 1}`);
    }
    const safeIdx =
      typeof q.correctIndex === 'number' &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
        ? Math.floor(q.correctIndex)
        : 0;
    const safeSign = VALID_SIGN_TYPES.includes(
      q.signType as (typeof VALID_SIGN_TYPES)[number]
    )
      ? q.signType
      : 'none';

    return {
      questionText: String(q.questionText || '').trim().slice(0, 480),
      options: cleanOptions,
      correctIndex: safeIdx,
      explanation: String(q.explanation || 'Resposta verificada pelo Código de Estrada.').trim().slice(0, 1400),
      legalReference: String(q.legalReference || 'Código de Estrada de Angola').trim().slice(0, 280),
      category: String(q.category || params.category).trim().slice(0, 75),
      signType: safeSign,
    };
  });
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
