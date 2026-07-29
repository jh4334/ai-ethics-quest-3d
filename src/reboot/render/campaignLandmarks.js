import * as THREE from 'three';

const PALETTES = Object.freeze({
  amber: Object.freeze({ color: 0xf3b36c, emissive: 0x6b3515 }),
  blue: Object.freeze({ color: 0x6aa9ff, emissive: 0x173f75 }),
  cyan: Object.freeze({ color: 0x5de0c1, emissive: 0x155c52 }),
  neutral: Object.freeze({ color: 0x8795ad, emissive: 0x202a3d }),
  red: Object.freeze({ color: 0xd74732, emissive: 0x651b17 }),
  violet: Object.freeze({ color: 0xb58ad9, emissive: 0x45265f })
});

const DEFINITIONS = Object.freeze({
  'share-chain': Object.freeze([
    { id: 'share-source-trace', palette: 'cyan', shape: 'box', instances: [
      [0, 0.12, -26, 0.32, 0.12, 8], [0, 2.2, -30, 3.2, 3.8, 0.5]
    ] },
    { id: 'share-copy-chain', palette: 'amber', shape: 'cylinder', instances: [
      [-5.2, 0.8, -25, 0.9, 1.6, 0.9], [0, 0.8, -27, 0.9, 1.6, 0.9], [5.2, 0.8, -25, 0.9, 1.6, 0.9]
    ] },
    { id: 'share-copy-chain', palette: 'amber', shape: 'box', instances: [
      [-2.6, 0.22, -26, 5.6, 0.16, 0.22, -0.36], [2.6, 0.22, -26, 5.6, 0.16, 0.22, 0.36]
    ] },
    { id: 'share-clone-output', palette: 'red', shape: 'box', instances: [
      [-6.2, 2, -29, 2.4, 4, 0.45], [6.2, 2, -29, 2.4, 4, 0.45],
      [-6.2, 3.8, -27.8, 2.4, 0.35, 2.4], [6.2, 3.8, -27.8, 2.4, 0.35, 2.4]
    ] }
  ]),
  'dual-school': Object.freeze([
    { id: 'dual-comfort-school', palette: 'violet', shape: 'box', instances: [
      [-5.6, 1.8, -29, 4.8, 3.6, 0.5], [-7.4, 1.2, -25, 0.45, 2.4, 7]
    ] },
    { id: 'dual-verified-school', palette: 'cyan', shape: 'box', instances: [
      [5.6, 1.8, -29, 4.8, 3.6, 0.5], [7.4, 1.2, -25, 0.45, 2.4, 7]
    ] },
    { id: 'dual-unequal-records', palette: 'amber', shape: 'box', instances: [
      [-5.4, 0.35, -21, 2.2, 0.3, 1.4], [-5.4, 0.75, -21, 1.8, 0.3, 1.2],
      [-5.4, 1.15, -21, 1.4, 0.3, 1], [5.4, 0.35, -21, 1.2, 0.3, 1]
    ] },
    { id: 'dual-layer-divider', palette: 'blue', shape: 'box', instances: [
      [0, 0.1, -25, 0.18, 0.12, 13], [0, 2.1, -30, 0.28, 4.2, 0.5]
    ] }
  ]),
  'approval-room': Object.freeze([
    { id: 'approval-dossier-queue', palette: 'amber', shape: 'box', instances: [
      [-5.8, 0.25, -20, 2.2, 0.35, 1.4], [-5.8, 0.65, -22, 2, 0.35, 1.3],
      [-5.8, 1.05, -24, 1.8, 0.35, 1.2], [-5.8, 1.45, -26, 1.6, 0.35, 1.1]
    ] },
    { id: 'approval-conveyor', palette: 'red', shape: 'box', instances: [
      [0, 0.22, -25, 2.4, 0.3, 11], [0, 1.25, -30, 6.8, 0.45, 0.55]
    ] },
    { id: 'approval-yoonseo-terminal', palette: 'violet', shape: 'box', instances: [
      [5.6, 1.3, -23.5, 2.6, 2.6, 0.7], [5.6, 0.45, -22.5, 3.2, 0.55, 2.2]
    ] },
    { id: 'approval-review-gate', palette: 'cyan', shape: 'box', instances: [
      [-3.6, 2.1, -29, 0.55, 4.2, 0.55], [3.6, 2.1, -29, 0.55, 4.2, 0.55],
      [0, 4, -29, 7.6, 0.5, 0.55]
    ] }
  ]),
  finale: Object.freeze([
    { id: 'finale-haru-stage', palette: 'amber', shape: 'box', instances: [[-4.3, 0.18, -68, 2.6, 0.35, 3]] },
    { id: 'finale-dot-stage', palette: 'cyan', shape: 'box', instances: [[-1.4, 0.18, -70, 2.2, 0.35, 2.6]] },
    { id: 'finale-lumen-stage', palette: 'violet', shape: 'box', instances: [[2.2, 0.18, -70, 2.8, 0.35, 3]] },
    { id: 'finale-broadcast-booth', palette: 'blue', shape: 'box', instances: [
      [0, 2.5, -75, 13, 5, 0.55], [-6.2, 1.5, -72.5, 0.45, 3, 5], [6.2, 1.5, -72.5, 0.45, 3, 5]
    ] },
    { id: 'finale-evidence-beam', palette: 'cyan', shape: 'box', instances: [[0, 0.1, -66, 0.28, 0.12, 11]] },
    { id: 'finale-public-feed', palette: 'neutral', shape: 'box', instances: [[0, 3.2, -74.6, 2.8, 1.8, 0.3]] }
  ])
});

const FINALE_VARIANTS = Object.freeze({
  purge: Object.freeze([{ id: 'finale-public-feed-purge', palette: 'red', shape: 'box', instances: [
    [-4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [0, 3.2, -74.25, 0.35, 2.2, 0.35]
  ] }]),
  secure: Object.freeze([{ id: 'finale-public-feed-secure', palette: 'cyan', shape: 'box', instances: [
    [-4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [0, 4.6, -74.4, 5.2, 0.22, 0.35]
  ] }])
});

function freezeBudget(groups, geometries, materials) {
  let instances = 0;
  let triangles = 0;
  for (const { geometry, count } of groups.values()) {
    instances += count;
    triangles += count * (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3);
  }
  return Object.freeze({ drawCalls: groups.size, instances, resources: geometries.size + materials.size, triangles });
}

export function createCampaignLandmarks({ scene, type, variant = 'default' }) {
  if (!DEFINITIONS[type]) throw new RangeError(`등록되지 않은 캠페인 랜드마크: ${type}`);
  const resolvedVariant = type === 'finale' ? variant : 'default';
  if (type === 'finale' && !FINALE_VARIANTS[resolvedVariant]) throw new RangeError(`등록되지 않은 피날레 변형: ${variant}`);
  const records = [...DEFINITIONS[type], ...(type === 'finale' ? FINALE_VARIANTS[resolvedVariant] : [])];
  const root = new THREE.Group();
  root.name = `campaign-landmarks-${type}`;
  const geometries = new Map();
  const materials = new Map();
  const groups = new Map();
  const dummy = new THREE.Object3D();

  for (const record of records) {
    const geometry = geometries.get(record.shape) ?? (record.shape === 'cylinder'
      ? new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
      : new THREE.BoxGeometry(1, 1, 1));
    geometries.set(record.shape, geometry);
    const palette = PALETTES[record.palette];
    const material = materials.get(record.palette) ?? new THREE.MeshStandardMaterial({
      color: palette.color, emissive: palette.emissive, emissiveIntensity: 0.7, roughness: 0.72
    });
    materials.set(record.palette, material);
    const key = `${record.shape}:${record.palette}`;
    const group = groups.get(key) ?? { geometry, material, records: [], count: 0 };
    group.records.push(record);
    group.count += record.instances.length;
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    const mesh = new THREE.InstancedMesh(group.geometry, group.material, group.count);
    mesh.name = `campaign-landmark-batch-${key}`;
    let index = 0;
    for (const record of group.records) for (const [x, y, z, sx, sy, sz, rotationY = 0] of record.instances) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }
  scene.add(root);
  const budget = freezeBudget(groups, geometries, materials);
  const landmarkIds = Object.freeze([...new Set(records.map(({ id }) => id))]);
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
    getDebugState: () => Object.freeze({ budget, disposed, landmarkIds, type, variant: resolvedVariant }),
    root
  });
}
