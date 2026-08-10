import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createCameraController } from '../src/reboot/camera/controller.js';
import {
  closestRouteSegment, getBossCameraTargets, getEncounterCameraTargets, getSceneViewport,
  updateSchoolCamera
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

test('학교 장면 카메라는 아직 만나지 않은 먼 적 대신 현재 이동 경로를 잡는다', () => {
  const player = { position: { x: 0, y: 0, z: 1 } };
  const farEnemy = { id: 'future-enemy', phase: 'idle', position: { x: 1, z: -39 } };
  const targets = getEncounterCameraTargets(
    { player, targets: [{ id: farEnemy.id, position: farEnemy.position }] },
    { id: 'classroom-exit', position: { x: 0, y: 0, z: -4.8 } },
    { enemies: [farEnemy] }
  );

  assert.equal(targets.threat.id, 'player');
  assert.equal(targets.routeCue.id, 'classroom-exit');
});

test('1장 첫 조망은 플레이어를 왼쪽 중심대에 두고 중앙 기억 동선과 열린 교실을 함께 잡는다', () => {
  // Given: 전투가 시작되기 전 열린 교실과 데스크톱 레퍼런스 뷰포트.
  const viewport = { height: 900, mode: 'desktop', width: 1440 };
  const frame = { player: { position: { x: 0, y: 0, z: 1 } }, targets: [] };
  const encounter = { enemies: [] };
  const routeCue = { id: 'classroom-exit', position: { x: 0, y: 0, z: -4.8 } };
  const targets = getEncounterCameraTargets(frame, routeCue, encounter);
  const cameraState = createCameraController(targets, viewport);
  const camera = new THREE.PerspectiveCamera(42, viewport.width / viewport.height, 0.1, 200);

  // When: 첫 조망 전용 카메라를 실제 Three.js 투영 행렬에 적용한다.
  updateSchoolCamera({
    bossEnabled: false, camera, cameraState,
    currentSegment: { id: 'classroom-cold-open' }, delta: 0,
    encounter, frame, routeCue, viewport
  });
  camera.updateMatrixWorld(true);
  const project = (x, y, z) => {
    const point = new THREE.Vector3(x, y, z).project(camera);
    return {
      x: (point.x + 1) * viewport.width / 2,
      y: (1 - point.y) * viewport.height / 2
    };
  };
  const playerBottom = project(0, 0, 1);
  const playerTop = project(0, 2, 1);
  const route = project(0, 0, -4.8);

  // Then: 캐릭터는 레퍼런스의 왼쪽 중심대에서 읽히고, 목표는 중앙이며, 화면 높이 29~36%를 차지한다.
  assert.equal(camera.fov, 39);
  assert.ok(playerBottom.x >= 590 && playerBottom.x <= 650, `player x ${playerBottom.x}`);
  assert.ok(route.x >= 700 && route.x <= 760, `route x ${route.x}`);
  assert.ok((playerBottom.y - playerTop.y) / viewport.height >= 0.29);
  assert.ok((playerBottom.y - playerTop.y) / viewport.height <= 0.36);
});

test('학교 HUD는 보스와 결말 상태를 사용자 화면과 QA 텔레메트리에 함께 반영한다', () => {
  const canvas = { dataset: {} };
  const element = () => ({ hidden: true, textContent: '' });
  const resultWrites = { action: 0, consequence: 0, reversal: 0 };
  const countedResult = (key) => {
    let textContent = '';
    return {
      hidden: true,
      get textContent() { return textContent; },
      set textContent(value) { resultWrites[key] += 1; textContent = value; }
    };
  };
  const ui = {
    action: element(), chain: element(), enemy: element(), health: element(), objective: element(),
    radio: element(), radioSpeaker: element(), radioText: element(), result: element(),
    resultAction: countedResult('action'), resultConsequence: countedResult('consequence'),
    resultReversal: countedResult('reversal')
  };
  const encounter = {
    enemies: [
      { armor: 0, definition: { id: 'eraser' }, id: 'eraser-1', phase: 'defeat', phaseTick: 0 },
      { definition: { id: 'stamper' }, id: 'stamper-1', phase: 'windup', phaseTick: 12 }
    ]
  };
  const hud = createSchoolSceneHud({ canvas, ui });
  const presentation = {
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
  };
  hud.sync(presentation);
  hud.sync({ ...presentation, frame: { ...presentation.frame, tick: 43 } });

  assert.equal(ui.enemy.textContent, '감독관 180');
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
  assert.deepEqual(resultWrites, { action: 1, consequence: 1, reversal: 1 });
});
