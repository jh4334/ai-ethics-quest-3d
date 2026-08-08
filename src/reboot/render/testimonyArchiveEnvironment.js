import * as THREE from 'three';

import { TESTIMONY_ZONES } from '../campaign/testimonyArchive.js';
import { createEnvironmentAssetLoader } from '../environment/loader.js';
import {
  createCampusEdgeDressing, createCinematicNightSky,
  createEmissivePathAccents, createLayeredCampusSilhouettes
} from './campusEnvironmentLayers.js';
import { createDisposableRegistry } from './dispose.js';

const ASSET_PLACEMENTS = Object.freeze([
  ['classroom-desk', -3.2, 0, -5.4, 1, 0], ['classroom-desk', 3.2, 0, -5.4, 1, 0],
  ['classroom-chair', -3.2, 0, -3.9, 1, Math.PI], ['classroom-chair', 3.2, 0, -3.9, 1, Math.PI],
  ['classroom-screen', -2.4, 0.1, -5.2, 1.1, 0], ['classroom-screen', 2.4, 0.1, -5.2, 1.1, 0],
  ['campus-column', -5, 0, -12, 1.15, 0], ['campus-column', 5, 0, -12, 1.15, 0],
  ['classroom-screen', -3.8, 0.1, -24, 1.05, Math.PI / 2], ['classroom-screen', 3.8, 0.1, -24, 1.05, -Math.PI / 2],
  ['campus-column', -7, 0, -31, 1.25, 0], ['campus-column', 7, 0, -31, 1.25, 0],
  ['library-bookcase', -5.6, 0.05, -45, 1.25, Math.PI / 2], ['library-bookcase', 5.6, 0.05, -45, 1.25, -Math.PI / 2],
  ['library-bookcase', -5.6, 0.05, -51, 1.25, Math.PI / 2], ['library-bookcase', 5.6, 0.05, -51, 1.25, -Math.PI / 2],
  ['library-books', -4.8, 1.1, -45, 1.1, Math.PI / 2], ['library-books', 4.8, 1.1, -45, 1.1, -Math.PI / 2],
  ['campus-stairs', 0, 0, -59.5, 1.35, Math.PI],
  ['campus-column', -8.5, 0, -69, 1.45, 0], ['campus-column', 8.5, 0, -69, 1.45, 0],
  ['campus-doorway', 0, 0, -81.2, 1.65, 0],
  ['record-laptop', -3.2, 0.82, -5.4, 0.82, 0], ['record-laptop', 3.2, 0.82, -5.4, 0.82, 0],
  ['archive-box', -4.2, 0, -20.5, 1.15, 0.2], ['archive-box', 4.2, 0, -27.5, 1.15, -0.2],
  ['campus-sofa', 0, 0, -31, 1.15, Math.PI], ['campus-lamp', -5.5, 0, -24, 1.2, 0],
  ['campus-lamp', 5.5, 0, -48, 1.2, 0], ['campus-planter', -4.2, 0, -65, 1.3, 0],
  ['campus-planter', 4.2, 0, -74, 1.3, 0], ['campus-bench', 0, 0, -68, 1.2, Math.PI],
  ['broadcast-antenna', 0, 4.8, -77, 1.9, 0]
]);

function roundedShape(width, depth, radius) {
  const x = width / 2;
  const z = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z);
  shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  return shape;
}

function addMesh(group, geometry, material, name, x, y, z, rotationX = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(x, y, z);
  object.rotation.x = rotationX;
  object.castShadow = false;
  object.receiveShadow = false;
  group.add(object);
  return object;
}

function createArchitecture(resources) {
  const group = new THREE.Group();
  group.name = 'testimony-archive-architecture';
  const concrete = resources.register(new THREE.MeshStandardMaterial({ color: 0x52647d, roughness: 0.9 }), 'testimony-concrete');
  const metal = resources.register(new THREE.MeshStandardMaterial({
    color: 0x8da7c2, emissive: 0x0a1524, emissiveIntensity: 0.22, metalness: 0.46, roughness: 0.36
  }), 'testimony-metal');
  const glass = resources.register(new THREE.MeshStandardMaterial({
    color: 0x75c8dc, opacity: 0.3, roughness: 0.18, transparent: true, depthWrite: false
  }), 'testimony-glass');
  const amber = resources.register(new THREE.MeshStandardMaterial({
    color: 0xf2b762, emissive: 0x7a3512, emissiveIntensity: 0.65, metalness: 0.3, roughness: 0.42
  }), 'testimony-amber');
  const cyan = resources.register(new THREE.MeshStandardMaterial({
    color: 0x64ddc4, emissive: 0x155f56, emissiveIntensity: 0.72, metalness: 0.32, roughness: 0.38
  }), 'testimony-cyan');
  const archive = resources.register(new THREE.MeshStandardMaterial({
    color: 0x72523a, emissive: 0x24140b, emissiveIntensity: 0.24, roughness: 0.78
  }), 'testimony-archive-surface');

  const platforms = [
    [12, 16, -2, 2.5], [18, 24, -22, 3.5], [14, 24, -46, 3], [24, 26, -71, 4.5]
  ];
  for (const [index, [width, depth, z, radius]] of platforms.entries()) {
    const slab = resources.register(new THREE.ExtrudeGeometry(roundedShape(width, depth, radius), {
      bevelEnabled: true, bevelSegments: 2, bevelSize: 0.12, bevelThickness: 0.08, curveSegments: 5, depth: 0.28
    }), `testimony-platform-${index}`);
    slab.rotateX(-Math.PI / 2);
    addMesh(group, slab, concrete, `testimony-platform-${TESTIMONY_ZONES[index].id}`, 0, -0.28, z);
  }

  const intakeCore = resources.register(new THREE.CylinderGeometry(1.2, 1.6, 2.2, 12), 'testimony-intake-core');
  addMesh(group, intakeCore, metal, 'witness-source-terminal', 0, 1.1, -4.5);
  const intakeRing = resources.register(new THREE.TorusGeometry(2.3, 0.11, 8, 36), 'testimony-intake-ring');
  addMesh(group, intakeRing, cyan, 'witness-source-ring', 0, 1.25, -4.5, Math.PI / 2);

  const maskRing = resources.register(new THREE.TorusGeometry(3.5, 0.18, 10, 48), 'testimony-mask-ring');
  addMesh(group, maskRing, amber, 'consent-mask-table', 0, 0.28, -24, Math.PI / 2);
  const consentCanopy = resources.register(new THREE.CylinderGeometry(4.5, 4.5, 3.7, 16, 1, true), 'testimony-consent-canopy');
  addMesh(group, consentCanopy, glass, 'consent-redaction-canopy', 0, 2.1, -24);

  const crosscheckRings = resources.register(new THREE.TorusGeometry(2.8, 0.09, 8, 36), 'testimony-crosscheck-ring');
  for (const [index, y] of [0.7, 1.8, 2.9].entries()) {
    addMesh(group, crosscheckRings, index % 2 === 0 ? cyan : amber, `privacy-crosscheck-grid-${index}`, 0, y, -47, Math.PI / 2);
  }

  const vault = resources.register(new THREE.IcosahedronGeometry(1.8, 1), 'testimony-vault-core');
  addMesh(group, vault, cyan, 'verified-package-vault', 0, 3.1, -77);
  const vaultDoor = resources.register(new THREE.TorusGeometry(1.9, 0.14, 8, 32), 'testimony-vault-door');
  addMesh(group, vaultDoor, amber, 'verified-package-vault-door', 0, 3.1, -78);

  const archiveTower = resources.register(new THREE.CylinderGeometry(0.68, 1.05, 7.5, 8), 'testimony-archive-tower');
  const archiveCrown = new THREE.Group();
  archiveCrown.name = 'testimony-archive-crown';
  group.add(archiveCrown);
  for (let index = 0; index < 12; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const band = Math.floor(index / 2);
    addMesh(archiveCrown, archiveTower, archive, `testimony-vertical-stack-${index}`,
      side * (9.2 + (band % 2) * 1.5), 3.75 + (band % 3) * 1.2, -15 - band * 10.5);
  }
  const suspendedRing = resources.register(new THREE.TorusGeometry(2.35, 0.1, 8, 32), 'testimony-suspended-ring');
  for (const [index, z] of [-18, -38, -58, -74].entries()) {
    addMesh(archiveCrown, suspendedRing, index % 2 ? amber : cyan, `testimony-suspended-index-${index}`,
      index % 2 ? -5.4 : 5.4, 5.6 + (index % 2) * 1.2, z);
  }
  const recordShard = resources.register(new THREE.OctahedronGeometry(0.72, 0), 'testimony-record-shard');
  for (let index = 0; index < 8; index += 1) {
    addMesh(archiveCrown, recordShard, index % 2 ? amber : cyan, `testimony-record-shard-${index}`,
      (index % 2 ? 1 : -1) * (2.2 + (index % 3)), 2.2 + (index % 4) * 0.9, -40 - index * 4.2);
  }

  const beacons = TESTIMONY_ZONES.map((zone, index) => {
    const geometry = resources.register(new THREE.TorusGeometry(0.85, 0.07, 8, 28), `testimony-beacon-${index}`);
    const beacon = addMesh(group, geometry, index === 0 ? amber : cyan, `testimony-zone-beacon-${zone.id}`, 0, 0.12, zone.anchorZ, Math.PI / 2);
    beacon.visible = index === 0;
    return beacon;
  });
  return { archive, beacons, concrete, group, verticalArchiveMeshes: archiveCrown.children.length };
}

export function createTestimonyArchiveEnvironment({ assetLoader = createEnvironmentAssetLoader(), scene } = {}) {
  if (!scene?.isScene) throw new TypeError('증언 보관소 장면이 필요합니다.');
  const resources = createDisposableRegistry();
  const architecture = createArchitecture(resources);
  const group = new THREE.Group();
  group.name = 'testimony-archive-environment';
  group.add(architecture.group);
  scene.add(group);
  const atmosphere = createLayeredCampusSilhouettes({
    centerZ: -41, colors: [0x2c314b, 0x182b42, 0x10182c], group,
    prefix: 'testimony-archive', resources, spanZ: 82
  });
  const sky = createCinematicNightSky({
    accent: 0x64ddc4, centerZ: -41, group, prefix: 'testimony-archive', resources
  });
  const edgeDressing = createCampusEdgeDressing({
    accent: 0xf2b762, centerZ: -41, group, halfWidth: 12,
    prefix: 'testimony-archive', resources, spanZ: 88
  });
  const accents = createEmissivePathAccents({
    colors: [0xf2b762, 0x64ddc4], group,
    points: TESTIMONY_ZONES.flatMap((zone) => [-3.2, 0, 3.2].map((offset, index) => ({
      x: (index - 1) * 0.72, y: 0, z: zone.anchorZ + offset
    }))),
    prefix: 'testimony-archive', resources
  });
  const assetRoot = new THREE.Group();
  assetRoot.name = 'testimony-archive-glb-assets';
  group.add(assetRoot);
  let disposed = false;
  const failures = [];
  const assets = [...new Set(ASSET_PLACEMENTS.map(([id]) => id))];
  const assetPromise = Promise.all(assets.map(async (assetId) => {
    const loaded = await assetLoader.load(assetId);
    if (loaded.isPlaceholder) failures.push(assetId);
    if (disposed) return;
    for (const [index, entry] of ASSET_PLACEMENTS.filter(([id]) => id === assetId).entries()) {
      const [, x, y, z, scale, rotationY] = entry;
      const root = loaded.root.clone(true);
      root.name = `testimony-asset-${assetId}-${index}`;
      root.position.set(x, y, z);
      root.rotation.y = rotationY;
      root.scale.setScalar(scale);
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      assetRoot.add(root);
    }
  }));
  const materialPromise = Promise.all([
    ['structural-concrete', architecture.concrete], ['interior-wood', architecture.archive]
  ].map(async ([materialId, target]) => {
    const loaded = await assetLoader.loadMaterial(materialId);
    if (loaded.isPlaceholder) failures.push(materialId);
    if (disposed) return;
    architecture.group.traverse((object) => {
      if (object.isMesh && object.material === target) object.material = loaded.material;
    });
  }));
  const ready = Promise.all([assetPromise, materialPromise]).then(() => Object.freeze({
    failedAssetIds: Object.freeze([...failures]), placedInstances: ASSET_PLACEMENTS.length
  }));

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      resources.disposeAll();
      assetLoader.dispose();
    },
    getDebugState: () => Object.freeze({
      assetInstances: assetRoot.children.length,
      atmosphericLayers: atmosphere.layerCount,
      edgeDressingInstances: edgeDressing.postCount + edgeDressing.lanternCount
        + edgeDressing.shrubCount + edgeDressing.shardCount,
      emissiveAccents: accents.accentCount,
      failedAssetIds: Object.freeze([...failures]),
      landmarkIds: Object.freeze(TESTIMONY_ZONES.map(({ landmarkId }) => landmarkId)),
      pbrArchitectureMeshes: 16,
      skyObjects: sky.skyObjects,
      status: assetRoot.children.length > 0 ? 'ready' : 'loading',
      verticalArchiveMeshes: architecture.verticalArchiveMeshes,
      zoneCount: TESTIMONY_ZONES.length
    }),
    group,
    ready,
    setActiveZone(index) {
      architecture.beacons.forEach((beacon, beaconIndex) => { beacon.visible = beaconIndex === index; });
    }
  });
}
