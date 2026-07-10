// 「잡음의 군도」 스테이지 프레임 — 데이터 무결성 + 상태 판정 + 세이브 v2 마이그레이션.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES,
  getStageById,
  getStageStates,
  markStageCompleted,
  nearestSeaIsland,
  normalizeStages
} from '../src/stageData.js';
import { createInitialProgress, normalizeProgress } from '../src/worldData.js';

test('STAGES: 프롤로그 + 5스테이지, id 중복 없음, 사슬이 프롤로그까지 이어진다', () => {
  assert.equal(STAGES.length, 6);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, 6);
  assert.equal(STAGES[0].id, 'prologue');
  assert.equal(STAGES[0].built, true);
  // 모든 섬은 requires 사슬을 따라가면 프롤로그에 닿아야 한다(고아 섬 방지).
  for (const stage of STAGES) {
    let cursor = stage;
    const seen = new Set();
    while (cursor.requires) {
      assert.ok(!seen.has(cursor.id), `순환 참조: ${stage.id}`);
      seen.add(cursor.id);
      cursor = getStageById(cursor.requires);
      assert.ok(cursor, `깨진 requires: ${stage.id}`);
    }
    assert.equal(cursor.id, 'prologue');
  }
});

test('getStageStates: 새 세이브 — 프롤로그만 진행 중, 나머지는 안개에 잠김', () => {
  const states = getStageStates(createInitialProgress());
  assert.equal(states[0].state, 'current');
  for (const stage of states.slice(1)) {
    assert.equal(stage.state, 'locked');
  }
});

test('getStageStates: 프롤로그 완료(aiCoreCompleted 파생) → 섬1은 준비 중, 섬2는 잠김', () => {
  const progress = { ...createInitialProgress(), aiCoreCompleted: true };
  const states = getStageStates(progress);
  assert.equal(states[0].state, 'completed');
  assert.equal(states[1].state, 'coming'); // built:false — 콘텐츠가 오면 'current'
  assert.equal(states[2].state, 'locked');
});

test('markStageCompleted: 순수 함수 — 원본 불변, 알 수 없는 섬은 거부', () => {
  const progress = createInitialProgress();
  const next = markStageCompleted(progress, 'whisper-cape');
  assert.equal(next.stages['whisper-cape'].completed, true);
  assert.deepEqual(progress.stages, {});
  assert.throws(() => markStageCompleted(progress, 'atlantis'), RangeError);
  // 섬1 완료가 사슬에 반영되는지: 섬2가 '준비 중'으로 풀린다.
  const chained = { ...next, aiCoreCompleted: true };
  const states = getStageStates(chained);
  assert.equal(states[1].state, 'completed');
  assert.equal(states[2].state, 'coming');
});

test('normalizeStages: 알 수 없는 섬·깨진 값은 버리고 completed만 남긴다', () => {
  assert.deepEqual(normalizeStages(null), {});
  assert.deepEqual(normalizeStages('junk'), {});
  const cleaned = normalizeStages({
    'whisper-cape': { completed: true, junk: 1 },
    'echo-cave': { completed: 'yes' },
    atlantis: { completed: true },
    'hourglass-port': null
  });
  assert.deepEqual(cleaned, {
    'whisper-cape': { completed: true },
    'echo-cave': { completed: false }
  });
});

test('세이브 v2 마이그레이션: v1 세이브(version·stages 없음)가 손실 없이 올라온다', () => {
  const v1 = {
    visitedTopics: ['privacy'],
    completedShrines: ['privacy-shrine'],
    collectedFragments: ['privacy'],
    choiceLog: [{ choiceId: 'ask', correct: true }],
    tools: ['shield'],
    prologueSeen: true,
    aiCoreCompleted: true
  };
  const migrated = normalizeProgress(v1);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.stages, {});
  // 기존 필드(학습 리포트 신호 포함)는 그대로.
  assert.deepEqual(migrated.visitedTopics, ['privacy']);
  assert.deepEqual(migrated.tools, ['shield']);
  assert.equal(migrated.aiCoreCompleted, true);
  assert.equal(migrated.choiceLog.length, 1);
  // 프롤로그 완료가 파생되어 항로 지도에 반영된다.
  assert.equal(getStageStates(migrated)[0].state, 'completed');
});

test('nearestSeaIsland: 범위 안 최근접 섬, 밖이면 null, 두 섬 사이면 가까운 쪽', () => {
  const SCALE = 2.2;
  // 시작의 섬(sea [0,0]) 바로 남쪽.
  assert.equal(nearestSeaIsland(0, 5, SCALE, 7)?.id, 'prologue');
  // 아무 섬도 없는 먼 바다.
  assert.equal(nearestSeaIsland(60, 60, SCALE, 7), null);
  // 속삭임 곶(sea [-16,-9] → [-35.2,-19.8]) 근처.
  assert.equal(nearestSeaIsland(-34, -18, SCALE, 7)?.id, 'whisper-cape');
  // 기억의 심장 외곽([17.6,-57.2])과 심부([17.6,-74.8]) 사이 — 외곽이 더 가깝다.
  assert.equal(nearestSeaIsland(17.6, -60, SCALE, 7)?.id, 'memory-outer');
});

test('세이브 v2: stages 맵이 정규화를 거쳐 왕복 보존된다', () => {
  const v2 = { ...createInitialProgress(), stages: { 'whisper-cape': { completed: true }, atlantis: {} } };
  const normalized = normalizeProgress(v2);
  assert.deepEqual(normalized.stages, { 'whisper-cape': { completed: true } });
});
