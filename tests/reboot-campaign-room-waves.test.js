import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEncounterGameRuntime } from '../src/reboot/app/encounterGameRuntime.js';
import {
  ROOM_ENCOUNTER_ORIGIN, ROOM_ENTRY_GRACE_TICKS, ROOM_START_POSITION, ROOM_WAVES, advanceRoomWave,
  createRoomWaveProgress, getRoomWaveCount, getRoomWaveEncounter, isRoomWaveCleared, isSpatialWaveReady
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
        assert.equal(spawn.zoneId, definition.spatial.segmentId);
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

test('Given 전멸한 공간, When 요구 상호작용이 빠지면, Then 다음 구역 진행은 잠긴다', () => {
  // Given: 적은 모두 쓰러졌지만 윤리 동사는 아직 확인되지 않은 공간.
  const defeated = [{ phase: 'defeat' }];

  // When/Then: 전멸만으로는 잠기고, 권위 입력이 확인된 뒤에만 열린다.
  assert.equal(isSpatialWaveReady(defeated, false), false);
  assert.equal(isSpatialWaveReady(defeated, true), true);
  assert.equal(isSpatialWaveReady([{ phase: 'idle' }], true), false);
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
    const definition = getRoomWaveEncounter(2, 0);
    const runtime = createEncounterGameRuntime({
      deviceClass: 'desktop',
      encounterDefinition: definition,
      encounterOrigin: definition.spatial.encounterOrigin,
      extraTargets: [],
      startPosition: definition.spatial.startPosition
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

test('웨이브 스폰은 시작점에서 충분히 떨어져 있고 그레이스 동안 선제 피격이 없다', () => {
  // 스폰-시작점 거리 ≥ 10 — 진입·리스폰 직후 적이 바로 붙는 캠핑 데스루프를 막는 저작 규칙.
  for (const chapter of [2, 3, 4]) {
    for (let wave = 0; wave < 3; wave += 1) {
      const definition = getRoomWaveEncounter(chapter, wave);
      assert.equal(definition.zoneMode, 'room');
      assert.equal(definition.entryGraceTicks, ROOM_ENTRY_GRACE_TICKS);
      for (const spawnDef of definition.spawns) {
        const distance = Math.hypot(
          definition.spatial.encounterOrigin.x + spawnDef.position.x - definition.spatial.startPosition.x,
          definition.spatial.encounterOrigin.z + spawnDef.position.z - definition.spatial.startPosition.y
        );
        assert.ok(distance >= 10, `${spawnDef.id} 스폰이 시작점과 너무 가깝다: ${distance}`);
      }
    }
  }
  // 그레이스(90틱) + 여유 60틱 동안 제자리에 있어도 HP 100 유지, 적은 목표를 잡지 않는다.
  const firstWave = getRoomWaveEncounter(2, 0);
  const runtime = createEncounterGameRuntime({
    deviceClass: 'desktop',
    encounterDefinition: firstWave,
    encounterOrigin: firstWave.spatial.encounterOrigin,
    extraTargets: [],
    startPosition: firstWave.spatial.startPosition
  });
  advance(runtime, ROOM_ENTRY_GRACE_TICKS + 60);
  assert.equal(runtime.getState().combat.player.hp, 100);
  assert.equal(
    runtime.getState().encounter.enemies.every((enemy) => enemy.targetId === null),
    true
  );
  // 플레이어가 적 쪽으로 다가가면(획득 반경 안) 그제서야 교전이 열린다.
  for (let tick = 0; tick < 300; tick += 1) {
    const { combat, encounter } = runtime.getState();
    const enemy = encounter.enemies.find((entry) => entry.phase !== 'defeat');
    const dx = enemy.position.x - combat.player.position.x;
    const dz = enemy.position.z - combat.player.position.y;
    const distance = Math.hypot(dx, dz) || 1;
    if (distance < 4) break;
    runtime.update(1 / 60, { horizontal: dx / distance, vertical: dz / distance });
  }
  advance(runtime, 30);
  assert.equal(
    runtime.getState().encounter.enemies.some((enemy) => enemy.targetId === 'player'),
    true
  );
});

test('방 모드는 리시 존 경계로 적을 동결하지 않는다 — 경계 밖 무저항 처치 악용 방지', () => {
  // 원점(0,-23)에서 12유닛 밖(z=-35.5) — 구식 존 판정이면 플레이어가 route 존으로 갈려
  // 바로 옆의 적이 굳던 위치. 방 모드에서는 walkable 전체가 교전 구역이다.
  const runtime = createEncounterGameRuntime({
    deviceClass: 'desktop',
    encounterDefinition: getRoomWaveEncounter(2, 0),
    encounterOrigin: ROOM_ENCOUNTER_ORIGIN,
    extraTargets: [],
    startPosition: { x: 0, y: -35.5 }
  });
  advance(runtime, ROOM_ENTRY_GRACE_TICKS + 90);
  const { encounter } = runtime.getState();
  assert.equal(encounter.enemies.some((enemy) => enemy.targetId === 'player'), true);
  // 적이 실제로 플레이어 쪽(남쪽)으로 이동해 교전을 잇는다 — 동결이 아니다.
  const spawnZ = getRoomWaveEncounter(2, 0).spawns[0].position.z + ROOM_ENCOUNTER_ORIGIN.z;
  assert.ok(
    encounter.enemies[0].position.z < spawnZ,
    `적이 스폰(z=${spawnZ})에서 플레이어 쪽으로 움직여야 한다: z=${encounter.enemies[0].position.z}`
  );
});

test('적 방향 이동 유지 + 공격 반복이면 웨이브는 결정적으로 전멸한다', () => {
  // e2e 헬퍼(적 방향으로 이동 유지 + 동사 키 반복)와 같은 입력 패턴의 하한 검증.
  for (const chapter of [2, 3, 4]) {
    const definition = getRoomWaveEncounter(chapter, 0);
    const runtime = createEncounterGameRuntime({
      deviceClass: 'desktop',
      encounterDefinition: definition,
      encounterOrigin: definition.spatial.encounterOrigin,
      extraTargets: [],
      startPosition: definition.spatial.startPosition
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
