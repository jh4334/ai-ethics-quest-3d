import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { chapterOneLevel } from '../src/reboot/content/levels/chapter1.js';
import { createSchoolAtmosphere } from '../src/reboot/render/schoolAtmosphere.js';

test('학교 분위기 드레싱: 결정적 인스턴스 수·예산 상한·폐기 계약', () => {
  const scene = new THREE.Scene();
  const atmosphere = createSchoolAtmosphere({ level: chapterOneLevel, scene });
  const debug = atmosphere.getDebugState();

  // 결정성: 같은 레벨이면 항상 같은 개수(무작위 0 — 교실 재현성).
  const again = createSchoolAtmosphere({ level: chapterOneLevel, scene: new THREE.Scene() });
  assert.deepEqual(again.getDebugState(), debug);
  again.dispose();

  // 존재: 타일·몰딩·창문·달빛 풀이 실제로 깔린다.
  assert.ok(debug.tileCount > 50, `체커 타일 ${debug.tileCount}`);
  assert.equal(debug.moldingCount, chapterOneLevel.layers.collision.length * 2);
  assert.ok(debug.windowCount > 10, `창문 ${debug.windowCount}`);
  assert.equal(debug.poolCount, debug.windowCount, '창문마다 달빛 풀 1개');

  // 예산: 인스턴스드 메시 4개 = 드로콜 +4뿐, 총 삼각형도 상한(150k) 대비 미미해야 한다.
  const meshes = [];
  scene.traverse((object) => { if (object.isInstancedMesh) meshes.push(object); });
  assert.equal(meshes.length, 4);
  const triangles = meshes.reduce((sum, mesh) => (
    sum + (mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3) * mesh.count
  ), 0);
  assert.ok(triangles < 10000, `분위기 삼각형 ${triangles} < 10k`);

  // 폐기: 장면에서 사라지고 두 번 폐기해도 안전.
  atmosphere.dispose();
  atmosphere.dispose();
  assert.equal(scene.getObjectByName('school-atmosphere'), undefined);
});
