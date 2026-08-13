import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
  BROADCAST_ZONES,
  broadcastCheckpointForPhase,
  broadcastZoneReady,
  createBroadcastRouteState,
  restoreBroadcastRouteState,
  stepBroadcastRoute
} from '../src/reboot/campaign/broadcastRoute.js';
import { createBroadcastStationEnvironment } from '../src/reboot/render/broadcastStationEnvironment.js';

test('마지막 방송은 진입로·보호 릴레이·중계교·코어 네 공간을 각 프로토콜 동사에 연결한다', () => {
  assert.deepEqual(BROADCAST_ZONES.map(({ id }) => id), [
    'broadcast-entry', 'protection-relay', 'transmission-bridge', 'final-core'
  ]);
  assert.deepEqual(BROADCAST_ZONES.map(({ response }) => response), ['reflect', 'trace', 'dash', 'attack']);
  assert.equal(new Set(BROADCAST_ZONES.map(({ landmarkId }) => landmarkId)).size, 4);
});

test('플레이어는 현재 프로토콜 구역까지만 이동하고 해당 장치 가까이에서만 동사를 쓸 수 있다', () => {
  let route = createBroadcastRouteState();
  assert.equal(broadcastZoneReady(route, 0), true);
  route = stepBroadcastRoute(route, { delta: 12, horizontal: 0, vertical: -1 }, 0);
  assert.equal(route.position.y >= -10, true);
  assert.equal(broadcastZoneReady(route, 1), false);

  for (let index = 0; index < 20; index += 1) {
    route = stepBroadcastRoute(route, { delta: 0.25, horizontal: 0, vertical: -1 }, 1);
  }
  assert.equal(route.position.y < -10, true);
  route = { ...route, position: { x: 0, y: BROADCAST_ZONES[1].anchorZ } };
  assert.equal(broadcastZoneReady(route, 1), true);
});

test('방송 프로토콜 체크포인트는 재접속 뒤 현재 공간 위치를 복원한다', () => {
  for (let phaseIndex = 0; phaseIndex < BROADCAST_ZONES.length; phaseIndex += 1) {
    const checkpoint = broadcastCheckpointForPhase(phaseIndex);
    const restored = restoreBroadcastRouteState(checkpoint);
    assert.equal(restored.position.y, BROADCAST_ZONES[phaseIndex].spawnZ);
    assert.equal(restored.unlockedPhase, phaseIndex);
  }
  assert.equal(restoreBroadcastRouteState('chapter-6:broadcast-room').unlockedPhase, 0);
  assert.deepEqual(restoreBroadcastRouteState('chapter-6:broadcast-console'), {
    position: { x: 0, y: BROADCAST_ZONES.at(-1).spawnZ },
    unlockedPhase: 3
  });
});

test('마지막 방송 환경은 실제 에셋과 서로 다른 네 랜드마크를 구성하고 안전하게 폐기한다', async () => {
  let disposed = false;
  const assetLoader = {
    dispose() { disposed = true; },
    async load(id) {
      const root = new THREE.Group();
      root.name = id;
      root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.5, 8), new THREE.MeshBasicMaterial()));
      return { isPlaceholder: false, root };
    },
    async loadMaterial() {
      return { isPlaceholder: false, material: new THREE.MeshStandardMaterial({ color: 0x506078 }) };
    }
  };
  const scene = new THREE.Scene();
  const environment = createBroadcastStationEnvironment({ assetLoader, scene });
  const report = await environment.ready;

  assert.equal(report.placedInstances, 36);
  assert.deepEqual(report.failedAssetIds, []);
  assert.equal(environment.getDebugState().zoneCount, 4);
  assert.deepEqual(environment.getDebugState().landmarkIds, BROADCAST_ZONES.map(({ landmarkId }) => landmarkId));
  for (const landmarkId of environment.getDebugState().landmarkIds) {
    const landmark = scene.getObjectByName(landmarkId);
    assert.ok(landmark, `${landmarkId} 랜드마크가 필요합니다.`);
    assert.notEqual(landmark.geometry?.type, 'BoxGeometry');
  }

  environment.dispose();
  assert.equal(disposed, true);
  assert.equal(scene.getObjectByName('broadcast-station-environment'), undefined);
});
