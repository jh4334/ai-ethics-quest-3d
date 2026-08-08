import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createChapterOneEndingFixture } from '../src/reboot/story/chapterOneDirector.js';

const unavailable = () => {
  throw new Error('chapter 2/3 campaign contracts are not implemented');
};
const catalog = await import('../src/reboot/content/chapters/catalog.js').catch(() => ({}));
const campaign = await import('../src/reboot/campaign/runtime.js').catch(() => ({}));
const dualSchool = await import('../src/reboot/campaign/dualSchool.js').catch(() => ({}));
const enemyCatalog = await import('../src/reboot/content/enemies/catalog.js').catch(() => ({}));
const enemyValidation = await import('../src/reboot/content/enemies/validateEnemies.js').catch(() => ({}));
const sourceChain = await import('../src/reboot/enemies/sourceChain.js').catch(() => ({}));
const chapterTwoLevel = await import('../src/reboot/content/levels/chapter2.js').catch(() => ({}));
const chapterThreeLevel = await import('../src/reboot/content/levels/chapter3.js').catch(() => ({}));
const levelValidation = await import('../src/reboot/level/validateLevel.js').catch(() => ({}));

const { CHAPTERS_2_3 = [] } = catalog;
const { createCampaignRoute = unavailable, validateChapterDefinitions = unavailable } = campaign;
const { ENEMY_DEFINITIONS = {} } = enemyCatalog;
const { validateEnemyDefinitions = unavailable } = enemyValidation;
const { applySourceAction = unavailable, createSourceChain = unavailable } = sourceChain;
const { chapterTwoLevel: chapter2Level = null } = chapterTwoLevel;
const { chapterThreeLevel: chapter3Level = null } = chapterThreeLevel;
const { validateLevel = unavailable } = levelValidation;
const {
  createDualSchoolState = unavailable,
  replayDualSchool = unavailable,
  restoreDualSchool = unavailable,
  serializeDualSchool = unavailable
} = dualSchool;

test('Given chapter-one endings, When campaign seeds are compared, Then SECURE and PURGE remain distinct valid histories', () => {
  // Given: 검증된 1장 두 갈래 저장 상태.
  const secure = createChapterOneEndingFixture('secure').campaign;
  const purge = createChapterOneEndingFixture('purge').campaign;

  // When: 다음 장이 읽을 증거와 관계 상태를 비교한다.
  const secureRecord = secure.evidence.find((record) => record.evidenceId === 'haru-memory-backup');
  const purgeRecord = purge.evidence.find((record) => record.evidenceId === 'haru-memory-backup');

  // Then: 같은 서명 반전을 통과했어도 행동 이력과 하루 신뢰는 합쳐지지 않는다.
  assert.equal(secureRecord.action, 'secure');
  assert.equal(purgeRecord.action, 'purge');
  assert.notEqual(secure.trust.haru, purge.trust.haru);
});

test('Given chapter 2 and 3 content, When validated, Then each ships a distinct loop, boss, PATCH, echoes, reversal, and honest timing state', () => {
  // Given: 1장 동결 스키마를 따르는 두 장의 데이터.
  const definitions = CHAPTERS_2_3;

  // When: 공용 콘텐츠 경계가 데이터를 검사한다.
  const result = validateChapterDefinitions(definitions);

  // Then: 장별 핵심 루프와 보상·반전이 서로 다르고, 실측 전에는 분량 숫자를 만들지 않는다.
  assert.deepEqual(definitions.map((chapter) => chapter.id), [
    'chapter-2-smiling-riot', 'chapter-3-dual-school'
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(new Set(definitions.map((chapter) => chapter.loop.decision)).size, 2);
  assert.equal(new Set(definitions.map((chapter) => chapter.patchReward.id)).size, 2);
  for (const chapter of definitions) {
    assert.equal(chapter.consequenceEchoes.length, 2);
    assert.ok(chapter.boss.phases.length >= 3);
    assert.ok(chapter.reversal.foreshadowIds.length >= 2);
    assert.equal(chapter.timeline.status, 'unmeasured');
    assert.equal('desktopMinutes' in chapter.timeline, false);
    assert.equal('touchMinutes' in chapter.timeline, false);
  }
});

test('Given chapter-one SECURE and PURGE saves, When carried through chapters 2 and 3, Then both remain viable with different costs', () => {
  // Given: 원본 보존과 빠른 소거로 갈린 두 캠페인 시드.
  const secureSeed = createChapterOneEndingFixture('secure').campaign;
  const purgeSeed = createChapterOneEndingFixture('purge').campaign;

  // When: 같은 공용 캠페인 전이가 2장과 3장에 결과를 전파한다.
  const secureRoute = createCampaignRoute(secureSeed);
  const purgeRoute = createCampaignRoute(purgeSeed);

  // Then: 어느 쪽도 막히거나 완전 상위가 아니며 조우·대사·증거 접근이 달라진다.
  assert.equal(secureRoute.chapters.length, 2);
  assert.equal(purgeRoute.chapters.length, 2);
  assert.notDeepEqual(secureRoute.chapters, purgeRoute.chapters);
  assert.equal(secureRoute.chapters.every((chapter) => chapter.playable), true);
  assert.equal(purgeRoute.chapters.every((chapter) => chapter.playable), true);
  assert.equal(secureRoute.tradeoffs.advantages.length, secureRoute.tradeoffs.costs.length);
  assert.equal(purgeRoute.tradeoffs.advantages.length, purgeRoute.tradeoffs.costs.length);
});

test('Given dual-school combat, When layer switch, pause, save, reload, and replay repeat, Then endpoints match exactly', () => {
  // Given: 추천자 두 명이 서로 다른 현실에 있는 3장 시작 상태.
  const initial = createDualSchoolState();
  const beforeSave = [
    { type: 'switch-layer' },
    { amount: 30, enemyId: 'recommender-verified', type: 'damage-enemy' },
    { type: 'pause' }
  ];
  const afterSave = [
    { amount: 30, enemyId: 'recommender-comfort', type: 'damage-enemy' },
    { type: 'resume' },
    { type: 'switch-layer' },
    { amount: 40, enemyId: 'recommender-comfort', type: 'damage-enemy' }
  ];

  // When: 직행 재생과 중간 저장 복구 재생을 각각 수행한다.
  const direct = replayDualSchool(initial, [...beforeSave, ...afterSave]);
  const checkpoint = replayDualSchool(initial, beforeSave);
  const restored = restoreDualSchool(serializeDualSchool(checkpoint.state));
  const resumed = replayDualSchool(restored, afterSave);

  // Then: 활성 현실의 적만 피해를 받고 최종 상태·사건 로그가 완전히 같다.
  assert.deepEqual(resumed.state, direct.state);
  assert.deepEqual(resumed.events, direct.events.slice(beforeSave.length));
  assert.equal(direct.state.enemies.find((enemy) => enemy.id === 'recommender-verified').hp, 70);
  assert.equal(direct.state.enemies.find((enemy) => enemy.id === 'recommender-comfort').hp, 60);
});

test('Given malformed expansion content, When validated, Then independent contract failures are all visible', () => {
  // Given: 중복 장 ID와 누락된 보스·반전·결과 echo.
  const malformed = [{
    ...CHAPTERS_2_3[0],
    boss: { phases: [] },
    consequenceEchoes: [],
    reversal: { foreshadowIds: [] }
  }, CHAPTERS_2_3[0]];

  // When: 공용 경계에서 한 번 검사한다.
  const codes = validateChapterDefinitions(malformed).errors.map((error) => error.code);

  // Then: 첫 오류에서 멈추지 않고 저작 오류를 전부 알린다.
  for (const code of ['DUPLICATE_ID', 'MISSING_BOSS', 'MISSING_ECHOES', 'MISSING_FORESHADOW']) {
    assert.equal(codes.includes(code), true);
  }
});

test('Given Copycat and Recommender definitions, When validated, Then shared enemy contracts accept both roles', () => {
  // Given: 1장 적과 같은 카탈로그에 추가된 두 확장 적.
  const definitions = Object.values(ENEMY_DEFINITIONS);

  // When: 기존 공용 적 validator를 그대로 통과시킨다.
  const result = validateEnemyDefinitions(definitions);

  // Then: 장 이름 분기 없이 네 역할이 모두 유효하다.
  assert.deepEqual(definitions.map((definition) => definition.id), [
    'eraser', 'stamper', 'copycat', 'recommender', 'approval'
  ]);
  assert.deepEqual(result.errors, []);
});

test('Given an untraced Copycat source, When struck then traced and struck, Then multiplication turns into source damage', () => {
  // Given: 원본 하나만 있는 공유 사슬.
  let chain = createSourceChain({ maxCopies: 3, sourceId: 'festival-origin' });

  // When: 무작정 베고, TRACE한 뒤, 다시 원본을 벤다.
  chain = applySourceAction(chain, { targetId: 'festival-origin', type: 'blade' }).state;
  assert.equal(chain.members.length, 2);
  chain = applySourceAction(chain, { targetId: 'festival-origin', type: 'trace' }).state;
  const resolved = applySourceAction(chain, { damage: 40, targetId: 'festival-origin', type: 'blade' });

  // Then: 복제 상한은 고정되고 TRACE 이후에는 새 복사본 없이 원본 체력이 줄어든다.
  assert.equal(resolved.state.members.length, 2);
  assert.equal(resolved.state.members.find((member) => member.id === 'festival-origin').hp, 60);
  assert.equal(resolved.event.type, 'source-damaged');
});

test('Given chapter 2 and 3 routes, When the frozen level validator runs, Then every segment reaches its boss exit', () => {
  // Given: 밈 공유망과 이중 학교의 서로 다른 선형 공간.
  const levels = [chapter2Level, chapter3Level];

  // When: 1장과 같은 충돌·내비게이션·조명 계약을 검사한다.
  const results = levels.map(validateLevel);

  // Then: 두 장 모두 고유 경로를 가지며 모든 구간과 boss exit가 도달 가능하다.
  assert.deepEqual(results.map((result) => result.errors), [[], []]);
  assert.notDeepEqual(
    chapter2Level.segments.map((segment) => segment.id),
    chapter3Level.segments.map((segment) => segment.id)
  );
  assert.equal(results.every((result) => result.bossExitReachable), true);
});

test('Given shared campaign modules, When sources are inspected, Then they stay deterministic and chapter-name independent', () => {
  // Given: 캠페인 전이와 전투 규칙을 공유하는 순수 모듈.
  const sources = [
    '../src/reboot/campaign/runtime.js',
    '../src/reboot/campaign/dualSchool.js',
    '../src/reboot/enemies/sourceChain.js'
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  const campaignSource = readFileSync(new URL('../src/reboot/campaign/runtime.js', import.meta.url), 'utf8');

  // When/Then: 장 이름 분기, 난수, Three.js 의존이 공용 규칙에 스며들지 않는다.
  assert.equal(/(?:if|switch)\s*\([^)]*(?:chapter-[23]|웃는 얼굴의 폭동|두 개의 학교)/.test(campaignSource), false);
  assert.equal(/Math\.random|from ['"]three['"]/.test(sources), false);
});
