# Security Specification — Escola de Condução Live

## 1. Data Invariants
1. **No Answer Leakage Before Reveal**: `rooms/{roomId}/player_questions/{qDocId}` never stores plaintext `correctIndex` or `explanation`. It stores only AES-256-GCM encrypted `sealedPayload` and SHA-256 `answerCommitment` bound to `(roomId, uid, questionIndex)`.
2. **One Answer Per Player Per Question**: `rooms/{roomId}/answers/{answerId}` enforces document ID `== "{questionIndex}_{request.auth.uid}"` and blocks updates/deletes.
3. **Authoritative Server Clock Enforcement**: Answer submission requires `request.time <= get(participant).data.questionEndsAt`, `get(participant).data.status == "PLAYING"`, and `get(room).data.finishedCount < 100`.
4. **Tamper-Proof Scoring**: `rooms/{roomId}/participants/{uid}` score increment is mathematically verified inside Firestore rules against `get(playerRevealedDoc).data.correctIndex == get(answerDoc).data.selectedIndex` and monotonic `lastScoredQuestionIndex == existing.lastScoredQuestionIndex + 1`.
5. **Strict PII Isolation**: `email`, `drivingSchool`, and `province` live exclusively in `users/{uid}/private/info`, accessible only by `isOwner(uid)` or `isAdmin()`.
6. **Admin Audit Immutability**: `audit_logs` permits `create` and `read` only for `isAdmin()`, and strictly forbids `update` or `delete`.
7. **Per-Player & 100-Finisher Room Lock**: A participant with `status == "FINISHED"` cannot replay or mutate their score; `rooms/{roomId}` stays open for other students until `finishedCount` reaches `100`, at which point `rooms/{roomId}.status` atomically becomes `"FINISHED"` and permanently stops the ranking.
8. **Owner & Delegated Announcer Broadcasts + Safe URL Scheme**: `broadcasts/{broadcastId}` allows `create`, `update`, and `delete` for the verified app owner (`kordelmauvesp@gmail.com`) or active delegated emails with `canAnnounce == true` in `staff_permissions/{emailKey}`, and enforces `isValidSafeUrl()` (`https://`, `http://`, or single leading `/`) on `linkUrl` and `mediaUrl`.
9. **Bounded Live Profile Increments**: `users/{uid}` permits owner updates either for identity fields or bounded per-question/end-of-game metric increments (`totalAnswers <= existing.totalAnswers + 25`, `correctAnswers <= existing.correctAnswers + 25`, `totalPoints <= existing.totalPoints + 500`, `gamesPlayed <= existing.gamesPlayed + 1`).
10. **Server-Sealed Google Authenticator TOTP & Host Room Deletion**: 2FA secrets are encrypted server-side with AES-256-GCM bound to `uid` (`totpSealedSecret` in `users/{uid}/private/info`) and verified with `crypto.timingSafeEqual` + `HttpOnly; Secure; SameSite=None; Partitioned` session cookie; rooms can be deleted only by their creator (`hostId`) or an admin (`isAdmin()`).
11. **Delegated Staff Permissions Isolation**: `staff_permissions/{emailKey}` can be listed, created, updated, or deleted exclusively by `isBootstrappedAdmin()` (`kordelmauvesp@gmail.com` with `email_verified == true`). Delegated staff can only `get` their own document matching `request.auth.token.email.lower() == emailKey` and `email_verified == true`. Granular flags (`canViewReserved`, `canAdmin`, `canAnnounce`, `active`) control read/write visibility of reserved screens (`/admin`, `/dono-anuncios`, `/permissoes`).
12. **Self-Service Factory Reset, Account Deletion & Atomic Deleted Counter**: Authenticated owners can factory-reset their own `users/{uid}` competitive stats strictly to exact zero defaults (`Aprendiz`) or permanently delete their own `users/{uid}`, `private/info`, `results`, `achievements`, `notifications`, and ranking records. `platform_stats/users_summary.deletedCount` can only increment by `+1` in an atomic batch verified via `!existsAfter(/users/{uid})`.

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
13. **Self-Granting Staff Permissions**: Non-owner writing `/staff_permissions/{ownEmail}` -> `PERMISSION_DENIED`.
14. **Privilege Escalation by View-Only Staff**: User with `canViewReserved: true, canAdmin: false, canAnnounce: false` attempting admin write or broadcast creation -> `PERMISSION_DENIED`.
15. **Deleted Counter Spoofing**: Incrementing `platform_stats/users_summary.deletedCount` without deleting `/users/{request.auth.uid}` in the same atomic batch -> `PERMISSION_DENIED`.
