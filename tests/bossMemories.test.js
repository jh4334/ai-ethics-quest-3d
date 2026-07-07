import test from 'node:test';
import assert from 'node:assert/strict';
import { NOISE_MEMORIES, pickMemory } from '../src/bossMemories.js';
import { PROMISE_TOOLS } from '../src/worldData.js';

test('every promise tool has at least three well-formed noise memories', () => {
  for (const tool of PROMISE_TOOLS) {
    const list = NOISE_MEMORIES[tool.id];
    assert.ok(Array.isArray(list) && list.length >= 3, `${tool.id} needs >=3 memories`);
    for (const mem of list) {
      assert.ok(typeof mem.textKo === 'string' && mem.textKo.trim().length > 0, `${tool.id} memory needs textKo`);
      assert.ok(typeof mem.hintKo === 'string' && mem.hintKo.trim().length > 0, `${tool.id} memory needs hintKo`);
    }
  }
});

test('situations are unique across tools (each maps to one promise, not shared)', () => {
  const seen = new Set();
  for (const tool of PROMISE_TOOLS) {
    for (const mem of NOISE_MEMORIES[tool.id]) {
      assert.equal(seen.has(mem.textKo), false, `duplicate situation: ${mem.textKo}`);
      seen.add(mem.textKo);
    }
  }
});

test('pickMemory cycles deterministically and never goes out of bounds', () => {
  const list = NOISE_MEMORIES.shield;
  assert.deepEqual(pickMemory('shield', 0), list[0]);
  assert.deepEqual(pickMemory('shield', list.length), list[0], 'wraps around');
  assert.deepEqual(pickMemory('shield', -1), list[list.length - 1], 'handles negatives');
  // 미보유/알 수 없는 도구도 크래시 없이 안전한 기본값.
  assert.ok(pickMemory('nope', 0).textKo);
});
