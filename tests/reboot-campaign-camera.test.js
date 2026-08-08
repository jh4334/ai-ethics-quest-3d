import assert from 'node:assert/strict';
import test from 'node:test';

import { campaignCameraFrame } from '../src/reboot/render/campaignSceneCamera.js';

test('2~4장은 같은 추종 카메라를 재사용하지 않고 장별 공간 정체성을 가진다', () => {
  const player = { x: 2, y: -24 };
  const desktop = [2, 3, 4].map((chapter) => campaignCameraFrame(chapter, player, false));

  assert.equal(new Set(desktop.map((frame) => JSON.stringify(frame))).size, 3);
  assert.deepEqual(desktop.map(({ identity }) => identity), [
    'media-plaza-shoulder', 'dual-school-split', 'approval-axis'
  ]);
  assert.equal(desktop.every(({ fov }) => fov >= 42 && fov <= 50), true);
});

test('세로 카메라는 플레이어를 따라가면서 장별 시선과 안전 구도를 유지한다', () => {
  const player = { x: -3, y: -46 };
  const portrait = [2, 3, 4].map((chapter) => campaignCameraFrame(chapter, player, true));

  assert.equal(portrait.every(({ fov, position }) => fov >= 56 && position.y >= 7), true);
  assert.equal(new Set(portrait.map(({ lookAt, position }) => JSON.stringify({ lookAt, position }))).size, 3);
});
