import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInitialRebootState,
  normalizeRebootState
} from '../src/reboot/state/model.js';
import {
  choosePatch,
  recordEvidenceOutcome,
  setChapterCheckpoint,
  updateCharacterTrust
} from '../src/reboot/state/consequences.js';
import { createResultSummary } from '../src/reboot/state/resultSummary.js';

function isDeepFrozen(value) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => (
    !child || typeof child !== 'object' || isDeepFrozen(child)
  ));
}

test('initial v5 consequence state exposes immutable independent models', () => {
  // Given: no previous reboot campaign.
  // When: a new state is created.
  const state = createInitialRebootState();

  // Then: every consequence, progress, choice, evidence, and settings model is immutable.
  assert.equal(state.schemaVersion, 5);
  assert.deepEqual(state.integrity, { secured: 0, lost: 0 });
  assert.deepEqual(state.exposure, { contained: 0, disclosed: 0 });
  assert.deepEqual(state.trust, { dot: 0, haru: 0, lumen: 0, yoonseo: 0 });
  assert.deepEqual(state.chapterProgress, { completed: [], current: 1, checkpoint: 'chapter-1:start' });
  assert.equal(state.patchChoice, null);
  assert.deepEqual(state.evidence, []);
  assert.deepEqual(state.gateAttempts, []);
  assert.deepEqual(state.settings, { motion: 'full', quality: 'auto', sound: true });
  assert.equal(isDeepFrozen(state), true);
});

test('evidence outcomes update axes without mutating or duplicating records', () => {
  // Given: a new campaign and one known memory record.
  const initial = createInitialRebootState();

  // When: the player secures the same record twice.
  const first = recordEvidenceOutcome(initial, {
    action: 'secure',
    chapter: 1,
    evidenceId: 'haru-memory-backup'
  });
  const repeated = recordEvidenceOutcome(first, {
    action: 'secure',
    chapter: 1,
    evidenceId: 'haru-memory-backup'
  });

  // Then: the old value is unchanged and the observed outcome is counted once.
  assert.deepEqual(initial.integrity, { secured: 0, lost: 0 });
  assert.deepEqual(first.integrity, { secured: 1, lost: 0 });
  assert.deepEqual(first.exposure, { contained: 1, disclosed: 0 });
  assert.equal(repeated, first);
  assert.equal(isDeepFrozen(first), true);
});

test('trust chapter and patch transitions return normalized immutable copies', () => {
  // Given: a new campaign.
  const initial = createInitialRebootState();

  // When: one relationship, checkpoint, and patch are recorded.
  const trusted = updateCharacterTrust(initial, 'haru', 140);
  const checkpointed = setChapterCheckpoint(trusted, 2, 'chapter-2:corridor');
  const patched = choosePatch(checkpointed, 'trace-speed');

  // Then: Trust clamps by character and chapter completion remains deterministic.
  assert.equal(initial.trust.haru, 0);
  assert.equal(patched.trust.haru, 100);
  assert.deepEqual(patched.chapterProgress, {
    completed: [1],
    current: 2,
    checkpoint: 'chapter-2:corridor'
  });
  assert.equal(patched.patchChoice, 'trace-speed');
  assert.equal(isDeepFrozen(patched), true);
});

test('malformed and future consequence data normalize to a safe new campaign', () => {
  // Given: malformed v5 fields and a future schema.
  const malformed = {
    schemaVersion: 5,
    integrity: { secured: -8, lost: 'many' },
    exposure: null,
    trust: { haru: 500, stranger: 99 },
    chapterProgress: { current: 9, checkpoint: 'free text', completed: [1, 8] },
    patchChoice: 'unlisted-patch',
    evidence: [{ id: 'unknown-record', action: 'secure', chapter: 1 }],
    settings: { sound: 'loud', motion: 'spin', quality: 'ultra' }
  };

  // When: both values cross the model boundary.
  const repaired = normalizeRebootState(malformed);
  const future = normalizeRebootState({ schemaVersion: 6, settings: { sound: false } });

  // Then: invalid fields are safe and future progress is not interpreted as v5.
  assert.deepEqual(repaired, createInitialRebootState());
  assert.deepEqual(future, createInitialRebootState());
});

test('result summary reports observed actions and consequences without judgment labels', () => {
  // Given: one secured record, one disclosed record, and a relationship change.
  let state = createInitialRebootState();
  state = recordEvidenceOutcome(state, {
    action: 'secure',
    chapter: 1,
    evidenceId: 'haru-memory-backup'
  });
  state = recordEvidenceOutcome(state, {
    action: 'expose',
    chapter: 1,
    evidenceId: 'player-approval-record'
  });
  state = updateCharacterTrust(state, 'dot', -12);

  // When: the chapter result is summarized.
  const summary = createResultSummary(state);
  const serialized = JSON.stringify(summary);

  // Then: it lists observable changes and contains no answer or aggregate judgment fields.
  assert.deepEqual(summary.observedActions, [
    '하루의 기억 백업을 확보했다.',
    '플레이어 승인 기록을 공개했다.'
  ]);
  assert.deepEqual(summary.evidenceConsequences, [
    '검증 가능한 기록이 남고 공개 범위는 제한되었다.',
    '기록은 남았지만 공개 범위가 넓어졌다.'
  ]);
  assert.deepEqual(summary.characterChanges, ['DOT의 신뢰 변화: -12']);
  assert.deepEqual(summary.worldChanges, [
    '확보된 기록 2개, 잃은 기록 0개',
    '제한 공개 1개, 넓은 공개 1개'
  ]);
  assert.doesNotMatch(serialized, /correct|wise|morality/i);
  assert.equal(isDeepFrozen(summary), true);
});
