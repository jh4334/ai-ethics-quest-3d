import * as THREE from 'three';

import { createDisposableRegistry } from './dispose.js';

// 학교의 밤 분위기 — 무지 박스 지형을 '복도'로 읽히게 하는 결정적 드레싱.
// 체커 바닥 타일 + 벽 킥라인 몰딩 + 창문·달빛 풀 + 천장 보 + 벽가 수납장.
// 전부 InstancedMesh/고정표 — 무작위 0, 추가 라이트 0, 드로콜 +6 이내(저사양 예산 준수).
const TILE = 2; // 타일 한 변(유닛)
const WINDOW_SPACING = 4.6; // 창문 간격(z)
const BEAM_SPACING = 5.2; // 천장 보 간격(z) — 창문과 어긋나게 두어 리듬이 겹치지 않는다
const CABINET_SPACING = 3.4; // 벽가 수납장 간격(z)
// 이미 벽면 가구가 저작된 세그먼트(복도 사물함·추격 게이트)는 수납장을 겹쳐 놓지 않는다.
const CABINET_SKIP_KINDS = new Set(['corridor', 'pursuit']);

function segmentRects(level) {
  return level.layers.collision.map((entry) => entry.walkableBounds);
}

function checkerCells(rects, planeY) {
  const cells = [];
  for (const rect of rects) {
    const cols = Math.floor((rect.maxX - rect.minX) / TILE);
    const rows = Math.floor((rect.maxZ - rect.minZ) / TILE);
    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        if ((col + row) % 2 !== 0) continue; // 체커 — 절반만 밝은 타일
        cells.push({
          x: rect.minX + (col + 0.5) * TILE,
          y: planeY + 0.012,
          z: rect.minZ + (row + 0.5) * TILE
        });
      }
    }
  }
  return cells;
}

function windowSpots(rects, planeY) {
  const spots = [];
  for (const rect of rects) {
    const depth = rect.maxZ - rect.minZ;
    const count = Math.floor(depth / WINDOW_SPACING);
    for (let index = 0; index < count; index += 1) {
      const z = rect.minZ + (index + 0.5) * WINDOW_SPACING;
      for (const side of [-1, 1]) {
        spots.push({
          poolX: (side === -1 ? rect.minX : rect.maxX) + side * -1.1,
          wallX: side === -1 ? rect.minX + 0.02 : rect.maxX - 0.02,
          side,
          y: planeY,
          z
        });
      }
    }
  }
  return spots;
}

// 천장 보 — 낮은 모바일 카메라(수평에 가까운 시야)에서 화면 상단을 채우는 가로 구조물.
function beamSpots(rects, planeY) {
  const spots = [];
  for (const rect of rects) {
    const depth = rect.maxZ - rect.minZ;
    const count = Math.floor(depth / BEAM_SPACING);
    for (let index = 0; index < count; index += 1) {
      spots.push({
        width: rect.maxX - rect.minX + 0.28,
        x: (rect.minX + rect.maxX) / 2,
        y: planeY + 3.35,
        z: rect.minZ + (index + 0.5) * BEAM_SPACING
      });
    }
  }
  return spots;
}

// 벽가 수납장 줄 — 통행 경계 inset(0.6) 안쪽 여유 공간에만 놓여 이동을 막지 않는다.
// (수납장 두께 0.5, 벽에서 0.07~0.57 사이 — 플레이어 클램프 한계 0.6보다 벽 쪽이다.)
function cabinetSpots(level, planeY) {
  const kindBySegment = new Map(level.layers.visual.map((entry) => [entry.segmentId, entry.kind]));
  const spots = [];
  for (const entry of level.layers.collision) {
    if (CABINET_SKIP_KINDS.has(kindBySegment.get(entry.segmentId))) continue;
    const rect = entry.walkableBounds;
    const depth = rect.maxZ - rect.minZ;
    const count = Math.floor(depth / CABINET_SPACING);
    for (let index = 0; index < count; index += 1) {
      const z = rect.minZ + (index + 0.5) * CABINET_SPACING;
      for (const side of [-1, 1]) {
        spots.push({
          x: side === -1 ? rect.minX + 0.32 : rect.maxX - 0.32,
          y: planeY + 0.81,
          z
        });
      }
    }
  }
  return spots;
}

function fillInstances(mesh, place) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < mesh.count; index += 1) {
    place(index, position, quaternion, scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function createSchoolAtmosphere({ level, scene }) {
  if (!scene?.isScene) throw new TypeError('학교 분위기 드레싱에는 Three.js Scene이 필요합니다.');
  const resources = createDisposableRegistry();
  const group = new THREE.Group();
  group.name = 'school-atmosphere';
  const rects = segmentRects(level);
  const planeY = level.planeY ?? 0;
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

  // ① 체커 바닥 타일 — 두 톤 바닥이 '실내 복도'의 첫 인상을 만든다.
  const cells = checkerCells(rects, planeY);
  const tileGeometry = resources.register(new THREE.PlaneGeometry(TILE - 0.14, TILE - 0.14), 'tile-geometry');
  const tileMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x2a4070, emissive: 0x0e1c3c, emissiveIntensity: 0.4, roughness: 0.85
  }), 'tile-material');
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, cells.length);
  tiles.name = 'atmosphere-floor-tiles';
  fillInstances(tiles, (index, position, quaternion) => {
    const cell = cells[index];
    position.set(cell.x, cell.y, cell.z);
    quaternion.copy(flat);
  });
  group.add(tiles);

  // ② 벽 킥라인 몰딩 — 세그먼트마다 양쪽 벽 아래 시안 라인(복도의 눈높이 기준선).
  const moldingGeometry = resources.register(new THREE.BoxGeometry(1, 1, 1), 'molding-geometry');
  const moldingMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x58d8c0, emissive: 0x0c514a, emissiveIntensity: 0.55, roughness: 0.6
  }), 'molding-material');
  const molding = new THREE.InstancedMesh(moldingGeometry, moldingMaterial, rects.length * 2);
  molding.name = 'atmosphere-wall-molding';
  fillInstances(molding, (index, position, quaternion, scale) => {
    const rect = rects[Math.floor(index / 2)];
    const side = index % 2 === 0 ? -1 : 1;
    const depth = rect.maxZ - rect.minZ;
    position.set(side === -1 ? rect.minX + 0.05 : rect.maxX - 0.05, planeY + 0.55, (rect.minZ + rect.maxZ) / 2);
    quaternion.identity();
    scale.set(0.08, 0.1, Math.max(0.5, depth - 0.6));
  });
  group.add(molding);

  // ③ 창문 + 달빛 풀 — 밤 학교의 광원 서사(코드 라이트 0, 발광 재질만).
  const spots = windowSpots(rects, planeY);
  const windowGeometry = resources.register(new THREE.PlaneGeometry(0.95, 1.35), 'window-geometry');
  const windowMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x8fb8ef, emissive: 0x2b5cae, emissiveIntensity: 1.05, roughness: 0.4, side: THREE.DoubleSide
  }), 'window-material');
  const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, spots.length);
  windows.name = 'atmosphere-windows';
  const upright = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  fillInstances(windows, (index, position, quaternion) => {
    const spot = spots[index];
    position.set(spot.wallX, spot.y + 2.35, spot.z);
    quaternion.copy(upright);
  });
  group.add(windows);

  const poolGeometry = resources.register(new THREE.PlaneGeometry(1.7, 2.5), 'pool-geometry');
  const poolMaterial = resources.register(new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending, color: 0x33569c, depthWrite: false, opacity: 0.16, transparent: true
  }), 'pool-material');
  const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, spots.length);
  pools.name = 'atmosphere-moon-pools';
  fillInstances(pools, (index, position, quaternion) => {
    const spot = spots[index];
    position.set(spot.poolX, spot.y + 0.02, spot.z);
    quaternion.copy(flat);
  });
  group.add(pools);

  // ④ 천장 보 — 세그먼트 폭을 가로지르는 어두운 남색 보. 낮은 카메라에서 '실내 천장'을 만든다.
  const beams = beamSpots(rects, planeY);
  const beamMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x1c2c50, emissive: 0x0a1430, emissiveIntensity: 0.4, roughness: 0.88
  }), 'beam-material');
  const beamMesh = new THREE.InstancedMesh(moldingGeometry, beamMaterial, beams.length);
  beamMesh.name = 'atmosphere-ceiling-beams';
  fillInstances(beamMesh, (index, position, quaternion, scale) => {
    const beam = beams[index];
    position.set(beam.x, beam.y, beam.z);
    quaternion.identity();
    scale.set(beam.width, 0.18, 0.34);
  });
  group.add(beamMesh);

  // ⑤ 벽가 수납장 줄 — 교실·아레나·기억·체육관 구간의 벽을 따라 낮은 가구 실루엣을 세운다.
  const cabinets = cabinetSpots(level, planeY);
  const cabinetMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x2c3f66, emissive: 0x101c38, emissiveIntensity: 0.38, roughness: 0.82
  }), 'cabinet-material');
  const cabinetMesh = new THREE.InstancedMesh(moldingGeometry, cabinetMaterial, cabinets.length);
  cabinetMesh.name = 'atmosphere-wall-cabinets';
  fillInstances(cabinetMesh, (index, position, quaternion, scale) => {
    const cabinet = cabinets[index];
    position.set(cabinet.x, cabinet.y, cabinet.z);
    quaternion.identity();
    scale.set(0.5, 1.62, 1.6);
  });
  group.add(cabinetMesh);

  scene.add(group);
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of [tiles, molding, windows, pools, beamMesh, cabinetMesh]) mesh.dispose();
      group.removeFromParent();
      resources.disposeAll();
    },
    getDebugState() {
      return Object.freeze({
        beamCount: beamMesh.count,
        cabinetCount: cabinetMesh.count,
        disposed,
        moldingCount: molding.count,
        poolCount: pools.count,
        tileCount: tiles.count,
        windowCount: windows.count
      });
    }
  });
}
