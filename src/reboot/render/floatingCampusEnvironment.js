import * as THREE from 'three';

import {
  CAMPUS_ASSET_PLACEMENTS, CAMPUS_DISTRICTS, CAMPUS_REQUIRED_ASSET_IDS
} from '../content/campus/chapterOneCampus.js';
import { createEnvironmentAssetLoader } from '../environment/loader.js';
import { createCampusArchitecture } from './campusArchitecture.js';
import { createCampusBackdrop } from './campusBackdrop.js';

const PBR_MATERIAL_BINDINGS = Object.freeze({
  brick: 'masonry-brick',
  concrete: 'structural-concrete',
  track: 'road-asphalt',
  wood: 'interior-wood'
});

function applyPlacement(root, entry, index) {
  root.name = `campus-asset-${entry.assetId}-${index}`;
  root.position.set(entry.position.x, entry.position.y, entry.position.z);
  root.rotation.y = entry.rotationY;
  root.scale.setScalar(entry.scale);
  root.userData.campusAssetId = entry.assetId;
  root.userData.campusDistrictId = entry.districtId;
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

function createDistrictBeacons(group) {
  const geometry = new THREE.TorusGeometry(0.72, 0.065, 6, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0xf0c878,
    opacity: 0.72,
    transparent: true,
    depthWrite: false
  });
  const beacons = [];
  for (const [index, district] of CAMPUS_DISTRICTS.entries()) {
    const ring = new THREE.Mesh(geometry, material);
    ring.name = `campus-objective-beacon-${district.id}`;
    ring.position.set(district.center.x, 2.9 + (index % 2) * 0.35, district.center.z);
    ring.rotation.x = Math.PI / 2;
    ring.userData.campusDistrictId = district.id;
    group.add(ring);
    beacons.push(ring);
  }
  return Object.freeze({
    beacons,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  });
}

function createCampusLights(group) {
  const moon = new THREE.DirectionalLight(0xa9c7ff, 1.45);
  moon.name = 'campus-moon-key';
  moon.position.set(-14, 22, 8);
  moon.castShadow = false;
  group.add(moon);
  const memory = new THREE.PointLight(0xffb45f, 3.2, 30, 1.9);
  memory.name = 'campus-memory-light';
  memory.position.set(-1, 5.5, -54);
  memory.castShadow = false;
  group.add(memory);
  const deletion = new THREE.PointLight(0x7abfff, 2.4, 34, 2);
  deletion.name = 'campus-deletion-light';
  deletion.position.set(0, 8.5, -77);
  deletion.castShadow = false;
  group.add(deletion);
}

function applyPbrMaterial(architecture, role, material) {
  for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
    if (texture) texture.repeat.set(role === 'wood' ? 3 : 5, role === 'wood' ? 3 : 5);
  }
  architecture.group.traverse((object) => {
    if (object.isMesh && object.material?.name === `campus-${role}-material`) object.material = material;
  });
}

export function createFloatingCampusEnvironment({
  assetLoader = createEnvironmentAssetLoader(),
  scene
} = {}) {
  if (!scene?.isScene) throw new TypeError('부유 캠퍼스를 추가할 Three.js 장면이 필요합니다.');
  const architecture = createCampusArchitecture();
  const group = new THREE.Group();
  group.name = 'h17-floating-campus';
  group.add(architecture.group);
  const backdrop = createCampusBackdrop({ group });
  createCampusLights(group);
  const districtBeacons = createDistrictBeacons(group);
  const assetRoot = new THREE.Group();
  assetRoot.name = 'h17-campus-licensed-assets';
  group.add(assetRoot);
  scene.add(group);

  let disposed = false;
  const loadedInstances = [];
  const failedAssetIds = [];
  const failedMaterialIds = [];
  const assetPromise = Promise.all(CAMPUS_REQUIRED_ASSET_IDS.map(async (assetId) => {
    const instance = await assetLoader.load(assetId);
    loadedInstances.push(instance);
    if (instance.isPlaceholder) failedAssetIds.push(assetId);
    if (disposed) return;
    CAMPUS_ASSET_PLACEMENTS
      .filter((entry) => entry.assetId === assetId)
      .forEach((entry, index) => {
        const clone = instance.root.clone(true);
        applyPlacement(clone, entry, index);
        assetRoot.add(clone);
      });
  }));
  const materialPromise = Promise.all(Object.entries(PBR_MATERIAL_BINDINGS).map(async ([role, materialId]) => {
    const instance = await assetLoader.loadMaterial(materialId);
    loadedInstances.push(instance);
    if (instance.isPlaceholder) failedMaterialIds.push(materialId);
    if (!disposed) applyPbrMaterial(architecture, role, instance.material);
  }));
  const ready = Promise.all([assetPromise, materialPromise]).then(() => Object.freeze({
    failedAssetIds: Object.freeze([...failedAssetIds]),
    failedMaterialIds: Object.freeze([...failedMaterialIds]),
    loadedAssetIds: Object.freeze(CAMPUS_REQUIRED_ASSET_IDS.filter((id) => !failedAssetIds.includes(id))),
    placedInstances: assetRoot.children.length,
    status: failedAssetIds.length === 0 && failedMaterialIds.length === 0 ? 'ready' : 'degraded'
  })).catch((error) => Object.freeze({
    error: error instanceof Error ? error.message : String(error),
    failedAssetIds: Object.freeze([...CAMPUS_REQUIRED_ASSET_IDS]),
    failedMaterialIds: Object.freeze(Object.values(PBR_MATERIAL_BINDINGS)),
    loadedAssetIds: Object.freeze([]),
    placedInstances: assetRoot.children.length,
    status: 'error'
  }));

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      backdrop.dispose();
      districtBeacons.dispose();
      architecture.dispose();
      assetLoader.dispose();
    },
    getDebugState: () => Object.freeze({
      architecture: architecture.getDebugState(),
      assetInstances: assetRoot.children.length,
      districtSigns: backdrop.signCount,
      failedAssetIds: Object.freeze([...failedAssetIds]),
      failedMaterialIds: Object.freeze([...failedMaterialIds]),
      requiredAssetIds: CAMPUS_REQUIRED_ASSET_IDS,
      status: disposed ? 'disposed' : assetRoot.children.length > 0 ? 'loaded' : 'loading'
    }),
    group,
    ready
  });
}
