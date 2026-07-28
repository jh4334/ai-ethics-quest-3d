import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialRebootState } from '../src/reboot/state/model.js';
import {
  LEGACY_BACKUP_KEY,
  LEGACY_V3_KEY,
  V4_SAVE_KEY,
  V4_TEMP_KEY,
  createSaveRepository
} from '../src/reboot/save/repository.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.writes = [];
    this.failOnKey = null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    if (key === this.failOnKey) throw new Error('저장 중단');
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
}

function legacyBytes(overrides = {}) {
  return JSON.stringify({
    version: 3,
    visitedTopics: ['privacy'],
    collectedFragments: ['privacy'],
    aiCoreCompleted: true,
    settings: { sound: false, motion: 'reduced', quality: 'low' },
    ...overrides
  }, null, 2);
}

test('empty storage boots and persists a fresh v4 campaign', () => {
  // Given: empty browser storage.
  const storage = new MemoryStorage();
  const repository = createSaveRepository(storage);

  // When: the reboot campaign starts.
  const boot = repository.boot();

  // Then: a safe v4 state is available and stored.
  assert.deepEqual(boot.state, createInitialRebootState());
  assert.equal(boot.recoveryNotice, null);
  assert.equal(JSON.parse(storage.getItem(V4_SAVE_KEY)).schemaVersion, 4);
});

test('valid v4 storage continues unchanged across relaunch', () => {
  // Given: a valid campaign at the second checkpoint.
  const saved = {
    ...createInitialRebootState(),
    chapterProgress: { completed: [1], current: 2, checkpoint: 'chapter-2:corridor' }
  };
  const bytes = JSON.stringify(saved);
  const storage = new MemoryStorage([[V4_SAVE_KEY, bytes]]);

  // When: two repository instances boot from the same storage.
  const first = createSaveRepository(storage).boot();
  const second = createSaveRepository(storage).boot();

  // Then: both continue from the stored checkpoint without rewriting it.
  assert.equal(first.state.chapterProgress.checkpoint, 'chapter-2:corridor');
  assert.deepEqual(second.state, first.state);
  assert.equal(storage.getItem(V4_SAVE_KEY), bytes);
  assert.deepEqual(storage.writes, []);
});

test('malformed JSON and schema recover to a new game with one notice', () => {
  // Given: a truncated save, followed by a structurally invalid v4 save.
  const storage = new MemoryStorage([[V4_SAVE_KEY, '{"schemaVersion":4']]);
  const repository = createSaveRepository(storage);

  // When: each damaged value is booted.
  const truncated = repository.boot();
  storage.setItem(V4_SAVE_KEY, JSON.stringify({ schemaVersion: 4, evidence: [{ id: 'unknown-record' }] }));
  const invalidSchema = repository.boot();

  // Then: both use a safe new campaign and expose a non-blocking recovery notice.
  assert.deepEqual(truncated.state, createInitialRebootState());
  assert.deepEqual(invalidSchema.state, createInitialRebootState());
  assert.match(truncated.recoveryNotice, /손상/);
  assert.match(invalidSchema.recoveryNotice, /손상/);
});

test('future-version storage is not interpreted as v4 progress', () => {
  // Given: a valid-looking save from an unsupported future schema.
  const storage = new MemoryStorage([[
    V4_SAVE_KEY,
    JSON.stringify({ ...createInitialRebootState(), schemaVersion: 9 })
  ]]);

  // When: the repository boots it.
  const boot = createSaveRepository(storage).boot();

  // Then: it starts safely and explains that the version is unsupported.
  assert.deepEqual(boot.state, createInitialRebootState());
  assert.match(boot.recoveryNotice, /버전/);
});

test('existing v3 bytes are backed up once and only settings migrate', () => {
  // Given: realistic v3 progress and accessibility settings.
  const original = legacyBytes();
  const storage = new MemoryStorage([[LEGACY_V3_KEY, original]]);

  // When: the reboot is launched twice.
  const first = createSaveRepository(storage).boot();
  const writesAfterFirstBoot = storage.writes.length;
  const second = createSaveRepository(storage).boot();

  // Then: the backup is byte-for-byte stable, settings migrate, and campaign progress starts fresh.
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), original);
  assert.deepEqual(first.state.settings, { sound: false, motion: 'reduced', quality: 'low' });
  assert.deepEqual(first.state.chapterProgress, createInitialRebootState().chapterProgress);
  assert.deepEqual(first.state.evidence, []);
  assert.deepEqual(second.state, first.state);
  assert.equal(storage.writes.length, writesAfterFirstBoot);
});

test('legacy backup survives v4 reset and corruption byte for byte', () => {
  // Given: a migrated v3 save and active v4 repository.
  const original = legacyBytes();
  const storage = new MemoryStorage([[LEGACY_V3_KEY, original]]);
  const repository = createSaveRepository(storage);
  repository.boot();

  // When: v4 is reset, then corrupted and recovered.
  repository.reset();
  storage.setItem(V4_SAVE_KEY, 'not-json');
  const recovered = repository.boot();

  // Then: recovery starts safely without touching the original backup bytes.
  assert.deepEqual(recovered.state.chapterProgress, createInitialRebootState().chapterProgress);
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), original);
  assert.equal(storage.getItem(LEGACY_V3_KEY), original);
});

test('migration accepts only sound motion and quality settings', () => {
  // Given: v3 contains extensive finished progress and extra untrusted fields.
  const original = legacyBytes({
    settings: { sound: true, motion: 'reduced', quality: 'medium', nickname: 'do-not-copy' },
    trust: { haru: 99 },
    evidence: ['legacy-answer'],
    patchChoice: 'legacy-patch'
  });
  const storage = new MemoryStorage([[LEGACY_V3_KEY, original]]);

  // When: migration boots v4.
  const { state } = createSaveRepository(storage).boot();

  // Then: only the three approved settings cross the boundary.
  assert.deepEqual(state.settings, { sound: true, motion: 'reduced', quality: 'medium' });
  assert.deepEqual(Object.keys(state).sort(), Object.keys(createInitialRebootState()).sort());
  assert.doesNotMatch(storage.getItem(V4_SAVE_KEY), /nickname|legacy-answer|legacy-patch/);
});

test('writes validate a temporary value and are atomic and idempotent', () => {
  // Given: one valid old state and a storage interruption on the primary key.
  const storage = new MemoryStorage();
  const repository = createSaveRepository(storage);
  const oldState = repository.boot().state;
  const nextState = {
    ...oldState,
    chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:arena' }
  };
  const oldBytes = storage.getItem(V4_SAVE_KEY);
  storage.failOnKey = V4_SAVE_KEY;

  // When: replacement is interrupted, then retried twice.
  assert.throws(() => repository.write(nextState), /저장 중단/);
  assert.equal(storage.getItem(V4_SAVE_KEY), oldBytes);
  assert.equal(JSON.parse(storage.getItem(V4_TEMP_KEY)).chapterProgress.checkpoint, 'chapter-1:arena');
  storage.failOnKey = null;
  repository.write(nextState);
  const writesAfterCommit = storage.writes.length;
  repository.write(nextState);

  // Then: the committed value is valid, the temp is removed, and the repeated write is a no-op.
  assert.equal(JSON.parse(storage.getItem(V4_SAVE_KEY)).chapterProgress.checkpoint, 'chapter-1:arena');
  assert.equal(storage.getItem(V4_TEMP_KEY), null);
  assert.equal(storage.writes.length, writesAfterCommit);
});

test('corrupted temporary data cannot replace a committed save', () => {
  // Given: a committed checkpoint and a malformed interrupted replacement.
  const committed = {
    ...createInitialRebootState(),
    chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:arena' }
  };
  const committedBytes = JSON.stringify(committed);
  const storage = new MemoryStorage([
    [V4_SAVE_KEY, committedBytes],
    [V4_TEMP_KEY, '{"schemaVersion":4']
  ]);

  // When: a new repository boots after the interruption.
  const boot = createSaveRepository(storage).boot();

  // Then: the committed checkpoint wins and the unusable temp value is removed.
  assert.equal(boot.state.chapterProgress.checkpoint, 'chapter-1:arena');
  assert.equal(storage.getItem(V4_SAVE_KEY), committedBytes);
  assert.equal(storage.getItem(V4_TEMP_KEY), null);
});

test('an existing legacy backup is never overwritten by later migration attempts', () => {
  // Given: a first backup and a different legacy source left by a later session.
  const firstBytes = legacyBytes({ visitedTopics: ['privacy'] });
  const laterBytes = legacyBytes({ visitedTopics: ['bias'] });
  const storage = new MemoryStorage([
    [LEGACY_BACKUP_KEY, firstBytes],
    [LEGACY_V3_KEY, laterBytes]
  ]);

  // When: boot and reset repeatedly revisit migration boundaries.
  const repository = createSaveRepository(storage);
  repository.boot();
  repository.reset();
  repository.boot();

  // Then: the first captured bytes remain the only backup value.
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), firstBytes);
  assert.equal(storage.getItem(LEGACY_V3_KEY), laterBytes);
});
