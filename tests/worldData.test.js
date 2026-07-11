import test from 'node:test';
import assert from 'node:assert/strict';
import { ETHICS_TOPICS, WORLD_ZONES, SHRINES, getProgressSummary, canUnlockFinalCore } from '../src/worldData.js';

test('world includes the four required AI ethics topics for elementary students', () => {
  assert.deepEqual(ETHICS_TOPICS.map((topic) => topic.id), ['privacy', 'bias', 'copyright', 'deepfake']);
  for (const topic of ETHICS_TOPICS) {
    assert.ok(topic.titleKo.length > 0);
    assert.ok(topic.studentTakeaway.length >= 12);
  }
});

test('open world has four zones with non-infringing Zelda-like exploration roles', () => {
  assert.equal(WORLD_ZONES.length, 4);
  assert.equal(new Set(WORLD_ZONES.map((zone) => zone.topicId)).size, 4);
  for (const zone of WORLD_ZONES) {
    assert.ok(Array.isArray(zone.position));
    assert.equal(zone.position.length, 3);
    assert.ok(zone.npc.prompt.includes('AI'));
    assert.ok(!/zelda|link|hyrule/i.test(`${zone.nameKo} ${zone.descriptionKo}`));
  }
});

test('shrines have correct answer choices and age-appropriate feedback', () => {
  assert.ok(SHRINES.length >= 3);
  for (const shrine of SHRINES) {
    const correctChoices = shrine.choices.filter((choice) => choice.correct);
    assert.equal(correctChoices.length, 1, shrine.id);
    assert.ok(shrine.feedback.correct.length >= 10);
    assert.ok(shrine.feedback.incorrect.length >= 10);
  }
});

test('progress summary unlocks final AI core only after at least three fragments', () => {
  assert.equal(canUnlockFinalCore(['privacy', 'bias']), false);
  assert.equal(canUnlockFinalCore(['privacy', 'bias', 'copyright']), true);
  const summary = getProgressSummary(['privacy', 'bias', 'copyright']);
  assert.equal(summary.collected, 3);
  assert.equal(summary.total, 4);
  assert.equal(summary.finalCoreUnlocked, true);
});

test('knowledge bottles: 12개 고정 배치·중복 없는 수집·세이브 정규화', async () => {
  const { KNOWLEDGE_BOTTLES, collectKnowledgeBottle, createInitialProgress, normalizeProgress } =
    await import('../src/worldData.js');
  assert.equal(KNOWLEDGE_BOTTLES.length, 12);
  assert.equal(new Set(KNOWLEDGE_BOTTLES.map((b) => b.id)).size, 12);
  for (const bottle of KNOWLEDGE_BOTTLES) {
    // 섬 이동 가능 반경(21.6) 안, 중앙 코어(반경 2.6)·등대 밑동(8.2,15.6 반경 1.9) 밖.
    const r = Math.hypot(bottle.pos[0], bottle.pos[1]);
    assert.ok(r <= 21.6, `${bottle.id} 섬 안 (${r.toFixed(1)})`);
    assert.ok(r > 2.6, `${bottle.id} 코어 밖`);
    assert.ok(Math.hypot(bottle.pos[0] - 8.2, bottle.pos[1] - 15.6) > 1.9, `${bottle.id} 등대 밖`);
    assert.ok(bottle.tipKo.length >= 10, `${bottle.id} 꿀팁 문장`);
  }
  // 수집: 중복·미지 id는 무시, 원본 불변.
  let p = createInitialProgress();
  p = collectKnowledgeBottle(p, 'kb-source');
  const again = collectKnowledgeBottle(p, 'kb-source');
  assert.equal(again, p);
  assert.equal(collectKnowledgeBottle(p, 'kb-nope'), p);
  assert.deepEqual(p.knowledgeBottles, ['kb-source']);
  // 정규화: 미지 id 걸러내고 중복 제거, 구세이브(필드 없음)는 빈 배열.
  const norm = normalizeProgress({ knowledgeBottles: ['kb-source', 'kb-source', 'zzz'] });
  assert.deepEqual(norm.knowledgeBottles, ['kb-source']);
  assert.deepEqual(normalizeProgress({}).knowledgeBottles, []);
});
