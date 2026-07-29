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

test('TRACE 압력은 시뮬 90틱 뒤에만 SECURE 준비 상태가 된다 (프레임레이트 무관)', () => {
  const director = createChapterOneDirector();
  director.start();
  director.observe({ segmentId: 'first-arena' });
  director.observe({
    encounter: { enemies: [{ phase: 'defeat' }] }, segmentId: 'first-arena'
  });
  director.observe({ combatEvents: [{ type: 'traced' }], segmentId: 'memory-backup-decision' });
  // 저프레임(한 프레임에 여러 틱)이라도 시뮬 틱 기준 90틱을 채워야 열린다.
  director.observe({ encounter: { tick: 100 }, segmentId: 'memory-backup-decision' });
  director.observe({ encounter: { tick: 189 }, segmentId: 'memory-backup-decision' });
  assert.equal(director.getState().phase, 'memory-traced', '89틱 경과 — 아직 잠김');
  director.observe({ encounter: { tick: 190 }, segmentId: 'memory-backup-decision' });
  assert.equal(director.getState().phase, 'memory-secure-ready');
  // 고프레임(틱 없이 반복 호출)로는 절대 열리지 않는다 — 호출 횟수 의존 금지.
  const highFps = createChapterOneDirector();
  highFps.start();
  highFps.observe({ segmentId: 'first-arena' });
  highFps.observe({ encounter: { enemies: [{ phase: 'defeat' }] }, segmentId: 'first-arena' });
  highFps.observe({ combatEvents: [{ type: 'traced' }], segmentId: 'memory-backup-decision' });
  for (let i = 0; i < 200; i += 1) {
    highFps.observe({ encounter: { tick: 50 }, segmentId: 'memory-backup-decision' });
  }
  assert.equal(highFps.getState().phase, 'memory-traced', '틱이 멈춰 있으면 호출 횟수와 무관하게 잠김');
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
