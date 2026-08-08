import assert from 'node:assert/strict';
import test from 'node:test';

import { recordGateAttempt } from '../src/reboot/state/consequences.js';
import { createLearningReport } from '../src/reboot/state/learningReport.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

const gates = Object.freeze([
  { chapter: 1, gateId: 'attendance-proctor' },
  { chapter: 2, gateId: 'source-chain' },
  { chapter: 3, gateId: 'dual-school' },
  { chapter: 4, gateId: 'approval-chain' },
  { chapter: 5, gateId: 'testimony-archive' }
]);

function append(state, gateId, chapter, outcome) {
  return recordGateAttempt(state, { chapter, gateId, outcome });
}

test('Given mixed gate histories, When a report is created, Then it derives neutral attempt statuses', () => {
  // Given
  let state = createInitialRebootState();
  state = append(state, 'attendance-proctor', 1, 'resolved');
  state = append(state, 'source-chain', 2, 'failed');
  state = append(state, 'source-chain', 2, 'resolved');
  state = append(state, 'dual-school', 3, 'failed');
  state = append(state, 'approval-chain', 4, 'unknown');

  // When
  const report = createLearningReport(state, gates);

  // Then
  assert.deepEqual(report.gates.map(({ attempts, gateId, status }) => ({ attempts, gateId, status })), [
    { attempts: 1, gateId: 'attendance-proctor', status: 'first-try' },
    { attempts: 2, gateId: 'source-chain', status: 'retry' },
    { attempts: 1, gateId: 'dual-school', status: 'struggling' },
    { attempts: 0, gateId: 'approval-chain', status: 'unknown' },
    { attempts: 0, gateId: 'testimony-archive', status: 'unattempted' }
  ]);
});

test('Given a learning report, When its machine fields are inspected, Then no moral score exists', () => {
  // Given
  const state = append(createInitialRebootState(), 'attendance-proctor', 1, 'resolved');

  // When
  const report = createLearningReport(state, gates);
  const keys = new Set(JSON.stringify(report).match(/[A-Za-z][A-Za-z-]*/g) ?? []);

  // Then
  assert.equal(keys.has('correct'), false);
  assert.equal(keys.has('wise'), false);
  assert.equal(keys.has('moralScore'), false);
});

test('Given a migrated chapter-five completion, When reporting, Then it stays an explicit legacy result', () => {
  const state = append(createInitialRebootState(), 'testimony-archive', 5, 'legacy-grandfathered');

  const report = createLearningReport(state, gates);

  assert.deepEqual(report.gates.at(-1), {
    attempts: 1,
    chapter: 5,
    gateId: 'testimony-archive',
    status: 'legacy-grandfathered'
  });
});

test('Given an invalid gate attempt, When it is recorded, Then the state boundary rejects it', () => {
  // Given
  const state = createInitialRebootState();

  // When
  const recordInvalidAttempt = () => recordGateAttempt(state, {
    chapter: 6,
    gateId: 'broadcast-protocol',
    outcome: 'correct'
  });

  // Then
  assert.throws(recordInvalidAttempt, RangeError);
});

test('Given a gate definition outside the campaign, When reporting, Then the boundary rejects it', () => {
  // Given
  const state = createInitialRebootState();

  // When
  const createInvalidReport = () => createLearningReport(state, [
    { chapter: 7, gateId: 'outside-campaign' }
  ]);

  // Then
  assert.throws(createInvalidReport, RangeError);
});
