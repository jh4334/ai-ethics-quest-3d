import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOTPRINT,
  createFootprintState,
  nearestFootprintAction,
  resolveFootprintAction
} from '../src/footprintLogic.js';

test('footprint actions must be repaired in responsibility order', () => {
  const state = createFootprintState();
  assert.deepEqual(resolveFootprintAction(state, 'repair-harm'), ['out-of-order']);
  assert.deepEqual(resolveFootprintAction(state, 'remove-copy'), ['resolved']);
  assert.deepEqual(resolveFootprintAction(state, 'stop-spread'), ['resolved']);
  assert.deepEqual(resolveFootprintAction(state, 'repair-harm'), ['resolved', 'cleared']);
  assert.equal(state.cleared, true);
});

test('nearest footprint ignores already resolved actions', () => {
  const state = createFootprintState();
  const first = FOOTPRINT.actions[0];
  assert.equal(nearestFootprintAction(state, first.x, first.z)?.id, first.id);
  resolveFootprintAction(state, first.id);
  assert.notEqual(nearestFootprintAction(state, first.x, first.z)?.id, first.id);
});
