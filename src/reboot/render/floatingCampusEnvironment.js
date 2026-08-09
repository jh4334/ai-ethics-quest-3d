import * as THREE from 'three';

import {
  CAMPUS_ASSET_PLACEMENTS, CAMPUS_DISTRICTS, CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS,
  CAMPUS_MEMORY_PATH, CAMPUS_REQUIRED_ASSET_IDS
} from '../content/campus/chapterOneCampus.js';
import { CAMPUS_VISUAL_PROFILE, WORLD_COLORS } from '../design/tokens.js';
import { createEnvironmentAssetLoader } from '../environment/loader.js';
import { createCampusArchitecture } from './campusArchitecture.js';
import { createCampusBackdrop } from './campusBackdrop.js';
import {
  createCampusEdgeDressing, createCinematicNightSky, createLayeredCampusSilhouettes,
  createMemoryFootprintPath
} from './campusEnvironmentLayers.js';
import { createDisposableRegistry } from './dispose.js';

const PBR_MATERIAL_BINDINGS = Object.freeze({
  brick: 'masonry-brick',
  concrete: 'structural-concrete',
  track: 'road-asphalt',
  wood: 'interior-wood'
});

const ASSET_MATERIAL_ROLES = Object.freeze({
  'campus-bridge': 'wood',
  'campus-fence': 'wood',
  'campus-floor': 'wood'
});

const ASSET_NIGHT_TREATMENTS = Object.freeze({
  'campus-bush': Object.freeze({ emissive: 0x163d32, intensity: 0.38, roughness: 0.92 }),
  'campus-grass': Object.freeze({ emissive: 0x163d32, intensity: 0.36, roughness: 0.94 }),
  'campus-hero-rock': Object.freeze({
    clearMetalRoughnessMaps: true,
    emissive: 0x31445f,
    intensity: 0.48,
    metalness: 0,
    normalScale: 0.42,
    roughness: 0.96
  }),
  'campus-rock': Object.freeze({ emissive: 0x162033, intensity: 0.24, roughness: 0.96 }),
  'campus-tree': Object.freeze({ emissive: 0x14362f, intensity: 0.42, roughness: 0.92 }),
  'memory-flower': Object.freeze({ emissive: 0x6a4a18, intensity: 0.34, roughness: 0.88 })
});

const CONTACT_ASSET_IDS = new Set([
  'archive-box', 'campus-bench', 'campus-bush', 'campus-lamp', 'campus-planter',
  'campus-hero-rock', 'campus-rock', 'campus-sofa', 'campus-tree', 'classroom-chair', 'classroom-desk',
  'library-bookcase'
]);

function addInstancedAsset(parent, instance, placements, assetId) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const placementMatrix = new THREE.Matrix4();
  const combined = new THREE.Matrix4();
  const rotation = new THREE.Euler();
  instance.root.updateMatrixWorld(true);
  let meshIndex = 0;
  instance.root.traverse((source) => {
    if (!source.isMesh) return;
    const batch = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
    batch.name = `campus-asset-${assetId}-batch-${meshIndex}`;
    batch.castShadow = false;
    batch.receiveShadow = false;
    batch.userData.campusAssetId = assetId;
    for (const [index, entry] of placements.entries()) {
      position.set(entry.position.x, entry.position.y, entry.position.z);
      rotation.set(0, entry.rotationY, 0);
      quaternion.setFromEuler(rotation);
      scale.setScalar(entry.scale);
      placementMatrix.compose(position, quaternion, scale);
      combined.multiplyMatrices(placementMatrix, source.matrixWorld);
      batch.setMatrixAt(index, combined);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    parent.add(batch);
    meshIndex += 1;
  });
}

function createDistrictBeacons(group) {
  const geometry = new THREE.TorusGeometry(0.5, 0.05, 6, 24);
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
    ring.position.set(district.center.x, 2.55 + (index % 2) * 0.3, district.center.z);
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

function createAssetContactPatches(group, resources) {
  const placements = CAMPUS_ASSET_PLACEMENTS.filter((entry) => (
    entry.position.y <= 0.12 && CONTACT_ASSET_IDS.has(entry.assetId)
  ));
  const geometry = resources.register(
    new THREE.CircleGeometry(0.55, 14), 'campus-contact-patch-geometry'
  );
  const material = resources.register(new THREE.MeshBasicMaterial({
    color: 0x030713,
    depthWrite: false,
    opacity: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    transparent: true
  }), 'campus-contact-patch-material');
  const patches = new THREE.InstancedMesh(geometry, material, placements.length);
  patches.name = 'campus-asset-contact-patches';
  patches.castShadow = false;
  patches.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (const [index, entry] of placements.entries()) {
    const radius = entry.scale * (entry.assetId === 'campus-tree' ? 0.82 : 0.54);
    matrix.compose(
      new THREE.Vector3(entry.position.x, 0.045, entry.position.z),
      quaternion,
      new THREE.Vector3(radius, radius * 0.72, 1)
    );
    patches.setMatrixAt(index, matrix);
  }
  patches.instanceMatrix.needsUpdate = true;
  group.add(patches);
  return Object.freeze({ count: placements.length, patches });
}

function createCampusLights(group) {
  const moon = new THREE.DirectionalLight(0xc7d7ff, CAMPUS_VISUAL_PROFILE.lighting.moonIntensity);
  moon.name = 'campus-moon-key';
  moon.position.set(-14, 22, 8);
  moon.castShadow = false;
  group.add(moon);
  const memory = new THREE.PointLight(0xffad59, CAMPUS_VISUAL_PROFILE.lighting.memoryIntensity, 66, 1.55);
  memory.name = 'campus-memory-light';
  memory.position.set(-1, 5.4, -17);
  memory.castShadow = false;
  group.add(memory);
  const deletion = new THREE.PointLight(0x6db9ff, CAMPUS_VISUAL_PROFILE.lighting.deletionIntensity, 42, 1.85);
  deletion.name = 'campus-deletion-light';
  deletion.position.set(0, 8.5, -77);
  deletion.castShadow = false;
  group.add(deletion);
}

function applyPbrMaterial(architecture, role, material) {
  for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
    if (texture) texture.repeat.set(role === 'wood' ? 3 : 5, role === 'wood' ? 3 : 5);
  }
  if (role === 'track' || role === 'wood') {
    material.emissive.set(role === 'track' ? 0x280a08 : 0x4a2814);
    material.emissiveIntensity = role === 'track' ? 0.42 : 0.52;
  }
  material.color.setHex(CAMPUS_VISUAL_PROFILE.materialTint[role]);
  if (material.normalScale) material.normalScale.setScalar(0.82);
  architecture.group.traverse((object) => {
    if (object.isMesh && object.material?.name === `campus-${role}-material`) object.material = material;
  });
}

function applyAssetPbrMaterials(assetRoot, materials) {
  assetRoot.traverse((object) => {
    const assetId = object.userData.campusAssetId;
    const role = ASSET_MATERIAL_ROLES[assetId];
    if (object.isInstancedMesh && role && materials.has(role)) object.material = materials.get(role);
    const treatment = ASSET_NIGHT_TREATMENTS[assetId];
    if (!object.isInstancedMesh || !treatment) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (!material?.isMeshStandardMaterial) continue;
      material.emissive.setHex(treatment.emissive);
      material.emissiveIntensity = treatment.intensity;
      if (Number.isFinite(treatment.metalness)) material.metalness = treatment.metalness;
      if (treatment.clearMetalRoughnessMaps) {
        material.metalnessMap = null;
        material.roughnessMap = null;
      }
      if (Number.isFinite(treatment.normalScale) && material.normalScale) {
        material.normalScale.setScalar(treatment.normalScale);
      }
      material.roughness = treatment.roughness;
    }
  });
}

export function createFloatingCampusEnvironment({
  assetLoader = createEnvironmentAssetLoader(),
  scene
} = {}) {
  if (!scene?.isScene) throw new TypeError('부유 캠퍼스를 추가할 Three.js 장면이 필요합니다.');
  const resources = createDisposableRegistry();
  const architecture = createCampusArchitecture();
  const group = new THREE.Group();
  group.name = 'h17-floating-campus';
  group.add(architecture.group);
  const backdrop = createCampusBackdrop({ group });
  const sky = createCinematicNightSky({
    accent: WORLD_COLORS.memory, centerZ: -58, group,
    palette: CAMPUS_VISUAL_PROFILE.atmosphere, prefix: 'floating-campus', resources
  });
  const silhouettes = createLayeredCampusSilhouettes({
    centerZ: -58, colors: CAMPUS_VISUAL_PROFILE.silhouette, group,
    prefix: 'floating-campus', resources, spanZ: 86
  });
  const edgeDressing = createCampusEdgeDressing({
    accent: 0xf0c878, centerZ: -56, group, halfWidth: 15.5,
    prefix: 'floating-campus', resources, spanZ: 118
  });
  const memoryPath = createMemoryFootprintPath({
    color: WORLD_COLORS.memory, group, points: CAMPUS_MEMORY_PATH,
    prefix: 'floating-campus', resources
  });
  const contactPatches = createAssetContactPatches(group, resources);
  createCampusLights(group);
  const districtBeacons = createDistrictBeacons(group);
  const assetRoot = new THREE.Group();
  assetRoot.name = 'h17-campus-licensed-assets';
  group.add(assetRoot);
  scene.add(group);

  let disposed = false;
  let placedInstanceCount = 0;
  const loadedInstances = [];
  const loadedMaterials = new Map();
  const failedAssetIds = [];
  const failedMaterialIds = [];
  const assetPromise = Promise.all(CAMPUS_REQUIRED_ASSET_IDS.map(async (assetId) => {
    const instance = await assetLoader.load(assetId);
    loadedInstances.push(instance);
    if (instance.isPlaceholder) failedAssetIds.push(assetId);
    if (disposed) return;
    const placements = CAMPUS_ASSET_PLACEMENTS.filter((entry) => entry.assetId === assetId);
    addInstancedAsset(assetRoot, instance, placements, assetId);
    placedInstanceCount += placements.length;
  }));
  const materialPromise = Promise.all(Object.entries(PBR_MATERIAL_BINDINGS).map(async ([role, materialId]) => {
    const instance = await assetLoader.loadMaterial(materialId);
    loadedInstances.push(instance);
    if (instance.isPlaceholder) failedMaterialIds.push(materialId);
    if (!disposed) {
      loadedMaterials.set(role, instance.material);
      applyPbrMaterial(architecture, role, instance.material);
    }
  }));
  const ready = Promise.all([assetPromise, materialPromise]).then(() => {
    if (!disposed) applyAssetPbrMaterials(assetRoot, loadedMaterials);
    return Object.freeze({
      failedAssetIds: Object.freeze([...failedAssetIds]),
      failedMaterialIds: Object.freeze([...failedMaterialIds]),
      loadedAssetIds: Object.freeze(CAMPUS_REQUIRED_ASSET_IDS.filter((id) => !failedAssetIds.includes(id))),
      placedInstances: placedInstanceCount,
      status: failedAssetIds.length === 0 && failedMaterialIds.length === 0 ? 'ready' : 'degraded'
    });
  }).catch((error) => Object.freeze({
    error: error instanceof Error ? error.message : String(error),
    failedAssetIds: Object.freeze([...CAMPUS_REQUIRED_ASSET_IDS]),
    failedMaterialIds: Object.freeze(Object.values(PBR_MATERIAL_BINDINGS)),
    loadedAssetIds: Object.freeze([]),
    placedInstances: placedInstanceCount,
    status: 'error'
  }));

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      backdrop.dispose();
      resources.disposeAll();
      districtBeacons.dispose();
      architecture.dispose();
      assetLoader.dispose();
    },
    getDebugState: () => Object.freeze({
      architecture: architecture.getDebugState(),
      assetInstances: placedInstanceCount,
      contactPatches: contactPatches.count,
      districtSigns: backdrop.signCount,
      edgeDressingInstances: edgeDressing.postCount + edgeDressing.lanternCount
        + edgeDressing.shrubCount + edgeDressing.shardCount,
      firstVistaAssets: CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.length,
      failedAssetIds: Object.freeze([...failedAssetIds]),
      failedMaterialIds: Object.freeze([...failedMaterialIds]),
      memoryPathAccents: memoryPath.footprintCount,
      mountainRidges: silhouettes.ridgeCount,
      requiredAssetIds: CAMPUS_REQUIRED_ASSET_IDS,
      skyObjects: sky.skyObjects,
      atmosphericLayers: silhouettes.layerCount,
      status: disposed ? 'disposed' : assetRoot.children.length > 0 ? 'loaded' : 'loading'
    }),
    group,
    ready
  });
}
