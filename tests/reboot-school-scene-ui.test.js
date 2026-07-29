import assert from 'node:assert/strict';
import test from 'node:test';

import {
  closestRouteSegment, getBossCameraTargets, getEncounterCameraTargets, getSceneViewport
} from '../src/reboot/render/schoolSceneCamera.js';
import { createSchoolSceneHud } from '../src/reboot/render/schoolSceneHud.js';

test('학교 장면 카메라 헬퍼는 터치 화면과 기억 백업 표적을 결정적으로 고른다', () => {
  const canvas = { clientHeight: 720, clientWidth: 390 };
  const segments = [{ anchor: { z: 0 }, id: 'start' }, { anchor: { z: -54 }, id: 'memory' }];
  const frame = {
    player: { position: { x: 0, y: 0, z: -54 } },
    targets: [
      { id: 'enemy', position: { x: 3, y: 0, z: -54 } },
      { id: 'memory-backup', position: { x: 0, y: 0, z: -56 } }
    ]
  };
  const encounter = { enemies: [{ id: 'enemy', phase: 'idle', position: { x: 3, z: -54 } }] };
  const targets = getEncounterCameraTargets(frame, { id: 'cue', position: { x: 0, y: 0, z: -60 } }, encounter);

  assert.equal(getSceneViewport(canvas).mode, 'touch');
  assert.equal(closestRouteSegment(segments, -52).id, 'memory');
  assert.equal(targets.traceTarget.id, 'memory-backup');
  assert.equal(getBossCameraTargets(frame, { id: 'cue' }).threat.id, 'attendance-proctor');
});

test('학교 HUD는 보스와 결말 상태를 사용자 화면과 QA 텔레메트리에 함께 반영한다', () => {
  const canvas = { dataset: {} };
  const element = () => ({ hidden: true, textContent: '' });
  const ui = {
    action: element(), chain: element(), enemy: element(), health: element(), objective: element(),
    radio: element(), radioSpeaker: element(), radioText: element(), result: element(),
    resultAction: element(), resultConsequence: element(), resultReversal: element()
  };
  const encounter = {
    enemies: [
      { armor: 0, definition: { id: 'eraser' }, id: 'eraser-1', phase: 'defeat', phaseTick: 0 },
      { definition: { id: 'stamper' }, id: 'stamper-1', phase: 'windup', phaseTick: 12 }
    ]
  };
  createSchoolSceneHud({ canvas, ui }).sync({
    bossEvents: [{ type: 'mastery-success' }],
    bossState: {
      definition: { phases: [{ id: 'reflect' }] }, hp: 180, phaseIndex: 0,
      phaseSuccesses: 1, status: 'active'
    },
    counters: { armorBreaks: 1, cancelledAttacks: 0, playerHits: 0, reflections: 1 },
    encounter,
    feedbackState: {
      audio: { activeVoices: 2, musicLayer: 'boss-chain' }, pool: { active: 4 },
      promptCount: 2, promptKinds: ['reflect', 'chain-up']
    },
    frame: { hud: { action: 'reflect', chainLevel: 2, hp: 100 }, tick: 42 },
    performanceState: {
      p95FrameMs: 15.8,
      render: { calls: 8, heapBytes: 1_000_000, lights: 2, particles: 6, triangles: 9000 }
    },
    qualityProfile: { dpr: 1 },
    radioLine: { speaker: 'DOT', textKo: '기록이 열렸어.' },
    resultVisible: true,
    routeSegmentId: 'gym-boss-arena',
    storyOutcome: { actionKo: '확보', reversalKo: '서명 발견', routeConsequenceKo: '추격 증가' },
    storyState: {
      campaign: { settings: { motion: 'reduced', quality: 'low', sound: false } },
      effects: { backupVisible: true, extraWave: true }, memoryOutcome: 'secure', phase: 'chapter-ending'
    },
    viewportMode: 'desktop'
  });

  assert.equal(ui.enemy.textContent, 'REFLECT 180');
  assert.match(ui.objective.textContent, /선택.*승인 기록/);
  assert.equal(ui.result.hidden, false);
  assert.equal(ui.resultReversal.textContent, '서명 발견');
  assert.equal(canvas.dataset.bossEvent, 'mastery-success');
  assert.equal(canvas.dataset.memoryOutcome, 'secure');
  assert.equal(canvas.dataset.stamperTelegraph, 'windup:12');
  assert.equal(canvas.dataset.feedbackPromptCount, '2');
  assert.equal(canvas.dataset.musicLayer, 'boss-chain');
  assert.equal(canvas.dataset.p95FrameMs, '15.8');
  assert.equal(canvas.dataset.quality, 'low');
});
