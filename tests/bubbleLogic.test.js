import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUBBLE,
  createBubbleState,
  inspectBubbleSource,
  nearestBubbleSource
} from '../src/bubbleLogic.js';

test('repeated feed is not evidence; three diverse checks clear the bubble', () => {
  const state = createBubbleState();
  assert.deepEqual(inspectBubbleSource(state, 'repeat-feed'), ['echo']);
  assert.deepEqual(inspectBubbleSource(state, 'original'), ['verified']);
  assert.deepEqual(inspectBubbleSource(state, 'context'), ['verified']);
  assert.deepEqual(inspectBubbleSource(state, 'different-view'), ['verified', 'cleared']);
  assert.equal(state.cleared, true);
});

test('nearest bubble source is deterministic and skips verified windows', () => {
  const state = createBubbleState();
  const source = BUBBLE.sources[0];
  assert.equal(nearestBubbleSource(state, source.x, source.z)?.id, source.id);
  inspectBubbleSource(state, source.id);
  assert.notEqual(nearestBubbleSource(state, source.x, source.z)?.id, source.id);
});
