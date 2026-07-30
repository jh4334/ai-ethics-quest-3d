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

  // 존재: 타일·몰딩·창문·달빛 풀·천장 보·벽가 수납장이 실제로 깔린다.
  assert.ok(debug.tileCount > 50, `체커 타일 ${debug.tileCount}`);
  assert.equal(debug.moldingCount, chapterOneLevel.layers.collision.length * 2);
  assert.ok(debug.windowCount > 10, `창문 ${debug.windowCount}`);
  assert.equal(debug.poolCount, debug.windowCount, '창문마다 달빛 풀 1개');
  assert.ok(debug.beamCount > 15, `천장 보 ${debug.beamCount}`);
  assert.ok(debug.cabinetCount > 20, `벽가 수납장 ${debug.cabinetCount}`);

  // 벽가 수납장은 통행 경계 inset(0.6) 안쪽 여유 공간에만 있다 — 수납장 안쪽 면이
  // 클램프 한계(벽에서 0.6)보다 벽 쪽(0.57)에 머물러 플레이어 이동을 막지 않는다.
  const cabinetMesh = scene.getObjectByName('atmosphere-wall-cabinets');
  assert.ok(cabinetMesh?.isInstancedMesh);
  const boundsBySegment = chapterOneLevel.layers.collision.map((entry) => entry.walkableBounds);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (let index = 0; index < cabinetMesh.count; index += 1) {
    cabinetMesh.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    const rect = boundsBySegment.find((entry) => position.z >= entry.minZ && position.z <= entry.maxZ);
    assert.ok(rect, `수납장 ${index}가 세그먼트 밖 z=${position.z}`);
    const wallGap = Math.min(position.x - rect.minX, rect.maxX - position.x);
    assert.ok(wallGap + 0.25 <= 0.6 + 1e-9, `수납장 ${index} 안쪽 면이 통행 경계를 침범 (${wallGap + 0.25})`);
  }

  // 예산: 인스턴스드 메시 6개 = 드로콜 +6뿐, 총 삼각형도 상한(150k) 대비 미미해야 한다.
  const meshes = [];
  scene.traverse((object) => { if (object.isInstancedMesh) meshes.push(object); });
  assert.equal(meshes.length, 6);
  const triangles = meshes.reduce((sum, mesh) => (
    sum + (mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3) * mesh.count
  ), 0);
  assert.ok(triangles < 10000, `분위기 삼각형 ${triangles} < 10k`);

  // 폐기: 장면에서 사라지고 두 번 폐기해도 안전.
  atmosphere.dispose();
  atmosphere.dispose();
  assert.equal(scene.getObjectByName('school-atmosphere'), undefined);
});
