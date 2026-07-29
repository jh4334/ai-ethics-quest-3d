import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createReactiveAudioEngine } from '../src/reboot/audio/reactiveAudio.js';
import { FEEDBACK_KINDS, mapFeedbackCues, selectPrimaryPrompts } from '../src/reboot/feedback/cueMap.js';
import { createFeedbackDirector } from '../src/reboot/feedback/director.js';
import { createCombatFeedbackPool } from '../src/reboot/feedback/visualPool.js';

const eventFixture = Object.freeze({
  bossEvents: [
    { patternId: 'scan-a', phaseId: 'reflect-scan', type: 'boss-telegraph' },
    { phaseId: 'approval-core', type: 'boss-defeated' }
  ],
  combatEvents: [
    { action: 'trace', instanceId: 1, tick: 1, type: 'action-started' },
    { action: 'trace', targetId: 'memory', tick: 2, type: 'action-missed' },
    { contactId: 'shot-1', hitId: 'reflect-1', tick: 3, type: 'perfect-reflect' },
    { targetId: 'memory', tick: 4, type: 'traced' },
    { targetId: 'memory', tick: 5, type: 'secured' },
    { level: 2, reason: 'secured', tick: 5, type: 'chain-raised' },
    { contactId: 'shot-2', damage: 10, hp: 90, tick: 6, type: 'player-hit' },
    { targetId: 'eraser-1', tick: 7, type: 'target-defeated' }
  ],
  enemyEvents: [{ enemyId: 'stamper-1', type: 'attack-contact' }]
});

test('모든 핵심 전투 결과는 색과 소리에만 의존하지 않는 고유 피드백을 갖는다', () => {
  const cues = mapFeedbackCues(eventFixture);

  assert.deepEqual(new Set(cues.map((cue) => cue.kind)), new Set(FEEDBACK_KINDS));
  for (const cue of cues) {
    assert.ok(cue.label.length > 0);
    assert.ok(cue.shape.length > 0);
    assert.ok(cue.tone.length > 0);
    assert.ok(Number.isInteger(cue.priority));
  }
  assert.equal(cues.find((cue) => cue.kind === 'reflect').label, 'REFLECT · 명령 반송');
  assert.equal(cues.find((cue) => cue.kind === 'weak-point').label, 'TRACE · 출처 표시');
  assert.equal(cues.find((cue) => cue.kind === 'secure').label, 'SECURE · 원본 고정');
});

test('HUD는 우선순위가 높은 행동 신호를 최대 세 개만 노출한다', () => {
  const prompts = selectPrimaryPrompts(mapFeedbackCues(eventFixture));

  assert.equal(prompts.length, 3);
  assert.deepEqual(prompts.map((prompt) => prompt.kind), ['defeat', 'damage', 'secure']);
});

test('시각 피드백 풀은 동시 10회와 반복 재시작에서도 생성 상한을 지킨다', () => {
  const scene = new THREE.Scene();
  const pool = createCombatFeedbackPool({ capacity: 10, scene });
  const cues = Array.from({ length: 30 }, (_, index) => ({
    id: `cue-${index}`, kind: 'contact', label: '접촉', priority: 5, shape: 'burst',
    targetId: 'player', tone: 'impact'
  }));
  const positions = new Map([['player', { x: 0, y: 1, z: 0 }]]);

  pool.present(cues, positions);
  for (let frame = 0; frame < 18_000; frame += 1) pool.update(1 / 60);
  pool.reset();
  pool.present(cues.slice(0, 10), positions, { reducedMotion: true });
  const active = pool.getDebugState();
  pool.dispose();

  assert.equal(active.capacity, 10);
  assert.equal(active.allocated, 10);
  assert.equal(active.active, 10);
  assert.equal(scene.children.length, 0);
  assert.equal(pool.getDebugState().disposed, true);
});

test('절차 오디오는 무음·숨김 탭·재개·반복 신호에서 활성 음성 상한을 지킨다', () => {
  const audio = createReactiveAudioEngine({ maxVoices: 4 });
  const cues = mapFeedbackCues(eventFixture);

  audio.consume(cues);
  assert.equal(audio.getDebugState().activeVoices, 0);
  audio.resume();
  audio.consume(cues);
  assert.equal(audio.getDebugState().activeVoices <= 4, true);
  audio.setMuted(true);
  audio.consume(cues);
  assert.equal(audio.getDebugState().activeVoices, 0);
  audio.setMuted(false);
  audio.setHidden(true);
  audio.consume(cues);
  assert.equal(audio.getDebugState().activeVoices, 0);
  audio.setHidden(false);
  audio.setMusicState({ chainLevel: 3, inBoss: true, inPursuit: false });
  audio.dispose();

  assert.equal(audio.getDebugState().musicLayer, 'boss-chain');
  assert.equal(audio.getDebugState().disposed, true);
  assert.equal(audio.getDebugState().activeVoices, 0);
});

test('피드백 감독기는 숨김 탭과 장면 폐기에서 리스너와 풀을 모두 회수한다', () => {
  const scene = new THREE.Scene();
  const documentRef = new EventTarget();
  Object.defineProperty(documentRef, 'hidden', { configurable: true, value: false, writable: true });
  const director = createFeedbackDirector({ scene, windowRef: { document: documentRef } });
  const frame = {
    hud: { chainLevel: 2 }, player: { position: { x: 0, y: 0, z: 0 } }, targets: []
  };
  const encounter = { enemies: [] };

  director.attach();
  director.resumeAudio();
  director.present({
    combatEvents: Array.from({ length: 10 }, (_, index) => ({
      contactId: `hit-${index}`, damage: 1, hp: 99 - index, tick: index, type: 'player-hit'
    })),
    encounter,
    frame,
    inBoss: false,
    inPursuit: false
  });
  documentRef.hidden = true;
  documentRef.dispatchEvent(new Event('visibilitychange'));
  const hidden = director.getDebugState();
  director.detach();
  director.dispose();

  assert.equal(hidden.audio.hidden, true);
  assert.equal(hidden.pool.active, 10);
  assert.equal(hidden.promptCount, 1);
  assert.equal(scene.children.length, 0);
  assert.equal(director.getDebugState().disposed, true);
});
