import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEncounterGameRuntime } from '../src/reboot/app/encounterGameRuntime.js';
import {
  ROOM_ENCOUNTER_ORIGIN, ROOM_START_POSITION, ROOM_WAVES, advanceRoomWave, createRoomWaveProgress,
  getRoomWaveCount, getRoomWaveEncounter, isRoomWaveCleared
} from '../src/reboot/campaign/roomWaves.js';
import { ENEMY_DEFINITIONS } from '../src/reboot/content/enemies/catalog.js';
import { createEncounter } from '../src/reboot/encounters/runtime.js';

function advance(runtime, ticks) {
  let result = null;
  for (let tick = 0; tick < ticks; tick += 1) result = runtime.update(1 / 60);
  return result;
}

test('2~4장은 각각 3웨이브를 저작 상수로 정의하고 스폰 정의는 적 카탈로그와 일치한다', () => {
  assert.deepEqual(Object.keys(ROOM_WAVES).map(Number), [2, 3, 4]);
  for (const chapter of [2, 3, 4]) {
    assert.equal(getRoomWaveCount(chapter), 3);
    const ids = new Set();
    for (let wave = 0; wave < 3; wave += 1) {
      const definition = getRoomWaveEncounter(chapter, wave);
      assert.equal(typeof definition.id, 'string');
      assert.ok(definition.spawns.length >= 1);
      for (const spawn of definition.spawns) {
        assert.ok(ENEMY_DEFINITIONS[spawn.definitionId], `${spawn.definitionId}는 적 카탈로그에 있어야 한다`);
        assert.equal(spawn.zoneId, 'arena');
        assert.equal(Number.isFinite(spawn.position.x) && Number.isFinite(spawn.position.z), true);
        assert.equal(ids.has(spawn.id), false, `스폰 ID ${spawn.id}는 장 안에서 유일해야 한다`);
        ids.add(spawn.id);
      }
    }
  }
});

test('장별 웨이브 구성 — 2장 복제자 1·1·2, 3장 추천자 1·1·2, 4장 승인관 중심 1·2·2', () => {
  const composition = (chapter) => [0, 1, 2].map((wave) => (
    getRoomWaveEncounter(chapter, wave).spawns.map((spawn) => spawn.definitionId)
  ));
  assert.deepEqual(composition(2), [['copycat'], ['copycat'], ['copycat', 'copycat']]);
  assert.deepEqual(composition(3), [['recommender'], ['recommender'], ['recommender', 'recommender']]);
  assert.deepEqual(composition(4), [['approval'], ['approval', 'copycat'], ['approval', 'approval']]);
  // 4장 승인관은 반사로만 깨지는 방패를 갖는다 — 동사(REFLECT)를 적 메커니즘이 요구한다.
  assert.equal(ENEMY_DEFINITIONS.approval.armor.breaksOnKinds.includes('reflected-projectile'), true);
});

test('웨이브 진행은 전멸→전진으로만 흐르고 마지막 전진이 결정 단계를 연다', () => {
  let progress = createRoomWaveProgress(2);
  assert.deepEqual(progress, { chapter: 2, finished: false, total: 3, waveIndex: 0 });
  progress = advanceRoomWave(progress);
  progress = advanceRoomWave(progress);
  assert.equal(progress.finished, false);
  progress = advanceRoomWave(progress);
  assert.deepEqual(progress, { chapter: 2, finished: true, total: 3, waveIndex: 3 });
  assert.throws(() => advanceRoomWave(progress), /결정 단계/);
  assert.throws(() => createRoomWaveProgress(5), /2장부터 4장/);
  assert.throws(() => getRoomWaveEncounter(2, 3), /웨이브/);
});

test('전멸 판정은 권위 상태의 phase만 보고 빈 배열을 전멸로 치지 않는다', () => {
  assert.equal(isRoomWaveCleared([]), false);
  assert.equal(isRoomWaveCleared([{ phase: 'defeat' }, { phase: 'idle' }]), false);
  assert.equal(isRoomWaveCleared([{ phase: 'defeat' }, { phase: 'defeat' }]), true);
  assert.equal(isRoomWaveCleared(null), false);
});

test('웨이브 정의는 encounter 런타임에 그대로 꽂히고 같은 호출은 같은 동결 객체를 돌려준다', () => {
  for (const chapter of [2, 3, 4]) {
    for (let wave = 0; wave < 3; wave += 1) {
      const definition = getRoomWaveEncounter(chapter, wave);
      assert.equal(Object.isFrozen(definition), true);
      assert.equal(definition, getRoomWaveEncounter(chapter, wave));
      const encounter = createEncounter(definition);
      for (const enemy of encounter.enemies) {
        assert.equal(enemy.hp, enemy.definition.stats.maxHp);
        assert.equal(enemy.phase, 'idle');
      }
    }
  }
});

test('방 원점·시작 위치로 심은 웨이브 전투는 같은 입력에서 같은 60Hz 결과를 만든다', () => {
  const play = () => {
    const runtime = createEncounterGameRuntime({
      deviceClass: 'desktop',
      encounterDefinition: getRoomWaveEncounter(2, 0),
      encounterOrigin: ROOM_ENCOUNTER_ORIGIN,
      extraTargets: [],
      startPosition: ROOM_START_POSITION
    });
    advance(runtime, 30);
    runtime.queueAction('attack');
    advance(runtime, 60);
    runtime.queueAction('attack');
    advance(runtime, 120);
    return runtime.getState();
  };
  assert.deepEqual(play(), play());
});

test('시작 위치의 플레이어는 리시 반경 안에 있고 웨이브 적은 접근해 교전을 시작한다', () => {
  const distance = Math.hypot(
    ROOM_START_POSITION.x - ROOM_ENCOUNTER_ORIGIN.x,
    ROOM_START_POSITION.y - ROOM_ENCOUNTER_ORIGIN.z
  );
  assert.ok(distance < 12, '플레이어 시작점은 전투 리시 반경(12) 안이어야 한다');
  const runtime = createEncounterGameRuntime({
    deviceClass: 'desktop',
    encounterDefinition: getRoomWaveEncounter(2, 0),
    encounterOrigin: ROOM_ENCOUNTER_ORIGIN,
    extraTargets: [],
    startPosition: ROOM_START_POSITION
  });
  advance(runtime, 12);
  assert.equal(
    runtime.getState().encounter.enemies.some((enemy) => enemy.targetId === 'player'),
    true
  );
});

test('적 방향 이동 유지 + 공격 반복이면 웨이브는 결정적으로 전멸한다', () => {
  // e2e 헬퍼(적 방향으로 이동 유지 + 동사 키 반복)와 같은 입력 패턴의 하한 검증.
  for (const chapter of [2, 3, 4]) {
    const runtime = createEncounterGameRuntime({
      deviceClass: 'desktop',
      encounterDefinition: getRoomWaveEncounter(chapter, 0),
      encounterOrigin: ROOM_ENCOUNTER_ORIGIN,
      extraTargets: [],
      startPosition: ROOM_START_POSITION
    });
    for (let tick = 0; tick < 3600; tick += 1) {
      const { combat, encounter } = runtime.getState();
      const enemy = encounter.enemies.find((entry) => entry.phase !== 'defeat');
      if (!enemy) break;
      if (tick % 12 === 0) runtime.queueAction('attack');
      const dx = enemy.position.x - combat.player.position.x;
      const dz = enemy.position.z - combat.player.position.y;
      const distance = Math.hypot(dx, dz) || 1;
      // 적이 칼날 사거리 밖이면 그쪽으로 걷고, 붙었으면 제자리에서 공격만 잇는다.
      const movement = distance > 1.2
        ? { horizontal: dx / distance, vertical: dz / distance }
        : {};
      runtime.update(1 / 60, movement);
    }
    assert.equal(
      isRoomWaveCleared(runtime.getState().encounter.enemies),
      true,
      `${chapter}장 1웨이브는 이동+공격 입력으로 전멸해야 한다`
    );
  }
});

test('방 웨이브·장면 어댑터 소스는 결정성 규칙(Math.random 금지)을 지킨다', () => {
  const sources = [
    '../src/reboot/campaign/roomWaves.js',
    '../src/reboot/render/campaignChapterScene.js'
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.equal(/Math\.random/.test(sources), false);
});
