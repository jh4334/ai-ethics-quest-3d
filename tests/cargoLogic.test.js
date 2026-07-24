import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARGO,
  createCargoState,
  cycleCargoLabel,
  nearestCargoCrate,
  verifyCargoManifest
} from '../src/cargoLogic.js';

test('cargo labels cycle and only a correct manifest clears the terminal', () => {
  const state = createCargoState();
  assert.equal(verifyCargoManifest(state).event, 'incomplete');
  for (const crate of CARGO.crates) {
    while (state.labels[crate.id] !== crate.correctLabel) {
      cycleCargoLabel(state, crate.id);
    }
  }
  assert.deepEqual(verifyCargoManifest(state), { event: 'cleared', wrongIds: [] });
  assert.equal(state.cleared, true);
});

test('nearest cargo crate uses the authored world coordinates', () => {
  const state = createCargoState();
  const crate = CARGO.crates[1];
  assert.equal(nearestCargoCrate(crate.x, crate.z)?.id, crate.id);
  assert.equal(cycleCargoLabel(state, 'missing'), null);
});
