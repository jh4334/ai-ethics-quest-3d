import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanion, createNpcCharacter, createPlayerCharacter } from '../src/characters.js';
import { ETHICS_TOPICS } from '../src/worldData.js';

// THREE의 지오메트리·그룹 생성은 WebGL 컨텍스트 없이도 동작하므로 구조를 검증한다.

test('player and companion builders return non-empty groups', () => {
  const player = createPlayerCharacter();
  assert.equal(player.type, 'Group');
  assert.ok(player.children.length >= 4, 'player should be assembled from several parts');

  const dot = createCompanion();
  assert.equal(dot.type, 'Group');
  assert.ok(dot.children.length >= 2);
});

test('every ethics topic maps to a distinct NPC character group', () => {
  const childCounts = new Set();
  for (const topic of ETHICS_TOPICS) {
    const npc = createNpcCharacter(topic.id);
    assert.equal(npc.type, 'Group', `${topic.id} builder must return a Group`);
    assert.ok(npc.children.length >= 5, `${topic.id} character should have several parts`);
    childCounts.add(npc.children.length);
  }
  // 서로 다른 실루엣이면 부품 수도 대체로 다르다(완전 동일한 고무찰흙 방지).
  assert.ok(childCounts.size >= 3, 'characters should not all share the same construction');
});

test('unknown topic falls back to a valid group without throwing', () => {
  const npc = createNpcCharacter('not-a-topic');
  assert.equal(npc.type, 'Group');
  assert.ok(npc.children.length > 0);
});
