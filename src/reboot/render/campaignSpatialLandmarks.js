import * as THREE from 'three';

const MATERIALS = Object.freeze({
  amber: { color: 0xf3b36c, emissive: 0x6b3515, emissiveIntensity: 0.7, roughness: 0.72 },
  blue: { color: 0x6aa9ff, emissive: 0x173f75, emissiveIntensity: 0.8, roughness: 0.62 },
  cyan: { color: 0x5de0c1, emissive: 0x155c52, emissiveIntensity: 0.9, roughness: 0.6 },
  navy: { color: 0x17284b, emissive: 0x081126, emissiveIntensity: 0.35, roughness: 0.88 },
  red: { color: 0xd74732, emissive: 0x651b17, emissiveIntensity: 0.85, roughness: 0.68 }
});

const part = (shape, material, x, y, z, sx, sy, sz, yaw = 0) => (
  { material, shape, sx, sy, sz, x, y, yaw, z }
);

const RECIPES = Object.freeze({
  'media-plaza': ['media-kiosk-ring', [
    part('cylinder', 'amber', -4.5, 1, 0, 1.2, 2, 1.2),
    part('cylinder', 'amber', 4.5, 1, 0, 1.2, 2, 1.2),
    part('box', 'blue', 0, 2.6, -4, 6, 0.5, 0.5)
  ]],
  'edit-bays': ['edit-cutting-bays', [
    part('box', 'red', -5.5, 1.5, -3, 0.5, 3, 5),
    part('box', 'red', 3.5, 1.5, 1, 0.5, 3, 5),
    part('box', 'amber', -1, 0.12, -1, 7, 0.12, 0.35, -0.4)
  ]],
  'upload-trace': ['original-upload-trace', [
    part('box', 'cyan', 0, 0.08, 0, 0.3, 0.08, 12),
    part('cylinder', 'cyan', 0, 1.8, -4.5, 1.3, 3.6, 1.3),
    part('box', 'navy', -4.8, 1.1, 1.5, 1.8, 2.2, 3.5),
    part('box', 'navy', 4.8, 1.1, 1.5, 1.8, 2.2, 3.5)
  ]],
  'broadcast-stage': ['copycat-broadcast-rig', [
    part('box', 'blue', 0, 0.25, -5, 10, 0.5, 4),
    part('box', 'red', -6, 2.5, -5, 0.6, 5, 0.6),
    part('box', 'red', 6, 2.5, -5, 0.6, 5, 0.6),
    part('box', 'amber', 0, 4.7, -5, 12.6, 0.5, 0.5)
  ]],
  'split-foyer': ['split-school-gate', [
    part('box', 'amber', -3.8, 1.8, -1, 3.2, 3.6, 0.5),
    part('box', 'cyan', 3.8, 1.8, -1, 3.2, 3.6, 0.5),
    part('box', 'blue', 0, 0.08, 1, 0.2, 0.08, 10)
  ]],
  'warm-incomplete': ['warm-missing-desk-arc', [
    part('cylinder', 'amber', -4.8, 0.55, -2.5, 1.2, 1.1, 1.2),
    part('cylinder', 'amber', -1.8, 0.55, -4, 1.2, 1.1, 1.2),
    part('cylinder', 'amber', 1.5, 0.55, -3.5, 1.2, 1.1, 1.2),
    part('box', 'red', 5, 0.05, -2, 2, 0.08, 2)
  ]],
  'cold-verified': ['verified-record-grid', [
    part('box', 'cyan', -4.5, 1.1, -3.5, 1.5, 2.2, 1.5),
    part('box', 'cyan', 0, 1.1, -3.5, 1.5, 2.2, 1.5),
    part('box', 'cyan', 4.5, 1.1, -3.5, 1.5, 2.2, 1.5),
    part('box', 'blue', 0, 0.08, 1, 9, 0.08, 0.2)
  ]],
  'deletion-archive': ['dot-deletion-gap', [
    part('box', 'navy', -5.5, 2, -4, 2, 4, 2),
    part('box', 'navy', 5.5, 2, -4, 2, 4, 2),
    part('box', 'red', 0, 3.8, -4, 9, 0.4, 0.4),
    part('box', 'cyan', 0, 0.08, -1, 0.35, 0.08, 9)
  ]],
  'approval-intake': ['approval-intake-stacks', [
    part('box', 'red', -4.5, 0.35, -2, 3, 0.7, 2),
    part('box', 'red', 4.5, 0.7, -2, 3, 1.4, 2),
    part('box', 'amber', 0, 1.2, -4.5, 4, 2.4, 0.5)
  ]],
  'conveyor-scoring': ['three-second-conveyor', [
    part('box', 'red', 0, 0.3, -1, 3, 0.5, 13),
    part('cylinder', 'amber', -1.7, 0.55, -5, 0.5, 3.8, 0.5, Math.PI / 2),
    part('cylinder', 'amber', 1.7, 0.55, 3, 0.5, 3.8, 0.5, Math.PI / 2),
    part('box', 'navy', 5.5, 2, -4, 2.8, 4, 0.6)
  ]],
  'approval-trace': ['approval-command-gates', [
    part('box', 'cyan', -4, 2, -4, 0.5, 4, 0.5),
    part('box', 'cyan', 4, 2, -4, 0.5, 4, 0.5),
    part('box', 'cyan', 0, 3.8, -4, 8.5, 0.4, 0.5),
    part('box', 'amber', 0, 0.08, 0, 0.3, 0.08, 10)
  ]],
  'emergency-archive': ['emergency-open-aisle', [
    part('box', 'navy', -6, 1.6, -2, 2, 3.2, 8),
    part('box', 'navy', 6, 1.6, -2, 2, 3.2, 8),
    part('box', 'blue', 0, 0.08, -2, 3, 0.08, 12),
    part('box', 'red', 0, 2.8, -7, 7, 0.5, 0.5)
  ]]
});

function geometryFor(shape) {
  return shape === 'cylinder'
    ? new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
    : new THREE.BoxGeometry(1, 1, 1);
}

export function createCampaignSpatialLandmarks({ level, scene }) {
  if (!level || !scene?.add) throw new TypeError('캠페인 공간 랜드마크에는 레벨과 장면이 필요합니다.');
  const root = new THREE.Group();
  root.name = `campaign-spatial-landmarks-${level.id}`;
  const zones = [];
  const batches = new Map();

  for (const segment of level.segments) {
    const recipe = RECIPES[segment.geometryId];
    if (!recipe) throw new RangeError(`알 수 없는 캠페인 공간 기하입니다: ${segment.geometryId}`);
    const [landmarkId, parts] = recipe;
    zones.push(Object.freeze({
      geometryId: segment.geometryId, interactionId: segment.interactionId, landmarkId,
      partCount: parts.length, segmentId: segment.id
    }));
    for (const entry of parts) {
      const key = `${entry.shape}:${entry.material}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push({
        ...entry, x: segment.anchor.x + entry.x, y: level.planeY + entry.y, z: segment.anchor.z + entry.z
      });
    }
  }

  const geometries = new Map();
  const materials = new Map();
  for (const [key, entries] of batches) {
    const [shape, materialId] = key.split(':');
    if (!geometries.has(shape)) geometries.set(shape, geometryFor(shape));
    if (!materials.has(materialId)) {
      materials.set(materialId, new THREE.MeshStandardMaterial(MATERIALS[materialId]));
    }
    const mesh = new THREE.InstancedMesh(geometries.get(shape), materials.get(materialId), entries.length);
    mesh.name = `campaign-spatial-batch-${key}`;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    for (const [index, entry] of entries.entries()) {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.yaw);
      matrix.compose(
        new THREE.Vector3(entry.x, entry.y, entry.z), rotation,
        new THREE.Vector3(entry.sx, entry.sy, entry.sz)
      );
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }

  scene.add(root);
  const instanceCount = [...batches.values()].reduce((total, entries) => total + entries.length, 0);
  const budget = Object.freeze({
    drawCalls: batches.size, instances: instanceCount,
    resources: geometries.size + materials.size
  });
  let disposed = false;

  return Object.freeze({
    dispose() {
      if (disposed) return 0;
      disposed = true;
      root.removeFromParent();
      for (const geometry of geometries.values()) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      return budget.resources;
    },
    getDebugState: () => Object.freeze({ budget, disposed, zones: Object.freeze(zones) }),
    root
  });
}
