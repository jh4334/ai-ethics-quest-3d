import assert from 'node:assert/strict';
import test from 'node:test';

import { createSaveRepository } from '../src/reboot/save/repository.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.writes = [];
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
}

function v4State(overrides = {}) {
  return {
    schemaVersion: 4,
    integrity: { secured: 2, lost: 1 },
    exposure: { contained: 2, disclosed: 1 },
    trust: { dot: 3, haru: 4, lumen: -2, yoonseo: 1 },
    chapterProgress: {
      completed: [1, 2, 3, 4],
      current: 5,
      checkpoint: 'chapter-5:resolved-redacted'
    },
    patchChoice: 'trace-speed',
    evidence: [
      { action: 'secure', chapter: 2, evidenceId: 'original-upload-trace' },
      { action: 'secure', chapter: 5, evidenceId: 'broadcast-queue' }
    ],
    settings: { motion: 'reduced', quality: 'low', sound: false },
    ...overrides
  };
}

test('Given empty storage, When v5 boots, Then it writes only the v5 key', async () => {
  // Given
  const repositoryApi = await import('../src/reboot/save/repository.js');
  assert.equal(typeof repositoryApi.V5_SAVE_KEY, 'string');
  const storage = new MemoryStorage();

  // When
  const boot = createSaveRepository(storage).boot();

  // Then
  assert.equal(boot.state.schemaVersion, 5);
  assert.equal(JSON.parse(storage.getItem(repositoryApi.V5_SAVE_KEY)).schemaVersion, 5);
  assert.equal(storage.getItem(repositoryApi.V4_SAVE_KEY), null);
});

test('Given a resolved v4 finale, When v5 boots, Then progress migrates and v4 bytes are backed up once', async () => {
  // Given
  const repositoryApi = await import('../src/reboot/save/repository.js');
  assert.equal(typeof repositoryApi.V5_SAVE_KEY, 'string');
  const original = JSON.stringify(v4State());
  const storage = new MemoryStorage([[repositoryApi.V4_SAVE_KEY, original]]);

  // When
  const boot = createSaveRepository(storage).boot();

  // Then
  assert.equal(boot.recoveryCode, 'v4-migrated');
  assert.deepEqual(boot.state.chapterProgress, {
    completed: [1, 2, 3, 4, 5],
    current: 6,
    checkpoint: 'chapter-6:resolved-redacted'
  });
  assert.deepEqual(boot.state.evidence.at(-1), {
    action: 'secure', chapter: 6, evidenceId: 'broadcast-queue'
  });
  assert.equal(boot.state.gateAttempts.some((attempt) => (
    attempt.chapter === 5 && attempt.gateId === 'testimony-archive'
      && attempt.outcome === 'legacy-grandfathered'
  )), true);
  assert.equal(storage.getItem(repositoryApi.V4_SAVE_KEY), original);
  assert.equal(storage.getItem(repositoryApi.V4_BACKUP_KEY), original);
});

test('Given an existing v4 backup, When migration boots again, Then protected bytes are never overwritten', async () => {
  const repositoryApi = await import('../src/reboot/save/repository.js');
  const protectedBytes = '{"protected":"first-copy"}';
  const currentBytes = JSON.stringify(v4State());
  const storage = new MemoryStorage([
    [repositoryApi.V4_BACKUP_KEY, protectedBytes],
    [repositoryApi.V4_SAVE_KEY, currentBytes]
  ]);

  createSaveRepository(storage).boot();

  assert.equal(storage.getItem(repositoryApi.V4_BACKUP_KEY), protectedBytes);
  assert.equal(storage.getItem(repositoryApi.V4_SAVE_KEY), currentBytes);
});

test('Given an unknown v4 finale checkpoint, When v5 boots, Then it uses the safe chapter-six checkpoint', async () => {
  // Given
  const repositoryApi = await import('../src/reboot/save/repository.js');
  assert.equal(typeof repositoryApi.V5_SAVE_KEY, 'string');
  const original = JSON.stringify(v4State({
    chapterProgress: { completed: [1, 2, 3, 4], current: 5, checkpoint: 'chapter-5:unknown-room' }
  }));
  const storage = new MemoryStorage([[repositoryApi.V4_SAVE_KEY, original]]);

  // When
  const boot = createSaveRepository(storage).boot();

  // Then
  assert.equal(boot.recoveryCode, 'v4-checkpoint-recovered');
  assert.equal(boot.state.chapterProgress.checkpoint, 'chapter-6:broadcast-room');
  assert.equal(storage.getItem(repositoryApi.V4_SAVE_KEY), original);
});

test('Given a migrated state, When v4 migration runs again, Then the result is unchanged', async () => {
  // Given
  const migrationApi = await import('../src/reboot/save/v4Migration.js');
  assert.equal(typeof migrationApi.migrateV4State, 'function');
  const first = migrationApi.migrateV4State(v4State());

  // When
  const second = migrationApi.migrateV4State(first.state);

  // Then
  assert.deepEqual(second, first);
});

test('Given a future v6 primary and an older v5 temp, When booting, Then it does not downgrade', async () => {
  // Given
  const repositoryApi = await import('../src/reboot/save/repository.js');
  const modelApi = await import('../src/reboot/state/model.js');
  const current = modelApi.createInitialRebootState();
  const storage = new MemoryStorage([
    [repositoryApi.V5_SAVE_KEY, JSON.stringify({ ...current, schemaVersion: 6 })],
    [repositoryApi.V5_TEMP_KEY, JSON.stringify(current)]
  ]);

  // When
  const boot = createSaveRepository(storage).boot();

  // Then
  assert.equal(boot.recoveryCode, 'future-version');
  assert.deepEqual(boot.state, current);
});

test('Given malformed v4 settings, When v5 boots, Then invalid progress is not migrated', async () => {
  // Given
  const repositoryApi = await import('../src/reboot/save/repository.js');
  const malformed = JSON.stringify(v4State({
    settings: { motion: 'fast', quality: 'ultra', sound: 'yes' }
  }));
  const storage = new MemoryStorage([[repositoryApi.V4_SAVE_KEY, malformed]]);

  // When
  const boot = createSaveRepository(storage).boot();

  // Then
  assert.equal(boot.recoveryCode, null);
  assert.deepEqual(boot.state.chapterProgress, {
    completed: [], current: 1, checkpoint: 'chapter-1:start'
  });
  assert.equal(storage.getItem(repositoryApi.V4_SAVE_KEY), malformed);
});
