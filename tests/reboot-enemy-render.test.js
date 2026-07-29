import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { MIXED_ARENA } from '../src/reboot/encounters/catalog.js';
import { createEncounter } from '../src/reboot/encounters/runtime.js';

const unavailable = () => {
  throw new Error('Task 6 enemy renderer is not implemented');
};

const enemyRender = await import('../src/reboot/render/enemyCast.js').catch(() => ({}));
const { createEnemyCast = unavailable, enemyAnimationState = unavailable } = enemyRender;

function createFakeFactory() {
  const created = [];
  const updates = new Map();
  let disposed = 0;
  return {
    created,
    get disposed() { return disposed; },
    updates,
    async create(profileId) {
      const root = new THREE.Group();
      root.name = `fake-${profileId}`;
      const character = {
        dispose() { root.removeFromParent(); },
        id: profileId,
        root,
        update(delta, state) { updates.set(profileId, { delta, state }); }
      };
      created.push(character);
      return character;
    },
    dispose() { disposed += 1; }
  };
}

test('Given a mixed encounter, When the enemy cast loads, Then each spawn uses its CC0 roster profile', async () => {
  // Given: 실제 적 정의와 가벼운 캐릭터 팩토리 대역이 있다.
  const scene = new THREE.Scene();
  const factory = createFakeFactory();
  const encounter = createEncounter(MIXED_ARENA);
  const cast = createEnemyCast({ characterFactory: factory, scene });

  // When: 혼합 전투의 적 캐릭터를 로드한다.
  await cast.load(encounter);

  // Then: 이레이저와 스탬퍼 프로필이 한 번씩 로드되고 장면에 배치된다.
  assert.deepEqual(factory.created.map((character) => character.id), ['eraser', 'stamper']);
  assert.deepEqual(cast.getDebugState().ids, ['eraser-mixed', 'stamper-mixed']);
  assert.equal(cast.getDebugState().loaded, 2);
  assert.equal(scene.getObjectByName('reboot-enemy-cast') !== undefined, true);
  cast.dispose();
});

test('Given authoritative enemy states, When presented, Then pose and animation flags follow the simulation', async () => {
  // Given: 로드된 혼합 전투 적 캐스트가 있다.
  const scene = new THREE.Scene();
  const factory = createFakeFactory();
  const encounter = createEncounter(MIXED_ARENA);
  const cast = createEnemyCast({ characterFactory: factory, scene });
  await cast.load(encounter);
  const enemies = encounter.enemies.map((enemy, index) => ({
    ...enemy,
    facing: index === 0 ? Math.PI / 2 : Math.PI,
    phase: index === 0 ? 'windup' : 'stagger',
    position: { x: index + 3, z: index - 4 }
  }));

  // When: 권위 상태를 표시하고 한 프레임 갱신한다.
  cast.present({ ...encounter, enemies }, [{ enemyId: 'eraser-mixed', type: 'armor-broken' }]);
  cast.update(1 / 60);

  // Then: 위치·회전·공격/피격 애니메이션 플래그가 결정적으로 대응한다.
  const debug = cast.getDebugState();
  assert.deepEqual(debug.enemies[0].position, [3, 0, -4]);
  assert.equal(debug.enemies[0].facing, Math.PI / 2);
  assert.equal(debug.enemies[0].cueId, 'armor-broken');
  assert.deepEqual(factory.updates.get('eraser').state, { acting: true, defeated: false, hit: false, moving: false });
  assert.deepEqual(factory.updates.get('stamper').state, { acting: false, defeated: false, hit: true, moving: false });
  cast.dispose();
});

test('Given every enemy phase, When mapped for animation, Then terminal and locomotion states are explicit', () => {
  // Given: 런타임이 만들 수 있는 모든 적 페이즈가 있다.
  const phases = ['idle', 'acquire', 'reposition', 'windup', 'active', 'recover', 'interrupt', 'stagger', 'defeat'];

  // When: 각 페이즈를 애니메이션 상태로 변환한다.
  const states = phases.map((phase) => enemyAnimationState(phase));

  // Then: 이동·행동·피격·패배가 서로 겹치지 않는다.
  assert.deepEqual(states, [
    { acting: false, defeated: false, hit: false, moving: false },
    { acting: false, defeated: false, hit: false, moving: true },
    { acting: false, defeated: false, hit: false, moving: true },
    { acting: true, defeated: false, hit: false, moving: false },
    { acting: true, defeated: false, hit: false, moving: false },
    { acting: true, defeated: false, hit: false, moving: false },
    { acting: false, defeated: false, hit: true, moving: false },
    { acting: false, defeated: false, hit: true, moving: false },
    { acting: false, defeated: true, hit: false, moving: false }
  ]);
});

test('Given a loaded cast, When reset and dispose repeat, Then state and resources remain bounded', async () => {
  // Given: 위치와 피드백이 바뀐 적 캐스트가 있다.
  const scene = new THREE.Scene();
  const factory = createFakeFactory();
  const encounter = createEncounter(MIXED_ARENA);
  const cast = createEnemyCast({ characterFactory: factory, scene });
  await cast.load(encounter);
  cast.present({
    ...encounter,
    enemies: encounter.enemies.map((enemy) => ({ ...enemy, position: { x: 99, z: 99 } }))
  }, [{ cueId: 'enemy-staggered', enemyId: 'stamper-mixed' }]);

  // When: 같은 작성 상태로 재설정하고 두 번 폐기한다.
  cast.reset(encounter);
  cast.dispose();
  cast.dispose();

  // Then: 스폰 위치가 복구되고 팩토리와 장면 자원은 한 번만 정리된다.
  const debug = cast.getDebugState();
  assert.deepEqual(
    debug.enemies.map((enemy) => enemy.position),
    encounter.enemies.map((enemy) => [enemy.position.x, 0, enemy.position.z])
  );
  assert.deepEqual(debug.enemies.map((enemy) => enemy.cueId), [null, null]);
  assert.equal(debug.disposed, true);
  // 주입된(공유) 팩토리는 캐스트가 폐기하지 않는다 — 소유자(장면)의 몫.
  assert.equal(factory.disposed, 0);
  assert.equal(scene.getObjectByName('reboot-enemy-cast'), undefined);
});
