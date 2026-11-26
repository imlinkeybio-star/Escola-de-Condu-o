export type RoomStatus =
  | 'WAITING'
  | 'STARTING'
  | 'PLAYING'
  | 'ANSWER_REVEAL'
  | 'LEADERBOARD'
  | 'FINISHED';

export type DifficultyLevel =
  | 'Iniciante'
  | 'Intermédio'
  | 'Avançado'
  | 'Exame Oficial';

export type DriverTier =
  | 'Aprendiz'
  | 'Condutor'
  | 'Especialista'
  | 'Mestre da Estrada';

export type SignType =
  | 'none'
  | 'lombas'
  | 'passagem_peoes'
  | 'stop'
  | 'cedencia_passagem'
  | 'proibido_ultrapassar'
  | 'velocidade_60'
  | 'velocidade_50'
  | 'velocidade_80'
  | 'curva_perigosa'
  | 'sentido_proibido'
  | 'rotunda'
  | 'cruzamento'
  | 'estacionamento_proibido'
  | 'piso_escorregadio'
  | 'trabalhos_via'
  | 'semaforos';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  totalPoints: number;
  wins: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  currentStreak: number;
  bestStreak: number;
  tier: DriverTier;
  disabled: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  drivingSchool?: string;
  province?: string;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  totpEnabled?: boolean;
  totpSealedSecret?: string;
  updatedAt: unknown;
}

export type ParticipantStatus =
  | 'WAITING'
  | 'PLAYING'
  | 'ANSWER_REVEAL'
  | 'FINISHED';

export interface CompetitionRoom {
  roomId: string;
  code: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  status: RoomStatus;
  maxParticipants: number;
  participantCount: number;
  finishedCount: number;
  totalQuestions: number;
  timePerQuestion: number;
  pointsPerCorrect: number;
  difficulty: DifficultyLevel;
  category: string;
  currentQuestionIndex: number;
  questionStartedAtMs?: number;
  questionEndsAtMs?: number;
  questionEndsAt?: unknown;
  roundToken?: string;
  aiSummary?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RoomParticipant {
  uid: string;
  roomId: string;
  displayName: string;
  photoURL?: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  lastScoredQuestionIndex: number;
  status: ParticipantStatus;
  currentQuestionIndex: number;
  questionsGenerated: boolean;
  questionStartedAtMs?: number;
  questionEndsAtMs?: number;
  questionEndsAt?: unknown;
  roundToken?: string;
  finishedAt?: unknown;
  online: boolean;
  joinedAt: unknown;
  lastActiveAt: unknown;
}

export interface RoomQuestion {
  roomId: string;
  uid?: string;
  questionIndex: number;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
  signType: SignType | string;
  sealedPayload: string;
  answerCommitment: string;
  createdAt: unknown;
}

export interface RoomAnswer {
  roomId: string;
  questionIndex: number;
  uid: string;
  displayName: string;
  selectedIndex: number;
  submittedAt: unknown;
}

export interface RoomRevealedAnswer {
  roomId: string;
  uid?: string;
  questionIndex: number;
  correctIndex: number;
  explanation: string;
  legalReference: string;
  revealProof: string;
  revealedAt: unknown;
}

export interface CompetitionArchive {
  competitionId: string;
  roomId: string;
  title: string;
  code: string;
  winnerUid: string;
  winnerName: string;
  winnerScore: number;
  participantCount: number;
  totalQuestions: number;
  isPublic: boolean;
  finishedAt: unknown;
}

export interface UserResult {
  resultId: string;
  roomId: string;
  roomTitle: string;
  uid: string;
  displayName: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  rank: number;
  totalParticipants: number;
  totalQuestions: number;
  isWinner: boolean;
  isPublic: boolean;
  finishedAt: unknown;
}

export interface RankingEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  accuracy: number;
  weekKey?: string;
  updatedAt: unknown;
}

export interface AchievementRecord {
  uid: string;
  achievementId: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  unlockedAt: unknown;
}

export type BroadcastKind =
  | 'informative'
  | 'link'
  | 'ad_banner'
  | 'ad_audio'
  | 'ad_video';

export interface BroadcastItem {
  id: string;
  kind: BroadcastKind;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  mediaUrl?: string;
  aiGenerated: boolean;
  active: boolean;
  showInBanner: boolean;
  durationSeconds: number;
  cooldownMinutes: number;
  createdByUid: string;
  createdByEmail: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  id?: string;
  uid: string;
  title: string;
  body: string;
  roomId?: string;
  linkUrl?: string;
  linkLabel?: string;
  kind?: BroadcastKind;
  aiGenerated?: boolean;
  read: boolean;
  createdAt: unknown;
}

export interface QuestionBankItem {
  id?: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  legalReference: string;
  category: string;
  difficulty: string;
  signType: string;
  active: boolean;
  createdBy: string;
  createdAt: unknown;
}

export interface AuditLog {
  id?: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: unknown;
}

export interface StaffPermission {
  email: string;
  label?: string;
  canViewReserved: boolean;
  canAdmin: boolean;
  canAnnounce: boolean;
  active: boolean;
  addedByUid: string;
  addedByEmail: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export const ANGOLA_PROVINCES = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huíla',
  'Cabinda',
  'Namibe',
  'Malanje',
  'Bié',
  'Uíge',
  'Cuanza Sul',
  'Cuanza Norte',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Cuando Cubango',
  'Cunene',
  'Bengo',
  'Zaire',
];

export const QUESTION_CATEGORIES = [
  'Geral',
  'Sinais de Trânsito',
  'Regras de Prioridade',
  'Limites de Velocidade',
  'Condução Defensiva',
  'Rotundas e Cruzamentos',
  'Documentação Obrigatória',
  'Primeiros Socorros',
  'Mecânica Básica',
];

export const ACHIEVEMENTS_CATALOG = [
  {
    id: 'primeira_corrida',
    title: 'Primeira Partida',
    description: 'Completou a sua primeira competição ao vivo.',
    tier: 'bronze' as const,
  },
  {
    id: 'vitoria_inaugural',
    title: 'Campeão da Pista',
    description: 'Alcançou o 1.º lugar numa competição oficial.',
    tier: 'gold' as const,
  },
  {
    id: 'precisao_80',
    title: 'Volante Certeiro',
    description: 'Obteve pelo menos 80% de acerto numa competição.',
    tier: 'silver' as const,
  },
  {
    id: 'cem_pontos',
    title: 'Centurião da Estrada',
    description: 'Acumulou 100 ou mais pontos totais no ranking geral.',
    tier: 'silver' as const,
  },
  {
    id: 'cinco_vitorias',
    title: 'Instrutor Honorário',
    description: 'Venceu 5 competições ao vivo.',
    tier: 'gold' as const,
  },
  {
    id: 'sequencia_5',
    title: 'Sem Travões',
    description: 'Manteve uma sequência de 5 ou mais jogos com pontuação.',
    tier: 'gold' as const,
  },
];

export function computeDriverTier(points: number): DriverTier {
  if (points >= 1000) return 'Mestre da Estrada';
  if (points >= 400) return 'Especialista';
  if (points >= 100) return 'Condutor';
  return 'Aprendiz';
}

export function getCurrentWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(weekNo).padStart(2, '0')}`;
}
