import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChapterOneBossFixture, createChapterOneDirector, createChapterOneEndingFixture
} from '../src/reboot/story/chapterOneDirector.js';

test('감독기는 이동과 전투 관찰을 저장 가능한 1장 단계로 바꾼다', () => {
  const saves = [];
  const director = createChapterOneDirector({ persist: (campaign) => saves.push(campaign) });
  director.start();
  director.observe({ segmentId: 'first-arena' });
  director.observe({
    encounter: { enemies: [{ phase: 'defeat' }, { phase: 'defeat' }] },
    segmentId: 'first-arena'
  });

  assert.equal(director.getState().phase, 'memory-decision');
  assert.equal(saves.at(-1).chapterProgress.checkpoint, 'chapter-1:memory-decision');
});

test('TRACE 압력은 90틱 뒤에만 SECURE 준비 상태가 된다', () => {
  const director = createChapterOneDirector();
  director.start();
  director.observe({ segmentId: 'first-arena' });
  director.observe({
    encounter: { enemies: [{ phase: 'defeat' }] }, segmentId: 'first-arena'
  });
  director.observe({ combatEvents: [{ type: 'traced' }], segmentId: 'memory-backup-decision' });
  for (let tick = 0; tick < 88; tick += 1) director.observe({ segmentId: 'memory-backup-decision' });
  assert.equal(director.getState().phase, 'memory-traced');
  director.observe({ segmentId: 'memory-backup-decision' });
  assert.equal(director.getState().phase, 'memory-secure-ready');
});

test('두 결말 fixture는 같은 반전을 다른 비용으로 보여 준다', () => {
  const secure = createChapterOneEndingFixture('secure');
  const purge = createChapterOneEndingFixture('purge');

  assert.equal(secure.outcome.signatureRevealed, true);
  assert.equal(purge.outcome.signatureRevealed, true);
  assert.notEqual(secure.outcome.routeConsequenceKo, purge.outcome.routeConsequenceKo);
  assert.equal(secure.campaign.evidence[0].action, 'secure');
  assert.equal(purge.campaign.evidence[0].action, 'purge');
});

test('보스 fixture는 선택 결과와 boss 체크포인트를 함께 보존한다', () => {
  const fixture = createChapterOneBossFixture('secure');
  assert.equal(fixture.campaign.chapterProgress.checkpoint, 'chapter-1:boss');
  assert.equal(fixture.campaign.evidence[0].action, 'secure');
});

test('무전 시간은 이동을 막지 않고 순서대로 소진된다', () => {
  const director = createChapterOneDirector();
  director.start();
  const first = director.getRadioLine();
  director.update(first.durationMs / 1000);

  assert.notEqual(director.getRadioLine()?.textKo, first.textKo);
  assert.equal(director.getState().phase, 'corridor');
});
