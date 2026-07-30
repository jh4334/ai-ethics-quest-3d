import * as THREE from 'three';

import { validateLevel } from '../level/validateLevel.js';
import { createDisposableRegistry } from './dispose.js';
import { createSchoolRouteDressing } from './schoolRouteDressing.js';

const ROUTE_COLORS = Object.freeze({
  checkpoint: 0x5de0c1,
  cue: 0xf1c979,
  floor: 0x17284b,
  visual: 0x9fc4ff,
  wall: 0x111b35
});

// 1장 복도 백화 — 게시물 패널이 복도 안쪽으로 갈수록 하얗게 '지워지는 중'(시나리오 v2 S2 계약).
// 인스턴스 색만 바꾼다: 신규 라이트·렌더타깃 0, 드로콜 +1.
const NOTICE_FADE = Object.freeze({
  baseColor: 0xc7b394, // 붙어 있는 게시물 종이 톤
  fadedColor: 0xf8f8f4, // 지워진 백지 톤
  panelsPerSide: 6
});

function buildNoticePanels(level, collision) {
  const panels = [];
  for (const visual of level.layers.visual) {
    if (visual.kind !== 'corridor') continue;
    const bounds = collision.find((entry) => entry.segmentId === visual.segmentId).walkableBounds;
    const depth = bounds.maxZ - bounds.minZ;
    for (let index = 0; index < NOTICE_FADE.panelsPerSide; index += 1) {
      const progress = index / (NOTICE_FADE.panelsPerSide - 1); // 0=입구, 1=가장 깊은 곳
      const whiten = progress <= 0.5 ? 0 : (progress - 0.5) * 2; // 뒤쪽 절반만 점점 백화
      const z = bounds.maxZ - (index + 0.5) * (depth / NOTICE_FADE.panelsPerSide);
      for (const side of [-1, 1]) {
        panels.push({
          id: `notice-${visual.segmentId}-${side === -1 ? 'left' : 'right'}-${index}`,
          position: { x: side === -1 ? bounds.minX + 0.18 : bounds.maxX - 0.18, y: level.planeY + 2.75, z },
          scale: { x: 0.08, y: 0.9, z: 1.35 },
          whiten
        });
      }
    }
  }
  return panels;
}

function centerOf(bounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2
  };
}

function addBoxes(group, geometry, material, role, boxes) {
  const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
  const matrix = new THREE.Matrix4();
  boxes.forEach((box, index) => {
    matrix.compose(
      new THREE.Vector3(box.position.x, box.position.y, box.position.z),
      new THREE.Quaternion(),
      new THREE.Vector3(box.scale.x, box.scale.y, box.scale.z)
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = `school-route-${role}`;
  mesh.userData.routeRole = role;
  mesh.userData.sourceIds = boxes.map((box) => box.id);
  group.add(mesh);
  return mesh;
}

function toCollider(entry) {
  return Object.freeze({
    bounds: Object.freeze({ ...entry.walkableBounds }),
    id: entry.id,
    segmentId: entry.segmentId,
    surface: 'flat'
  });
}

export function createSchoolRoute({ level, lightLimit = Number.POSITIVE_INFINITY, scene }) {
  if (!scene || typeof scene.add !== 'function') {
    throw new TypeError('학교 경로를 추가할 Three.js 장면이 필요합니다.');
  }
  const validation = validateLevel(level);
  if (validation.errors.length > 0) {
    const codes = validation.errors.map((entry) => entry.code).join(', ');
    throw new RangeError(`학교 경로 데이터가 올바르지 않습니다: ${codes}`);
  }

  const resources = createDisposableRegistry();
  const group = new THREE.Group();
  group.name = 'chapter-one-school-route';
  const geometry = resources.register(new THREE.BoxGeometry(1, 1, 1), 'route-box-geometry');
  const makeMaterial = (id, parameters) => resources.register(
    new THREE.MeshStandardMaterial(parameters),
    id
  );
  const floorMaterial = makeMaterial('route-floor-material', { color: ROUTE_COLORS.floor, roughness: 0.88 });
  const wallMaterial = makeMaterial('route-wall-material', { color: ROUTE_COLORS.wall, roughness: 0.92 });
  const visualMaterial = makeMaterial('route-visual-material', {
    color: ROUTE_COLORS.visual,
    emissive: 0x274f89,
    emissiveIntensity: 1.1,
    roughness: 0.55
  });
  const cueMaterial = makeMaterial('route-cue-material', {
    color: ROUTE_COLORS.cue,
    emissive: 0x6b4919,
    emissiveIntensity: 0.7,
    roughness: 0.7
  });
  const checkpointMaterial = makeMaterial('route-checkpoint-material', {
    color: ROUTE_COLORS.checkpoint,
    emissive: 0x164f46,
    emissiveIntensity: 0.65,
    roughness: 0.75
  });

  const collision = level.layers.collision;
  const floorBoxes = collision.map((entry) => {
    const center = centerOf(entry.walkableBounds);
    return {
      id: entry.id,
      position: { x: center.x, y: level.planeY - 0.08, z: center.z },
      scale: {
        x: entry.walkableBounds.maxX - entry.walkableBounds.minX,
        y: 0.16,
        z: entry.walkableBounds.maxZ - entry.walkableBounds.minZ
      }
    };
  });
  const wallBoxes = collision.flatMap((entry) => {
    const bounds = entry.walkableBounds;
    const center = centerOf(bounds);
    const depth = bounds.maxZ - bounds.minZ;
    return [bounds.minX - 0.14, bounds.maxX + 0.14].map((x, side) => ({
      id: `${entry.id}:wall-${side === 0 ? 'left' : 'right'}`,
      position: { x, y: level.planeY + 1.8, z: center.z },
      scale: { x: 0.28, y: 3.6, z: depth }
    }));
  });
  // 경로 양 끝 마감벽 — 끝 세그먼트 너머의 검은 허공이 화면에 드러나지 않게 닫는다.
  // 같은 인스턴스드 메시에 들어가므로 드로콜 증가 0, 통행 경계(끝 inset 0.6)와도 겹치지 않는다.
  const routeStart = collision.reduce((best, entry) => (
    entry.walkableBounds.maxZ > best.walkableBounds.maxZ ? entry : best
  ));
  const routeEnd = collision.reduce((best, entry) => (
    entry.walkableBounds.minZ < best.walkableBounds.minZ ? entry : best
  ));
  for (const [entry, z, cap] of [
    [routeStart, routeStart.walkableBounds.maxZ + 0.14, 'north'],
    [routeEnd, routeEnd.walkableBounds.minZ - 0.14, 'south']
  ]) {
    const bounds = entry.walkableBounds;
    wallBoxes.push({
      id: `${entry.id}:wall-${cap}-cap`,
      position: { x: (bounds.minX + bounds.maxX) / 2, y: level.planeY + 1.8, z },
      scale: { x: bounds.maxX - bounds.minX + 0.56, y: 3.6, z: 0.28 }
    });
  }
  const visualBySegment = new Map(level.layers.visual.map((entry) => [entry.segmentId, entry]));
  const lightBySegment = new Map(level.layers.localLight.map((entry) => [entry.segmentId, entry]));
  const visualBoxes = level.segments.map((segment) => {
    const visual = visualBySegment.get(segment.id);
    const light = lightBySegment.get(segment.id);
    return {
      id: visual.id,
      position: { ...light.position },
      scale: { x: 1.2, y: 0.14, z: 0.5 }
    };
  });
  const cueBoxes = level.segments.map((segment) => {
    const bounds = collision.find((entry) => entry.segmentId === segment.id).walkableBounds;
    return {
      id: `route-cue-${segment.id}`,
      position: { x: segment.anchor.x, y: level.planeY + 0.03, z: bounds.minZ + 1.2 },
      scale: { x: 0.65, y: 0.06, z: 1.25 }
    };
  });
  const checkpointBoxes = level.layers.checkpoint.map((entry) => ({
    id: entry.id,
    position: { x: entry.spawn.x, y: level.planeY + 0.015, z: entry.spawn.z },
    scale: { x: 1.1, y: 0.03, z: 1.1 }
  }));

  addBoxes(group, geometry, floorMaterial, 'walkable', floorBoxes);
  addBoxes(group, geometry, wallMaterial, 'occluder', wallBoxes);
  addBoxes(group, geometry, visualMaterial, 'visual', visualBoxes);
  addBoxes(group, geometry, cueMaterial, 'route-cue', cueBoxes);
  addBoxes(group, geometry, checkpointMaterial, 'checkpoint', checkpointBoxes);

  // 게시물 패널(복도 세그먼트에만) — 인스턴스 색으로 백화 그라데이션을 칠한다.
  const noticePanels = buildNoticePanels(level, collision);
  let noticeMesh = null;
  if (noticePanels.length > 0) {
    const noticeMaterial = makeMaterial('route-notice-material', {
      color: 0xffffff, emissive: 0x232b3f, emissiveIntensity: 0.55, roughness: 0.82
    });
    noticeMesh = new THREE.InstancedMesh(geometry, noticeMaterial, noticePanels.length);
    const matrix = new THREE.Matrix4();
    const baseColor = new THREE.Color(NOTICE_FADE.baseColor);
    const fadedColor = new THREE.Color(NOTICE_FADE.fadedColor);
    const paint = new THREE.Color();
    noticePanels.forEach((panel, index) => {
      matrix.compose(
        new THREE.Vector3(panel.position.x, panel.position.y, panel.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(panel.scale.x, panel.scale.y, panel.scale.z)
      );
      noticeMesh.setMatrixAt(index, matrix);
      paint.copy(baseColor).lerp(fadedColor, panel.whiten);
      noticeMesh.setColorAt(index, paint);
    });
    noticeMesh.instanceMatrix.needsUpdate = true;
    noticeMesh.instanceColor.needsUpdate = true;
    noticeMesh.name = 'school-route-notice-fade';
    noticeMesh.userData.routeRole = 'notice-fade';
    noticeMesh.userData.sourceIds = noticePanels.map((panel) => panel.id);
    group.add(noticeMesh);
  }
  const dressing = createSchoolRouteDressing({ level });
  group.add(dressing.group);

  const renderedLights = level.layers.localLight.slice(0, Math.max(0, lightLimit));
  for (const entry of renderedLights) {
    const light = new THREE.PointLight(entry.color, 1.35, 10, 2);
    light.position.set(entry.position.x, entry.position.y, entry.position.z);
    light.castShadow = false;
    light.name = entry.id;
    light.userData = { segmentId: entry.segmentId, sourceId: entry.id, visualId: entry.visualId };
    group.add(light);
  }

  const colliders = Object.freeze(collision.map(toCollider));
  const occluders = Object.freeze(wallBoxes.map((wall) => Object.freeze({
    bounds: Object.freeze({
      maxX: wall.position.x + wall.scale.x / 2,
      maxY: wall.position.y + wall.scale.y / 2,
      maxZ: wall.position.z + wall.scale.z / 2,
      minX: wall.position.x - wall.scale.x / 2,
      minY: wall.position.y - wall.scale.y / 2,
      minZ: wall.position.z - wall.scale.z / 2
    }),
    id: wall.id
  })));
  const routeCues = Object.freeze(level.segments.map((segment, index) => Object.freeze({
    fromSegmentId: segment.id,
    id: cueBoxes[index].id,
    kind: segment.exits[0].kind,
    position: Object.freeze({ ...cueBoxes[index].position }),
    to: segment.exits[0].to
  })));
  const checkpoints = Object.freeze(level.layers.checkpoint.map((entry) => Object.freeze({
    id: entry.id,
    position: Object.freeze({ ...entry.spawn }),
    segmentId: entry.segmentId
  })));
  const visuals = Object.freeze(level.layers.visual.map((entry) => Object.freeze({ ...entry })));
  const localLights = Object.freeze(level.layers.localLight.map((entry) => Object.freeze({
    ...entry,
    position: Object.freeze({ ...entry.position })
  })));
  const baseTriangleCount = geometry.index.count / 3
    * (floorBoxes.length + wallBoxes.length + visualBoxes.length + cueBoxes.length
      + checkpointBoxes.length + noticePanels.length);
  const dressingDebug = dressing.getDebugState();
  const budget = Object.freeze({
    drawCalls: 5 + (noticeMesh ? 1 : 0) + dressingDebug.budget.drawCalls,
    dressing: dressingDebug.budget,
    resources: resources.size() + dressingDebug.budget.resources,
    triangles: baseTriangleCount + dressingDebug.budget.triangles
  });
  // 백화 서사 계약 — 패널 수·백화 정도를 관측 가능하게(결정성 검증용, 가변값 없음).
  const noticeFade = Object.freeze({
    panelCount: noticePanels.length,
    panels: Object.freeze(noticePanels.map((panel) => Object.freeze({
      id: panel.id, whiten: panel.whiten, z: panel.position.z
    }))),
    whitenedCount: noticePanels.filter((panel) => panel.whiten > 0).length
  });
  let disposed = false;
  scene.add(group);

  return Object.freeze({
    colliders,
    dispose() {
      if (disposed) return 0;
      disposed = true;
      group.removeFromParent();
      const dressingCount = dressing.dispose();
      group.clear();
      return dressingCount + resources.disposeAll();
    },
    getDebugState() {
      return Object.freeze({
        budget,
        checkpointIds: checkpoints.map((entry) => entry.id),
        checkpoints,
        colliderIds: colliders.map((entry) => entry.id),
        colliders,
        disposed,
        encounterIds: level.layers.encounter.map((entry) => entry.id),
        localLightIds: localLights.map((entry) => entry.id),
        localLights,
        landmarksBySegment: dressingDebug.landmarksBySegment,
        noticeFade,
        renderedLightIds: renderedLights.map((entry) => entry.id),
        navigationIds: level.layers.navigation.map((entry) => entry.id),
        occluders,
        routeCues,
        segmentIds: level.segments.map((entry) => entry.id),
        visualIds: visuals.map((entry) => entry.id),
        visuals
      });
    },
    group,
    occluders,
    routeCues
  });
}
