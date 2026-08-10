import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { CAMPUS_MEMORY_PATH } from '../src/reboot/content/campus/chapterOneCampus.js';
import { createFloatingCampusEnvironment } from '../src/reboot/render/floatingCampusEnvironment.js';

function createAssetLoader() {
  return {
    async load(id) {
      const root = new THREE.Group();
      root.add(new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x7f8f9f })
      ));
      return Object.freeze({ asset: { id }, dispose() {}, isPlaceholder: false, root });
    },
    async loadMaterial(id) {
      const material = new THREE.MeshStandardMaterial({ color: 0x8a7b6c });
      material.name = id;
      return Object.freeze({ definition: { id }, dispose() {}, isPlaceholder: false, material });
    },
    dispose() {}
  };
}

async function createCampusFixture(t) {
  const scene = new THREE.Scene();
  const campus = createFloatingCampusEnvironment({ assetLoader: createAssetLoader(), scene });
  t.after(() => campus.dispose());
  await campus.ready;
  return { campus, scene };
}

test('Given the reference opening vista, When its scenic layers render, Then foliage islands and mist form three readable depths', async (t) => {
  const { campus, scene } = await createCampusFixture(t);

  assert.deepEqual(campus.getDebugState().referenceVista, {
    floatingIslands: 18,
    foregroundLeaves: 56,
    islandTrees: 42,
    memoryHalos: 0,
    mistBands: 3,
    scenicDrawCalls: 4
  });
  assert.equal(scene.getObjectByName('floating-campus-reference-foreground-leaves').count, 56);
  assert.equal(scene.getObjectByName('floating-campus-reference-island-clusters').count, 18);
  assert.equal(scene.getObjectByName('floating-campus-reference-island-plateaus'), undefined);
  assert.equal(scene.getObjectByName('floating-campus-reference-island-undersides'), undefined);
  assert.equal(scene.getObjectByName('floating-campus-reference-tree-canopies').count, 42);
  assert.equal(scene.getObjectByName('floating-campus-reference-mist-bands').count, 3);
});

test('Given the reference vista materials, When inspected, Then only memory emits and no scenic layer uses box stand-ins', async (t) => {
  const { scene } = await createCampusFixture(t);

  const islands = scene.getObjectByName('floating-campus-reference-island-clusters');
  const mist = scene.getObjectByName('floating-campus-reference-mist-bands');
  const footprints = scene.getObjectByName('floating-campus-memory-footprints');

  assert.notEqual(islands.geometry.type, 'BoxGeometry');
  assert.equal(islands.material.emissiveIntensity, 0);
  assert.equal(islands.material.vertexColors, true);
  assert.equal(mist.material.transparent, true);
  assert.equal(mist.material.depthWrite, false);
  assert.equal(scene.getObjectByName('floating-campus-reference-memory-halos'), undefined);
  assert.equal(footprints.material.emissive.getHex(), 0xff9a38);
  assert.equal(footprints.material.emissiveIntensity <= 1.5, true);
});
