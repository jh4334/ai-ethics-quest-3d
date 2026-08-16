import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_MECHANICS,
  CAMPAIGN_WORLD,
  createActionGameState,
  createInputState,
  setInputAction,
  stepActionGame
} from '../src/illustrated/story.js';

function createChapterState(chapterIndex) {
  return createActionGameState({
    version: 3,
    chapterIndex,
    unlockedChapter: chapterIndex,
    checkpointX: 150,
    evidenceIds: [],
    decisions: {},
    completed: false
  });
}

function tap(state, input, action, settleFrames = 2) {
  setInputAction(input, action, true);
  stepActionGame(state, input, 1 / 60);
  setInputAction(input, action, false);
  for (let frame = 0; frame < settleFrames; frame += 1) stepActionGame(state, input, 1 / 60);
}

test('여섯 장은 길이·조우·근거·보스 패턴이 실제로 다른 전투 계약을 가진다', () => {
  assert.ok(CAMPAIGN_WORLD.width >= 6200);
  assert.equal(Object.keys(CAMPAIGN_MECHANICS).length, 6);

  const mechanicIds = new Set();
  const bossSignatures = new Set();
  for (const chapter of CAMPAIGN_CHAPTERS) {
    const mechanics = CAMPAIGN_MECHANICS[chapter.id];
    assert.ok(mechanics, `${chapter.id} 전투 규칙이 필요합니다.`);
    assert.ok(chapter.evidence.length >= 3, `${chapter.id}에 세 개 이상의 윤리 근거가 필요합니다.`);
    assert.ok(chapter.enemies.length >= 4, `${chapter.id}에 네 번 이상의 조우가 필요합니다.`);
    assert.ok(new Set(chapter.enemies.map(({ kind }) => kind)).size >= 2, `${chapter.id} 적 실루엣이 둘 이상이어야 합니다.`);
    assert.equal(mechanics.bossPhases.length, 3, `${chapter.id} 보스는 세 단계여야 합니다.`);
    mechanicIds.add(mechanics.id);
    bossSignatures.add(mechanics.bossPhases.map(({ pattern }) => pattern).join('>'));
  }

  assert.equal(mechanicIds.size, 6);
  assert.equal(bossSignatures.size, 6, '보스는 체력·색만 다르고 같은 패턴이어서는 안 됩니다.');
});

test('확인 없이 공격하면 장별 윤리 문제와 같은 서로 다른 실패 비용이 발생한다', () => {
  const expectedEvents = [
    'privacy-exposed',
    'signal-copied',
    'spread-amplified',
    'source-pair-incomplete',
    'automatic-approval',
    'responsibility-chain-reset'
  ];

  for (let chapterIndex = 0; chapterIndex < 6; chapterIndex += 1) {
    const state = createChapterState(chapterIndex);
    const input = createInputState();
    const enemy = state.enemies[0];
    state.player.x = enemy.x - 42;
    state.player.y = state.world.groundY;
    const hpBefore = enemy.hp;

    tap(state, input, 'attack', 0);

    assert.equal(enemy.hp, hpBefore, `${chapterIndex + 1}장은 무지성 SIGNAL로 적을 깎을 수 없어야 합니다.`);
    assert.equal(state.lastEvent, expectedEvents[chapterIndex]);
    assert.equal(state.ethics.blindActions, 1);
  }
});

test('2장 카피캣은 출처 확인 전 플레이어 SIGNAL을 복제해 되돌린다', () => {
  const state = createChapterState(1);
  const input = createInputState();
  const enemy = state.enemies[0];
  state.player.x = enemy.x - 42;
  state.player.y = state.world.groundY;

  tap(state, input, 'attack', 0);
  assert.equal(state.ethics.reflections, 1);
  assert.ok(state.projectiles.some(({ kind, owner }) => kind === 'mirrored-signal' && owner === 'enemy'));

  tap(state, input, 'trace');
  assert.equal(enemy.traced, true);
  const hpBefore = enemy.hp;
  state.player.attackCooldown = 0;
  tap(state, input, 'attack');
  assert.ok(enemy.hp < hpBefore, '제작 이력을 확인한 뒤에만 복제체를 끊을 수 있어야 합니다.');
});

test('4장은 반대 출처 두 개를 모두 TRACE해야 추천 방패를 열 수 있다', () => {
  const state = createChapterState(3);
  const input = createInputState();
  const [first, counterpart] = state.enemies;

  state.player.x = first.x - 42;
  tap(state, input, 'trace');
  const hpBefore = first.hp;
  tap(state, input, 'attack');
  assert.equal(first.hp, hpBefore);
  assert.equal(state.lastEvent, 'source-pair-incomplete');

  state.player.x = counterpart.x - 42;
  tap(state, input, 'trace');
  state.player.x = first.x - 42;
  state.player.attackCooldown = 0;
  tap(state, input, 'attack');
  assert.ok(first.hp < hpBefore, '서로 다른 두 출처를 확인하면 방패가 열려야 합니다.');
});

test('5장은 자동 결재탄을 TRACE로 검토한 뒤 SIGNAL로 반송해야 보스를 멈춘다', () => {
  const state = createChapterState(4);
  const input = createInputState();
  state.boss.active = true;
  state.player.x = state.boss.x - 360;
  state.player.y = state.world.groundY;
  state.boss.attackCooldown = 0;
  stepActionGame(state, input, 1 / 60);
  const stamp = state.projectiles.find(({ kind }) => kind === 'approval-stamp');
  assert.ok(stamp, '3초 승인실 보스는 검토 가능한 자동 결재탄을 발사해야 합니다.');

  state.player.x = stamp.x;
  state.player.y = stamp.y;
  tap(state, input, 'trace');
  assert.equal(stamp.reviewed, true);
  const phaseHpBefore = state.boss.phaseHp;
  tap(state, input, 'attack');
  assert.ok(state.boss.phaseHp < phaseHpBefore, '검토한 결재탄만 보스에게 반송되어야 합니다.');
});

test('이전 선택은 선악 점수가 아니라 이름 있는 다음 장 조건으로 파생된다', () => {
  const state = createActionGameState({
    version: 3,
    chapterIndex: 2,
    unlockedChapter: 2,
    checkpointX: 150,
    evidenceIds: [],
    decisions: {
      'chapter-1': 'protect-context',
      'chapter-2': 'remove-and-notify'
    },
    completed: false
  });

  assert.deepEqual(state.modifiers, ['privacy-mask', 'spread-warning']);
  assert.equal('score' in state.ethics, false);
});

test('이전 장의 결정은 다음 장의 반격·확산·검토 규칙을 실제로 바꾼다', () => {
  const protectedState = createActionGameState({
    version: 3,
    chapterIndex: 1,
    unlockedChapter: 1,
    checkpointX: 150,
    evidenceIds: [],
    decisions: { 'chapter-1': 'protect-context' },
    completed: false
  });
  const input = createInputState();
  protectedState.player.x = protectedState.enemies[0].x - 42;
  tap(protectedState, input, 'attack');
  assert.equal(protectedState.lastEvent, 'privacy-mask-blocked');
  assert.equal(protectedState.projectiles.length, 0);
  protectedState.player.attackCooldown = 0;
  tap(protectedState, input, 'attack');
  assert.equal(protectedState.lastEvent, 'signal-copied');

  const warnedState = createActionGameState({
    version: 3,
    chapterIndex: 2,
    unlockedChapter: 2,
    checkpointX: 150,
    evidenceIds: [],
    decisions: { 'chapter-2': 'remove-and-notify' },
    completed: false
  });
  warnedState.player.x = warnedState.enemies[0].x - 42;
  tap(warnedState, createInputState(), 'attack');
  assert.equal(warnedState.lastEvent, 'spread-warning-blocked');
  assert.equal(warnedState.projectiles.length, 0);

  const recoveryState = createActionGameState({
    version: 3,
    chapterIndex: 3,
    unlockedChapter: 3,
    checkpointX: 150,
    evidenceIds: [],
    decisions: { 'chapter-3': 'notify-and-repair' },
    completed: false
  });
  recoveryState.player.x = recoveryState.enemies[0].x - 42;
  tap(recoveryState, createInputState(), 'trace');
  assert.equal(recoveryState.enemies[1].traced, true, '회복 경로는 연결된 반대 출처까지 표시해야 합니다.');

  const reviewState = createActionGameState({
    version: 3,
    chapterIndex: 5,
    unlockedChapter: 5,
    checkpointX: 150,
    evidenceIds: [],
    decisions: { 'chapter-5': 'human-review' },
    completed: false
  });
  reviewState.boss.active = true;
  reviewState.boss.phaseIndex = 1;
  reviewState.boss.phaseHp = reviewState.boss.maxPhaseHp;
  reviewState.boss.hp = reviewState.boss.maxHp - reviewState.boss.maxPhaseHp;
  reviewState.player.x = reviewState.boss.x - 42;
  tap(reviewState, createInputState(), 'attack', 0);
  assert.equal(reviewState.boss.phaseIndex, 1, '사람 검토자는 이미 확인한 책임 단계를 보존해야 합니다.');
  assert.equal(reviewState.lastEvent, 'responsibility-chain-reset');
});
