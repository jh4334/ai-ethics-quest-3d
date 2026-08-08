import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  CAMPUS_ASSET_PLACEMENTS,
  CAMPUS_DISTRICTS,
  CAMPUS_LANDMARKS,
  CAMPUS_MATERIAL_ROLES,
  CAMPUS_REQUIRED_ASSET_IDS
} from '../src/reboot/content/campus/chapterOneCampus.js';
import { ENVIRONMENT_ASSETS } from '../src/reboot/environment/catalog.js';
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
  assert.equal(CAMPUS_ASSET_PLACEMENTS.length >= 48, true);
  assert.equal(CAMPUS_REQUIRED_ASSET_IDS.every((id) => catalogIds.has(id)), true);
  assert.equal(CAMPUS_ASSET_PLACEMENTS.every(({ districtId }) => (
    CAMPUS_DISTRICTS.some(({ id }) => id === districtId)
  )), true);
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
