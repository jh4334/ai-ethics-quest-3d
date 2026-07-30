import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { MIXED_ARENA } from '../src/reboot/encounters/catalog.js';
import { createEncounter } from '../src/reboot/encounters/runtime.js';
import { createEnemyHpBars } from '../src/reboot/render/enemyHpBars.js';

test('Given a mixed encounter, When HP bars sync, Then fill scale follows hp/maxHp within a 2-plane budget', () => {
  // Given: 실제 1장 혼합 전투와 HP 바 모듈.
  const scene = new THREE.Scene();
  const encounter = createEncounter(MIXED_ARENA);
  const bars = createEnemyHpBars({ scene });

  // When: 이레이저만 절반 피해를 입은 권위 상태를 반영한다.
  bars.sync({
    ...encounter,
    enemies: encounter.enemies.map((enemy) => (
      enemy.definition.id === 'eraser'
        ? { ...enemy, hp: enemy.definition.stats.maxHp / 2 }
        : enemy
    ))
  });

  // Then: 채움 비율이 결정적이고 적당 평면은 2장뿐이며 라이트는 없다.
  const debug = bars.getDebugState();
  assert.deepEqual(debug.bars.map((bar) => [bar.id, bar.ratio]), [['eraser-mixed', 0.5], ['stamper-mixed', 1]]);
  assert.ok(debug.bars.every((bar) => bar.planeCount === 2 && bar.visible));
  let lights = 0;
  scene.traverse((object) => { if (object.isLight) lights += 1; });
  assert.equal(lights, 0);
  bars.dispose();
});

test('Given defeat and a camera, When synced and faced, Then bars hide on defeat and billboard to the camera', () => {
  // Given: 한 명이 격파된 전투와 회전된 카메라.
  const scene = new THREE.Scene();
  const encounter = createEncounter(MIXED_ARENA);
  const bars = createEnemyHpBars({ scene });
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.set(-0.4, 0.7, 0);
  camera.updateMatrixWorld();

  // When: 격파 상태를 반영하고 카메라를 향해 돌린다.
  bars.sync({
    ...encounter,
    enemies: encounter.enemies.map((enemy, index) => (
      index === 0 ? { ...enemy, hp: 0, phase: 'defeat' } : enemy
    ))
  });
  bars.face(camera);

  // Then: 격파된 바만 숨고 나머지는 카메라 쿼터니언을 그대로 복사한다.
  assert.deepEqual(bars.getDebugState().bars.map((bar) => bar.visible), [false, true]);
  const visibleBar = scene.getObjectByName('enemy-hp-bar-stamper-mixed');
  assert.ok(visibleBar.quaternion.equals(camera.quaternion));

  // When: 두 번 폐기해도 안전하고 장면에서 제거된다.
  bars.dispose();
  bars.dispose();
  assert.equal(bars.getDebugState().disposed, true);
  assert.equal(scene.getObjectByName('reboot-enemy-hp-bars'), undefined);
});
