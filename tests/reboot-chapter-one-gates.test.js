import assert from 'node:assert/strict';
import test from 'node:test';

import { createEncounterGameRuntime } from '../src/reboot/app/encounterGameRuntime.js';
import { chapterOneLevel } from '../src/reboot/content/levels/chapter1.js';
import { walkableRectsFromLevel } from '../src/reboot/level/walkableBounds.js';
import {
  CHAPTER_ONE_POST_BOSS_CHECKPOINTS,
  chapterOneGateForPhase,
  chapterOneSpawnForCheckpoint,
  chapterOneWalkableFor,
  isChapterOneArenaResolved
} from '../src/reboot/story/chapterOneGates.js';
import {
  createChapterOneDirector, createChapterOneEndingFixture
} from '../src/reboot/story/chapterOneDirector.js';

const baseRects = walkableRectsFromLevel(chapterOneLevel);

test('게이트는 phase별로 아레나 남쪽·기억 결정 남쪽 문을 잠근다', () => {
  // 첫 아레나 전멸 전: 아레나 남쪽(-48) 게이트.
  for (const phase of ['cold-open', 'corridor', 'first-arena']) {
    assert.equal(chapterOneGateForPhase(phase).id, 'arena-clear');
    assert.equal(chapterOneGateForPhase(phase).minZ, -48);
  }
  // 기억 결정 전: 기억 구간 남쪽(-61) 게이트.
  for (const phase of ['memory-decision', 'memory-traced', 'memory-secure-ready']) {
    assert.equal(chapterOneGateForPhase(phase).id, 'memory-decision');
    assert.equal(chapterOneGateForPhase(phase).minZ, -61);
  }
  // 결정 이후에는 게이트가 없다.
  for (const phase of ['pursuit', 'boss', 'post-boss', 'chapter-ending', 'complete']) {
    assert.equal(chapterOneGateForPhase(phase), null);
  }
  // 게이트 문구·무전은 데스크톱(키)·터치(버튼) 두 표현을 모두 갖는다.
  const memoryGate = chapterOneGateForPhase('memory-decision');
  assert.match(memoryGate.prompt.desktop, /E 추적/);
  assert.match(memoryGate.prompt.touch, /버튼/);
  assert.equal(memoryGate.radio.desktop.id, memoryGate.radio.touch.id);
});

test('게이트 통행 사각형은 문 앞 플레이어만 자르고, 문 너머 스폰은 건드리지 않는다', () => {
  // 문 앞(아레나 중앙): 문 너머 구간 사각형이 제거된다.
  const gated = chapterOneWalkableFor(baseRects, 'first-arena', -39);
  assert.notEqual(gated, baseRects);
  assert.equal(gated.every((rect) => rect.minZ >= -48), true);
  assert.equal(gated.length < baseRects.length, true);
  // 문 너머(QA fixture 스폰): 참조 그대로 — 뒤로 끌어당기지 않는다.
  assert.equal(chapterOneWalkableFor(baseRects, 'first-arena', -54), baseRects);
  assert.equal(chapterOneWalkableFor(baseRects, 'corridor', -104), baseRects);
  // 게이트 없는 phase: 참조 그대로.
  assert.equal(chapterOneWalkableFor(baseRects, 'pursuit', -70), baseRects);
});

test('저장 체크포인트는 레벨에 저작된 세그먼트 스폰으로 매핑된다', () => {
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:first-arena'), { x: 0, y: -33 });
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:memory-decision'), { x: 0, y: -51 });
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:pursuit'), { x: 0, y: -64 });
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:boss'), { x: 0, y: -95 });
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:signature-revealed'), { x: 0, y: -95 });
  // 미지 체크포인트(예: QA 전용 문자열)는 교실 스폰으로 안전하게 돌아간다.
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:offline-boss'), { x: 0, y: 1 });
  assert.deepEqual(chapterOneSpawnForCheckpoint('chapter-1:start'), { x: 0, y: 1 });
  // 보스 격파 직후 복원 대상 체크포인트 목록은 저장 스키마 문자열을 그대로 쓴다.
  assert.deepEqual(
    [...CHAPTER_ONE_POST_BOSS_CHECKPOINTS],
    ['chapter-1:boss-defeated', 'chapter-1:signature-revealed']
  );
});

test('아레나 정리 여부는 phase에서 유도된다 (리스폰 시 적 리셋 판단)', () => {
  assert.equal(isChapterOneArenaResolved('first-arena'), false);
  assert.equal(isChapterOneArenaResolved('corridor'), false);
  assert.equal(isChapterOneArenaResolved('memory-decision'), true);
  assert.equal(isChapterOneArenaResolved('boss'), true);
  assert.equal(isChapterOneArenaResolved('chapter-ending'), true);
});

test('completeBoss는 뒤처진 스토리를 순서대로 보충해 소프트락을 막는다 (이중 안전장치)', () => {
  // Given: 시퀀스 브레이크 — 아레나·기억 결정을 건너뛴 채 보스만 이긴 상태.
  const saves = [];
  const director = createChapterOneDirector({ persist: (campaign) => saves.push(campaign) });
  director.start();
  assert.equal(director.getState().phase, 'corridor');

  // When: 보스 격파 완료 처리를 요청한다.
  const completed = director.completeBoss();

  // Then: 놓친 트리거가 순서대로 보충되고 결말 체크포인트까지 저장된다.
  assert.equal(completed, true);
  assert.equal(director.getState().phase, 'chapter-ending');
  assert.equal(saves.at(-1).chapterProgress.checkpoint, 'chapter-1:signature-revealed');
  // fast-forward 경로의 기억 결정은 purge(빠른 경로)로 기록된다.
  assert.equal(
    saves.at(-1).evidence.find((record) => record.evidenceId === 'haru-memory-backup').action,
    'purge'
  );
  assert.equal(
    saves.at(-1).evidence.some((record) => record.evidenceId === 'player-approval-record'),
    true
  );
  // 보충된 중간 무전은 버려지고 결말 대본만 남는다.
  assert.match(director.getRadioLine().textKo, /감독관 정지/);
});

test('completeBoss는 결말 체크포인트 재부팅에서도 멱등하게 성공한다 (새로고침 복원)', () => {
  // Given: 보스 승리 직후 저장(chapter-1:signature-revealed)으로 재부팅한 감독기.
  const ending = createChapterOneEndingFixture('secure');
  const saves = [];
  const director = createChapterOneDirector({
    campaign: ending.campaign, persist: (campaign) => saves.push(campaign)
  });
  assert.equal(director.getState().phase, 'chapter-ending');

  // When: 복원된 보스 승리 상태가 완료 처리를 다시 요청한다.
  const restored = director.completeBoss();

  // Then: 상태 전이 없이 성공을 돌려줘 PATCH 선택이 열린다.
  assert.equal(restored, true);
  assert.equal(director.getState().phase, 'chapter-ending');
  assert.deepEqual(saves, []);
  // 2장으로 넘어간 저장에서는 다시 완료 처리하지 않는다.
  const complete = createChapterOneDirector({
    campaign: {
      ...ending.campaign,
      chapterProgress: { completed: [1], current: 2, checkpoint: 'chapter-2:start' }
    }
  });
  assert.equal(complete.completeBoss(), false);
});

test('setWalkable 게이트는 다음 틱부터 플레이어 남진을 문에서 멈춘다', () => {
  // Given: 아레나 중앙의 플레이어와 게이트가 적용된 통행 경계.
  const runtime = createEncounterGameRuntime({
    startPosition: { x: 0, y: -39 }, walkable: baseRects
  });
  runtime.setWalkable(chapterOneWalkableFor(baseRects, 'first-arena', -39));

  // When: 남쪽(-Z)으로 계속 걷는다.
  for (let tick = 0; tick < 240; tick += 1) {
    runtime.update(1 / 60, { horizontal: 0, vertical: -1 });
  }

  // Then: 아레나 남쪽 경계(-48)에서 멈춘다. 게이트를 열면 통과할 수 있다.
  assert.equal(runtime.getState().combat.player.position.y >= -48, true);
  runtime.setWalkable(baseRects);
  for (let tick = 0; tick < 240; tick += 1) {
    runtime.update(1 / 60, { horizontal: 0, vertical: -1 });
  }
  assert.equal(runtime.getState().combat.player.position.y < -48, true);
});

test('체크포인트 리스폰: 지정 스폰 + 정리된 적 유지, 기본 reset은 종전과 동일하다', () => {
  // Given: 첫 아레나를 정리한 상태(체크포인트 복원 경로).
  const runtime = createEncounterGameRuntime({ startPosition: { x: 0, y: -39 } });
  runtime.clearEnemiesForCheckpoint();
  assert.equal(
    runtime.getState().encounter.enemies.every((enemy) => enemy.phase === 'defeat'),
    true
  );

  // When: 기억 구간 체크포인트 스폰에서 적 상태를 유지한 채 리스폰한다.
  const respawned = runtime.reset({ keepEncounter: true, position: { x: 0, y: -51 } });

  // Then: 플레이어만 스폰으로 돌아가고, 전멸시킨 적은 되살아나지 않는다.
  assert.deepEqual(respawned.combat.player.position, { x: 0, y: -51 });
  assert.equal(respawned.combat.player.hp, 100);
  assert.equal(respawned.encounter.enemies.every((enemy) => enemy.phase === 'defeat'), true);
  assert.equal(respawned.combat.targets
    .filter((target) => target.id !== 'memory-backup')
    .every((target) => target.defeated), true);

  // 기본 reset(인자 없음)은 종전 계약 그대로 — 시작 위치·적 전체 초기화.
  const fresh = runtime.reset();
  assert.deepEqual(fresh.combat.player.position, { x: 0, y: -39 });
  assert.equal(fresh.encounter.enemies.every((enemy) => enemy.phase === 'idle'), true);
});

test('heal은 결정적 정수 회복이며 상한 100을 넘지 않는다', () => {
  const runtime = createEncounterGameRuntime({ startPosition: { x: 0, y: -39 } });
  // 만피에서는 회복량 0.
  assert.equal(runtime.heal(15), 0);
  // 피해를 본 뒤에는 요청량만큼(상한까지) 회복한다.
  runtime.getState().combat.player.hp = 70;
  assert.equal(runtime.heal(15), 15);
  assert.equal(runtime.getState().combat.player.hp, 85);
  // 큰 값도 상한 100에서 잘리고 실제 회복량만 돌려준다.
  assert.equal(runtime.heal(999), 15);
  assert.equal(runtime.getState().combat.player.hp, 100);
  // 0·음수·비정수는 무시된다.
  assert.equal(runtime.heal(0), 0);
  assert.equal(runtime.heal(-5), 0);
  assert.equal(runtime.heal(1.5), 0);
});
