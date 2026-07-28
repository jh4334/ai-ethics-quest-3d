import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createBossFixture } from '../src/reboot/bosses/fixtures.js';
import { createBossCast } from '../src/reboot/render/bossCast.js';

function fakeFactory() {
  let disposed = 0;
  return {
    async create(id) {
      assert.equal(id, 'attendance-proctor');
      return { dispose() {}, root: new THREE.Group(), update() {} };
    },
    dispose() { disposed += 1; },
    get disposed() { return disposed; }
  };
}

test('출석 감독관은 수입 캐릭터와 페이즈별 텔레그래프를 사용한다', async () => {
  const scene = new THREE.Scene();
  const factory = fakeFactory();
  const cast = createBossCast({ characterFactory: factory, scene });
  await cast.load();
  cast.present(createBossFixture('phase-2-window'), [{ type: 'boss-attack-window' }]);

  const debug = cast.getDebugState();
  assert.equal(debug.loaded, true);
  assert.equal(debug.phaseId, 'trace-roster');
  assert.equal(debug.cue, 'boss-attack-window');
  assert.ok(scene.getObjectByName('boss-telegraph-ring'));
});

test('보스 캐스트는 반복 폐기에도 자원을 한 번만 정리한다', async () => {
  const scene = new THREE.Scene();
  const factory = fakeFactory();
  const cast = createBossCast({ characterFactory: factory, scene });
  await cast.load();
  cast.dispose();
  cast.dispose();

  assert.equal(factory.disposed, 1);
  assert.equal(scene.getObjectByName('attendance-proctor-cast'), undefined);
});
