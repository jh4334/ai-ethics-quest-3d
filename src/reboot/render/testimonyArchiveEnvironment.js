import * as THREE from 'three';

import { TESTIMONY_ZONES } from '../campaign/testimonyArchive.js';
import { createEnvironmentAssetLoader } from '../environment/loader.js';
import { createDisposableRegistry } from './dispose.js';

const ASSET_PLACEMENTS = Object.freeze([
  ['classroom-screen', -2.4, 0.1, -5.2, 1.1, 0], ['classroom-screen', 2.4, 0.1, -5.2, 1.1, 0],
  ['campus-column', -5, 0, -12, 1.15, 0], ['campus-column', 5, 0, -12, 1.15, 0],
  ['classroom-screen', -3.8, 0.1, -24, 1.05, Math.PI / 2], ['classroom-screen', 3.8, 0.1, -24, 1.05, -Math.PI / 2],
  ['campus-column', -7, 0, -31, 1.25, 0], ['campus-column', 7, 0, -31, 1.25, 0],
  ['library-bookcase', -5.6, 0.05, -45, 1.25, Math.PI / 2], ['library-bookcase', 5.6, 0.05, -45, 1.25, -Math.PI / 2],
  ['library-bookcase', -5.6, 0.05, -51, 1.25, Math.PI / 2], ['library-bookcase', 5.6, 0.05, -51, 1.25, -Math.PI / 2],
  ['library-books', -4.8, 1.1, -45, 1.1, Math.PI / 2], ['library-books', 4.8, 1.1, -45, 1.1, -Math.PI / 2],
  ['campus-stairs', 0, 0, -59.5, 1.35, Math.PI],
  ['campus-column', -8.5, 0, -69, 1.45, 0], ['campus-column', 8.5, 0, -69, 1.45, 0],
  ['campus-doorway', 0, 0, -81.2, 1.65, 0]
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
  const metal = resources.register(new THREE.MeshStandardMaterial({ color: 0x7891aa, metalness: 0.76, roughness: 0.28 }), 'testimony-metal');
  const glass = resources.register(new THREE.MeshStandardMaterial({
    color: 0x75c8dc, opacity: 0.3, roughness: 0.18, transparent: true, depthWrite: false
  }), 'testimony-glass');
  const amber = resources.register(new THREE.MeshStandardMaterial({
    color: 0xf2b762, emissive: 0x7a3512, emissiveIntensity: 0.65, metalness: 0.3, roughness: 0.42
  }), 'testimony-amber');
  const cyan = resources.register(new THREE.MeshStandardMaterial({
    color: 0x64ddc4, emissive: 0x155f56, emissiveIntensity: 0.72, metalness: 0.32, roughness: 0.38
  }), 'testimony-cyan');

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

  const vault = resources.register(new THREE.CylinderGeometry(6.4, 7.5, 5.5, 18, 1, true), 'testimony-vault-shell');
  addMesh(group, vault, metal, 'verified-package-vault', 0, 2.75, -74);
  const vaultDoor = resources.register(new THREE.TorusGeometry(3, 0.38, 12, 48), 'testimony-vault-door');
  addMesh(group, vaultDoor, amber, 'verified-package-vault-door', 0, 3, -68.2);

  const beacons = TESTIMONY_ZONES.map((zone, index) => {
    const geometry = resources.register(new THREE.TorusGeometry(0.85, 0.07, 8, 28), `testimony-beacon-${index}`);
    const beacon = addMesh(group, geometry, index === 0 ? amber : cyan, `testimony-zone-beacon-${zone.id}`, 0, 0.12, zone.anchorZ, Math.PI / 2);
    beacon.visible = index === 0;
    return beacon;
  });
  return { beacons, concrete, group };
}

export function createTestimonyArchiveEnvironment({ assetLoader = createEnvironmentAssetLoader(), scene } = {}) {
  if (!scene?.isScene) throw new TypeError('증언 보관소 장면이 필요합니다.');
  const resources = createDisposableRegistry();
  const architecture = createArchitecture(resources);
  const group = new THREE.Group();
  group.name = 'testimony-archive-environment';
  group.add(architecture.group);
  scene.add(group);
  const assetRoot = new THREE.Group();
  assetRoot.name = 'testimony-archive-glb-assets';
  group.add(assetRoot);
  let disposed = false;
  const failures = [];
  const assets = [...new Set(ASSET_PLACEMENTS.map(([id]) => id))];
  const ready = Promise.all(assets.map(async (assetId) => {
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
  })).then(() => Object.freeze({ failedAssetIds: Object.freeze([...failures]), placedInstances: ASSET_PLACEMENTS.length }));

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
      failedAssetIds: Object.freeze([...failures]),
      landmarkIds: Object.freeze(TESTIMONY_ZONES.map(({ landmarkId }) => landmarkId)),
      status: assetRoot.children.length > 0 ? 'ready' : 'loading',
      zoneCount: TESTIMONY_ZONES.length
    }),
    group,
    ready,
    setActiveZone(index) {
      architecture.beacons.forEach((beacon, beaconIndex) => { beacon.visible = beaconIndex === index; });
    }
  });
}
