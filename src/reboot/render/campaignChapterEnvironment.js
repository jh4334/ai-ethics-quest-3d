import * as THREE from 'three';

import { createEnvironmentAssetLoader } from '../environment/loader.js';
import { createEmissivePathAccents, createLayeredCampusSilhouettes } from './campusEnvironmentLayers.js';
import { createDisposableRegistry } from './dispose.js';

const prop = (id, x, z, scale = 1, yaw = 0, y = 0) => ({ id, scale, x, y, yaw, z });

const RECIPES = Object.freeze({
  'media-plaza': [
    prop('campus-tree', -5, -2, 0.9), prop('campus-tree', 5, -2, 0.9),
    prop('campus-bush', -4.2, 2.4, 0.8), prop('campus-bush', 4.2, 2.4, 0.8),
    prop('campus-rock', -2.4, -4, 0.8), prop('classroom-screen', 2.4, -4, 1.2, Math.PI)
  ],
  'edit-bays': [
    prop('classroom-desk', -4.2, -3, 1.05), prop('classroom-chair', -4.2, -1.8, 1, Math.PI),
    prop('classroom-screen', -4.2, -3.1, 1.1), prop('classroom-desk', 4.2, 2.2, 1.05, Math.PI),
    prop('classroom-chair', 4.2, 1, 1), prop('campus-doorway', 0, -5.6, 1.2)
  ],
  'upload-trace': [
    prop('library-bookcase', -5, -3.2, 1.15, Math.PI / 2), prop('library-books', -4.2, -3.2, 1.1, Math.PI / 2, 1.1),
    prop('classroom-screen', -2.8, -4.5, 1.25), prop('classroom-screen', 2.8, -4.5, 1.25),
    prop('campus-column', -5.2, 3.2, 1.15), prop('campus-column', 5.2, 3.2, 1.15)
  ],
  'broadcast-stage': [
    prop('campus-column', -6, -4.8, 1.3), prop('campus-column', 6, -4.8, 1.3),
    prop('classroom-screen', -3.2, -5.4, 1.4), prop('classroom-screen', 3.2, -5.4, 1.4),
    prop('campus-stairs', 0, 2.8, 1.25, Math.PI), prop('campus-doorway', 0, -6.2, 1.55)
  ],
  'split-foyer': [
    prop('campus-doorway', -3.6, -4.5, 1.3), prop('campus-doorway', 3.6, -4.5, 1.3),
    prop('campus-column', -5.8, 1.8, 1.2), prop('campus-column', 5.8, 1.8, 1.2),
    prop('campus-tree', -6, -4, 0.75), prop('campus-rock', 6, -4, 0.8)
  ],
  'warm-incomplete': [
    prop('classroom-desk', -4.4, -3.2, 1.05), prop('classroom-chair', -4.4, -2, 1, Math.PI),
    prop('library-bookcase', 4.8, -3.6, 1.15, -Math.PI / 2), prop('library-books', 4, -3.6, 1.1, -Math.PI / 2, 1.1),
    prop('campus-tree', -5.4, 2.8, 0.8), prop('campus-bush', 5.4, 2.8, 0.85)
  ],
  'cold-verified': [
    prop('classroom-screen', -4.2, -4, 1.35), prop('classroom-screen', 0, -4, 1.35),
    prop('classroom-screen', 4.2, -4, 1.35), prop('campus-column', -5.4, 2.8, 1.2),
    prop('campus-column', 5.4, 2.8, 1.2), prop('campus-window', 0, -5.4, 1.4)
  ],
  'deletion-archive': [
    prop('library-bookcase', -5.5, -3.6, 1.25, Math.PI / 2), prop('library-bookcase', 5.5, -3.6, 1.25, -Math.PI / 2),
    prop('library-books', -4.6, -3.6, 1.15, Math.PI / 2, 1.1), prop('library-books', 4.6, -3.6, 1.15, -Math.PI / 2, 1.1),
    prop('campus-doorway', 0, -5.8, 1.5), prop('classroom-screen', 0, -4.9, 1.35)
  ],
  'approval-intake': [
    prop('classroom-desk', -4, -3, 1.05), prop('classroom-chair', -4, -1.8, 1, Math.PI),
    prop('classroom-screen', -4, -3.1, 1.15), prop('library-bookcase', 4.6, -3, 1.15, -Math.PI / 2),
    prop('library-books', 3.8, -3, 1.1, -Math.PI / 2, 1.1), prop('campus-doorway', 0, -5.4, 1.35)
  ],
  'conveyor-scoring': [
    prop('campus-column', -5.6, -4, 1.2), prop('campus-column', 5.6, -4, 1.2),
    prop('classroom-screen', -4.4, 2, 1.2, Math.PI), prop('classroom-screen', 4.4, 2, 1.2, Math.PI),
    prop('campus-stairs', -5, -1, 1.05, Math.PI / 2), prop('campus-stairs', 5, -1, 1.05, -Math.PI / 2)
  ],
  'approval-trace': [
    prop('classroom-desk', -3.4, -3.8, 1.05), prop('classroom-chair', -3.4, -2.6, 1, Math.PI),
    prop('classroom-screen', -3.4, -3.9, 1.2), prop('campus-window', 3.8, -4.5, 1.35),
    prop('campus-column', -5.4, 2.8, 1.2), prop('campus-column', 5.4, 2.8, 1.2)
  ],
  'emergency-archive': [
    prop('library-bookcase', -6, -3.2, 1.3, Math.PI / 2), prop('library-bookcase', 6, -3.2, 1.3, -Math.PI / 2),
    prop('library-books', -5, -3.2, 1.15, Math.PI / 2, 1.2), prop('library-books', 5, -3.2, 1.15, -Math.PI / 2, 1.2),
    prop('campus-doorway', 0, -6, 1.55), prop('campus-stairs', 0, 3.5, 1.2, Math.PI)
  ]
});

const SURFACES = Object.freeze({
  2: ['road-asphalt', 'structural-concrete', 'structural-concrete', 'road-asphalt'],
  3: ['structural-concrete', 'interior-wood', 'structural-concrete', 'masonry-brick'],
  4: ['masonry-brick', 'road-asphalt', 'structural-concrete', 'structural-concrete']
});

const CHAPTER_VISUALS = Object.freeze({
  2: Object.freeze({ colors: [0x39213f, 0x182e4e, 0x101a32], identity: 'media-festival-rig', pbr: 'road-asphalt' }),
  3: Object.freeze({ colors: [0x49253e, 0x173d4d, 0x17213c], identity: 'dual-school-divide', pbr: 'masonry-brick' }),
  4: Object.freeze({ colors: [0x3e252b, 0x263341, 0x111b2b], identity: 'approval-conveyor-spine', pbr: 'structural-concrete' })
});

function findBounds(level, segmentId) {
  return level.layers.collision.find((entry) => entry.segmentId === segmentId).walkableBounds;
}

function createShellPlacements(level) {
  return level.segments.flatMap((segment) => {
    const bounds = findBounds(level, segment.id);
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const inset = Math.min(4, (bounds.maxZ - bounds.minZ) * 0.22);
    return [
      prop('campus-wall', bounds.minX + 0.18, centerZ - inset, 1.15, Math.PI / 2),
      prop('campus-window', bounds.minX + 0.18, centerZ + inset, 1.15, Math.PI / 2),
      prop('campus-window', bounds.maxX - 0.18, centerZ - inset, 1.15, -Math.PI / 2),
      prop('campus-wall', bounds.maxX - 0.18, centerZ + inset, 1.15, -Math.PI / 2)
    ].map((entry) => ({ ...entry, y: level.planeY }));
  });
}

function configureMaterial(material) {
  for (const value of Object.values(material)) {
    if (!value?.isTexture) continue;
    value.repeat.set(2.5, 3.5);
    value.needsUpdate = true;
  }
}

function addAuthoredMesh(group, geometry, material, name, position, rotation = null, scale = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

function createChapterArchitecture({ chapter, group, level, materials, resources }) {
  const root = new THREE.Group();
  const visual = CHAPTER_VISUALS[chapter];
  root.name = visual.identity;
  group.add(root);
  const warm = resources.register(new THREE.MeshStandardMaterial({
    color: 0xf3b36c, emissive: 0x6a2f11, emissiveIntensity: 0.82, metalness: 0.28, roughness: 0.4
  }), `campaign-${chapter}-warm-material`);
  const cool = resources.register(new THREE.MeshStandardMaterial({
    color: 0x5de0c1, emissive: 0x124f4b, emissiveIntensity: 0.86, metalness: 0.32, roughness: 0.35
  }), `campaign-${chapter}-cool-material`);
  const danger = resources.register(new THREE.MeshStandardMaterial({
    color: 0xd74732, emissive: 0x5d1814, emissiveIntensity: 0.78, metalness: 0.38, roughness: 0.4
  }), `campaign-${chapter}-danger-material`);
  const pbr = materials.get(visual.pbr);
  const pylonGeometry = resources.register(new THREE.CylinderGeometry(0.38, 0.62, 5.2, 9), `campaign-${chapter}-pylon-geometry`);
  for (const [index, segment] of level.segments.entries()) {
    addAuthoredMesh(root, pylonGeometry, pbr, `campaign-${chapter}-pbr-pylon-${index}`, {
      x: segment.anchor.x + (index % 2 === 0 ? -5.8 : 5.8), y: level.planeY + 2.6, z: segment.anchor.z - 1
    });
  }

  if (chapter === 2) {
    const stage = level.segments.at(-1).anchor;
    const hoop = resources.register(new THREE.TorusGeometry(5.8, 0.2, 10, 48, Math.PI), 'media-stage-hoop');
    addAuthoredMesh(root, hoop, warm, 'media-festival-stage-arch', { x: stage.x, y: 1.1, z: stage.z - 4 });
    const pennant = resources.register(new THREE.ConeGeometry(0.5, 1.4, 3), 'media-festival-pennant');
    for (let index = 0; index < 10; index += 1) {
      addAuthoredMesh(root, pennant, index % 2 ? cool : danger, `media-festival-pennant-${index}`, {
        x: stage.x - 5.4 + index * 1.2, y: level.planeY + 4.2 + (index % 2) * 0.35, z: stage.z - 3.9
      }, { z: Math.PI });
    }
    const speaker = resources.register(new THREE.CylinderGeometry(0.55, 0.8, 1.6, 12), 'media-speaker-geometry');
    for (const [index, x] of [-4.6, -2.9, 2.9, 4.6].entries()) {
      addAuthoredMesh(root, speaker, danger, `media-festival-speaker-${index}`, { x: stage.x + x, y: 1, z: stage.z - 3.6 }, { x: Math.PI / 2 });
    }
  } else if (chapter === 3) {
    const warmZone = level.segments[1].anchor;
    const coldZone = level.segments[2].anchor;
    const arch = resources.register(new THREE.TorusGeometry(3.5, 0.18, 9, 40, Math.PI), 'dual-school-arch');
    addAuthoredMesh(root, arch, warm, 'dual-school-warm-arch', { x: warmZone.x, y: 0.2, z: warmZone.z - 3 });
    addAuthoredMesh(root, arch, cool, 'dual-school-cold-arch', { x: coldZone.x, y: 0.2, z: coldZone.z - 3 });
    const warmTree = resources.register(new THREE.ConeGeometry(0.9, 3.5, 7), 'dual-school-warm-tree');
    const coldRecord = resources.register(new THREE.OctahedronGeometry(1.05, 0), 'dual-school-cold-record');
    for (let index = 0; index < 7; index += 1) {
      addAuthoredMesh(root, warmTree, warm, `dual-school-warm-canopy-${index}`, {
        x: warmZone.x - 5.2 + index * 1.7, y: 1.75, z: warmZone.z + (index % 2 ? 2.4 : -2.2)
      });
      addAuthoredMesh(root, coldRecord, cool, `dual-school-cold-record-${index}`, {
        x: coldZone.x - 5.2 + index * 1.7, y: 1.3 + (index % 3) * 0.7, z: coldZone.z + (index % 2 ? 2.4 : -2.2)
      });
    }
    const divide = resources.register(new THREE.CylinderGeometry(0.12, 0.12, 8, 8), 'dual-school-divide-spine');
    addAuthoredMesh(root, divide, danger, 'dual-school-central-split', { x: 0, y: 4, z: level.segments[0].anchor.z });
  } else {
    const conveyor = level.segments[1].anchor;
    const roller = resources.register(new THREE.CylinderGeometry(0.38, 0.38, 5.2, 14), 'approval-conveyor-roller');
    for (let index = 0; index < 10; index += 1) {
      addAuthoredMesh(root, roller, index % 3 === 0 ? danger : pbr, `approval-conveyor-roller-${index}`, {
        x: conveyor.x, y: 0.48, z: conveyor.z - 6.3 + index * 1.4
      }, { z: Math.PI / 2 });
    }
    const gear = resources.register(new THREE.TorusGeometry(1.1, 0.2, 8, 20), 'approval-conveyor-gear');
    for (const [index, x] of [-4.2, 4.2, -6.2, 6.2].entries()) {
      addAuthoredMesh(root, gear, index % 2 ? warm : danger, `approval-conveyor-gear-${index}`, {
        x: conveyor.x + x, y: 1.8 + (index > 1 ? 1.6 : 0), z: conveyor.z - 1
      }, { y: Math.PI / 2 });
    }
    const piston = resources.register(new THREE.CylinderGeometry(0.45, 0.72, 4.2, 10), 'approval-stamp-piston');
    for (const [index, x] of [-3.2, 0, 3.2].entries()) {
      addAuthoredMesh(root, piston, danger, `approval-stamp-piston-${index}`, {
        x: conveyor.x + x, y: 3.6, z: conveyor.z - 4 + index * 3.5
      });
    }
  }
  return Object.freeze({ meshCount: root.children.length, pbrMeshCount: 4 });
}

export function createCampaignChapterEnvironment({
  assetLoader = createEnvironmentAssetLoader(), chapter, level, scene
}) {
  if (![2, 3, 4].includes(chapter) || !level || !scene?.isScene) {
    throw new TypeError('2~4장 환경에는 장 번호, 레벨, 장면이 필요합니다.');
  }
  const resources = createDisposableRegistry();
  const group = new THREE.Group();
  group.name = `campaign-chapter-${chapter}-environment`;
  const assetRoot = new THREE.Group();
  assetRoot.name = `campaign-chapter-${chapter}-glb-assets`;
  const surfaceRoot = new THREE.Group();
  surfaceRoot.name = `campaign-chapter-${chapter}-pbr-surfaces`;
  group.add(surfaceRoot, assetRoot);
  scene.add(group);
  const allBounds = level.layers.collision.map(({ walkableBounds }) => walkableBounds);
  const minZ = Math.min(...allBounds.map(({ minZ: value }) => value));
  const maxZ = Math.max(...allBounds.map(({ maxZ: value }) => value));
  const atmosphere = createLayeredCampusSilhouettes({
    centerZ: (minZ + maxZ) / 2, colors: CHAPTER_VISUALS[chapter].colors, group,
    prefix: `campaign-${chapter}`, resources, spanZ: maxZ - minZ
  });
  const accents = createEmissivePathAccents({
    colors: [0xf3b36c, 0x5de0c1], group,
    points: level.segments.flatMap((segment) => [-3, 0, 3].map((offset, index) => ({
      x: segment.anchor.x + (index - 1) * 0.7, y: level.planeY, z: segment.anchor.z + offset
    }))),
    prefix: `campaign-${chapter}`, resources
  });
  const placements = [
    ...level.segments.flatMap((segment) => RECIPES[segment.geometryId].map((entry) => ({
      ...entry, x: entry.x + segment.anchor.x, y: entry.y + level.planeY, z: entry.z + segment.anchor.z
    }))),
    ...createShellPlacements(level)
  ];
  const assetIds = [...new Set(placements.map(({ id }) => id))];
  const failedAssetIds = [];
  let disposed = false;
  let status = 'loading';
  let architectureMetrics = Object.freeze({ meshCount: 0, pbrMeshCount: 0 });

  const materialPromise = Promise.all([...new Set(SURFACES[chapter])].map(async (id) => {
    const loaded = await assetLoader.loadMaterial(id);
    if (loaded.isPlaceholder) failedAssetIds.push(id);
    if (!disposed) configureMaterial(loaded.material);
    return [id, loaded.material];
  })).then((entries) => new Map(entries));
  const assetPromise = Promise.all(assetIds.map(async (id) => {
    const loaded = await assetLoader.load(id);
    if (loaded.isPlaceholder) failedAssetIds.push(id);
    return [id, loaded.root];
  })).then((entries) => new Map(entries));
  const ready = Promise.all([materialPromise, assetPromise]).then(([materials, assets]) => {
    if (disposed) return;
    level.segments.forEach((segment, index) => {
      const bounds = findBounds(level, segment.id);
      const geometry = resources.register(new THREE.PlaneGeometry(
        bounds.maxX - bounds.minX - 0.3, bounds.maxZ - bounds.minZ - 0.3
      ), `campaign-surface-${chapter}-${segment.id}`);
      const surface = new THREE.Mesh(geometry, materials.get(SURFACES[chapter][index]));
      surface.name = `campaign-pbr-surface-${segment.id}`;
      surface.position.set((bounds.minX + bounds.maxX) / 2, level.planeY + 0.006, (bounds.minZ + bounds.maxZ) / 2);
      surface.rotation.x = -Math.PI / 2;
      surfaceRoot.add(surface);
    });
    placements.forEach((entry, index) => {
      const root = assets.get(entry.id).clone(true);
      root.name = `campaign-asset-${chapter}-${entry.id}-${index}`;
      root.position.set(entry.x, entry.y, entry.z);
      root.rotation.y = entry.yaw;
      root.scale.setScalar(entry.scale);
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      assetRoot.add(root);
    });
    architectureMetrics = createChapterArchitecture({ chapter, group, level, materials, resources });
    status = failedAssetIds.length === 0 ? 'ready' : 'degraded';
  });
  const placementSignature = `${chapter}:${level.segments.map(({ geometryId }) => geometryId).join('|')}:${assetIds.join('|')}`;

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      status = 'disposed';
      group.removeFromParent();
      group.clear();
      resources.disposeAll();
      assetLoader.dispose();
    },
    getDebugState: () => Object.freeze({
      assetInstances: assetRoot.children.length,
      atmosphericLayers: atmosphere.layerCount,
      authoredMeshes: atmosphere.instanceCount + architectureMetrics.meshCount,
      emissiveAccents: accents.accentCount,
      failedAssetIds: Object.freeze([...failedAssetIds]),
      placementSignature,
      pbrArchitectureMeshes: architectureMetrics.pbrMeshCount,
      status,
      texturedSurfaces: surfaceRoot.children.length,
      uniqueAssetIds: assetIds.length,
      zoneCount: level.segments.length
    }),
    group,
    ready
  });
}
