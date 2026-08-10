import * as THREE from 'three';

import { CAMPUS_VISUAL_PROFILE } from '../design/tokens.js';
import { createLayeredCampusSilhouettes } from './campusEnvironmentLayers.js';
import { createMistBands } from './campusReferenceScenicEffects.js';

const ISLANDS = Object.freeze([
  Object.freeze({ band: 0, scale: 2.4, x: -24, y: -0.8, z: -30 }),
  Object.freeze({ band: 0, scale: 1.9, x: -15, y: 1.4, z: -34 }),
  Object.freeze({ band: 0, scale: 2.1, x: 16, y: 0.6, z: -33 }),
  Object.freeze({ band: 0, scale: 2.55, x: 27, y: -1.2, z: -31 }),
  Object.freeze({ band: 1, scale: 2.7, x: -38, y: 2.3, z: -51 }),
  Object.freeze({ band: 1, scale: 2.05, x: -25, y: 4.1, z: -56 }),
  Object.freeze({ band: 1, scale: 2.25, x: 25, y: 3.6, z: -55 }),
  Object.freeze({ band: 1, scale: 2.9, x: 40, y: 1.8, z: -50 }),
  Object.freeze({ band: 2, scale: 3.2, x: -50, y: 5.4, z: -78 }),
  Object.freeze({ band: 2, scale: 2.45, x: -32, y: 7.2, z: -83 }),
  Object.freeze({ band: 2, scale: 2.6, x: 33, y: 6.8, z: -82 }),
  Object.freeze({ band: 2, scale: 3.35, x: 51, y: 4.8, z: -77 })
]);

const TREE_COUNTS = Object.freeze([3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2]);

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

function createFloatingIslandLayers({ group, prefix, resources }) {
  const palette = CAMPUS_VISUAL_PROFILE.referenceVista;
  const plateauGeometry = resources.register(
    new THREE.CylinderGeometry(1, 0.86, 0.46, 7, 1), `${prefix}-reference-island-plateau-geometry`
  );
  const undersideGeometry = resources.register(
    new THREE.ConeGeometry(1, 2.4, 7, 1), `${prefix}-reference-island-underside-geometry`
  );
  undersideGeometry.rotateZ(Math.PI);
  const plateauMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: palette.islandTop, emissiveIntensity: 0, metalness: 0, roughness: 0.98
  }), `${prefix}-reference-island-plateau-material`);
  const undersideMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: palette.islandUnderside, emissiveIntensity: 0, metalness: 0, roughness: 1
  }), `${prefix}-reference-island-underside-material`);
  const plateaus = disableShadows(new THREE.InstancedMesh(
    plateauGeometry, plateauMaterial, ISLANDS.length
  ));
  const undersides = disableShadows(new THREE.InstancedMesh(
    undersideGeometry, undersideMaterial, ISLANDS.length
  ));
  plateaus.name = `${prefix}-reference-island-plateaus`;
  undersides.name = `${prefix}-reference-island-undersides`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  ISLANDS.forEach((island, index) => {
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 0.47);
    matrix.compose(
      new THREE.Vector3(island.x, island.y, island.z),
      quaternion,
      new THREE.Vector3(island.scale * 1.42, island.scale, island.scale)
    );
    plateaus.setMatrixAt(index, matrix);
    matrix.compose(
      new THREE.Vector3(island.x, island.y - island.scale * 1.08, island.z),
      quaternion,
      new THREE.Vector3(island.scale * 1.3, island.scale * 0.8, island.scale * 0.92)
    );
    undersides.setMatrixAt(index, matrix);
  });
  plateaus.instanceMatrix.needsUpdate = true;
  undersides.instanceMatrix.needsUpdate = true;
  group.add(plateaus, undersides);
  return ISLANDS.length;
}

function createIslandTrees({ group, prefix, resources }) {
  const palette = CAMPUS_VISUAL_PROFILE.referenceVista;
  const treeCount = TREE_COUNTS.reduce((sum, count) => sum + count, 0);
  const canopyGeometry = resources.register(
    new THREE.ConeGeometry(0.42, 1.2, 5), `${prefix}-reference-tree-canopy-geometry`
  );
  const canopies = disableShadows(new THREE.InstancedMesh(
    canopyGeometry,
    resources.register(new THREE.MeshStandardMaterial({
      color: 0xffffff, emissiveIntensity: 0, roughness: 0.96
    }), `${prefix}-reference-tree-canopy-material`),
    treeCount
  ));
  canopies.name = `${prefix}-reference-tree-canopies`;
  const matrix = new THREE.Matrix4();
  let treeIndex = 0;
  ISLANDS.forEach((island, islandIndex) => {
    const scale = Math.max(0.48, 0.9 - island.band * 0.14);
    for (let index = 0; index < TREE_COUNTS[islandIndex]; index += 1) {
      const x = island.x + (index - 1) * island.scale * 0.48;
      const z = island.z + ((index + islandIndex) % 2 ? -0.22 : 0.28) * island.scale;
      const baseY = island.y + island.scale * 0.25;
      matrix.compose(
        new THREE.Vector3(x, baseY + scale * 1.2, z),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale)
      );
      canopies.setMatrixAt(treeIndex, matrix);
      canopies.setColorAt(treeIndex, new THREE.Color(palette.treeCanopy[island.band]));
      treeIndex += 1;
    }
  });
  canopies.instanceMatrix.needsUpdate = true;
  canopies.instanceColor.needsUpdate = true;
  group.add(canopies);
  return treeCount;
}

export function createReferenceVistaLayers(options) {
  const base = createLayeredCampusSilhouettes(options);
  const referenceVista = Object.freeze({
    floatingIslands: createFloatingIslandLayers(options),
    foregroundLeaves: 0,
    islandTrees: createIslandTrees(options),
    memoryHalos: 0,
    mistBands: createMistBands(options),
    scenicDrawCalls: 4
  });
  return Object.freeze({ ...base, referenceVista });
}
