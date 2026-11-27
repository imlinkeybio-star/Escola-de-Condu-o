import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ACHIEVEMENTS_CATALOG,
  BroadcastItem,
  BroadcastKind,
  computeDriverTier,
  CompetitionRoom,
  DifficultyLevel,
  getCurrentWeekKey,
  QuestionBankItem,
  RoomParticipant,
  RoomQuestion,
  RoomRevealedAnswer,
  StaffPermission,
  UserPrivateInfo,
  UserProfile,
} from './types';
import {
  APP_OWNER_EMAIL,
  APP_OWNER_USERNAME,
  isAppOwnerEmail,
  sanitizeAvatarPhotoUrl,
  sanitizeSafeUrl,
} from './url-safety';
import { getActiveLanguage } from './i18n';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'id';
}

export function normalizeEmailKey(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 200);
}

export function isValidEmailAddress(email: string): boolean {
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(
    normalizeEmailKey(email)
  );
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function fetchServerTimeOffsetMs(): Promise<number> {
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    const t1 = Date.now();
    if (!res.ok) return 0;
    const data = (await res.json()) as { serverNowMs: number };
    const rtt = t1 - t0;
    return data.serverNowMs + Math.round(rtt / 2) - t1;
  } catch {
    return 0;
  }
}

export async function ensureUserProfile(
  user: User,
  extra?: { displayName?: string; drivingSchool?: string; province?: string }
): Promise<{ profile: UserProfile; privateInfo: UserPrivateInfo }> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  let profileSnap;
  try {
    profileSnap = await getDoc(doc(db, 'users', user.uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  let profile: UserProfile;
  if (!profileSnap.exists()) {
    const cleanName = (
      extra?.displayName ||
      (isAppOwnerEmail(user.email) ? APP_OWNER_USERNAME : user.displayName) ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'Condutor'
    )
      .trim()
      .slice(0, 60);
    const safeName = cleanName.length >= 2 ? cleanName : 'Condutor';

    const newProfile: Record<string, unknown> = {
      uid: user.uid,
      displayName: safeName,
      totalPoints: 0,
      wins: 0,
      gamesPlayed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      currentStreak: 0,
      bestStreak: 0,
      tier: 'Aprendiz',
      disabled: false,
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const safeInitialPhoto = sanitizeAvatarPhotoUrl(user.photoURL);
    if (safeInitialPhoto) {
      newProfile.photoURL = safeInitialPhoto;
    }

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      const createdSnap = await getDoc(doc(db, 'users', user.uid));
      profile = createdSnap.data() as UserProfile;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, userPath);
    }
  } else {
    profile = profileSnap.data() as UserProfile;
  }

  let privSnap;
  try {
    privSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, privatePath);
  }

  let privateInfo: UserPrivateInfo;
  if (!privSnap.exists()) {
    const newPriv: Record<string, unknown> = {
      uid: user.uid,
      email: (user.email || 'aluno@escolaconducao.ao').slice(0, 200),
      drivingSchool: (extra?.drivingSchool || 'Escola de Condução Nacional').slice(0, 120),
      province: (extra?.province || 'Luanda').slice(0, 60),
      voiceEnabled: true,
      notificationsEnabled: true,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'info'), newPriv);
      const createdPriv = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
      privateInfo = createdPriv.data() as UserPrivateInfo;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, privatePath);
    }
  } else {
    privateInfo = privSnap.data() as UserPrivateInfo;
  }

  return { profile, privateInfo };
}

export async function fetchMyStaffPermission(
  user: User | null
): Promise<StaffPermission | null> {
  if (!user || !user.email || !user.emailVerified) return null;
  const emailKey = normalizeEmailKey(user.email);
  if (!isValidEmailAddress(emailKey)) return null;
  try {
    const snap = await getDoc(doc(db, 'staff_permissions', emailKey));
    if (!snap.exists()) return null;
    return snap.data() as StaffPermission;
  } catch {
    return null;
  }
}

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAppOwnerEmail(user.email) && user.emailVerified) {
    return true;
  }
  const staff = await fetchMyStaffPermission(user);
  if (staff && staff.active && staff.canAdmin) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function updateUserProfileDetails(
  uid: string,
  updates: {
    displayName?: string;
    photoURL?: string | null;
    drivingSchool?: string;
    province?: string;
    voiceEnabled?: boolean;
    notificationsEnabled?: boolean;
    totpEnabled?: boolean;
    totpSealedSecret?: string | null;
  }
): Promise<void> {
  const cleanName =
    updates.displayName !== undefined
      ? updates.displayName.trim().slice(0, 60)
      : undefined;

  let resolvedPhoto: string | null | undefined = undefined;
  if (updates.photoURL === null || updates.photoURL === '') {
    resolvedPhoto = null;
  } else if (updates.photoURL !== undefined) {
    const safe = sanitizeAvatarPhotoUrl(updates.photoURL);
    if (!safe) {
      throw new Error(
        'Formato de imagem inválido ou ficheiro demasiado grande (usa JPG, PNG ou URL https://).'
      );
    }
    resolvedPhoto = safe;
  }

  if (cleanName !== undefined || resolvedPhoto !== undefined) {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (cleanName !== undefined) {
      if (cleanName.length < 2) {
        throw new Error('O nome deve ter pelo menos 2 caracteres.');
      }
      payload.displayName = cleanName;
    }
    if (resolvedPhoto === null) {
      payload.photoURL = deleteField();
    } else if (resolvedPhoto !== undefined) {
      payload.photoURL = resolvedPhoto;
    }

    try {
      await updateDoc(doc(db, 'users', uid), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }

    // Best-effort sync of displayName / photoURL on public ranking entries
    const syncRankingDoc = async (ref: ReturnType<typeof doc>) => {
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const rankingUpdate: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };
        if (cleanName !== undefined) rankingUpdate.displayName = cleanName;
        if (resolvedPhoto === null) rankingUpdate.photoURL = deleteField();
        else if (resolvedPhoto !== undefined) rankingUpdate.photoURL = resolvedPhoto;
        await updateDoc(ref, rankingUpdate);
      } catch {
        // Non-blocking sync
      }
    };

    const weekKey = getCurrentWeekKey();
    await Promise.all([
      syncRankingDoc(doc(db, 'global_rankings', uid)),
      syncRankingDoc(doc(db, 'weekly_rankings', `${weekKey}_${uid}`)),
    ]);
  }

  if (
    updates.drivingSchool !== undefined ||
    updates.province !== undefined ||
    updates.voiceEnabled !== undefined ||
    updates.notificationsEnabled !== undefined ||
    updates.totpEnabled !== undefined ||
    updates.totpSealedSecret !== undefined
  ) {
    const privPayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.drivingSchool !== undefined) {
      privPayload.drivingSchool = updates.drivingSchool.trim().slice(0, 120);
    }
    if (updates.province !== undefined) {
      privPayload.province = updates.province.trim().slice(0, 60);
    }
    if (updates.voiceEnabled !== undefined) {
      privPayload.voiceEnabled = updates.voiceEnabled;
    }
    if (updates.notificationsEnabled !== undefined) {
      privPayload.notificationsEnabled = updates.notificationsEnabled;
    }
    if (updates.totpEnabled !== undefined) {
      privPayload.totpEnabled = updates.totpEnabled;
    }
    if (updates.totpSealedSecret === null || updates.totpSealedSecret === '') {
      privPayload.totpSealedSecret = deleteField();
    } else if (updates.totpSealedSecret !== undefined) {
      privPayload.totpSealedSecret = updates.totpSealedSecret.slice(0, 1000);
    }
    try {
      await updateDoc(doc(db, 'users', uid, 'private', 'info'), privPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/info`);
    }
  }
}

export async function createCompetitionRoom(params: {
  title: string;
  description?: string;
  maxParticipants: number;
  totalQuestions: number;
  timePerQuestion: number;
  difficulty: DifficultyLevel;
  category: string;
  isPublic: boolean;
  hostProfile: UserProfile;
  isAdminUser?: boolean;
}): Promise<CompetitionRoom> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Inicia sessão para criar uma sala.');

  const roomId = sanitizeId(`sala_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const code = generateRoomCode();

  const roomData: Record<string, unknown> = {
    roomId,
    code,
    title: params.title.trim().slice(0, 100),
    description: (
      params.description ||
      'Perguntas 100% geradas em tempo real pela IA com base no Código de Estrada de Angola. Ranking ativo até 100 finalistas!'
    )
      .trim()
      .slice(0, 300),
    hostId: currentUser.uid,
    hostName: params.hostProfile.displayName.slice(0, 60),
    isPublic: params.isPublic,
    status: 'WAITING',
    maxParticipants: Math.min(Math.max(params.maxParticipants, 2), 1000),
    participantCount: 0,
    finishedCount: 0,
    totalQuestions: Math.min(Math.max(params.totalQuestions, 3), 25),
    timePerQuestion: Math.min(Math.max(params.timePerQuestion, 15), 180),
    pointsPerCorrect: 10,
    difficulty: params.difficulty,
    category: params.category.slice(0, 60),
    currentQuestionIndex: -1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'rooms', roomId), roomData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }

  if (params.isAdminUser) {
    await logAdminAudit({
      action: 'CREATE_ROOM',
      targetType: 'room',
      targetId: roomId,
      details: `Sala "${params.title}" (${code}) criada com perguntas IA em tempo real por aluno.`,
    });
  }

  const snap = await getDoc(doc(db, 'rooms', roomId));
  return snap.data() as CompetitionRoom;
}

export async function deleteCompetitionRoom(
  roomId: string,
  isAdminUser = false
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Inicia sessão para eliminar uma sala.');

  const cleanRoomId = sanitizeId(roomId);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error('Esta sala já foi eliminada ou não existe.');
  }
  const room = roomSnap.data() as CompetitionRoom;
  const ownerOverride = isAppOwnerEmail(currentUser.email) && currentUser.emailVerified;
  if (room.hostId !== currentUser.uid && !isAdminUser && !ownerOverride) {
    throw new Error('Apenas o criador da sala ou um administrador pode eliminá-la.');
  }

  // Best-effort cleanup of own participant entry before deleting room
  try {
    await deleteDoc(doc(db, 'rooms', cleanRoomId, 'participants', currentUser.uid));
  } catch {
    // Non-blocking
  }

  try {
    await deleteDoc(roomRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanRoomId}`);
  }

  if (isAdminUser || ownerOverride) {
    await logAdminAudit({
      action: 'DELETE_ROOM',
      targetType: 'room',
      targetId: cleanRoomId,
      details: `Sala "${room.title}" (${room.code}) eliminada.`,
    });
  }
}

export async function findRoomByCode(rawCode: string): Promise<CompetitionRoom | null> {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return null;

  try {
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      where('code', '==', code),
      limit(1)
    );
    const snaps = await getDocs(q);
    if (snaps.empty) return null;
    return snaps.docs[0].data() as CompetitionRoom;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }
}

export async function joinCompetitionRoom(
  roomId: string,
  profile: UserProfile
): Promise<void> {
  const participantRef = doc(db, 'rooms', roomId, 'participants', profile.uid);
  const roomRef = doc(db, 'rooms', roomId);

  try {
    await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('Esta sala de competição não existe.');
      }
      const room = roomSnap.data() as CompetitionRoom;
      const finishedCount = typeof room.finishedCount === 'number' ? room.finishedCount : 0;
      const isRoomClosed = room.status === 'FINISHED' || finishedCount >= 100;

      const partSnap = await tx.get(participantRef);
      if (partSnap.exists()) {
        const existingPart = partSnap.data() as RoomParticipant;
        // If participant already finished or room hit 100 finishers, keep read-only access
        if (existingPart.status === 'FINISHED' || isRoomClosed) {
          return;
        }
        tx.update(participantRef, {
          online: true,
          lastActiveAt: serverTimestamp(),
        });
        return;
      }

      if (isRoomClosed) {
        throw new Error('Esta sala já atingiu 100 finalistas e encerrou o ranking.');
      }

      if (room.participantCount >= room.maxParticipants) {
        throw new Error('A sala atingiu o limite máximo de participantes.');
      }

      const newPart: Record<string, unknown> = {
        uid: profile.uid,
        roomId,
        displayName: profile.displayName.slice(0, 60),
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        lastScoredQuestionIndex: -1,
        status: 'WAITING',
        currentQuestionIndex: -1,
        questionsGenerated: false,
        online: true,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      };
      const safeJoinedPhoto = sanitizeAvatarPhotoUrl(profile.photoURL);
      if (safeJoinedPhoto) {
        newPart.photoURL = safeJoinedPhoto;
      }

      tx.set(participantRef, newPart);
      tx.update(roomRef, {
        participantCount: room.participantCount + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Missing or insufficient permissions')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/participants/${profile.uid}`);
  }
}

export async function startPlayerGame(room: CompetitionRoom): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada.');
  const idToken = await user.getIdToken();

  // Check if player already generated questions or finished
  const partRef = doc(db, 'rooms', room.roomId, 'participants', user.uid);
  const partSnap = await getDoc(partRef);
  if (!partSnap.exists()) {
    throw new Error('Entra primeiro na sala.');
  }
  const part = partSnap.data() as RoomParticipant;
  if (part.status === 'FINISHED') {
    throw new Error('Já concluíste esta competição.');
  }

  // 1. Generate 100% live randomized AI questions uniquely for this participant
  if (!part.questionsGenerated) {
    const aiRes = await fetch('/api/ai/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        roomId: room.roomId,
        count: room.totalQuestions,
        difficulty: room.difficulty,
        category: room.category,
        roomTitle: room.title,
        language: getActiveLanguage(),
      }),
    });

    const aiJson = (await aiRes.json()) as {
      questions?: Array<Omit<RoomQuestion, 'createdAt'>>;
      error?: string;
    };
    if (!aiRes.ok || !aiJson.questions || aiJson.questions.length === 0) {
      throw new Error(aiJson.error || 'A IA não conseguiu gerar as tuas perguntas em tempo real.');
    }

    try {
      const batch = writeBatch(db);
      for (const q of aiJson.questions) {
        const qDocId = `${user.uid}_${q.questionIndex}`;
        const qRef = doc(db, 'rooms', room.roomId, 'player_questions', qDocId);
        batch.set(qRef, {
          ...q,
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `rooms/${room.roomId}/player_questions`);
    }
  }

  // 2. Start round 0 with authoritative server timer for this participant
  const roundRes = await fetch('/api/competition/start-round', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      roomId: room.roomId,
      questionIndex: 0,
      timePerQuestion: room.timePerQuestion,
    }),
  });

  const roundData = (await roundRes.json()) as {
    questionStartedAtMs?: number;
    questionEndsAtMs?: number;
    roundToken?: string;
    error?: string;
  };
  if (!roundRes.ok || !roundData.roundToken || !roundData.questionEndsAtMs) {
    throw new Error(roundData.error || 'Não foi possível iniciar o teu temporizador.');
  }

  try {
    await updateDoc(partRef, {
      status: 'PLAYING',
      currentQuestionIndex: 0,
      questionsGenerated: true,
      questionStartedAtMs: roundData.questionStartedAtMs,
      questionEndsAtMs: roundData.questionEndsAtMs,
      questionEndsAt: Timestamp.fromMillis(roundData.questionEndsAtMs),
      roundToken: roundData.roundToken,
      lastActiveAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.roomId}/participants/${user.uid}`);
  }

  // Mark room status as PLAYING if still WAITING (keeps room open to new players until 100 finishers)
  if (room.status === 'WAITING') {
    try {
      await updateDoc(doc(db, 'rooms', room.roomId), {
        status: 'PLAYING',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking if another player transitioned it concurrently
    }
  }
}

export async function advancePlayerQuestion(
  room: CompetitionRoom,
  nextQuestionIndex: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada.');
  const idToken = await user.getIdToken();

  const roundRes = await fetch('/api/competition/start-round', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      roomId: room.roomId,
      questionIndex: nextQuestionIndex,
      timePerQuestion: room.timePerQuestion,
    }),
  });

  const roundData = (await roundRes.json()) as {
    questionStartedAtMs?: number;
    questionEndsAtMs?: number;
    roundToken?: string;
    error?: string;
  };
  if (!roundRes.ok || !roundData.roundToken || !roundData.questionEndsAtMs) {
    throw new Error(roundData.error || 'Não foi possível avançar para a próxima pergunta.');
  }

  const partRef = doc(db, 'rooms', room.roomId, 'participants', user.uid);
  try {
    await updateDoc(partRef, {
      status: 'PLAYING',
      currentQuestionIndex: nextQuestionIndex,
      questionsGenerated: true,
      questionStartedAtMs: roundData.questionStartedAtMs,
      questionEndsAtMs: roundData.questionEndsAtMs,
      questionEndsAt: Timestamp.fromMillis(roundData.questionEndsAtMs),
      roundToken: roundData.roundToken,
      lastActiveAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.roomId}/participants/${user.uid}`);
  }
}

export async function submitPlayerAnswer(params: {
  roomId: string;
  questionIndex: number;
  uid: string;
  displayName: string;
  selectedIndex: number;
}): Promise<void> {
  const answerId = `${params.questionIndex}_${params.uid}`;
  const path = `rooms/${params.roomId}/answers/${answerId}`;
  try {
    await setDoc(doc(db, 'rooms', params.roomId, 'answers', answerId), {
      roomId: params.roomId,
      questionIndex: params.questionIndex,
      uid: params.uid,
      displayName: params.displayName.slice(0, 60),
      selectedIndex: params.selectedIndex,
      submittedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function revealAndScorePlayerRound(params: {
  room: CompetitionRoom;
  participant: RoomParticipant;
  question: RoomQuestion;
}): Promise<RoomRevealedAnswer | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const idToken = await user.getIdToken();

  const res = await fetch('/api/competition/reveal-answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      roomId: params.room.roomId,
      questionIndex: params.question.questionIndex,
      roundToken: params.participant.roundToken,
      sealedPayload: params.question.sealedPayload,
    }),
  });

  if (!res.ok) {
    return null;
  }

  const revealData = (await res.json()) as {
    correctIndex: number;
    explanation: string;
    legalReference: string;
    revealProof: string;
  };

  const rDocId = `${user.uid}_${params.question.questionIndex}`;
  const revealedRef = doc(db, 'rooms', params.room.roomId, 'player_revealed', rDocId);
  const existingRevealed = await getDoc(revealedRef);

  if (!existingRevealed.exists()) {
    try {
      await setDoc(revealedRef, {
        roomId: params.room.roomId,
        uid: user.uid,
        questionIndex: params.question.questionIndex,
        correctIndex: revealData.correctIndex,
        explanation: revealData.explanation,
        legalReference: revealData.legalReference,
        revealProof: revealData.revealProof,
        revealedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Concorrência na escrita de revelação:', err);
    }
  }

  const partRef = doc(db, 'rooms', params.room.roomId, 'participants', user.uid);
  const ansRef = doc(
    db,
    'rooms',
    params.room.roomId,
    'answers',
    `${params.question.questionIndex}_${user.uid}`
  );

  let scoredDeltaPoints = 0;
  let scoredDeltaCorrect = 0;
  let didScoreThisRound = false;

  try {
    await runTransaction(db, async (tx) => {
      const partSnap = await tx.get(partRef);
      if (!partSnap.exists()) return;
      const part = partSnap.data() as RoomParticipant;
      if (part.status !== 'PLAYING') return;
      if (part.lastScoredQuestionIndex >= params.question.questionIndex) return;
      if (part.lastScoredQuestionIndex !== params.question.questionIndex - 1) return;

      const ansSnap = await tx.get(ansRef);
      const isCorrect =
        ansSnap.exists() && ansSnap.data().selectedIndex === revealData.correctIndex;

      scoredDeltaPoints = isCorrect ? params.room.pointsPerCorrect : 0;
      scoredDeltaCorrect = isCorrect ? 1 : 0;
      didScoreThisRound = true;

      tx.update(partRef, {
        status: 'ANSWER_REVEAL',
        score: part.score + scoredDeltaPoints,
        correctCount: part.correctCount + scoredDeltaCorrect,
        wrongCount: isCorrect ? part.wrongCount : part.wrongCount + 1,
        lastScoredQuestionIndex: params.question.questionIndex,
        lastActiveAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `rooms/${params.room.roomId}/participants/${user.uid}`
    );
  }

  // Real-time live profile update on every scored question so Dashboard, Estatísticas & Perfil update during the game
  if (didScoreThisRound) {
    const userRef = doc(db, 'users', user.uid);
    try {
      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) return;
        const u = uSnap.data() as UserProfile;
        const nextPoints = (u.totalPoints || 0) + scoredDeltaPoints;
        const nextCorrect = (u.correctAnswers || 0) + scoredDeltaCorrect;
        const nextTotalAns = (u.totalAnswers || 0) + 1;
        tx.update(userRef, {
          totalPoints: nextPoints,
          correctAnswers: nextCorrect,
          totalAnswers: nextTotalAns,
          tier: computeDriverTier(nextPoints),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn('Atualização live de estatísticas após pergunta:', err);
    }
  }

  const snap = await getDoc(revealedRef);
  return snap.exists() ? (snap.data() as RoomRevealedAnswer) : null;
}

export async function finishPlayerCompetition(params: {
  room: CompetitionRoom;
  profile: UserProfile;
}): Promise<{ finishedCount: number; roomClosed: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada.');

  const roomRef = doc(db, 'rooms', params.room.roomId);
  const partRef = doc(db, 'rooms', params.room.roomId, 'participants', user.uid);

  let nextFinishedCount = typeof params.room.finishedCount === 'number' ? params.room.finishedCount : 0;
  let roomClosed = params.room.status === 'FINISHED';

  try {
    await runTransaction(db, async (tx) => {
      const [roomSnap, partSnap] = await Promise.all([tx.get(roomRef), tx.get(partRef)]);
      if (!roomSnap.exists() || !partSnap.exists()) return;

      const r = roomSnap.data() as CompetitionRoom;
      const p = partSnap.data() as RoomParticipant;

      if (p.status === 'FINISHED') {
        nextFinishedCount = typeof r.finishedCount === 'number' ? r.finishedCount : 0;
        roomClosed = r.status === 'FINISHED' || nextFinishedCount >= 100;
        return;
      }

      const prevFinished = typeof r.finishedCount === 'number' ? r.finishedCount : 0;
      if (r.status === 'FINISHED' || prevFinished >= 100) {
        throw new Error('A sala já concluiu os 100 finalistas e encerrou o ranking.');
      }

      nextFinishedCount = prevFinished + 1;
      roomClosed = nextFinishedCount >= 100;

      tx.update(partRef, {
        status: 'FINISHED',
        finishedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      tx.update(roomRef, {
        finishedCount: nextFinishedCount,
        status: roomClosed ? 'FINISHED' : r.status,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Missing or insufficient permissions')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `rooms/${params.room.roomId}`);
  }

  // Fetch latest participants for ranking position snapshot and record personal result
  const partSnaps = await getDocs(
    query(
      collection(db, 'rooms', params.room.roomId, 'participants'),
      where('roomId', '==', params.room.roomId),
      orderBy('score', 'desc')
    )
  );
  const participants = partSnaps.docs.map((d) => d.data() as RoomParticipant);

  await recordMyCompetitionResult({
    room: { ...params.room, finishedCount: nextFinishedCount },
    participants,
    profile: params.profile,
  });

  // Archive competition when 100th finisher completes
  if (roomClosed) {
    try {
      const sorted = [...participants].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const compRef = doc(db, 'competitions', params.room.roomId);
      const existingComp = await getDoc(compRef);
      if (!existingComp.exists()) {
        await setDoc(compRef, {
          competitionId: params.room.roomId,
          roomId: params.room.roomId,
          title: params.room.title,
          code: params.room.code,
          winnerUid: winner?.uid || params.room.hostId,
          winnerName: winner?.displayName || params.room.hostName,
          winnerScore: winner?.score || 0,
          participantCount: sorted.length,
          totalQuestions: params.room.totalQuestions,
          isPublic: params.room.isPublic,
          finishedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Erro ao arquivar competição:', err);
    }
  }

  return { finishedCount: nextFinishedCount, roomClosed };
}

export async function recordMyCompetitionResult(params: {
  room: CompetitionRoom;
  participants: RoomParticipant[];
  profile: UserProfile;
}): Promise<void> {
  const sorted = [...params.participants].sort(
    (a, b) => b.score - a.score || b.correctCount - a.correctCount
  );
  const myIndex = sorted.findIndex((p) => p.uid === params.profile.uid);
  if (myIndex === -1) return;

  const me = sorted[myIndex];
  const rank = myIndex + 1;
  const isWinner = rank === 1 && sorted.length > 0;
  const totalAnswered = me.correctCount + me.wrongCount;
  const accuracy =
    params.room.totalQuestions > 0
      ? Math.round((me.correctCount / params.room.totalQuestions) * 100)
      : 0;

  const resultId = `${params.room.roomId}_${params.profile.uid}`;
  const resultRef = doc(db, 'results', resultId);
  const existingResult = await getDoc(resultRef);
  if (existingResult.exists()) return; // Idempotent guard!

  try {
    await setDoc(resultRef, {
      resultId,
      roomId: params.room.roomId,
      roomTitle: params.room.title,
      uid: params.profile.uid,
      displayName: params.profile.displayName,
      score: me.score,
      correctCount: me.correctCount,
      wrongCount: me.wrongCount,
      accuracy,
      rank,
      totalParticipants: sorted.length,
      totalQuestions: params.room.totalQuestions,
      isWinner,
      isPublic: params.room.isPublic,
      finishedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `results/${resultId}`);
  }

  // Read fresh UserProfile from Firestore so stats never drift on consecutive games
  const userRef = doc(db, 'users', params.profile.uid);
  const freshSnap = await getDoc(userRef);
  const baseProfile = freshSnap.exists()
    ? (freshSnap.data() as UserProfile)
    : params.profile;

  const newPoints = Math.max(baseProfile.totalPoints, me.score);
  const newWins = baseProfile.wins + (isWinner ? 1 : 0);
  const newGames = baseProfile.gamesPlayed + 1;
  const newCorrect = Math.max(baseProfile.correctAnswers, me.correctCount);
  const newTotalAns = Math.max(baseProfile.totalAnswers, totalAnswered);
  const newStreak = me.score > 0 ? baseProfile.currentStreak + 1 : 0;
  const newBestStreak = Math.max(baseProfile.bestStreak, newStreak);
  const newTier = computeDriverTier(newPoints);
  const overallAcc =
    newTotalAns > 0 ? Math.round((newCorrect / newTotalAns) * 100) : 0;

  try {
    await updateDoc(userRef, {
      totalPoints: newPoints,
      wins: newWins,
      gamesPlayed: newGames,
      correctAnswers: newCorrect,
      totalAnswers: newTotalAns,
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      tier: newTier,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.profile.uid}`);
  }

  // Update global_rankings
  const globalRef = doc(db, 'global_rankings', params.profile.uid);
  const globalPayload: Record<string, unknown> = {
    uid: params.profile.uid,
    displayName: baseProfile.displayName,
    points: newPoints,
    wins: newWins,
    gamesPlayed: newGames,
    accuracy: overallAcc,
    updatedAt: serverTimestamp(),
  };
  if (baseProfile.photoURL) globalPayload.photoURL = baseProfile.photoURL;

  try {
    await setDoc(globalRef, globalPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `global_rankings/${params.profile.uid}`
    );
  }

  // Update weekly_rankings
  const weekKey = getCurrentWeekKey();
  const weeklyId = `${weekKey}_${params.profile.uid}`;
  const weeklyRef = doc(db, 'weekly_rankings', weeklyId);
  try {
    const weeklySnap = await getDoc(weeklyRef);
    const prev = weeklySnap.exists() ? weeklySnap.data() : null;
    const weeklyData: Record<string, unknown> = {
      uid: params.profile.uid,
      displayName: baseProfile.displayName,
      points: (prev?.points || 0) + me.score,
      wins: (prev?.wins || 0) + (isWinner ? 1 : 0),
      gamesPlayed: (prev?.gamesPlayed || 0) + 1,
      accuracy: overallAcc,
      weekKey,
      updatedAt: serverTimestamp(),
    };
    if (baseProfile.photoURL) weeklyData.photoURL = baseProfile.photoURL;
    await setDoc(weeklyRef, weeklyData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `weekly_rankings/${weeklyId}`);
  }

  // Unlock earned achievements idempotently
  const earnedIds: string[] = ['primeira_corrida'];
  if (isWinner) earnedIds.push('vitoria_inaugural');
  if (accuracy >= 80) earnedIds.push('precisao_80');
  if (newPoints >= 100) earnedIds.push('cem_pontos');
  if (newWins >= 5) earnedIds.push('cinco_vitorias');
  if (newStreak >= 5) earnedIds.push('sequencia_5');

  for (const achId of earnedIds) {
    const def = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
    if (!def) continue;
    const achDocId = `${params.profile.uid}_${achId}`;
    try {
      const achSnap = await getDoc(doc(db, 'achievements', achDocId));
      if (!achSnap.exists()) {
        await setDoc(doc(db, 'achievements', achDocId), {
          uid: params.profile.uid,
          achievementId: def.id,
          title: def.title,
          description: def.description,
          tier: def.tier,
          unlockedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore individual achievement race
    }
  }
}

export async function createQuestionBankEntry(
  item: Omit<QuestionBankItem, 'id' | 'createdBy' | 'createdAt'>
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão necessária.');
  const id = sanitizeId(`qb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'question_bank', id), {
      ...item,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    await logAdminAudit({
      action: 'CREATE_QUESTION',
      targetType: 'question_bank',
      targetId: id,
      details: `Adicionada pergunta oficial na categoria ${item.category}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `question_bank/${id}`);
  }
}

export async function toggleUserDisabledStatus(
  targetUid: string,
  disabled: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      disabled,
      updatedAt: serverTimestamp(),
    });
    await logAdminAudit({
      action: disabled ? 'DISABLE_USER' : 'ENABLE_USER',
      targetType: 'user',
      targetId: targetUid,
      details: disabled
        ? 'Conta de utilizador desativada pelo administrador.'
        : 'Conta de utilizador reativada pelo administrador.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function logAdminAudit(params: {
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      actorUid: user.uid,
      actorEmail: (user.email || 'admin@escolaconducao.ao').slice(0, 200),
      action: params.action.slice(0, 80),
      targetType: params.targetType.slice(0, 60),
      targetId: sanitizeId(params.targetId),
      details: params.details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Erro ao registar auditoria:', err);
  }
}

export async function fetchActivePublicRooms(maxCount = 20): Promise<CompetitionRoom[]> {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data() as CompetitionRoom);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }
}

async function ensureCanAnnounce(user: User | null): Promise<void> {
  if (!user || !user.email || !user.emailVerified) {
    throw new Error(
      'Sessão verificada necessária. Entra com Google ou verifica o teu email.'
    );
  }
  if (isAppOwnerEmail(user.email)) return;
  const staff = await fetchMyStaffPermission(user);
  if (!staff || !staff.active || !staff.canAnnounce) {
    throw new Error(
      'Apenas o dono da aplicação ou emails autorizados a anunciar podem gerir anúncios.'
    );
  }
}

export async function createOwnerBroadcast(params: {
  kind: BroadcastKind;
  title: string;
  body: string;
  linkUrl?: string;
  linkLabel?: string;
  mediaUrl?: string;
  aiGenerated: boolean;
  active: boolean;
  showInBanner: boolean;
  durationSeconds?: number;
  cooldownMinutes?: number;
}): Promise<BroadcastItem> {
  const user = auth.currentUser;
  await ensureCanAnnounce(user);
  if (!user) throw new Error('Sessão necessária.');

  const safeLink = params.linkUrl?.trim() ? sanitizeSafeUrl(params.linkUrl) : null;
  if (params.linkUrl?.trim() && !safeLink) {
    throw new Error('Link inválido. Usa um endereço https://, http:// ou rota interna /...');
  }
  const safeMedia = params.mediaUrl?.trim() ? sanitizeSafeUrl(params.mediaUrl) : null;
  if (params.mediaUrl?.trim() && !safeMedia) {
    throw new Error('URL de mídia inválido. Usa https:// ou http://.');
  }

  const id = sanitizeId(`bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const payload: Record<string, unknown> = {
    id,
    kind: params.kind,
    title: params.title.trim().slice(0, 120),
    body: params.body.trim().slice(0, 600),
    aiGenerated: Boolean(params.aiGenerated),
    active: Boolean(params.active),
    showInBanner: Boolean(params.showInBanner),
    durationSeconds: Math.min(Math.max(Math.round(params.durationSeconds ?? 10), 5), 60),
    cooldownMinutes: Math.min(Math.max(Math.round(params.cooldownMinutes ?? 15), 1), 120),
    createdByUid: user.uid,
    createdByEmail: (user.email || APP_OWNER_EMAIL).slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (safeLink) payload.linkUrl = safeLink;
  if (params.linkLabel?.trim()) payload.linkLabel = params.linkLabel.trim().slice(0, 60);
  if (safeMedia) payload.mediaUrl = safeMedia;

  try {
    await setDoc(doc(db, 'broadcasts', id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `broadcasts/${id}`);
  }

  await logAdminAudit({
    action: 'CREATE_BROADCAST',
    targetType: 'broadcast',
    targetId: id,
    details: `Criado anúncio/notificação (${params.kind}): "${params.title.trim().slice(0, 80)}".`,
  });

  const snap = await getDoc(doc(db, 'broadcasts', id));
  return snap.data() as BroadcastItem;
}

export async function toggleOwnerBroadcastActive(
  broadcastId: string,
  active: boolean
): Promise<void> {
  const user = auth.currentUser;
  await ensureCanAnnounce(user);
  try {
    await updateDoc(doc(db, 'broadcasts', broadcastId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `broadcasts/${broadcastId}`);
  }
}

export async function deleteOwnerBroadcast(broadcastId: string): Promise<void> {
  const user = auth.currentUser;
  await ensureCanAnnounce(user);
  try {
    await deleteDoc(doc(db, 'broadcasts', broadcastId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `broadcasts/${broadcastId}`);
  }
}

export async function upsertStaffPermission(params: {
  email: string;
  label?: string;
  canViewReserved: boolean;
  canAdmin: boolean;
  canAnnounce: boolean;
  active: boolean;
}): Promise<StaffPermission> {
  const user = auth.currentUser;
  if (!user || !isAppOwnerEmail(user.email) || !user.emailVerified) {
    throw new Error(
      'Apenas o proprietário principal (kordelmauvesp@gmail.com) pode gerir permissões.'
    );
  }

  const emailKey = normalizeEmailKey(params.email);
  if (!isValidEmailAddress(emailKey)) {
    throw new Error('Insere um endereço de email válido.');
  }
  if (isAppOwnerEmail(emailKey)) {
    throw new Error(
      'O email principal do proprietário já possui acesso total permanente.'
    );
  }

  const ref = doc(db, 'staff_permissions', emailKey);
  const existing = await getDoc(ref);
  const cleanLabel = params.label?.trim().slice(0, 60) || '';

  const payload: Record<string, unknown> = {
    email: emailKey,
    canViewReserved: Boolean(params.canViewReserved),
    canAdmin: Boolean(params.canAdmin),
    canAnnounce: Boolean(params.canAnnounce),
    active: Boolean(params.active),
    addedByUid: user.uid,
    addedByEmail: (user.email || APP_OWNER_EMAIL).slice(0, 200),
    createdAt: existing.exists()
      ? (existing.data() as StaffPermission).createdAt
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanLabel) {
    payload.label = cleanLabel;
  }

  try {
    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(
      err,
      existing.exists() ? OperationType.UPDATE : OperationType.CREATE,
      `staff_permissions/${emailKey}`
    );
  }

  await logAdminAudit({
    action: existing.exists() ? 'UPDATE_STAFF_PERMISSION' : 'ADD_STAFF_PERMISSION',
    targetType: 'staff_permission',
    targetId: sanitizeId(emailKey),
    details: `Permissões para ${emailKey}: ver=${params.canViewReserved}, admin=${params.canAdmin}, anunciar=${params.canAnnounce}, ativo=${params.active}.`,
  });

  const snap = await getDoc(ref);
  return snap.data() as StaffPermission;
}

export async function deleteStaffPermission(email: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isAppOwnerEmail(user.email) || !user.emailVerified) {
    throw new Error(
      'Apenas o proprietário principal pode remover permissões de email.'
    );
  }
  const emailKey = normalizeEmailKey(email);
  if (!isValidEmailAddress(emailKey)) {
    throw new Error('Email inválido.');
  }
  try {
    await deleteDoc(doc(db, 'staff_permissions', emailKey));
    await logAdminAudit({
      action: 'REMOVE_STAFF_PERMISSION',
      targetType: 'staff_permission',
      targetId: sanitizeId(emailKey),
      details: `Removido acesso reservado do email ${emailKey}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `staff_permissions/${emailKey}`);
  }
}

export async function touchUserPresence(uid: string): Promise<void> {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking presence heartbeat
  }
}

export async function markUserNotificationsAndBroadcastsRead(
  uid: string,
  unreadNotificationIds: string[]
): Promise<void> {
  if (!uid) return;
  const nowMs = Date.now();
  await Promise.all([
    ...unreadNotificationIds.map((id) =>
      updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {})
    ),
    updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      broadcastsReadAtMs: nowMs,
      updatedAt: serverTimestamp(),
    }).catch(() => {}),
  ]);
}

async function deleteOwnedDocsInCollection(
  collectionName: string,
  uid: string
): Promise<void> {
  const q = query(
    collection(db, collectionName),
    where('uid', '==', uid),
    limit(450)
  );
  // Loop until all matching user docs are cleared
  for (let pass = 0; pass < 10; pass += 1) {
    const snap = await getDocs(q);
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 450) break;
  }
}

export async function clearAllUserNotifications(uid: string): Promise<void> {
  if (!uid) return;
  const nowMs = Date.now();
  await deleteOwnedDocsInCollection('notifications', uid);
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      notificationsClearedBeforeMs: nowMs,
      broadcastsReadAtMs: nowMs,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/info`);
  }
}

export async function factoryResetUserAccount(uid: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('Sessão inválida para repor a conta.');
  }

  // 1. Delete competitive history, achievements, notifications, and rankings owned by user
  await Promise.all([
    deleteOwnedDocsInCollection('results', uid),
    deleteOwnedDocsInCollection('achievements', uid),
    deleteOwnedDocsInCollection('notifications', uid),
    deleteOwnedDocsInCollection('weekly_rankings', uid),
    deleteDoc(doc(db, 'global_rankings', uid)).catch(() => {}),
  ]);

  // 2. Reset UserProfile stats strictly to factory zeros
  try {
    await updateDoc(doc(db, 'users', uid), {
      totalPoints: 0,
      wins: 0,
      gamesPlayed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      currentStreak: 0,
      bestStreak: 0,
      tier: 'Aprendiz',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }

  // 3. Reset private preferences to factory defaults
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      drivingSchool: 'Escola de Condução Nacional',
      province: 'Luanda',
      voiceEnabled: true,
      notificationsEnabled: true,
      broadcastsReadAtMs: 0,
      notificationsClearedBeforeMs: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/info`);
  }
}

export async function deleteUserAccountData(uid: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('Sessão inválida para eliminar a conta.');
  }

  // 1. Delete all owned sub-records & private info
  await Promise.all([
    deleteOwnedDocsInCollection('results', uid),
    deleteOwnedDocsInCollection('achievements', uid),
    deleteOwnedDocsInCollection('notifications', uid),
    deleteOwnedDocsInCollection('weekly_rankings', uid),
    deleteDoc(doc(db, 'global_rankings', uid)).catch(() => {}),
    deleteDoc(doc(db, 'users', uid, 'private', 'info')).catch(() => {}),
  ]);

  // 2. Atomically delete users/{uid} and increment platform_stats/users_summary.deletedCount
  const userRef = doc(db, 'users', uid);
  const summaryRef = doc(db, 'platform_stats', 'users_summary');
  try {
    await runTransaction(db, async (tx) => {
      const [userSnap, summarySnap] = await Promise.all([
        tx.get(userRef),
        tx.get(summaryRef),
      ]);
      if (!userSnap.exists()) return;
      tx.delete(userRef);
      if (summarySnap.exists()) {
        const prev = Number(summarySnap.data()?.deletedCount || 0);
        tx.update(summaryRef, {
          deletedCount: prev + 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(summaryRef, {
          deletedCount: 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }

  // 3. Clear 2FA session cookie if present
  await fetch('/api/auth/totp/status', { method: 'DELETE' }).catch(() => {});
}


