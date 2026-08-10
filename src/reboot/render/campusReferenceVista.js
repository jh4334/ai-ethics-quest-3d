import * as THREE from 'three';

import { CAMPUS_VISUAL_PROFILE } from '../design/tokens.js';
import { createLayeredCampusSilhouettes } from './campusEnvironmentLayers.js';
import { createMistBands } from './campusReferenceScenicEffects.js';

const ISLANDS = Object.freeze([
  Object.freeze({ band: 0, scale: 3.8, x: -16.5, y: -1.3, z: -2 }),
  Object.freeze({ band: 0, scale: 3.2, x: 14.2, y: -2.4, z: -3 }),
  Object.freeze({ band: 0, scale: 2.5, x: -23, y: -0.8, z: -28 }),
  Object.freeze({ band: 0, scale: 2, x: -14, y: 1.4, z: -33 }),
  Object.freeze({ band: 0, scale: 2.2, x: 15, y: 0.6, z: -32 }),
  Object.freeze({ band: 0, scale: 2.7, x: 27, y: -1.2, z: -29 }),
  Object.freeze({ band: 1, scale: 2.8, x: -38, y: 2.3, z: -50 }),
  Object.freeze({ band: 1, scale: 2.2, x: -25, y: 4.1, z: -55 }),
  Object.freeze({ band: 1, scale: 1.8, x: -9, y: 5.1, z: -59 }),
  Object.freeze({ band: 1, scale: 1.9, x: 10, y: 4.8, z: -58 }),
  Object.freeze({ band: 1, scale: 2.4, x: 25, y: 3.6, z: -54 }),
  Object.freeze({ band: 1, scale: 3, x: 40, y: 1.8, z: -49 }),
  Object.freeze({ band: 2, scale: 3.3, x: -51, y: 5.4, z: -77 }),
  Object.freeze({ band: 2, scale: 2.5, x: -33, y: 7.2, z: -82 }),
  Object.freeze({ band: 2, scale: 2, x: -14, y: 8.1, z: -86 }),
  Object.freeze({ band: 2, scale: 2.1, x: 14, y: 7.8, z: -85 }),
  Object.freeze({ band: 2, scale: 2.7, x: 34, y: 6.8, z: -81 }),
  Object.freeze({ band: 2, scale: 3.5, x: 52, y: 4.8, z: -76 })
]);

const TREE_COUNTS = Object.freeze([5, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1]);

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

function createIslandGeometry(resources, prefix) {
  const geometry = resources.register(
    new THREE.CylinderGeometry(1.12, 0.1, 3.2, 7, 3, false),
    `${prefix}-reference-island-cluster-geometry`
  );
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(CAMPUS_VISUAL_PROFILE.referenceVista.islandTop);
  const underside = new THREE.Color(CAMPUS_VISUAL_PROFILE.referenceVista.islandUnderside);
  const mixed = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const taper = THREE.MathUtils.clamp((y + 1.6) / 3.2, 0, 1);
    const angle = Math.atan2(position.getZ(index), position.getX(index));
    const radialNoise = 1 + Math.sin(angle * 5 + y * 1.9) * 0.09;
    position.setX(index, position.getX(index) * radialNoise);
    position.setZ(index, position.getZ(index) * radialNoise);
    mixed.copy(underside).lerp(top, Math.pow(taper, 0.52));
    colors[index * 3] = mixed.r;
    colors[index * 3 + 1] = mixed.g;
    colors[index * 3 + 2] = mixed.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createFloatingIslandClusters({ group, prefix, resources }) {
  const material = resources.register(new THREE.MeshStandardMaterial({
    color: 0xffffff, emissiveIntensity: 0, metalness: 0, roughness: 0.98, vertexColors: true
  }), `${prefix}-reference-island-cluster-material`);
  const clusters = disableShadows(new THREE.InstancedMesh(
    createIslandGeometry(resources, prefix), material, ISLANDS.length
  ));
  clusters.name = `${prefix}-reference-island-clusters`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  ISLANDS.forEach((island, index) => {
    quaternion.setFromEuler(new THREE.Euler(0, index * 0.47, (index % 3 - 1) * 0.04));
    matrix.compose(
      new THREE.Vector3(island.x, island.y - island.scale * 0.7, island.z),
      quaternion,
      new THREE.Vector3(island.scale * 1.48, island.scale, island.scale)
    );
    clusters.setMatrixAt(index, matrix);
  });
  clusters.instanceMatrix.needsUpdate = true;
  group.add(clusters);
  return ISLANDS.length;
}

function createForegroundLeaves({ group, prefix, resources }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.62);
  shape.bezierCurveTo(0.38, -0.34, 0.43, 0.22, 0, 0.72);
  shape.bezierCurveTo(-0.43, 0.22, -0.38, -0.34, 0, -0.62);
  const geometry = resources.register(
    new THREE.ShapeGeometry(shape, 4), `${prefix}-reference-foreground-leaf-geometry`
  );
  const material = resources.register(new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.93, side: THREE.DoubleSide, vertexColors: false
  }), `${prefix}-reference-foreground-leaf-material`);
  const count = 56;
  const leaves = disableShadows(new THREE.InstancedMesh(geometry, material, count));
  leaves.name = `${prefix}-reference-foreground-leaves`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();
  const palette = CAMPUS_VISUAL_PROFILE.referenceVista;
  for (let index = 0; index < count; index += 1) {
    const isLeft = index < 32;
    const local = isLeft ? index : index - 32;
    const sideCount = isLeft ? 32 : 24;
    const t = local / (sideCount - 1);
    const x = isLeft
      ? -7.2 - (local % 4) * 0.58 - Math.sin(local * 1.7) * 0.28
      : 6.4 + (local % 4) * 0.54 + Math.sin(local * 1.3) * 0.24;
    const y = 0.75 + (local % 7) * 0.58 + (isLeft ? 0.75 : 0.05);
    const z = 8.2 - t * 18.5 + Math.cos(local * 1.9) * 0.42;
    quaternion.setFromEuler(new THREE.Euler(
      (local % 3 - 1) * 0.24,
      (isLeft ? 0.62 : -0.62) + Math.sin(local) * 0.3,
      (local % 5 - 2) * 0.42
    ));
    const scale = (isLeft ? 0.58 : 0.5) + (local % 4) * 0.08;
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(scale, scale, scale));
    leaves.setMatrixAt(index, matrix);
    color.set((isLeft ? palette.leftLeaves : palette.rightLeaves)[local % 4]);
    leaves.setColorAt(index, color);
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  group.add(leaves);
  return count;
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
    const scale = Math.max(0.48, 0.92 - island.band * 0.14);
    const count = TREE_COUNTS[islandIndex];
    for (let index = 0; index < count; index += 1) {
      const offset = index - (count - 1) / 2;
      const x = island.x + offset * island.scale * 0.42;
      const z = island.z + ((index + islandIndex) % 2 ? -0.22 : 0.28) * island.scale;
      const baseY = island.y + island.scale * 0.3;
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
    floatingIslands: createFloatingIslandClusters(options),
    foregroundLeaves: createForegroundLeaves(options),
    islandTrees: createIslandTrees(options),
    memoryHalos: 0,
    mistBands: createMistBands(options),
    scenicDrawCalls: 4
  });
  return Object.freeze({ ...base, referenceVista });
}
