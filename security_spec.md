# Security Specification — Escola de Condução Live

## 1. Data Invariants
1. **No Answer Leakage Before Reveal**: `rooms/{roomId}/player_questions/{qDocId}` never stores plaintext `correctIndex` or `explanation`. It stores only AES-256-GCM encrypted `sealedPayload` and SHA-256 `answerCommitment` bound to `(roomId, uid, questionIndex)`.
2. **One Answer Per Player Per Question**: `rooms/{roomId}/answers/{answerId}` enforces document ID `== "{questionIndex}_{request.auth.uid}"` and blocks updates/deletes.
3. **Authoritative Server Clock Enforcement**: Answer submission requires `request.time <= get(participant).data.questionEndsAt`, `get(participant).data.status == "PLAYING"`, and `get(room).data.finishedCount < 100`.
4. **Tamper-Proof Scoring**: `rooms/{roomId}/participants/{uid}` score increment is mathematically verified inside Firestore rules against `get(playerRevealedDoc).data.correctIndex == get(answerDoc).data.selectedIndex` and monotonic `lastScoredQuestionIndex == existing.lastScoredQuestionIndex + 1`.
5. **Strict PII Isolation**: `email`, `drivingSchool`, and `province` live exclusively in `users/{uid}/private/info`, accessible only by `isOwner(uid)` or `isAdmin()`.
6. **Admin Audit Immutability**: `audit_logs` permits `create` and `read` only for `isAdmin()`, and strictly forbids `update` or `delete`.
7. **Per-Player & 100-Finisher Room Lock**: A participant with `status == "FINISHED"` cannot replay or mutate their score; `rooms/{roomId}` stays open for other students until `finishedCount` reaches `100`, at which point `rooms/{roomId}.status` atomically becomes `"FINISHED"` and permanently stops the ranking.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on User Create**: `{ "uid": "victim-uid", "displayName": "Hacker", ... }` by attacker -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Marker**: Creating `/admins/{attackerUid}` with non-admin token -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Update on User**: `{ "displayName": "Legit", "disabled": false, "totalPoints": 99999 }` -> `PERMISSION_DENIED`.
4. **Reading Another User's PII**: `get(/users/victimUid/private/info)` by non-owner non-admin -> `PERMISSION_DENIED`.
5. **Answer Submission After Timer Expiry**: Creating answer when `request.time > room.questionEndsAt` -> `PERMISSION_DENIED`.
6. **Duplicate / Overwrite Answer**: Updating existing `/rooms/r1/answers/0_uid` -> `PERMISSION_DENIED`.
7. **Wrong Answer Document ID**: Creating `/rooms/r1/answers/randomId` with `questionIndex: 0` -> `PERMISSION_DENIED`.
8. **Score Forgery in Participant Doc**: Updating `score: existing.score + 100` or claiming +10 when `selectedIndex != correctIndex` -> `PERMISSION_DENIED`.
9. **Client Timestamp Spoofing**: Creating `/rooms/r1/answers/0_uid` with `submittedAt: pastTimestamp` != `request.time` -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Creating `/rooms/1500_char_invalid_id!@#` -> `PERMISSION_DENIED`.
11. **Mutating Finished Competition**: Non-admin updating `rooms/{roomId}` when `existing().status == "FINISHED"` -> `PERMISSION_DENIED`.
12. **Tampering with Audit Logs**: Updating or deleting `/audit_logs/{id}` even as admin -> `PERMISSION_DENIED`.
