import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  CAMPUS_ASSET_PLACEMENTS,
  CAMPUS_DISTRICTS,
  CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS,
  CAMPUS_LANDMARKS,
  CAMPUS_MEMORY_PATH,
  CAMPUS_MATERIAL_ROLES,
  CAMPUS_REQUIRED_ASSET_IDS
} from '../src/reboot/content/campus/chapterOneCampus.js';
import { ENVIRONMENT_ASSETS, ENVIRONMENT_SOURCES } from '../src/reboot/environment/catalog.js';
import { createFloatingCampusEnvironment } from '../src/reboot/render/floatingCampusEnvironment.js';

function createFakeAssetLoader() {
  const disposedInstances = [];
  let loaderDisposed = false;
  return {
    getDebugState: () => ({ disposedInstances, loaderDisposed }),
    async load(id) {
      const root = new THREE.Group();
      root.add(new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x7f8f9f })
      ));
      return Object.freeze({
        asset: { id },
        dispose: () => disposedInstances.push(id),
        isPlaceholder: false,
        root
      });
    },
    async loadMaterial(id) {
      const material = new THREE.MeshStandardMaterial({ color: 0x8a7b6c });
      material.name = id;
      return Object.freeze({
        definition: { id },
        dispose: () => disposedInstances.push(id),
        isPlaceholder: false,
        material
      });
    },
    dispose() {
      loaderDisposed = true;
    }
  };
}

test('Given chapter one campus canon, When audited, Then six distinct districts expose every required landmark and material', () => {
  assert.deepEqual(CAMPUS_DISTRICTS.map(({ segmentId }) => segmentId), [
    'classroom-cold-open', 'collapsing-corridor', 'first-arena',
    'memory-backup-decision', 'scanner-pursuit', 'gym-boss-arena'
  ]);
  assert.deepEqual(CAMPUS_LANDMARKS.map(({ id }) => id), [
    'h17-empty-seat', 'classroom-record-terminal', 'central-roster-spire',
    'athletics-track', 'fingerprint-recorder', 'night-library', 'memory-archive',
    'deletion-glass-tower', 'floating-gym'
  ]);
  assert.deepEqual(CAMPUS_MATERIAL_ROLES, [
    'brick', 'concrete', 'glass', 'metal', 'wood', 'track', 'foliage'
  ]);
  assert.equal(new Set(CAMPUS_DISTRICTS.map(({ id }) => id)).size, 6);
  assert.equal(CAMPUS_LANDMARKS.every(({ districtId }) => CAMPUS_DISTRICTS.some(({ id }) => id === districtId)), true);
});

test('Given the campus asset plan, When compared with the licensed catalog, Then every runtime placement resolves to a real GLB role', () => {
  const catalogIds = new Set(ENVIRONMENT_ASSETS.map(({ id }) => id));
  const buildingIds = new Set(['campus-column', 'campus-doorway', 'campus-roof', 'campus-roof-edge', 'campus-wall', 'campus-window']);
  const natureIds = new Set([
    'campus-bush', 'campus-grass', 'campus-rock', 'campus-tree', 'memory-flower',
    'vista-bush', 'vista-fern', 'vista-grass', 'vista-rock'
  ]);
  const districtCount = (districtId, ids) => CAMPUS_ASSET_PLACEMENTS.filter((entry) => (
    entry.districtId === districtId && ids.has(entry.assetId)
  )).length;

  assert.equal(CAMPUS_ASSET_PLACEMENTS.length >= 140, true);
  assert.equal(districtCount('open-classroom', natureIds) >= 14, true);
  assert.equal(districtCount('roster-tower', buildingIds) >= 12, true);
  assert.equal(districtCount('glass-administration', buildingIds) >= 12, true);
  assert.equal(CAMPUS_MEMORY_PATH.length >= 48, true);
  assert.equal(CAMPUS_MEMORY_PATH[0].z > CAMPUS_MEMORY_PATH.at(-1).z, true);
  assert.equal(CAMPUS_REQUIRED_ASSET_IDS.every((id) => catalogIds.has(id)), true);
  assert.equal(CAMPUS_ASSET_PLACEMENTS.every(({ districtId }) => (
    CAMPUS_DISTRICTS.some(({ id }) => id === districtId)
  )), true);
});

test('Given the first campus vista, When framed from the route camera, Then licensed assets form two foreground wings and preserve the center path', () => {
  const leftWing = CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.filter(({ vistaRole }) => vistaRole === 'foreground-left');
  const rightWing = CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.filter(({ vistaRole }) => vistaRole === 'foreground-right');
  const allowedAssets = new Set([
    'campus-bush', 'campus-fence', 'campus-grass', 'campus-hero-rock',
    'campus-rock', 'campus-tree', 'memory-flower', 'vista-bush', 'vista-fern',
    'vista-grass', 'vista-rock'
  ]);
  const detailedNatureAssets = new Set(['vista-bush', 'vista-fern', 'vista-grass', 'vista-rock']);

  assert.equal(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.length >= 34, true);
  assert.equal(leftWing.length >= 16, true);
  assert.equal(rightWing.length >= 16, true);
  assert.equal(leftWing.every(({ position }) => (
    position.x >= -6.2 && position.x <= -2.8 && position.z >= -11.5 && position.z <= 8.5
  )), true);
  assert.equal(rightWing.every(({ position }) => (
    position.x >= 2.8 && position.x <= 6.2 && position.z >= -11.5 && position.z <= 8.5
  )), true);
  assert.equal(leftWing.filter(({ position }) => (
    position.x >= -4.4 && position.x <= -2.8 && position.z >= 0 && position.z <= 1.7
  )).length >= 4, true);
  assert.equal(rightWing.filter(({ position }) => (
    position.x >= 3.2 && position.x <= 5 && position.z >= 0 && position.z <= 1.8
  )).length >= 4, true);
  assert.equal(Math.max(...CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.map(({ position }) => position.y)) >= 0.42, true);
  assert.equal(leftWing.every(({ scale }) => scale >= 0.4 && scale <= 1.5), true);
  assert.equal(rightWing.every(({ scale }) => scale >= 0.4 && scale <= 1.5), true);
  assert.equal(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.every(({ assetId }) => allowedAssets.has(assetId)), true);
  assert.deepEqual(
    [...new Set(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS
      .filter(({ assetId }) => detailedNatureAssets.has(assetId))
      .map(({ assetId }) => assetId))].sort(),
    [...detailedNatureAssets].sort()
  );
  assert.equal(
    CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.filter(({ assetId }) => detailedNatureAssets.has(assetId)).length >= 28,
    true
  );
  assert.equal(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.filter(({ assetId }) => assetId === 'campus-hero-rock').length, 1);
  const heroRock = CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.find(({ assetId }) => assetId === 'campus-hero-rock');
  assert.equal(heroRock.position.x >= 4.8, true);
  assert.equal(heroRock.position.z <= 1.2, true);
  assert.equal(heroRock.scale <= 1.05, true);
  assert.equal(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.some(({ assetId }) => assetId === 'campus-tree'), false);
  assert.equal(CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.every((entry) => CAMPUS_ASSET_PLACEMENTS.includes(entry)), true);
  const classroomShell = CAMPUS_ASSET_PLACEMENTS.filter(({ assetId, districtId }) => (
    districtId === 'open-classroom'
      && ['campus-column', 'campus-doorway', 'campus-window'].includes(assetId)
  ));
  assert.equal(classroomShell.every(({ position, scale }) => Math.abs(position.x) >= 6.1 && scale <= 0.86), true);
  const authoredPath = CAMPUS_ASSET_PLACEMENTS.filter(({ vistaRole }) => vistaRole === 'path-surface');
  assert.equal(authoredPath.length >= 14, true);
  assert.equal(authoredPath.every(({ assetId }) => assetId === 'vista-path-stone'), true);
  assert.equal(ENVIRONMENT_SOURCES['quaternius-stylized-nature'].license, 'CC0 1.0');
});

test('Given licensed assets load successfully, When the floating campus becomes ready, Then architecture and placed GLBs share one disposable scene layer', async () => {
  const assetLoader = createFakeAssetLoader();
  const scene = new THREE.Scene();
  const campus = createFloatingCampusEnvironment({ assetLoader, scene });
  const report = await campus.ready;

  assert.equal(report.status, 'ready');
  assert.equal(report.failedAssetIds.length, 0);
  assert.equal(report.failedMaterialIds.length, 0);
  assert.equal(report.placedInstances, CAMPUS_ASSET_PLACEMENTS.length);
  assert.equal(scene.getObjectByName('h17-floating-campus'), campus.group);
  assert.ok(scene.getObjectByName('central-roster-spire'));
  assert.ok(scene.getObjectByName('fingerprint-recorder'));
  assert.ok(scene.getObjectByName('deletion-glass-tower'));
  assert.ok(scene.getObjectByName('floating-gym'));
  assert.equal(campus.getDebugState().architecture.materialRoles.length, 7);
  assert.equal(campus.getDebugState().memoryPathAccents, CAMPUS_MEMORY_PATH.length);
  assert.equal(campus.getDebugState().firstVistaAssets, CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS.length);
  assert.equal(campus.getDebugState().mountainRidges >= 2, true);
  assert.equal(campus.getDebugState().distantCampusInstances >= 90, true);
  assert.equal(campus.getDebugState().distantWindowLights, 36);
  assert.match(
    scene.getObjectByName('floating-campus-cinematic-night-sky').material.fragmentShader,
    /twilightCloud/
  );
  assert.match(
    scene.getObjectByName('floating-campus-twilight-sea').material.fragmentShader,
    /waveGlint/
  );
  assert.deepEqual(campus.getDebugState().architecture.firstVistaSurface, {
    cliffRockCount: 72,
    cliffRockHeightLevels: 9,
    deckMaterialRole: 'path',
    floatingRecordCount: 11,
    gardenTerraceCount: 4,
    gardenTerraceHeightLevels: 4,
    goalBeamCount: 1,
    paverCount: 82,
    paverHeightLevels: 5
  });
  assert.equal(scene.getObjectByName('campus-platform-deck-open-classroom').material.name, 'structural-concrete');
  assert.equal(scene.getObjectByName('campus-platform-open-classroom').material.name, 'structural-concrete');
  assert.equal(scene.getObjectByName('campus-memory-route-open-classroom').material.name, 'structural-concrete');
  assert.equal(scene.getObjectByName('campus-first-vista-floating-records').count, 11);
  assert.equal(scene.getObjectByName('campus-first-vista-floating-records').material.name, 'campus-floating-record-material');
  assert.equal(scene.getObjectByName('campus-first-vista-goal-beam').material.name, 'campus-goal-beam-material');
  assert.equal(scene.getObjectByName('campus-objective-beacons').count, CAMPUS_DISTRICTS.length);
  scene.updateMatrixWorld(true);
  const classroomDeck = scene.getObjectByName('campus-platform-deck-open-classroom');
  const deckVisibleAt = (x, z) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(classroomDeck, false).length > 0;
  };
  assert.equal(deckVisibleAt(0, 4.8), true);
  assert.equal(deckVisibleAt(0, 10), true);
  assert.equal(deckVisibleAt(0, 0), true);
  assert.equal(deckVisibleAt(5, -4), true);
  assert.equal(deckVisibleAt(-6.2, 3.7), false);
  assert.equal(deckVisibleAt(6.2, 3.7), false);
  const terraceGeometry = scene.getObjectByName('campus-first-vista-garden-terrace-0').geometry;
  terraceGeometry.computeBoundingBox();
  assert.equal(terraceGeometry.boundingBox.max.y - terraceGeometry.boundingBox.min.y >= 0.7, true);
  assert.equal(scene.getObjectByName('athletics-track').material.name, 'road-asphalt');
  assert.equal(scene.getObjectByName('campus-first-vista-stone-pavers').isInstancedMesh, true);
  assert.equal(scene.getObjectByName('campus-first-vista-stone-pavers').geometry.type, 'ExtrudeGeometry');
  assert.equal(scene.getObjectByName('campus-first-vista-stone-pavers').material.name, 'structural-concrete');
  assert.equal(scene.getObjectByName('campus-first-vista-stone-pavers').material.emissiveMap, null);
  assert.equal(scene.getObjectByName('campus-first-vista-stone-pavers').material.emissiveIntensity <= 0.14, true);
  assert.equal(scene.getObjectByName('campus-first-vista-cliff-rocks').isInstancedMesh, true);
  assert.equal(scene.getObjectByName('campus-first-vista-garden-terrace-0').material.name, 'structural-concrete');
  assert.equal(scene.getObjectByName('floating-campus-distant-window-lights').count, 36);
  const treeBatch = scene.getObjectByName('campus-asset-campus-tree-batch-0');
  assert.equal(treeBatch.material.color.getHex(), 0x4d645c);
  assert.equal(treeBatch.material.emissive.getHex(), 0x14241f);
  assert.equal(treeBatch.material.emissiveIntensity, 0.16);
  assert.equal(treeBatch.material.roughness, 0.94);
  const heroRockBatch = scene.getObjectByName('campus-asset-campus-hero-rock-batch-0');
  assert.equal(heroRockBatch.material.color.getHex(), 0x585b67);
  assert.equal(heroRockBatch.material.emissive.getHex(), 0x10131b);
  assert.equal(heroRockBatch.material.emissiveIntensity, 0.08);
  assert.equal(heroRockBatch.material.metalness, 0);

  campus.dispose();
  assert.equal(assetLoader.getDebugState().loaderDisposed, true);
  assert.equal(scene.getObjectByName('h17-floating-campus'), undefined);
});

test('Given primary campus architecture, When source is inspected, Then visible landmarks are not authored as BoxGeometry stand-ins', () => {
  const source = readFileSync(new URL('../src/reboot/render/campusArchitecture.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /BoxGeometry/);
  assert.match(source, /ExtrudeGeometry/);
  assert.match(source, /TubeGeometry/);
  assert.match(source, /CylinderGeometry/);
});
