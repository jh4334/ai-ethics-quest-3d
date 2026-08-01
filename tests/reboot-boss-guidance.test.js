import assert from 'node:assert/strict';
import test from 'node:test';

import { createBossFixture } from '../src/reboot/bosses/fixtures.js';
import { createBossState } from '../src/reboot/bosses/runtime.js';
import {
  MISMATCH_COOLDOWN_SECONDS, bossGuidancePrompts, bossObjectiveText, bossVerbFor, createBossGuidance
} from '../src/reboot/bosses/guidance.js';
import { ATTENDANCE_PROCTOR } from '../src/reboot/content/bosses/attendanceProctor.js';
import { createSchoolSceneHud } from '../src/reboot/render/schoolSceneHud.js';

test('보스 단계는 행동·진척이 담긴 목표 문구로 매핑된다', () => {
  assert.equal(bossObjectiveText(createBossFixture('phase-1-start')), '감독관 1/3 — 빔을 K 반사 (0/2)');
  assert.equal(bossObjectiveText(createBossFixture('phase-2-start')), '감독관 2/3 — 진짜 기록 E 추적 (0/2)');
  assert.equal(bossObjectiveText(createBossFixture('phase-3-start')), '감독관 3/3 — 코어 J 베기 (0/3)');
  assert.equal(bossObjectiveText(createBossFixture('low-health')), '감독관 3/3 — 코어 J 베기 (2/3)');
  // 승리·부재·미지 단계면 null — HUD는 기존 구간 목표로 되돌아간다.
  assert.equal(bossObjectiveText(createBossFixture('victory')), null);
  assert.equal(bossObjectiveText(null), null);
  assert.equal(bossObjectiveText({
    definition: { phases: [{ id: 'reflect' }] }, phaseIndex: 0, phaseSuccesses: 0, status: 'active'
  }), null);
});

test('동사 프롬프트는 윈드업·공격 윈도우 동안만 켜지고 첫 성공 전엔 순서 안내가 붙는다', () => {
  const windup = createBossFixture('phase-1-start');
  const window = createBossFixture('phase-1-window');
  const { activeTicks, windupTicks } = ATTENDANCE_PROCTOR.phases[0].timing;
  const recovery = createBossState(ATTENDANCE_PROCTOR, { phaseTick: windupTicks + activeTicks });

  assert.equal(bossVerbFor(windup), 'reflect');
  assert.equal(bossVerbFor(window), 'reflect');
  assert.equal(bossVerbFor(recovery), null);
  assert.equal(bossVerbFor(createBossFixture('phase-2-window')), 'trace');
  assert.equal(bossVerbFor(createBossFixture('phase-3-window')), 'attack');
  assert.equal(bossVerbFor(createBossFixture('victory')), null);

  // 첫 성공 전(knowledge 비어 있음): 동사 칩 + 순서 안내. 이후: 동사 칩만.
  assert.deepEqual(bossGuidancePrompts(windup).map((prompt) => prompt.id), [
    'boss-verb-reflect-scan', 'boss-order-hint'
  ]);
  assert.deepEqual(bossGuidancePrompts(createBossFixture('phase-2-window')).map((prompt) => prompt.id), [
    'boss-verb-trace-roster'
  ]);
  assert.deepEqual(bossGuidancePrompts(recovery).map((prompt) => prompt.id), ['boss-order-hint']);
});

test('진입·단계 전환·격려 무전은 1회씩 나오고 재도전에 다시 열린다', () => {
  const guidance = createBossGuidance();
  const phase1 = createBossFixture('phase-1-start');
  const spoken = [];

  const entry = guidance.observe({ state: phase1 });
  spoken.push(...entry);
  assert.equal(entry.length, 1);
  assert.match(entry[0].textKo, /K로 되돌려/);
  assert.equal(guidance.observe({ state: phase1 }).length, 0);

  const cheer = guidance.observe({
    events: [{ phaseId: 'reflect-scan', type: 'mastery-success' }], state: phase1
  });
  spoken.push(...cheer);
  assert.deepEqual(cheer.map((line) => line.textKo), ['좋아, 한 번 더!']);

  const trace = guidance.observe({ state: createBossFixture('phase-2-start') });
  spoken.push(...trace);
  assert.match(trace[0].textKo, /E로 짚어/);
  const core = guidance.observe({ state: createBossFixture('phase-3-start') });
  spoken.push(...core);
  assert.match(core[0].textKo, /J로 베어/);

  // 재도전(boss-retry-ready): 단계가 되감기므로 진입 안내가 다시 나온다.
  const retry = guidance.observe({ events: [{ type: 'boss-retry-ready' }], state: phase1 });
  spoken.push(...retry);
  assert.match(retry[0].textKo, /K로 되돌려/);

  // 시나리오 v2 무전 예산 — 모든 대본 74자 이내, DOT 화자.
  for (const line of spoken) {
    assert.ok(line.textKo.length <= 74);
    assert.equal(line.speaker, 'DOT');
    assert.ok(line.durationMs >= 1200 && line.durationMs <= 6200);
  }
});

test('오입력 재안내는 단계 동사를 짚고 3초 이내에는 반복되지 않는다', () => {
  const guidance = createBossGuidance();
  const phase1 = createBossFixture('phase-1-start');

  const first = guidance.noteMismatch('attack', phase1);
  assert.match(first.textKo, /K야/);
  // 스팸 방지 — 쿨다운이 끝나기 전에는 같은 안내가 나오지 않는다.
  assert.equal(guidance.noteMismatch('attack', phase1), null);
  guidance.update(MISMATCH_COOLDOWN_SECONDS - 0.5);
  assert.equal(guidance.noteMismatch('trace', phase1), null);
  guidance.update(0.5);
  assert.match(guidance.noteMismatch('trace', phase1).textKo, /K야/);

  // 단계 동사와 일치하는 입력·비전투 입력은 오입력이 아니다.
  assert.equal(guidance.noteMismatch('reflect', phase1), null);
  assert.equal(guidance.noteMismatch('dash', phase1), null);
  const phase3 = createBossFixture('phase-3-start');
  guidance.update(MISMATCH_COOLDOWN_SECONDS);
  assert.match(guidance.noteMismatch('reflect', phase3).textKo, /J!/);
  // 승리 후에는 재안내가 없다.
  assert.equal(guidance.noteMismatch('attack', createBossFixture('victory')), null);
});

test('학교 HUD는 보스전 동안 목표 문구를 단계 안내로 덮어쓰고 동사를 노출한다', () => {
  const canvas = { dataset: {} };
  const element = () => ({ hidden: true, textContent: '' });
  const ui = { objective: element() };
  const hud = createSchoolSceneHud({ canvas, ui });
  const sync = (bossState, phase) => hud.sync({
    bossState,
    counters: { armorBreaks: 0, cancelledAttacks: 0, playerHits: 0, reflections: 0 },
    encounter: { enemies: [] },
    feedbackState: { audio: { activeVoices: 0, musicLayer: 'calm' }, pool: { active: 0 }, promptCount: 0, promptKinds: [] },
    frame: { hud: { action: 'ready', chainLevel: 0, hp: 100 }, tick: 1 },
    performanceState: { p95FrameMs: 10, render: { calls: 1, heapBytes: 0, lights: 1, particles: 0, triangles: 100 } },
    qualityProfile: { dpr: 1 },
    routeSegmentId: 'gym-boss-arena',
    storyState: {
      campaign: { settings: { motion: 'full', quality: 'auto', sound: true } },
      effects: { backupVisible: true, extraWave: false }, memoryOutcome: null, phase
    },
    viewportMode: 'desktop'
  });

  sync(createBossFixture('phase-2-window'), 'boss');
  assert.equal(ui.objective.textContent, '감독관 2/3 — 진짜 기록 E 추적 (0/2)');
  assert.equal(canvas.dataset.bossVerb, 'trace');
  // 승리 후에는 스토리 단계 문구가 우선한다.
  sync(createBossFixture('victory'), 'chapter-ending');
  assert.equal(ui.objective.textContent, '내 선택과 승인 기록 확인');
  assert.equal(canvas.dataset.bossVerb, 'none');
  // 보스 밖 구간에서는 동사 속성이 꺼진다.
  sync(null, 'boss');
  assert.equal(canvas.dataset.bossVerb, 'none');
  assert.equal(ui.objective.textContent, '승인 기록을 잠근 감독관과 대면');
});
