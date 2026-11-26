/**
 * Security Rules Adversarial Test Specification (Dirty Dozen)
 * Run with Firebase Emulator Suite:
 * npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payloadDescription: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on User Create',
    collection: 'users/victim-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Attacker attempts to create user document for another UID',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Marker',
    collection: 'admins/attacker-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Non-admin user attempts to grant themselves admin marker',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field Update on User',
    collection: 'users/attacker-uid',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'User sends displayName update with injected totalPoints: 99999',
  },
  {
    id: 4,
    name: 'Unauthorized PII Read',
    collection: 'users/victim-uid/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Another authenticated user tries to read victim email and school',
  },
  {
    id: 5,
    name: 'Late Answer Submission After Timer Expiry',
    collection: 'rooms/room1/answers/0_attacker',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Player submits answer when request.time > room.questionEndsAt',
  },
  {
    id: 6,
    name: 'Duplicate Answer Overwrite',
    collection: 'rooms/room1/answers/0_attacker',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Player attempts to alter submitted answer after seeing peers',
  },
  {
    id: 7,
    name: 'Non-Canonical Answer Document ID',
    collection: 'rooms/room1/answers/random_bypass_id',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Player attempts to submit second answer using random document ID',
  },
  {
    id: 8,
    name: 'Score Forgery on Wrong Answer',
    collection: 'rooms/room1/participants/attacker',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Player increments score by +10 when selectedIndex != revealed.correctIndex',
  },
  {
    id: 9,
    name: 'Client Timestamp Spoofing',
    collection: 'rooms/room1/answers/0_attacker',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Player submits past client timestamp instead of serverTimestamp()',
  },
  {
    id: 10,
    name: 'Path Variable ID Poisoning',
    collection: 'rooms/invalid!id_with_special_chars_$$$',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Attacker attempts write with invalid characters in document ID',
  },
  {
    id: 11,
    name: 'Mutating Terminal Finished Room',
    collection: 'rooms/finishedRoom',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Non-admin tries to reopen or modify a FINISHED room',
  },
  {
    id: 12,
    name: 'Audit Log Tampering',
    collection: 'audit_logs/log1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    payloadDescription: 'Even an admin cannot delete or edit immutable audit_logs',
  },
];
