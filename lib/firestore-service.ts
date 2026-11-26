import {
  collection,
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
  computeDriverTier,
  CompetitionRoom,
  DifficultyLevel,
  getCurrentWeekKey,
  QuestionBankItem,
  RoomParticipant,
  RoomQuestion,
  RoomRevealedAnswer,
  UserPrivateInfo,
  UserProfile,
} from './types';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'id';
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      newProfile.photoURL = user.photoURL.slice(0, 500);
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

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email === 'vitubloguista@gmail.com' && user.emailVerified) {
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
    photoURL?: string;
    drivingSchool?: string;
    province?: string;
    voiceEnabled?: boolean;
    notificationsEnabled?: boolean;
  }
): Promise<void> {
  if (updates.displayName !== undefined || updates.photoURL !== undefined) {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) {
      payload.displayName = updates.displayName.trim().slice(0, 60);
    }
    if (updates.photoURL !== undefined) {
      payload.photoURL = updates.photoURL.trim().slice(0, 500);
    }
    try {
      await updateDoc(doc(db, 'users', uid), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }

  if (
    updates.drivingSchool !== undefined ||
    updates.province !== undefined ||
    updates.voiceEnabled !== undefined ||
    updates.notificationsEnabled !== undefined
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
      if (profile.photoURL) {
        newPart.photoURL = profile.photoURL.slice(0, 500);
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

      tx.update(partRef, {
        status: 'ANSWER_REVEAL',
        score: isCorrect ? part.score + params.room.pointsPerCorrect : part.score,
        correctCount: isCorrect ? part.correctCount + 1 : part.correctCount,
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

  // Update UserProfile stats
  const newPoints = params.profile.totalPoints + me.score;
  const newWins = params.profile.wins + (isWinner ? 1 : 0);
  const newGames = params.profile.gamesPlayed + 1;
  const newCorrect = params.profile.correctAnswers + me.correctCount;
  const newTotalAns = params.profile.totalAnswers + totalAnswered;
  const newStreak = me.score > 0 ? params.profile.currentStreak + 1 : 0;
  const newBestStreak = Math.max(params.profile.bestStreak, newStreak);
  const newTier = computeDriverTier(newPoints);
  const overallAcc =
    newTotalAns > 0 ? Math.round((newCorrect / newTotalAns) * 100) : 0;

  try {
    await updateDoc(doc(db, 'users', params.profile.uid), {
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
    displayName: params.profile.displayName,
    points: newPoints,
    wins: newWins,
    gamesPlayed: newGames,
    accuracy: overallAcc,
    updatedAt: serverTimestamp(),
  };
  if (params.profile.photoURL) globalPayload.photoURL = params.profile.photoURL;

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
      displayName: params.profile.displayName,
      points: (prev?.points || 0) + me.score,
      wins: (prev?.wins || 0) + (isWinner ? 1 : 0),
      gamesPlayed: (prev?.gamesPlayed || 0) + 1,
      accuracy: overallAcc,
      weekKey,
      updatedAt: serverTimestamp(),
    };
    if (params.profile.photoURL) weeklyData.photoURL = params.profile.photoURL;
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
