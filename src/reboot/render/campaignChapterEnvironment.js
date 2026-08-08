import * as THREE from 'three';

import { createEnvironmentAssetLoader } from '../environment/loader.js';
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
      failedAssetIds: Object.freeze([...failedAssetIds]),
      placementSignature,
      status,
      texturedSurfaces: surfaceRoot.children.length,
      uniqueAssetIds: assetIds.length,
      zoneCount: level.segments.length
    }),
    group,
    ready
  });
}
