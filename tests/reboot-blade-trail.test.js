import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createBladeTrail } from '../src/reboot/render/bladeTrail.js';

test('검격 트레일: 공격 방향으로 튕기고 수명이 다하면 풀로 돌아간다', () => {
  const scene = new THREE.Scene();
  const trail = createBladeTrail({ scene });

  // 발동: 플레이어 위치·방향으로 표시되고 활성 슬롯이 잡힌다.
  trail.trigger({ x: 2, y: 0, z: -5 }, { x: 0, y: 0, z: -1 }, 0);
  assert.equal(trail.getDebugState().active, 1);
  const mesh = scene.getObjectByName('blade-trail-0');
  assert.ok(mesh.visible);
  assert.equal(mesh.position.x, 2);
  assert.equal(mesh.position.z, -5);

  // 연타: 두 번째 슬롯 사용(풀 2개) — 세 번째는 가장 오래된 슬롯 재사용, 초과 할당 없음.
  trail.trigger({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1);
  assert.equal(trail.getDebugState().active, 2);
  trail.trigger({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 2);
  assert.equal(trail.getDebugState().active, 2);

  // 수명 경과 → 전부 비활성·비표시.
  trail.update(0.1);
  trail.update(0.1);
  assert.equal(trail.getDebugState().active, 0);
  assert.equal(mesh.visible, false);

  // 폐기: 장면에서 제거되고 재발동은 무시된다.
  trail.dispose();
  trail.trigger({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0);
  assert.equal(scene.getObjectByName('blade-trail-0'), undefined);
  assert.equal(trail.getDebugState().disposed, true);
});
